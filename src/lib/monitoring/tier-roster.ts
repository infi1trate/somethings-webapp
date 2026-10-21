// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE TIER ROSTER, DERIVED FROM THE ONE TIER LOG
//
// ═══ SUPERSEDES the proto/monitoring-merge fixture, in place ═══ The cast
// was the concept board's invented teens (Juniper S., Leo M., …) with a tier
// typed onto each. Unified (answered 2026-10-20), every named row is now a
// RECORD teen — the same id the chat thread and the user record use — and
// its tier, time in tier, pending request, escalation count and days on
// platform are READ from `useTiering`, never typed. The board's per-teen
// signals (flags, the 7-day sparkline, surveys) moved onto the teen of
// matching tenure and stay fixture data, because nothing upstream of
// Monitoring produces them yet.
//
// Tier 4 is the record's general teens plus a deterministic generator, so the
// group still holds 100 and the page reads like a real caseload. Generated
// rows have no record and say so by their id (`teen-gen-N`).
//
// ═══ THE TIER 1 LANE IS AN OPEN TIER 1–2 ESCALATION ═══ Safety first: a
// teen whose mentor has raised Tier 1 sits in the crisis lane at once, with a
// "Requested: Tier 1" chip until a supervisor confirms — the placement
// waits for confirmation, the response does not.

import type { EscalationState } from "@/lib/chat/types";
import { DEMO_PEOPLE, DEMO_TEENS } from "@/lib/record/people-demo";
import { LIVE_ID } from "@/lib/record/subject";
import { escalationTarget, isOpen } from "@/lib/tiering/escalation";
import { dayInTier, type TierState } from "@/lib/tiering/events";
import { TIER_DWELL_DAYS, TIER_MINIMUM_DAYS, isAlertTier, type Tier } from "@/lib/tiering/tiers";

export { tierAlertLive } from "@/lib/tiering/seed";

export interface MonitoringTeen {
  id: string;
  /** The record id, when the row is a record teen. */
  recordId?: string;
  teen: string;
  mentor: string;
  tier: Tier;
  /** The tier a mentor or the system has asked for, awaiting a supervisor —
   *  rendered "Requested: Tier N". */
  requestedTier?: Tier;
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

/** The board's per-teen signals, on the record teen of matching tenure. */
type Signals = Pick<MonitoringTeen, "daysEngaged" | "engagement7d" | "riskFlags" | "surveys"> & {
  reviewReason?: string;
  /** A fixed presence line, or "in-session": the mentor's name, shown only
   *  while an escalation is open. */
  presence?: string | "in-session";
};
const SIGNALS: Record<string, Signals> = {
  t13: {
    daysEngaged: 61, engagement7d: [30, 45, 60, 80, 95, 90, 100],
    riskFlags: { count: 4, window: "24h" }, surveys: { count: 9, lastInstrument: "C-SSRS", lastDate: "Today" },
    presence: "in-session",
  },
  t21: {
    daysEngaged: 48, engagement7d: [40, 70, 55, 90, 60, 30, 80],
    riskFlags: { count: 2, window: "7d" }, surveys: { count: 6, lastInstrument: "PHQ-9", lastDate: "Fri" },
    reviewReason: "From T1 · Fri",
  },
  t15: {
    daysEngaged: 19, engagement7d: [20, 35, 60, 85, 95, 90, 100],
    riskFlags: { count: 4, window: "48h", trigger: "surge" }, surveys: { count: 2, lastInstrument: "PHQ-9", lastDate: "Mon" },
    reviewReason: "Daily check-in due", presence: "Sarah coaching",
  },
  t17: {
    daysEngaged: 40, engagement7d: [60, 55, 70, 65, 60, 75, 70],
    riskFlags: { count: 1, window: "30d" }, surveys: { count: 5, lastInstrument: "GAD-7", lastDate: "Oct 2" },
    reviewReason: "Step-down ready",
  },
  t19: {
    daysEngaged: 52, engagement7d: [55, 40, 30, 20, 15, 12, 10],
    riskFlags: { count: 2, window: "3d", trigger: "slow-burn" }, surveys: { count: 7, lastInstrument: "PHQ-9", lastDate: "Sep 30" },
    reviewReason: "Slow-burn · check in",
  },
  t22: {
    daysEngaged: 22, engagement7d: [40, 50, 45, 55, 35, 50, 45],
    riskFlags: { count: 0 }, surveys: { count: 3, lastInstrument: "GAD-7", lastDate: "Oct 6" },
  },
};

/* ═══ GENERATED TIER 4 ROWS ═══ A seeded PRNG, so the list is the same on
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

/** Tier 4 holds this many rows in all — record teens first, then generated. */
export const TIER4_TOTAL = 100;

function generated(count: number): MonitoringTeen[] {
  const rnd = seeded(20261019);
  return Array.from({ length: count }, (_, i) => {
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
}

/** "Jordan Tate" → "Jordan T." — the board's short form. */
const short = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
};

const DAY = 86_400_000;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });

