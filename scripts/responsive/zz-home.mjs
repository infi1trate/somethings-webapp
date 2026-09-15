import { launch, openView, VIEWPORTS, readStoreVersion } from "./harness.mjs";
import { mkdir } from "node:fs/promises";
const XL = { ...VIEWPORTS.find(v=>v.label==="xl"), height: 1000 };
const version = await readStoreVersion();
const browser = await launch();
await mkdir("/tmp/home", { recursive: true });
for (const scen of ["typical-shift","breach-overnight","quiet-day","active-escalation"]) {
  const { context, page } = await openView(browser,
    { id:"h-"+scen, url:"/app/home", seed:{persona:"supervisor", extra:{tasksScenarioId:scen, shiftLastSeenAt:0}}}, XL, version);
  const r = await page.evaluate(() => ({
    shell: document.querySelector('nav[aria-label]')?.getAttribute("aria-label"),
    main: (document.querySelector("main")?.innerText||"").replace(/\n+/g," | ").slice(0,420),
    directive: document.querySelector('[data-directive="true"]')?.getAttribute("data-stage"),
    stages: [...document.querySelectorAll('[data-stage]')].map(e=>e.querySelector('a,[aria-label]')?.getAttribute("aria-label") ?? e.getAttribute("aria-label")),
    digest: !!document.querySelector('[data-anno-ref="home-digest"]'),
    strip: !!document.querySelector('[data-anno-ref="home-escalation-strip"]'),
  }));
  console.log("\n==== " + scen + " ====");
  console.log("shell:", r.shell, "| directive:", r.directive, "| digest:", r.digest, "| strip:", r.strip);
  for (const s of r.stages) console.log("   -", s);
  await page.screenshot({ path: `/tmp/home/${scen}.png` });
  await context.close();
}
await browser.close();
