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
// THE DEFAULT AND ITS COST ARE RECORDED ON `DEFAULT_CARE_BLOCK` BELOW.
//
// NO CROSS-SESSION PERSISTENCE. Every fresh open is 30 days. A remembered block
// means the next reader inherits a scope they did not choose and cannot see
// they inherited — the range line says which period, never that it was someone
// else's choice.

import { DEMO_TEENS } from "@/lib/record/people-demo";

const DAY = 86_400_000;

export type CareTimeBlockId = "recent" | "d90" | "all";

export interface CareTimeBlock {
  id: CareTimeBlockId;
  /** TODO-COPY, all four. Short enough that four segments fit the rail. */
  label: string;
  /** Trailing days, or null for the whole mentorship. */
  days: number | null;
}

export const CARE_TIME_BLOCKS: readonly CareTimeBlock[] = [
  /* ═══ "7 day" / "90 day" / "All" — FROM THE DESIGN FRAME ═══
     Was "7d · 30d · 90d · All". Two changes, both from the mock:

     THE ABBREVIATION IS SPELLED OUT. "7d" is the shortest possible label and it
     is also the one a reader has to decode; "7 day" is read rather than parsed.
     The segments have the room at `size="md"` — measured, no truncation and no
     wrap at the rail's 380px.

     THE 30-DAY BLOCK IS GONE, on instruction, and it is worth recording what
     that costs: 7 → 90 is now a 13× jump, so a reader who wants "the last
     month" has to choose between a week and a quarter. The cadence windows a
     review is judged on are untouched by this — they never read these blocks —
     so what is lost is a viewing option, not a clinical period. */
  { id: "recent", label: "7 day", days: 7 },
  { id: "d90", label: "90 day", days: 90 },
  { id: "all", label: "All", days: null },
];

/** ═══ THE DEFAULT IS THE 7-DAY BLOCK NOW, BECAUSE 30 NO LONGER EXISTS ═══
 *
 *  It was `d30`, chosen as the shortest block carrying data on most records —
 *  not "All", which would make the rail's numbers describe a 200-day record on
 *  first read, and not "Recent", because seven days of a paused record is mostly
 *  zeroes and an opening state that reads as empty teaches a reader the card has
 *  nothing.
 *
 *  WITH 30 DROPPED THAT ARGUMENT HAS NO CANDIDATE LEFT. Of the two survivors the
 *  frame shows 7 day selected, and the zero state is no longer the problem it
 *  was when that reasoning was written: the stat row renders `0` under a
 *  standing label and the sections below say in words that no content exists for
 *  the window. An empty 7-day view now reads as "nothing this week" rather than
 *  as a broken card. Flagged as the design lead's call either way. */
export const DEFAULT_CARE_BLOCK: CareTimeBlockId = "recent";

/** BY ID, WITH THE DEFAULT AS THE FALLBACK — not `CARE_TIME_BLOCKS[1]`, which
 *  is what this was. A positional fallback silently re-points whenever the list
 *  changes: dropping the 30-day block moved index 1 from `d30` to `d90`, turning
 *  an unknown id into a quarter's worth of window. */
export const blockById = (id: CareTimeBlockId): CareTimeBlock =>
  CARE_TIME_BLOCKS.find((b) => b.id === id) ??
  CARE_TIME_BLOCKS.find((b) => b.id === DEFAULT_CARE_BLOCK)!;

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
 *  THE SUFFIX ONLY ON `all`. On a trailing block the dates are the statement; on
 *  `all` the dates alone would look like an arbitrary window, so the suffix names
 *  what makes them the endpoints. A CLAMPED trailing block says so too — "90 day"
 *  over a 12-day record prints the 12 days and marks them as all the time there
 *  is, because that is what they are.
 *
 *  ═══ "· all time", NOT "· full mentorship" — SHORTENED TO STOP A FOLD ═══
 *
 *  The caption gained a `Reporting Period : ` label from the design frame, and
 *  that prefix costs ~106px of a 338px rail. MEASURED at the shipped styles:
 *  `Reporting Period : Feb 12 – Sep 10, 2026 · full mentorship` is 353px and
 *  wrapped onto a second line on every record carrying the suffix — the All block
 *  everywhere, and every block on a record too short to fill one. Setting the
 *  suffix in the muted label style instead of the bold date style saved 2.4px
 *  (350.6px) and still folded.
 *  "· all time" measures 302.9px, which clears the rail with ~35px in hand at
 *  the widest caption on file. It also reads with the segment above it, which is
 *  labelled "All" — and on a clamped trailing block "all time" is still true:
 *  the seven days asked for resolved to all the time that exists.
 *  WHAT IS LOST: "mentorship" named WHICH span the dates covered. The label now
 *  carries that job ("Reporting Period"), so the suffix only has to say the span
 *  is complete. TODO-COPY. */
export function blockRangeLine(
  window: { fromAt: number; toAt: number; clamped: boolean },
  block: CareTimeBlockId
): string {
  const year = new Date(window.toAt).getFullYear();
  const range = `${short(window.fromAt)} – ${short(window.toAt)}, ${year}`;
  const whole = block === "all" || window.clamped;
  /* TODO-COPY — see the note above on why this is not "full mentorship". */
  return whole ? `${range} · all time` : range;
}
