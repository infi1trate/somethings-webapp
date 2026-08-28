// THE CUSTOM ASSERTIONS — the checks axe and a screenshot diff will not make.
// Output: docs/responsive/ASSERTIONS.json
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { VIEWS } from "./harness-views.mjs";
import { VIEWPORTS, launch, needsFlow, openView, readStoreVersion, BASE } from "./harness.mjs";
import { FLOWS } from "./flows.mjs";
import { IN_PAGE, focusNotObscured } from "./checks.mjs";

const only = process.env.ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const views = only?.length ? VIEWS.filter((v) => only.includes(v.id) || only.includes(v.cluster)) : VIEWS;

const version = await readStoreVersion();
const browser = await launch();
const out = { base: BASE, results: [], summary: {
  hScroll320: 0, targetsFail: 0, targetsWarn: 0, rc6: 0, focusObscured: 0, vhUsage: 0,
} };

for (const view of views) {
  // Flow views are driven per-viewport inside the loop below.
  for (const vp of VIEWPORTS) {
    const { context, page } = await openView(browser, view, vp, version);
    if (needsFlow(view)) {
      const flowed = await FLOWS[view.flow](page, view.url, BASE);
      if (!flowed.ok) {
        out.results.push({ id: view.id, vp: vp.label, skipped: flowed.reason });
        await context.close();
        continue;
      }
    }
    try {
      const r = await page.evaluate(IN_PAGE);

      // ═══ THE FOCUS SWEEP GETS A PRISTINE DOCUMENT (gap row 279) ═══
      //
      // The sweep focuses up to 60 elements in sequence and every focus() can
      // scroll, so without this each element was measured against a document
      // already mutated by every element before it, on top of whatever IN_PAGE
      // left behind. Reloading makes each result depend on the view alone.
      //
      // WHAT THIS DID NOT FIX, because it was never broken: the sweep was
      // already reproducible. The reload was added on the suspicion that it was
      // not — D6 @landscape reported 19 hits in a full run against 2 from an
      // ad-hoc direct call — and that suspicion was wrong. The ad-hoc call
      // skipped IN_PAGE and the reload, so it ran a different sequence; it was
      // never the same check twice. Measured across two full passes the totals
      // agree within 1% (focusObscured 654 → 647, nav[bottom-nav] 271 → 264,
      // landscape 299 → 293). Kept because depending on one page state rather
      // than an accumulated one is still the better property, and verified the
      // only way that means anything: one view twice, identical summaries.
      //
      // SAFE ONLY BECAUSE SEEDING IS ONCE-PER-CONTEXT (gap row 278): the reload
      // rehydrates from localStorage, so a DRIVEN view keeps the state its flow
      // produced instead of being reset to the seed. Note the flip side — a
      // reloaded page carries app-evolved state, not the seed, which is why
      // per-view counts move even though the total does not.
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(600);
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
