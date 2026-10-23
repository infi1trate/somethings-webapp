// ═══════════════════════════════════════════════════════════════════════════
// ASSESSMENT DECK & CARE TAB RESTRUCTURE (pack v8.0) — the report's measures
//
//   1  retired: the accordion, the Overview tab and its Recent preview, the
//      identity strip — absent from the DOM
//   2  deck walkthroughs: linear · out of order (Q6 → Q3 → Q1) · the skip path
//      (Q1 No → Q2 No: Q3–5 skipped, the deck at Q6, "of 3") · the conflict
//      path (Q3 Yes kept and counted) · the amend path (Q2 → Yes un-skips)
//   3  zero-expanded proof: an active card after EVERY interactive transition
//   4  observer: the rail fills live, a filled segment reads verbatim, no
//      controls
//   5  the tab lifecycle per lens: open → auto-select → away and back →
//      close → summary → dismiss → removed; History holds the record
//   6  rail contrast per segment state; skipped readable without colour
//   7  keyboard: the rail is a tablist; the skip and the tab are announced
//   8  reduced motion; squint screenshots
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-v8";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "escalation-active", extra = {}, reduce = false, theme = "light" } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1512, height: 1000 }, deviceScaleFactor: 2, reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.addInitScript(
    ([k, v, t]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        localStorage.setItem("somethings.theme", t);
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, chatScenarioId: chat, ...extra }, version: VERSION }, theme]
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await careOpen(page);
  return { ctx, page, errors };
}
const careOpen = async (page) => {
  if (!(await page.locator("[data-care-panel]").count()) && (await page.locator('[data-rail-tab="care"]').count())) {
    await page.locator('[data-rail-tab="care"]').first().click();
    await page.waitForTimeout(300);
  }
};
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
const setPersona = async (page, persona) => {
  await page.evaluate(([k, p]) => { const r = JSON.parse(localStorage.getItem(k)); r.state.persona = p; localStorage.setItem(k, JSON.stringify(r)); }, [KEY, persona]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await careOpen(page);
};
/** A fresh assessment: one real write puts the record in the session store,
 *  then its answers are cleared. */
const freshDeck = async (page) => {
  if (!(await store(page)).escalations?.t13) {
    await page.locator('[data-deck-card] [data-yes-no$=":no"]').first().click();
    await page.waitForTimeout(250);
  }
  await page.evaluate((k) => {
    const r = JSON.parse(localStorage.getItem(k));
    r.state.escalations.t13.safetyCheck = { answers: {}, submittedAt: null };
    localStorage.setItem(k, JSON.stringify(r));
  }, KEY);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await careOpen(page);
};
const deck = (page) =>
  page.evaluate(() => {
    const d = document.querySelector("[data-assessment-deck]");
    return {
      mode: d?.dataset.deckMode,
      active: d?.dataset.deckActive,
      card: !!d?.querySelector("[data-deck-card]") && d.querySelector("[data-deck-card]").dataset.deckCard !== "waiting",
      segs: Object.fromEntries([...(d?.querySelectorAll("[data-segment]") ?? [])].map((s) => [s.dataset.segment, s.dataset.segmentState])),
      selected: d?.querySelector('[data-segment][aria-selected="true"]')?.dataset.segment ?? null,
      skip: d?.querySelector("[data-skip-line]")?.textContent ?? null,
      prog: d?.querySelector("[data-assessment-progress]")?.textContent ?? null,
      risk: d?.querySelector("[data-review-risk]")?.textContent ?? null,
      live: d?.querySelector("[data-deck-live]")?.textContent ?? "",
      railH: Math.round(d?.querySelector("[data-coverage-rail]")?.getBoundingClientRect().height ?? 0),
    };
  });
const seg = (page, id) => page.locator(`[data-segment="${id}"]`).click().then(() => page.waitForTimeout(200));
const ans = (page, id, v) => page.locator(`[data-deck-card] [data-yes-no="${id}:${v}"]`).click().then(() => page.waitForTimeout(250));
const segStr = (s) => ["q1", "q2", "q3", "q4", "q5", "q6"].map((id) => s[id]?.[0] ?? "?").join("");

// ── 1 · RETIRED ─────────────────────────────────────────────────────────────
console.log("\n── 1 · retired patterns");
{
  const { ctx, page } = await open("/app/chat/t13");
  const r = await page.evaluate(() => ({
    accordion: !!document.querySelector("[data-assessment-accordion], [data-acc-row]"),
    overview: !!document.querySelector('[data-care-tab="overview"], [data-care-recent], [data-care-view-history]'),
    strip: !!document.querySelector("[data-care-identity], [data-identity-profile]"),
    firstIsHeader: document.querySelector("[data-care-panel] > [data-care-header]") === document.querySelector("[data-care-panel]")?.querySelector(":scope > :not([data-care-tabs-live])"),
  }));
  check(!r.accordion && !r.overview && !r.strip, "the accordion, Overview (and its Recent preview) and the identity strip are gone", JSON.stringify(r));
  check(r.firstIsHeader, "nothing renders above the anchor cells");
  /* First, before any deck interaction depends on it: an open escalation
     auto-selects its tab (a mutation run crashed rather than failed here). */
  const sel = await page.evaluate(() => document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab);
  check(sel === "escalation", "an open escalation auto-selects the Escalation review tab", String(sel));
  await ctx.close();
}

// ── 2–3 · DECK WALKTHROUGHS, AND AN ACTIVE CARD IN EVERY STATE ─────────────
console.log("\n── 2–3 · the deck");
const states = [];
const note = async (page, label) => {
  const d = await deck(page);
  states.push({ label, active: d.active, card: d.card });
  return d;
};
{
  // LINEAR
  const { ctx, page, errors } = await open("/app/chat/t13");
  await freshDeck(page);
  let d = await note(page, "fresh");
  check(d.mode === "holder" && d.active === "q1" && d.card && d.railH <= 2 * 44, "on load: the first required unanswered (Q1), its card open; the rail is one compact row", `${d.active} · rail ${d.railH}px`);
  for (const [id, v, want] of [["q1", "yes", "q2"], ["q2", "yes", "q3"], ["q3", "no", "q4"], ["q4", "no", "q5"], ["q5", "no", "q6"], ["q6", "no", "review"]]) {
    await ans(page, id, v);
    d = await note(page, `linear ${id}`);
    check(d.active === want && d.card, `linear: ${id} ${v} → the deck advances to ${want}`, `${d.active} · ${segStr(d.segs)}`);
  }
  check(d.prog === "6 of 6 needed answered" && /needed answered$/.test(d.live), "linear: complete — 6 of 6, announced as “{label}: … · n of N needed answered”", `${d.prog} · ${d.live}`);
  await page.locator("[data-assessment-deck]").screenshot({ path: `${OUT}/01-deck-complete-linear.png` });

  // OUT OF ORDER — Q6 → Q3 → Q1
  await freshDeck(page);
  await seg(page, "q6");
  d = await deck(page);
  check(d.active === "q6" && d.selected === "q6", "tapping a segment opens that question", d.active);
  await ans(page, "q6", "no");
  d = await note(page, "ooo q6");
  check(d.active === "q1", "Q6 recorded: the deck goes to the first required unanswered (Q1)", d.active);
  await seg(page, "q3");
  await ans(page, "q3", "yes");
  await seg(page, "q1");
  await ans(page, "q1", "no");
  d = await note(page, "ooo q1");
  check(d.active === "q2" && segStr(d.segs) === "neyeen" && d.risk === "Assessment suggests: Moderate risk", "Q6 → Q3 → Q1: Q2 is next; Q3 Yes holds the risk at Moderate", `${d.active} · ${segStr(d.segs)} · ${d.risk}`);

  // CONFLICT — Q3 Yes recorded, then Q1 No, Q2 No
  await ans(page, "q2", "no");
  d = await note(page, "conflict");
  check(d.segs.q3 === "yes" && d.segs.q4 === "skipped" && d.segs.q5 === "skipped" && d.prog === "4 of 4 needed answered", "conflict path: Q3's recorded Yes is retained and counted; Q4–5 skip", `${segStr(d.segs)} · ${d.prog}`);
  check(d.skip === "Q4–5 not needed — no ideation indicated", "and the quiet line names only what skipped", String(d.skip));
  const rec = (await store(page)).escalations.t13.safetyCheck.answers;
  check(rec.q3?.value === "yes", "never auto-discarded: Q3 is still on the record");

  // SKIP PATH — fresh, Q1 No → Q2 No
  await freshDeck(page);
  await ans(page, "q1", "no");
  d = await deck(page);
  check(d.skip === null && d.active === "q2", "Q1 No alone skips nothing", d.active);
  await ans(page, "q2", "no");
  d = await note(page, "skip");
  check(segStr(d.segs) === "nnssse" && d.active === "q6" && d.prog === "2 of 3 needed answered", "skip path: Q3–5 skipped, the deck at Q6, progress “of 3”", `${segStr(d.segs)} · ${d.active} · ${d.prog}`);
  check(d.skip === "Q3–5 not needed — no ideation indicated" && /Questions 3 to 5 skipped — no ideation indicated$/.test(d.live), "the quiet line, and the skip announced once", `${d.skip} · ${d.live}`);
  const ripple = await page.evaluate(() => [...document.querySelectorAll('[data-segment-state="skipped"]')].map((s) => s.classList.contains("seg-skip") ? s.style.animationDelay : "none"));
  check(ripple.join() === "0ms,70ms,140ms", "the skip ripple: the three settle left to right in one beat (make it magical 1)", ripple.join());
  await page.locator("[data-assessment-deck]").screenshot({ path: `${OUT}/02-deck-skipped.png` });
  await ans(page, "q6", "no");
  d = await note(page, "skip complete");
  check(d.active === "review" && d.prog === "3 of 3 needed answered", "complete at 3 of 3: the review card", `${d.active} · ${d.prog}`);
  check(!/skipped/.test(d.live) && /^Preparatory acts or past attempts: No · 3 of 3 needed answered$/.test(d.live), "the skip is announced ONCE — not again on the next record", d.live);
  const ledger = await page.evaluate(() => [...document.querySelectorAll("[data-ledger-row]")].map((r) => `${r.dataset.ledgerRow}:${r.querySelector("[data-ledger-value]")?.textContent}`));
  check(ledger.slice(2, 5).every((r) => r.endsWith(":Not asked — no ideation indicated")) && d.risk === "Assessment suggests: Low risk", "the ledger reads skipped rows “Not asked — no ideation indicated”; the risk runs on recorded answers", ledger.join(" | "));
  await page.locator("[data-assessment-deck]").screenshot({ path: `${OUT}/03-deck-review-skipped.png` });

  // AMEND — Q2 No → Yes un-skips
  await seg(page, "q2");
  const pressed = await page.evaluate(() => document.querySelector('[data-yes-no="q2:no"]')?.getAttribute("aria-pressed"));
  await ans(page, "q2", "yes");
  d = await note(page, "amend");
  check(pressed === "true" && d.segs.q3 === "empty" && d.skip === null && d.active === "q3" && d.prog === "3 of 6 needed answered", "amend path: Q2 → Yes un-skips Q3–5 and the deck goes to Q3", `${pressed} · ${segStr(d.segs)} · ${d.active} · ${d.prog}`);
  check(errors.length === 0, "no page errors through the walkthroughs", errors.slice(0, 2).join(" | "));
  await ctx.close();
}
check(states.length >= 12 && states.every((s) => s.card && s.active), `zero-expanded proof: an active card in all ${states.length} interactive states`, JSON.stringify(states.filter((s) => !s.card || !s.active)));

// ── 4 · OBSERVER ───────────────────────────────────────────────────────────
console.log("\n── 4 · the observer");
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "mentor" });
  await seg(page, "q4");
  await ans(page, "q4", "yes");
  await page.getByRole("radiogroup", { name: "Viewer role" }).getByRole("radio", { name: "Supervisor" }).click();
  await page.waitForTimeout(900);
  await careOpen(page);
  const o = await page.evaluate(() => {
    const d = document.querySelector("[data-node-state='current'] [data-assessment-deck]");
    return {
      mode: d?.dataset.deckMode,
      controls: d ? d.querySelectorAll("[data-yes-no], [data-assessment-wording], textarea, [data-exchange-primary]").length : -1,
      tick: !!d?.querySelector('[data-segment="q4"].tier-settle'),
      stale: !!d?.querySelector('[data-segment="q1"].tier-settle'),
      active: d?.dataset.deckActive,
    };
  });
  check(o.mode === "observer" && o.controls === 0, "observer: read-only — zero interactive affordances beyond the rail", JSON.stringify(o));
  check(o.tick && !o.stale && o.active === "q4", "an arriving answer ticks its segment and shows; earlier ones stay still (make it magical 3)", JSON.stringify(o));
  await seg(page, "q1");
  const read = await page.evaluate(() => document.querySelector("[data-deck-card] [data-answer-verbatim]")?.textContent);
  check(/^“Have you wished you were dead or wished you could go to sleep and not wake up\?” — Yes$/.test(read ?? ""), "tapping a filled segment reads the question VERBATIM and the answer", read);
  await page.locator("[data-node-state='current'] [data-assessment-deck]").screenshot({ path: `${OUT}/04-observer.png` });
  await ctx.close();
}

