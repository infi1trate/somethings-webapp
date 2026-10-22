import { describe, expect, it } from "vitest";
import { appendable, canSetTier, placementsFrom, tierStateFor, type TierEvent } from "@/lib/tiering/events";
import {
  ASSESSMENT_QUESTIONS,
  CLOSE_OUT_TIER,
  CLOSE_OUT_TIER_COPY,
  activeSection,
  activeStep,
  answeredCount,
  autoOutcome,
  crisisSections,
  draftDebrief,
  escalationTarget,
  mentorStage,
  riskLevel,
  supervisorStage,
} from "@/lib/tiering/escalation";
import { seedEscalations, seedTierEvents, seedEscalationEvents } from "@/lib/tiering/seed";
import { RAISE_TIERS, TIER_NAME } from "@/lib/tiering/tiers";
import { DEMO_TEENS } from "@/lib/record/people-demo";
import type { EscalationState } from "@/lib/chat/types";

const NOW = Date.UTC(2026, 9, 20, 15);
const sup = { id: "s", name: "Sasha", role: "supervisor" as const };
const mentor = { id: "live", name: "", role: "mentor" as const };
const ev = (over: Partial<TierEvent>): TierEvent => ({
  id: Math.random().toString(36),
  teenId: "t1",
  at: NOW,
  kind: "placed",
  tier: 4,
  fromTier: null,
  actor: sup,
  reason: "because",
  ...over,
});

describe("the canon's names", () => {
  it("never calls a tier Monitoring, and Tier 3 is Medium risk", () => {
    expect(Object.values(TIER_NAME)).toEqual(["Active crisis", "High risk", "Medium risk", "General"]);
    expect(Object.values(TIER_NAME).some((n) => /monitoring/i.test(n))).toBe(false);
  });

  it("lets a mentor raise strictly Tiers 1–3 — never Tier 4, and a platform concern is not a tier", () => {
    /* pack v3.0, Supersession 3: Platform safety left the taxonomy. */
    expect(RAISE_TIERS).toEqual([1, 2, 3]);
  });
});

describe("a tier is the last placement in the log", () => {
  it("reads the current tier and the pending request off the events", () => {
    const s = tierStateFor([
      ev({ at: NOW - 3000, kind: "placed", tier: 3 }),
      ev({ at: NOW - 2000, kind: "requested", tier: 1, actor: mentor }),
    ]);
    expect(s.tier).toBe(3);
    expect(s.pending?.tier).toBe(1);
  });

  it("clears the pending chip on confirmation, and on a decline without moving", () => {
    const base = [ev({ at: 1, tier: 3 }), ev({ at: 2, kind: "requested", tier: 1, actor: mentor })];
    const confirmed = tierStateFor([...base, ev({ at: 3, kind: "confirmed", tier: 1 })]);
    expect([confirmed.tier, confirmed.pending]).toEqual([1, null]);
    const declined = tierStateFor([...base, ev({ at: 3, kind: "declined", tier: 1, fromTier: 3 })]);
    expect([declined.tier, declined.pending]).toEqual([3, null]);
  });

  it("orders by time, not by array position", () => {
    const s = tierStateFor([ev({ at: 5, tier: 2 }), ev({ at: 1, tier: 4 })]);
    expect(s.tier).toBe(2);
  });
});

describe("the gate: mentor and system flag, only a supervisor sets", () => {
  it("refuses a tier-setting event from a mentor, and accepts their request", () => {
    expect(canSetTier("mentor")).toBe(false);
    expect(appendable(ev({ kind: "stepped-down", tier: 4, actor: mentor })).ok).toBe(false);
    expect(appendable(ev({ kind: "placed", tier: 2, actor: mentor })).ok).toBe(false);
    expect(appendable(ev({ kind: "step-down-requested", tier: 3, actor: mentor })).ok).toBe(true);
    expect(appendable(ev({ kind: "confirmed", tier: 1, actor: sup })).ok).toBe(true);
  });

  it("refuses any event without a reason, and Tier 4 as a raise", () => {
    expect(appendable(ev({ reason: "  " })).ok).toBe(false);
    expect(appendable(ev({ kind: "requested", tier: 4, actor: mentor })).ok).toBe(false);
  });
});

