import { describe, expect, it } from "vitest";
import {
  monitoringMetrics,
  teensNeedingReview,
  tierAlertLive,
  tierRoster,
  type MonitoringTeen,
} from "@/lib/monitoring/tier-roster";

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

describe("the roster", () => {
  it("holds a Tier 1 teen only while an alert is live", () => {
    expect(tierRoster(false).some((t) => t.tier === 1)).toBe(false);
    expect(tierRoster(true).filter((t) => t.tier === 1)).toHaveLength(1);
    // Alert ADDS the crisis; it does not reshuffle anyone else.
    expect(tierRoster(true).length).toBe(tierRoster(false).length + 1);
  });

  it("has a teen in every tier from 2 to 4 in both modes", () => {
    for (const live of [false, true])
      for (const tier of [2, 3, 4]) expect(tierRoster(live).some((t) => t.tier === tier), `${live} T${tier}`).toBe(true);
  });
});

describe("the rail badge is teens needing review", () => {
  it("counts teens with a review reason, not teens or flags", () => {
    const set = [teen({ reviewReason: "4h review" }), teen({ reviewReason: "From T1 · Fri" }), teen({ riskFlags: { count: 9 } as MonitoringTeen["riskFlags"] })];
    expect(teensNeedingReview(set)).toBe(2);
    expect(teensNeedingReview([])).toBe(0);
  });

  it("is 4 calm and 5 on an alert, which is what the rail shows", () => {
    expect(teensNeedingReview(tierRoster(false))).toBe(4);
    expect(teensNeedingReview(tierRoster(true))).toBe(5);
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
    const calm = monitoringMetrics(tierRoster(false));
    const alert = monitoringMetrics(tierRoster(true));
    expect(calm.inCrisis).toBe(0);
    expect(alert.inCrisis).toBe(1);
    expect(alert.activeTeens).toBe(calm.activeTeens + 1);
  });
});
