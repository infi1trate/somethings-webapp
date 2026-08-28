// SCREENSHOT MATRIX — every tracker row × every viewport.
//
// Output: docs/responsive/screens/<view-id>/<viewport>.png, so a diff is
// per-view rather than per-page-of-many-views.
//
// FULL-PAGE, NOT VIEWPORT-SIZED. A viewport screenshot hides the thing this
// project is about: what happens below the fold when a 3-column grid stacks.
import { mkdir, writeFile } from "node:fs/promises";
import { VIEWS, REDIRECTS } from "./harness-views.mjs";
import { VIEWPORTS, launch, needsFlow, openView, landedOn, readStoreVersion, BASE } from "./harness.mjs";
import { FLOWS } from "./flows.mjs";

const only = process.env.ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const views = only?.length ? VIEWS.filter((v) => only.includes(v.id) || only.includes(v.cluster)) : VIEWS;

const version = await readStoreVersion();
const browser = await launch();
const report = { base: BASE, storeVersion: version, captured: [], unreachable: [], redirects: [] };

for (const view of views) {
  // Flow views are driven per-viewport inside the loop below.
  await mkdir(`docs/responsive/screens/${view.id}`, { recursive: true });
  for (const vp of VIEWPORTS) {
    const { context, page, errors } = await openView(browser, view, vp, version);
    // DRIVEN STATES. `driveReject` navigates to the target itself once the
    // send-back has happened, so this replaces the plain load rather than
    // following it. A failed flow records the row unreached — never captured in
    // the pre-flow state, which would look like evidence.
    if (needsFlow(view)) {
      const flowed = await FLOWS[view.flow](page, view.url, BASE);
      if (!flowed.ok) {
        report.unreachable.push({ id: view.id, vp: vp.label, reason: flowed.reason });
        await context.close();
        continue;
      }
    }
    const landed = await landedOn(page);
    const requested = view.url.split("?")[0];
    const drifted = !landed.startsWith(requested);
    try {
      await page.screenshot({
        path: `docs/responsive/screens/${view.id}/${vp.label}.png`,
        fullPage: true,
      });
      report.captured.push({ id: view.id, vp: vp.label, landed, drifted, errors: errors.length });
      if (drifted) report.unreachable.push({ id: view.id, vp: vp.label, requested: view.url, landed });
    } catch (e) {
      report.unreachable.push({ id: view.id, vp: vp.label, error: String(e).slice(0, 160) });
    }
    await context.close();
  }
  process.stdout.write(`· ${view.id}\n`);
}

// The three redirects: confirm they still redirect. Not audited as views.
for (const r of REDIRECTS) {
  const { context, page } = await openView(browser, { url: r.from, seed: r.seed }, VIEWPORTS[1], version);
  const landed = await landedOn(page);
  report.redirects.push({ from: r.from, expected: r.to, landed, ok: landed.startsWith(r.to) });
  await context.close();
}

await browser.close();
await writeFile("docs/responsive/screens/INDEX.json", JSON.stringify(report, null, 2));
const drift = report.captured.filter((c) => c.drifted).length;
console.log(`\nshots: ${report.captured.length} captured, ${report.unreachable.length} unreachable, ${drift} drifted`);
console.log(`redirects: ${report.redirects.filter((r) => r.ok).length}/${report.redirects.length} ok`);
