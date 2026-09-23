// THE PHASE'S EVIDENCE — four states, captured rather than described.
//
// Screenshots are not verification: `tasks-g-escalation.mjs` is. These exist so a
// reader can SEE what the measurements are about, and so the next phase has a
// before to diff against. One file per state, named for the state.

import { mkdir } from "node:fs/promises";
import { launch, openView, VIEWPORTS, readStoreVersion } from "./harness.mjs";

/* ROUTE RETARGETED — supervisor IA restructure, Phase 2. `/app/tasks` and
   `/app/monitoring` are `replace` hops now, and a probe that navigates to a hop
   still lands on the destination — so these checks kept passing while asserting
   about a surface they could not name, and a hop with the WRONG target would
   have passed too. Care Reviews is the billing surface; Risk Flags is the flag
   queue. */

const OUT = process.env.SHOT_OUT ?? "docs/responsive/arch-g";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 900 };
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

async function shot(id, url, prepare, extra = {}) {
  const { context, page } = await openView(
    browser,
    {
      id,
      url,
      seed: { persona: "supervisor", extra: { tasksScenarioId: "typical-shift", ...extra } },
    },
    XL,
    version
  );
  await page.waitForTimeout(600);
  if (prepare) await prepare(page);
  await page.screenshot({ path: `${OUT}/${id}.png` });
  console.log(`  ${OUT}/${id}.png`);
  await context.close();
}

const row = (page, re) => page.getByRole("treeitem").filter({ hasText: re }).first().click();

await shot("01-response-pane", "/app/escalations", async (page) => {
  await row(page, /Active escalation/);
  await page.waitForTimeout(400);
});

await shot("02-documentation-pane", "/app/escalations", async (page) => {
  await row(page, /Escalation note/);
  await page.waitForTimeout(400);
});

await shot("03-record-terminal", "/app/monitoring?escalation=esc-documented", null, {
  monitoringScenarioId: "escalation-documented",
});

await shot("04-record-outstanding", "/app/monitoring?region=escalations", null, {
  monitoringScenarioId: "escalation-note-overdue",
});

await browser.close();
