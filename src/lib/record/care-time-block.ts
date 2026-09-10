// THE CARE SUMMARY'S TIME BLOCKS — a VIEWING control, and only that.
//
// ═══ THE BOUNDARY, STATED ONCE HERE AND ONCE AT EVERY CONSUMER ═══
//
// Rail time-block is a viewing control; clinical review windows are
// cadence-anchored and independent.
//
// That sentence is the whole design. A supervisor re-scoping the rail to "last
// 7 days" is asking a question about the record; they are not changing the
// period a review is judged on. The review card's weighted strip, its rationale
// and its survey grid all read `pendingReviewFor`, which derives its window from
// the cadence stage — nothing in this file reaches them, and a test asserts it.
//
// ═══ WHAT THE BLOCKS ARE, AND WHY "ALL" IS NOT A DAY COUNT ═══
//
// Recent / 30 / 90 are trailing windows from today. "All" is the mentorship:
// join date → now. It is `days: null` rather than a big number because a
// mentorship is not 3650 days long, and a window that overshot the join date
// would report engaged days against a period the teen did not exist in.
//
// ═══ THE DEFAULT IS 30 DAYS, AND IT IS A DECISION SOMEONE CAN VETO ═══
//
// Not "All" — which would make the rail's numbers describe a 200-day record on
// first read, and the review it sits beside is a 30- or 90-day judgment. Not
// "Recent" either: seven days of a paused record is mostly zeroes, and an
// opening state that reads as empty teaches a reader the card has nothing.
// Thirty is the shortest block that carries data on most records. Flagged as
// the design lead's call rather than absorbed as an obvious truth.
//
// NO CROSS-SESSION PERSISTENCE. Every fresh open is 30 days. A remembered block
// means the next reader inherits a scope they did not choose and cannot see
// they inherited — the range line says which period, never that it was someone
// else's choice.

import { DEMO_TEENS } from "@/lib/record/people-demo";

const DAY = 86_400_000;

export type CareTimeBlockId = "recent" | "d30" | "d90" | "all";

export interface CareTimeBlock {
  id: CareTimeBlockId;
  /** TODO-COPY, all four. Short enough that four segments fit the rail. */
  label: string;
  /** Trailing days, or null for the whole mentorship. */
  days: number | null;
}

export const CARE_TIME_BLOCKS: readonly CareTimeBlock[] = [
  { id: "recent", label: "Recent", days: 7 },
  { id: "d30", label: "30d", days: 30 },
  { id: "d90", label: "90d", days: 90 },
  { id: "all", label: "All", days: null },
];

/** See the note above — a flagged decision, not a default nobody chose. */
export const DEFAULT_CARE_BLOCK: CareTimeBlockId = "d30";

export const blockById = (id: CareTimeBlockId): CareTimeBlock =>
  CARE_TIME_BLOCKS.find((b) => b.id === id) ?? CARE_TIME_BLOCKS[1];

/** ═══ THE RESOLVED WINDOW FOR A BLOCK ═══
 *
 *  CLAMPED TO THE JOIN DATE, always. A 90-day block on a record 12 days old is
 *  not a 90-day window — it is the 12 days that exist, and reporting "0 engaged
 *  days in 90" against a period the teen was not enrolled for would be counting
 *  absence as a finding. The range line prints the clamped dates, so a reader
 *  sees the real period rather than the label's nominal one.
 *
 *  `firstCycle` IS FALSE FOR EVERY BLOCK. It means "there is no prior code to be
 *  relative to" on the cadence window, and a viewing block cannot answer that
 *  question — see `careSummaryFor`, which keeps reading the CADENCE window for
 *  the new/resolved element's first-cycle test rather than this one. */
export function blockWindowFor(
  teenId: string,
  now: number,
  block: CareTimeBlockId
): { fromAt: number; toAt: number; clamped: boolean } | null {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  if (!teen) return null;
  const joinedAt = now - teen.joinedDaysAgo * DAY;
  const b = blockById(block);
  if (b.days === null) return { fromAt: joinedAt, toAt: now, clamped: false };
  const wanted = now - b.days * DAY;
  return {
    fromAt: Math.max(wanted, joinedAt),
    toAt: now,
    clamped: wanted < joinedAt,
  };
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `Aug 11` — no year, because the range line prints one year at the end. */
const short = (at: number) => {
  const d = new Date(at);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/** ═══ THE ONE SCOPE DECLARATION ON THE CARD ═══
 *
 *  Every section is scoped by the block, and NONE of them says so. One line
 *  under the control states the resolved period, and that is the whole
 *  contract — per-section scope labels would repeat it five times and still
 *  leave a reader checking whether any section disagreed.
 *
 *  AN EN DASH, not a hyphen: it is a range. TODO-COPY.
 *
 *  "FULL MENTORSHIP" ONLY ON `all`. On a trailing block the dates are the
 *  statement; on `all` the dates alone would look like an arbitrary window, so
 *  the suffix names what makes them the endpoints. A CLAMPED trailing block says
 *  so too — "30d" over a 12-day record prints the 12 days and marks them as the
 *  whole mentorship, because that is what they are. */
export function blockRangeLine(
  window: { fromAt: number; toAt: number; clamped: boolean },
  block: CareTimeBlockId
): string {
  const year = new Date(window.toAt).getFullYear();
  const range = `${short(window.fromAt)} – ${short(window.toAt)}, ${year}`;
  const whole = block === "all" || window.clamped;
  /* TODO-COPY */
  return whole ? `${range} · full mentorship` : range;
}
