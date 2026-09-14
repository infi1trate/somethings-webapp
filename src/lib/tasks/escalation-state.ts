// ═══ AN ESCALATION'S LIFECYCLE, AND THE WORD "OPEN" ═══
//
// ═══ THE CONTRADICTION THIS EXISTS TO END ═══
//
// A row read "20h open" beside a pane reading "Closed Sep 13". Both were drawn
// from the same fixture and neither was a data error — MEASURED in B0:
//
//   seed.ts        openedAgo: 20 * HOUR
//                  clockStartAgo: 20 * HOUR
//                  closedAt: now - 20 * HOUR
//
// All three are the SAME INSTANT by construction. The escalation closed twenty
// hours ago; the documentation obligation began at that moment; the task's
// `openedAt` records when the obligation began, not when the escalation opened.
// Nothing disagreed except a suffix: `worklist.tsx` and the pane header both
// appended the literal word "open" to an elapsed figure for every row, whatever
// kind of task it was.
//
// WHICH FIELD IS AUTHORITATIVE, stated once so nobody has to re-derive it:
//
//   · `payload.closedAt`   the escalation is CLOSED, and when.
//   · `item.slaDeadline`   when the write-up is due. Computed at creation as
//                          `closedAt + 24h` — see `deadlineFor`, which takes an
//                          explicit clock start precisely so this cannot
//                          silently measure from `openedAt`.
//   · `item.openedAt`      when THIS OBLIGATION began. For a documentation task
//                          it equals `closedAt`. It is not, and has never been,
//                          when the escalation opened.
//
// So the fix is a per-state verb, not a data change. An escalation that is closed
// says so, with the deadline that is actually running.
//
// ═══ THREE STATES, AND THE THIRD IS NOT A NEW KIND OF THING ═══
//
// `active` · `documentationDue` · `documentationOverdue`. The last two are one
// obligation in two conditions — the same write-up, before and after its deadline
// — which is why the badge counts them once (see `monitoringObligations`) and why
// they share a footer action. They are separate STATES because they read
// differently to someone deciding what to do next, and identical states would
// need a modifier chip to say the same thing.
//
// AN ESCALATION IS NOT FINISHED UNTIL IT IS DOCUMENTED. That is the whole reason
// the closed ones stay on this surface: a lifecycle that ended at "closed" would
// drop the write-up on the floor, and preamble open question 2 — whether a
// closed-but-undocumented escalation has a compliance status distinct from open —
// is still with Dr. Nissan and Meg. Nothing here answers it; the states are a
// description of the work, not a compliance model.

import { isBreached, type DocumentationPayload, type TaskItem } from "@/lib/tasks/types";

export type EscalationLifecycle =
  | "active"
  | "documentationDue"
  | "documentationOverdue";

export function isEscalationTask(item: TaskItem): boolean {
  return (
    item.taskType === "activeEscalation" ||
    item.taskType === "escalationDocumentation"
  );
}

export function lifecycleOf(item: TaskItem, now: number): EscalationLifecycle {
  if (item.taskType === "activeEscalation") return "active";
  return isBreached(item, now) ? "documentationOverdue" : "documentationDue";
}

/** TODO-COPY, all three. THE STATE CHIP.
 *
 *  "Closed" LEADS ON BOTH DOCUMENTATION STATES, deliberately: the single most
 *  useful fact about one of these rows is that nobody is in danger right now, and
 *  a chip reading only "Documentation due" makes a reader work out whether the
 *  escalation itself is still running. */
export const LIFECYCLE_LABEL: Record<EscalationLifecycle, string> = {
  active: "Active",
  documentationDue: "Closed · write-up due",
  documentationOverdue: "Closed · write-up overdue",
};

/** Does this state carry the surface's one saturated treatment?
 *
 *  ONLY `active`. The alarm budget has room for exactly one filled red thing and
 *  this is it — a person may be in danger now. An overdue write-up is a
 *  compliance failure about something that is already over, and giving it the
 *  same treatment would spend the budget twice and teach a reader to discount
 *  both. It gets the breach chip every other overdue thing on the surface gets. */
export function isAlarming(state: EscalationLifecycle): boolean {
  return state === "active";
}

/** ═══ THE CLOCK THAT IS ACTUALLY RUNNING ═══
 *
 *  An ACTIVE escalation counts UP from when it opened: the question is how long
 *  someone has been waiting, and there is no deadline to count toward that a
 *  five-minute SLA has not already passed.
 *
 *  A CLOSED one counts DOWN to its write-up deadline, and past it counts up again
 *  as "overdue by". The reader's question changes with the state, so the figure
 *  does too.
 *
 *  Returns the two things a renderer needs and no formatting: the instant to
 *  measure from or to, and which direction it runs. Formatting stays with
 *  `elapsedLabel`, which is already the house format. */
export interface EscalationClock {
  /** "elapsed" counts up from `at`; "remaining" counts down to it; "over" counts
   *  up from a deadline already passed. */
  kind: "elapsed" | "remaining" | "over";
  at: number;
}

export function clockFor(item: TaskItem, now: number): EscalationClock {
  if (item.taskType === "activeEscalation") {
    return { kind: "elapsed", at: item.openedAt };
  }
  return item.slaDeadline > now
    ? { kind: "remaining", at: item.slaDeadline }
    : { kind: "over", at: item.slaDeadline };
}

/** When the escalation closed, for a documentation task. Null for an active one,
 *  which has not closed — expressed as null rather than as `openedAt` so a caller
 *  cannot accidentally print an open escalation's start time under the word
 *  "Closed", which is the exact defect this module exists to end. */
export function closedAtOf(item: TaskItem): number | null {
  if (item.taskType !== "escalationDocumentation") return null;
  return (item.payload as DocumentationPayload).closedAt;
}
