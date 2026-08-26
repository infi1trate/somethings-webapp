// SAVED VIEWS — a view is a QUERY, not a facet.
//
// The distinction matters for what the rail is allowed to do. A facet narrows
// whatever you are already looking at, so facets compose and stack. A saved query
// REPLACES the question: switching from My caseload to Network is not "add
// network", it is "ask a different thing". That is why switching views resets
// filters (A4) rather than carrying them across — the filters were answers to the
// previous question.
//
// A FOURTH VIEW IS ONE ENTRY IN THE ARRAY BELOW. Nothing else needs to change: the
// rail maps over the registry, the query reads the fields, and the default is
// named by id rather than by index.
//
// THERE IS DELIBERATELY NO "CREATE CUSTOM VIEW" CONTROL. Requested, and worth
// keeping: three good saved queries beat a builder that produces a hundred bad
// ones, and a per-user view collection is a persistence and naming problem this
// surface does not need to solve to be useful.

import type { ActivityDomain, AlertType } from "@/lib/activity/events";
import type { ActivityScope } from "@/lib/activity/read-state";

export interface ActivityView {
  id: string;
  /** TODO-COPY */
  label: string;
  scope: ActivityScope;
  /** Which resolved alert types this view admits. Resolution is per viewer
   *  (rule 8), so the SAME view shows different rows to different roles — which
   *  is the point of resolving at read time. */
  types: AlertType[];
  /** Null = every domain. A single domain makes the view a domain ledger. */
  domains: ActivityDomain[] | null;
}

export const ACTIVITY_VIEWS: ActivityView[] = [
  {
    id: "mine",
    /** TODO-COPY. "Caseload" collides with this codebase's vocabulary law, which
     *  reserves the word for the CAPACITY concept and uses "mentees" for people
     *  (see people-demo.ts). The prompt's label is kept verbatim; flagged. */
    label: "My caseload",
    scope: "mine",
    // ACTIVITY + NOTIFICATION only. ACTION rows exist in the ledger and are
    // reachable through A4's "Include actions" filter — they are excluded here so
    // the default view reads as a record of what happened rather than a queue.
    types: ["activity", "notification"],
    domains: null,
  },
  {
    id: "network",
    label: "Network",
    scope: "all",
    // NOTIFICATION only, per the phase prompt. For a supervisor this is
    // structurally the set of rows about other people's teens — see the
    // reconciliation note at the top of resolve-alert-type.ts for why that is
    // non-empty despite "the supervisor column has zero NOTIFICATION events".
    types: ["notification"],
    domains: null,
  },
  {
    id: "billing",
    label: "Billing",
    scope: "all",
    // Every type, one domain: this is the billing ledger, and a code history is
    // only complete if it includes the rows that opened and chased a review as
    // well as the ones that completed it.
    types: ["activity", "notification", "action", "attention"],
    domains: ["billing"],
  },
];

export const DEFAULT_VIEW_ID = "mine";

export function viewById(id: string): ActivityView {
  return (
    ACTIVITY_VIEWS.find((v) => v.id === id) ??
    ACTIVITY_VIEWS.find((v) => v.id === DEFAULT_VIEW_ID)!
  );
}
