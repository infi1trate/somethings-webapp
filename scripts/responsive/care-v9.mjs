// ═══════════════════════════════════════════════════════════════════════════
// ESCALATION FOCUS MODE & GUIDED ASSESSMENT (pack v9.0) — the report's measures
//
//   1  retired: the deck, the coverage rail, the review ledger — absent from
//      the DOM and the source
//   2  layout: column widths before / during / after an escalation, both
//      lenses, Support open and closed; the chat floor; ONE motion, sampled
//      per frame; reduced motion is an instant swap
//   3  truncation: every question renders in full, verbatim — zero clamps in
//      any state
//   4  focus-state proof: exactly one focused question in every capture
//      state; review is the only zero-focus state
//   5  walkthroughs: linear · out-of-order (Q6 → Q3 → Q1) · skip (No/No →
//      Q6) · conflict (Q3 Yes kept) · amend-unskip · review-amend-recompute
//   6  hero yield per lens; the supervisor strip's contrast
//   7  keyboard / screen reader transcript
//   8  observer: the same form, read-only, the quiet tick
//   9  squint screenshots: capture and review, both lenses
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-v9";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const report = {};
const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "escalation-active", extra = {}, reduce = false, theme = "light", w = 1512, h = 1000 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: reduce ? "reduce" : "no-preference" });
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
const fresh = async (page) => {
  if (!(await store(page)).escalations?.t13) {
    /* Hardened (mutation run): with no focused question the click below had
       nothing to press and crashed the probe instead of failing a check —
       focus one by tap first; §1 names the defect. */
    if (!(await page.locator("[data-ga-focused]").count())) await page.locator("[data-ga-question] > button").first().click();
    await page.locator('[data-ga-focused] [data-yes-no$=":no"]').first().click();
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
const ga = (page) =>
  page.evaluate(() => {
    const d = document.querySelector("[data-node-state='current'] [data-guided-assessment]") ?? document.querySelector("[data-guided-assessment]");
    return {
      mode: d?.dataset.gaMode,
      focus: d?.dataset.gaFocus,
      focused: d ? d.querySelectorAll("[data-ga-focused]").length : -1,
      review: !!d?.querySelector("[data-ga-review-block]"),
      states: Object.fromEntries([...(d?.querySelectorAll("[data-ga-question]") ?? [])].map((q) => [q.dataset.gaQuestion, q.dataset.gaState])),
      skip: d?.querySelector("[data-skip-line]")?.textContent ?? null,
      prog: d?.querySelector("[data-assessment-progress]")?.textContent ?? null,
      risk: d?.querySelector("[data-review-risk]")?.textContent ?? null,
      live: d?.querySelector("[data-ga-live]")?.textContent ?? "",
      notNeeded: [...(d?.querySelectorAll('[data-ga-chip-state="skipped"]') ?? [])].map((c) => c.textContent),
    };
  });
const ans = (page, id, v) => page.locator(`[data-ga-focused] [data-yes-no="${id}:${v}"]`).click().then(() => page.waitForTimeout(450));
/** Tap a question — a no-op when it is already the focused one (the form
 *  focuses the next required question by itself). */
const tap = async (page, id) => {
  if (await page.locator(`[data-ga-question="${id}"][data-ga-focused]`).count()) return;
  await page.locator(`[data-ga-question="${id}"] > button`).click();
  await page.waitForTimeout(350);
};
const stateStr = (s) => ["q1", "q2", "q3", "q4", "q5", "q6"].map((id) => ({ empty: "·", yes: "Y", no: "N", skipped: "s" })[s[id]] ?? "?").join("");

/* Every capture state seen, for checklist 4. */
const states = [];
const note = async (page, label) => {
  const g = await ga(page);
  states.push({ label, focus: g.focus, focused: g.focused, review: g.review, states: stateStr(g.states) });
  return g;
};

// ── 1 · RETIRED ─────────────────────────────────────────────────────────────
console.log("\n── 1 · retired: the deck, the rail, the ledger");
{
  const { ctx, page } = await open("/app/chat/t13");
  const dom = await page.evaluate(() => document.querySelectorAll("[data-assessment-deck], [data-coverage-rail], [data-segment], [data-review-ledger], [data-ledger-row], [data-deck-card]").length);
  check(dom === 0, "no deck, coverage rail, segment, review ledger or ledger row in the DOM", String(dom));
  const g0 = await ga(page);
  check(g0.focused === 1 && g0.focus === "q3", "on load, mid-assessment: exactly one focused question (Q3, the first required unanswered)", `${g0.focused} · ${g0.focus}`);
  await ctx.close();
  const files = await readdir("src/components/chat/escalation");
  const css = await readFile("src/app/globals.css", "utf8");
  check(!files.includes("assessment-deck.tsx") && !/\.seg-skip|\.deck-settle/.test(css), "assessment-deck.tsx and its seg-skip / deck-settle CSS are deleted, not orphaned", files.join(" "));
}

// ── 2 · LAYOUT ─────────────────────────────────────────────────────────────
console.log("\n── 2 · Escalation Focus Mode");
const cols = (page) =>
  page.evaluate(() => {
    const g = document.querySelector("[data-chat-layout]");
    const hub = document.querySelector("[data-chat-hub]");
    const thread = g.querySelector(":scope > div.flex.min-h-0.flex-col");
    return {
      cols: getComputedStyle(g).gridTemplateColumns,
      chat: Math.round(thread.getBoundingClientRect().width),
      care: hub && getComputedStyle(hub).position === "static" ? Math.round(hub.getBoundingClientRect().width) : 0,
      focus: g.hasAttribute("data-chat-focus"),
      layout: g.dataset.chatLayout,
    };
  });
const sampler = (page) =>
  page.evaluate(() => {
    window.__s = [];
    const g = document.querySelector("[data-chat-layout]");
    const t0 = performance.now();
    const tick = () => {
      const y = document.querySelector('[data-care-yield="cells"]');
      window.__s.push([Math.round(performance.now() - t0), getComputedStyle(g).gridTemplateColumns, y ? Math.round(y.getBoundingClientRect().height) : null]);
      if (performance.now() - t0 < 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const samples = (page) => page.evaluate(() => window.__s);
/** One motion: the first track leaves its start once and moves monotonically
 *  to its end, settling inside one beat; reduced motion lands in one frame. */
function motionOf(s) {
  const first = s.map(([t, c]) => [t, parseFloat(c.split(" ")[0])]);
  const a = first[0][1], z = first.at(-1)[1];
  const dir = Math.sign(z - a);
  let mono = true;
  for (let i = 1; i < first.length; i++) if (Math.sign(first[i][1] - first[i - 1][1]) === -dir) mono = false;
  const moving = first.filter(([, v]) => v !== a && v !== z).length;
  const settled = first.find(([, v]) => v === z)?.[0] ?? null;
  return { from: a, to: z, mono, between: moving, settledAt: settled };
}
async function raise(page) {
  await page.locator('[data-care-tab="emergency"]').waitFor();
  await page.locator('[data-tier-action="escalate"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-tier-row="2"]').click();
  await page.locator("[data-tier-field=note]").fill("They said they are not okay tonight.");
}
report.layout = [];
for (const w of [1512, 1280]) {
  for (const reduce of [false, true]) {
    const { ctx, page } = await open("/app/chat/t14", { chat: "active-mentorship", w, reduce });
    const before = await cols(page);
    await raise(page);
    await sampler(page);
    await page.locator("[data-tier-cta=raise]").click();
    await page.waitForTimeout(1000);
    const m = motionOf(await samples(page));
    const during = await cols(page);
    if (!reduce) {
      report.layout.push({ who: `mentor ${w}`, before: before.cols, during: during.cols });
      check(!before.focus && during.focus, `mentor ${w}: the raise opens Focus Mode`, `${before.cols} → ${during.cols}`);
      check(during.chat >= 480 && during.care <= during.chat && during.care > before.care, `mentor ${w}: chat ≥ 480, Care wider than before and never wider than chat`, `chat ${during.chat} · Care ${before.care} → ${during.care}`);
      check(m.mono && m.between >= 3 && m.settledAt !== null && m.settledAt <= 520, `mentor ${w}: ONE eased motion — monotonic, ${m.between} in-between frames, settled at ${m.settledAt}ms`, `${m.from} → ${m.to}`);
    } else {
      check(m.between === 0, `mentor ${w}, reduced motion: an instant swap (no in-between frames)`, `${m.between} frames`);
    }
    await ctx.close();
  }
}
/* Supervisor and Support open, on the fixture's open escalation. */
for (const w of [1512, 1280]) {
  for (const persona of ["mentor", "supervisor"]) {
    for (const support of [false, true]) {
      const { ctx, page } = await open("/app/chat/t13", { persona, w });
      if (support) {
        await page.locator("[data-support-cta]").filter({ visible: true }).first().click();
        await page.waitForTimeout(900);
      }
      const c = await cols(page);
      report.layout.push({ who: `${persona} ${w}${support ? " + Support" : ""}`, during: c.cols, care: c.care });
      const drawer = c.care === 0;
      check(c.focus && c.chat >= 480 && (drawer || c.care <= Math.max(c.chat, 480)), `${persona} ${w}${support ? " + Support" : ""}: focus, chat ${c.chat} ≥ 480, Care ${drawer ? "is the drawer (no room for 480 + 320)" : c.care}`, c.cols);
      if (support) check(c.layout === "beside" && !(await page.locator("[data-conversation-list]").isVisible().catch(() => false)), `${persona} ${w} + Support: the list collapses — chat · Care · Support`);
      await ctx.close();
    }
  }
}
/* Close restores — the supervisor closes at S1 (Tier 3 is a standard tier
   update) and the room puts everything back, in one motion. */
let assessed;
{
  const { ctx, page } = await open("/app/chat/t13");
  for (let i = 0; i < 8; i++) { const no = page.locator('[data-ga-focused] [data-yes-no$=":no"]').first(); if (!(await no.count())) break; await no.click(); await page.waitForTimeout(250); }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Probe: no plan, talking it through.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(400);
  assessed = await store(page);
  await setPersona(page, "supervisor");
  const during = await cols(page);
  await page.locator('[data-tier-row="3"]').click();
  await page.locator('[data-tier-cta=confirm]').click();
  await page.waitForTimeout(1100);
  /* RETARGETED (FCP-3 hero card): the diagnosis left the hero — the hero
     is its facts section. */
  const cells = await page.evaluate(() => ({ hero: !!document.querySelector('[data-care-hero="steady"] [data-care-metrics]'), yields: document.querySelectorAll("[data-care-yield], [data-diagnosis-strip]").length, state: document.querySelector("[data-care-panel]")?.dataset.careState }));
  /* RETARGETED (pack v9.1, Part 4): closing leaves the closed summary IN
     the room; Dismiss is the exit — and the restore is one motion. */
  const held = await cols(page);
  await sampler(page);
  await page.locator('[data-exchange-primary="dismiss-summary"]').click();
  await page.waitForTimeout(1100);
  const m = motionOf(await samples(page));
  const after = await cols(page);
  report.layout.push({ who: "supervisor 1512, close → dismiss", during: during.cols, held: held.cols, after: after.cols });
  check(during.focus && held.focus && !after.focus && after.cols === "828px 420px", "close holds the room on its summary; Dismiss restores the columns (supervisor 1512)", `${during.cols} → ${held.cols} → ${after.cols}`);
  check(m.mono && m.between >= 3, `the restore is one motion too (${m.between} in-between frames)`, `${m.from} → ${m.to}`);
  /* RETARGETED (pack v11.0, Supersession 1): nothing yields, so nothing
     returns — the full hero, diagnosis last, through the close. */
  check(cells.state === "closed" && cells.hero && cells.yields === 0, "close: the full hero holds (it never yielded)", JSON.stringify(cells));
  await ctx.close();
}

// ── 3 · TRUNCATION ─────────────────────────────────────────────────────────
console.log("\n── 3 · truncation: every question in full, in every state");
const VERBATIM = (await readFile("src/lib/tiering/escalation.ts", "utf8")).match(/text: "([^"]+)"/g).map((x) => x.slice(7, -1));
const clamps = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-question-text]")].map((el) => {
      const s = getComputedStyle(el);
      return {
        id: el.dataset.questionText,
        text: el.textContent.replace(/[“”]/g, "").trim(),
        clamped: s.webkitLineClamp !== "none" || s.textOverflow === "ellipsis" || (s.overflow === "hidden" && el.scrollHeight > el.clientHeight + 1) || s.whiteSpace === "nowrap",
      };
    })
  );
report.clamps = {};
const truncAt = async (page, label) => {
  const c = await clamps(page);
  report.clamps[label] = c.filter((x) => x.clamped).length;
  const bad = c.filter((x) => x.clamped || !VERBATIM.includes(x.text));
  check(c.length >= 6 && bad.length === 0, `${label}: ${c.length} question texts, all verbatim, none clamped`, bad.map((x) => x.id).join() || "");
};
{
  const { ctx, page } = await open("/app/chat/t13");
  await fresh(page);
  await truncAt(page, "capture (fresh, Q1 focused)");
  await ans(page, "q1", "no");
  await ans(page, "q2", "no");
  await truncAt(page, "capture (skip, Q6 focused)");
  await ans(page, "q6", "yes");
  await truncAt(page, "capture (Q6 follow-up open)");
  await ans(page, "q6b", "no");
  await truncAt(page, "review");
  await ctx.close();
  const z = await open("/app/chat/t13", { persona: "supervisor" });
  await truncAt(z.page, "observer");
  await z.ctx.close();
  const src = await readFile("src/components/chat/escalation/guided-assessment.tsx", "utf8");
  check(!/line-clamp|truncate|text-ellipsis/.test(src), "the source has no clamp, truncate or ellipsis utility", "");
}

// ── 4–5 · WALKTHROUGHS, AND ONE FOCUSED QUESTION IN EVERY CAPTURE STATE ────
console.log("\n── 4–5 · walkthroughs");
{
  const { ctx, page, errors } = await open("/app/chat/t13");
  await fresh(page);
  let g = await note(page, "linear · start");
  check(g.focus === "q1" && g.focused === 1 && !g.review, "fresh: Q1 is the one focused question", stateStr(g.states));
  for (const [id, v] of [["q1", "yes"], ["q2", "yes"], ["q3", "no"], ["q4", "no"], ["q5", "no"], ["q6", "no"]]) {
    await ans(page, id, v);
    g = await note(page, `linear · ${id} ${v}`);
  }
  check(g.focus === "none" && g.focused === 0 && g.review && /Assessment suggests/.test(g.risk ?? ""), "linear: the last needed answer releases focus — review, with the risk chip", `${stateStr(g.states)} · ${g.risk}`);
  await page.locator("[data-guided-assessment]").screenshot({ path: `${OUT}/01-review-linear.png` });
  check(errors.length === 0, "no page errors", errors.slice(0, 2).join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/chat/t13");
  await fresh(page);
  await tap(page, "q6");
  let g = await note(page, "out-of-order · tap Q6");
  check(g.focus === "q6" && g.focused === 1, "out of order: tapping Q6 moves focus there", g.focus);
  await ans(page, "q6", "no");
  g = await note(page, "out-of-order · Q6 No");
  check(g.focus === "q1", "after Q6, focus goes to the first required unanswered (Q1)", g.focus);
  await tap(page, "q3");
  await ans(page, "q3", "no");
  g = await note(page, "out-of-order · Q3 No");
  await tap(page, "q1");
  await ans(page, "q1", "yes");
  g = await note(page, "out-of-order · Q1 Yes");
  check(stateStr(g.states) === "Y·N··N" && g.focus === "q2" && g.focused === 1 && g.prog === "3 of 6 needed answered", "Q6 → Q3 → Q1 recorded in that order; focus at Q2", `${stateStr(g.states)} · ${g.focus} · ${g.prog}`);
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/chat/t13");
  await fresh(page);
  await ans(page, "q1", "no");
  await ans(page, "q2", "no");
  let g = await note(page, "skip · No/No");
  check(stateStr(g.states) === "NNsss·" && g.focus === "q6" && g.prog === "2 of 3 needed answered" && g.notNeeded.length === 3 && g.notNeeded.every((x) => x === "Not needed"), "skip: Q3–5 “Not needed”, focus at Q6, progress “of 3”", `${stateStr(g.states)} · ${g.focus} · ${g.prog}`);
  check(g.skip === "Q3–5 not needed — no ideation indicated" && /Questions 3 to 5 not needed — no ideation indicated\./.test(g.live), "the quiet state line, and the skip announced", `${g.skip} · “${g.live}”`);
  await page.locator("[data-guided-assessment]").screenshot({ path: `${OUT}/02-skip.png` });
  /* Skipped questions stay readable, and say so in words. */
  const skippedRead = await page.evaluate(() => [...document.querySelectorAll('[data-ga-state="skipped"] [data-question-text]')].map((e) => e.textContent.length));
  check(skippedRead.length === 3 && skippedRead.every((n) => n > 30), "skipped questions keep their full text", skippedRead.join());
  // ── amend-unskip ──
  await tap(page, "q2");
  g = await note(page, "amend · tap Q2");
  await ans(page, "q2", "yes");
  g = await note(page, "amend · Q2 Yes");
  check(stateStr(g.states) === "NY····" && g.focus === "q3" && g.skip === null && /Questions 3 to 5 are needed again/.test(g.live), "amend: Q2 → Yes un-skips Q3–5 and focus goes to Q3", `${stateStr(g.states)} · ${g.focus} · “${g.live}”`);
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/chat/t13");
  await fresh(page);
  await tap(page, "q3");
  await ans(page, "q3", "yes");
  await note(page, "conflict · Q3 Yes first");
  await ans(page, "q1", "no");
  await ans(page, "q2", "no");
  const g = await note(page, "conflict · then No/No");
  check(g.states.q3 === "yes" && g.states.q4 === "skipped" && g.states.q5 === "skipped" && g.prog === "3 of 4 needed answered" && g.focus === "q6", "conflict: Q3’s recorded Yes is retained and counted; Q4–5 skip", `${stateStr(g.states)} · ${g.prog}`);
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/chat/t13");
  await fresh(page);
  for (const [id, v] of [["q1", "yes"], ["q2", "no"], ["q3", "no"], ["q4", "no"], ["q5", "no"], ["q6", "no"]]) await ans(page, id, v);
  let g = await note(page, "recompute · review");
  const r0 = g.risk;
  await tap(page, "q4");
  g = await note(page, "recompute · tap Q4 from review");
  check(g.focus === "q4" && g.focused === 1 && !g.review, "review → tapping Q4 re-enters capture on Q4", g.focus);
  await ans(page, "q4", "yes");
  g = await note(page, "recompute · Q4 Yes");
  check(g.review && g.focus === "none" && g.risk === "Assessment suggests: High risk" && r0 !== g.risk, "the amend returns to review and the chip recomputes", `${r0} → ${g.risk}`);
  await ctx.close();
}
const capture = states.filter((s) => !s.review);
const zero = states.filter((s) => s.focused === 0);
check(capture.every((s) => s.focused === 1), `focus proof: exactly one focused question in all ${capture.length} capture states`, capture.filter((s) => s.focused !== 1).map((s) => s.label).join());
check(zero.every((s) => s.review) && states.filter((s) => s.review).every((s) => s.focused === 0), `focus proof: review is the only zero-focus state (${zero.length} seen)`);
report.states = states;

// ── 6 · THE HERO HOLDS (RETARGETED, pack v11.0 Supersession 1) ────────────
/* v9 measured the hero YIELDING while an escalation was open — the mentor's
   hidden, the supervisor's a one-line diagnosis strip. v11 reverses it: the
   full hero persists in every state, both lenses, and the strip is deleted.
   The same probe asks the reversed question, and keeps the contrast reading
   on what replaced the strip — the hero's diagnosis section. */
console.log("\n── 6 · the hero holds (pack v11.0)");
const CONTRAST = () => {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const ok2 = (L, a, b) => { const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3; return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]; };
  const parse = (css) => { let m = css.match(/rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(/[,\s/]+/).map(parseFloat); return { c: v.slice(0, 3).map((x) => lin(x / 255)), a: v[3] ?? 1 }; } m = css.match(/oklab\(([^)]+)\)/); if (m) { const v = m[1].trim().split(/[\s/]+/).map(parseFloat); return { c: ok2(v[0], v[1], v[2]), a: v[3] ?? 1 }; } m = css.match(/color\(srgb\s+([^)]+)\)/); if (m) { const v = m[1].trim().split(/[\s/]+/).map(parseFloat); return { c: v.slice(0, 3).map(lin), a: v[3] ?? 1 }; } return null; };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const p = parse(getComputedStyle(e).backgroundColor); if (p && p.a > 0.5) return p.c; } return [1, 1, 1]; };
  const L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  window.__ratio = (el) => { const a = parse(getComputedStyle(el).color).c, b2 = bgOf(el); return Number(((Math.max(L(a), L(b2)) + 0.05) / (Math.min(L(a), L(b2)) + 0.05)).toFixed(2)); };
};
report.contrast = {};
for (const theme of ["light", "dark"]) {
  for (const persona of ["mentor", "supervisor"]) {
    const { ctx, page } = await open("/app/chat/t13", { persona, theme });
    await page.evaluate(CONTRAST);
    const y = await page.evaluate(() => {
      const hero = document.querySelector("[data-care-hero]");
      const brief = hero?.querySelector("[data-care-brief] [data-anchor-headline]");
      return {
        hero: !!hero && hero.getBoundingClientRect().height > 100,
        yields: document.querySelectorAll("[data-care-yield], [data-diagnosis-strip]").length,
        icd: !!document.querySelector("[data-icd]"),
        text: brief ? window.__ratio(brief) : null,
        chip: brief ? window.__ratio(brief.querySelector("[data-icd]")) : null,
        /* RETARGETED (2026-10-28): no header above the timeline — the tab
           opens on it. */
        working: !document.querySelector('[data-care-hero="escalation"]') && !!document.querySelector('[data-care-tabpanel="escalation"] [data-exchange]'),
      };
    });
    if (persona === "mentor") check(y.hero && y.yields === 0 && !y.icd && y.working, `${theme} · mentor: the full hero holds while open; no diagnosis anywhere; the tab opens on the timeline`, JSON.stringify(y));
    else {
      report.contrast[theme] = { text: y.text, chip: y.chip };
      /* RETARGETED (FCP-3 hero card): the diagnosis left the hero for View
         record, so its in-hero contrast rows are retired with it. */
      check(y.hero && y.yields === 0 && !y.icd && y.working, `${theme} · supervisor: the full hero holds; the diagnosis is View record's; the tab opens on the timeline`, JSON.stringify(y));
    }
    await ctx.close();
  }
}

