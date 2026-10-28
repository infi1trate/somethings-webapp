// ═══════════════════════════════════════════════════════════════════════════
// ASSESSMENT & CRISIS NOTE ACCORDIONS (pack v6.1) — what outlives them
//
// ═══ RETIRED BY PACK v8.0 AND v11.0 ═══ v8 retired the intake accordion
// (the assessment is `care-v9.mjs`'s). v11.0 (Supersession 5) DELETES the
// crisis-note accordion for the deck — one section card at a time, an
// explicit Record section, an atomic Submit with a session draft — and
// `chat-escalation-v11.mjs` §8 measures the deck in full. The accordion's
// out-of-order run, its review dot, its amendments, its keyboard transcript
// and its squint states measured a component that no longer exists, so they
// are removed here rather than retargeted into duplicates.
//
// What still holds, retargeted to the deck:
//   1  an assessment submits through the guided form
//   2  the Close gate holds while the note is incomplete
//   3  Tier 2: six rows, Emergency never renders
//   4  the mentor never sees the crisis note
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

// ── 1–3b · RETIRED (pack v8.0, Supersession 1) ─────────────────────────────
/* The intake accordion is replaced by the assessment DECK; its claims (one
   row open, bounded movement, the observer's accordion, live arrival) are
   measured in `care-v8.mjs`. What the note needs from the intake is only a
   submitted assessment — made here through the guided form (v9.0). */
console.log("\n── setup · an assessment submitted through the guided form");
let submittedState;
{
  const { ctx, page, errors } = await open("/app/chat/t13");
  for (let i = 0; i < 8; i++) {
    const no = page.locator('[data-ga-focused] [data-yes-no$=":no"]').first();
    if (!(await no.count())) break;
    await no.click();
    await page.waitForTimeout(300);
  }
  await page.locator('[data-exchange-field="mentor-summary"]').fill("Method, no intent. Talking it through with me now.");
  await page.locator('[data-exchange-primary="submit-assessment"]').click();
  await page.waitForTimeout(600);
  submittedState = await store(page);
  check(submittedState.escalations.t13.safetyCheck.submittedAt > 0 && errors.length === 0, "the form submits the record", errors.slice(0, 2).join(" | "));
  await ctx.close();
}

// ── 2 · THE GATE ───────────────────────────────────────────────────────────
console.log("\n── 2 · the Close gate holds while the note is incomplete");
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", extra: { escalations: submittedState.escalations, tierEvents: submittedState.tierEvents } });
  await page.locator('[data-tier-row="1"]').click();
  await page.locator('[data-tier-cta=confirm]').click();
  await page.waitForTimeout(500);
  const closeNodes = await page.locator("[data-node='close'][data-node-state='current']").count();
  const deck = await page.locator("[data-crisis-deck]").count();
  check(closeNodes === 0 && deck === 1, "an incomplete note offers no Close action; the deck is the current card", JSON.stringify({ closeNodes, deck }));
  await ctx.close();
}

// ── 3 · TIER 2 ─────────────────────────────────────────────────────────────
console.log("\n── 3 · Tier 2");
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "supervisor", chat: "escalation-tier2" });
  const t2 = await page.evaluate(() => ({
    rows: [...document.querySelectorAll("[data-deck-row]")].map((r) => r.dataset.deckRow),
    emergency: !!document.querySelector('[data-deck-row="emergency"], [data-crisis-section="emergency"]'),
    progress: document.querySelector("[data-deck-progress]")?.textContent,
  }));
  /* RETARGETED (pack v11.0): the deck, and its own progress line — the
     fixture's one section counts as recorded. */
  check(t2.rows.length === 6 && !t2.emergency && /^\d of 6 sections recorded$/.test(t2.progress ?? ""), "Tier 2: six rows, Emergency never renders, the count is of six", JSON.stringify(t2));
  await page.locator('[data-node="note"]').screenshot({ path: `${OUT}/05-tier2-partial.png` });
  await ctx.close();
}

// ── 4 · THE MENTOR NEVER SEES THE NOTE ─────────────────────────────────────
console.log("\n── 4 · the mentor never sees the crisis note");
{
  const { ctx, page } = await open("/app/chat/t13", { persona: "mentor", chat: "escalation-tier2" });
  const m = await page.evaluate(() => document.querySelectorAll("[data-crisis-deck], [data-crisis-section]").length);
  check(m === 0, "the mentor lens renders no crisis note", String(m));
  await ctx.close();
}

await b.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
