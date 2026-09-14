// THE LOAD PLAN — one dev value in, four surface states out.
//
// Worth a test rather than a click-through because the mapping's most important
// case is invisible unless you happen to have the right tab selected: under
// partial failure the pane errors on a risk-flag item and does NOT on a Billing
// one. Reproducing that by hand means remembering to check both.
import { describe, expect, it } from "vitest";
import {
  LOAD_STAGES,
  domainFailsUnderPartial,
  loadPlanFor,
} from "@/lib/tasks/load-plan";
import { TASK_DOMAINS } from "@/lib/tasks/types";

describe("loadPlanFor", () => {
  it("ready means everything ready", () => {
    expect(loadPlanFor("ready", LOAD_STAGES, "riskFlag")).toEqual({
      cards: "ready",
      list: "ready",
      pane: "ready",
      excerpt: "ready",
    });
  });

  it("error takes the list, pane and excerpt but LEAVES THE CARDS", () => {
    // A page with no tab row reads as broken rather than as a failed fetch, and
    // the counts are the one thing still worth showing during an outage.
    const p = loadPlanFor("error", LOAD_STAGES, "riskFlag");
    expect(p.cards).toBe("ready");
    expect([p.list, p.pane, p.excerpt]).toEqual(["error", "error", "error"]);
  });

  describe("the loading hierarchy resolves in order", () => {
    it("stage 0 has everything loading below the cards", () => {
      expect(loadPlanFor("loading", 0, "riskFlag")).toEqual({
        cards: "loading",
        list: "loading",
        pane: "loading",
        excerpt: "loading",
      });
    });

    it("resolves cards → list → pane → excerpt, one stage at a time", () => {
      const order = ["cards", "list", "pane", "excerpt"] as const;
      for (let stage = 1; stage <= LOAD_STAGES; stage++) {
        const p = loadPlanFor("loading", stage, "riskFlag");
        order.forEach((surface, i) => {
          // Surface i is ready once the stage has passed it, and not before —
          // which is what makes this a hierarchy rather than four spinners.
          expect(p[surface], `stage ${stage} / ${surface}`).toBe(
            i < stage ? "ready" : "loading"
          );
        });
      }
    });

    it("is fully resolved at the last stage", () => {
      const p = loadPlanFor("loading", LOAD_STAGES, "riskFlag");
      expect(Object.values(p).every((v) => v === "ready")).toBe(true);
    });
  });

  describe("partial failure", () => {
    it("fails the risk-flag domains and spares Billing", () => {
      expect(domainFailsUnderPartial("riskFlag")).toBe(true);
      expect(domainFailsUnderPartial("escalation")).toBe(true);
      expect(domainFailsUnderPartial("routineFlag")).toBe(true);
      expect(domainFailsUnderPartial("billing")).toBe(false);
    });

    it("covers every domain — a new one must be a decision, not an omission", () => {
      for (const d of TASK_DOMAINS) {
        expect(typeof domainFailsUnderPartial(d)).toBe("boolean");
      }
    });

    it("errors the pane ONLY when the selected item's domain failed", () => {
      const failed = loadPlanFor("partial", LOAD_STAGES, "riskFlag");
      expect(failed.list).toBe("error");
      expect(failed.pane).toBe("error");

      const healthy = loadPlanFor("partial", LOAD_STAGES, "billing");
      expect(healthy.list).toBe("ready");
      // THE POINT: a pane erroring beside a healthy Billing item would claim an
      // outage that did not touch it.
      expect(healthy.pane).toBe("ready");
    });

    it("fails the excerpt independently of the pane", () => {
      // The brief asks for this state to be reachable on its own: the
      // conversation service is not the task service, so a good Billing item can
      // have a transcript that will not load — and that is the only way to show
      // that an excerpt failure never blocks the resolve actions.
      const healthy = loadPlanFor("partial", LOAD_STAGES, "billing");
      expect(healthy.pane).toBe("ready");
      expect(healthy.excerpt).toBe("error");
    });

    it("leaves the cards readable, so the reader can see where to go instead", () => {
      for (const d of TASK_DOMAINS) {
        expect(loadPlanFor("partial", LOAD_STAGES, d).cards).toBe("ready");
      }
    });
  });

  it("ignores the stage unless the state is loading", () => {
    // The stage only describes a sequence that only `loading` has; reading it
    // elsewhere would make a resolved surface flicker on an unrelated change.
    for (const state of ["ready", "error", "partial"] as const) {
      expect(loadPlanFor(state, 0, "billing")).toEqual(
        loadPlanFor(state, LOAD_STAGES, "billing")
      );
    }
  });
});