// ── 7 · KEYBOARD AND SCREEN READER ─────────────────────────────────────────
console.log("\n── 7 · keyboard");
const transcript = [];
{
  const { ctx, page } = await open("/app/chat/t13");
  await fresh(page);
  const focusOf = () => page.evaluate(() => { const a = document.activeElement; const q = a?.closest("[data-ga-question]")?.dataset.gaQuestion; return `${a?.tagName.toLowerCase()} “${(a?.getAttribute("aria-label") || a?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48)}”${q ? ` in ${q}` : ""}`; });
  const press = async (sel, label) => {
    await page.locator(sel).focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const g = await ga(page);
    transcript.push(`- ${label} (Enter) → announced “${g.live}” · focus → ${await focusOf()}`);
    return g;
  };
  transcript.push("## Focus travel and the skip (mentor, fresh form)");
  let g = await press('[data-yes-no="q1:no"]', "Q1 No");
  check(/^Question 1: No · 1 of 6 needed answered\. Question 2 of 6\.$/.test(g.live), "recording announces “Question 1: No · 1 of 6 needed answered” and where focus went", g.live);
  check((await page.evaluate(() => document.activeElement?.dataset.assessmentWording)) === "q2", "keyboard focus travels to Q2’s first control");
  g = await press('[data-yes-no="q2:no"]', "Q2 No");
  check(/Questions 3 to 5 not needed — no ideation indicated\. Question 6 of 6\./.test(g.live) && (await page.evaluate(() => document.activeElement?.dataset.assessmentWording)) === "q6", "the skip is announced once; focus jumps to Q6", g.live);
  g = await press('[data-yes-no="q6:no"]', "Q6 No");
  check(/All needed questions answered\. Assessment suggests: Low risk\./.test(g.live) && (await page.evaluate(() => document.activeElement?.tagName)) === "TEXTAREA", "review entry announces the risk suggestion; focus lands on the note", g.live);
  transcript.push("\n## Review → Submit");
  await page.keyboard.type("Probe: no ideation, talking.");
  await page.keyboard.press("Tab");
  transcript.push(`- Tab from the note → ${await focusOf()}`);
  const onSubmit = await page.evaluate(() => document.activeElement?.dataset.exchangePrimary);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  const sub = (await store(page)).escalations.t13.safetyCheck.submittedAt;
  transcript.push(`- Enter on Submit → submitted ${sub ? "yes" : "no"}; current node → ${await page.evaluate(() => document.querySelector("[data-node-state='current']")?.dataset.node)}`);
  check(onSubmit === "submit-assessment" && !!sub, "Tab from the note reaches Submit; Enter submits", String(onSubmit));
  const sem = await page.evaluate(() => {
    const d = document.querySelector("[data-guided-assessment]");
    return { list: d?.querySelector("ol")?.getAttribute("aria-label"), items: d?.querySelectorAll("ol > li").length };
  });
  transcript.push(`\n## Structure\n\n- An ordered list “${sem.list}” of ${sem.items} question groups; the focused group is \`aria-current="step"\` and labelled “Question n of 6”; each compact row is a button whose name is “Question n: {full text} {answer}”.`);
  await ctx.close();
}
await writeFile(`${OUT}/KEYBOARD-TRANSCRIPT.md`, `# Keyboard / screen-reader transcript (probe-generated)\n\n${transcript.join("\n")}\n`);

