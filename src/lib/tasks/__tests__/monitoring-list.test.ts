/* ═══ TRIMMED TWICE, AND THIS IS THE SECOND TIME ═══
 *
 *  arch-mon Phase 1 deleted the suites for the hybrid unit of review, the
 *  teen-group ordering and `monitoringEntriesFor` — their subject was the tier
 *  grouping, which that phase removed. What it left was the COMPOSITION LINE:
 *  "1 clinical · 3 routine" on a coalesced row, worst tier first.
 *
 *  PHASE 4 DELETED THAT TOO, and for a reason worth recording rather than just
 *  dropping the file. With one flag task type a coalesced flag group holds one
 *  type by construction, so `compositionLabel`'s own `counts.size < 2` guard
 *  returned null on every call it could receive. A function that can only return
 *  null is worse than an absent one: it reads as a feature somebody switched off.
 *
 *  THE OLD TESTS ARE WORTH READING ONCE before they go, because one of them
 *  records a real mutation-testing lesson. The lopsided fixture — one clinical
 *  against three routine — existed because the original "2 clinical · 1 routine"
 *  had tier order and count order AGREEING, so a mutant that sorted by count
 *  produced the same string and ran green. That habit outlives the function.
 *
 *  WHAT IS LEFT is `coalescesByTeen`, which `row-emphasis.ts` keys its whole
 *  derivation on — so it is not a leftover, it is the thing that decides whether
 *  a row leads with a person or a clock.
 */

import { describe, expect, it } from "vitest";
import { coalescesByTeen } from "@/lib/tasks/monitoring-list";
import { DOMAIN_OF_TYPE, type TaskType } from "@/lib/tasks/types";
import { rowEmphasisFor } from "@/lib/tasks/row-emphasis";

const TYPES = Object.keys(DOMAIN_OF_TYPE) as TaskType[];

describe("what coalesces by teen", () => {
  it("is the flag type, and only the flag type", () => {
    // THE INPUT IS ASSERTED: without this the loop below would pass on an empty
    // type table, which is how a collapsed union reads as a clean bill of health.
    expect(TYPES.length).toBeGreaterThan(3);
    expect(TYPES.filter(coalescesByTeen)).toEqual(["riskFlagReview"]);
  });

  it("no longer carves an exception out of the flag types", () => {
    // ═══ WHAT THIS REPLACED ═══
    // The set was {clinicalFlagReview, routineFlagReview} with the note
    // "Imminent is absent BY DESIGN": an imminent flag was individual work with
    // a clock; the other two accumulated into a picture of a teen. That
    // distinction WAS the severity tier. With one flag type there is one answer,
    // so the exception cannot be reintroduced without adding a type back.
    const flagTypes = TYPES.filter((t) => DOMAIN_OF_TYPE[t] === "riskFlag");
    expect(flagTypes).toHaveLength(1);
    expect(flagTypes.every(coalescesByTeen)).toBe(true);
  });

  it("is what decides whether a row leads with a person or a clock", () => {
    // arch-D's rule, and the reason this predicate is still exported: emphasis
    // follows obligation, derived rather than set per surface.
    expect(rowEmphasisFor("riskFlagReview")).toBe("person");
    for (const t of TYPES.filter((x) => !coalescesByTeen(x))) {
      expect(rowEmphasisFor(t), t).toBe("deadline");
    }
  });
});
