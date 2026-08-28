// THE CUSTOM ASSERTIONS — the checks axe and a screenshot diff will not make.
// Output: docs/responsive/ASSERTIONS.json
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { VIEWS } from "./harness-views.mjs";
import { VIEWPORTS, launch, openView, readStoreVersion, BASE } from "./harness.mjs";
import { IN_PAGE, focusNotObscured } from "./checks.mjs";

const only = process.env.ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const views = only?.length ? VIEWS.filter((v) => only.includes(v.id) || only.includes(v.cluster)) : VIEWS;

const version = await readStoreVersion();
const browser = await launch();
const out = { base: BASE, results: [], summary: {
  hScroll320: 0, targetsFail: 0, targetsWarn: 0, rc6: 0, focusObscured: 0, vhUsage: 0,
} };

for (const view of views) {
  for (const vp of VIEWPORTS) {
    const { context, page } = await openView(browser, view, vp, version);
    try {
      const r = await page.evaluate(IN_PAGE);
      const focus = await focusNotObscured(page);
      // SC 1.4.10 is a 320px criterion; wider viewports overflowing is still a
      // bug but it is not THIS one, so it is counted separately.
      const isXs = vp.width === 320;
      if (isXs && r.hScroll.overflows) out.summary.hScroll320++;
      out.summary.targetsFail += r.targets.fail.length;
      out.summary.targetsWarn += r.targets.warn.length;
      out.summary.rc6 += r.rc6.length;
      out.summary.focusObscured += focus.hits.length;
      out.summary.vhUsage += r.vhUsage.length;
      out.results.push({ id: view.id, cluster: view.cluster, vp: vp.label, ...r, focus });
    } catch (e) {
      out.results.push({ id: view.id, vp: vp.label, error: String(e).slice(0, 200) });
    }
    await context.close();
  }
  process.stdout.write(`· ${view.id}\n`);
}

await browser.close();

// `100vh` must stay at zero in SOURCE too — the runtime check cannot see a class
// that is never rendered on a captured view.
const { execSync } = await import("node:child_process");
let srcVh = 0;
try {
  srcVh = Number(execSync("grep -rlE '100vh|h-screen' src/ | wc -l", { encoding: "utf8" }).trim());
} catch { srcVh = -1; }
out.summary.sourceVhFiles = srcVh;

await mkdir("docs/responsive", { recursive: true });
await writeFile("docs/responsive/ASSERTIONS.json", JSON.stringify(out, null, 2));
console.log("\nassertions:", JSON.stringify(out.summary, null, 2));