// ── 8 · OBSERVER ───────────────────────────────────────────────────────────
console.log("\n── 8 · the observer");
{
  /* An answer that arrives while the page is open: stamped in the future so
     it reads as "after mount" (no cross-tab sync — see AGENTS v6.1). */
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor" });
  const o = await page.evaluate(() => {
    const d = document.querySelector("[data-node-state='current'] [data-guided-assessment]");
    return {
      mode: d?.dataset.gaMode, groups: d?.querySelectorAll("[data-ga-question]").length,
      controls: d?.querySelectorAll("button, textarea, [data-yes-no]").length, focused: d?.querySelectorAll("[data-ga-focused]").length,
      texts: [...(d?.querySelectorAll("[data-question-text]") ?? [])].length,
    };
  });
  check(o.mode === "observer" && o.groups === 6 && o.texts >= 6 && o.controls === 0 && o.focused === 0, "the supervisor reads the same form — six full questions, no controls, nothing to tap", JSON.stringify(o));
  await page.locator("[data-guided-assessment]").screenshot({ path: `${OUT}/03-observer.png` });
  await ctx.close();
  const future = Date.now() + 60_000;
  const s = { ...assessed.escalations.t13, safetyCheck: { answers: { q1: { value: "yes", at: future - 120_000 }, q2: { value: "no", at: future } }, submittedAt: null } };
  const z = await open("/app/chat/t13", { persona: "supervisor", extra: { escalations: { t13: s }, tierEvents: assessed.tierEvents } });
  const tick = await z.page.evaluate(() => [...document.querySelectorAll("[data-ga-question]")].filter((q) => q.classList.contains("tier-settle")).map((q) => q.dataset.gaQuestion));
  check(tick.join() === "q2", "an answer arriving while the page is open ticks once, in place", tick.join());
  await z.ctx.close();
}

