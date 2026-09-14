// ═══ WHAT A ROW LEADS WITH, AND WHY THE TWO SURFACES DIFFER ═══
//
// ═══ THE DIAGNOSIS (arch-D) ═══
//
// Tasks and Monitoring were rendering near-identical rows despite having OPPOSITE
// units of work:
//
//   TASKS       the unit is the REVIEW; the person is its subject. The question
//               a supervisor is asking is WHAT IS OWED, AND WHEN.
//   MONITORING  the unit is the PERSON; flags are evidence. The question is
//               WHO IS CARRYING SIGNAL.
//
// Both rows led with a name and every element sat at the same weight, which
// flattened that distinction and made a completion queue read like a directory of
// people. The unit of work was correct in both places — `monitoringEntriesFor`
// coalesces by teen, `listEntriesFor` does not — and only the visual emphasis was
// wrong.
//
// ═══ EMPHASIS FOLLOWS OBLIGATION, WHICH IS THE RULE ALREADY GOVERNING THE UNIT ═══
//
// arch-B decided the unit of review by asking what a group row costs: a coalesced
// row hides its members behind a count, which is right for accumulating low-tier
// signal and wrong for a flag with a 24-hour deadline. The same question answers
// this one, so the same predicate does — a row whose tier coalesces by teen is a
// PICTURE and leads with the person; a row whose tier does not is a DEADLINE and
// leads with the countdown.
//
// Deriving it rather than declaring it per surface is what stops the two from
// drifting. Monitoring's Imminent rows take the Tasks emphasis, and that is not an
// exception bolted on — it falls out, because an imminent flag is individual and
// deadline-bearing for exactly the reason it is never coalesced.
//
// ═══ ONE EMPHASISED ELEMENT PER ROW, AND IT IS NOT A `font-weight` ═══
//
// MEASURED on the live page: Lausanne renders identically at 400, 500, 600 and
// 700 — "Sofia G. to Victoria Ellery" at 14px is 154.75px wide at every one of
// them, because only the 400 face ships. Every `font-semibold` on these rows was
// already a no-op. Avantt is the same at 400 and 700 for the opposite reason:
// only Bold ships, so asking for any weight gets Bold.
//
// So "the row's strongest weight" is `font-display` (Avantt) at the row's own
// size in `--text-primary`, and everything else is Lausanne in `--text-secondary`
// or `--text-muted`. Face, size and colour are the channels that exist here;
// weight is not one of them.

import { coalescesByTeen } from "@/lib/tasks/monitoring-list";
import type { TaskType } from "@/lib/tasks/types";

export type RowEmphasis = "deadline" | "person";

export function rowEmphasisFor(taskType: TaskType): RowEmphasis {
  /* A TIER THAT GATHERS BY TEEN IS A PICTURE OF A PERSON. Everything else — the
     billing reviews, the imminent flags — is a single piece of work with a clock
     on it. Escalations never reach this function: they have their own row, their
     own states and their own live counters. */
  return coalescesByTeen(taskType) ? "person" : "deadline";
}

/** TODO-COPY. The deadline, in the reader's question.
 *
 *  ═══ THE COUNTDOWN REPLACES ELAPSED AGE, AND THAT IS THE POINT OF arch-D ═══
 *
 *  The row said "2d open". That is strictly less actionable than a countdown —
 *  it tells a supervisor how long something has been sitting, which is history,
 *  where the question this surface answers is when it is due. The pane header
 *  still carries age, so nothing is lost; the row now carries ONE temporal fact
 *  and it is the one the reader is acting on.
 *
 *  FLOORING IS THE SAFE DIRECTION, and it is a decision rather than an inherited
 *  rounding: `elapsedLabel` floors, so 67.5 hours remaining reads "2d". A
 *  deadline that under-promises is the right error — a supervisor who thinks
 *  they have two days and has two and a half loses nothing, and the reverse
 *  costs a breach. */
export function deadlineLabel(
  slaDeadline: number,
  now: number,
  elapsed: (from: number, to: number) => string
): string {
  return slaDeadline > now
    ? `due in ${elapsed(now, slaDeadline)}`
    : `overdue by ${elapsed(slaDeadline, now)}`;
}
