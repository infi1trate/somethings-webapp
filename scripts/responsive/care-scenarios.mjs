// B7 · EVERY TEEN-RECORD SCENARIO, AGAINST THE RESTRUCTURED CARE TAB.
//
// What each one is here to break: day-1 must render the rail with its low-data
// states rather than collapsing the layout; the three review states must each show
// the action region beside a rail, at three different cadence stages; steady has no
// flags, so the sparkline must render on the trajectory alone; longitudinal is the
// dense case where History's two-line cap and date gutter have to hold.
import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-scenarios";
const version = await readStoreVersion();
const browser = await launch();
const report = { base: BASE, rows: [] };

/* ═══ A COPY OF THE REGISTRY, AND IT DRIFTED ═══
   This is a `.mjs` probe and the registry is TypeScript, so it cannot import it —
   which means this list is a second source for the same mapping. It had the same
   defect the registry did: `review-90` and `review-overdue` both named t19, in the
   identical state, so two rows of this matrix were the same screenshot.
   Corrected here alongside the registry, and the intake case added — it was absent
   entirely, so the cadence row's warning tone at the FIRST review had never been
   captured. `src/lib/dev/__tests__/record-scenarios.test.ts` is what holds the
   registry side; this list has to be edited with it.

   AND IT DRIFTED TWICE MORE, both times because `STAGE_LABEL` named the review
   already behind a record rather than the one ahead of it — so the row calling
   itself a 30-day review sat on a teen 134 days into their mentorship. The labels
   name the review that is DUE now (see the note on those maps), which is what lets
   these three rows describe themselves honestly: the day-30 review comes due at
   the INTAKE stage, and the first 90-day one at the stage still keyed `day30`. */
const SCENARIOS = [
  { id: "new", teen: "t1", label: "New — day 1" },
  { id: "steady", teen: "t18", label: "Steady, healthy" },
  { id: "review-day30", teen: "t9", label: "Day 30 review due" },
  { id: "review-90", teen: "t23", label: "90-day review due" },
  { id: "review-overdue", teen: "t19", label: "Review overdue" },
  { id: "longitudinal", teen: "t17", label: "Rich longitudinal" },
];

for (const w of [
  { label: "w1280", width: 1280 },
  { label: "w1024", width: 1024 },
]) {
  for (const sc of SCENARIOS) {
    const { context, page } = await openView(
      browser,
      {
        id: `${sc.id}-${w.label}`,
        url: `/admin/person/${sc.teen}?tab=care&scenario=${sc.id}`,
        seed: { persona: "supervisor" },
      },
      { label: w.label, width: w.width, height: 3000 },
      version
    );
    await page.waitForTimeout(1000);

    const m = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const rail = q('aside[aria-label="Care summary"]');
      const summary = q('[data-record-section="care-summary-doc"]');
      const summaryTrigger = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Care summary"
      );
      const timeline = q('[data-record-section="care-timeline"]');
      const rows = [...(timeline?.querySelectorAll("li") ?? [])];
      // THE TWO-LINE CAP, MEASURED. A collapsed row's own height, excluding any
      // expanded panel: more than ~2 lines of the row label plus padding means
      // something is still rendering that should not.
      const heights = rows.map((r) => Math.round(r.getBoundingClientRect().height));
      const gutters = rows
        .map((r) => r.querySelector("span.w-\\[96px\\]"))
        .filter(Boolean);
      const gutterRights = [
        ...new Set(gutters.map((g) => Math.round(g.getBoundingClientRect().right))),
      ];
      return {
        railVisible: rail ? rail.getBoundingClientRect().width > 0 : false,
        /* ═══ REACHABLE, NOT NECESSARILY MOUNTED ═══
           Above 1100px the summary is in the right column. Below it, it is in
           the sheet behind the tab-row trigger and is NOT in the DOM at rest —
           which is new, and is the point: it used to sit in the column as a
           `hidden` copy at every width, so a record could have two of it mounted
           the moment the sheet opened. The summary carries document-global SVG
           ids (gap row 309), so that latent duplicate was a real hazard.
           The check therefore asks the question that actually matters at each
           width: is the summary on screen, or is there a control that brings it
           on screen. */
        summaryPresent: !!summary || !!summaryTrigger,
        summaryInColumn: !!summary,
        // VISIBILITY, NOT PRESENCE. The trigger is hidden by
        // `min-[1100px]:hidden`, so it is in the DOM at every width — a presence
        // check reported it as showing at 1280 and would have hidden a real
        // regression behind a passing run. Same mistake as the preview-panel
        // probe; same fix.
        trigger: [...document.querySelectorAll("button")].some(
          (b) =>
            b.textContent?.trim() === "Care summary" &&
            b.getBoundingClientRect().height > 0
        ),
        actionRegion: !!q('[data-record-section="care-task-region"]') ||
          document.body.innerText.includes("Action required"),
        rowCount: rows.length,
        maxRowH: heights.length ? Math.max(...heights) : null,
        medianRowH: heights.length
          ? heights.slice().sort((a, b) => a - b)[Math.floor(heights.length / 2)]
          : null,
        // A gutter that is a real column has ONE right edge for every row.
        gutterEdges: gutterRights,
        sparkline: document.querySelectorAll('[data-record-section="care-summary-doc"] polyline').length,
        lozenges: [...document.querySelectorAll('[data-record-section="care-timeline"] span')]
          .filter((n) => /^\d+$/.test(n.textContent?.trim() ?? "") && n.className.includes("tabular-nums"))
          .length,
        docOverflow: document.documentElement.scrollWidth - innerWidth,
        emptyHistory: (timeline?.innerText ?? "").includes("No entries"),
      };
    });
    report.rows.push({ vp: w.label, ...sc, ...m });
    await mkdir(`${OUT}/${w.label}`, { recursive: true });
    await writeFile(
      `${OUT}/${w.label}/${sc.id}.png`,
      await page.screenshot({ clip: { x: 0, y: 0, width: w.width, height: 1100 } })
    );
    await context.close();
  }
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