// ── 9 · SQUINT ─────────────────────────────────────────────────────────────
console.log("\n── 9 · squint screenshots");
{
  const { ctx, page } = await open("/app/chat/t13");
  await fresh(page);
  await ans(page, "q1", "yes");
  await ans(page, "q2", "yes");
  await page.screenshot({ path: `${OUT}/04-squint-mentor-capture.png` });
  for (const [id, v] of [["q3", "no"], ["q4", "no"], ["q5", "no"], ["q6", "no"]]) await ans(page, id, v);
  await page.screenshot({ path: `${OUT}/05-squint-mentor-review.png` });
  await ctx.close();
  const z = await open("/app/chat/t13", { persona: "supervisor" });
  await z.page.screenshot({ path: `${OUT}/06-squint-supervisor-capture.png` });
  await z.ctx.close();
  const s = { ...assessed.escalations.t13, safetyCheck: { answers: { q1: { value: "yes", at: 1 }, q2: { value: "no", at: 2 }, q3: { value: "no", at: 3 }, q4: { value: "no", at: 4 }, q5: { value: "no", at: 5 }, q6: { value: "no", at: 6 } }, submittedAt: null } };
  const r = await open("/app/chat/t13", { persona: "supervisor", extra: { escalations: { t13: s }, tierEvents: assessed.tierEvents } });
  await r.page.screenshot({ path: `${OUT}/07-squint-supervisor-complete.png` });
  await r.ctx.close();
  check(true, "squint screenshots written", OUT);
}

await writeFile(`${OUT}/measures.json`, JSON.stringify(report, null, 2));
await b.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
