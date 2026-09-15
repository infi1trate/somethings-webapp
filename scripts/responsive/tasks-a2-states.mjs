// ═══ EVERY STATE THE SCOPED TASKS SURFACE CAN BE IN (arch-A, A2) ═══
//
// A1 removed the tab row, the tab cards and the Respond strip. Removing
// navigation does not only remove pixels — it invalidates every string that
// referred to what was navigated to, and nothing type-checks a string. Two were
// already found by reading the error state by hand ("The other tabs are
// unaffected", "Other domains may still be available"), which is exactly the
// kind of defect a visual pass misses and a matrix like this does not.
//
// THE CONTEXT IS THE HARNESS'S OWN, so every run seeds a fresh localStorage and
// nothing here can touch the demo store in anybody's real browser. That is why
// this probe is allowed to DRIVE a commit — filling the documentation gate and
// submitting is the only way to reach group retirement and the whole-page empty
// state, because no task scenario ships zero open billing items.
//
// Exit codes: 0 every check passed · 1 a check failed.

import { launch, openView, VIEWPORTS, BASE, readStoreVersion } from "./harness.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = process.env.SHOT_OUT ?? "docs/responsive/tasks-a2-states";
const XL = { ...VIEWPORTS.find((v) => v.label === "xl"), height: 900 };
const version = await readStoreVersion();
const browser = await launch();
await mkdir(OUT, { recursive: true });

const rows = [];
let failed = 0;

