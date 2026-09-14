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

/** ═══ SCROLL UNTIL THE COALESCED TIERS ARE MOUNTED ═══
 *
 *  The list is virtualized, so everything past the viewport is a spacer div and
 *  NOT in the DOM. On typical-shift the Imminent band alone is 23 rows and fills
 *  the first screen, so a probe that queried straight away found zero teen rows
 *  and reported the hybrid unit missing — which it was not. It was below the
 *  fold, which is the virtualizer working.
 *
 *  Scrolls in viewport-sized steps and stops as soon as a disclosure row exists,
 *  so it costs one step on a short list and a handful on a long one. */
async function scrollToTeenRows(page, maxSteps = 12) {
  for (let i = 0; i < maxSteps; i += 1) {
    if (await page.locator('[role="treeitem"][aria-expanded]').count()) return true;
    const more = await page.evaluate(() => {
      const el = document.querySelector('[data-anno-ref="tasks-worklist-scroller"]');
      if (!el) return false;
      const before = el.scrollTop;
      el.scrollTop = before + el.clientHeight * 0.9;
      el.dispatchEvent(new Event("scroll"));
      return el.scrollTop > before;
    });
    await page.waitForTimeout(220);
    if (!more) break;
  }
  return (await page.locator('[role="treeitem"][aria-expanded]').count()) > 0;
}

/** Walk the whole virtualized list looking for a selector. Rows outside the
 *  window are spacer divs, not elements, so "not in the DOM" and "not in the
 *  list" are different facts and only this can tell them apart. */
async function scrollToFind(page, selector, maxSteps = 30) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-anno-ref="tasks-worklist-scroller"]');
    if (el) el.scrollTop = 0;
  });
  await page.waitForTimeout(200);
  for (let i = 0; i < maxSteps; i += 1) {
    if (await page.locator(selector).count()) return true;
    const more = await page.evaluate(() => {
      const el = document.querySelector('[data-anno-ref="tasks-worklist-scroller"]');
      if (!el) return false;
      const before = el.scrollTop;
      el.scrollTop = before + el.clientHeight * 0.8;
      el.dispatchEvent(new Event("scroll"));
      return el.scrollTop > before;
    });
    await page.waitForTimeout(160);
    if (!more) break;
  }
  return (await page.locator(selector).count()) > 0;
}

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

