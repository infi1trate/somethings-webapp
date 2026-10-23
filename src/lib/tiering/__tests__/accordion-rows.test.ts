import { describe, expect, it } from "vitest";
import type { EscalationState } from "@/lib/chat/types";
import { ASSESSMENT_QUESTIONS, riskLevel } from "@/lib/tiering/escalation";
import { afterAnswer, assessmentComplete, firstOpenQuestion, questionComplete, questionOf } from "@/lib/tiering/assessment-rows";
import { firstUntouched, noteComplete, noteDoneAt, noteProgress, noteRows, outcomeNeedsReview, rowDone, rowSummary } from "@/lib/tiering/note-rows";

const yes = { value: "yes" as const, at: 1 };
const no = { value: "no" as const, at: 1 };
const q = (id: string) => ASSESSMENT_QUESTIONS.find((x) => x.id === id)!;

describe("the intake as rows (pack v6.1, A)", () => {
  it("opens the first incomplete row TOP-DOWN, so an out-of-order answer never skips a gap", () => {
    expect(firstOpenQuestion({})).toBe("q1");
    expect(firstOpenQuestion({ q3: yes })).toBe("q1");
    expect(firstOpenQuestion({ q1: no, q3: yes })).toBe("q2");
    expect(firstOpenQuestion({ q1: no, q2: no, q3: no, q4: no, q5: no })).toBe("q6");
  });

  it("holds Q6 open on a Yes until its follow-up is answered", () => {
    expect(questionComplete({ q6: yes }, q("q6"))).toBe(false);
    expect(questionComplete({ q6: yes, q6b: no }, q("q6"))).toBe(true);
    expect(questionComplete({ q6: no }, q("q6"))).toBe(true);
    const all = { q1: no, q2: no, q3: no, q4: no, q5: no, q6: yes };
    expect(firstOpenQuestion(all)).toBe("q6");
    expect(assessmentComplete({ ...all, q6b: yes })).toBe(true);
  });

  it("a Q6 No drops the follow-up — the store's rule, mirrored", () => {
    expect(afterAnswer({ q6: yes, q6b: yes }, "q6", "no").q6b).toBeUndefined();
    expect(questionOf("q6b")?.id).toBe("q6");
  });

  it("leaves the risk computation unchanged, in any answer order", () => {
    // Q3 → Q1 → Q6 (Yes + follow-up) → the rest, the pack's walkthrough.
    let a = afterAnswer({}, "q3", "yes");
    expect(riskLevel(a)).toBe("moderate");
    a = afterAnswer(a, "q1", "yes");
    expect(riskLevel(a)).toBe("moderate");
    a = afterAnswer(a, "q6", "yes");
    expect(riskLevel(a)).toBe("high");
    a = afterAnswer(a, "q6b", "no");
    for (const id of ["q2", "q4", "q5"]) a = afterAnswer(a, id, "no");
    expect(assessmentComplete(a)).toBe(true);
    expect(riskLevel(a)).toBe("high");
  });
});

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