describe("movement is asymmetric", () => {
  const allowed = (from: 1 | 2 | 3 | 4, noThreat = false) =>
    placementsFrom(from, { noThreat }).filter((p) => p.allowed).map((p) => p.tier);

  it("goes up anywhere in one move", () => {
    expect(allowed(4)).toEqual([1, 2, 3]);
  });

  it("goes down one step at a time", () => {
    expect(allowed(3)).toEqual([1, 2, 4]);
    expect(allowed(2)).toEqual([1, 3]);
  });

  it("takes Tier 1 to Tier 2, or to Tier 3 only when it is no longer a threat — never to Tier 4", () => {
    expect(allowed(1)).toEqual([2]);
    expect(allowed(1, true)).toEqual([2, 3]);
    expect(placementsFrom(1, { noThreat: true }).find((p) => p.tier === 4)?.allowed).toBe(false);
  });

  it("reads an escalation from before tiering as a Tier 1 crisis", () => {
    expect(escalationTarget({} as EscalationState)).toBe(1);
  });
});

describe("one seed for every surface", () => {
  it("places every record teen, with a reason on every event", () => {
    const events = seedTierEvents(NOW);
    for (const t of DEMO_TEENS) expect(tierStateFor(events.filter((e) => e.teenId === t.id)).tier, t.id).not.toBeNull();
    expect(events.every((e) => e.reason.trim().length > 0)).toBe(true);
    expect(events.every((e) => appendable(e).ok)).toBe(true);
  });

  it("puts Jordan's crisis on screen from either dev axis, and only one copy of it", () => {
    expect(Object.keys(seedEscalations(NOW, "escalation-active", null))).toEqual(["t13"]);
    expect(Object.keys(seedEscalations(NOW, "active-mentorship", "tiers-alert"))).toEqual(["t13"]);
    expect(Object.keys(seedEscalations(NOW, "escalation-active", "tiers-alert"))).toEqual(["t13"]);
    expect(Object.keys(seedEscalations(NOW, "active-mentorship", "tiers-monitor"))).toEqual([]);
  });

  it("files the open crisis as a pending Tier 1 request beside Jordan's Tier 3", () => {
    const esc = seedEscalations(NOW, "escalation-active", null);
    const s = tierStateFor([...seedTierEvents(NOW), ...seedEscalationEvents(esc)].filter((e) => e.teenId === "t13"));
    expect(s.tier).toBe(3);
    expect(s.pending?.tier).toBe(1);
  });

});

/* ═══ THE ESCALATION EXCHANGE (pack v2.0) ═══ */
const yes = (ids: string[], no: string[] = []) =>
  Object.fromEntries([...ids.map((id) => [id, { value: "yes" as const, at: 1 }]), ...no.map((id) => [id, { value: "no" as const, at: 1 }])]);
const esc = (over: Partial<EscalationState>): EscalationState =>
  ({ id: "e", threadId: "t1", openedAt: 0, anchorMessageId: null, supervisorNotifiedAt: 0, supervisorId: "s", resolvedAt: null, resolutionNoteId: null, requested: 1, ...over }) as EscalationState;
const calm = { tier: 3, since: 0, setBy: null, pending: null, history: [] } as never;

describe("the assessment — the sanctioned wording, in order", () => {
  it("is six questions, verbatim, with Q3's example and Q6's follow-up", () => {
    expect(ASSESSMENT_QUESTIONS).toHaveLength(6);
    expect(ASSESSMENT_QUESTIONS[0].text).toBe("Have you wished you were dead or wished you could go to sleep and not wake up?");
    expect(ASSESSMENT_QUESTIONS[4].text).toBe("Have you started to work out the details of how to kill yourself? Do you intend to carry out this plan?");
    expect(ASSESSMENT_QUESTIONS[2].example).toMatch(/I thought about pills, but I.d never actually do it/);
    expect(ASSESSMENT_QUESTIONS[5].followUp?.text).toBe("Was this within the past 3 months?");
    expect(ASSESSMENT_QUESTIONS.every((q) => !/pending|placeholder/i.test(q.text))).toBe(true);
  });

  it("asks one at a time, and only asks Q6's follow-up after a Yes", () => {
    expect(activeStep({})?.id).toBe("q1");
    expect(activeStep(yes(["q1"]))?.id).toBe("q2");
    expect(activeStep(yes(["q6"], ["q1", "q2", "q3", "q4", "q5"]))?.id).toBe("q6b");
    expect(activeStep(yes([], ["q1", "q2", "q3", "q4", "q5", "q6"]))).toBeNull();
    expect(answeredCount(yes(["q6", "q6b"], ["q1"]))).toBe(2); // the follow-up is not one of the six
  });

  it("suggests a risk level — Low on Q1–Q2, Moderate on Q3, High on Q4–Q6 — and is advisory only", () => {
    expect(riskLevel({})).toBeNull();
    expect(riskLevel(yes(["q1", "q2"]))).toBe("low");
    expect(riskLevel(yes([], ["q1", "q2"]))).toBe("low");
    expect(riskLevel(yes(["q3"]))).toBe("moderate");
    for (const q of ["q4", "q5", "q6"]) expect(riskLevel(yes([q])), q).toBe("high");
  });
});

