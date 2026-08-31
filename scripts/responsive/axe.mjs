// AXE-CORE over the same view × viewport matrix.
//
// Output: docs/responsive/A11Y-BASELINE.json — counts by view, by viewport and
// by rule. That last grouping is the useful one: it turns "142 violations" into
// "one bad pattern in a shared primitive, times 60 views".
import { writeFile, mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { VIEWS } from "./harness-views.mjs";
import { VIEWPORTS, launch, needsFlow, openView, readStoreVersion, BASE } from "./harness.mjs";
import { FLOWS } from "./flows.mjs";

const only = process.env.ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const views = only?.length ? VIEWS.filter((v) => only.includes(v.id) || only.includes(v.cluster)) : VIEWS;

const version = await readStoreVersion();
const browser = await launch();
const out = { base: BASE, generated: null, byView: {}, byViewport: {}, byRule: {}, total: 0, errors: [] };

for (const view of views) {
  // Flow views are driven per-viewport inside the loop below.
  for (const vp of VIEWPORTS) {
    const { context, page } = await openView(browser, view, vp, version);
    if (needsFlow(view)) {
      const flowed = await FLOWS[view.flow](page, view.url, BASE);
      if (!flowed.ok) {
        out.errors.push({ id: view.id, vp: vp.label, reason: flowed.reason });
        await context.close();
        continue;
      }
    }
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

/** ═══ THE BASELINE STAMPS ITSELF, AND A PARTIAL RUN MAY NOT WRITE IT ═══
 *
 *  Both guards exist because both failures happened, in one session (gap row 344).
 *
 *  (a) A PARTIAL RUN WROTE THE BASELINE. `ONLY=G,D10,D11,H8,A2` swept 8 views and
 *      overwrote a 68-view artifact with its own total of 9 — a 96% "improvement"
 *      that was nothing but a smaller denominator. It was caught by reading the
 *      diff before staging, which is not a control. A filtered run now writes to
 *      a scratch path instead, so the baseline can only ever be a full sweep.
 *
 *  (b) THE FILE CARRIED NO EVIDENCE OF ITS OWN AGE. `generated` read "unstamped"
 *      unless `RESPONSIVE_STAMP` was set, so a baseline 30 commits stale looked
 *      exactly like a fresh one, and its staleness had to be discovered through
 *      `git log` on the file. It now stamps an ISO date by default — a comparison
 *      against a baseline is only evidence if you can see how old it is. */
out.generated = process.env.RESPONSIVE_STAMP ?? new Date().toISOString();
out.viewCount = views.length;
out.viewportCount = VIEWPORTS.length;
out.partial = Boolean(only?.length);
if (out.partial) out.only = only;

const target = out.partial
  ? "docs/responsive/A11Y-PARTIAL.json"
  : "docs/responsive/A11Y-BASELINE.json";
await mkdir("docs/responsive", { recursive: true });
await writeFile(target, JSON.stringify(out, null, 2));
if (out.partial) {
  console.log(
    `\nPARTIAL RUN (ONLY=${only.join(",")}) — wrote ${target}, NOT the baseline.` +
      "\nThe baseline is only ever a full sweep; run without ONLY to refresh it."
  );
}

const rules = Object.entries(out.byRule).sort((a, b) => b[1].count - a[1].count);
console.log(`\naxe: ${out.total} violations across ${views.length} views x ${VIEWPORTS.length} viewports`);
for (const [id, r] of rules.slice(0, 12)) console.log(`  ${String(r.count).padStart(5)}  ${id} (${r.impact})`);
if (out.errors.length) console.log(`  ${out.errors.length} run errors`);
