// MONITORING'S LOAD HIERARCHY — five surfaces, in the order a supervisor needs
// them rather than the order the data would arrive in.
//
// The value of asserting a sequence like this is that it is unobservable: the
// whole thing resolves in 1.2 seconds and a person checking by eye sees a page
// appear. A reordering — the pane before the headers, say — would look fine and
// would mean a reader reading evidence before they know how much there is.

import { describe, expect, it } from "vitest";
import {
  MONITORING_LOAD_STAGES,
  monitoringLoadPlanFor,
} from "@/lib/tasks/load-plan";

const ORDER = ["escalations", "headers", "list", "pane", "excerpt"] as const;

describe("Monitoring's load hierarchy", () => {
  it("resolves in the order the reader needs", () => {
    // At each stage exactly the first N surfaces are ready. Asserted as a
    // sequence rather than per-surface so a REORDERING fails, not just a
    // missing one.
    for (let stage = 0; stage <= MONITORING_LOAD_STAGES; stage += 1) {
      const plan = monitoringLoadPlanFor("loading", stage);
      const ready = ORDER.map((k) => plan[k] === "ready");
      expect(ready, `stage ${stage}`).toEqual(
        ORDER.map((_, i) => i < stage)
      );
    }
  });

  it("has a stage count that matches the surfaces it names", () => {
    expect(MONITORING_LOAD_STAGES).toBe(ORDER.length);
  });

  it("is entirely ready when it is ready", () => {
    const plan = monitoringLoadPlanFor("ready", 0);
    expect(ORDER.every((k) => plan[k] === "ready")).toBe(true);
  });

  it("takes the work and not the chrome on a total outage", () => {
    const plan = monitoringLoadPlanFor("error", 0);
    expect(ORDER.every((k) => plan[k] === "error")).toBe(true);
  });

  // ═══ PARTIAL SPLITS BY SYSTEM, NOT BY DOMAIN ═══
  // Tasks' partial failure is per-domain and, since arch-A scoped it to billing,
  // renders exactly like Ready there (gap row 360). Monitoring's domains are all
  // flag domains, so the same split would be inert here too. Splitting by SERVICE
  // — escalations and transcripts are not the flag pipeline — is both realistic
  // and the only version this surface can actually show.
  it("fails the escalation service and the transcript, not the flags", () => {
    const plan = monitoringLoadPlanFor("partial", 0);
    expect(plan.escalations).toBe("error");
    expect(plan.excerpt).toBe("error");
    expect(plan.headers).toBe("ready");
    expect(plan.list).toBe("ready");
    // THE PANE STAYS HEALTHY, which is the point of the excerpt having its own
    // axis: a supervisor who cannot see what was said can still act on the flag.
    expect(plan.pane).toBe("ready");
  });

  it("ignores the stage unless it is loading", () => {
    // The stage describes a sequence only `loading` has.
    for (const state of ["ready", "error", "partial"] as const) {
      expect(monitoringLoadPlanFor(state, 0)).toEqual(
        monitoringLoadPlanFor(state, MONITORING_LOAD_STAGES)
      );
    }
  });
});