// ── 5 · THE TAB LIFECYCLE, PER LENS ────────────────────────────────────────
console.log("\n── 5 · the tab lifecycle");
const tabs = (page) =>
  page.evaluate(() => ({
    list: [...document.querySelectorAll("[data-care-tab]")].map((t) => t.dataset.careTab),
    sel: document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab,
    dot: document.querySelector('[data-care-tab="escalation"] [data-review-dot]')?.dataset.reviewDot ?? null,
    state: document.querySelector("[data-care-panel]")?.dataset.careState,
    said: document.querySelector("[data-care-tabs-live]")?.textContent ?? "",
    header: !!document.querySelector("[data-care-panel] > [data-care-header]"),
  }));
let closedState;
{
  const { ctx, page } = await open("/app/chat/t14", { chat: "active-mentorship" });
  const t = await tabs(page);
  check(t.list.join() === "emergency,safety-plan,resources,history" && t.sel === "emergency" && t.header, "steady: no Escalation review tab; Emergency info is the default; the header above", JSON.stringify(t));
  await page.locator('[data-care-panel]').screenshot({ path: `${OUT}/05-tabs-steady.png` });
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/chat/t13");
  let t = await tabs(page);
  check(t.list[0] === "escalation" && t.sel === "escalation" && t.dot === "alert", "mentor, open: Escalation review is leftmost, auto-selected, with the alert dot (the mentor's move)", JSON.stringify(t));
  await page.locator('[data-care-tab="emergency"]').click();
  await page.waitForTimeout(200);
  t = await tabs(page);
  check(t.sel === "emergency" && t.list[0] === "escalation", "navigate away: the tab stays, the pick holds", JSON.stringify(t));
  await page.locator('[data-care-tab="escalation"]').click();
  await page.waitForTimeout(200);
  check((await tabs(page)).sel === "escalation", "and back");
  await page.locator('[data-care-panel]').screenshot({ path: `${OUT}/06-tabs-open-mentor.png` });
  // The mentor submits; the supervisor takes it.
  for (let i = 0; i < 8; i++) { const no = page.locator('[data-deck-card] [data-yes-no$=":no"]').first(); if (!(await no.count())) break; await no.click(); await page.waitForTimeout(250); }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Probe: no plan, talking it through.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(400);
  t = await tabs(page);
  check(t.dot === null, "submitted: the supervisor's move — the mentor's dot clears", JSON.stringify(t));
  await setPersona(page, "supervisor");
  t = await tabs(page);
  check(t.sel === "escalation" && t.dot === "alert", "supervisor, assessment in: auto-selected, the dot is the supervisor's now", JSON.stringify(t));
  await page.locator('[data-s1-tier="3"]').click();
  await page.locator('[data-exchange-primary="confirm-tier"]').click();
  await page.waitForTimeout(600);
  t = await tabs(page);
  const summary = await page.evaluate(() => ({ node: document.querySelector("[data-node-state='current']")?.dataset.node, dismiss: document.querySelectorAll('[data-exchange-primary="dismiss-summary"]').length, filled: document.querySelectorAll("[data-care-panel] [data-exchange-primary]").length }));
  check(t.state === "closed" && t.sel === "escalation" && summary.node === "closed" && summary.dismiss === 1 && summary.filled === 1, "close: the tab converts to its closed summary with one Dismiss (one filled button)", JSON.stringify({ ...t, ...summary }));
  await page.locator('[data-care-panel]').screenshot({ path: `${OUT}/07-closed-summary-supervisor.png` });
  await page.locator('[data-exchange-primary="dismiss-summary"]').click();
  await page.waitForTimeout(500);
  t = await tabs(page);
  const hist = await page.evaluate(() => !!document.querySelector("[data-escalation-story]"));
  check(!t.list.includes("escalation") && t.sel === "history" && hist && /The record is in History\.$/.test(t.said), "dismiss: the tab is removed, announced, and the panel lands on History — which holds the record", JSON.stringify({ ...t, hist }));
  closedState = await store(page);
  // The mentor sees their own closed summary, and leaving it after viewing removes it.
  await setPersona(page, "mentor");
  t = await tabs(page);
  check(t.list[0] === "escalation" && t.sel === "escalation" && t.state === "closed", "mentor: the closed summary waits in its own tab (the supervisor's dismissal is the supervisor's)", JSON.stringify(t));
  await page.locator('[data-care-tab="safety-plan"]').click();
  await page.waitForTimeout(400);
  t = await tabs(page);
  const seen = (await store(page)).escalations.t13?.wrapSeenAt;
  check(!t.list.includes("escalation") && t.sel === "safety-plan" && typeof seen === "number", "navigating away after viewing removes it, recorded on the record", JSON.stringify({ ...t, seen: !!seen }));
  await ctx.close();
}

