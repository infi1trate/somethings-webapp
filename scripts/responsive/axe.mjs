// AXE-CORE over the same view × viewport matrix.
//
// Output: docs/responsive/A11Y-BASELINE.json — counts by view, by viewport and
// by rule. That last grouping is the useful one: it turns "142 violations" into
// "one bad pattern in a shared primitive, times 60 views".
import { writeFile, mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { VIEWS } from "./harness-views.mjs";
import { VIEWPORTS, launch, openView, readStoreVersion, BASE } from "./harness.mjs";

const only = process.env.ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const views = only?.length ? VIEWS.filter((v) => only.includes(v.id) || only.includes(v.cluster)) : VIEWS;

const version = await readStoreVersion();
const browser = await launch();
const out = { base: BASE, generated: null, byView: {}, byViewport: {}, byRule: {}, total: 0, errors: [] };

for (const view of views) {
  for (const vp of VIEWPORTS) {
    const { context, page } = await openView(browser, view, vp, version);
    try {
      // WCAG 2.2 AA is the standard `03-DEFINITION-OF-DONE.md` sets, so the tags
      // are pinned to it rather than running every experimental rule — a
      // baseline padded with best-practice noise is a baseline nobody trusts.
      const res = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const key = `${view.id}@${vp.label}`;
      const n = res.violations.reduce((s, v) => s + v.nodes.length, 0);
      out.byView[view.id] = (out.byView[view.id] ?? 0) + n;
      out.byViewport[vp.label] = (out.byViewport[vp.label] ?? 0) + n;
      out.total += n;
      for (const v of res.violations) {
        out.byRule[v.id] ??= { impact: v.impact, count: 0, views: [] };
        out.byRule[v.id].count += v.nodes.length;
        if (!out.byRule[v.id].views.includes(key)) out.byRule[v.id].views.push(key);
      }
    } catch (e) {
      out.errors.push({ id: view.id, vp: vp.label, error: String(e).slice(0, 200) });
    }
    await context.close();
  }
  process.stdout.write(`· ${view.id} (${out.byView[view.id] ?? 0})\n`);
}

await browser.close();
out.generated = process.env.RESPONSIVE_STAMP ?? "unstamped";
await mkdir("docs/responsive", { recursive: true });
await writeFile("docs/responsive/A11Y-BASELINE.json", JSON.stringify(out, null, 2));

const rules = Object.entries(out.byRule).sort((a, b) => b[1].count - a[1].count);
console.log(`\naxe: ${out.total} violations across ${views.length} views x ${VIEWPORTS.length} viewports`);
for (const [id, r] of rules.slice(0, 12)) console.log(`  ${String(r.count).padStart(5)}  ${id} (${r.impact})`);
if (out.errors.length) console.log(`  ${out.errors.length} run errors`);
