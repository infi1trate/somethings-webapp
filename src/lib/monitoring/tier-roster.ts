// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE TIER ROSTER FIXTURE (proto/monitoring-merge)
//
// The cast is the concept board's (reference/supervisor-core-workflow.html),
// in the pack's fields. Tier 4 is the five named rows plus a deterministic
// generator, so the list is ~100 rows and the same on every load. The hero
// metrics are DERIVED from this array (`monitoringMetrics`), never typed in.
//
// ═══ JUNIPER IS LIVE ONLY IN ALERT ═══ The dev bar's Scenario drives it, on
// the Monitoring axis (`monitoringScenarioId`): "Tiers · Alert" — or any
// escalation-lifecycle scenario, which by definition has one open — makes
// Juniper live, filling the Tier 1 lane, raising the strip and turning the
// In-crisis cell. Anything else is calm. (`tierAlertLive`.)

import type { Tier } from "@/lib/monitoring/tiers";

export interface MonitoringTeen {
  id: string;
  teen: string;
  mentor: string;
  tier: Tier;
  /** The system's suggestion, shown as ★ until a supervisor confirms. */
  recommendedTier?: Tier;
  daysOnPlatform: number;
  daysEngaged: number;
  /** Seven days, 0–100, oldest first. */
  engagement7d: number[];
  riskFlags: { count: number; window?: string; trigger?: "surge" | "slow-burn" };
  escalations: { count: number; lastStatus?: "open" | "closed"; lastWhen?: string };
  surveys: { count: number; lastInstrument?: string; lastDate?: string };
  timeInTier?: { day: number; minimum: number };
  reviewReason?: string;
  presence?: string;
}

const CAST: MonitoringTeen[] = [
  {
    id: "teen-juniper", teen: "Juniper S.", mentor: "Eden M.", tier: 1, recommendedTier: 1,
    daysOnPlatform: 214, daysEngaged: 61, engagement7d: [30, 45, 60, 80, 95, 90, 100],
    riskFlags: { count: 4, window: "24h" }, escalations: { count: 2, lastStatus: "open" },
    surveys: { count: 9, lastInstrument: "C-SSRS", lastDate: "Today" },
    reviewReason: "Confirm Tier 1", presence: "Eden in session",
  },
  {
    id: "teen-leo", teen: "Leo M.", mentor: "Marcus L.", tier: 2,
    daysOnPlatform: 132, daysEngaged: 48, engagement7d: [40, 70, 55, 90, 60, 30, 80],
    riskFlags: { count: 2, window: "7d" }, escalations: { count: 1, lastStatus: "closed", lastWhen: "Fri" },
    surveys: { count: 6, lastInstrument: "PHQ-9", lastDate: "Fri" },
    timeInTier: { day: 3, minimum: 7 }, reviewReason: "From T1 · Fri",
  },
  {
    id: "teen-mia", teen: "Mia O.", mentor: "Clara T.", tier: 2,
    daysOnPlatform: 45, daysEngaged: 19, engagement7d: [20, 35, 60, 85, 95, 90, 100],
    riskFlags: { count: 4, window: "48h", trigger: "surge" }, escalations: { count: 0 },
    surveys: { count: 2, lastInstrument: "PHQ-9", lastDate: "Mon" },
    timeInTier: { day: 1, minimum: 7 }, reviewReason: "4h review · 2:52", presence: "Sarah coaching",
  },
  {
    id: "teen-ava", teen: "Ava P.", mentor: "Priya S.", tier: 3,
    daysOnPlatform: 98, daysEngaged: 40, engagement7d: [60, 55, 70, 65, 60, 75, 70],
    riskFlags: { count: 1, window: "30d" }, escalations: { count: 0 },
    surveys: { count: 5, lastInstrument: "GAD-7", lastDate: "Oct 2" },
    timeInTier: { day: 14, minimum: 14 }, reviewReason: "Step-down ready",
  },
  {
    id: "teen-theo", teen: "Theo B.", mentor: "Jonah R.", tier: 3,
    daysOnPlatform: 176, daysEngaged: 52, engagement7d: [55, 40, 30, 20, 15, 12, 10],
    riskFlags: { count: 2, window: "3d", trigger: "slow-burn" }, escalations: { count: 0 },
    surveys: { count: 7, lastInstrument: "PHQ-9", lastDate: "Sep 30" },
    timeInTier: { day: 9, minimum: 14 }, reviewReason: "Slow-burn · check in",
  },
  {
    id: "teen-ravi", teen: "Ravi M.", mentor: "Priya S.", tier: 3,
    daysOnPlatform: 61, daysEngaged: 22, engagement7d: [40, 50, 45, 55, 35, 50, 45],
    riskFlags: { count: 0 }, escalations: { count: 0 },
    surveys: { count: 3, lastInstrument: "GAD-7", lastDate: "Oct 6" },
    timeInTier: { day: 2, minimum: 14 },
  },
  ...(
    [
      ["Sam R.", "Noah K.", 301, 112, 12],
      ["Lily N.", "Lena F.", 88, 37, 4],
      ["Ezra C.", "Noah K.", 156, 64, 6],
      ["Zoe H.", "Lena F.", 22, 9, 1],
      ["Kai T.", "Marcus L.", 240, 88, 10],
    ] as const
  ).map(([teen, mentor, on, engaged, surveys], i) => ({
    id: `teen-t4-${i}`, teen, mentor, tier: 4 as const,
    daysOnPlatform: on, daysEngaged: engaged, engagement7d: [50, 60, 40, 70, 55, 65, 60],
    riskFlags: { count: 0 }, escalations: { count: 0 },
    surveys: { count: surveys, lastInstrument: "PHQ-9", lastDate: "Sep" },
  })),
];

