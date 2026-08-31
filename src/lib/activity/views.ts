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
    /** TODO-COPY. RENAMED FROM "Network" by request.
     *
     *  THE ID AND THE INTERNAL VOCABULARY DELIBERATELY DID NOT MOVE. `network` is
     *  one of the three values of `ViewerRelationship`, and standing rules 10 and
     *  12 are written in terms of it ("Network-scope detail degradation is enforced
     *  at the data layer"). Renaming the relationship would edit the vocabulary of
     *  a load-bearing rule, which those rules say to stop and ask about rather than
     *  do in passing. So this is the label only — the one string a reader sees.
     *
     *  NOTE THE COLLISION, since it is worth a decision: the supervisor sidebar
     *  already has a "Team" item (the staff directory). Two different surfaces now
     *  answer to the same word. Flagged in gap row 238. */
    label: "Team",
    scope: "all",
    // NOTIFICATION only, per the phase prompt. For a supervisor this is
    // structurally the set of rows about other people's teens — see the
    // reconciliation note at the top of resolve-alert-type.ts for why that is
    // non-empty despite "the supervisor column has zero NOTIFICATION events".
    types: ["notification"],
    domains: null,
  },
  // ═══ THE BILLING VIEW WAS HERE, AND IT WAS A CATEGORY ERROR ═══
  //
  // `{ id: "billing", scope: "all", domains: ["billing"] }`. The rail is a SCOPE
  // axis — whose mentees am I looking at — and billing is a DOMAIN axis. A tab
  // can only express one combination of the two, so "billing across the team"
  // was reachable and "billing on my caseload" was not, and the rail read as
  // though scope and domain were the same kind of choice.
  //
  // Billing is now the domain FILTER, which composes with either scope.
  //
  // IT ALSO CARRIED A TYPE BREADTH THE FILTER AXIS DOES NOT EXPRESS, and that is
  // the part worth keeping: it admitted all four alert types, because "a code
  // history is only complete if it includes the rows that opened and chased a
  // review as well as the ones that completed it." That property now belongs to
  // the domain filter itself — see `admittedTypes` in `query.ts`. Without that,
  // filtering to billing on My caseload would have hidden every opened and
  // overdue row and quietly returned a shorter ledger than the tab did.
];

export const DEFAULT_VIEW_ID = "mine";

/** ═══ FORGIVING, BECAUSE ITS INPUT IS A URL ═══
 *
 *  `?scope=` comes from outside the program — a stale bookmark, a truncated
 *  link, someone typing. Falling back to the default view is the right answer
 *  there: a reader who mistypes a parameter should land on the feed, not on an
 *  error. Keep this for anything reading a query string.
 *
 *  IT IS THE WRONG ANSWER FOR A TEST, which is what row 325 is about. See
 *  `viewByIdStrict`. */
export function viewById(id: string): ActivityView {
  return (
    ACTIVITY_VIEWS.find((v) => v.id === id) ??
    ACTIVITY_VIEWS.find((v) => v.id === DEFAULT_VIEW_ID)!
  );
}

/** ═══ THROWS, BECAUSE A TEST NAMING A VIEW IS ASSERTING IT EXISTS ═══
 *
 *  WHY THIS EXISTS (gap row 325): three tests passed `viewId: "billing"` after
 *  that view was removed, and `viewById` answered with My caseload — so they
 *  carried on passing while querying a different question entirely. ONE of them
 *  failed, by luck: it asserted that degraded rows are present, and `mine` scope
 *  has none by definition. The other two would have passed forever against the
 *  wrong view, which is worse than a red test and much harder to notice.
 *
 *  A fallback is friendly to a URL and hostile to a test. The id in a test is not
 *  untrusted input — it is a claim about the registry, and a claim that has become
 *  false should fail loudly at the moment it becomes false.
 *
 *  The message names the ids that DO exist, because the failure a reader meets is
 *  "billing is gone" and the next question is always "so what do I use instead". */
export function viewByIdStrict(id: string): ActivityView {
  const view = ACTIVITY_VIEWS.find((v) => v.id === id);
  if (!view) {
    throw new Error(
      `Unknown activity view "${id}". Registered views: ${ACTIVITY_VIEWS.map((v) => v.id).join(", ")}. ` +
        `If you are reaching for a DOMAIN (billing), that is a filter and not a view — see gap row 325.`
    );
  }
  return view;
}

/** ═══ READING DENSITY (A11) ═══
 *
 *  Two settings, and they are not the same list at two sizes:
 *
 *    dense     one container, internal dividers, ONE LINE per row (~52px).
 *              [leading element] [event sentence] [timestamp]
 *    detailed  per-row cards with gaps and NO dividers, two or three lines
 *              (~88px). Actor and role and time on line 1, the sentence on line
 *              2, and the object's own context on line 3 when the event carries
 *              any.
 *
 *  SPEC §11 ARGUED AGAINST THIS TOGGLE and is superseded (A11, recorded here
 *  rather than only in a commit message): the argument was that a ledger row is
 *  one sentence with nothing behind it to reveal. The built row turned out to
 *  withhold real context — the code a review landed on, which conversation a flag
 *  was in, how late an overdue thing was — so there IS something for a detailed
 *  mode to show. What §11 correctly rejected was an EVENT DETAIL PANE, which is a
 *  different thing and is A12's business.
 *
 *  IN THIS FILE because density is a property of the QUERY's presentation, not of
 *  a component: the data layer decides what context line 3 may contain, since a
 *  degraded row must not have one at all (rule 12). */
export type ActivityDensity = "dense" | "detailed";

export const DEFAULT_DENSITY: ActivityDensity = "dense";
