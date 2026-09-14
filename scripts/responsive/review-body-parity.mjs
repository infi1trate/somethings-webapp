// THE PROOF THAT EXTRACTING THE REVIEW BODY CHANGED NOTHING ON CARE.
//
// ═══ WHY A DOM SNAPSHOT AND NOT A SCREENSHOT ═══
//
// The claim is "byte-identical rendered output", and a pixel diff cannot make it:
// there is no image-diff dependency in this repo, and antialiasing makes a
// byte-compare of two PNGs flaky enough to be worthless as a gate. The DOM is
// decidable. Neither `care-review-card.tsx` nor `care-review-workspace.tsx` calls
// `useId`, so element ids are stable across runs and `outerHTML` is a fair
// comparison — which is the fact that makes this approach available at all.
//
// ═══ IT IS A SAME-DAY GATE, AND THAT IS ENCODED RATHER THAN ASSUMED ═══
//
// This file originally claimed `openView` pins the clock so the card's dates are
// deterministic. IT DOES NOT. `openView` pins the device mock's status-bar STRING
// ("9:41") for the phone preview and nothing else — its own comment says so:
// "the fixtures' relative dates already drift, but only daily."
//
// So every date the card renders ("Aug 29, 2026", "Jul 11, 2026 – Sep 11, 2026")
// is `ago(Date.now(), n)` and moves at midnight. Measured three days after the
// baseline was taken: all 17 snapshots differed, every one of them at a date and
// every one with IDENTICAL LENGTH — the signature of "Aug 26" becoming "Aug 29".
// Not one byte of markup had changed.
//
// A gate that reports seventeen regressions for a reason that is not a
// regression is worse than no gate: the next person either panics or regenerates
// the baseline to make it stop, and regenerating to silence a failure is how a
// parity check becomes a rubber stamp.
//
// SO THE BASELINE CARRIES THE DAY IT WAS TAKEN, and a comparison across a day
// boundary REFUSES rather than diffing. Dates are not normalised away: this gate
// exists to catch unintended output changes, and a changed date format is
// exactly such a change. The constraint is real, so it is stated and enforced
// instead of hidden.
//
// USE IT THE WAY IT WAS USED: capture on a clean tree, do the work, compare the
// same day.
//
// ═══ WHAT IS NORMALISED, AND WHY EACH ONE IS SAFE ═══
//
// Radix generates ids for its dialog parts (`:r3:`, `aria-controls`,
// `aria-labelledby`). Those depend on how many Radix components mounted before
// this one, which an extraction can legitimately change without changing what a
// reader sees. They are normalised to a placeholder. NOTHING ELSE IS: every
// class, every attribute, every text node is compared as written.
//
// Usage:
//   node scripts/responsive/review-body-parity.mjs --write   (capture baseline)
//   node scripts/responsive/review-body-parity.mjs           (compare)

import { launch, openView, readStoreVersion } from "./harness.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUT = "docs/responsive/review-body-parity";
const FILE = `${OUT}/baseline.json`;
const WRITE = process.argv.includes("--write");

/** Four records covering the three proposal kinds plus an intake. */
const RECORDS = [
  { id: "t19", note: "change proposed" },
  { id: "t17", note: "renewal proposed" },
  { id: "t12", note: "presentation proposed (nothing on record)" },
  { id: "t9", note: "intake" },
];

const CARD = '[data-record-section="care-review-card"]';

const snap = async (page) =>
  page.evaluate((CARD) => {
    const el = document.querySelector(CARD);
    if (!el) return null;
    return (
      el.outerHTML
        // Radix's mount-order-dependent ids — see the module note.
        .replace(/:r[0-9a-z]+:/g, ":id:")
        .replace(/radix-[0-9a-z:-]+/gi, "radix-id")
    );
  }, CARD);

const openReview = (page) =>
  page.evaluate((CARD) => {
    const c = document.querySelector(CARD);
    [...c.querySelectorAll("button")].find((b) => b.textContent.trim() === "Review")?.click();
  }, CARD);

const pickOtherCode = (page) =>
  page.evaluate(async (CARD) => {
    const c = document.querySelector(CARD);
    [...c.querySelectorAll("button")].find((b) => b.textContent.trim() === "Change code")?.click();
    await new Promise((r) => setTimeout(r, 500));
    const d = document.querySelector('[role="dialog"]');
    const row = [...d.querySelectorAll("button")].find(
      (b) => /F\d\d\.\d/.test(b.textContent) && !/On record/.test(b.textContent)
    );
    row?.click();
  }, CARD);

