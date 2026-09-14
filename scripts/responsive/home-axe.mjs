// AXE-CORE OVER HOME, at four viewports and in both themes.
//
// A SURFACE-SPECIFIC RUN because Home's most interesting region is conditional:
// the shift-start digest only renders after an >8h gap, and a sweep against a
// default seed would never see it. The seed forces one.
//
// WCAG 2.2 AA, pinned — the standard `03-DEFINITION-OF-DONE.md` sets. A baseline
// padded with best-practice noise is a baseline nobody trusts.

import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { VIEWPORTS, launch, openView, readStoreVersion, BASE } from "./harness.mjs";

const OUT = "docs/responsive/home";
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const TIERS = ["xs", "md", "lg", "xl"];
const report = { base: BASE, runs: [], byRule: {}, total: 0 };

/** Home has no list to scroll and no disclosure to open — but its digest is
 *  gated on the shift, so the seed below forces the state that has the most
 *  markup in it. */
async function prepare() {}

for (const label of TIERS) {
  const vp = { ...VIEWPORTS.find((v) => v.label === label), height: 1000 };
  for (const theme of ["light", "dark"]) {
    const { context, page } = await openView(
      browser,
      {
        id: `home-${label}-${theme}`,
        url: "/app/home",
        seed: {
          persona: "supervisor",
          /* `shiftLastSeenAt: 0` COUNTS AS A GAP, so the digest renders and is
             swept along with everything else. */
          extra: { tasksScenarioId: "typical-shift", shiftLastSeenAt: 0 },
        },
      },
      vp,
      version
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForTimeout(300);
    await prepare();

    const res = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const n = res.violations.reduce((s, v) => s + v.nodes.length, 0);
    report.runs.push({ viewport: label, theme, violations: n });
    report.total += n;
    for (const v of res.violations) {
      report.byRule[v.id] ??= { impact: v.impact, count: 0, where: [] };
      report.byRule[v.id].count += v.nodes.length;
      report.byRule[v.id].where.push(`${label}/${theme}`);
      for (const node of v.nodes.slice(0, 2)) {
        report.byRule[v.id].sample ??= node.html?.slice(0, 160);
      }
    }
    console.log(`  ${n === 0 ? "✓" : "×"} ${label.padEnd(3)} ${theme.padEnd(5)} ${n} violation(s)`);
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
