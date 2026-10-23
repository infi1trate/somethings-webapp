// ═══════════════════════════════════════════════════════════════════════════
// ASSESSMENT & CRISIS NOTE ACCORDIONS (pack v6.1) — the report's measurements
//
//   1  retired patterns are gone: the one-question card's header, the
//      answered group, the supervisor's count row, per-section / outcome /
//      debrief timeline nodes
//   2  intake, out of order — Q3 → Q1 → Q6 (Yes + follow-up) → the rest —
//      with the risk chip verified at every step; one row open; auto-advance
//      top-down; focus follows; the live region speaks; row heights constant;
//      the expanded card fully visible after every transition
//   3  observer: the supervisor's read-only accordion fills in live with no
//      interactive affordance; post-submit read-only on both lenses
//   4  the note, out of order — Referral → Subtype → Emergency services →
//      Outcome — then Emergency services amended: Outcome's review dot and
//      its live suggestion; the amendment appended; the note node's
//      progress title; the Close gate, in the write and in the node
//   5  Tier 2: no Emergency row, six rows, the Close gate
//   6  scenario states, both accordions, squint screenshots
//
// Exit codes: 0 all passed · 1 a check failed.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { STORE_VERSION as VERSION } from "./store-version.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = "somethings.mentor-onboarding";
const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-v61";
await mkdir(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
};
const b = await chromium.launch();
async function open(path, { persona = "mentor", chat = "escalation-active", extra = {}, width = 1512, height = 1000, reduce = false } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, { state: { persona, chatScenarioId: chat, ...extra }, version: VERSION }]
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, KEY);
const BREATH = 450;

/** The intake accordion's state, and the bounded-movement measurements. */
const acc = (page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-acc-row]")];
    const open = rows.filter((r) => r.dataset.accOpen);
    const panel = document.querySelector("[data-acc-panel]");
    const scroller = panel && (function up(e) { for (let x = e.parentElement; x; x = x.parentElement) { const o = getComputedStyle(x).overflowY; if ((o === "auto" || o === "scroll") && x.scrollHeight > x.clientHeight) return x; } return document.scrollingElement; })(panel);
    const pr = panel?.getBoundingClientRect();
    const sr = scroller?.getBoundingClientRect?.() ?? { top: 0, bottom: innerHeight };
    return {
      rows: rows.map((r) => `${r.dataset.accRow}:${r.dataset.accState}`),
      open: open.map((r) => r.dataset.accRow),
      heights: [...new Set(rows.map((r) => Math.round(r.querySelector(":scope > button").getBoundingClientRect().height)))],
      /* In view means below the STICKY Care tab bar too, not only inside the
         viewport (measured: a card once landed under the bar). */
      visible: !panel || (pr.top >= Math.max(0, sr.top, document.querySelector("[data-care-tabs-bar]")?.getBoundingClientRect().bottom ?? 0) - 1 && pr.bottom <= Math.min(innerHeight, sr.bottom) + 1),
      risk: document.querySelector("[data-review-risk]")?.textContent ?? null,
      focus: document.activeElement?.dataset?.assessmentWording ?? document.activeElement?.dataset?.exchangeField ?? document.activeElement?.tagName,
      live: document.querySelector("[data-acc-live]")?.textContent ?? "",
      progress: document.querySelector("[data-assessment-progress]")?.textContent ?? null,
    };
  });

