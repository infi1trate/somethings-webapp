// AXE-CORE OVER MONITORING, at four viewports and in both themes.
//
// A SURFACE-SPECIFIC RUN rather than a row added to the shared matrix, because
// this page's states are not reachable by navigation: the coalesced teen rows
// are below the fold on a virtualized list, the expanded children do not exist
// until a chevron opens, and the escalation region only renders on a scenario
// that has one. A sweep that only saw the first screenful would report clean on
// a third of the page.
//
// WCAG 2.2 AA, pinned — the standard `03-DEFINITION-OF-DONE.md` sets. A baseline
// padded with best-practice noise is a baseline nobody trusts.

import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { VIEWPORTS, launch, openView, readStoreVersion, BASE } from "./harness.mjs";

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so these checks kept passing while asserting
   about a surface they could not name, and a hop with the WRONG target would
   have passed too. Care Reviews is the billing surface; Risk Flags is the flag
   queue. */

/* RETARGETED AGAIN (proto/monitoring-merge). Risk Flags folded into
   `/app/monitoring`, which is a destination again: the tiered page, in both
   of its modes (`tiers-monitor`, `tiers-alert` — the Alert one is the only
   state with the strip and a live Tier 1 lane) and both layouts, with Tier 4
   expanded so the windowed rows are in the sweep. The old queue's prepare
   step (scroll a virtualized tree, open a chevron) went with the queue; it is
   in git at 2978adb. */

const OUT = "docs/responsive/monitoring-tiers";
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const TIERS = ["xs", "md", "lg", "xl"];
const report = { base: BASE, runs: [], byRule: {}, total: 0 };

/** Open the page, then put it in the state a sweep needs to see: the layout
 *  chosen, and Tier 4 expanded (clicked in-page — the dev bar is fixed over
 *  the bottom of the viewport). */
async function prepare(page, layout) {
  if (layout === "cards") {
    await page.locator('[data-layout-toggle="cards"]').click();
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.querySelector("[data-tier4-toggle]")?.click());
  await page.waitForTimeout(400);
}

for (const label of TIERS) {
  const vp = { ...VIEWPORTS.find((v) => v.label === label), height: 1000 };
  for (const theme of ["light", "dark"])
  for (const scenario of ["tiers-monitor", "tiers-alert"])
  for (const layout of ["list", "cards"]) {
    const { context, page } = await openView(
      browser,
      {
        /* Theme from the seed, not emulateMedia — see home-contrast. */
        theme,
        id: `monitoring-${label}-${theme}-${scenario}-${layout}`,
        url: "/app/monitoring",
        seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift", monitoringScenarioId: scenario } },
      },
      vp,
      version
    );
    await page.waitForTimeout(300);
    /* THE SUBJECT IS PRESENT, or a clean sweep is a sweep of nothing. */
    const present = await page.locator("[data-hero-metrics]").count();
    if (!present) {
      report.total += 1;
      console.log(`  × ${label.padEnd(3)} ${theme.padEnd(5)} ${scenario} ${layout}: the Monitoring page did not render`);
      await context.close();
      continue;
    }
    await prepare(page, layout);

    const res = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const n = res.violations.reduce((s, v) => s + v.nodes.length, 0);
    report.runs.push({ viewport: label, theme, scenario, layout, violations: n });
    report.total += n;
    for (const v of res.violations) {
      report.byRule[v.id] ??= { impact: v.impact, count: 0, where: [] };
      report.byRule[v.id].count += v.nodes.length;
      report.byRule[v.id].where.push(`${label}/${theme}/${scenario}/${layout}`);
      for (const node of v.nodes.slice(0, 2)) {
        report.byRule[v.id].sample ??= node.html?.slice(0, 160);
      }
    }
    console.log(`  ${n === 0 ? "✓" : "×"} ${label.padEnd(3)} ${theme.padEnd(5)} ${scenario.padEnd(13)} ${layout.padEnd(5)} ${n} violation(s)`);
    await context.close();
  }
}

await browser.close();
await writeFile(`${OUT}/a11y.json`, JSON.stringify(report, null, 2));
if (report.total > 0) {
  console.log("\nBY RULE:");
  for (const [id, r] of Object.entries(report.byRule)) {
    console.log(`  ${id} (${r.impact}) ×${r.count} — ${[...new Set(r.where)].join(", ")}`);
    if (r.sample) console.log(`     ${r.sample}`);
  }
}
console.log(report.total === 0 ? "\nNO VIOLATIONS" : `\n${report.total} VIOLATION(S)`);
process.exit(report.total === 0 ? 0 : 1);