// ── 6 · RAIL CONTRAST ──────────────────────────────────────────────────────
console.log("\n── 6 · rail contrast");
for (const theme of ["light", "dark"]) {
  const { ctx, page } = await open("/app/chat/t13", { theme });
  await freshDeck(page);
  await ans(page, "q1", "no");
  await ans(page, "q2", "no");
  const rows = await page.evaluate(() => {
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const ok2 = (L, a, b) => { const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3; return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]; };
    const parse = (css) => { let m = css.match(/rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(/[,\s/]+/).map(parseFloat); return { c: v.slice(0, 3).map((x) => lin(x / 255)), a: v[3] ?? 1 }; } m = css.match(/oklab\(([^)]+)\)/); if (m) { const v = m[1].trim().split(/[\s/]+/).map(parseFloat); return { c: ok2(v[0], v[1], v[2]), a: v[3] ?? 1 }; } m = css.match(/color\(srgb\s+([^)]+)\)/); if (m) { const v = m[1].trim().split(/[\s/]+/).map(parseFloat); return { c: v.slice(0, 3).map(lin), a: v[3] ?? 1 }; } return null; };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const p = parse(getComputedStyle(e).backgroundColor); if (p && p.a > 0.5) return p.c; } return [1, 1, 1]; };
    const L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
    const out = [];
    for (const state of ["empty", "no", "skipped"]) {
      const s = document.querySelector(`[data-segment-state="${state}"]`);
      if (!s) continue;
      const fg = parse(getComputedStyle(s).color).c;
      const strike = getComputedStyle(s.querySelector("span")).textDecorationLine;
      out.push({ state, text: Number(ratio(fg, bgOf(s)).toFixed(2)), strike, mark: s.querySelector("[data-segment-mark]").textContent });
    }
    return out;
  });
  for (const r of rows) check(r.text >= 4.5, `${theme} · segment ${r.state}: text ${r.text}:1`, `mark “${r.mark}”${r.strike.includes("line-through") ? " · struck" : ""}`);
  const sk = rows.find((r) => r.state === "skipped");
  check(sk && sk.strike.includes("line-through") && sk.mark === "–" && rows.find((r) => r.state === "empty")?.mark === "·", `${theme}: skipped is distinguishable without colour — struck label and its own mark`, JSON.stringify(sk));
  await ctx.close();
}

