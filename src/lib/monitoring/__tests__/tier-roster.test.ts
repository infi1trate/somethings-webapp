import { describe, expect, it } from "vitest";
import {
  monitoringMetrics,
  teensNeedingReview,
  tierAlertLive,
  tierRoster,
  TIER4_TOTAL,
  type MonitoringTeen,
} from "@/lib/monitoring/tier-roster";
import { tierStateFor } from "@/lib/tiering/events";
import { seedEscalationEvents, seedEscalationHistory, seedEscalations, seedTierEvents } from "@/lib/tiering/seed";

/* ═══ THE ROSTER IS DERIVED FROM THE ONE TIER LOG NOW ═══ (Tiering &
   Escalation pack). These build the same inputs `useTiering` does, from the
   seed, for the calm and the alert axis. */
const NOW = Date.UTC(2026, 9, 20, 15);
function roster(alert: boolean) {
  const esc = seedEscalations(NOW, "active-mentorship", alert ? "tiers-alert" : "tiers-monitor");
  const events = [...seedTierEvents(NOW), ...seedEscalationEvents(esc)];
  const history = seedEscalationHistory(NOW);
  return tierRoster({
    stateFor: (id) => tierStateFor(events.filter((e) => e.teenId === id)),
    escalationsFor: (id) => [...history.filter((e) => e.threadId === id), ...(esc[id] ? [esc[id]] : [])],
    liveMentorName: "Alex Kim",
    now: NOW,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// THE TIERED ROSTER (proto/monitoring-merge)
//
// What the page, the rail badge and the dev bar all read. The acceptance line
// is "the hero metrics derive from the mock", so the metrics are checked
// against a roster built here — a number typed into the hero would pass a
// check against the shipped roster and fail this one.

const teen = (over: Partial<MonitoringTeen>): MonitoringTeen =>
  ({
    id: "t",
    teen: "A.",
    mentor: "M.",
    tier: 4,
    daysOnPlatform: 10,
    daysEngaged: 1,
    engagement7d: [0, 0, 0, 0, 0, 0, 0],
    riskFlags: { count: 0 },
    escalations: { count: 0 },
    surveys: { count: 0 },
    ...over,
  }) as MonitoringTeen;

describe("which scenarios are Alert", () => {
  it("is the Tiers · Alert mode and every escalation-lifecycle fixture", () => {
    expect(tierAlertLive("tiers-alert")).toBe(true);
    expect(tierAlertLive("escalation-unacked")).toBe(true);
    expect(tierAlertLive("tiers-monitor")).toBe(false);
    expect(tierAlertLive("normal-day")).toBe(false);
    expect(tierAlertLive(null)).toBe(false);
  });
});

describe("the roster, from the one log", () => {
  it("puts Jordan in the Tier 1 lane only while the crisis is open — moved, not added", () => {
    expect(roster(false).some((t) => t.tier === 1)).toBe(false);
    const lane = roster(true).filter((t) => t.tier === 1);
    expect(lane.map((t) => [t.recordId, t.teen, t.requestedTier])).toEqual([["t13", "Jordan T.", 1]]);
    expect(roster(true).length).toBe(roster(false).length);
    expect(roster(false).find((t) => t.recordId === "t13")?.tier).toBe(3);
  });

  it("is every record teen plus enough generated rows to make Tier 4 a hundred", () => {
    const r = roster(false);
    expect(r.filter((t) => t.recordId).length).toBe(26);
    expect(r.filter((t) => t.tier === 4).length).toBe(TIER4_TOTAL);
    expect(r.filter((t) => t.tier === 2).map((t) => t.recordId)).toEqual(["t15", "t21"]);
  });

  it("names the live mentor's teens after the live mentor", () => {
    expect(roster(true).find((t) => t.recordId === "t13")?.mentor).toBe("Alex K.");
    expect(roster(true).find((t) => t.recordId === "t13")?.presence).toBe("Alex in session");
    expect(roster(false).find((t) => t.recordId === "t13")?.presence).toBeUndefined();
  });

  it("reads time in tier off the log, against the tier's minimum or dwell", () => {
    expect(roster(false).find((t) => t.recordId === "t21")?.timeInTier).toEqual({ day: 3, minimum: 7 });
    expect(roster(false).find((t) => t.recordId === "t17")?.timeInTier).toEqual({ day: 14, minimum: 14 });
  });

  it("has a teen in every tier from 2 to 4 in both modes", () => {
    for (const live of [false, true])
      for (const tier of [2, 3, 4]) expect(roster(live).some((t) => t.tier === tier), `${live} T${tier}`).toBe(true);
  });
});

describe("the rail badge is teens needing review", () => {
  it("counts teens with a review reason, not teens or flags", () => {
    const set = [teen({ reviewReason: "4h review" }), teen({ reviewReason: "From T1 · Fri" }), teen({ riskFlags: { count: 9 } as MonitoringTeen["riskFlags"] })];
    expect(teensNeedingReview(set)).toBe(2);
    expect(teensNeedingReview([])).toBe(0);
  });

  it("is 4 calm and 5 on an alert, which is what the rail shows", () => {
    expect(teensNeedingReview(roster(false))).toBe(4);
    expect(teensNeedingReview(roster(true))).toBe(5);
  });
});

describe("the hero metrics derive from the roster", () => {
  it("counts each figure from the teens it is given", () => {
    const set = [
      teen({ id: "a", tier: 1, mentor: "E.", riskFlags: { count: 4, window: "24h" } as MonitoringTeen["riskFlags"], escalations: { count: 1, lastStatus: "open" } as MonitoringTeen["escalations"], engagement7d: [1, 0, 0, 0, 0, 0, 0] }),
      teen({ id: "b", tier: 2, mentor: "E.", reviewReason: "4h review", riskFlags: { count: 2, window: "7d" } as MonitoringTeen["riskFlags"], escalations: { count: 2, lastStatus: "closed" } as MonitoringTeen["escalations"] }),
      teen({ id: "c", tier: 2, mentor: "F.", reviewReason: "From T1 · Fri" }),
      teen({ id: "d", tier: 3, mentor: "G." }),
      teen({ id: "e", tier: 4, mentor: "G." }),
    ];
    const m = monitoringMetrics(set);
    expect(m.inCrisis).toBe(1);
    expect(m.highRisk).toBe(2);
    expect(m.reviewsDue).toBe(1); // "From T1" is a reason, not a review
    expect(m.openFlags48h).toBe(4); // the 7d window is outside 48h
    expect(m.escalations30d).toBe(3);
    expect(m.escalationsOpen).toBe(1);
    expect(m.escalationsClosed).toBe(2);
    expect(m.activeTeens).toBe(5);
    expect(m.mentors).toBe(3);
    expect(m.engagedThisWeek).toBe(1);
    expect(m.onWatch).toBe(4);
  });

  it("moves with the mode: the crisis is counted only on an alert", () => {
    const calm = monitoringMetrics(roster(false));
    const alert = monitoringMetrics(roster(true));
    expect(calm.inCrisis).toBe(0);
    expect(alert.inCrisis).toBe(1);
    expect(alert.activeTeens).toBe(calm.activeTeens);
    expect(alert.escalationsOpen).toBe(1);
  });
});
