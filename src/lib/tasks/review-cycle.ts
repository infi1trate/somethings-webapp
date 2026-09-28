// ═══════════════════════════════════════════════════════════════════════════
// THE REVIEW CYCLE (Care Reviews rework §6.1)
//
// ═══ WHAT WAS ASKED FOR, AND WHAT THE MODEL ACTUALLY HOLDS ═══
//
// §6.1 asks for a column whose values are "30-day, 60-day, 90-day, 120-day,
// 150-day, and onward" — an even 30-day series. Brandon's answer to the audit
// was that this is tracked in relation to how reviews are delivered and is
// "maybe alluded to on the care page, but maybe no formal inclusion in the
// model yet". Both halves are right, and the allusion is more specific than the
// series:
//
//   `CadenceStage = "intake" | "day30" | "quarterly"` in `care-demo.ts`, whose
//   labels name THE REVIEW THAT IS DUE:
//     intake     → the day-30 review is next
//     day30      → the first 90-day review is next (day 30 + 90 = day 120)
//     quarterly  → every 90-day review after that
//
// SO THE REAL INCREMENTS ARE 30, 120, 210, 300 … — day 30, then every 90 days.
// There is no 60-day review and no 150-day review. That module records the
// defect it cost to learn this: the chip once read "due in 8 days · Day 30" on
// a teen 134 days in, because the label named the stage behind you rather than
// the review ahead, and it was reported twice from the app.
//
// THIS FILE FORMALISES THAT CADENCE AND DOES NOT INVENT THE MISSING STEPS. A
// "60-day review" on a clinical surface would be a delivery schedule this
// product does not run, rendered authoritatively. If the even series is what
// Meg actually schedules, the table below is the one place to change.
//
// ═══ WHY IT IS A FIELD ON THE PAYLOAD AND NOT A LOOKUP ═══
//
// `cadenceFor` derives the Care page's stage from `CARE_PROFILES`, keyed by
// RECORD teen ids (`t5`, `t10`…). Care Reviews' items carry task-roster ids
// (`tk-riley`…) and the two namespaces have ZERO overlap — gap 432, pinned by
// `teen-namespaces.test.ts`. So the stage is not reachable from a task item by
// lookup, and bridging the namespaces is a data-model change this pack does not
// own. The cycle travels ON the item instead, which is also what makes it
// sortable without a join.

/** The survey day a review falls on. `30` is the first; every one after is the
 *  previous plus 90. */
export type ReviewCycleDay = number;

/** The first review, then the recurring interval. Both from `care-demo.ts`'s
 *  own derivation — see the module note. */
export const FIRST_CYCLE_DAY = 30;
export const CYCLE_INTERVAL_DAYS = 90;

/** ═══ THE CYCLES THIS PRODUCT ACTUALLY SCHEDULES ═══
 *  Generated rather than listed, so the sequence cannot drift from the two
 *  constants above and a sixth entry is not a hand-typed number. */
export function cycleDays(count = 6): ReviewCycleDay[] {
  return Array.from(
    { length: count },
    (_, i) => FIRST_CYCLE_DAY + i * CYCLE_INTERVAL_DAYS
  );
}

/** NEEDS-COPY-NICOLE. The column's cell value — "30-day", "120-day".
 *
 *  THE COLUMN IS `Review` AND THE VALUE CARRIES `-day` (§6.2, confirmed). The
 *  header is the taxonomy's name and the cell is a position in it, which is why
 *  the cell does not repeat the word "review" — "30-day review" under a header
 *  reading `Review` is the noun twice. */
export function cycleLabel(day: ReviewCycleDay): string {
  return `${day}-day`;
}

/** Sort key for §3's `Review` column. The DAY, not the label — sorting the
 *  label is a lexicographic sort that puts "120-day" before "30-day". */
export function cycleSortKey(day: ReviewCycleDay | null): number {
  /* Null last in ascending order rather than first: an item with no cycle is
     not the earliest cycle, it is unknown. */
  return day ?? Number.POSITIVE_INFINITY;
}

/** Whether a day is one the cadence can actually produce. Exported for the
 *  fixture test — a seeded `60` would render plausibly and be wrong. */
export function isCycleDay(day: number): boolean {
  if (day < FIRST_CYCLE_DAY) return false;
  return (day - FIRST_CYCLE_DAY) % CYCLE_INTERVAL_DAYS === 0;
}
