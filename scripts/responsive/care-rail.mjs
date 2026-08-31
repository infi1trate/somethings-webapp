// THE CARE TAB'S TWO COLUMNS, AND THE OVERLAY THAT REPLACES THE RAIL.
//
// Three claims: at >=1100px the rail is beside the spine and the trigger is
// absent; below it the rail is gone and the trigger opens the same node in a
// right-edge panel; and the summary is never in the document twice (the strip's
// SVG defs are document-global — row 309).
import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/care-rail";
const version = await readStoreVersion();
const browser = await launch();
const report = { base: BASE, rows: [] };

const WIDTHS = [
  { label: "w1280", width: 1280, rail: true },
  { label: "w1100", width: 1100, rail: true },
  { label: "w1024", width: 1024, rail: false },
  { label: "w390", width: 390, rail: false },
];

for (const w of WIDTHS) {
  const { context, page } = await openView(
    browser,
    { id: `care-${w.label}`, url: "/admin/person/t17?tab=care", seed: { persona: "supervisor" } },
    { label: w.label, width: w.width, height: 2600 },
    version
  );
  await page.waitForTimeout(900);

  const closed = await page.evaluate(() => {
    const rail = document.querySelector('aside[aria-label="Care summary"]');
    const trigger = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Care summary"
    );
    const spine = document.querySelector('[data-record-section="care-timeline"]');
    const grid = spine?.closest(".grid");
    const box = (n) => (n ? Math.round(n.getBoundingClientRect().width) : null);
    // The strip's marks are the tell for a duplicate mount.
    const strips = document.querySelectorAll("polyline").length;
    return {
      railVisible: rail ? rail.getBoundingClientRect().width > 0 : false,
      railW: box(rail),
      triggerVisible: trigger ? trigger.getBoundingClientRect().height > 0 : false,
      gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
      historyW: box(spine),
      patternCardGone: !document.querySelector('[data-record-section="care-pattern"]'),
      concordanceGone: !document.body.innerText.includes("Score-vs-content"),
      disclaimersGone:
        !document.body.innerText.includes("mocked — no pipeline") &&
        !document.body.innerText.includes("not itself a clinical determination"),
      provenanceBadges: [...document.querySelectorAll("button")].filter(
        (b) => b.getAttribute("aria-label") === "About this generated text"
      ).length,
      strips,
      docOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });

  let opened = null;
  if (!w.rail && closed.triggerVisible) {
    await page.getByRole("button", { name: "Care summary", exact: true }).first().click();
    await page.waitForTimeout(700);
    opened = await page.evaluate(() => {
      const d = document.querySelector('[data-slot="dialog-content"]');
      if (!d) return { open: false };
      const r = d.getBoundingClientRect();
      return {
        open: true,
        variant: d.getAttribute("data-variant"),
        rightGap: Math.round(innerWidth - r.right),
        strips: document.querySelectorAll("polyline").length,
        hasSummary: !!d.querySelector('[data-record-section="care-summary-doc"]'),
        railStillMounted: !!document.querySelector('aside[aria-label="Care summary"]'),
      };
    });
  }
  report.rows.push({ ...w, closed, opened });
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/${w.label}.png`, await page.screenshot({ clip: { x: 0, y: 0, width: w.width, height: 1000 } }));
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
