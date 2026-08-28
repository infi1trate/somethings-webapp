// THE BILLING CODE'S FOUR STATES, derived once so the Teens list and any future
// consumer cannot disagree about what "expired" means.
//
// STATUS IS THE TREATMENT OF THE VALUE, NOT A SECOND COLUMN. That is the whole
// design of the cell: one column, and the state changes how the code is rendered
// rather than adding a status column beside it. A code with a status column next to
// it invites a third column for the date and a fourth for the countdown, and the
// list stops being scannable.
//
// NO COUNTDOWN LIVES HERE, and none may be added. A countdown is an OBLIGATION,
// and obligation belongs in Tasks. The SLA constant exists
// (lib/activity/sla.ts BILLING_REVIEW_SLA_HOURS) and is deliberately NOT imported
// by this module — if you find yourself reaching for it to render "18h left" in a
// list cell, that is the signal to stop. This module answers "is it current",
// never "how long have you got".

import {
  cadenceFor,
  pendingReviewFor,
  presentationFor,
  type CareStoreSlice,
} from "@/lib/record/care-demo";

export type BillingCodeState =
  /** A code is on file and current. */
  | { kind: "assigned"; code: string; statement: string }
  /** A review has been proposed and nothing is assigned yet — intake. The cell
   *  shows an em dash plus a muted chip, because there is genuinely no code. */
  | { kind: "pending" }
  /** A code is on file and its review is past due. The code still renders — it is
   *  still the code being billed — with a glyph and a word saying it needs
   *  re-review. */
  | { kind: "expired"; code: string; statement: string; overdueDays: number }
  /** No intake has happened. Distinct from `pending`: nothing has been proposed,
   *  so there is nothing waiting on anyone. */
  | { kind: "none" };

export function billingCodeStateFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): BillingCodeState {
  const presentation = presentationFor(teenId, now, store);
  const cadence = cadenceFor(teenId, now, store);
  const due = cadence.nextReviewDue;
  const overdueDays =
    due != null && now > due ? Math.floor((now - due) / 86_400_000) : 0;

  if (!presentation) {
    // NOTHING ASSIGNED. Pending only if a review is actually proposed —
    // `pendingReviewFor` already returns null on a closed record and before the
    // first survey, so neither can produce a spurious "Pending".
    return pendingReviewFor(teenId, now, store) ? { kind: "pending" } : { kind: "none" };
  }

  if (overdueDays > 0) {
    return {
      kind: "expired",
      code: presentation.code,
      statement: presentation.statement,
      overdueDays,
    };
  }

  return {
    kind: "assigned",
    code: presentation.code,
    statement: presentation.statement,
  };
}

/** THE ACCESSIBLE NAME AND THE TOOLTIP. The cell renders the bare code; this
 *  carries the descriptor.
 *
 *  H0038 IS MEANINGLESS WITHOUT ITS LABEL — but a descriptor COLUMN breaks
 *  "minimal" and would put a diagnostic sentence about a named minor in a
 *  scannable list. So the descriptor lives in the accessible name and the
 *  hover/focus tooltip: available on demand, never on display. */
export function billingCodeDescription(
  state: BillingCodeState,
  teenFirstName: string
): string {
  switch (state.kind) {
    case "assigned":
      /* TODO-COPY */
      return `${teenFirstName}: ${state.code}, ${state.statement}`;
    case "expired":
      /* TODO-COPY. Names the state in WORDS — the glyph is never the only
         channel (WCAG 1.4.1). */
      return `${teenFirstName}: ${state.code}, ${state.statement}. Needs re-review, ${state.overdueDays} ${state.overdueDays === 1 ? "day" : "days"} past due`;
    case "pending":
      /* TODO-COPY */
      return `${teenFirstName}: no code yet, first review pending`;
    case "none":
      /* TODO-COPY */
      return `${teenFirstName}: no intake yet`;
  }
}

/** SORT ORDER for the column. Codes alphabetically; the stateful rows sort AFTER
 *  every assigned code, because a reader sorting by code is looking for codes.
 *  Within the tail, expired before pending before none — most-needing-attention
 *  first, so the sort is still useful when it stops being alphabetical. */
export function billingCodeSortValue(state: BillingCodeState): string {
  switch (state.kind) {
    case "assigned":
      return `0:${state.code}`;
    case "expired":
      // Expired rows keep their code so they still group with their family, but
      // sort into the tail.
      return `1:${state.code}`;
    case "pending":
      return "2:";
    case "none":
      return "3:";
  }
}

/** TODO-COPY. The filter chips on the Teens list — the supervisor's "see all
 *  mentees and their current codes" affordance. */
export const BILLING_CODE_FILTERS = [
  "All codes",
  "Assigned",
  "Needs re-review",
  "Pending",
  "No intake",
] as const;
export type BillingCodeFilter = (typeof BILLING_CODE_FILTERS)[number];

export function matchesBillingFilter(
  state: BillingCodeState,
  filter: BillingCodeFilter
): boolean {
  switch (filter) {
    case "All codes":
      return true;
    case "Assigned":
      return state.kind === "assigned";
    case "Needs re-review":
      return state.kind === "expired";
    case "Pending":
      return state.kind === "pending";
    case "No intake":
      return state.kind === "none";
  }
}

/** WHERE THE CODE LINKS. The object-scoped Activity feed IS the teen's code
 *  history: the ledger is append-only and BILLING_REVIEW_COMPLETE is the only
 *  billing ACTIVITY event, so this filtered feed is the whole record of how the
 *  code got where it is. No separate history model, no separate history screen. */
export function billingHistoryHref(teenId: string): string {
  return `/app/activity?objectId=${encodeURIComponent(teenId)}&domain=billing`;
}
