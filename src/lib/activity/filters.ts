// FILTERS — applied ON TOP OF the active saved view, never instead of it.
//
// A view is a QUERY (see views.ts); a filter is a narrowing of whatever that
// query returned. So they compose in one direction only: the view decides which
// rows exist, the filter decides which of those you are looking at.
//
// SWITCHING VIEWS RESETS FILTERS. Not a convenience — a correctness rule. The
// filters were answers to the previous question ("of the rows on my caseload,
// only escalations"), and carrying "only escalations" into Network silently
// answers a question nobody asked. `EMPTY_FILTERS` is what a view switch assigns.
//
// TWO FILTERS WIDEN RATHER THAN NARROW, which is why they are their own group in
// the UI and why they are booleans rather than another checkbox list:
//   · includeActions brings ACTION and ATTENTION rows into a view whose `types`
//     exclude them. It reaches past the view's own type list, deliberately.
//   · showCleared surfaces rows the viewer removed. Cleared is never deleted
//     (standing rule 11), so this is a retrieval path and not an undo.

import type { ActivityDomain } from "@/lib/activity/events";

export interface ActivityFilters {
  /** Workflow domains. EMPTY MEANS ALL — an empty checkbox group reads as "no
   *  restriction", not as "show nothing", which is the only interpretation that
   *  makes an untouched filter panel a no-op. */
  domains: ActivityDomain[];
  /** Widens the view's type list to include ACTION and ATTENTION. Off by
   *  default: the default view is a record of what happened, not a queue. */
  includeActions: boolean;
  /** Surfaces cleared rows at reduced emphasis, and turns each row's Clear
   *  action into Restore. */
  showCleared: boolean;
  /** Caseload-scoped. First names only because the activity fixture has no
   *  surnames (gap row 284) — standing rule 6 itself was retired 2026-08-28. */
  teenId: string | null;
  /** A5 — network scope only. Declared here so the filter shape is final and A5
   *  adds a control rather than reshaping every consumer. */
  staffId: string | null;
}

export const EMPTY_FILTERS: ActivityFilters = {
  domains: [],
  includeActions: false,
  showCleared: false,
  teenId: null,
  staffId: null,
};

/** TODO-COPY. The domain checkbox group, in the brief's order. */
export const DOMAIN_FILTERS: Array<{ id: ActivityDomain; label: string }> = [
  { id: "escalation", label: "Escalations" },
  { id: "risk", label: "Risk flags" },
  { id: "billing", label: "Billing" },
  { id: "review", label: "Reviews" },
  { id: "lifecycle", label: "Teen lifecycle" },
];

/** HOW MANY FILTERS ARE ON — the number on the trigger, and the thing that
 *  decides whether Reset appears.
 *
 *  A DOMAIN GROUP COUNTS AS ONE regardless of how many boxes are ticked. The
 *  number answers "how many ways is this list narrowed", and three ticked domains
 *  is one narrowing. Counting them individually would make a reader who ticked
 *  everything see "5 filters" on a list that is not filtered at all. */
export function activeFilterCount(f: ActivityFilters): number {
  let n = 0;
  if (f.domains.length > 0) n += 1;
  if (f.includeActions) n += 1;
  if (f.showCleared) n += 1;
  if (f.teenId) n += 1;
  if (f.staffId) n += 1;
  return n;
}

export function hasActiveFilters(f: ActivityFilters): boolean {
  return activeFilterCount(f) > 0;
}

export function toggleDomain(
  f: ActivityFilters,
  domain: ActivityDomain
): ActivityFilters {
  return {
    ...f,
    domains: f.domains.includes(domain)
      ? f.domains.filter((d) => d !== domain)
      : [...f.domains, domain],
  };
}
