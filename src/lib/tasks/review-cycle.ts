// ═══════════════════════════════════════════════════════════════════════════
// THE REVIEW CYCLE (Care Reviews rework §6.1, §6.2)
//
// ═══ THREE READINGS OF THIS COLUMN, AND THE THIRD IS THE ONE THAT SHIPPED ═══
//
// FIRST, §6.1's own: "30-day, 60-day, 90-day, 120-day, 150-day, and onward" —
// an even 30-day series. The Care page does not run one, and a "60-day review"
// on a clinical surface is a delivery schedule this product does not have.
//
// SECOND, the survey-day sequence. `care-demo.ts` derives `intake → day-30
// next`, `day30 → day-120 next`, `quarterly → every 90 after`, so the days a
// review actually falls on are 30, 120, 210, 300. I built that first. It is
// accurate and it is the wrong thing to render: "210-day" is a position in a
// survey calendar, not a kind of review, and no supervisor thinks in it.
//
// THIRD — AND THIS IS IT — the Care page already NAMES these, and there are two:
//
//     STAGE_LABEL = { intake: "30-day review",
//                     day30: "90-day review",
//                     quarterly: "90-day review" }
//
// Two stages share the second label, and `care-demo.ts` says that is "correct,
// not a collapse worth avoiding": a teen has one first review and then a
// recurring one. Brandon asked for "the best semantic communication for this",
// and matching the surface that already says it is the strongest available —
// the same object identified the same way everywhere (Nielsen #4), which is
// the argument that drove the shared row component one pack ago.
//
// ═══ WHY THIS NEEDS NO NEW FIELD ═══
//
// The distinction is already in the data. `intakeBillingReview` IS the first
// review and `monthlyReReview` IS a recurring one — the two task types the
// destination holds. So the cycle is DERIVED, like `proposalKindFor` derives
// the request nature, and there is no payload field to seed, migrate, or let
// drift out of step with the type it restates.
//
// An earlier revision of this file exported a `cycleDays` generator and an
// `isCycleDay` guard for the survey-day reading. Both are gone: they answered
// the second reading, and nothing renders a survey day.

import type { TaskType } from "@/lib/tasks/types";

/** The two reviews this cadence runs. Named for the review, not for the stage
 *  you are in — `care-demo.ts` records the off-by-one that naming the stage
 *  cost: its chip read "due in 8 days · Day 30" on a teen 134 days in. */
export type ReviewCycle = "first" | "recurring";

/** NEEDS-COPY-NICOLE, both — and they are the Care page's own strings minus
 *  the noun.
 *
 *  THE CELL DOES NOT SAY "review" (§6.2). The column header is `Review`, so
 *  "30-day review" in the cell under it is the noun twice. The Care page says
 *  the full phrase because it has no such header. */
export const CYCLE_LABEL: Record<ReviewCycle, string> = {
  first: "30-day",
  recurring: "90-day",
};

/** ═══ DERIVED FROM THE TASK TYPE, NOT STORED ═══
 *  `intakeBillingReview` is a teen's first coding review; `monthlyReReview` is
 *  one of the recurring ones. Null for any other type, so a flag or an
 *  escalation that somehow reached this column renders nothing rather than
 *  claiming a cadence it has no part in. */
export function cycleFor(taskType: TaskType): ReviewCycle | null {
  if (taskType === "intakeBillingReview") return "first";
  if (taskType === "monthlyReReview") return "recurring";
  return null;
}

/** The cell's text, or null where there is no cycle. */
export function cycleLabelFor(taskType: TaskType): string | null {
  const c = cycleFor(taskType);
  return c ? CYCLE_LABEL[c] : null;
}

/** ═══ SORT KEY FOR §3's `Review` COLUMN ═══
 *  CYCLE ORDER, which §3 asks for by name — the first review before the
 *  recurring ones. NOT the label: sorting "30-day" and "90-day" as strings
 *  happens to give the same answer here, and would stop doing so the moment a
 *  third cycle existed, because "120-day" sorts before "30-day".
 *  Unknown sorts LAST in ascending order: an item with no cycle is not the
 *  earliest cycle, it is unknown, and unknown must never head a list a reader
 *  is scanning for the soonest review. */
const CYCLE_RANK: Record<ReviewCycle, number> = { first: 0, recurring: 1 };

export function cycleSortKey(taskType: TaskType): number {
  const c = cycleFor(taskType);
  return c ? CYCLE_RANK[c] : Number.POSITIVE_INFINITY;
}
