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
 *  A NON-OPEN ITEM IS NEVER OVERDUE. It has been reviewed; how long it took is
 *  a different question and not one this surface asks. */
export function isOverdue(item: TaskItem, now: number): boolean {
  if (item.status !== "open") return false;
  return now - item.openedAt > CARE_REVIEW_RESPONSE_MS;
}

/** How many of a set are overdue. The set is the caller's — Care Reviews passes
 *  the filtered open list, so the header's figure matches the list a reader is
 *  looking at, the same way the `open` metric already does. */
export function overdueCount(items: readonly TaskItem[], now: number): number {
  let n = 0;
  for (const i of items) if (isOverdue(i, now)) n++;
  return n;
}
