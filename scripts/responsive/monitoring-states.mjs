// ═══ THE MONITORING SURFACE, STATE BY STATE (arch-B) ═══
//
// Grows with the phase: B1 checks the route, the persona gate, the header and
// the tier bands; B2 adds the hybrid unit of review; B3 the escalation region;
// B4 the load states and the a11y sweep.
//
// THE CONTEXT IS THE HARNESS'S OWN, so every run seeds a fresh localStorage and
// nothing here can touch a real demo store.
//
// Exit codes: 0 every check passed · 1 a check failed.

import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/monitoring";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 1000 };
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const rows = [];
let failed = 0;

function check(id, label, ok, detail) {
  rows.push({ id, label, ok: !!ok, detail });
  if (!ok) failed += 1;
  console.log(`  ${ok ? "✓" : "×"} ${id.padEnd(28)} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function open(id, { persona = "supervisor", scenario = "typical-shift", load = "ready", url = "/app/monitoring" } = {}) {
  return openView(
    browser,
    { id, url, seed: { persona, extra: { tasksScenarioId: scenario, devLoadState: load } } },
    XL,
    version
  );
}

const textOf = (page) => page.locator("main").innerText();

/** THE SUBTITLE, BY STRUCTURE RATHER THAN BY LINE NUMBER. The first version read
 *  `innerText.split("\n")[1]`, which is only the subtitle while nothing else in
 *  `main` happens to render above it — and in the harness's own context it did
 *  not, so three checks failed against an empty string and said nothing useful
 *  about the page. The element is the thing being asserted; address it. */
const subtitleOf = (page) => page.locator("main h1 + p").first().innerText();

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE SURFACE EXISTS, AND SAYS WHAT IT HOLDS.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("shell");
  const t = await textOf(page);

  check("shell.header", "the page names itself", /^\s*Monitoring/m.test(t));

  // ALL THREE TIERS, IN THE COMPARATOR'S ORDER. Imminent leads because
  // TIER_RANK says so, not because the band code enforces it.
  const bands = await page
    .getByRole("group")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")).filter((l) => l && / — \d+$/.test(l))
    );
  check(
    "shell.tiers",
    "three tier bands, imminent first",
    bands.length === 3 &&
      /^Imminent/.test(bands[0]) &&
      /^Clinical review/.test(bands[1]) &&
      /^Routine review/.test(bands[2]),
    bands.join(" | ")
  );

  // THE OLD TIER VOCABULARY IS GONE FROM THE SCREEN, not just from the types.
  check(
    "shell.no-colour-words",
    "no tier is named by its colour",
    !/\b(Red flag|Orange flag|Standard flag)\b/.test(t)
  );

  // ═══ THE COUNTS HAVE TO RECONCILE ═══
  // The subtitle's coverage figure and the three band headers are computed from
  // different code paths — `flagEntriesFor` counting members, and `bandsFor`
  // summing taskCount. If they ever disagree, one of them is lying to a
  // supervisor about how much work there is.
  const banded = bands.reduce((n, b) => n + Number(b.match(/ — (\d+)$/)[1]), 0);
  const sub = (await subtitleOf(page)).trim();
  const claimed = Number((sub.match(/(\d+) flags? in review/) ?? [])[1]);
  check(
    "shell.counts-reconcile",
    "the subtitle's coverage equals the bands' total",
    banded === claimed,
    `bands ${banded} vs subtitle ${claimed} (“${sub}”)`
  );

  // OBLIGATION FIRST. A bare open count is what this surface must never lead
  // with — see `monitoringSubtitle`.
  check(
    "shell.obligation-first",
    "the subtitle leads with what is owed",
    /^\d+ past 24h/.test(sub),
    sub
  );

  await page.screenshot({ path: `${OUT}/01-shell.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · THE BADGE COUNTS DEBT, AND IT AGREES WITH THE PAGE.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("badge");
  const labels = await page
    .locator("nav [aria-label]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const badge = labels.find((l) => /overdue$/.test(l));
  check("badge.present", "Monitoring carries an obligation badge", Boolean(badge), badge);

  // NOT "unread", which is Activity's word about mail, and not "open", which is
  // Tasks' word about volume. This badge counts debt.
  check(
    "badge.noun",
    "the badge says what it counts",
    Boolean(badge) && !/unread|open/.test(badge),
    badge
  );

  // THE BADGE AND THE SUBTITLE READ THE SAME OBLIGATIONS. Two call sites, one
  // function; a mismatch would mean the nav is arguing with the page.
  const sub = (await subtitleOf(page)).trim();
  const past = Number((sub.match(/(\d+) past 24h/) ?? [0, 0])[1]);
  const writeUps = Number((sub.match(/(\d+) write-up/) ?? [0, 0])[1]);
  const badged = Number((badge ?? "0").match(/\d+/)[0]);
  check(
    "badge.agrees",
    "the badge equals the subtitle's debt",
    badged === past + writeUps,
    `badge ${badged} vs ${past} + ${writeUps}`
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · EVERY OTHER PERSONA IS UNTOUCHED.
// ═══════════════════════════════════════════════════════════════════════════
//
// A static route shadows `/app/[section]` for EVERYBODY, so the non-supervisor
// branch has to render what the dynamic route would have. Getting this wrong
// gives a mentor a blank shell — a regression for them, dressed up as a feature
// for someone else.
for (const persona of ["mentor", "lead-mentor"]) {
  const { context, page } = await open(`persona-${persona}`, { persona });
  const t = await textOf(page);
  check(
    `persona.${persona}.placeholder`,
    "sees the unbuilt-section placeholder, not the surface",
    /Nothing here yet/.test(t) && !/Imminent — /.test(t)
  );
  const navItems = await page
    .locator("nav a")
    .evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
  check(
    `persona.${persona}.no-nav-item`,
    "is not offered the destination",
    !navItems.some((l) => /Monitoring/.test(l)),
    navItems.filter(Boolean).join(" · ")
  );
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · TASKS DID NOT MOVE.
// ═══════════════════════════════════════════════════════════════════════════
//
// arch-B pulled the undo-window wiring out of `tasks-page.tsx` into a shared
// hook and made `Worklist`'s domain optional. Neither was meant to change Tasks,
// and both are the kind of change that would show up there first.
{
  const { context, page } = await open("tasks-unmoved", { url: "/app/tasks" });
  const t = await textOf(page);
  check(
    "regression.tasks",
    "Tasks still renders its own two bands and nothing else",
    /Intake — 8/.test(t) && /Monthly re-review — 7/.test(t) && !/Imminent — /.test(t)
  );
  await context.close();
}

await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
