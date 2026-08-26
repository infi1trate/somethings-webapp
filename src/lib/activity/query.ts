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
//   · A6 — COALESCING. Groups by (eventType, objectId, day), suppresses the count
//     and the disclosure on degraded groups, and never groups across a day.

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
  MIXED_ACTOR_ID,
  absoluteTimestamp,
  dayDividerLabel,
  rowSentenceParts,
  rowTimestamp,
} from "@/lib/activity/sentences";
import { staffFirstName, staffRoleLabel, teenFirstName } from "@/lib/activity/seed";
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
  /** THE SUBJECT-AND-VERB CLAUSE at the head of `sentence`, for A10's unread
   *  emphasis. A PREFIX of `sentence`, always — the component slices the
   *  remainder off rather than being handed it, so the emphasised part and the
   *  full string cannot drift apart or double up. */
  lead: string;
  timestamp: string;
  absolute: string;
  /** THE COALESCING OBJECT — the conversation for risk-flag events, the teen
   *  otherwise. Carried on the row so the group key is derived once, at the point
   *  the event is read, rather than re-derived from objectType downstream. */
  groupObjectId: string;
  /** Whether the sentence takes the conversation preposition. Needed again when a
   *  group rebuilds its sentence. */
  onConversation: boolean;
  /** Drives the avatar treatment: a system event gets the Somethings glyph
   *  rather than a person (A3 step 7). */
  actorIsSystem: boolean;
  /** The actor id, kept so a group can tell whether its members share one. */
  actorId: string;
  /** DID THE VIEWER DO THIS? (A11 avatar economy.)
   *
   *  On roughly 70% of a supervisor's rows the leading avatar was their own
   *  initial, on their own first-person row — the strongest visual slot in the row
   *  spent telling the reader who they are. Those rows drop the avatar and let the
   *  type glyph lead.
   *
   *  RESOLVED HERE rather than by testing the sentence for "You ", which would tie
   *  a layout decision to a string the grammar is free to change. */
  actorIsSelf: boolean;
  actorName: string;
  /** The actor's role, for line 1 of a detailed row. Empty for the system actor —
   *  see `staffRoleLabel`. */
  actorRole: string;
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
  /** ═══ LINE 3 OF A DETAILED ROW: THE OBJECT'S OWN CONTEXT (A11) ═══
   *
   *  Short facts about the thing the event happened to, not about the event.
   *  ABSENT — not empty — on a degraded row, for the same reason `payload` is:
   *  every one of these is drawn from the payload, so a row that has no payload
   *  has no context line to render and no component can assemble one (rule 12).
   *
   *  A11 lists five candidate facts. THREE OF THE FIVE EXIST in this data model:
   *  the billing code, the conversation, and the SLA outcome (plus a survey's
   *  instrument and score, which is the same shape). The teen's mentor and days
   *  since intake DO NOT — the ledger's teen ids are its own invented universe
   *  (`teen-maya`) and do not join to the app's people fixtures (`t5`…`t26`), which
   *  is gap row 207. Rendering "whichever of these the event carries" is what A11
   *  asks for, so the two absent ones are simply never carried; flagged rather
   *  than faked from a lookup that would silently resolve to nothing. */
  context?: string[];
  /** THE DISPLAY COUNT. 1 for an ungrouped row, N for a group — and ALWAYS 1 for
   *  a DEGRADED group, which is the whole of A6's privacy rule.
   *
   *  A count is not on A5's withheld-field list because no individual event
   *  carries one: coalescing MANUFACTURES it. And "7 risk flags on one
   *  conversation in one day" is clinical signal — flag volume is a strong
   *  inference about a teen's state — assembled out of rows that were each
   *  individually degraded. The group leaks what its members do not.
   *
   *  RESIDUAL SURFACE, stated plainly: `eventIds` below still has N entries on a
   *  degraded group, because clearing the group has to clear its members and
   *  there is no server-side group handle to clear by instead. Nothing renders
   *  from its length, and the tests assert the display count and the sentence are
   *  both number-free — but sealing it completely needs a backend that can accept
   *  "clear this group" as one operation. Flagged rather than papered over. */
  count: number;
  /** THE CONSTITUENT ROWS, for the disclosure. ABSENT on a group of one (there is
   *  nothing to disclose) and ABSENT on a degraded group (expanding it would
   *  reveal N identical degraded sentences, so there is nothing behind it worth
   *  opening — the control is dropped rather than disabled). */
  members?: FeedRow[];
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

/** THE BILLING CODE, FOR THE ROW SENTENCE (A9 item 3).
 *
 *  ═══ WHAT WAS ACTUALLY WRONG. A9 offered two candidate causes — clause (a) not
 *  implemented, or the code missing from the payload — and it was neither.
 *  Clause (a) is implemented (`relationshipOf` checks the actor first and wins
 *  outright) and the code is in the payload on every billing fixture. The row
 *  carried it the whole time and NOTHING RENDERED IT: `activity-row.tsx` has no
 *  reference to `payload` at all, and the sentence builder had no clause for a
 *  code. A projection that carries a field nobody reads looks exactly like a
 *  projection that withholds it.
 *
 *  ONLY BILLING_REVIEW_COMPLETE. The other billing types carry a code in the
 *  fixtures too, but a code on an OPENED or OVERDUE row states an outcome that has
 *  not happened yet — the code on those rows is the code under review, and
 *  rendering it as a trailing outcome would say the review had landed. */
