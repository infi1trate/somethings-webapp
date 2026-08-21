// TODO-DATA — demo fixtures for the Mentor Record Overview.
//
// This prototype has NO data layer for the IMP-6 aggregations (mock-api.ts
// carries none of them, and there is no mentee entity in the store). These
// illustrative fixtures stand in so the Overview design is visible; every
// value here is fake and must be replaced by the real IMP-6 aggregations
// (MD3/MD30 retention, avg response time, per-mentee recency/escalation/video)
// when they land. Each consuming card should read through a data-availability
// check so it disappears cleanly if the source is null.
//
// Vocabulary law (amended by the caseload prompt): always "mentees" for the
// people — "caseload" is sanctioned for the CAPACITY concept only ("a caseload
// of 4 of 5 mentees"), never as a word for the people; escalations name the
// observable cause ("No reply in 5 days"), never a predicted departure; events
// describe that an exchange happened, never its content; numbers describe how
// mentoring is going, never grade the person.

import type { DemoTeen } from "@/lib/record/people-demo";

const MIN = 60_000;
const DAY = 86_400_000;

export interface DemoMentee {
  id: string;
  name: string;
  matchedAt: number; // → relationship length
  // Direction-aware recency: one timestamp per party's LAST message. The pair's
  // last exchange is the later of the two; who sent it decides the copy — the
  // difference between "coach the mentor" (mentor owes a reply) and "check on
  // the teen" (teen gone quiet). TODO-DATA: the real message store carries per-
  // message history; these two stamps are the minimal honest projection.
  mentorLastSentAt: number | null;
  menteeLastSentAt: number | null;
  // Escalation names the observable cause; the 45-day staleness rule is
  // applied by the consumer (escalations older than 45 days do not render).
  // GENUINE escalations only (critical family) — the derived waiting-on-mentor
  // state is a WARNING and is computed from the timestamps, never stored here.
  escalation: { reason: string; at: number } | null;
  videoCount30d: number; // video calls, last 30 days (care signal, not absence)
}

export interface DemoTeamMember {
  id: string;
  name: string;
  roleLabel: string;
}

export interface DemoEvent {
  id: string;
  // Event grammar: verb + person/object (+ elapsed rendered by the consumer).
  // NEVER message content.
  text: string;
  at: number;
}

export interface DemoOverviewData {
  mentees: DemoMentee[];
  capacity: { active: number; total: number }; // "4 active · 1 slot open"
  team: DemoTeamMember[];
  events: DemoEvent[];
  metrics: {
    // null on any field = unreachable / low-data → the line does not render.
    avgResponseMinutes: number | null;
    matchesActivePast90: { active: number; total: number } | null; // plain fraction
    lastActiveAt: number | null;
  };
}

// Resolved against the caller's `now` so elapsed values stay live without
// Date.now() at module load (keeps SSR/first-paint stable — call post-mount).
export function getDemoOverview(now: number): DemoOverviewData {
  return {
    // The four fixtures exercise the four recency states (see menteeRecency):
    // mentor-replied · mentee-wrote · waiting-on-mentor · teen-quiet.
    mentees: [
      {
        id: "m-jordan",
        name: "Jordan T.",
        matchedAt: now - 122 * DAY, // ~4 months
        mentorLastSentAt: now - 1 * DAY, // mentor replied yesterday
        menteeLastSentAt: now - 2 * DAY, // teen wrote the day before — active pair
        escalation: null,
        videoCount30d: 0,
      },
      {
        id: "m-sam",
        name: "Sam K.",
        matchedAt: now - 15 * DAY, // ~2 weeks
        mentorLastSentAt: now - 1 * DAY,
        menteeLastSentAt: now - 3 * 60 * MIN, // teen wrote earlier today
        escalation: null,
        videoCount30d: 3, // video-comfort: low chat volume may be video, not absence
      },
      {
        id: "m-riley",
        name: "Riley M.",
        matchedAt: now - 44 * DAY, // ~6 weeks
        mentorLastSentAt: now - 6 * DAY,
        menteeLastSentAt: now - 5 * DAY, // teen wrote 5d ago; mentor hasn't replied
        // → derived waiting-on-mentor WARNING (was a hand-written escalation;
        // the direction data now computes it — escalation stays for genuine
        // escalation records only).
        escalation: null,
        videoCount30d: 0,
      },
      {
        id: "m-alex",
        name: "Alex P.",
        matchedAt: now - 92 * DAY, // ~3 months
        mentorLastSentAt: now - 2 * DAY, // mentor replied…
        menteeLastSentAt: now - 9 * DAY, // …but the teen hasn't written in 9d → teen-quiet
        escalation: null,
        videoCount30d: 1,
      },
    ],
    capacity: { active: 4, total: 5 },
    team: [
      { id: "t-stephen", name: "Stephen Rowe", roleLabel: "Supervisor" },
      { id: "t-brandy", name: "Brandy Forrestor", roleLabel: "Lead mentor" },
    ],
    events: [
      { id: "e1", text: "Replied to Jordan T.", at: now - 4 * 60 * MIN },
      { id: "e2", text: "Video call with Sam K.", at: now - 2 * DAY },
      { id: "e3", text: "Profile change approved", at: now - 3 * DAY },
      { id: "e4", text: "Matched with Sam K.", at: now - 15 * DAY },
      { id: "e5", text: "Matched with Riley M.", at: now - 44 * DAY },
    ],
    metrics: {
      avgResponseMinutes: 90, // → "within a few hours"
      matchesActivePast90: { active: 3, total: 4 }, // plain fraction, never a %
      lastActiveAt: now - 3 * 60 * MIN, // today
    },
  };
}

