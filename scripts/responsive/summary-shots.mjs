// CARE SUMMARY VARIANT CAPTURE — one crop per state the document can be in.
//
// Not part of the tracker matrix: these are per-TEEN states of one card, not
// per-viewport states of a page, so the view list would be the wrong axis. The
// card is cropped rather than the page captured full-height, because the thing
// under review is the document and a full page shot of it is 4000px tall.
import { mkdir, writeFile } from "node:fs/promises";
import { launch, openView, VIEWPORTS, BASE } from "./harness.mjs";
import { readStoreVersion } from "./harness.mjs";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-summary";
const WIDE = VIEWPORTS.find((v) => v.label === "xl");
const NARROW = VIEWPORTS.find((v) => v.label === "xs");

/** Each row: the state being evidenced, and the teen that reaches it. */
const VARIANTS = [
  { id: "01-all-elements", teen: "t17", note: "all five elements populated, concordant, 3 flags" },
  { id: "02-no-flags", teen: "t19", note: "no risk flags in window — the explicit empty state" },
  { id: "03-refuse-readings", teen: "t18", note: "one comparable reading — refusal names readings" },
  { id: "04-refuse-contact", teen: "t21", note: "2 contact days — refusal names contact" },
  { id: "05-first-cycle", teen: "t11", note: "first cycle — no prior code, delta absent" },
  { id: "06-long-tenure-no-themes", teen: "t23", note: "months of contact, no extraction — the copy that used to lie" },
];

const version = await readStoreVersion();
const browser = await launch();
const report = { base: BASE, out: OUT, shots: [], missing: [] };

for (const vp of [WIDE, NARROW]) {
  for (const v of VARIANTS) {
    const view = {
      id: v.id,
      url: `/admin/person/${v.teen}?tab=care`,
      seed: { persona: "supervisor" },
    };
    // ═══ A TALL VIEWPORT, ON PURPOSE ═══
    //
    // The app shell scrolls an INNER container (`overflow-y-auto`), not the
    // document, so the document is exactly viewport-height and `fullPage` plus a
    // clip lands outside the image every time. Giving the viewport enough height
    // for the whole card removes the inner scroll entirely, and the element
    // capture below then needs no scrolling or stitching. WIDTH IS UNTOUCHED,
    // which is the axis the layout actually responds to.
    const { context, page } = await openView(
      browser,
      view,
      { ...vp, height: 3200 },
      version
    );
    await page.waitForTimeout(700);
    // The card is found by its heading, never by nth-child: a layout change
    // must not silently re-point the crop at a different card.
    const box = await page.evaluate(() => {
      // The section's own hook. Resolving the card by heading text and then
      // walking up to the nearest rounded ancestor found a PAGE-LEVEL container
      // instead — every variant cropped to the same 828px, which looked like
      // twelve screenshots and was one.
      const card = document.querySelector('[data-record-section="care-summary-doc"]');
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
    });
    if (!box) {
      report.missing.push({ ...v, vp: vp.label, reason: "no Care summary card on the page" });
      await context.close();
      continue;
    }
    await mkdir(`${OUT}/${vp.label}`, { recursive: true });
    const png = await page
      .locator('[data-record-section="care-summary-doc"]')
      .screenshot();
    await writeFile(`${OUT}/${vp.label}/${v.id}.png`, png);
    report.shots.push({ ...v, vp: vp.label, h: Math.round(box.height), w: Math.round(box.width) });
    await context.close();
  }
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
