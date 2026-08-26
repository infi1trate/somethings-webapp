// SLA CONFIG — ONE OBJECT. Nothing reads a duration literal outside this file
// (§2.3), and that includes the seed, the comparator, the cards and the pane.
//
// If you are about to write `24 * 60 * 60 * 1000` anywhere in the tasks surface,
// the answer is `slaMsFor(taskType)`.

import { BILLING_REVIEW_SLA_HOURS } from "@/lib/activity/sla";
import type { TaskType } from "@/lib/tasks/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** ═══ THE BILLING SLA CONFLICT — CARRIED, NOT RESOLVED ═══
 *
 *  §2.2 and §8.1: the MO-8 framework table says billing is overdue at 48h, the
 *  Tasks spec says 72h. Unresolved, and it blocks correct breach behaviour in T4
 *  rather than the build.
 *
 *  THE CONSTANT ALREADY EXISTS AND IS REUSED RATHER THAN REDEFINED.
 *  `BILLING_REVIEW_SLA_HOURS` was created for the Activity ledger's own billing
 *  SLA (lib/activity/sla.ts) with the same conflict cited. §2.2 says "implement as
 *  a single named constant" and "do not hardcode the number anywhere else" — a
 *  second constant with the same name in a second file would satisfy the letter of
 *  that and break its point, because the day the conflict is settled someone would
 *  fix one and not the other.
 *
 *  So this re-exports it. One edit settles both surfaces. */
export { BILLING_REVIEW_SLA_HOURS };

/** SLA PER TASK TYPE, in milliseconds. The single source (§2.3).
 *
 *  From §2.2's table:
 *    Escalations   respond ≤5m · docs 24h FROM CLOSE
 *    Risk flags    red 24h · orange 48h
 *    Billing       intake 72h* · monthly re-review 72h*   (*the conflict above)
 *    Monitoring    standard/green 7d
 *
 *  NOTE ON DOCUMENTATION: its clock starts at the escalation's CLOSE, not at the
 *  task's own creation — see `deadlineFor`, which is why that function takes an
 *  explicit start rather than always using `openedAt`. */
export const TASK_SLA_MS: Record<TaskType, number> = {
  activeEscalation: 5 * MINUTE,
  escalationDocumentation: 24 * HOUR,
  redFlagReview: 24 * HOUR,
  orangeFlagReview: 48 * HOUR,
  intakeBillingReview: BILLING_REVIEW_SLA_HOURS * HOUR,
  monthlyReReview: BILLING_REVIEW_SLA_HOURS * HOUR,
  standardFlagReview: 7 * 24 * HOUR,
};

export function slaMsFor(taskType: TaskType): number {
  return TASK_SLA_MS[taskType];
}

/** THE DEADLINE, computed at creation (§2.1).
 *
 *  `clockStart` is normally the task's `openedAt`, and is the escalation's CLOSE
 *  time for documentation tasks. Taking it as a parameter rather than reading
 *  `openedAt` is what stops the documentation clock from silently starting in the
 *  wrong place — the caller has to say which instant it means. */
export function deadlineFor(taskType: TaskType, clockStart: number): number {
  return clockStart + slaMsFor(taskType);
}

/** TODO-COPY. Human SLA label, for the pane header and the breach chip. Derived
 *  from the config so it cannot drift from the number that actually governs. */
export function slaLabelFor(taskType: TaskType): string {
  const ms = slaMsFor(taskType);
  if (ms < HOUR) return `${Math.round(ms / MINUTE)}m`;
  if (ms < 24 * HOUR) return `${Math.round(ms / HOUR)}h`;
  return `${Math.round(ms / (24 * HOUR))}d`;
}