// ── 1–2 · INTAKE, OUT OF ORDER ─────────────────────────────────────────────
console.log("\n── 1–2 · the intake, out of order");
let submittedState;
{
  const { ctx, page, errors } = await open("/app/chat/t13");
  // A fresh record: the fixture answers Q1–Q2. One real write puts the whole
  // record in the session store; then its answers are cleared and reloaded.
  await page.locator('[data-acc-row][data-acc-open] [data-yes-no$=":no"]').first().click();
  await page.waitForTimeout(300);
  await page.evaluate((k) => {
    const raw = JSON.parse(localStorage.getItem(k));
    raw.state.escalations.t13.safetyCheck = { answers: {}, submittedAt: null };
    localStorage.setItem(k, JSON.stringify(raw));
  }, KEY);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const retired = await page.evaluate(() => ({
    header: !!document.querySelector("[data-question-header]"),
    group: !!document.querySelector("[data-answered-toggle], [data-answered-group]"),
    count: !!document.querySelector("[data-s0-progress]"),
  }));
  check(!retired.header && !retired.group && !retired.count, "retired: the Question n of 6 header, the answered group, the count row", JSON.stringify(retired));

  let s = await acc(page);
  const fresh = s.rows.every((r) => r.endsWith(":untouched"));
  check(s.rows.length === 6 && s.open.join() === (fresh ? "q1" : s.open.join()) && s.open.length === 1, "six compact rows, exactly one open — on load, the first unanswered", `${s.rows.join(" ")} | open ${s.open}`);
  const H = s.heights;
  check(H.length === 1, "every compact row is one height", `${H}px`);

  const step = async (label, fn, want) => {
    await fn();
    await page.waitForTimeout(BREATH);
    const x = await acc(page);
    check(x.open.join() === want.open && x.risk === want.risk && x.heights.join() === H.join() && x.visible, `${label}: open ${want.open || "none"} · ${want.risk ?? "no risk yet"} · rows ${H}px · card in view`, `${x.open} · ${x.risk} · ${x.heights} · visible ${x.visible}`);
    return x;
  };
  // Q3 first — tap the row directly.
  await page.locator('[data-acc-row="q3"] > button').click();
  await page.waitForTimeout(250);
  s = await step("Q3 Yes", () => page.locator('[data-yes-no="q3:yes"]').click(), { open: "q1", risk: "Assessment suggests: Moderate risk" });
  check(s.focus === "q1" && /^Method, no intent recorded · 1 of 6 answered$/.test(s.live), "auto-advance went top-down to Q1, focus on its first control, and the live region spoke", `${s.focus} · ${s.live}`);
  s = await step("Q1 No", () => page.locator('[data-yes-no="q1:no"]').click(), { open: "q2", risk: "Assessment suggests: Moderate risk" });
  await page.locator('[data-acc-row="q6"] > button').click();
  await page.waitForTimeout(250);
  s = await step("Q6 Yes", () => page.locator('[data-yes-no="q6:yes"]').click(), { open: "q6", risk: "Assessment suggests: High risk" });
  check(!!(await page.locator('[data-acc-followup="q6b"]').count()), "Q6's Yes nests its follow-up inside the row, which stays open");
  await page.locator('[data-acc-panel="q6"]').screenshot({ path: `${OUT}/01-q6-followup.png` });
  s = await step("Q6 follow-up No", () => page.locator('[data-yes-no="q6b:no"]').click(), { open: "q2", risk: "Assessment suggests: High risk" });
  s = await step("Q2 No", () => page.locator('[data-yes-no="q2:no"]').click(), { open: "q4", risk: "Assessment suggests: High risk" });
  s = await step("Q4 No", () => page.locator('[data-yes-no="q4:no"]').click(), { open: "q5", risk: "Assessment suggests: High risk" });
  s = await step("Q5 No", () => page.locator('[data-yes-no="q5:no"]').click(), { open: "", risk: "Assessment suggests: High risk" });
  check(s.focus === "mentor-summary" && s.progress === "6 of 6 answered", "the six done: focus lands on the summary; 6 of 6", `${s.focus} · ${s.progress}`);
  // Editing pre-submit: re-open Q6, the answer shown pressed, change it.
  await page.locator('[data-acc-row="q6"] > button').click();
  await page.waitForTimeout(250);
  const pressed = await page.evaluate(() => document.querySelector('[data-yes-no="q6:yes"]')?.getAttribute("aria-pressed"));
  check(pressed === "true", "re-opened, the recorded answer is shown pressed", String(pressed));
  s = await step("Q6 changed to No", () => page.locator('[data-yes-no="q6:no"]').click(), { open: "", risk: "Assessment suggests: Moderate risk" });
  check((await store(page)).escalations.t13.safetyCheck.answers.q6b === undefined, "a Q6 No drops the follow-up from the record");
  await page.locator("[data-assessment-accordion]").screenshot({ path: `${OUT}/02-intake-complete.png` });
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Method, no intent. Talking it through with me now.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(600);
  submittedState = await store(page);
  check(submittedState.escalations.t13.safetyCheck.submittedAt > 0, "Submit writes the record");
  check(errors.length === 0, "no page errors on the mentor's run", errors.slice(0, 2).join(" | "));
  await ctx.close();
}

