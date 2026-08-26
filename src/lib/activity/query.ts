// THE FEED QUERY — the only path from events to rows.
//
// Everything the UI renders comes through here, and that is deliberate: standing
// rule 12 says network-scope detail degradation is enforced at the DATA LAYER, not
// by hiding fields in a component. A component that could reach an ActivityEvent
// directly could read a payload it should not have, so it never gets one — it gets
// a FeedRow, which is a projection.
//
// PHASE BOUNDARIES, so the seams are visible:
//   · A3 (this phase) — scope, view types/domains, unread-only, day grouping.
//     FeedRow carries `degraded` and `count`, both wired but always false/1: no
//     row in this phase renders a payload field at all, so nothing can leak yet.
//   · A5 will populate `degraded` and OMIT the payload from the projection.
//   · A6 will populate `count` and collapse groups.
// The shape is final now so those phases add logic rather than reshaping callers.

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
  /** A5 sets this. False everywhere in A3. */
  degraded: boolean;
  /** A6 sets this. Always 1 in A3. */
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
      degraded: false, // A5
      count: 1, // A6
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