/* ═══ ~95 GENERATED TIER 4 ROWS ═══ A seeded PRNG, so the list is the same on
   every load and a screenshot can be compared to the last one. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const FIRST = ["Aria", "Ben", "Cleo", "Dev", "Elle", "Finn", "Gia", "Hugo", "Iris", "Jude", "Kira", "Luca", "Maya", "Nico", "Opal", "Pax", "Quinn", "Rory", "Sage", "Tess"];
const LAST = "ABCDEFGHJKLMNPRSTVWZ";
const MENTORS = ["Noah K.", "Lena F.", "Marcus L.", "Priya S.", "Jonah R.", "Clara T.", "Eden M."];
const GENERATED: MonitoringTeen[] = (() => {
  const rnd = seeded(20261019);
  return Array.from({ length: 95 }, (_, i) => {
    const on = 7 + Math.floor(rnd() * 360);
    const engaged = Math.max(1, Math.floor(on * (0.15 + rnd() * 0.3)));
    return {
      id: `teen-gen-${i}`,
      teen: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(rnd() * LAST.length)]}.`,
      mentor: MENTORS[Math.floor(rnd() * MENTORS.length)],
      tier: 4 as const,
      daysOnPlatform: on,
      daysEngaged: engaged,
      engagement7d: Array.from({ length: 7 }, () => Math.round(rnd() * 100)),
      riskFlags: { count: 0 },
      escalations: { count: 0 },
      surveys: { count: Math.floor(rnd() * 12), lastInstrument: "PHQ-9", lastDate: "Sep" },
    };
  });
})();

const ALL = [...CAST, ...GENERATED];

/** Is a Tier 1 alert live in this scenario? The Tiers group's Alert, or any
 *  escalation-lifecycle scenario (each has an open escalation). */
export const tierAlertLive = (scenarioId: string | null) =>
  scenarioId === "tiers-alert" || (scenarioId?.startsWith("escalation-") ?? false);

/** The teens on the roster: Juniper is live (Tier 1) only in an alert. */
export function tierRoster(live: boolean): MonitoringTeen[] {
  return live ? ALL : ALL.filter((t) => t.tier !== 1);
}

/** ═══ THE NAV BADGE: TEENS NEEDING REVIEW ═══ (answered) Every teen with a
 *  review reason — the live Tier 1 teen to confirm, the 4h review, the
 *  step-down, the slow-burn check-in, the hand-back from T1. */
export const teensNeedingReview = (teens: MonitoringTeen[]) => teens.filter((t) => !!t.reviewReason).length;

/** Supervisors on shift — the fixture's two. */
export const SUPERVISORS_ON_SHIFT = 2;

/** Windows that count as "in the last 48h". */
const WITHIN_48H = new Set(["24h", "48h"]);

export interface MonitoringMetrics {
  inCrisis: number;
  highRisk: number;
  reviewsDue: number;
  openFlags48h: number;
  escalations30d: number;
  escalationsOpen: number;
  escalationsClosed: number;
  activeTeens: number;
  mentors: number;
  engagedThisWeek: number;
  onWatch: number;
}

/** ═══ EVERY NUMBER ON THE HERO BAR, FROM THE ARRAY ═══ */
export function monitoringMetrics(teens: MonitoringTeen[]): MonitoringMetrics {
  const sum = (f: (t: MonitoringTeen) => number) => teens.reduce((n, t) => n + f(t), 0);
  return {
    inCrisis: teens.filter((t) => t.tier === 1).length,
    highRisk: teens.filter((t) => t.tier === 2).length,
    reviewsDue: teens.filter((t) => t.tier === 2 && /review/i.test(t.reviewReason ?? "")).length,
    openFlags48h: sum((t) => (t.riskFlags.window && WITHIN_48H.has(t.riskFlags.window) ? t.riskFlags.count : 0)),
    escalations30d: sum((t) => t.escalations.count),
    escalationsOpen: sum((t) => (t.escalations.lastStatus === "open" ? t.escalations.count : 0)),
    escalationsClosed: sum((t) => (t.escalations.lastStatus === "closed" ? t.escalations.count : 0)),
    activeTeens: teens.length,
    mentors: new Set(teens.map((t) => t.mentor)).size,
    engagedThisWeek: teens.filter((t) => t.engagement7d.some((v) => v > 0)).length,
    onWatch: teens.filter((t) => t.tier <= 3).length,
  };
}