export interface RosterInput {
  stateFor: (teenId: string) => TierState;
  escalationsFor: (teenId: string) => EscalationState[];
  liveMentorName: string;
  now: number;
}

/** ═══ THE ROSTER, FROM THE ONE LOG ═══ */
export function tierRoster({ stateFor, escalationsFor, liveMentorName, now }: RosterInput): MonitoringTeen[] {
  /* Unnamed, the mentor is "the mentor" — never a broken possessive. */
  const liveShort = liveMentorName ? short(liveMentorName) : "The mentor";
  const records: MonitoringTeen[] = DEMO_TEENS.map((teen) => {
    const state = stateFor(teen.id);
    const escalations = escalationsFor(teen.id);
    const open = escalations.find((e) => isOpen(e));
    const target = open ? escalationTarget(open) : null;
    const current: Tier = state.tier ?? 4;
    /* The crisis posture does not wait for a confirmation. */
    const tier: Tier = target !== null && target !== "platform" && isAlertTier(target) && target < current ? target : current;
    const pendingTier = state.pending?.tier;
    const mentorName =
      teen.mentorId === LIVE_ID ? liveShort : short(DEMO_PEOPLE.find((p) => p.id === teen.mentorId)?.name ?? "A mentor");
    const sig = SIGNALS[teen.id];
    const day = dayInTier(state, now);
    const minimum = TIER_MINIMUM_DAYS[current] ?? TIER_DWELL_DAYS[current];
    const recent = escalations.filter((e) => now - e.openedAt <= 30 * DAY);
    const last = recent.at(-1);
    return {
      id: teen.id,
      recordId: teen.id,
      teen: short(teen.name),
      mentor: mentorName,
      tier,
      requestedTier: pendingTier !== undefined && pendingTier !== current ? pendingTier : undefined,
      daysOnPlatform: teen.joinedDaysAgo ?? 30,
      daysEngaged: sig?.daysEngaged ?? Math.max(1, Math.round((teen.joinedDaysAgo ?? 30) * 0.3)),
      engagement7d: sig?.engagement7d ?? [50, 60, 40, 70, 55, 65, 60],
      riskFlags: sig?.riskFlags ?? { count: 0 },
      escalations: last
        ? last.resolvedAt === null
          ? { count: recent.length, lastStatus: "open" }
          : { count: recent.length, lastStatus: "closed", lastWhen: WEEKDAY.format(new Date(last.resolvedAt)) }
        : { count: 0 },
      surveys: sig?.surveys ?? { count: 1, lastInstrument: "PHQ-9", lastDate: "Sep" },
      timeInTier: tier === current && day !== null && minimum && current !== 4 && current !== 1 ? { day, minimum } : undefined,
      reviewReason: state.pending ? `Confirm Tier ${state.pending.tier}` : sig?.reviewReason,
      presence:
        sig?.presence === "in-session"
          ? open
            ? `${teen.mentorId === LIVE_ID && !liveMentorName ? "Mentor" : mentorName.split(" ")[0]} in session`
            : undefined
          : sig?.presence,
    };
  });
  const recordT4 = records.filter((t) => t.tier === 4).length;
  return [...records, ...generated(Math.max(0, TIER4_TOTAL - recordT4))];
}

/** ═══ THE NAV BADGE: TEENS NEEDING REVIEW ═══ (answered) Every teen with a
 *  review reason — the Tier 1 request to confirm, the daily check-in, the
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
    reviewsDue: teens.filter((t) => t.tier === 2 && /review|check-in/i.test(t.reviewReason ?? "")).length,
    openFlags48h: sum((t) => (t.riskFlags.window && WITHIN_48H.has(t.riskFlags.window) ? t.riskFlags.count : 0)),
    escalations30d: sum((t) => t.escalations.count),
    escalationsOpen: sum((t) => (t.escalations.lastStatus === "open" ? 1 : 0)),
    escalationsClosed: sum((t) => (t.escalations.lastStatus === "closed" ? t.escalations.count : 0) + (t.escalations.lastStatus === "open" ? t.escalations.count - 1 : 0)),
    activeTeens: teens.length,
    mentors: new Set(teens.map((t) => t.mentor)).size,
    engagedThisWeek: teens.filter((t) => t.engagement7d.some((v) => v > 0)).length,
    onWatch: teens.filter((t) => t.tier <= 3).length,
  };
}