/** Escalations older than 45 days do not render (staleness rule). */
export function escalationVisible(
  e: DemoMentee["escalation"],
  now: number
): e is { reason: string; at: number } {
  return !!e && now - e.at <= 45 * DAY;
}

// ── Presentation helpers (elapsed-time standard: labeled units, only the
// relevant ones; never clock format, never raw timestamps) ────────────────

/** "today" / "2d ago" / "2 weeks ago" / "4 months ago" — for event lists. */
export function relativeAgo(ts: number, now: number): string {
  const d = Math.floor((now - ts) / DAY);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

/** "15 min" / "2h" / "3d" — compact elapsed for trailing slots. */
export function elapsedShort(ts: number, now: number): string {
  const m = Math.max(1, Math.round((now - ts) / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Relationship length: "2 weeks" / "4 months" (no "ago"). */
export function relLength(matchedAt: number, now: number): string {
  const d = Math.floor((now - matchedAt) / DAY);
  // Singular at 1 — "together 1 days" surfaced in Past mentees the moment a
  // day-old pairing ended.
  if (d <= 1) return "1 day";
  if (d < 14) return `${d} days`;
  if (d < 60) return `${Math.round(d / 7)} weeks`;
  return `${Math.round(d / 30)} months`;
}

/** The pair's last exchange, either direction — for recency sorting. */
export function lastExchangeAt(m: DemoMentee): number {
  return Math.max(m.mentorLastSentAt ?? 0, m.menteeLastSentAt ?? 0);
}

/** Adapt a teen (the ONE person universe, people-demo) into the mentee shape
 *  this module's recency machinery reads. The two fixtures used to be disjoint
 *  — teens had ids/groups/join dates, mentees had the direction timestamps, and
 *  nothing joined them. Teens now carry both; this converts their stable
 *  days-ago numbers into the absolute stamps `menteeRecency` compares. */
export function teenAsMentee(t: DemoTeen, now: number): DemoMentee {
  const at = (days: number | undefined) =>
    days === undefined ? null : now - days * DAY;
  return {
    id: t.id,
    name: t.goesBy ?? t.name,
    matchedAt: now - (t.matchedDaysAgo ?? t.joinedDaysAgo) * DAY,
    mentorLastSentAt: at(t.mentorLastSentDaysAgo),
    menteeLastSentAt: at(t.menteeLastSentDaysAgo),
    escalation: t.escalation
      ? { reason: t.escalation.reason, at: now - t.escalation.daysAgo * DAY }
      : null,
    videoCount30d: t.videoCount30d ?? 0,
  };
}

// ── Direction-aware recency (the four states) ─────────────────────────────
// Who sent last decides what the row says and whether it flags. Thresholds:
// WAITING_DAYS — mentee wrote, mentor hasn't replied → the WARNING state that
// drives the row chip + the record's attention strip ("coach the mentor").
// TEEN_QUIET_DAYS — mentor replied, teen silent since → a GENTLER warning
// ("check on the teen"). TODO: both thresholds need clinical input.
export const WAITING_DAYS = 5;
export const TEEN_QUIET_DAYS = 7;

export type MenteeRecency =
  | { kind: "mentor-replied"; ago: string } // mentor sent last, pair active
  | { kind: "mentee-wrote"; ago: string } // mentee sent last, within threshold
  | { kind: "waiting-on-mentor"; days: number } // mentor owes a reply → warning
  | { kind: "teen-quiet"; days: number }; // teen silent after mentor replied

export function menteeRecency(m: DemoMentee, now: number): MenteeRecency {
  const mentorAt = m.mentorLastSentAt ?? 0;
  const menteeAt = m.menteeLastSentAt ?? 0;
  if (menteeAt > mentorAt) {
    // Mentee sent last — the mentor owes the reply.
    const days = Math.floor((now - menteeAt) / DAY);
    if (days >= WAITING_DAYS) return { kind: "waiting-on-mentor", days };
    return { kind: "mentee-wrote", ago: relativeAgo(menteeAt, now) };
  }
  // Mentor sent last — is the teen quiet since?
  const quietDays = Math.floor((now - menteeAt) / DAY);
  if (menteeAt > 0 && quietDays >= TEEN_QUIET_DAYS)
    return { kind: "teen-quiet", days: quietDays };
  return { kind: "mentor-replied", ago: relativeAgo(mentorAt, now) };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Secondary-line copy per state (all TODO-COPY). NON-DUPLICATION RULE: when
 *  the row carries an attention chip (the two flagged states), the secondary
 *  drops its recency clause — the caller shows relationship length instead —
 *  so the chip and the line never state the same fact in two moods. */
export function recencyLine(
  r: MenteeRecency,
  menteeName: string,
  mentorFirstName: string
): string {
  switch (r.kind) {
    case "mentor-replied":
      return `${mentorFirstName} replied ${r.ago}`;
    case "mentee-wrote":
      return `${firstName(menteeName)} wrote ${r.ago}`;
    case "waiting-on-mentor":
      return `waiting on ${mentorFirstName} · ${r.days} days`;
    case "teen-quiet":
      return `${firstName(menteeName)} last wrote ${r.days}d ago`;
  }
}

/** Row-chip copy for the flagged states (TODO-COPY) — names the observable
 *  cause, never a prediction. Null = no chip. */
export function recencyChip(
  r: MenteeRecency
): { text: string; tone: "warning" } | null {
  if (r.kind === "waiting-on-mentor")
    return { text: `No reply in ${r.days} days`, tone: "warning" };
  if (r.kind === "teen-quiet")
    return { text: `Last wrote ${r.days}d ago`, tone: "warning" };
  return null;
}

// ── Dev-only fixture expander ──────────────────────────────────────────────
// TODO-DATA: lets ?demoMentees=N preview the Mentees list at scale (search +
// sort chrome appears at 9+). Deterministic — index-seeded, no randomness.
const EXTRA_NAMES = [
  "Maya R.", "Eli S.", "Nora B.", "Owen C.", "Zoe L.",
  "Ivan D.", "Lena F.", "Theo G.", "Ruth H.", "Cole J.",
  "Isla K.", "Finn M.",
];

export function expandMentees(
  base: DemoMentee[],
  count: number,
  now: number
): DemoMentee[] {
  if (count <= base.length) return base;
  const extras: DemoMentee[] = Array.from(
    { length: count - base.length },
    (_, i) => {
      const mentorAt = now - ((i % 4) + 1) * DAY;
      const menteeAt = now - ((i % 3) + 1) * DAY - 6 * 60 * MIN;
      return {
        id: `m-extra-${i}`,
        name: EXTRA_NAMES[i % EXTRA_NAMES.length],
        matchedAt: now - (20 + i * 9) * DAY,
        mentorLastSentAt: mentorAt,
        menteeLastSentAt: menteeAt,
        escalation: null,
        videoCount30d: i % 5 === 0 ? 2 : 0,
      };
    }
  );
  return [...base, ...extras];
}

/**
 * Avg response time → a sentence, never a raw number (TODO-COPY: voice pass).
 * <15m "within minutes", <3h "within a few hours", <24h "within a day",
 * else "replies can take more than a day".
 */
export function responseBucket(minutes: number): string {
  if (minutes < 15) return "Usually replies within minutes";
  if (minutes < 180) return "Usually replies within a few hours";
  if (minutes < 1440) return "Usually replies within a day";
  return "Replies can take more than a day";
}
