// SLA CONFIG — ONE OBJECT. Nothing reads a duration literal outside this file
// (§2.3), and that includes the seed, the comparator, the cards and the pane.
//
// If you are about to write `24 * 60 * 60 * 1000` anywhere in the tasks surface,
// the answer is `slaMsFor(taskType)`.

import type { TaskType } from "@/lib/tasks/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** ═══ THE BILLING SLA CONFLICT IS MOOT — CARE REVIEWS HAVE NO DEADLINE ═══
 *
 *  §2.2 and §8.1 of the original pack disagreed: the MO-8 framework table said
 *  billing was overdue at 48h, the Tasks spec said 72h. It was carried as
 *  `BILLING_REVIEW_SLA_HOURS` with the conflict cited, blocked on Meg.
 *
 *  THE ADDENDUM RETIRES THE QUESTION rather than answering it (§1, §2.9): care
 *  reviews have no deadline concept at all. So there is nothing for the two
 *  numbers to disagree about on this surface, and `CARE_REVIEW_SLA` — which
 *  was the blocked constant standing in for the choice — is gone.
 *
 *  THE ACTIVITY LEDGER STILL RE-EXPORTS ITS OWN. `lib/activity/sla.ts` owns
 *  `BILLING_REVIEW_SLA_HOURS` and uses it for the ledger's billing timeliness
 *  reading, which is a different surface with a different claim. Left alone
 *  and no longer re-exported from here: a constant re-exported by a file that
 *  does not use it is a pointer to a dependency that no longer exists. */

/** SLA PER TASK TYPE, in milliseconds. The single source (§2.3).
 *
 *  From §2.2's table:
 *    Escalations   respond ≤5m · docs 24h FROM CLOSE
 *    Risk flags    imminent 24h · clinical review 48h
 *    Billing       intake 72h* · monthly re-review 72h*   (*the conflict above)
 *
 *  NOTE ON DOCUMENTATION: its clock starts at the escalation's CLOSE, not at the
 *  task's own creation — see `deadlineFor`, which is why that function takes an
 *  explicit start rather than always using `openedAt`. */
/** ═══ THE FLAG ROW IS `null`, WHICH IS THE HONEST VALUE (Phase 4) ═══
 *
 *  It was three rows — 24h, 48h, 7d, one per tier — and they were the clearest
 *  statement of the whole problem this restructure exists to fix: three numbers
 *  nothing published states, keyed on a severity nothing upstream assigns,
 *  populating `TaskItem.slaDeadline` on every flag from the moment it was created.
 *
 *  Every surface that read them has already stopped: arch-mon removed flag
 *  breach from Monitoring, Phase 3 removed it from Today and from the shift
 *  digest. The field itself was the last holder, and a deadline sitting in the
 *  data with no reader is a deadline waiting for one.
 *
 *  SO IT IS `null` AND `deadlineFor` RETURNS null FOR A FLAG. `FLAG_REVIEW_SLA`
 *  is null and blocked on Meg; when it is answered this is one line. Until then
 *  a flag has AGE, which is a fact, and no deadline, which is the truth.
 *
 *  THE ESCALATION ROWS ARE REAL: five minutes and 24 hours, both published, both
 *  enforced. Billing's is published too, even with 48h-vs-72h open. */
/** ═══ AND THE TWO BILLING ROWS ARE `null` NOW TOO (addendum §2.9) ═══
 *
 *  Care reviews have no deadline. That is not "the number is unknown", which
 *  is what `riskFlagReview: null` means while `FLAG_REVIEW_SLA` waits on Meg —
 *  it is that the concept does not apply, and §1 retires `CARE_REVIEW_SLA`
 *  outright rather than leaving it blocked.
 *
 *  WHAT THIS DOES TO THE ORDER, WHICH IS THE ELEGANT PART: `compareTasks`
 *  falls through breach (never, with no deadline), the urgency ladder (flat
 *  within a domain) and `slaRemaining` (Infinity for both) to `openedAt`
 *  ascending — which IS §2.9's "oldest-first by age". The ordering rule did
 *  not need a special case; removing the deadline produced it.
 *
 *  THE ESCALATION ROWS ARE THE ONLY REAL ONES LEFT: five minutes to
 *  acknowledge and 24 hours to write the note, both published, both enforced.
 *  After this file, breach treatment belongs to escalation obligations alone —
 *  which is what arch-mon said when it took breach off flags, now true of the
 *  whole surface. */
export const TASK_SLA_MS: Record<TaskType, number | null> = {
  activeEscalation: 5 * MINUTE,
  escalationDocumentation: 24 * HOUR,
  riskFlagReview: null,
  intakeBillingReview: null,
  monthlyReReview: null,
};

export function slaMsFor(taskType: TaskType): number | null {
  return TASK_SLA_MS[taskType];
}

/** THE DEADLINE, computed at creation (§2.1).
 *
 *  `clockStart` is normally the task's `openedAt`, and is the escalation's CLOSE
 *  time for documentation tasks. Taking it as a parameter rather than reading
 *  `openedAt` is what stops the documentation clock from silently starting in the
 *  wrong place — the caller has to say which instant it means. */
export function deadlineFor(
  taskType: TaskType,
  clockStart: number
): number | null {
  /* ═══ NULL IN, NULL OUT (Phase 4) ═══
     A flag has no published review deadline, so it gets no deadline — rather
     than a plausible one computed from a number this file invented. Every caller
     now has to decide what to do with the absence, which is the point: the three
     fabricated flag SLAs survived four phases precisely because nothing ever had
     to acknowledge them. */
  const ms = slaMsFor(taskType);
  return ms == null ? null : clockStart + ms;
}

/** TODO-COPY. Human SLA label, for the pane header and the breach chip. Derived
 *  from the config so it cannot drift from the number that actually governs. */
export function slaLabelFor(taskType: TaskType): string | null {
  const ms = slaMsFor(taskType);
  /* NO SLA, NO LABEL. An empty string would render as a dangling chip — the
     empty-label-stack defect the production audit recorded — so the absence is
     explicit and the caller omits the chip. */
  if (ms == null) return null;
  if (ms < HOUR) return `${Math.round(ms / MINUTE)}m`;
  // `<=`, not `<`: a 24h SLA reads "24h", not "1d". §3.3's own breach-chip example
  // is "1 past 24h", and the escalation NOTE's SLA is exactly 24 hours — the
  // strict comparison rendered it as "1d", which is the same duration under a
  // name the spec does not use. (The example used to cite the imminent flag's
  // 24h; that number is gone and the note's is the one that carries the case.)
  if (ms <= 24 * HOUR) return `${Math.round(ms / HOUR)}h`;
  return `${Math.round(ms / (24 * HOUR))}d`;
}