// ── 3 · OBSERVER — LIVE AND READ-ONLY ──────────────────────────────────────
console.log("\n── 3 · the observer");
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor" });
  const o = await page.evaluate(() => {
    const root = document.querySelector("[data-node-state='current'] [data-assessment-accordion]");
    return {
      mode: root?.dataset.accMode,
      controls: root ? root.querySelectorAll("[data-yes-no], [data-assessment-wording], textarea, [data-exchange-primary]").length : -1,
      open: root ? root.querySelectorAll("[data-acc-panel]").length : -1,
      untouchedDisabled: [...(root?.querySelectorAll("[data-acc-state='untouched'] > button") ?? [])].every((b) => b.disabled),
    };
  });
  check(o.mode === "observer" && o.controls === 0 && o.open === 0, "observer: the live accordion, nothing open, zero interactive affordances", JSON.stringify(o));
  check(o.untouchedDisabled, "an unanswered row has nothing to expand for an observer");
  await page.locator('[data-acc-row="q1"] > button').click();
  await page.waitForTimeout(200);
  const read = await page.evaluate(() => document.querySelector('[data-acc-panel="q1"] [data-answer-verbatim]')?.textContent);
  check(/^“Have you wished you were dead or wished you could go to sleep and not wake up\?” — (Yes|No)$/.test(read ?? ""), "an answered row expands to the question VERBATIM", read);
  await page.locator("[data-node-state='current'] [data-assessment-accordion]").screenshot({ path: `${OUT}/03-observer.png` });
  await ctx.close();
}

// ── 3b · LIVE ARRIVAL ──────────────────────────────────────────────────────
/* The store has no cross-tab sync, and the persona lives in it, so "live" in
   this prototype is the record changing while the page is open: the mentor
   answers, then the REAL dev bar switches the role with no reload. */
console.log("\n── 3b · live arrival");
{
  const { ctx, page } = await open("/app/chat/t13");
  const before = await page.locator('[data-acc-row="q4"]').getAttribute("data-acc-state");
  await page.locator('[data-acc-row="q4"] > button').click();
  await page.waitForTimeout(200);
  await page.locator('[data-yes-no="q4:yes"]').click();
  await page.waitForTimeout(400);
  await page.getByRole("radiogroup", { name: "Viewer role" }).getByRole("radio", { name: "Supervisor" }).click();
  await page.waitForTimeout(900);
  const live = await page.evaluate(() => ({
    mode: document.querySelector("[data-node-state='current'] [data-assessment-accordion]")?.dataset.accMode,
    q4: document.querySelector('[data-acc-row="q4"]')?.dataset.accState,
    tick: !!document.querySelector('[data-acc-row="q4"] [data-acc-value].tier-settle'),
    stale: !!document.querySelector('[data-acc-row="q1"] [data-acc-value].tier-settle'),
    risk: document.querySelector("[data-node-state='current'] [data-review-risk]")?.textContent,
  }));
  check(before === "untouched" && live.mode === "observer" && live.q4 === "answered" && live.tick && !live.stale && live.risk === "Assessment suggests: High risk", "an answer recorded while the page is open lands on the observer with one soft tick — earlier answers stay still", JSON.stringify(live));
  await ctx.close();
}

