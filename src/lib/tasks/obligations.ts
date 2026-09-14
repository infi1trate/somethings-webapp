// WHAT MONITORING OWES, AS OPPOSED TO WHAT IT HOLDS.
//
// ═══ THIS SURFACE IS COVERAGE-MEASURED, NOT COMPLETION-MEASURED ═══
//
// Tasks empties. Monitoring does not, and must not be built as though it might:
// flags arrive continuously, the routine tier has a seven-day SLA, and a
// supervisor who "finished" Monitoring would only mean they had finished for the
// minute. Every count on this surface is a picture of a caseload at a moment, not
// a pile with a bottom.
//
// That distinction is the whole reason this module exists separately from
// `sort.ts`'s `headerCounts`. Open counts describe the picture. OBLIGATIONS
// describe the debt — the small subset of the picture where a deadline has been
// missed or is about to be, and the only subset worth interrupting someone over.

import { isBreached, type TaskItem } from "@/lib/tasks/types";

export interface MonitoringObligations {
  /** Imminent-tier flags still open past their 24h SLA. */
  imminentBreached: number;
  /** Escalations closed but not written up — due and overdue alike. */
  documentationOpen: number;
  /** …of which the 24h documentation clock has already run out. */
  documentationOverdue: number;
  /** What the badge shows. Zero means nothing is owed, not that nothing is open. */
  total: number;
}

/** ═══ WHY THE BADGE IS NOT AN OPEN COUNT ═══
 *
 *  Because it would never be zero, and a badge that is never zero is not read.
 *
 *  Measured on the shipped fixtures: the flag set runs 43 open on a typical shift
 *  and 123 on a heavy one, against a routine tier whose SLA is seven days. A nav
 *  badge reading "43" on Monday would read "47" on Tuesday and "41" on Wednesday,
 *  and at no point in that week would it have asked the supervisor for anything.
 *  A number that changes constantly and means nothing specific is indistinguishable
 *  from decoration, and within a week it is decoration — the reader stops
 *  resolving it because it has never once been worth resolving.
 *
 *  So this counts DEBT, not volume: an Imminent flag that has run past its
 *  twenty-four hours, and an escalation that has been closed without being written
 *  up. Both are things a named person has already failed to do by a time that has
 *  already passed. Both are actionable in the sense that matters — there is a
 *  specific thing to open and a specific thing to finish — and both go to zero and
 *  stay there when the work is done, which is what makes a non-zero badge mean
 *  something when it appears.
 *
 *  WHAT IS DELIBERATELY EXCLUDED, so nobody adds it back as an oversight:
 *  · Open flags at any tier. Volume, not debt. See above.
 *  · Clinical-review and routine breaches. They breach at 48h and 7d, which is
 *    the normal rhythm of a queue that is worked rather than a failure — badging
 *    them puts the Imminent signal back inside a number that is usually noise.
 *  · Active escalations. They have a five-minute SLA and their own global
 *    interrupt layer; a nav badge is both too slow and too quiet for one, and
 *    counting them here would imply this is where they get handled. They are not
 *    handled here — locked decision 3.
 */
export function monitoringObligations(
  items: TaskItem[],
  now: number
): MonitoringObligations {
  let imminentBreached = 0;
  let documentationOpen = 0;
  let documentationOverdue = 0;

  for (const item of items) {
    // RESOLVED IS NOT OWED. `inProgress` still is: a review someone opened and
    // did not finish is exactly the debt this counts.
    if (item.status === "resolved") continue;

    if (item.taskType === "imminentFlagReview" && isBreached(item, now)) {
      imminentBreached += 1;
      continue;
    }
    if (item.taskType === "escalationDocumentation") {
      documentationOpen += 1;
      // The clock started at the escalation's CLOSE, not at the task's creation
      // — see `deadlineFor`. `isBreached` reads `slaDeadline`, which already
      // carries that, so this cannot silently measure from the wrong instant.
      if (isBreached(item, now)) documentationOverdue += 1;
    }
  }

  return {
    imminentBreached,
    documentationOpen,
    documentationOverdue,
    total: imminentBreached + documentationOpen,
  };
}