/* MATCHES BOTH LABELS. It matched `/View results/` only, and an OPEN grid's
   button reads "Hide results" — so the close half of the round trip clicked
   nothing and the snapshot labelled `pending` was actually pending-with-the-grid-
   open (33,750 chars against an expected ~16k, which is how it was caught). The
   before/after comparison would still have been fair, but a snapshot set has to
   be what it says it is. */
const toggleGrid = (page) =>
  page.evaluate((CARD) => {
    const c = document.querySelector(CARD);
    [...c.querySelectorAll("button")].find((b) =>
      /(View|Hide) results/.test(b.textContent)
    )?.click();
  }, CARD);

const failValidation = (page) =>
  page.evaluate((CARD) => {
    const c = document.querySelector(CARD);
    [...c.querySelectorAll("button")].find((b) => b.textContent.trim() === "Submit")?.click();
  }, CARD);

/** The day the fixtures' relative dates resolve against. */
const today = () => new Date().toISOString().slice(0, 10);

await mkdir(OUT, { recursive: true });
const version = await readStoreVersion();
const browser = await launch();
const shots = {};

for (const rec of RECORDS) {
  const { context, page } = await openView(
    browser,
    { id: `parity-${rec.id}`, url: `/admin/person/${rec.id}?tab=care`, seed: { persona: "supervisor" } },
    { label: "w1600", width: 1600, height: 1400 },
    version
  );
  await page.waitForTimeout(900);

  shots[`${rec.id}/collapsed`] = await snap(page);
  await openReview(page);
  await page.waitForTimeout(600);
  shots[`${rec.id}/expanded`] = await snap(page);

  await toggleGrid(page);
  await page.waitForTimeout(400);
  shots[`${rec.id}/grid-open`] = await snap(page);
  await toggleGrid(page);
  await page.waitForTimeout(300);

  await pickOtherCode(page);
  await page.waitForTimeout(600);
  shots[`${rec.id}/pending`] = await snap(page);

  if (rec.id === "t19") {
    await failValidation(page);
    await page.waitForTimeout(500);
    shots[`${rec.id}/invalid`] = await snap(page);
  }

  await context.close();
}
await browser.close();

if (WRITE) {
  await writeFile(FILE, JSON.stringify({ capturedOn: today(), shots }, null, 2));
  console.log(`baseline written: ${Object.keys(shots).length} snapshots`);
  for (const [k, v] of Object.entries(shots)) console.log(`  ${k} — ${v ? v.length : "NULL"} chars`);
  process.exit(0);
}

const file = JSON.parse(await readFile(FILE, "utf8"));
/* A baseline written before `capturedOn` existed has no day to check, and
   cannot be compared honestly — it is treated as stale rather than trusted. */
const baseline = file.shots ?? {};
if (file.capturedOn !== today()) {
  console.log(
    `STALE BASELINE — captured ${file.capturedOn ?? "before this check existed"}, today is ${today()}.\n` +
      `The fixtures' dates are relative to now and move at midnight, so a byte\n` +
      `comparison across days reports differences that are not regressions.\n\n` +
      `Re-capture on a CLEAN TREE and compare the same day:\n` +
      `  git stash && node scripts/responsive/review-body-parity.mjs --write && git stash pop\n` +
      `  node scripts/responsive/review-body-parity.mjs`
  );
  process.exit(2);
}
const keys = [...new Set([...Object.keys(baseline), ...Object.keys(shots)])];
const diffs = [];
for (const k of keys) {
  const a = baseline[k];
  const b = shots[k];
  if (a === b) continue;
  if (a == null || b == null) {
    diffs.push(`${k}: ${a == null ? "missing in baseline" : "missing now"}`);
    continue;
  }
  // First divergence, with context — a 40k-char diff is unreadable otherwise.
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  diffs.push(
    `${k}: diverges at char ${i} of ${a.length}/${b.length}\n` +
      `    baseline: …${a.slice(Math.max(0, i - 60), i + 90)}…\n` +
      `    now:      …${b.slice(Math.max(0, i - 60), i + 90)}…`
  );
}
console.log(`${keys.length} snapshots compared`);
console.log(diffs.length ? `\n${diffs.length} DIFFER\n` + diffs.join("\n\n") : "\nbyte-identical");
process.exit(diffs.length ? 1 : 0);