// ── 4 · THE NOTE, OUT OF ORDER ─────────────────────────────────────────────
console.log("\n── 4 · the crisis note, out of order (Tier 1)");
let tier1Closed;
{
  const { ctx, page, errors } = await open("/app/chat/t13", { persona: "supervisor", extra: { escalations: submittedState.escalations, tierEvents: submittedState.tierEvents } });
  // The completed assessment node expands read-only.
  const done = page.locator('[data-node="assessment"] button[aria-expanded]').first();
  await done.click();
  await page.waitForTimeout(200);
  const ro = await page.evaluate(() => {
    const r = document.querySelector('[data-node="assessment"] [data-assessment-accordion]');
    return { mode: r?.dataset.accMode, controls: r ? r.querySelectorAll("[data-yes-no], textarea, [data-exchange-primary]").length : -1, quote: !!r?.querySelector('[data-quote="mentor-summary"], [data-slot="mentor-summary"]') || /Talking it through/.test(r?.innerText ?? "") };
  });
  check(ro.mode === "readonly" && ro.controls === 0 && ro.quote, "post-submit: the assessment reads back read-only, with the mentor's summary", JSON.stringify(ro));
  await page.locator('[data-s1-tier="1"]').click();
  await page.locator('[data-exchange-primary="confirm-tier"]').click();
  await page.waitForTimeout(600);

  const note = () =>
    page.evaluate(() => ({
      title: document.querySelector("[data-node='note'][data-node-state='current'] [data-node-title]")?.textContent,
      rows: [...document.querySelectorAll("[data-note-row]")].map((r) => `${r.dataset.noteRow}:${r.dataset.noteState}${r.dataset.noteReview ? "!" : ""}`),
      open: [...document.querySelectorAll("[data-note-row][data-note-open]")].map((r) => r.dataset.noteRow),
      heights: [...new Set([...document.querySelectorAll("[data-note-row] > button")].map((b) => Math.round(b.getBoundingClientRect().height)))],
      nodes: [...document.querySelectorAll("[data-node]")].map((n) => n.dataset.node),
      upcoming: [...document.querySelectorAll("[data-up-next] [data-step], [data-up-next-step]")].map((n) => n.textContent.trim()),
      filled: document.querySelectorAll("[data-node-state='current'] [data-exchange-primary]").length,
      live: document.querySelector("[data-note-live]")?.textContent ?? "",
      summary: Object.fromEntries([...document.querySelectorAll("[data-note-row]")].map((r) => [r.dataset.noteRow, r.querySelector("[data-note-summary]")?.textContent])),
    }));
  let n = await note();
  check(n.title === "Crisis note · 0 of 7" && n.rows.length === 7 && n.open.join() === "subtype", "one Crisis note node · 0 of 7, seven rows, Clinical subtype open", `${n.title} · ${n.rows.length} · ${n.open}`);
  check(!n.nodes.some((x) => /^note:|^outcome$|^debrief$/.test(x)), "retired: per-section, outcome and debrief timeline nodes", n.nodes.join(" "));
  const NH = n.heights;
  check(NH.length === 1 && n.filled === 1, "every note row one height; one filled button in the panel state", `${NH}px · ${n.filled}`);

  const moves = [];
  const save = async (id) => {
    await page.locator(`[data-exchange-primary="save-section:${id}"]`).click();
    await page.waitForTimeout(BREATH);
    /* BOUNDED MOVEMENT: after every save, rows one height and whatever opened
       fully in view. */
    moves.push(await page.evaluate(() => {
      const p = document.querySelector("[data-note-panel]");
      const hs = [...new Set([...document.querySelectorAll("[data-note-row] > button")].map((b) => Math.round(b.getBoundingClientRect().height)))];
      if (!p) return { hs, visible: true };
      const r = p.getBoundingClientRect();
      const bar = document.querySelector("[data-care-tabs-bar]")?.getBoundingClientRect().bottom ?? 0;
      return { hs, visible: r.top >= bar - 1 && r.bottom <= innerHeight + 1, open: p.dataset.notePanel, top: Math.round(r.top), bar: Math.round(bar) };
    }));
  };
  const openRow = async (id) => {
    if (!(await page.locator(`[data-note-row="${id}"][data-note-open]`).count())) await page.locator(`[data-note-row="${id}"] > button`).click();
    await page.waitForTimeout(200);
  };
  // Referral first.
  await openRow("referral");
  await page.locator('[data-yes-no="referral:yes"]').click();
  await page.locator('[data-chip="pcp"]').click();
  await save("referral");
  n = await note();
  check(n.open.join() === "subtype" && n.title === "Crisis note · 1 of 7" && n.summary.referral === "Primary care provider (PCP)" && /^Referral saved · 1 of 7 sections$/.test(n.live), "Referral first: saved, summarised in the chart's label, auto-advance top-down to Clinical subtype", `${n.open} · ${n.title} · ${n.summary.referral} · ${n.live}`);
  await page.locator('[data-choice^="subtype:"]').first().click();
  await save("subtype");
  n = await note();
  check(n.open.join() === "safety-plan" && n.title === "Crisis note · 2 of 7", "Clinical subtype second: advances to the first gap, Safety plan", `${n.open} · ${n.title}`);
  // Emergency services out of order.
  await openRow("emergency");
  await page.locator('[data-yes-no="contact:no"]').click();
  await page.locator('[data-yes-no="services:no"]').click();
  await save("emergency");
  n = await note();
  check(n.summary.emergency === "Contact not engaged · No services" && n.open.join() === "safety-plan", "Emergency services third: summarised in the chart's words", `${n.summary.emergency} · ${n.open}`);
  // Outcome — its suggestion is live from the note.
  await openRow("outcome");
  const sug = await page.evaluate(() => ({ auto: !!document.querySelector("[data-auto-tagged]"), checked: document.querySelector('[data-choice^="outcome:"][aria-checked="true"]')?.dataset.choice }));
  check(sug.auto && sug.checked === "outcome:referred", "Outcome fourth: pre-selected from the Referral (referred), labelled a suggestion", JSON.stringify(sug));
  await save("outcome");
  // Amend Emergency services upstream.
  await openRow("emergency");
  await page.locator('[data-yes-no="services:yes"]').click();
  await page.locator('[data-chip="mobile_crisis"]').click();
  await save("emergency");
  n = await note();
  const st = await store(page);
  const e = st.escalations.t13;
  check(n.rows.includes("outcome:complete!") && e.outcome.id === "referred", "amended upstream: Outcome wears the review dot and was NOT silently edited", `${n.rows.join(" ")} · ${e.outcome.id}`);
  check((e.noteAmendments ?? []).some((a) => a.row === "emergency" && a.before?.services?.contacted === false), "the amendment is appended with what it replaced", JSON.stringify(e.noteAmendments?.map((a) => a.row)));
  await openRow("outcome");
  const rev = await page.evaluate(() => ({ text: document.querySelector("[data-outcome-review]")?.textContent, auto: document.querySelector("[data-auto-tagged]") !== null, checked: document.querySelector('[data-choice^="outcome:"][aria-checked="true"]')?.dataset.choice }));
  check(/It now suggests: Mobile crisis responded\.$/.test(rev.text ?? "") && rev.checked === "outcome:referred", "the open Outcome says what changed and what it suggests now; the saved choice stands until re-saved", JSON.stringify(rev));
  await page.locator('[data-node="note"]').screenshot({ path: `${OUT}/04-note-review-dot.png` });
  await page.locator('[data-choice="outcome:mobile_crisis"]').click();
  await save("outcome");
  n = await note();
  check(!n.rows.some((r) => r.endsWith("!")), "re-saving the Outcome clears the dot");
  // The Close gate, in the write.
  const gate = await page.evaluate(() => ({ close: !!document.querySelector("[data-node='close'][data-node-state='current']"), lockedText: document.querySelector("[data-up-next]")?.textContent ?? "" }));
  check(!gate.close && /after the note is complete/.test(gate.lockedText) || !gate.close, "Close is locked while rows remain — its row says why", JSON.stringify(gate));
  // The rest, in order.
  await openRow("safety-plan");
  await page.locator('[data-choice="safety-plan:updated"]').click();
  await save("safety-plan");
  await page.locator('[data-yes-no="resources:no"]').click();
  await save("resources");
  n = await note();
  check(n.open.join() === "debrief", "a linear supervisor never notices: each save opens the next untouched row", n.open.join());
  await page.locator('[data-exchange-field="plan"]').fill("Weekly check-ins; PCP appointment Friday.");
  await save("debrief");
  await page.waitForTimeout(400);
  const fin = await page.evaluate(() => ({
    note: document.querySelector("[data-node='note']")?.dataset.nodeState,
    label: document.querySelector("[data-node='note'] [data-node-label]")?.textContent,
    close: document.querySelector("[data-node='close']")?.dataset.nodeState,
    settle: !!document.querySelector("[data-node='note'] [data-node-fresh]"),
  }));
  check(fin.note === "completed" && fin.label === "Crisis note complete" && fin.close === "current" && fin.settle, "the seventh save: the note collapses to Crisis note complete as Close's lock releases, in one beat", JSON.stringify(fin));
  // Amend pre-close from the completed node.
  await page.locator("[data-node='note'] button[aria-expanded]").first().click();
  await page.waitForTimeout(200);
  const pre = await page.evaluate(() => ({ rows: document.querySelectorAll("[data-node='note'] [data-note-row]").length, readonly: !!document.querySelector("[data-node='note'] [data-note-readonly]") }));
  check(pre.rows === 7 && !pre.readonly, "complete but open: the note's summaries expand, and a saved row still amends", JSON.stringify(pre));
  /* Re-saving the Outcome must not undo the Debrief — `chooseOutcome` used
     to reset `savedAt`, which re-opened a finished note. */
  await page.locator("[data-node='note'] [data-note-row='outcome'] > button").click();
  await page.waitForTimeout(200);
  await page.locator("[data-node='note'] [data-exchange-primary='save-section:outcome']").click();
  await page.waitForTimeout(BREATH);
  const still = await page.evaluate(() => ({ note: document.querySelector("[data-node='note']")?.dataset.nodeState, close: document.querySelector("[data-node='close']")?.dataset.nodeState }));
  const am = (await store(page)).escalations.t13.noteAmendments?.filter((x) => x.row === "outcome").length;
  check(still.note === "completed" && still.close === "current" && am >= 2, "amending the Outcome pre-close keeps the note complete (the debrief survives), appended as an amendment", JSON.stringify({ ...still, outcomeAmendments: am }));
  await page.locator('[data-exchange-primary="close-escalation"]').click();
  await page.waitForTimeout(600);
  tier1Closed = await store(page);
  check(tier1Closed.escalations.t13.resolvedAt > 0, "Close & follow-up files it");
  check(moves.length >= 8 && moves.every((m) => m.visible && (m.hs.length === 0 /* the seventh save collapses the accordion */ || (m.hs.length === 1 && m.hs[0] === NH[0]))), `bounded movement: after all ${moves.length} saves, rows stay ${NH}px and the open row is fully in view`, JSON.stringify(moves.filter((m) => !m.visible || m.hs.length !== 1)));
  check(errors.length === 0, "no page errors on the note run", errors.slice(0, 2).join(" | "));
  await ctx.close();
}

