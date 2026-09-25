// ═══════════════════════════════════════════════════════════════════════════
// ONE EXPRESSION PER DESTINATION (Today rebuild, Phase A)
//
// ═══ WHAT THIS FIXES, AND WHAT WAS ALREADY RIGHT ═══
//
// Phase A's premise is that the nav badge and the Today row contradict each
// other. MEASURED across four fixtures before this file existed, they did not:
// Escalations read 2/2, Risk Flags 69/69 and 123/123, Care Reviews 19/19, and a
// zero destination rendered no badge at all. The two named symptoms were real
// and are already closed — the Risk Flags 123-vs-5 divergence was the rail
// ignoring `monitoringScenarioId`, fixed one pass earlier.
//
// SO THE DEFECT THIS FILE CLOSES IS NARROWER AND WORSE: Care Reviews agreed by
// COINCIDENCE. The rail filtered by task type —
//
//     openTasks(items).filter(i => DESTINATION_TYPES["care-reviews"].includes(i.taskType))
//
// — while Today filtered by domain —
//
//     headerCounts(openTasks(items).filter(i => i.domain === "billing"), now).open
//
// Those are equal today because `TASK_DOMAIN` maps exactly `intakeBillingReview`
// and `monthlyReReview` to `"billing"`, which is exactly the destination's type
// list. A third billing-domain type — a corrected claim, a resubmission, an
// appeal — makes them diverge, on a surface whose own subtitle promises "every
// count below belongs to the destination it links to". Two expressions that
// agree by accident are worse than two that disagree, because nothing fails
// while the accident holds.
//
// ═══ WHY IT IS A MAP AND NOT A FUNCTION PER DESTINATION ═══
//
// A `Record<DestinationId, number>` is exhaustive by type: a fourth destination
// added to the union fails to compile here until it is given a count. A
// per-destination helper would let a new destination ship with no count and a
// blank badge, which is the shape of the bug this file exists to prevent.
//
// ═══ THE SEMANTIC, STATED ONCE ═══
//
// OPEN AND ACTIONABLE. Not all-time, not lifetime, not "arrived today". Each
// destination's primitive differs — escalations are RECORDS, flags are EVENTS,
// care reviews are TASK ITEMS — so the three expressions cannot be textually
// identical. What is identical is the question they answer.
//
// AND THERE IS NO ALL-TIME FIGURE TO SEPARATE OUT. Phase A.4 asks for the 123 to
// be moved inside the Risk Flags destination as historical volume. It is not
// historical: `flagPool` filters `status !== "resolved"`, with a comment
// recording that an earlier build "showed 81 rows where 43 were open" and was
// corrected. 123 is the OPEN count on the `heavy-caseload` fixture. Nothing in
// nav or on Today reports a lifetime total, so there is nothing to relocate.

import { DESTINATION_TYPES, type DestinationId } from "@/lib/ia/destinations";
/* `escalationObligations` IS NO LONGER IMPORTED HERE. The count is the length
   of `activeEscalations`, which is the array the age is also read from — see
   that helper. The obligations function is still the destination header's, and
   the test asserts the two agree. */
import {
  isActive,
  isSettled,
  type EscalationRecord,
} from "@/lib/monitoring/escalation";
import { openTasks } from "@/lib/tasks/sort";
import type { TaskItem } from "@/lib/tasks/types";
import type { MonitoringEvent } from "@/lib/monitoring/event";

export interface OpenCountInput {
  /** Task items — the primitive `care-reviews` counts. */
  items: TaskItem[];
  /** `monitoringData(...).events` — the primitive `risk-flags` counts. Already
   *  open-only: `flagPool` drops resolved flags before they become events. */
  events: MonitoringEvent[];
  /** `monitoringData(...).escalations` — the RECORDS, which is what the
   *  Escalations destination renders and opens. Counting the escalation TASK
   *  ITEMS instead is the divergence the rail's own note records: "the rail
   *  badge read 1 while the header two inches to the right read 2". */
  escalations: EscalationRecord[];
  now: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// AND THE SETS THE COUNTS ARE DRAWN FROM (Phase B)
//
// Phase B gives every row "open count + age of oldest". An age is computed over
// a SET, and if that set is not the one the count came from, the row says
// "19 open · oldest 6d ago" where the 6d item is not one of the 19 — the same
// class of defect Phase A closed one level up, one inch further down the row.
//
// So the sets are exported and the counts are their lengths. Not two
// expressions that agree: one array, read twice.

/** The live escalations — unsettled AND active. */
export function activeEscalations(
  escalations: EscalationRecord[],
  now: number
): EscalationRecord[] {
  return escalations.filter((r) => !isSettled(r, now)).filter(isActive);
}

/** The open care reviews, by the IA's own type table — see the note above on
 *  why this is not a `domain` filter. */
export function openCareReviews(items: TaskItem[]): TaskItem[] {
  return openTasks(items).filter((i) =>
    DESTINATION_TYPES["care-reviews"].includes(i.taskType)
  );
}

/* RISK FLAGS NEEDS NO READER. `events` IS the open set already — `flagPool`
   drops resolved flags before they become events — so a helper here would be a
   function that returns its argument. */

/**
 * The open, actionable count for every destination.
 *
 * ONE CALLER PER SURFACE, and both surfaces call this. `app-chrome` reads it for
 * the rail badge; `todayCards` reads it for the row's figure AND for the number
 * inside the row's own sentence, so a row cannot say "19 open" beside a figure
 * of 18.
 */
export function openCounts(input: OpenCountInput): Record<DestinationId, number> {
  const { items, events, escalations, now } = input;
  return {
    /* ACTIVE, NOT AWAITING. The acknowledgement subset is drawn from the actives,
       so adding the two would count one escalation twice.
       THE LENGTH OF THE SET, NOT `escalationObligations(...).active`. Those are
       the same number by construction — `isActive` over the same unsettled list
       is what that function counts — and `open-counts.test.ts` asserts the
       equality across every fixture, so the destination's own header (which
       still calls `escalationObligations`) cannot drift from this badge. */
    escalations: activeEscalations(escalations, now).length,
    "risk-flags": events.length,
    "care-reviews": openCareReviews(items).length,
  };
}
