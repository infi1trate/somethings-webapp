// THE FEED QUERY — the only path from events to rows.
//
// Everything the UI renders comes through here, and that is deliberate: standing
// rule 12 says network-scope detail degradation is enforced at the DATA LAYER, not
// by hiding fields in a component. A component that could reach an ActivityEvent
// directly could read a payload it should not have, so it never gets one — it gets
// a FeedRow, which is a projection.
//
// PHASE BOUNDARIES, so the seams are visible:
//   · A3 — scope, view types/domains, unread-only, day grouping.
//   · A5 — DEGRADATION. `isFullDetail` decides, and the payload is attached or
//     omitted. A degraded row has no payload key at all, so no component can read
//     one by accident. Also fires the third-party access log.
//   · A6 will populate `count` and collapse groups, and must suppress the count
//     on degraded rows — coalescing manufactures a number that no single event
//     carries, and flag volume on one conversation is clinical signal.

import {
  EVENT_DOMAIN,
  dayKeyOf,
  isSystemEvent,
  type ActivityDomain,
  type ActivityEvent,
  type ActivityEventType,
  type AlertType,
} from "@/lib/activity/events";
import {
  getRowState,
  type ActivityScope,
  type ReadOverlay,
  type RowState,
} from "@/lib/activity/read-state";
import {
  relationshipOf,
  resolveAlertType,
  type ActivityViewer,
} from "@/lib/activity/resolve-alert-type";
import {
  absoluteTimestamp,
  dayDividerLabel,
  rowSentence,
  rowTimestamp,
} from "@/lib/activity/sentences";
import { staffFirstName, teenFirstName } from "@/lib/activity/seed";
import { EMPTY_FILTERS, type ActivityFilters } from "@/lib/activity/filters";
import { recordNetworkAccess } from "@/lib/activity/access-log";
import type { ActivityView } from "@/lib/activity/views";

/** What a row renders from. A PROJECTION of one or more events — never an event.
 *
 *  NOTE THE ABSENCE, again: there is no `payload` here and no `alertType` on the
 *  source event. The row gets the resolved type and the sentence, and nothing it
 *  could use to reconstruct clinical detail. */
export interface FeedRow {
  /** Stable key. The event id today; A6's group key when a group collapses. */
  id: string;
  /** Every event this row stands for — what Clear and mark-read act on. One
   *  entry today; A6 fills it. */
  eventIds: string[];
  eventType: ActivityEventType;
  domain: ActivityDomain;
  alertType: AlertType;
  state: RowState;
  /** ISO, the most recent event in the row. */
  occurredAt: string;
  /** Pre-rendered, so the row component owns no grammar. */
  sentence: string;
  timestamp: string;
  absolute: string;
  /** Drives the avatar treatment: a system event gets the Somethings glyph
   *  rather than a person (A3 step 7). */
  actorIsSystem: boolean;
  actorName: string;
  teenName: string;
  /** TRUE WHEN THIS ROW WAS DEGRADED — the viewer is neither the actor nor the
   *  current caseload owner. Its presence tells the component how to render; the
   *  ENFORCEMENT is that `payload` is absent, not that the component checks this. */
  degraded: boolean;
  /** THE PAYLOAD, PRESENT ONLY ON FULL-DETAIL ROWS.
   *
   *  Standing rule 12: degradation is enforced HERE by omitting the key, not in a
   *  component by declining to read it. Billing code values, risk-flag clinical
   *  categories, risk tiers and escalation reasons all live in here, and on a
   *  degraded row there is nothing to hide because there is nothing to have. */
  payload?: Record<string, unknown>;
  /** A6 sets this. Always 1 in A3.
   *
   *  SUPPRESSED ON DEGRADED ROWS (A6): a count is not on A5's withheld-field list
   *  because no individual event carries one — coalescing MANUFACTURES it, and
   *  "7 risk flags in one conversation in one day" is clinical signal assembled
   *  out of rows that were each individually degraded. */
  count: number;
}