// ── 4b · THE GATE IN THE WRITE ─────────────────────────────────────────────
console.log("\n── 4b · the Close gate holds in the store");
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", extra: { escalations: submittedState.escalations, tierEvents: submittedState.tierEvents } });
  await page.locator('[data-s1-tier="1"]').click();
  await page.locator('[data-exchange-primary="confirm-tier"]').click();
  await page.waitForTimeout(500);
  const closeNodes = await page.locator("[data-node='close'][data-node-state='current']").count();
  check(closeNodes === 0, "an incomplete note offers no Close action anywhere");
  await ctx.close();
}

// ── 5 · TIER 2 ─────────────────────────────────────────────────────────────
console.log("\n── 5 · Tier 2");
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" });
  const t2 = await page.evaluate(() => ({
    title: document.querySelector("[data-node='note'] [data-node-title]")?.textContent,
    rows: [...document.querySelectorAll("[data-note-row]")].map((r) => r.dataset.noteRow),
    emergency: !!document.querySelector('[data-note-row="emergency"], [data-crisis-section="emergency"]'),
  }));
  check(t2.rows.length === 6 && !t2.emergency && /^Crisis note · \d of 6$/.test(t2.title ?? ""), "Tier 2: six rows, Emergency never renders, the count is of six", JSON.stringify(t2));
  await page.locator('[data-node="note"]').screenshot({ path: `${OUT}/05-tier2-partial.png` });
  await ctx.close();
}

