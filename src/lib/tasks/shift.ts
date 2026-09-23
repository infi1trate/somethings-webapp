// ═══ THE SHIFT — what a supervisor's day is shaped like ═══
//
// ═══ WHAT THIS FILE WAS, AND WHY MOST OF IT IS GONE (Phase 4) ═══
//
// It was Home's whole model: a four-stage LADDER (`SHIFT_STAGES`,
// `ladderStageFor`, `ladderTargetFor`, `shiftStagesFor`), the shift digest
// (`digestLinesFor`), and `ShiftFacts` with nine fields to feed them. Its
// argument was good and is worth keeping in one place:
//
//   Obligation comes from PROGRESSION, not from a count reaching zero. Tasks
//   empties and the flag queue never does — 43 open on a typical shift, 123 on a
//   heavy one — so a surface measuring either by "is it zero yet" asks for
//   something unreachable on one of them, and inbox-zero pressure applied to
//   ambient clinical work is how flags become a thing somebody stops looking at.
//
// Phase 3 replaced that surface. Today is a MIRROR: one card per destination,
// every figure computed by the destination that owns it, and "start here" read
// off the cards rather than from a ladder over `ShiftFacts`. The ladder's
// non-punitive instincts carried over — a card's `breach` tone is reserved for a
// published clock, two destinations cannot breach at all, and Coverage is never
// coloured — see `lib/home/today.ts`.
//
// ═══ AND FIVE OF `ShiftFacts`' FIELDS WERE THE TIER TAXONOMY ═══
//
// `imminentOpen` · `imminentBreached` · `clinicalOpen` · `clinicalBreached` ·
// `routineOpen`. Gap row 413 kept them one phase longer than their reader, on
// purpose: they ARE the per-flag tier assignment this phase is required to grep
// to zero, and deleting them alongside the surface would have left the grep
// nothing to find. They are what is being removed here.
//
// ═══ WHAT REMAINS, AND WHO READS IT ═══
//
// `shiftFactsFor` — Today's Care Reviews card reads `.billing`, and `ClosedToday`
// reads `.closedToday`. `isNewShift` / `SHIFT_GAP_MS` — the once-per-shift gate
// on the digest panel. Nothing else.
//
// ═══ WHAT THIS STILL DELIBERATELY DOES NOT COMPUTE ═══
//
// No trend, no streak, no coverage-over-time, nothing comparative across
// supervisors. A chart of whether somebody kept pace is a performance surface,
// and the punitive dimension of this role is a known sensitivity. Today's
// position and recency only. If a function here ever takes a date RANGE, that is
// the line being crossed.

import { closedToday, headerCounts, openTasks } from "@/lib/tasks/sort";
import type { TaskItem } from "@/lib/tasks/types";

export interface ShiftFacts {
  /** Billing's open and overdue counts, from Care Reviews' own `headerCounts` —
   *  which is what makes Today's card a mirror rather than a second opinion. */
  billing: { open: number; overdue: number };
  /** Closures per domain, today. Read by `ClosedToday`, which is deliberately
   *  the quietest thing on Today: the moment a count of what somebody got
   *  through is given weight, the route starts measuring output. */
  closedToday: Partial<Record<string, number>>;
}

/** EVERY NUMBER TODAY SHOWS, FROM THE SURFACES' OWN FUNCTIONS. Nothing here
 *  counts anything a destination does not already count the same way — a Today
 *  that disagreed with Care Reviews about how many reviews are open would be
 *  worse than a Today with no counts. */
export function shiftFactsFor(items: TaskItem[], now: number): ShiftFacts {
  const open = openTasks(items);
  return {
    billing: headerCounts(
      open.filter((i) => i.domain === "billing"),
      now
    ),
    closedToday: closedToday(items, now),
  };
}

/** ═══ EIGHT HOURS — A SHIFT, NOT A DAY ═══
 *  The gate on the shift-start panel. Eight hours rather than a calendar day
 *  because a supervisor working an evening into a morning should meet it once
 *  rather than twice, and one working two short days should meet it twice rather
 *  than once. */
export const SHIFT_GAP_MS = 8 * 60 * 60 * 1000;

export function isNewShift(lastSeenAt: number, now: number): boolean {
  return now - lastSeenAt >= SHIFT_GAP_MS;
}
