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
import { MONITORING_PATH, TODAY_PATH, monitoringLegacyTarget, retiredRouteTarget } from "@/lib/ia/retired-routes";
import type { TaskType } from "@/lib/tasks/types";

describe("the destination map", () => {
  it("assigns every task type to exactly one destination", () => {
    const all: TaskType[] = [
      "activeEscalation",
      "escalationDocumentation",
      "riskFlagReview",
      "riskFlagReview",
      "riskFlagReview",
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
    expect(destinationOf("riskFlagReview")).toBe("risk-flags");
    expect(destinationOf("riskFlagReview")).toBe("risk-flags");
    expect(destinationOf("riskFlagReview")).toBe("risk-flags");
  });

  it("holds exactly the three destinations that own work", () => {
    /* ═══ THE TWO EMPTY ONES ARE GONE (addendum §2.1, §2.2) ═══
       This asserted that `mentor-practice` and `coverage` mapped to `[]` —
       "no types rather than an empty promise". Both destinations are removed,
       so the honest assertion is that nothing in this table maps to nothing:
       a destination with no task types is one this file cannot answer
       questions about, and the reason the two were tolerable was that they
       were temporary. */
    for (const [id, types] of Object.entries(DESTINATION_TYPES)) {
      expect(types.length, `${id} owns no task types`).toBeGreaterThan(0);
    }
  });
});

describe("the retired routes", () => {
  it("sends Home to Today, which is what it was for", () => {
    expect(retiredRouteTarget("home")).toBe(TODAY_PATH);
    expect(TODAY_PATH).toBe("/app/today");
  });

  /* RETARGETED (proto/monitoring-merge): /app/monitoring is a destination
     again and Escalations / Risk Flags folded into it, so every landing that
     was one of those is Monitoring, in ONE hop — and a record id is carried
     as a param rather than sent round /app/escalation/{id}. The old
     "monitoring" surface is gone from the union; its cases moved to the
     surfaces that still retire. */
  it("falls back per surface", () => {
    expect(retiredRouteTarget("tasks")).toBe("/app/care-reviews");
    expect(retiredRouteTarget("coverage")).toBe("/app/chat");
    expect(retiredRouteTarget("mentor-practice")).toBe(MONITORING_PATH);
  });

  it("sends the folded dashboards to Monitoring, carrying a record id", () => {
    expect(retiredRouteTarget("escalations")).toBe(MONITORING_PATH);
    expect(retiredRouteTarget("risk-flags")).toBe(MONITORING_PATH);
    expect(retiredRouteTarget("escalations", { escalation: "esc-1" })).toBe("/app/monitoring?escalation=esc-1");
    expect(retiredRouteTarget("risk-flags", { flag: "flag-1" })).toBe("/app/monitoring?flag=flag-1");
  });

  it("maps every band the old digest could send", () => {
    const cases: [string, string][] = [
      ["riskFlagReview", MONITORING_PATH],
      ["intakeBillingReview", "/app/care-reviews"],
      ["monthlyReReview", "/app/care-reviews"],
      ["activeEscalation", MONITORING_PATH],
      ["escalationDocumentation", MONITORING_PATH],
    ];
    for (const [band, to] of cases) {
      expect(retiredRouteTarget("home", { band }), band).toBe(to);
    }
  });

  it("maps the retired four-queue ids a bookmark may still carry", () => {
    for (const q of ["imminent", "clinical", "routine", "all"]) {
      expect(retiredRouteTarget("home", { queue: q }), q).toBe(MONITORING_PATH);
    }
    expect(retiredRouteTarget("home", { queue: "billing" })).toBe("/app/care-reviews");
  });

  it("sends the escalation region to Monitoring", () => {
    expect(retiredRouteTarget("home", { region: "escalations" })).toBe(MONITORING_PATH);
  });

  it("sends an escalation ID to Monitoring in one hop, carried as a param", () => {
    for (const from of ["home", "tasks", "escalations"] as const) {
      expect(retiredRouteTarget(from, { escalation: "esc-naomi-live" })).toBe(
        "/app/monitoring?escalation=esc-naomi-live"
      );
    }
  });

  it("encodes an id rather than pasting it into the URL", () => {
    expect(retiredRouteTarget("home", { escalation: "esc/one two" })).toBe(
      "/app/monitoring?escalation=esc%2Fone%20two"
    );
  });

  it("prefers the record over a band when a link carries both", () => {
    expect(
      retiredRouteTarget("home", {
        band: "intakeBillingReview",
        escalation: "esc-1",
      })
    ).toBe("/app/monitoring?escalation=esc-1");
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

describe("Monitoring's own old links (proto/monitoring-merge)", () => {
  it("sends a billing band or the billing queue on to Care Reviews", () => {
    expect(monitoringLegacyTarget({ band: "intakeBillingReview" })).toBe("/app/care-reviews");
    expect(monitoringLegacyTarget({ band: "monthlyReReview" })).toBe("/app/care-reviews");
    expect(monitoringLegacyTarget({ queue: "billing" })).toBe("/app/care-reviews");
  });

  it("keeps everything that is Monitoring's own on the page", () => {
    expect(monitoringLegacyTarget({})).toBeNull();
    expect(monitoringLegacyTarget({ band: "riskFlagReview" })).toBeNull();
    expect(monitoringLegacyTarget({ band: "activeEscalation" })).toBeNull();
    expect(monitoringLegacyTarget({ queue: "imminent" })).toBeNull();
    expect(monitoringLegacyTarget({ band: "nonsense" })).toBeNull();
  });
});
