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
// Vocabulary law (non-negotiable): always "mentees" for the people;
// escalations name the observable cause ("No reply in 5 days"), never a
// predicted departure; events describe that an exchange happened, never its
// content; numbers describe how mentoring is going, never grade the person.

const MIN = 60_000;
const DAY = 86_400_000;

export interface DemoMentee {
  id: string;
  name: string;
  matchedAt: number; // → relationship length
  lastInteractionAt: number; // → recency ("replied yesterday")
  // Escalation names the observable cause; the 45-day staleness rule is
  // applied by the consumer (escalations older than 45 days do not render).
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
    mentees: [
      {
        id: "m-jordan",
        name: "Jordan T.",
        matchedAt: now - 122 * DAY, // ~4 months
        lastInteractionAt: now - 1 * DAY, // replied yesterday
        escalation: null,
        videoCount30d: 0,
      },
      {
        id: "m-sam",
        name: "Sam K.",
        matchedAt: now - 15 * DAY, // ~2 weeks
        lastInteractionAt: now - 3 * 60 * MIN, // earlier today
        escalation: null,
        videoCount30d: 3, // video-comfort: low chat volume may be video, not absence
      },
      {
        id: "m-riley",
        name: "Riley M.",
        matchedAt: now - 44 * DAY, // ~6 weeks
        lastInteractionAt: now - 5 * DAY,
        escalation: { reason: "No reply in 5 days", at: now - 5 * DAY }, // < 45d → renders
        videoCount30d: 0,
      },
      {
        id: "m-alex",
        name: "Alex P.",
        matchedAt: now - 92 * DAY, // ~3 months
        lastInteractionAt: now - 2 * DAY,
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
  if (d < 14) return `${Math.max(1, d)} days`;
  if (d < 60) return `${Math.round(d / 7)} weeks`;
  return `${Math.round(d / 30)} months`;
}

/** Recency phrase for a mentee's secondary line: "replied yesterday". */
export function recencyPhrase(lastInteractionAt: number, now: number): string {
  return `replied ${relativeAgo(lastInteractionAt, now)}`;
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