/** `sentence` and `lead` from one build, so they cannot disagree.
 *
 *  Spread into the row: `lead` is by construction a prefix of `sentence`, which is
 *  the invariant the component relies on when it slices the remainder off. */
function sentenceFields(input: Parameters<typeof rowSentenceParts>[0]): {
  sentence: string;
  lead: string;
} {
  const { lead, rest } = rowSentenceParts(input);
  return { sentence: lead + rest, lead };
}

/** LINE 3's FACTS, from the payload, in a fixed order.
 *
 *  Returns `{}` rather than `{ context: [] }` when there is nothing to say, so an
 *  empty context and an absent one are the same thing downstream and a detailed
 *  row renders two lines instead of two lines and a gap.
 *
 *  ONLY CALLED ON FULL-DETAIL ROWS. That is the enforcement, not a check inside. */
function contextFieldsOf(event: ActivityEvent): { context?: string[] } {
  const p = event.payload;
  const out: string[] = [];
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);

  // TODO-COPY on every label below.
  const code = str(p.code);
  // Not on a COMPLETE row: the sentence already ends with the code there, and
  // saying it twice on one row reads as two different codes at a glance.
  if (code && event.eventType !== "BILLING_REVIEW_COMPLETE") {
    out.push(`Code under review ${code}`);
  }
  const previous = str(p.previousCode);
  if (previous) out.push(`Was ${previous}`);

  if (event.objectType === "conversation") {
    // The conversation itself, named rather than id-dumped.
    out.push("In a monitored conversation");
  }

  const outcome = str(p.outcome);
  if (outcome) out.push(`Outcome ${outcome}`);
  const late = num(p.hoursLate);
  if (late !== undefined) out.push(`${late}h past its deadline`);

  const instrument = str(p.instrument);
  const score = num(p.score);
  if (instrument) out.push(score !== undefined ? `${instrument} ${score}` : instrument);

  const categories = Array.isArray(p.categories)
    ? p.categories.filter((c): c is string => typeof c === "string")
    : [];
  if (categories.length > 0) {
    // Underscored wire values are never rendered raw.
    out.push(categories.map(humaniseCategory).join(", "));
  }

  const reason = str(p.reason);
  if (reason && reason !== "withheld") out.push(reason);

  return out.length > 0 ? { context: out } : {};
}

/** `HATE_SPEECH_RACIAL_SLURS` → `Hate speech racial slurs`. Sentence case, per the
 *  surface's own rule — and never the raw wire value, which is the same discipline
 *  the sentence builder holds to. */
