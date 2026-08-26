// SLA CONSTANTS — one source of truth, imported by every consumer.
//
// NO EXISTING CONSTANTS TO REUSE. The prompt says "reuse the existing Tasks-page
// SLA constants if they exist rather than defining a second source of truth; if
// they exist, move them here and re-export." They do not exist: there is no Tasks
// page (the `tasks` sidebar item falls through to the /app/[section] unbuilt
// placeholder), and a grep for SLA constants across `src/` returns nothing. So
// this file is the first source of truth rather than the second, and there is
// nothing to move or re-export. Flagged in the report.

/** Hours a billing review may sit before it is late.
 *
 *  CONFLICT — UNRESOLVED. The MO-8 framework says 48 and the Tasks spec says 72.
 *  Neither document is in this repository (see spec §10.3, itself unavailable),
 *  so the conflict cannot be adjudicated here. 72 is used because the phase
 *  prompt specifies it.
 *
 *  EVERY CONSUMER MUST IMPORT THIS CONSTANT. Do not hardcode either number
 *  anywhere — when the conflict is settled it must be one edit, and a hardcoded
 *  48 in a component is exactly the thing that will survive the settlement. */
export const BILLING_REVIEW_SLA_HOURS = 72;

/** Milliseconds, for the comparisons that actually happen in code. Derived rather
 *  than written out so the two can never disagree. */
export const BILLING_REVIEW_SLA_MS = BILLING_REVIEW_SLA_HOURS * 60 * 60 * 1000;

/** True when a billing review opened at `openedAt` is past its SLA at `now`.
 *
 *  Strictly greater, matching the flag-overdue convention already established in
 *  lib/record/record-alerts.ts: something sitting exactly on its threshold is not
 *  yet late, because the boundary belongs to the person who still has today. */
export function isBillingReviewOverdue(openedAt: string, now: number): boolean {
  return now - new Date(openedAt).getTime() > BILLING_REVIEW_SLA_MS;
}
