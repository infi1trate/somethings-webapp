// AXE OVER THE CARE SUMMARY'S OWN STATES.
//
// The tracker's care view (H8) is seeded on t21 — the thinnest variant, where
// every element refuses. So the populated card (tier chips, flag rows, the
// concordance chip, the labelled statement fragments) had never been checked.
// This runs the states that actually carry those, at the two widths where the
// layout differs, and reports per rule.
import AxeBuilder from "@axe-core/playwright";
import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";

const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 3200 };
const XS = { ...VIEWPORTS.find((v) => v.label === "xs"), height: 3200 };
const SEL = '[data-record-section="care-summary-doc"]';

const CASES = [
  { id: "populated", teen: "t17", persona: "supervisor" },
  { id: "no-flags", teen: "t19", persona: "supervisor" },
  { id: "thin", teen: "t21", persona: "supervisor" },
  // Element 5 absent — a different DOM, so a different check.
  { id: "mentor-tier", teen: "t17", persona: "mentor" },
];

const version = await readStoreVersion();
const browser = await launch();
const byRule = {};
const details = [];
const runs = [];

for (const vp of [XL, XS]) {
  for (const c of CASES) {
    const { context, page } = await openView(
      browser,
      { id: c.id, url: `/admin/person/${c.teen}?tab=care`, seed: { persona: c.persona } },
      vp,
      version
    );
    await page.waitForTimeout(700);
    // SCOPED TO THE CARD. A page-wide run would fold in violations from every
    // other region and this would stop being evidence about the new component.
    const res = await new AxeBuilder({ page })
      .include(SEL)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    for (const v of res.violations) {
      byRule[v.id] = (byRule[v.id] ?? 0) + v.nodes.length;
      for (const n of v.nodes) {
        details.push({
          case: c.id,
          vp: vp.label,
          rule: v.id,
          target: n.target.join(" "),
          summary: (n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 200),
          html: n.html.slice(0, 160),
        });
      }
    }
    runs.push({
      case: c.id,
      vp: vp.label,
      violations: res.violations.length,
      nodes: res.violations.reduce((n, v) => n + v.nodes.length, 0),
      rules: res.violations.map((v) => `${v.id}×${v.nodes.length}`),
    });
    await context.close();
  }
}

await browser.close();
console.log(JSON.stringify({ base: BASE, byRule, runs, details }, null, 2));
