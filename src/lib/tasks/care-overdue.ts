// ═══════════════════════════════════════════════════════════════════════════
// OVERDUE ON CARE REVIEWS (rework §2, §5.3)
//
// ═══ THE RULE, AS ANSWERED ═══
//
// "Overdue is an indicator that an event hasn't been reviewed since reception
// in over 48 hours."
//
// So: an item that is still OPEN and arrived more than 48 hours ago. Two things
// follow, and both matter because §2 spent a page warning against the wrong
// one:
//
//  1 · IT IS NOT A DEADLINE, AND `CARE_REVIEW_SLA` STAYS RETIRED. A deadline is
//      a date a review is DUE, derived from a cycle — that is what was removed
//      on Brandon's instruction ("we dont really have a notion of a deadline"),
//      what the Figma's `Due date` column reintroduced, and what §2 flagged. It
//      is still gone. This is a RESPONSE-TIME threshold on reception: nothing
//      here says when a review ought to happen, only that one has sat unlooked
//      at for two days.
//      The distinction is not pedantry — `TASK_SLA_MS` is read by `compareTasks`
//      and by breach treatment across three surfaces. Putting 48h there would
//      re-order the queue and re-introduce breach chips on rows, which is the
//      state two phases removed.
//
//  2 · IT IS NOT AGE. §2: "Do not derive a deadline from review age. Age and
//      overdue are different facts and conflating them produces a number that
//      looks authoritative and is invented." Age is a fact about every item,
//      open or not. Overdue is a fact about items that are STILL OPEN — a
//      submitted review that took three days is not overdue, it is done. That
//      is why `isOverdue` takes the item's status and not just its timestamp,
//      and why the count is over the open set.
//
// ═══ THE THRESHOLD IS NAMED, NOT INLINE ═══
//
// 48 hours, from the answer. Meg's 48h/72h question is about the BILLING SLA
// and is a different number on a different concept; this one is not blocked on
// it. Named here so the day it changes there is one place to change and one
// test to update.

import type { TaskItem } from "@/lib/tasks/types";

/** ═══ 48 HOURS SINCE RECEPTION ═══
 *  NEEDS-COPY-NICOLE on the label that renders it, not on the number.
 *  DELIBERATELY NOT IN `sla.ts`. That module holds `TASK_SLA_MS`, which
 *  `compareTasks` orders by and which breach treatment reads — see the module
 *  note on why this is not that. */
export const CARE_REVIEW_RESPONSE_MS = 48 * 60 * 60 * 1000;

/** Whether an open item has gone unreviewed past the threshold.
 *
 *  A NON-OPEN ITEM IS NEVER OVERDUE BY THIS FUNCTION, and that is still right —
 *  see `wasLate` below for the question a closed item answers. The module note
 *  above said "how long it took is a different question and not one this
 *  surface asks", and the surface asks it now; what survives is that it is a
 *  DIFFERENT question, so it is a different function. */
export function isOverdue(item: TaskItem, now: number): boolean {
  if (item.status !== "open") return false;
  return now - item.openedAt > CARE_REVIEW_RESPONSE_MS;
}

/** ═══ LATENESS PERSISTS ON `Closed` (row-items §5, answered) ═══
 *
 *  §5: "does a review submitted after its due date stay marked overdue on
 *  `Closed`?" ANSWERED: yes. "Lateness should persist for the compliance
 *  record."
 *
 *  THIS REVERSES A RECORDED DECISION AND THE OLD ONE IS KEPT ABOVE, because its
 *  reasoning is what makes this safe rather than casual. It read: "a submitted
 *  review that took three days is not overdue, it is done." That is true of the
 *  WORKING STATE — nothing is owed any more — and false of the RECORD, which is
 *  what a compliance surface keeps. Both facts are real; the old code could only
 *  express one of them, so it is now two functions and neither has to lie.
 *
 *  IT IS NOT DERIVED FROM `now`, WHICH IS THE WHOLE POINT. An open item's
 *  overdue state moves with the clock; a closed one's is frozen at the instant
 *  it was submitted, so this takes `submittedAt` and never reads the current
 *  time. A late submission stays late tomorrow, and a prompt one cannot become
 *  late by sitting in the Closed tab.
 *
 *  THE SAME 48 HOURS, AND THE SAME RECEPTION ANCHOR, so `Open` and `Closed`
 *  disagree about nothing except which end of the interval they measure to.
 *
 *  `submittedAt` IS A REAL FIELD. `submittedCareReviews` stores
 *  `{ id, at }` — the store has carried the instant all along; the list just
 *  dropped it when mapping to entries. */
export function wasLate(item: TaskItem, submittedAt: number | undefined): boolean {
  /* UNKNOWN IS NOT LATE. A submission the store has no instant for cannot be
     judged, and guessing from `now` would mark every historical row late the
     longer it sat — the exact "number that looks authoritative and is invented"
     the module note warns about. */
  if (submittedAt === undefined) return false;
  return submittedAt - item.openedAt > CARE_REVIEW_RESPONSE_MS;
}

/** How many of a closed set were late. Mirrors `overdueCount` so the chip can
 *  read one shape whichever tab is active. */
export function lateCount(
  items: readonly TaskItem[],
  submittedAt: (id: string) => number | undefined
): number {
  let n = 0;
  for (const i of items) if (wasLate(i, submittedAt(i.id))) n++;
  return n;
}

/** How many of a set are overdue. The set is the caller's — Care Reviews passes
 *  the filtered open list, so the header's figure matches the list a reader is
 *  looking at, the same way the `open` metric already does. */
export function overdueCount(items: readonly TaskItem[], now: number): number {
  let n = 0;
  for (const i of items) if (isOverdue(i, now)) n++;
  return n;
}