// ── 7 · KEYBOARD AND SCREEN READER ─────────────────────────────────────────
console.log("\n── 7 · keyboard");
const transcript = [];
{
  const { ctx, page } = await open("/app/chat/t13");
  await freshDeck(page);
  const focusOf = () => page.evaluate(() => { const a = document.activeElement; return `${a?.getAttribute("role") ?? a?.tagName.toLowerCase()} “${a?.getAttribute("aria-label") || a?.textContent?.replace(/\s+/g, " ").trim().slice(0, 50)}”${a?.getAttribute("aria-selected") ? ` (selected ${a.getAttribute("aria-selected")})` : ""}`; });
  transcript.push("## The rail (mentor, fresh)");
  await page.locator('[data-segment][tabindex="0"]').focus();
  transcript.push(`focus → ${await focusOf()}`);
  for (const k of ["ArrowRight", "ArrowRight", "End", "Home"]) { await page.keyboard.press(k); transcript.push(`${k} → ${await focusOf()}`); }
  const role = await page.evaluate(() => ({ list: document.querySelector("[data-coverage-rail]")?.getAttribute("role"), stops: [...document.querySelectorAll("[data-segment]")].filter((s) => s.tabIndex === 0).length }));
  check(role.list === "tablist" && role.stops === 1, "the rail is a tablist with one tab stop; the arrows move within it", JSON.stringify(role));
  transcript.push("\n## Recording, and the skip");
  await page.locator('[data-yes-no="q1:no"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  transcript.push(`Q1 No, by Enter → announced “${(await deck(page)).live}”; focus → ${await focusOf()}`);
  await page.locator('[data-yes-no="q2:no"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const d = await deck(page);
  transcript.push(`Q2 No, by Enter → announced “${d.live}”; focus → ${await focusOf()}`);
  const f = await page.evaluate(() => document.activeElement?.dataset?.assessmentWording);
  check(f === "q6" && /Questions 3 to 5 skipped/.test(d.live), "focus follows the advance to Q6, and the skip is announced", `${f} · ${d.live}`);
  await ctx.close();
}
await writeFile(`${OUT}/KEYBOARD-TRANSCRIPT.md`, `# Keyboard / screen-reader transcript (probe-generated)\n\n${transcript.join("\n")}\n\n## The tab\n\nCreation: “Escalation review tab added.” · removal: “Escalation review closed. The record is in History.” (polite, \`data-care-tabs-live\`) — measured in §5.\n`);

// ── 8 · REDUCED MOTION ─────────────────────────────────────────────────────
console.log("\n── 8 · reduced motion");
{
  const { ctx, page } = await open("/app/chat/t13", { reduce: true });
  await freshDeck(page);
  await ans(page, "q1", "no");
  await ans(page, "q2", "no");
  const anim = await page.evaluate(() => [...document.querySelectorAll('[data-segment-state="skipped"]')].map((s) => getComputedStyle(s).animationName));
  check(anim.every((x) => x === "none"), "reduced motion: the skip ripple is stilled", anim.join());
  await ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