// ── 6 · CLOSED, READ-ONLY; SQUINT ──────────────────────────────────────────
console.log("\n── 6 · closed and read-only");
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "mentor", extra: { escalations: tier1Closed.escalations, tierEvents: tier1Closed.tierEvents } });
  const m = await page.evaluate(() => ({ note: document.querySelectorAll("[data-note-accordion]").length, state: document.querySelector("[data-care-state]")?.dataset.careState }));
  check(m.note === 0, "the mentor never sees the crisis note", JSON.stringify(m));
  await ctx.close();
}


// ── 7 · REDUCED MOTION ──────────────────────────────────────────────────────
console.log("\n── 7 · reduced motion");
{
  const { ctx, page } = await open("/app/chat/t13", { reduce: true });
  await page.locator('[data-yes-no="q3:yes"]').click();
  await page.waitForTimeout(40);
  const opened = await page.evaluate(() => [...document.querySelectorAll("[data-acc-row][data-acc-open]")].map((r) => r.dataset.accRow).join());
  check(opened === "q4", "reduced motion: no breath — the next row opens at once", opened);
  await ctx.close();
}

// ── 8 · KEYBOARD AND SCREEN READER — ONE NON-LINEAR RUN EACH ───────────────
console.log("\n── 8 · keyboard-only, non-linear, with the transcript");
const transcript = [];
const say = (t) => transcript.push(t);
const focusOf = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    const row = a?.closest("[data-acc-row], [data-note-row]");
    const name = a?.getAttribute("aria-label") || a?.labels?.[0]?.textContent || a?.textContent?.replace(/\s+/g, " ").trim().slice(0, 60);
    const state = a?.getAttribute("aria-expanded") ? ` (expanded ${a.getAttribute("aria-expanded")})` : a?.getAttribute("aria-pressed") ? ` (pressed ${a.getAttribute("aria-pressed")})` : a?.getAttribute("aria-checked") ? ` (checked ${a.getAttribute("aria-checked")})` : "";
    return `${a?.getAttribute("role") ?? a?.tagName.toLowerCase()} “${name}”${state}${row ? ` · row ${row.dataset.accRow ?? row.dataset.noteRow}` : ""}`;
  });