describe("one record, two lenses", () => {
  it("walks the mentor M2 → M3 → M4 and the supervisor S0 → S4 off the record's own fields", () => {
    /* S0 (pack v3.0): while the mentor is still assessing, Confirm waits. */
    const open = esc({});
    expect([mentorStage(open, calm), supervisorStage(open)]).toEqual(["M2", "S0"]);
    const sent = esc({ safetyCheck: { answers: {}, submittedAt: 5 } });
    expect([mentorStage(sent, calm), supervisorStage(sent)]).toEqual(["M3", "S1"]);
    /* No assessment for a Tier 3 raise: straight to S1. */
    expect(supervisorStage(esc({ requested: 3 }))).toBe("S1");
    const confirmed = esc({ safetyCheck: { answers: {}, submittedAt: 5 }, confirmedTier: 1 });
    expect(supervisorStage(confirmed)).toBe("S2");
    const noted = { ...confirmed, crisisNote: { subtype: "x", safetyPlan: { status: "created", usage: "" }, resources: { shared: false, list: "" }, referral: { made: false, list: [] }, contact: { engaged: false, details: "" }, services: { contacted: false, which: [] } } };
    expect(supervisorStage(noted)).toBe("S3");
    const outcome = { ...noted, outcome: { id: "stabilized", autoTagged: false, debrief: "d", debriefIsDraft: false, plan: "p", additional: "", savedAt: 9 } };
    expect(supervisorStage(outcome)).toBe("S4");
    expect([mentorStage({ ...outcome, resolvedAt: 10 }, calm), supervisorStage({ ...outcome, resolvedAt: 10 })]).toEqual(["M4", "closed"]);
  });

  it("skips the assessment for Tier 3 and Platform safety — the mentor waits from the start", () => {
    expect(mentorStage(esc({ requested: 3 }), calm)).toBe("M3");
    expect(mentorStage(esc({ requested: "platform" }), calm)).toBe("M3");
  });

  it("renders section 5 for Tier 1 only, and opens one section at a time", () => {
    expect(crisisSections(1)).toContain("emergency");
    expect(crisisSections(2)).not.toContain("emergency");
    expect(activeSection(undefined, 2)).toBe("subtype");
    expect(activeSection({ subtype: "x" }, 2)).toBe("safety-plan");
    expect(activeSection({ subtype: "x", safetyPlan: { status: "created", usage: "" }, resources: { shared: true, list: "" } }, 2)).toBe("resources"); // a Yes needs its list
  });
});

describe("S3 and S4", () => {
  it("auto-tags the outcome from the note, and only as a pre-fill", () => {
    expect(autoOutcome({ services: { contacted: true, which: ["welfare_check"] } })).toBe("911");
    expect(autoOutcome({ referral: { made: true, list: ["mobile_crisis"] } })).toBe("mobile_crisis");
    expect(autoOutcome({ referral: { made: true, list: ["therapist"] } })).toBe("referred");
    expect(autoOutcome({})).toBeNull();
  });

  it("drafts the debrief narrative from the record, and writes no clinical determination", () => {
    const d = draftDebrief({ name: "Jordan", escalation: esc({ contextNote: "Things are bad at home.", safetyCheck: { answers: yes(["q1", "q3"]), submittedAt: 1 } }), teenLines: ["i'm in my room"], mentorLines: ["I'm here."] });
    expect(d).toMatch(/Jordan/);
    expect(d).toMatch(/moderate risk/);
    expect(d).not.toMatch(/Tier \d|confirmed|subtype/i);
  });

  it("closes to the blocked close-out constant — Tier 3, named 'Tier 3 Monitoring' for now", () => {
    expect(CLOSE_OUT_TIER).toBe(3);
    expect(CLOSE_OUT_TIER_COPY).toBe("Tier 3 Monitoring");
  });
});