function humaniseCategory(c: string): string {
  const words = c.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function billingCodeOf(event: ActivityEvent): string | undefined {
  if (event.eventType !== "BILLING_REVIEW_COMPLETE") return undefined;
  const code = event.payload.code;
  return typeof code === "string" ? code : undefined;
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

/** ═══ COALESCING (A6) ═══
 *
 *  GROUP KEY IS (eventType, objectId, day). One conversation can generate thirty
 *  risk flags; ungrouped, one chat buries a day of history.
 *
 *  NOTE THE AXIS. Slack stacks ACTORS against one object ("Eden +18"). This stacks
 *  EVENTS against one object. Actor stacking is deliberately not implemented — no
 *  supervisor event type has multiple actors against one object.
 *
 *  NEVER ACROSS A DAY DIVIDER. Day grouping is the stronger organiser, so this
 *  runs INSIDE each day bucket rather than over the flat list — which makes
 *  cross-day coalescing structurally impossible rather than merely forbidden.
 *
 *  A GROUP OF ONE IS A PLAIN ROW. No disclosure control, no count, no members —
 *  identical to an ungrouped row, because it is one.
 *
 *  MIXED ACTORS. The brief's key does not include the actor, and its premise is
 *  that no supervisor event type has multiple actors against one object. If that
 *  premise ever breaks, "You closed 7" would be a lie when you closed three — so
 *  a mixed-actor group falls back to an agentless sentence rather than crediting
 *  the whole batch to whoever happens to be most recent. */
function coalesceDay(rows: FeedRow[], viewerId: string): FeedRow[] {
  const groups = new Map<string, FeedRow[]>();
  for (const row of rows) {
    // The day is implicit — this only ever runs within one day's bucket.
    const key = `${row.eventType}::${row.groupObjectId}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const out: FeedRow[] = [];
  for (const [key, members] of groups) {
    if (members.length === 1) {
      out.push(members[0]);
      continue;
    }
    // Newest first inside the group; the collapsed row takes the most recent
    // timestamp, because that is when the batch last moved.
    const ordered = [...members].sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt)
    );
    const head = ordered[0];
    const degraded = ordered.some((r) => r.degraded);
    const actors = new Set(ordered.map((r) => r.actorId));
    const singleActor = actors.size === 1 ? head.actorId : null;

    out.push({
      ...head,
      id: `group:${key}`,
      // Every constituent — what Clear and mark-read act on. Clearing a collapsed
      // group clears every member; restoring restores the whole group.
      eventIds: ordered.flatMap((r) => r.eventIds),
      // UNREAD IF ANY CONSTITUENT IS UNREAD.
      state: ordered.some((r) => r.state === "unread")
        ? "unread"
        : ordered.some((r) => r.state === "cleared")
          ? "cleared"
          : "read",
      // DEGRADED GROUP: display count stays 1, so no number can render.
      count: degraded ? 1 : ordered.length,
      degraded,
      // DISCLOSURE DROPPED on a degraded group — nothing behind it worth opening.
      ...(degraded ? {} : { members: ordered }),
      // A MIXED-ACTOR GROUP IS NOBODY'S OWN ROW, so it keeps its leading avatar
      // (which the group's agentless sentence then does not contradict).
      actorIsSelf: singleActor === viewerId,
      // NO CONTEXT LINE ON A GROUP. Its members carry different codes, different
      // categories and different outcomes; showing the newest member's as the
      // group's would state one batch member's facts for all of them. The context
      // is there when the group is expanded.
      context: undefined,
      ...sentenceFields({
        eventType: head.eventType,
        actorId: singleActor ?? MIXED_ACTOR_ID,
        viewerId,
        teenName: head.teenName,
        actorName: singleActor ? head.actorName : "",
        count: ordered.length,
        degraded,
        onConversation: head.onConversation,
        recordVoice: head.alertType === "action",
        // NO CODE ON A GROUP, deliberately. A group's members can carry different
        // codes, and picking the newest one would state a single outcome for a
        // batch that had several. The code appears when the group is expanded.
      }),
    });
  }
  // Re-sort: a group's timestamp is its newest member, which can move it.
  return out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
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
      groupObjectId: event.objectId,
      onConversation: event.objectType === "conversation",
      actorId: event.actorId,
      domain,
      alertType,
      state,
      occurredAt: event.occurredAt,
      ...sentenceFields({
        eventType: event.eventType,
        actorId: event.actorId,
        viewerId: viewer.id,
        teenName,
        actorName,
        onConversation: event.objectType === "conversation",
        // §5.1 (A9 item 2): an ACTION row is open work and takes past-tense
        // record voice, never "You raised…". Resolution happens here, so the
        // sentence builder is told rather than left to guess.
        recordVoice: alertType === "action",
        // A9 item 3. RULE 12 DECIDES THIS, and it decides it here: the code is
        // read from the payload only on a full-detail row, so a degraded row has
        // no code to pass rather than a code the component declines to render.
        billingCode: full ? billingCodeOf(event) : undefined,
      }),
      timestamp: rowTimestamp(event.occurredAt),
      absolute: absoluteTimestamp(event.occurredAt),
      actorIsSystem: isSystemEvent(event.eventType) || event.actorType === "system",
      actorName,
      actorRole: staffRoleLabel(event.actorId),
      teenName,
      degraded: !full,
      actorIsSelf: event.actorId === viewer.id,
      // OMITTED, not blanked, when degraded — see the field comment.
      ...(full ? { payload: event.payload } : {}),
      ...(full ? contextFieldsOf(event) : {}),
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
    // COALESCE WITHIN THE DAY — see coalesceDay. Running it here rather than over
    // the flat list is what makes cross-day grouping impossible by construction.
    rows: coalesceDay(dayRows, viewer.id),
  }));
}

/** Every event id currently visible in a view. Kept for callers that need the
 *  full membership (mark-all-read would use it). NOT what the badge counts — see
 *  `unreadRowCount`. */
export function visibleEventIds(q: Omit<FeedQuery, "unreadOnly">): string[] {
  return queryFeed({ ...q, unreadOnly: false }).flatMap((d) =>
    d.rows.flatMap((r) => r.eventIds)
  );
}

/** THE UNREAD COUNT THE BADGE SHOWS — ROWS, NOT EVENTS.
 *
 *  A GROUP COUNTS AS ONE (A6). Counting its members would tell a supervisor there
 *  are seven things to look at when there is one conversation to open, which is
 *  the same over-counting the coalescing exists to prevent — just moved into the
 *  number.
 *
 *  Reads each row's own `state`, which the coalescer already computed as "unread
 *  if ANY constituent is unread". So the badge cannot disagree with the dot on the
 *  row: both come from the same field. */
export function unreadRowCount(q: Omit<FeedQuery, "unreadOnly">): number {
  return queryFeed({ ...q, unreadOnly: false })
    .flatMap((d) => d.rows)
    .filter((r) => r.state === "unread").length;
}
