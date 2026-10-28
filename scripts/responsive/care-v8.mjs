// ═══════════════════════════════════════════════════════════════════════════
// ASSESSMENT DECK & CARE TAB RESTRUCTURE (pack v8.0) — the report's measures
//
//   1  retired: the accordion, the Overview tab and its Recent preview, the
//      identity strip — absent from the DOM
//   RETIRED by pack v9.0: §2–4 and §6–8 (the deck) — see care-v9.mjs
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
import { mkdir } from "node:fs/promises";
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
// ── 1 · RETIRED ─────────────────────────────────────────────────────────────
console.log("\n── 1 · retired patterns");
{
  const { ctx, page } = await open("/app/chat/t13");
  const r = await page.evaluate(() => ({
    accordion: !!document.querySelector("[data-assessment-accordion], [data-acc-row]"),
    overview: !!document.querySelector('[data-care-tab="overview"], [data-care-recent], [data-care-view-history]'),
    /* RETARGETED (pack v11.0, Supersession 2): identity is back, INSIDE the
       hero card; v7's strip — identity above the cells — stays gone. */
    strip: !!document.querySelector("[data-identity-profile]") || (!!document.querySelector("[data-care-identity]") && !document.querySelector("[data-care-hero] [data-care-identity]")),
    /* RETARGETED (pack v9.0, Supersession 3): the header is the first
       thing in the panel, inside its yield — collapsed while the escalation
       is open (care-v9.mjs measures the yield). */
    /* RETARGETED (pack v11.0): no yield wrapper — the hero leads. */
    firstIsHeader: !!document.querySelector("[data-care-panel]")?.querySelector(":scope > :not([data-care-tabs-live])")?.querySelector("[data-care-header]"),
  }));
  check(!r.accordion && !r.overview && !r.strip, "the accordion, Overview (and its Recent preview) and the identity strip are gone", JSON.stringify(r));
  check(r.firstIsHeader, "nothing renders above the anchor cells");
  /* First, before any deck interaction depends on it: an open escalation
     auto-selects its tab (a mutation run crashed rather than failed here). */
  const sel = await page.evaluate(() => document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab);
  check(sel === "escalation", "an open escalation auto-selects the Escalation review tab", String(sel));
  await ctx.close();
}

// ── 2–4, 6–8 · RETIRED (pack v9.0, Supersessions 1–2) ─────────────────────
/* The deck, its coverage rail and the review ledger are deleted for the
   guided form. Their claims — the walkthroughs, one active card in every
   state, the observer, contrast, the keyboard run, reduced motion — are the
   form's now, measured in `care-v9.mjs`. */

// ── 5 · THE TAB LIFECYCLE, PER LENS ────────────────────────────────────────
console.log("\n── 5 · the tab lifecycle");
const tabs = (page) =>
  page.evaluate(() => ({
    list: [...document.querySelectorAll("[data-care-tab]")].map((t) => t.dataset.careTab),
    sel: document.querySelector('[data-care-tab][aria-selected="true"]')?.dataset.careTab,
    dot: document.querySelector('[data-care-tab="escalation"] [data-review-dot]')?.dataset.reviewDot ?? null,
    state: document.querySelector("[data-care-panel]")?.dataset.careState,
    said: document.querySelector("[data-care-tabs-live]")?.textContent ?? "",
    header: !!document.querySelector("[data-care-panel] > div [data-care-header]"),
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
  for (let i = 0; i < 8; i++) { const no = page.locator('[data-ga-focused] [data-yes-no$=":no"]').first(); if (!(await no.count())) break; await no.click(); await page.waitForTimeout(250); }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Probe: no plan, talking it through.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(400);
  t = await tabs(page);
  check(t.dot === null, "submitted: the supervisor's move — the mentor's dot clears", JSON.stringify(t));
  await setPersona(page, "supervisor");
  t = await tabs(page);
  check(t.sel === "escalation" && t.dot === "alert", "supervisor, assessment in: auto-selected, the dot is the supervisor's now", JSON.stringify(t));
  await page.locator('[data-tier-row="3"]').click();
  await page.locator('[data-tier-cta=confirm]').click();
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

await b.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