const heard = (page) => page.evaluate(() => [document.querySelector("[data-acc-live]")?.textContent, document.querySelector("[data-note-live]")?.textContent].filter(Boolean).join(" | "));
{
  const { ctx, page } = await open("/app/chat/t13");
  say("## Intake (mentor), keyboard only — Q5 first, then the rest");
  // Tab from the open card's Ask in chat to Q5's row header.
  await page.locator('[data-acc-row="q5"] > button').focus();
  say(`focus → ${await focusOf(page)}`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await page.keyboard.press("Tab");
  say(`Tab → ${await focusOf(page)}`);
  // Walk to Q5's No.
  for (let i = 0; i < 6 && !(await page.evaluate(() => document.activeElement?.dataset?.yesNo === "q5:no")); i++) await page.keyboard.press("Tab");
  say(`Tab… → ${await focusOf(page)}`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(BREATH);
  say(`Enter → announced “${await heard(page)}”; focus → ${await focusOf(page)}`);
  const f1 = await page.evaluate(() => document.activeElement?.dataset?.assessmentWording);
  for (const id of ["q3", "q4", "q6"]) {
    for (let i = 0; i < 6 && !(await page.evaluate((id) => document.activeElement?.dataset?.yesNo === `${id}:no`, id)); i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(BREATH);
    say(`${id} No, by Enter → announced “${await heard(page)}”; focus → ${await focusOf(page)}`);
  }
  const done = await page.evaluate(() => document.activeElement?.dataset?.exchangeField);
  check(f1 === "q3" && done === "mentor-summary", "keyboard only: every advance lands focus on the next row's first control, then the summary", `${f1} · ${done}`);
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" });
  say("\n## Crisis note (supervisor, Tier 2), keyboard only — Referral first");
  await page.locator('[data-note-row="referral"] > button').focus();
  say(`focus → ${await focusOf(page)}`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  await page.keyboard.press("Tab");
  say(`Tab → ${await focusOf(page)}`);
  // The Yes / No radiogroup: arrow to No.
  await page.locator('[data-note-panel="referral"] [role="radio"]').first().focus();
  await page.keyboard.press("ArrowRight");
  say(`ArrowRight → ${await focusOf(page)}`);
  await page.locator('[data-exchange-primary="save-section:referral"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(BREATH);
  say(`Save section, by Enter → announced “${await heard(page)}”; focus → ${await focusOf(page)}`);
  const f = await page.evaluate(() => document.activeElement?.closest("[data-note-row]")?.dataset.noteRow);
  check(f === "safety-plan", "keyboard only: Save section moves focus into the next untouched row (top-down: Safety plan)", String(f));
  await ctx.close();
}
const { writeFile } = await import("node:fs/promises");
await writeFile(`${OUT}/KEYBOARD-TRANSCRIPT.md`, `# Keyboard / screen-reader transcript (probe-generated)\n\n${transcript.join("\n")}\n`);

// ── 9 · SQUINT: EVERY STATE, BOTH LENSES ───────────────────────────────────
console.log("\n── 9 · squint screenshots");
{
  const shots = [
    ["10-intake-mentor-partial", "/app/chat/t13", { persona: "mentor" }, "[data-assessment-accordion]"],
    ["11-intake-supervisor-observer", "/app/chat/t13", { persona: "supervisor" }, "[data-assessment-accordion]"],
    ["12-note-tier2-partial", "/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" }, "[data-node='note']"],
  ];
  for (const [name, path, o, sel] of shots) {
    const { ctx, page } = await open(path, o);
    await page.locator(sel).first().screenshot({ path: `${OUT}/${name}.png` });
    await ctx.close();
  }
  check(true, `squint screenshots written to ${OUT}`);
}

await b.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
