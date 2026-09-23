// THE THREE RETIRED ROUTES' MAPPING (supervisor IA restructure, Phase 1)
//
// WHY THIS IS TESTED RATHER THAN CLICKED. Every one of these links exists
// somewhere today — in the shift digest, in a bookmark, in somebody's message —
// and a wrong mapping lands a supervisor on the right page with the wrong queue,
// which is indistinguishable from the queue having emptied.
//
// AND WHY IT IS NOT ENOUGH ON ITS OWN. The previous restructure shipped a
// mapping whose unit test passed while the destination was reachable from
// nowhere: the page accepted the param and ignored it. A URL assertion cannot
// tell a live destination from a dead one, so the phase's probe OPENS each one.
// The two catch different failures.

import { describe, expect, it } from "vitest";
import { DESTINATION_ORDER, DESTINATION_TYPES, destinationOf } from "@/lib/ia/destinations";
import { TODAY_PATH, retiredRouteTarget } from "@/lib/ia/retired-routes";
import type { TaskType } from "@/lib/tasks/types";

describe("the destination map", () => {
  it("assigns every task type to exactly one destination", () => {
    const all: TaskType[] = [
      "activeEscalation",
      "escalationDocumentation",
      "imminentFlagReview",
      "clinicalFlagReview",
      "routineFlagReview",
      "intakeBillingReview",
      "monthlyReReview",
    ];
    for (const t of all) {
      const holders = DESTINATION_ORDER.filter((d) => DESTINATION_TYPES[d].includes(t));
      // A type in two destinations would be counted twice on the badges; a type
      // in none would be work with no way in.
      expect(holders.length, t).toBe(1);
      expect(destinationOf(t)).toBe(holders[0]);
    }
  });

  it("puts all three flag tiers in ONE destination, which is the whole point", () => {
    expect(destinationOf("imminentFlagReview")).toBe("risk-flags");
    expect(destinationOf("clinicalFlagReview")).toBe("risk-flags");
    expect(destinationOf("routineFlagReview")).toBe("risk-flags");
  });

  it("gives the two non-task destinations no types rather than an empty promise", () => {
    expect(DESTINATION_TYPES["mentor-practice"]).toEqual([]);
    expect(DESTINATION_TYPES.coverage).toEqual([]);
  });
});

describe("the retired routes", () => {
  it("sends Home to Today, which is what it was for", () => {
    expect(retiredRouteTarget("home")).toBe(TODAY_PATH);
    expect(TODAY_PATH).toBe("/app/today");
  });

  it("falls back per surface, and the monitoring fallback is the lossy one", () => {
    /* Tasks was billing plus the escalation obligations; Care Reviews is the
       larger half. Monitoring held every flag tier AND coverage AND the
       escalation region, and no destination means all of that — so the loss is
       asserted here rather than left to be noticed. */
    expect(retiredRouteTarget("tasks")).toBe("/app/care-reviews");
    expect(retiredRouteTarget("monitoring")).toBe("/app/risk-flags");
  });

  it("maps every band the old digest could send", () => {
    const cases: [string, string][] = [
      ["imminentFlagReview", "/app/risk-flags"],
      ["clinicalFlagReview", "/app/risk-flags"],
      ["routineFlagReview", "/app/risk-flags"],
      ["intakeBillingReview", "/app/care-reviews"],
      ["monthlyReReview", "/app/care-reviews"],
      ["activeEscalation", "/app/escalations"],
      ["escalationDocumentation", "/app/escalations"],
    ];
    for (const [band, to] of cases) {
      expect(retiredRouteTarget("monitoring", { band }), band).toBe(to);
    }
  });

  it("maps the retired four-queue ids a bookmark may still carry", () => {
    for (const q of ["imminent", "clinical", "routine", "all"]) {
      expect(retiredRouteTarget("home", { queue: q }), q).toBe("/app/risk-flags");
    }
    expect(retiredRouteTarget("home", { queue: "billing" })).toBe("/app/care-reviews");
  });

  it("sends the escalation region to Escalations", () => {
    expect(retiredRouteTarget("monitoring", { region: "escalations" })).toBe(
      "/app/escalations"
    );
  });

  it("sends an escalation ID to the RECORD's own route, not to a queue", () => {
    // An id is a request for one object. `/app/escalation/{id}` is untouched by
    // this pass and wins over every other param.
    for (const from of ["home", "tasks", "monitoring"] as const) {
      expect(retiredRouteTarget(from, { escalation: "esc-naomi-live" })).toBe(
        "/app/escalation/esc-naomi-live"
      );
    }
  });

  it("encodes an id rather than pasting it into the path", () => {
    expect(retiredRouteTarget("monitoring", { escalation: "esc/one two" })).toBe(
      "/app/escalation/esc%2Fone%20two"
    );
  });

  it("prefers the record over a band when a link carries both", () => {
    expect(
      retiredRouteTarget("monitoring", {
        band: "imminentFlagReview",
        escalation: "esc-1",
      })
    ).toBe("/app/escalation/esc-1");
  });

  it("ignores an unknown band rather than dropping the reader somewhere odd", () => {
    expect(retiredRouteTarget("tasks", { band: "somethingElse" })).toBe(
      "/app/care-reviews"
    );
    expect(retiredRouteTarget("tasks", { band: null, queue: null })).toBe(
      "/app/care-reviews"
    );
  });
});
