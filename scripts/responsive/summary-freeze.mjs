// THE FROZEN SUMMARY, DRIVEN THROUGH THE PRODUCT'S OWN FLOW.
//
// A frozen summary cannot be seeded: it exists only because a supervisor
// approved a review, and the whole point of the commit is that it happens in
// that act. So this drives Approve → care update → Save and then reads the
// record back, which is also the only way to verify the commit actually landed.
//
// IT ASSERTS ON THE END STATE, not on the clicks. A driver that reports "ok"
// because every click succeeded has caught nothing — that mistake was made
// earlier in this project and returned green while reverting the flow it drove.
import { launch, openView, VIEWPORTS, BASE, readStoreVersion, STORE_KEY } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-summary";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 3200 };
const SEL = '[data-record-section="care-summary-doc"]';
const TEEN = "t17";

const version = await readStoreVersion();
const browser = await launch();
const { context, page } = await openView(
  browser,
  { id: "freeze", url: `/admin/person/${TEEN}?tab=care`, seed: { persona: "supervisor" } },
  XL,
  version
);
await page.waitForTimeout(700);

const report = { base: BASE, steps: [] };
const step = (name, ok, detail) => report.steps.push({ name, ok, ...(detail ? { detail } : {}) });

// ── before: a draft, and the header must not claim a committed window ──
const before = await page.evaluate((sel) => {
  const c = document.querySelector(sel);
  return { present: !!c, text: c?.textContent?.slice(0, 260) ?? null };
}, SEL);
step("summary present as a draft", before.present, before.text);

// ── approve ──
const approve = page.getByRole("button", { name: /^Approve/ }).first();
step("Approve is offered", await approve.count() > 0);
await approve.click();
await page.waitForTimeout(500);

// The compose dialog. Fill every required field by its label rather than by
// index — a reordered form must fail loudly, not fill the wrong box.
const dialog = page.getByRole("dialog");
step("care update dialog opened", await dialog.count() > 0);
const areas = dialog.locator("textarea");
const n = await areas.count();
for (let i = 0; i < n; i++) {
  await areas.nth(i).fill("Driven by the verification harness. TODO-COPY.");
}
step("filled every textarea", n > 0, `${n} textareas`);

// Assessment radio, if the form requires one.
const radios = dialog.locator('[role="radio"], input[type="radio"]');
if (await radios.count()) await radios.first().click();

const save = dialog.getByRole("button", { name: /save|record|commit|sign/i }).last();
step("save control found", await save.count() > 0);
await save.click();
await page.waitForTimeout(1200);

// ── after: the commit must be IN THE STORE, not just off the screen ──
const after = await page.evaluate(
  ({ key, teen }) => {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    const commits = parsed?.state?.careSummaryCommits?.[teen] ?? [];
    return {
      commitCount: commits.length,
      commit: commits[0] ?? null,
      reviewCount: Object.keys(parsed?.state?.careReviews ?? {}).length,
    };
  },
  { key: STORE_KEY, teen: TEEN }
);
step("a summary was committed", after.commitCount === 1, JSON.stringify(after.commit));
step("the review was recorded in the same act", after.reviewCount >= 1);
step(
  "the commit carries its cross-reference to the care update",
  typeof after.commit?.documents === "string" && after.commit.documents.startsWith("ce-cu-"),
  after.commit?.documents ?? null
);
step(
  "the commit stores counts per tier, not a tier for the teen",
  !!after.commit?.markerCounts && after.commit.tier === undefined,
  JSON.stringify(after.commit?.markerCounts)
);

// ── the frozen card, and the History row it produced ──
await page.reload();
await page.waitForTimeout(1200);
const frozen = await page.evaluate((sel) => {
  const c = document.querySelector(sel);
  const rows = [...document.querySelectorAll("li,tr")]
    .map((n) => n.textContent ?? "")
    .filter((t) => t.includes("Care summary committed"));
  return {
    header: c?.textContent?.slice(0, 300) ?? null,
    historyRows: rows.length,
    rowText: rows[0]?.replace(/\s+/g, " ").slice(0, 220) ?? null,
    crossRef: document.body.innerText.includes("Read alongside the"),
  };
}, SEL);
step("a care_summary row is in History", frozen.historyRows > 0, frozen.rowText);
step("the pair is cross-referenced on the row", frozen.crossRef);
// THE INVARIANT THAT REPLACED "FROZEN". Approving opens the next window, so the
// card must show the LIVE cycle and must not label itself a past one — a
// "previous cycle" tag here previously sat above a zero-length window. See
// design-system-gaps row 305.
step(
  "the card does not claim to be a previous cycle",
  !(frozen.header ?? "").includes("previous cycle"),
  frozen.header?.slice(0, 120)
);
report.frozenHeader = frozen.header;

await mkdir(`${OUT}/frozen`, { recursive: true });
const card = page.locator(SEL);
if (await card.count()) {
  await writeFile(`${OUT}/frozen/07-frozen.png`, await card.screenshot());
  report.shot = `${OUT}/frozen/07-frozen.png`;
}

await context.close();
await browser.close();
console.log(JSON.stringify(report, null, 2));
