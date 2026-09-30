// ═══════════════════════════════════════════════════════════════════════════
// THE CARE REVIEWS FIXTURES PRODUCE THE STATES THEY ARE NAMED FOR (rework §9)
//
// A fixture is a claim about a state, and the claim is the part that rots: the
// name stays while a seed change quietly stops producing it. §9's three
// fixtures are each named for something a reader will go there to see, so each
// one is asserted here — and every assertion is on the PROPERTY the name
// promises rather than on a count that happens to be right today.
//
// THIS FILE ALREADY EARNED ITS KEEP. `care-mixed-cycles` shipped with two
// seeds I claimed were disjoint and were not; `seed.test.ts` caught that one.
// What it could not catch is a fixture that is internally consistent and still
// does not demonstrate what it is for — a "both cycles" fixture holding one
// cycle, an "overdue present" fixture where everything is overdue. That is
// what these are.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TASK_SCENARIOS, tasksScenario } from "@/lib/tasks/seed";
import { isOverdue, overdueCount } from "@/lib/tasks/care-overdue";
import { cycleFor } from "@/lib/tasks/review-cycle";
import type { TaskItem } from "@/lib/tasks/types";

const NOW = Date.UTC(2026, 8, 29, 17, 0, 0);

const care = (items: TaskItem[]) => items.filter((i) => i.domain === "billing");
const open = (items: TaskItem[]) => items.filter((i) => i.status === "open");

describe("the three fixtures are registered under the names §9 asked for", () => {
  it("and each one states what it produces", () => {
    const ids = TASK_SCENARIOS.map((s) => s.id);
    for (const id of ["care-open-empty", "care-overdue-present", "care-mixed-cycles"]) {
      expect(ids, `${id} is registered`).toContain(id);
      const sc = TASK_SCENARIOS.find((s) => s.id === id)!;
      expect(sc.description.length, `${id} has a description`).toBeGreaterThan(20);
    }
  });
});

describe("care-open-empty", () => {
  const items = tasksScenario("care-open-empty", NOW);
  /* THE POINT OF THE FIXTURE. §5.1's `open` empty state is unreachable on any
     other scenario without working the queue by hand. */
  it("has no open care review", () => {
    expect(open(care(items))).toHaveLength(0);
  });
  /* RESOLVED, NOT ABSENT — the distinction the fixture's note turns on: an
     empty queue whose items never existed is a cold start, and §5.1's line is
     about the resting state of finished work. */
  it("but it does have care reviews, all resolved", () => {
    const c = care(items);
    expect(c.length).toBeGreaterThan(0);
    expect(c.every((i) => i.status === "resolved")).toBe(true);
  });
  /* ONE DESTINATION AT REST, not a console with nothing in it. */
  it("and another destination still has open work", () => {
    expect(open(items).length).toBeGreaterThan(0);
    expect(open(items).every((i) => i.domain !== "billing")).toBe(true);
  });
});

describe("care-overdue-present", () => {
  const items = tasksScenario("care-overdue-present", NOW);
  const c = care(items);
  /* ═══ MIXED, WHICH IS THE WHOLE VALUE OF IT ═══
     A fixture where every open review is overdue cannot tell a correct count
     from one that returns the list length. Both bounds are asserted, so
     narrowing the fixture to all-overdue fails here. */
  it("has some open reviews overdue and some not", () => {
    const o = open(c);
    const n = overdueCount(o, NOW);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(o.length);
  });
  /* §2's SECOND RULE: "a submitted review that took three days is not overdue,
     it is done". The fixture carries a four-day RESOLVED review for exactly
     this assertion — it is past the threshold on age and must not count. */
  it("and a resolved review older than the threshold that does not count", () => {
    const old = c.filter(
      (i) => i.status === "resolved" && NOW - i.openedAt > 3 * 24 * 60 * 60 * 1000
    );
    expect(old.length).toBeGreaterThan(0);
    for (const i of old) expect(isOverdue(i, NOW)).toBe(false);
  });
});

describe("care-mixed-cycles", () => {
  const items = tasksScenario("care-mixed-cycles", NOW);
  const o = open(care(items));
  /* §3's `Cycle` sort has nothing to demonstrate on one cadence. */
  it("holds both cycles, and neither is a token presence", () => {
    const first = o.filter((i) => cycleFor(i.taskType) === "first").length;
    const recurring = o.filter((i) => cycleFor(i.taskType) === "recurring").length;
    expect(first).toBeGreaterThan(2);
    expect(recurring).toBeGreaterThan(2);
  });
  /* ═══ AND THEY ARE NOT ALREADY GROUPED IN THE DEFAULT ORDER ═══
     The default order is by age, and a fixture whose cadences happen to be
     age-sorted would pass a `Cycle` sort test against an implementation that
     does nothing. So the default order must INTERLEAVE them: read the open set
     oldest-first and the cadence has to change more than once. */
  it("and the default order interleaves them rather than arriving sorted", () => {
    const byAge = [...o].sort((a, b) => a.openedAt - b.openedAt);
    let changes = 0;
    for (let i = 1; i < byAge.length; i++) {
      if (cycleFor(byAge[i].taskType) !== cycleFor(byAge[i - 1].taskType)) changes++;
    }
    expect(changes).toBeGreaterThan(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SWITCHING THE FIXTURE DROPS THE TRACE THAT WAS KEYED TO THE OLD ONE
//
// A SOURCE ASSERTION, AND IT SAYS SO. The store is zustand-with-persist and has
// no unit coverage; asserting the behaviour would mean standing one up. What
// this pins is the property that matters and that a reader can break in one
// line — that `setTasksScenarioId` clears both care traces — using the same
// instrument `care-overdue.test.ts` uses to pin an ABSENCE in `sla.ts`.
//
// WHY IT NEEDS PINNING. `viewedCareReviews` and `submittedCareReviews` hold
// ENTRY IDS (`task-3`, a coalesce group's id), and every task scenario rebuilds
// those ids from index 1. Without the clear, switching from a 19-row fixture to
// a 3-row one leaves rows marked read that nobody opened and a Submitted tab
// listing records that no longer exist — and it is silent, because the ids
// resolve.
// IT IS ALSO WHAT MAKES TWO OF §9's SIX STATES REACHABLE without a fixture; the
// note under `TASK_SCENARIOS` says which and why.

describe("setTasksScenarioId drops the care traces", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/onboarding/store.ts"), "utf8");
  /* The setter's body, from its name to the closing of its `set({...})`. Read
     narrowly so a clear somewhere ELSE in the store cannot satisfy this. */
  /* ═══ THE WINDOW WAS 400 CHARS AND THAT WAS TOO TIGHT ═══
     bar-02 added a comment inside this setter explaining that `scenarioRecents`
     must NOT be cleared here — it briefly was, which made the recents row never
     populate. The comment pushed the block past 400 and these two assertions
     went red on the WINDOW, not on the behaviour: the setter still clears both
     traces, checked by hand before touching this.
     WIDENED RATHER THAN LOOSENED. The regex still ends at the first `}),` so it
     cannot run past the setter into a neighbour and pass on somebody else's
     code — which is the failure a `[\s\S]*` would have introduced. */
  const body = src.match(/setTasksScenarioId:\s*\(id\)\s*=>[\s\S]{0,2000}?\}\),/)?.[0] ?? "";
  it("the setter exists and was found", () => {
    expect(body).toContain("tasksScenarioId: id");
  });
  it("and it resets both traces in the same write", () => {
    expect(body).toContain("viewedCareReviews: []");
    expect(body).toContain("submittedCareReviews: []");
  });
});