export interface FeedDay {
  dayKey: string;
  /** NULL FOR TODAY — the feed opens straight into today with no divider
   *  (A3 step 6). */
  label: string | null;
  rows: FeedRow[];
}

export interface FeedQuery {
  events: ActivityEvent[];
  viewer: ActivityViewer;
  view: ActivityView;
  overlay: ReadOverlay;
  unreadOnly: boolean;
  /** Applied ON TOP OF the view (see filters.ts). Optional so every existing
   *  caller keeps working; absent means no narrowing. */
  filters?: ActivityFilters;
  /** Simulated clock — never Date.now() here, so a fixture renders identically
   *  on any day and the day dividers are stable. */
  now: number;
}

/** THE TYPES A VIEW ADMITS, WIDENED BY `includeActions`.
 *
 *  This reaches PAST the view's own type list on purpose — it is the one filter
 *  that adds rows rather than removing them, which is why it lives in the
 *  "Additional filters" group in the UI rather than among the domain checkboxes. */
function admittedTypes(view: ActivityView, f: ActivityFilters): AlertType[] {
  if (!f.includeActions) return view.types;
  const widened = new Set<AlertType>(view.types);
  widened.add("action");
  widened.add("attention");
  return [...widened];
}

/** ═══ THE DEGRADATION TEST (standing rule 12, A5) ═══
 *
 *  FULL DETAIL if EITHER clause holds:
 *    (a) the viewer IS the actor, or
 *    (b) the viewer currently owns the object's caseload.
 *  Otherwise the row degrades: actor first name, verb, teen first name, and
 *  nothing else.
 *
 *  CLAUSE (a) IS THE LOAD-BEARING ONE and it is easy to miss. Caseload composition
 *  changes. If degradation resolved only against present-day ownership, a
 *  supervisor's OWN past rows would retroactively lose their detail and their
 *  first-person voice the moment a teen was reassigned — in a ledger whose entire
 *  premise is that rows never change. Clause (a) pins self-authored history open
 *  permanently.
 *
 *  NO POINT-IN-TIME RECONSTRUCTION for clause (b), deliberately. Historical
 *  caseload snapshots do not exist in this data model and inventing them inside a
 *  feed query would be a data-modelling decision smuggled in as a rendering fix.
 *  Present-day ownership is the correct approximation for OTHER people's rows, and
 *  clause (a) covers the case that actually matters. */
function isFullDetail(event: ActivityEvent, viewer: ActivityViewer): boolean {
  return relationshipOf(event, viewer) !== "network";
}

/** SCOPE IS A MEMBERSHIP TEST, not a filter over already-resolved rows.
 *
 *  Scope `mine` admits rows the viewer is the actor of OR owns the object of.
 *  Including the actor case is A5's clause (a) at the scope level: a supervisor's
 *  own past row stays in My caseload after the teen is reassigned, because it is
 *  still a record of their own work. Dropping out of the viewer's own ledger the
 *  moment someone else took the teen would be the ledger rewriting itself. */
function inScope(
  event: ActivityEvent,
  viewer: ActivityViewer,
  scope: ActivityScope
): boolean {
  if (scope === "all") return true;
  const rel = relationshipOf(event, viewer);
  return rel === "actor" || rel === "caseload";
}

