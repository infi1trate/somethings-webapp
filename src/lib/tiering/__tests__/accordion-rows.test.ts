import { describe, expect, it } from "vitest";
import type { EscalationState } from "@/lib/chat/types";
import { firstUntouched, noteComplete, noteDoneAt, noteProgress, noteRows, outcomeNeedsReview, rowDone, rowSummary } from "@/lib/tiering/note-rows";


/* The intake's rules moved to the deck (pack v8.0) — `deck.test.ts`. */

const base = (patch: Partial<EscalationState> = {}): EscalationState => ({ id: "e1", openedAt: 0, resolvedAt: null, confirmedTier: 1, ...patch }) as EscalationState;
const fullNote = {
  subtype: "self_harm",
  safetyPlan: { status: "updated", usage: "" },
  resources: { shared: false, list: "" },
  referral: { made: true, list: ["pcp"] },
  contact: { engaged: false, details: "" },
  services: { contacted: false, which: [] },
};

describe("the crisis note as rows (pack v6.1, B)", () => {
  it("is seven rows at Tier 1 and six at Tier 2 — Emergency never renders at Tier 2", () => {
    expect(noteRows(1)).toEqual(["subtype", "safety-plan", "resources", "referral", "emergency", "outcome", "debrief"]);
    expect(noteRows(2)).toEqual(["subtype", "safety-plan", "resources", "referral", "outcome", "debrief"]);
  });

  it("advances to the first untouched row top-down after an out-of-order save", () => {
    const e = base({ crisisNote: { referral: { made: true, list: ["pcp"] } } });
    expect(firstUntouched(e, 1)).toBe("subtype");
    expect(noteProgress(e, 1)).toEqual({ done: 1, total: 7 });
  });

  it("counts Outcome and Debrief, and gates Close on all of them", () => {
    const e = base({ crisisNote: fullNote, outcome: { id: "referred", autoTagged: true, basis: "referred", debrief: "", debriefIsDraft: true, plan: "", additional: "", chosenAt: 5, savedAt: null } });
    expect(rowDone(e, "outcome")).toBe(true);
    expect(rowDone(e, "debrief")).toBe(false);
    expect(noteComplete(e, 1)).toBe(false);
    const done = base({ ...e, outcome: { ...e.outcome!, debrief: "d", plan: "p", savedAt: 9 } });
    expect(noteComplete(done, 1)).toBe(true);
    expect(noteDoneAt(done, 1)).toBe(9);
  });

  it("never counts a tier-update or reviewed close as a chosen outcome", () => {
    expect(rowDone(base({ outcome: { id: "tier_update", autoTagged: false, debrief: "x", debriefIsDraft: false, plan: "", additional: "", savedAt: 1 } }), "outcome")).toBe(false);
  });

  it("marks the outcome for review when an upstream answer changes — and only then", () => {
    const e = base({ crisisNote: fullNote, outcome: { id: "referred", autoTagged: true, basis: "referred", debrief: "", debriefIsDraft: true, plan: "", additional: "", savedAt: null } });
    expect(outcomeNeedsReview(e)).toBe(false);
    const amended = base({ ...e, crisisNote: { ...fullNote, services: { contacted: true, which: ["mobile_crisis"] } } });
    expect(outcomeNeedsReview(amended)).toBe(true);
    // A record from before `basis` existed is never flagged.
    expect(outcomeNeedsReview(base({ ...amended, outcome: { ...amended.outcome!, basis: undefined } }))).toBe(false);
  });

  it("summarises a complete row in the chart's words, and an untouched one as nothing", () => {
    const e = base({ crisisNote: fullNote });
    expect(rowSummary(e, "emergency")).toBe("Contact not engaged · No services");
    expect(rowSummary(e, "resources")).toBe("None shared");
    expect(rowSummary(base(), "subtype")).toBe("");
  });
});