// ═══════════════════════════════════════════════════════════════════════════
// 5 · THE HYBRID UNIT OF REVIEW (B2).
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("hybrid");
  await scrollToTeenRows(page);

  const rows = await page.getByRole("treeitem").evaluateAll((els) =>
    els.map((e) => ({
      label: e.getAttribute("aria-label") ?? "",
      expandable: e.getAttribute("aria-expanded") !== null,
      band: e.closest('[role="group"]')?.getAttribute("aria-label") ?? "",
      h: Math.round(e.getBoundingClientRect().height),
    }))
  );

  // THE CORE CLAIM. A 24h deadline must not be reachable only through a chevron.
  const imminent = rows.filter((r) => /^Imminent/.test(r.band));
  check(
    "hybrid.imminent-individual",
    "no imminent flag is behind a disclosure",
    imminent.length > 0 && imminent.every((r) => !r.expandable),
    `${imminent.length} imminent rows, ${imminent.filter((r) => r.expandable).length} expandable`
  );

  const teenRows = rows.filter((r) => r.expandable);
  check(
    "hybrid.teen-coalesced",
    "the lower tiers gather into teen rows",
    teenRows.length > 0 && teenRows.every((r) => !/^Imminent/.test(r.band)),
    `${teenRows.length} teen rows`
  );

  // COUNT AND COMPOSITION, BOTH IN WORDS. Colour carries identity on this row
  // and nothing else, so every state has to be sayable.
  const withComposition = teenRows.filter((r) => / \d+ (clinical|routine)/.test(r.label));
  check(
    "hybrid.composition",
    "a mixed teen row says what is behind it",
    withComposition.length > 0 &&
      withComposition.every((r) => /\d+ flags/.test(r.label)),
    withComposition[0]?.label
  );

  // ═══ EVERY ROW IS EXACTLY `ROW_H` ═══
  // The virtualizer multiplies a constant; a taller row would not error, it
  // would silently drift the spacers and put the keyboard's target under the
  // reader's cursor instead of on it. This is why the composition line shares
  // the mentor line rather than taking a third.
  check(
    "hybrid.row-height",
    "the teen row did not grow the row",
    new Set(rows.map((r) => r.h)).size === 1,
    `heights: ${[...new Set(rows.map((r) => r.h))].join(", ")}`
  );

  // THE COMPOSITION MUST FIT AT DESKTOP. It truncates at phone widths by design
  // — that is what `truncate` is for — but a line that is clipped on a 1280px
  // desktop is a line nobody reads.
  const clipped = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="treeitem"][aria-expanded]')]
      .map((r) => r.querySelectorAll("span.truncate")[1])
      .find(Boolean);
    // `null`, NOT a sentinel number. The first version returned -1 when it found
    // nothing and the check read `clipped <= 0`, so "no teen row on screen"
    // passed as "nothing is clipped" — a green tick for an assertion that never
    // ran.
    return el ? el.scrollWidth - el.clientWidth : null;
  });
  check(
    "hybrid.fits",
    "the composition line is not clipped at xl",
    clipped !== null && clipped <= 0,
    clipped === null ? "no teen row found to measure" : `overflow ${clipped}px`
  );

  await page.screenshot({ path: `${OUT}/02-hybrid.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · COALESCING CORRECTNESS — resolve the children one at a time.
// ═══════════════════════════════════════════════════════════════════════════
//
// The group is DERIVED from the open set rather than bookkept, so this is really
// a test that the derivation holds under mutation: the count falls, the row stops
// being a group once one child is left, and only the last child removes it.
//
// THE GROUP IS TRACKED BY TEEN NAME, NOT BY `.first()`. The first version
// re-read `.first()` after every resolve, which returns whichever group leads the
// list NOW — so it reported "5 → 5 → 5 → 5" while five different rows each
// correctly said 5, and the count it was watching was never the count it had
// changed. A row is identified by whose it is.
{
  const { context, page } = await open("coalesce", { scenario: "heavy-caseload" });
  const found = await scrollToTeenRows(page);
  check("coalesce.reachable", "a coalesced teen row is reachable", found);

  const countOf = (label) => Number((label.match(/(\d+) flags/) ?? [0, 0])[1]);
  const first = await page
    .locator('[role="treeitem"][aria-expanded]')
    .first()
    .getAttribute("aria-label");
  const teen = first.split(",")[0];
  const start = countOf(first);
  // `aria-level="1"` so the parent is never confused with one of its own
  // children, which carry the same teen name.
  const sel = (t) => `[role="treeitem"][aria-level="1"][aria-label^="${t},"]`;
  const row = () => page.locator(sel(teen)).first();
  check("coalesce.start", `a group of ${start} to work with`, start >= 3, `${teen}: ${start} flags`);

  // EXPAND WITH THE KEYBOARD. Clicking the row SELECTS it — the chevron has its
  // own click zone with `stopPropagation`, deliberately, so a pointer reader can
  // expand without selecting. ArrowRight is the documented expand.
  await row().click();
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);

  /* RESOLVE THE CHILDREN ONE AT A TIME, each by clicking the child row itself —
     which is the path that found the selection defect: a child row's entry is
     synthetic and was not in `entries`, so the page fell back to row 0 and `y`
     resolved a different teen's flag five times over while this count sat at 5. */
  const seen = [start];
  for (let i = 0; i < start - 1; i += 1) {
    const child = page.locator('[role="treeitem"][aria-level="2"]').first();
    if (await child.count()) {
      await child.click();
      await page.waitForTimeout(220);
    }
    await page.keyboard.press("y");
    await page.waitForTimeout(550);
    const alive = await page.locator(`${sel(teen)}`).count();
    if (!alive) {
      seen.push(0);
      break;
    }
    seen.push(countOf(await page.locator(`${sel(teen)}`).first().getAttribute("aria-label")));
  }

  check(
    "coalesce.count-falls",
    "the count falls by exactly one per child",
    seen.length > 1 && seen.every((v, i) => i === 0 || v === seen[i - 1] - 1 || v === 0),
    seen.join(" → ")
  );

  // ONE CHILD LEFT IS A PLAIN ROW — a disclosure over a single child is a control
  // that does nothing, so the count badge and the chevron go together.
  const stillGrouped = await page.locator(`${sel(teen)}[aria-expanded]`).count();
  check(
    "coalesce.degrades",
    "the row stops being a group before its last child",
    stillGrouped === 0,
    `${stillGrouped} disclosure(s) left on ${teen}`
  );

  /* AND THE TEEN IS STILL THERE, as a plain row carrying the last flag — the
     group resolving early would take an open flag off the surface entirely.
     SCROLLED FOR, not queried in place: a row that drops from five flags to one
     also drops from the Clinical review band to Routine review, which on a
     120-row list is well past the mounted window. The first version asserted
     `count() >= 1` where the row used to be and failed the moment the fixture
     grew — reporting a missing flag when the flag was simply further down. */
  const survives = await scrollToFind(page, sel(teen));
  check("coalesce.last-child-survives", "the last flag is still on the surface", survives);
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · VIRTUALIZATION × KEYBOARD — `j` across the boundary.
// ═══════════════════════════════════════════════════════════════════════════
//
// The rows a reader arrows past are UNMOUNTED behind them. `revealRow` scrolls by
// arithmetic rather than `scrollIntoView` precisely because the element may not
// exist yet — this is the test of that.
{
  const { context, page } = await open("keyboard", { scenario: "heavy-caseload" });
  await page.getByRole("treeitem").first().click();
  await page.waitForTimeout(250);

  const STEPS = 80;
  for (let i = 0; i < STEPS; i += 1) await page.keyboard.press("j");
  await page.waitForTimeout(400);

  const state = await page.evaluate(() => {
    const sel = document.querySelector('[role="treeitem"][aria-selected="true"]');
    const scroller = document.querySelector('[data-anno-ref="tasks-worklist-scroller"]');
    const r = sel?.getBoundingClientRect();
    const s = scroller?.getBoundingClientRect();
    return {
      hasSelection: Boolean(sel),
      label: sel?.getAttribute("aria-label") ?? null,
      inView: r && s ? r.top >= s.top - 1 && r.bottom <= s.bottom + 1 : false,
      focused: document.activeElement === sel,
      scrolled: scroller?.scrollTop ?? 0,
    };
  });
  check("keyboard.survives", `selection survives ${STEPS} presses of j`, state.hasSelection, state.label);
  check("keyboard.in-view", "the selected row was scrolled into view", state.inView);
  check("keyboard.focus", "focus tracks the selection across the unmount boundary", state.focused);
  check("keyboard.moved", "the list actually scrolled", state.scrolled > 0, `scrollTop ${state.scrolled}`);
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · THE EXCERPT RE-ANCHORS ON A CHILD, WITHOUT RELOADING THE PANE.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("reanchor", { scenario: "heavy-caseload" });
  await scrollToTeenRows(page);
  await page.locator('[role="treeitem"][aria-expanded]').first().click();
  await page.waitForTimeout(400);

  // Mark the pane so a remount is detectable: a node the app never touches
  // survives a re-render and does not survive a remount.
  await page.evaluate(() => {
    document.querySelector('[data-slot="task-pane"]')?.setAttribute("data-probe-mark", "1");
  });

  const before = await page.evaluate(() => ({
    anchor: document.querySelector('[role="group"][aria-label^="Conversation excerpt"]')?.scrollTop ?? -1,
    text: document.querySelector('[role="group"][aria-label^="Conversation excerpt"]')?.innerText.slice(0, 120) ?? "",
  }));

  // EXPAND WITH THE KEYBOARD, not by clicking the row — clicking selects, and
  // the chevron's own zone stops propagation so a pointer reader can expand
  // without selecting. The first version clicked the row and then looked for
  // children that were never revealed.
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  const children = page.locator('[role="treeitem"][aria-level="2"]');
  const n = await children.count();
  check("reanchor.children", "expanding reveals the individual flags", n >= 2, `${n} children`);
  if (n >= 2) {
    await children.nth(1).click();
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      marked: document.querySelector('[data-slot="task-pane"]')?.getAttribute("data-probe-mark"),
      text: document.querySelector('[role="group"][aria-label^="Conversation excerpt"]')?.innerText.slice(0, 120) ?? "",
    }));
    check("reanchor.no-reload", "the pane re-rendered rather than remounted", after.marked === "1");
    check(
      "reanchor.moved",
      "the excerpt moved to the child's own message",
      after.text !== before.text,
      after.text === before.text ? "identical excerpt" : "changed"
    );
  }
  await page.screenshot({ path: `${OUT}/03-expanded.png` });
  await context.close();
}


// ═══════════════════════════════════════════════════════════════════════════
// 9 · THE ESCALATION REGION (B3).
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("escalations");
  const region = page.locator('[data-anno-ref="escalation-region"]');
  check("esc.present", "the region renders when there is something in it", await region.count());

  /* THE ROW IS AN `li` WITH A BUTTON AND A LINK INSIDE IT, not a `role="option"`
     — see the structure note in `escalation-region.tsx`. The probe followed the
     old selector and reported six failures that were all one renaming. */
  const rows = await region.locator("li[data-escalation-state]").evaluateAll((els) =>
    els.map((e) => ({
      state: e.getAttribute("data-escalation-state"),
      label: e.querySelector("button")?.getAttribute("aria-label") ?? "",
      text: e.innerText.replace(/\s+/g, " "),
      bg: getComputedStyle(e).backgroundColor,
      action: e.querySelector("a")?.innerText.trim() ?? "",
      current: e.querySelector("button")?.getAttribute("aria-current"),
    }))
  );

  // ALL THREE STATES, ON THE SCENARIO A SUPERVISOR'S TUESDAY IS MEANT TO BE.
  check(
    "esc.three-states",
    "active, due and overdue are all on screen",
    new Set(rows.map((r) => r.state)).size === 3,
    rows.map((r) => r.state).join(" | ")
  );

  // ═══ THE CONTRADICTION B0 WAS ASKED TO FIND ═══
  // A row said "20h open" beside a pane saying "Closed Sep 13". Neither figure
  // was wrong; the word was. Nothing in this region may call a closed escalation
  // open.
  const closed = rows.filter((r) => r.state !== "active");
  check(
    "esc.no-open-on-closed",
    "a closed escalation is never called open",
    closed.length > 0 && closed.every((r) => !/\bopen\b/.test(r.text.replace(/Open documentation/g, ""))),
    closed.map((r) => r.text.slice(0, 44)).join(" ‖ ")
  );
  check(
    "esc.says-closed",
    "and says what it actually is",
    closed.every((r) => /Closed/.test(r.text)),
    closed[0]?.text.slice(0, 60)
  );

  // THE CLOCK RUNS IN THE READER'S DIRECTION. A bare figure beside a closed
  // escalation could mean time since close, time left, or time late.
  const due = rows.find((r) => r.state === "documentationDue");
  const over = rows.find((r) => r.state === "documentationOverdue");
  const live = rows.find((r) => r.state === "active");
  check("esc.clock-due", "a due write-up counts down", /due in /.test(due?.text ?? ""), due?.text.slice(0, 60));
  check("esc.clock-over", "an overdue one counts up", /overdue/.test(over?.text ?? ""), over?.text.slice(0, 60));
  check("esc.clock-active", "an active escalation counts elapsed", /elapsed/.test(live?.text ?? ""), live?.text.slice(0, 60));

  // ═══ THE ALARM BUDGET, SPENT ONCE ═══
  // Exactly one filled saturated ground on the surface, and it belongs to the
  // active escalation. An overdue write-up is a compliance failure about
  // something already over.
  const fills = new Set(rows.map((r) => r.bg));
  check(
    "esc.one-alarm",
    "only the active row carries the filled treatment",
    live && rows.filter((r) => r.bg === live.bg).length === 1,
    [...fills].join(" | ")
  );

  // THE ACTION NAMES THE WORK, NOT THE OBJECT.
  check(
    "esc.action",
    "a closed escalation offers the write-up, not the crisis",
    closed.every((r) => r.action === "Open documentation") &&
      live?.action === "Open escalation",
    `${live?.action} / ${closed[0]?.action}`
  );

  // THE LANDMARK DOES NOT SAY "OPEN" EITHER — it holds closed ones too, and a
  // landmark repeating the row-level defect is the same defect one level up.
  const landmark = await region.getAttribute("aria-label");
  check("esc.landmark", "the region's name covers the whole lifecycle", !/\bopen\b/i.test(landmark), landmark);

  // ═══ THE PANE, FOR A CLOSED ESCALATION ═══
  const closedRow = region
    .locator('li[data-escalation-state]:not([data-escalation-state="active"]) button')
    .first();
  await closedRow.click();
  await page.waitForTimeout(600);
  const pane = await page.locator('[data-slot="task-pane"]').innerText();
  check(
    "esc.pane-state",
    "the pane names the state and its deadline, not a dead end",
    /Closed/.test(pane) && /(due in|overdue)/.test(pane) &&
      !/Nothing here changes its state/.test(pane),
    (pane.split("\n").find((l) => /write-up is completed/.test(l)) ?? "").slice(0, 80)
  );
  check(
    "esc.pane-context",
    "and carries the context a write-up needs",
    /911 status/.test(pane) && /Recent conversation/.test(pane)
  );
  // SELECTION IS `aria-current`, not `aria-selected` — a listbox option may not
  // contain a control, and this row's whole point is the link inside it.
  const current = await region
    .locator("li[data-escalation-state] button[aria-current]")
    .count();
  check("esc.selection", "exactly one row is marked current", current === 1, `${current} current`);

  check(
    "esc.pane-header",
    "the pane header does not call it open either",
    !/\d+[mhd] open/.test(pane.split("\n").slice(0, 3).join(" ")),
    pane.split("\n").slice(0, 3).join(" · ")
  );

  await page.screenshot({ path: `${OUT}/04-escalations.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 · THE REGION IS ABSENT WHEN EMPTY.
// ═══════════════════════════════════════════════════════════════════════════
//
// It is not a zone that must persist: the flags view is this surface's resting
// state, and a permanently empty band above it is furniture a reader learns to
// skip — the worst habit to build above the one region that matters.
{
  const { context, page } = await open("no-escalations", { scenario: "quiet-day" });
  const count = await page.locator('[data-anno-ref="escalation-region"]').count();
  check("esc.absent", "no region when there is nothing in it", count === 0);
  await context.close();
}


// ═══════════════════════════════════════════════════════════════════════════
// 11 · THE LOAD HIERARCHY, ON SCREEN (B4).
// ═══════════════════════════════════════════════════════════════════════════
//
// Five surfaces resolving in order over 1.2s. A person checking by eye sees a
// page appear; a reordering would look identical and would mean a reader reading
// evidence before they know how much there is.
{
  const { context, page } = await open("loading", { load: "loading" });
  /* DRIVEN THROUGH THE DEV BAR so the REPLAY is exercised too — the stage stamp
     survived a finished run on Tasks and made the second selection a no-op
     (found in arch-A's A2 pass). This surface is built with the fix; this is the
     check that it stayed fixed. */
  const load = page.locator("select").nth(1);
  const seen = [];
  for (const run of [1, 2]) {
    await load.selectOption("ready");
    await page.waitForTimeout(200);
    await load.selectOption("loading");
    const sawSkeleton = await page
      .locator("[class*=animate-pulse]")
      .first()
      .waitFor({ state: "visible", timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    seen.push(sawSkeleton);
    if (run === 1 && sawSkeleton) await page.screenshot({ path: `${OUT}/05-loading.png` });
    await page.waitForTimeout(1600);
  }
  check("load.replays", "Loading replays on every selection, not just the first", seen.every(Boolean), seen.join(", "));

  // THE HEADERS RESOLVE BEFORE THE ROWS, and while they are pending the band
  // renders its NAME with the count withheld — a placeholder count would be a
  // number that is wrong for 240ms.
  await load.selectOption("ready");
  await page.waitForTimeout(300);
  await load.selectOption("loading");
  await page.waitForTimeout(520);
  const midway = await page.locator("main").innerText();
  check(
    "load.headers-first",
    "a band names itself before it can count",
    /Imminent/.test(midway),
    midway.replace(/\s+/g, " ").slice(0, 70)
  );
  await load.selectOption("ready");
  await page.waitForTimeout(400);
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 · ERROR, WITH RETRY — AND PARTIAL, WHICH MEANS SOMETHING HERE.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { context, page } = await open("error", { load: "error" });
  const t = await textOf(page);
  check("state.error", "the list errors with a retry", /didn’t load — try again\./.test(t) && /Retry/.test(t));
  check(
    "state.error-escalations",
    "an escalation outage is not reported as calm",
    /can['\u2019]t say whether any\s+are open/.test(t),
    (t.split("\n").find((l) => /Escalations couldn/.test(l)) ?? "").slice(0, 80)
  );
  await page.screenshot({ path: `${OUT}/06-error.png` });
  await page.getByRole("button", { name: /^Retry$/ }).first().click();
  await page.waitForTimeout(500);
  check("state.retry", "retry restores the list", /Imminent — /.test(await textOf(page)));
  await context.close();
}
{
  const { context, page } = await open("partial", { load: "partial" });
  const t = await textOf(page);
  /* PARTIAL SPLITS BY SYSTEM HERE, NOT BY DOMAIN — the escalation service and
     the transcript are not the flag pipeline. On Tasks the per-domain split
     renders identically to Ready (gap row 360); this is the version that can
     actually be shown. */
  check(
    "state.partial",
    "the flags load while the escalation service and the transcript do not",
    /Imminent — /.test(t) &&
      /can['\u2019]t say whether any\s+are open/.test(t) &&
      /Couldn['\u2019]t load the conversation/.test(t),
    /* THE APOSTROPHE IS NOT COSMETIC HERE. The codebase mixes `&apos;` (U+0027)
       and a typographic U+2019, and three checks failed against copy that was on
       screen and correct because the probe pinned the wrong one. */
    /Couldn['\u2019]t load the conversation/.test(t) ? "excerpt errored" : "excerpt healthy"
  );
  await page.screenshot({ path: `${OUT}/07-partial.png` });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 13 · THE EMPTY FLAGS VIEW READS PLAINLY.
// ═══════════════════════════════════════════════════════════════════════════
//
// No celebration. An empty vigilance queue means nobody has written anything
// worth reading, which is neither an achievement nor a problem.
{
  const { context, page } = await open("empty", { scenario: "quiet-day" });
  for (let i = 0; i < 4; i += 1) {
    if (!(await page.getByRole("treeitem").count())) break;
    await page.getByRole("treeitem").first().click();
    await page.waitForTimeout(200);
    await page.keyboard.press("y");
    await page.waitForTimeout(500);
  }
  const t = await textOf(page);
  check("empty.plain", "the empty flags view states a fact", /No flags in review right now\./.test(t), t.replace(/\s+/g, " ").slice(0, 90));
  check(
    "empty.no-celebration",
    "and does not congratulate anyone",
    !/(nice work|great|well done|all done|!)/i.test(t)
  );
  await page.screenshot({ path: `${OUT}/08-empty.png` });
  await context.close();
}


// ═══════════════════════════════════════════════════════════════════════════
// 14 · A CLEARED TIER REPORTS THE CLEARANCE.
// ═══════════════════════════════════════════════════════════════════════════
//
// The band stays for a beat, its rows compress, and the header says what
// happened. Vanishing reads as a glitch and throws away the one piece of
// information the moment contains.
//
// `active-escalation` HOLDS ONE FLAG PER TIER, which is the only fixture where a
// band can be emptied without clearing the surface. quiet-day was tried first and
// is the wrong shape: its two flags belong to ONE teen, so resolving the clinical
// one does not clear the Clinical review band — the teen row MOVES to Routine
// review, which is decision (a) working correctly and not a retirement at all.
{
  const { context, page } = await open("retire", { scenario: "active-escalation" });
  const bandsBefore = await page
    .getByRole("group")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")).filter((l) => l && / — \d+$/.test(l))
    );
  check("retire.setup", "three tiers, one flag each", bandsBefore.length === 3, bandsBefore.join(" | "));

  await page.getByRole("treeitem").first().click();
  await page.waitForTimeout(250);
  await page.keyboard.press("y");
  await page.waitForTimeout(220);

  const during = await textOf(page);
  check(
    "retire.reports",
    "the emptied tier says it cleared rather than vanishing",
    /—\s*cleared/.test(during),
    (during.split("\n").find((l) => /cleared/.test(l)) ?? "").slice(0, 50)
  );
  check(
    "retire.others-stay",
    "the other tiers are untouched",
    /Clinical review/.test(during) && /Routine review/.test(during)
  );
  await page.screenshot({ path: `${OUT}/09-retiring.png` });
  await context.close();
}


await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, rows }, null, 2));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