export function queryFeed({
  events,
  viewer,
  view,
  overlay,
  unreadOnly,
  filters = EMPTY_FILTERS,
  now,
}: FeedQuery): FeedDay[] {
  const rows: FeedRow[] = [];
  const types = admittedTypes(view, filters);
  /** Teens whose rows degraded — the audit log's subject list. */
  const degradedTeenIds = new Set<string>();

  for (const event of events) {
    if (!inScope(event, viewer, view.scope)) continue;

    const domain = EVENT_DOMAIN[event.eventType];
    if (view.domains && !view.domains.includes(domain)) continue;
    // FILTER DOMAINS NARROW WITHIN the view's own domain list. Empty = all.
    if (filters.domains.length > 0 && !filters.domains.includes(domain)) continue;

    // RULE 8 — resolved here, per viewer, at read time. Never stored.
    const alertType = resolveAlertType(event, viewer);
    if (alertType === "none") continue;
    if (!types.includes(alertType)) continue;

    const state = getRowState(overlay, viewer.id, view.scope, event.id);
    // CLEARED ROWS ARE OUT OF THE NORMAL FEED but were never deleted (rule 11).
    // `showCleared` is the retrieval path, and it runs through THIS query rather
    // than reaching around it — so a cleared row can only ever appear because the
    // query returned it.
    if (filters.showCleared) {
      // Cleared view shows ONLY cleared rows. A mixed list would make the
      // reduced-emphasis treatment meaningless — everything would be a mix of
      // two emphases with no way to tell which was which.
      if (state !== "cleared") continue;
    } else if (state === "cleared") {
      continue;
    }
    if (unreadOnly && state !== "unread") continue;

    const teenId =
      typeof event.payload.teenId === "string"
        ? event.payload.teenId
        : event.objectId;
    if (filters.teenId && teenId !== filters.teenId) continue;
    if (filters.staffId && event.actorId !== filters.staffId) continue;
    const teenName = teenFirstName(teenId);
    const actorName = staffFirstName(event.actorId);

    // ── RULE 12. The payload is attached or it is NOT PRESENT. There is no
    //    branch further down that decides whether to render it, because on a
    //    degraded row it does not exist to render.
    const full = isFullDetail(event, viewer);
    if (!full) degradedTeenIds.add(teenId);

    rows.push({
      id: event.id,
      eventIds: [event.id],
      eventType: event.eventType,
      domain,
      alertType,
      state,
      occurredAt: event.occurredAt,
      sentence: rowSentence({
        eventType: event.eventType,
        actorId: event.actorId,
        viewerId: viewer.id,
        teenName,
        actorName,
        onConversation: event.objectType === "conversation",
      }),
      timestamp: rowTimestamp(event.occurredAt),
      absolute: absoluteTimestamp(event.occurredAt),
      actorIsSystem: isSystemEvent(event.eventType) || event.actorType === "system",
      actorName,
      teenName,
      degraded: !full,
      // OMITTED, not blanked, when degraded — see the field comment.
      ...(full ? { payload: event.payload } : {}),
      count: 1, // A6
    });
  }

  // ── THIRD-PARTY ACCESS LOG. Every network-scope load that actually returned
  //    rows about teens outside the viewer's caseload. Fires once per query
  //    rather than once per row: the access is "they opened Network and saw
  //    these", not thirty separate events.
  //
  //    The seam is a marked stub — there is no audit log in this codebase to
  //    route into (see access-log.ts). The call site is here so the coverage is
  //    already right the day one exists.
  if (view.scope === "all" && degradedTeenIds.size > 0) {
    recordNetworkAccess({
      viewerId: viewer.id,
      rowCount: rows.filter((r) => r.degraded).length,
      teenIds: [...degradedTeenIds],
      at: now,
    });
  }

  // Newest first within the whole feed, then split by day. Sorting before
  // grouping means a day's rows are ordered without a second comparator.
  rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const todayKey = dayKeyOf(new Date(now).toISOString());
  const byDay = new Map<string, FeedRow[]>();
  for (const row of rows) {
    const key = dayKeyOf(row.occurredAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(row);
    else byDay.set(key, [row]);
  }

  return [...byDay.entries()].map(([dayKey, dayRows]) => ({
    dayKey,
    label: dayKey === todayKey ? null : dayDividerLabel(dayKey, now),
    rows: dayRows,
  }));
}

/** Every event id currently visible in a view — what the unread badge counts
 *  against, since absent-means-unread makes a count from the overlay alone
 *  impossible. Runs the same query, so the badge and the feed cannot disagree. */
export function visibleEventIds(q: Omit<FeedQuery, "unreadOnly">): string[] {
  return queryFeed({ ...q, unreadOnly: false }).flatMap((d) =>
    d.rows.flatMap((r) => r.eventIds)
  );
}