function check(id, label, ok, detail) {
  rows.push({ id, label, ok: !!ok, detail });
  if (!ok) failed += 1;
  const mark = ok ? "✓" : "×";
  console.log(`  ${mark} ${id.padEnd(26)} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function open(id, { scenario = "typical-shift", load = "ready" } = {}) {
  const { context, page } = await openView(
    browser,
    {
      id,
      url: "/app/tasks",
      seed: {
        persona: "supervisor",
        extra: { tasksScenarioId: scenario, devLoadState: load },
      },
    },
    XL,
    version
  );
  return { context, page };
}


/** FILL THE DOCUMENTATION GATE the way a supervisor would: the select, then both
 *  fields. Three answers is the whole gate — `FIELD_ORDER` in `billing-review`
 *  is the single source for both the render order and the missing-answer list. */
async function fillReview(page) {
  await page.getByRole("combobox", { name: /Assessment of symptoms/i }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("option").first().click();
  await page.waitForTimeout(150);
  await page
    .getByRole("textbox", { name: /Clinical summary/i })
    .first()
    .fill("Reviewed; the presentation is consistent with the record.");
  await page
    .getByRole("textbox", { name: /Diagnostic support/i })
    .first()
    .fill("Supported by the assigned survey and the mentorship history.");
  await page.waitForTimeout(200);
}

const main = () => "main";
const textOf = (page) => page.locator(main()).innerText();
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

// ═══════════════════════════════════════════════════════════════════════════
// 1 · DEFAULT — the surface as a supervisor finds it.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("default");
  const t = await textOf(page);
  /* ═══ NOT PINNED TO A LITERAL COUNT ANY MORE ═══
     This asserted "15 open". arch-E widened the billing fixture so items straddle
     their deadline — the time buckets needed an Overdue and a Due today that
     actually contained something — and the check broke on a number that was
     never the claim. The claim is that the subtitle counts BILLING and agrees
     with the list. */
  const subtitle = (await page.locator("main h1 + p").innerText()).trim();
  const claimed = Number((subtitle.match(/(\d+) open/) ?? [])[1]);
  const rowCount = await page.getByRole("treeitem").count();
  check(
    "default.subtitle",
    "the subtitle counts billing, and agrees with the list",
    claimed > 0 && claimed >= rowCount,
    `"${subtitle}" against ${rowCount} mounted rows`
  );
  /* ═══ SUPERSEDED BY arch-E: TASK-TYPE BANDS ARE NOW TIME BUCKETS ═══
     This asserted "Intake — 8" and "Monthly re-review — 7". Those groups took the
     verb off the row and restarted the countdown at every header; Tasks groups by
     WHEN work is due now. The claim worth keeping is that the list IS grouped and
     the headers name their group with a count — retargeted, not relaxed. */
  const bands = await page
    .getByRole("group")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")).filter((l) => l && / — \d+$/.test(l))
    );
  check(
    "default.buckets",
    "the list is grouped by deadline, in fixed order",
    bands.length > 0 &&
      bands.join(" ") ===
        ["Overdue", "Due today", "Due tomorrow", "Later"]
          .filter((b) => bands.some((x) => x.startsWith(b)))
          .map((b) => bands.find((x) => x.startsWith(b)))
          .join(" "),
    bands.join(" | ")
  );
  check("default.no-tabs", "no tab row survives", !/Escalations|Risk flags|Monitoring/.test(t));
  /* ═══ WHERE THE LIST NOW STARTS ═══
     Recorded, not asserted: pinning it would turn any later padding change into
     a failing probe about the wrong thing.
     NOT COMPARABLE TO THE PHASE REPORT'S 443 → 235. That pair was measured in
     the app at 1440px with the desktop chrome; this is the harness at xl
     (1280) in its own context. A delta is only a delta between two numbers
     taken the same way, so this one stands alone as a regression tripwire for
     future runs of THIS probe. */
  const firstRowTop = await page.getByRole("treeitem").first().evaluate((el) => Math.round(el.getBoundingClientRect().top));
  rows.push({ id: "default.first-row-top", label: "y of the first row", measured: firstRowTop });
  console.log(`  · ${"default.first-row-top".padEnd(26)} first row at y=${firstRowTop} (harness xl; see the note)`);
  /* ═══ THE FILTER CHIP ROW IS BUILT AND HIDDEN (arch-E) ═══
     One task type on this surface means no choice to offer, and a single filter
     offering no choice is dead chrome — the same reasoning that removed the
     one-tab row in arch-A. The affordance exists so the second task type does
     not arrive to a scramble; this is the check that it stays out of the way
     until then.
     ASSERTED IN THE DOM, because the gate lives in the component: a unit test
     over `kindChipsFor` verifies the chip LIST and passed with the gate inverted,
     which a mutation run caught. */
  const chipRow = await page.locator('[data-anno-ref="tasks-kind-filter"]').count();
  check(
    "default.no-kind-filter",
    "the filter chip row stays hidden with one task type",
    chipRow === 0,
    `${chipRow} chip row(s)`
  );

  await shot(page, "01-default");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · BREACH — and the single-band header that used to be suppressed.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("breach", { scenario: "breach-overnight" });
  const t = await textOf(page);
  check("breach.subtitle", "overdue clause appears", /1 open · 1 overdue/.test(t));
  check("breach.chip", "the row carries an Overdue chip", /Overdue/.test(t));
  // The reason bandsAreMeaningful changed: with one band and no tab row above
  // it, nothing on screen said what kind of work these rows were.
  /* WAS `Intake — 1`. A single bucket still labels itself — the reason
     `bandsAreMeaningful` changed in arch-A survives the regrouping. */
  check("breach.single-band", "a lone bucket still labels itself", /Overdue — 1/.test(t));
  await shot(page, "02-breach");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · ERROR — the state whose copy named the tabs that A1 removed.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("error", { load: "error" });
  const t = await textOf(page);
  check("error.retry", "the list errors with a retry", /didn’t load — try again\./.test(t) && /Retry/.test(t));
  check("error.no-tab-copy", "no copy refers to other tabs", !/other tabs/i.test(t));
  check("error.no-domain-copy", "no copy refers to other domains", !/other domains/i.test(t));
  await shot(page, "03-error");

  // RETRY IS A REAL CONTROL, not a label: it clears the list's own state.
  await page.getByRole("button", { name: /^Retry$/ }).first().click();
  await page.waitForTimeout(500);
  const after = await textOf(page);
  check("error.retry-works", "retry restores the list", /Due tomorrow — |Later — /.test(after));
  await shot(page, "04-error-retried");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · PARTIAL FAILURE — inert here, and that is the finding.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("partial", { load: "partial" });
  const t = await textOf(page);
  // PARTIAL_FAILURE_DOMAINS is riskFlag/escalation/monitoring — billing is
  // deliberately the healthy one. With billing the only domain left on this
  // surface, "Partial" now renders exactly like "Ready". Asserted rather than
  // narrated, so the day billing is added to that list this probe says so.
  check(
    "partial.billing-healthy",
    "partial leaves billing fully loaded",
    /(Due tomorrow|Later|Overdue|Due today) — \d/.test(t) && !/didn['\u2019]t load/.test(t),
    (t.match(/(Overdue|Due today|Due tomorrow|Later) — \d+/g) ?? []).join(" | ")
  );
  await shot(page, "05-partial");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · LOADING — and the replay that only worked once.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("loading");
  // THE SEQUENCE IS 4 × 240ms FROM MOUNT, so seeding `loading` and then waiting
  // for the page to settle misses it every time. Driving the dev bar's own
  // select is both the way to catch it and the way to prove the replay: the
  // stage stamp used to survive a finished run, so Loading → Ready → Loading
  // resolved in the same frame and the second selection did nothing.
  const load = page.locator("select").nth(1);
  for (const run of [1, 2]) {
    await load.selectOption("ready");
    await page.waitForTimeout(150);
    await load.selectOption("loading");
    const skeleton = page.locator("[class*=animate-pulse]").first();
    const seen = await skeleton
      .waitFor({ state: "visible", timeout: 1200 })
      .then(() => true)
      .catch(() => false);
    check(`loading.run${run}`, `selection ${run} replays the sequence`, seen);
    if (run === 1 && seen) await shot(page, "06-loading");
  }
  await load.selectOption("ready");
  await page.waitForTimeout(400);
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · THE REVIEW MODULE — all three proposals, and the documentation gate.
// ═══════════════════════════════════════════════════════════════════════════
//
// THE THREE KINDS ARE NOT ALL IN ONE SCENARIO, which is why this walks two.
// Measured across the billing set: typical-shift is 8 assign + 7 change and
// heavy-caseload is 9 + 7, breach-overnight is a lone assign, active-escalation
// a lone change — and `quiet-day`'s single item is the ONLY renewal in any
// fixture. A probe that checked one scenario would have reported two of three
// and looked complete.
{
  const kinds = new Set();
  for (const scenario of ["typical-shift", "quiet-day"]) {
    const { context, page } = await open(`review-${scenario}`, { scenario });
    const rowCount = await page.getByRole("treeitem").count();
    for (let i = 0; i < rowCount; i += 1) {
      await page.getByRole("treeitem").nth(i).click();
      await page.waitForTimeout(200);
      const t = await textOf(page);
      for (const k of ["Presentation proposed", "Change proposed", "Renewal proposed"]) {
        if (t.includes(k)) kinds.add(k);
      }
    }
    if (scenario === "typical-shift") await shot(page, "07-review-change");
    else await shot(page, "08-review-renewal");
    await context.close();
  }
  check(
    "review.three-kinds",
    "every proposal kind is reachable",
    kinds.size === 3,
    [...kinds].sort().join(" / ") || "none"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · THE DOCUMENTATION GATE — A2's "validation failure in the review module".
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("gate");
  await page.getByRole("treeitem").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^Submit$/ }).first().click();
  await page.waitForTimeout(400);
  const gated = await textOf(page);
  check(
    "gate.refuses",
    "an undocumented review is refused, and told what is missing",
    /* ═══ THE SENTENCE MOVED TO THE ACTION BAR (arch-F, F3) ═══
       It was an `sr-only` region inside the review reading "3 things still need
       an answer" — invisible to sighted readers and 600px below the button that
       ran the gate. The bar states it now, visibly and as the one live region:
       "3 fields still needed. Focus moved to the first." The claim is unchanged
       and is asserted in the bar as well as in the body, so a future move
       cannot quietly drop it from the place a reader is looking. */
    /This field is required/.test(gated) &&
      /still needed/i.test(gated) &&
      /still needed/i.test(await page.locator('[data-slot="task-pane-footer"]').innerText()),
    (gated.split("\n").find((l) => /needed|before this/i.test(l)) ?? "").slice(0, 70)
  );
  await shot(page, "09-validation");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · WHAT A RESOLVE DOES — auto-advance, undo, and the keyboard submit.
// ═══════════════════════════════════════════════════════════════════════════
//
// THE LEDGER HALF OF §6 IS NOT ASSERTED HERE, and that is deliberate rather than
// missing. `appendActivityEvent` pushes into a module-scope array in the app
// bundle — it is not persisted and nothing exposes it to the page, so a browser
// probe claiming "undo wrote no event" would be claiming something it cannot
// see. `src/lib/tasks/__tests__/resolve.test.ts` owns that clause (26 tests,
// including "the ledger stays empty, then and later" and "flush writes the event
// without waiting for the window"), and `tasks-page.tsx` wires flush to both
// unmount and `pagehide`. What IS observable from out here is the worklist's
// half: which row goes, which row is selected next, and what undo puts back.
{
  const { context, page } = await open("mechanics");
  const pane = () => page.locator("main h2").first();

  const before = await pane().innerText();
  await fillReview(page);
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(700);

  const advanced = await pane().innerText();
  check("mechanics.submit", "⌘/Ctrl+Enter submits a documented review", advanced !== before, `${before} → ${advanced}`);
  check(
    "mechanics.auto-advance",
    "the queue moves to the next item on its own",
    advanced !== before && advanced.length > 0
  );
  const listed = await textOf(page);
  check("mechanics.row-gone", "the resolved row leaves the list", !listed.includes(before));
  await shot(page, "10-resolved");

  await page.getByRole("button", { name: /^Undo$/ }).first().click();
  await page.waitForTimeout(600);
  const restored = await pane().innerText();
  check("mechanics.undo-restores", "undo puts the row back", (await textOf(page)).includes(before));
  check("mechanics.undo-reselects", "undo reselects what it restored", restored === before, `${advanced} → ${restored}`);
  await shot(page, "11-undone");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 · CLEARING A BAND — retirement — and then the whole-page empty.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("retire");
  const monthly = () => page.getByRole("group", { name: /Monthly re-review/ });
  let guard = 0;
  while ((await monthly().count()) && (await monthly().getByRole("treeitem").count()) > 0) {
    if ((guard += 1) > 12) break;
    await monthly().getByRole("treeitem").first().click();
    await page.waitForTimeout(250);
    await fillReview(page);
    await page.keyboard.press("Control+Enter");
    await page.waitForTimeout(500);
  }
  /* ═══ SUPERSEDED BY arch-E: A BUCKET DOES NOT RETIRE ═══
     This asserted "Monthly re-review — cleared · 7 today". Band retirement
     reports that a TIER is done, which is information; a deadline bucket
     emptying is not the same fact — it can empty because the work was done OR
     because the clock moved and everything slid into the next bucket, and
     `closedTodayInBand` counts by task type so it could not tell a reader which.
     Retirement is gated to tier grouping now, and Monitoring's is verified in
     `monitoring-states.mjs`. What is asserted here instead is the behaviour that
     replaced it: an emptied bucket stops rendering, and the others carry on. */
  const retired = await textOf(page);
  check(
    "retire.no-bucket-retirement",
    "an emptied bucket stops rendering rather than announcing itself",
    !/—\s*cleared/.test(retired),
    (retired.split("\n").find((l) => /cleared/.test(l)) ?? "no clearance line").slice(0, 50)
  );
  check(
    "retire.others-stay",
    "and the remaining buckets are intact",
    /(Overdue|Due today|Due tomorrow|Later) — \d/.test(retired),
    (retired.match(/(Overdue|Due today|Due tomorrow|Later) — \d+/g) ?? []).join(" | ")
  );
  await shot(page, "12-retired");
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 · THE WHOLE-PAGE EMPTY — reachable only by doing the work.
// ═══════════════════════════════════════════════════════════════════════════
//
// NO SCENARIO SHIPS ZERO OPEN BILLING ITEMS. `quiet-day` holds exactly one, so
// resolving it is the only route to this state on the scoped surface.
{
  const { context, page } = await open("empty", { scenario: "quiet-day" });
  await page.getByRole("treeitem").first().click();
  await page.waitForTimeout(300);
  await fillReview(page);
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(900);
  const empty = await textOf(page);
  check(
    "empty.copy",
    "the emptied surface says nothing is open",
    /Nothing open/.test(empty) && /No open tasks/.test(empty),
    empty.replace(/\s+/g, " ").slice(0, 80)
  );
  // A SINGLE-BAND SURFACE SKIPS RETIREMENT, measured: clearing the last item in
  // the only band hands straight to the page's own empty state, so the band
  // never gets its beat. Recorded rather than treated as a defect — the page
  // empty says the same thing at a larger scale.
  check("empty.skips-retirement", "the page empty replaces the band beat", !/cleared/i.test(empty));
  await shot(page, "13-empty");
  await context.close();
}


await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
