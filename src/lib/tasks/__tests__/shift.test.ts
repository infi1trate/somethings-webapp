// THE SHIFT — what is left of it, and what its tests used to guard.
//
// ═══ THE LADDER AND THE DIGEST ARE GONE, AND SO ARE THEIR SUITES ═══
//
// This file had four suites: the ladder (`ladderStageFor`, `ladderTargetFor`),
// the stage lines (`shiftStagesFor`), the shift-start digest (`digestLinesFor`),
// and the facts. The first three tested Home's four-stage sequence surface,
// which Phase 3 replaced with Today's mirror and Phase 4 deleted.
//
// THEIR SUBJECT WAS DELETED, NOT THEIR ASSERTIONS WEAKENED — and two of those
// assertions were inherited rather than dropped, because the claims outlived the
// functions:
//
//  · "puts a breached imminent flag above billing past its SLA" and "puts
//    billing above clinical, whatever the counts" were the ladder's priority
//    rules over the flag TIERS. What survives of them is
//    `directiveCardId`'s ordering, tested in `lib/home/__tests__/today.test.ts`
//    — including the case those two together implied and neither stated: a
//    missed published deadline outranks an escalation still inside its window.
//  · "gives every other stage exactly one destination, and it is a live one"
//    was itself a Phase 2 retarget of a route regex. Today's version is stronger
//    and lives in `today-mirror.mjs`, which opens each link rather than matching
//    it.
//  · "reserves the breach tone for an actual SLA breach" is now four assertions
//    in `today.test.ts`, one per destination, including the two that cannot
//    breach at all.
//
// WHAT REMAINS HERE is the pair of claims about `shiftFactsFor` itself, and both
// are load-bearing: it must agree with the destination it feeds, and it must
// never take a date range.

import { describe, expect, it } from "vitest";
import {
  SHIFT_GAP_MS,
  isNewShift,
  shiftFactsFor,
} from "@/lib/tasks/shift";
import { tasksScenario } from "@/lib/tasks/seed";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

describe("the facts come from the surfaces' own functions", () => {
  it("agrees with Care Reviews about how many reviews are open", () => {
    // A Today that disagreed with Care Reviews about this number would be worse
    // than a Today with no counts at all. `today-mirror.mjs` asserts the same
    // thing through the DOM; this asserts it about the function, which is the
    // half a browser probe cannot reach for inputs the fixtures do not produce.
    const items = tasksScenario("typical-shift", NOW);
    const f = shiftFactsFor(items, NOW);
    const open = items.filter(
      (i) => i.domain === "billing" && i.status !== "resolved"
    ).length;
    // THE INPUT IS ASSERTED, so this cannot pass on a scenario with no billing.
    expect(open).toBeGreaterThan(0);
    expect(f.billing.open).toBe(open);
  });

  it("no longer reports anything about flags", () => {
    // ═══ WHAT THIS REPLACED ═══
    // It asserted `f.imminentOpen` equalled the count of `imminentFlagReview`
    // items. That field and that task type were the per-flag tier taxonomy.
    // The claim now is that `ShiftFacts` cannot carry a flag fact at all, which
    // is what makes Risk Flags the only thing that counts flags.
    const f = shiftFactsFor(tasksScenario("heavy-caseload", NOW), NOW);
    expect(Object.keys(f).sort()).toEqual(["billing", "closedToday"]);
    const keys = JSON.stringify(Object.keys(f));
    for (const w of ["imminent", "clinical", "routine", "flag"]) {
      expect(keys.toLowerCase()).not.toContain(w);
    }
  });

  it("computes nothing over a date range", () => {
    // THE LINE THIS SURFACE MUST NOT CROSS. Every fact here is about NOW or
    // about today; a function taking a range is a trend, and a trend of whether
    // a supervisor kept pace is a performance surface.
    expect(shiftFactsFor.length).toBe(2); // (items, now) — no third argument
  });
});

describe("the once-per-shift gate", () => {
  it("opens after eight hours, and counts never as a gap", () => {
    expect(isNewShift(NOW - SHIFT_GAP_MS + 1, NOW)).toBe(false);
    expect(isNewShift(NOW - SHIFT_GAP_MS, NOW)).toBe(true);
    // Never seen: the epoch is more than a shift ago, so a first visit counts.
    expect(isNewShift(0, NOW)).toBe(true);
  });

  it("is a shift, not a day", () => {
    // Eight hours rather than a calendar day, so somebody working an evening
    // into a morning meets the panel once rather than twice.
    expect(SHIFT_GAP_MS).toBe(8 * HOUR);
  });
});
