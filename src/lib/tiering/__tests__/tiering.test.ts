import { describe, expect, it } from "vitest";
import { appendable, canSetTier, placementsFrom, tierStateFor, type TierEvent } from "@/lib/tiering/events";
import { escalationTarget, stepDownFor, SAFETY_QUESTIONS, NO_THREAT_OUTCOME } from "@/lib/tiering/escalation";
import { seedEscalations, seedTierEvents, seedEscalationEvents } from "@/lib/tiering/seed";
import { RAISE_TARGETS, TIER_NAME } from "@/lib/tiering/tiers";
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

  it("lets a mentor raise Tiers 1–3 or Platform safety, never Tier 4", () => {
    expect(RAISE_TARGETS).toEqual([1, 2, 3, "platform"]);
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

  it("asks the crisis note for its step down, and nothing of a Tier 2 or 3 escalation", () => {
    const e = { requested: 1 } as EscalationState;
    expect(stepDownFor(e, "guardian")).toBe(2);
    expect(stepDownFor(e, NO_THREAT_OUTCOME)).toBe(3);
    expect(stepDownFor({ requested: 2 } as EscalationState, "guardian")).toBeNull();
    expect(stepDownFor({ requested: "platform" } as EscalationState, "guardian")).toBeNull();
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

  it("carries six safety-check questions, each one marked as a placeholder until the Columbia text lands", () => {
    expect(SAFETY_QUESTIONS).toHaveLength(6);
    expect(SAFETY_QUESTIONS.every((q) => /pending/.test(q.text))).toBe(true);
  });
});
