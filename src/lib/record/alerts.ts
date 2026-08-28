// THE ALERT REGISTRY — one declarative table, the source of truth for every
// current and future consumer of "something on this record wants a person".
//
// Today's consumers: the Overview task regions and the tab badges. Tomorrow's:
// the global Tasks page, the Activity feed, and notification delivery. None of
// those exist yet, and this file is written so that adding them is a matter of
// reading a column rather than re-deriving the rules.
//
// ═══════════════════════════════════════════════════════════════════════════
// PERFORMER · RESPONDER · BYSTANDER — read this before touching `signals`.
//
// One event produces DIFFERENT SIGNALS FOR DIFFERENT PEOPLE, and the difference
// is not severity. It is the person's RELATIONSHIP to the event:
//
//   PERFORMER  — they did it. They get ACTIVITY: a record that it happened,
//                addressed to nobody. "You closed this escalation." A performer
//                must never be notified of their own action; that is how a
//                product ends up telling someone what they just did.
//
//   RESPONDER  — it is waiting on them. They get ACTION: it enters a count, it
//                sits in "Action required", it is work.
//
//   BYSTANDER  — they should know, and need do nothing. They get NOTIFICATION
//                (delivered) or ATTENTION (surfaced quietly in place). "An
//                escalation you raised was resolved."
//
// ACTIVITY AND NOTIFICATION ARE NOT THE SAME THING and must not be flattened
// into one "feed" signal later. Activity is the past tense of something you did.
// Notification is the present tense of something someone else did that concerns
// you. Collapsing them means a supervisor who resolves twenty flags gets twenty
// notifications about themselves — which is exactly the bug this comment exists
// to prevent. If you are here to simplify these five values into three, the
// answer is no.
//
// A fifth value, NONE, means the role does not see the alert at all. It is not a
// weaker notification; it is absence, and it is how domain scoping is expressed
// per-role rather than by filtering on `domain` at every call site.
// ═══════════════════════════════════════════════════════════════════════════

/** The tiers this product routes work to. Mirrors the persona columns in
 *  permission-map, deliberately — a sixth tier would have to be added in both,
 *  and having the compiler say so is the point. */
export type AlertRole = "mentor" | "leadMentor" | "supervisor";

/** See the pattern comment above. Ordered loudest to quietest. */
export type AlertSignal =
  /** Work. Enters counts, renders in "Action required". */
  | "action"
  /** Worth knowing, in place, now. Renders in "Worth a look". Never counted. */
  | "attention"
  /** The past tense of something this role DID. Feed-only, never a count. */
  | "activity"
  /** Something someone else did that concerns this role. Delivery-only. */
  | "notification"
  /** This role does not see it. Absence, not a quieter signal. */
  | "none";

/** Which tab is this alert's natural home — where the full card and its
 *  affordances live. An alert surfaced anywhere else renders as a COMPACT
 *  ROLL-UP ROW pointing here, never as a second full card. */
export type AlertHome = "overview" | "care" | "mentorship" | "activity";

/** WHERE THE ROUTE AFFORDANCE GOES — a superset of AlertHome, because the useful
 *  destination is not always a tab.
 *
 *  "chat" opens the conversation; "none" means there is NOWHERE TO GO and the row
 *  renders no affordance at all. That last value earns its place: an alert whose
 *  home is the tab a reader is already on was rendering a "Overview →" link back
 *  to the current page. A link to where you already are is worse than no link —
 *  it reads as broken rather than as absent. */
export type RouteTarget = AlertHome | "chat" | "none";

export interface AlertDef {
  id: string;
  /** WHOSE WORK THIS IS BY DEFAULT — the tier that owns the response. Distinct
   *  from `signals`, which says what each role individually sees. `domain` is
   *  for routing and reporting ("how much supervisor work is outstanding");
   *  `signals` is for rendering. */
  domain: AlertRole;
  /** Per-role signal. TOTAL BY CONSTRUCTION — every role must be named, so a new
   *  alert cannot silently default to invisible or, worse, to action. */
  signals: Record<AlertRole, AlertSignal>;
  /** The tab whose full card owns this alert. */
  contextualHome: AlertHome;
  /** Where the route affordance goes. See RouteTarget — "none" renders no
   *  affordance, which is correct for a fact with no destination. */
  routeTarget: RouteTarget;
  /** ONE-LINE DESCRIPTION for the compact roll-up row, with `{}` tokens filled
   *  by the consumer. Tokens in use: {name} the person, {n} a count, {elapsed} a
   *  formatted duration. A template rather than a function so the registry stays
   *  data — a future feed can render these server-side with no React. */
  rollupTemplate: string;
  /** Severity family for the label band. Registry-owned so an alert's tone
   *  cannot drift between the surfaces that render it. */
  severity: "routine" | "warning" | "critical";
  /** TODO-COPY. The label-chip type name. */
  label: string;
  /** REGISTERED BUT NOT REAL. No data source exists; nothing renders. The entry
   *  exists so the alert has an id, a domain and a home the day it does — and so
   *  that "is this missing or just unbuilt?" is answerable from one file.
   *
   *  A future alert MUST render nothing. No stub rows, no fake counts. */
  future?: true;
  /** THE OVERDUE PARTNER. Overdue variants are their own registry entries so a
   *  feed can emit "this went overdue" as its own event with its own timestamp.
   *  The RECORD-LEVEL consumer collapses the pair onto one card — an escalation
   *  and its overdue variant are one object, and two cards for one object is the
   *  page lying about how much is outstanding. See `collapseOverdue`. */
  overdueOf?: string;
}

// ── The table ───────────────────────────────────────────────────────────────
// ORDER IS THE RENDER ORDER within a signal group: escalations, then risk flags,
// then other actions, then roll-ups. `careTasksFor` and the Overview region both
// sort by this array's index rather than re-deriving a priority.

export const ALERTS: AlertDef[] = [
  // ── Escalations. Supervisor work; every tier READS them (rule 1), which is
  // why all three signals are `action` and NOT a descending ladder. The tiers
  // differ in affordances, not in whether the work is visible: a mentor who
  // raised an escalation needs to see it is still open, and moving it to "Worth
  // a look" for them would quietly demote a safety concern to a nicety.
  {
    id: "escalation_open",
    domain: "supervisor",
    signals: { mentor: "action", leadMentor: "action", supervisor: "action" },
    contextualHome: "overview",
    routeTarget: "overview",
    rollupTemplate: "Escalation open on {name}",
    severity: "critical",
    label: "Escalation",
  },
  {
    id: "escalation_overdue",
    overdueOf: "escalation_open",
    domain: "supervisor",
    signals: { mentor: "action", leadMentor: "action", supervisor: "action" },
    contextualHome: "overview",
    routeTarget: "overview",
    rollupTemplate: "Escalation overdue by {elapsed}",
    severity: "critical",
    label: "Escalation",
  },
  {
    id: "risk_flag_open",
    domain: "supervisor",
    signals: { mentor: "action", leadMentor: "action", supervisor: "action" },
    contextualHome: "overview",
    routeTarget: "overview",
    rollupTemplate: "Risk flag open on {name}",
    severity: "warning",
    label: "Risk flag",
  },
  {
    id: "risk_flag_overdue",
    overdueOf: "risk_flag_open",
    domain: "supervisor",
    signals: { mentor: "action", leadMentor: "action", supervisor: "action" },
    contextualHome: "overview",
    routeTarget: "overview",
    // ESCALATION IS THE WORD, NOT A PREDICTION. An overdue risk flag steps to
    // the critical family because it has been waiting, not because anything is
    // forecast to happen.
    rollupTemplate: "Risk flag overdue by {elapsed}",
    severity: "critical",
    label: "Risk flag",
  },
  // ── Presentation review. HOMED IN CARE, so on Overview it is a roll-up row.
  // This is the one alert whose home is not Overview, which makes it the proof
  // case for the roll-up treatment.
  {
    id: "presentation_review_due",
    domain: "supervisor",
    signals: { mentor: "action", leadMentor: "action", supervisor: "action" },
    contextualHome: "care",
    routeTarget: "care",
    rollupTemplate: "Presentation review due",
    severity: "routine",
    label: "Review due",
  },
  {
    id: "presentation_review_overdue",
    overdueOf: "presentation_review_due",
    domain: "supervisor",
    signals: { mentor: "action", leadMentor: "action", supervisor: "action" },
    contextualHome: "care",
    routeTarget: "care",
    rollupTemplate: "Presentation review overdue by {elapsed}",
    severity: "warning",
    label: "Review due",
  },

  // ── ATTENTION TIER. The mentor's day-to-day. None of these is anyone's
  // emergency, and none of them enters a count.
  {
    // Waiting on the TEEN, so it is nobody's action — a survey sent yesterday is
    // not a task, it is a state. Attention for everyone who reads the record.
    id: "survey_outstanding",
    domain: "mentor",
    signals: {
      mentor: "attention",
      leadMentor: "attention",
      supervisor: "attention",
    },
    contextualHome: "care",
    routeTarget: "care",
    rollupTemplate: "{name} has a survey outstanding",
    severity: "routine",
    label: "Survey sent",
  },
  {
    // THE MENTOR'S JOB, and only theirs. Leads and supervisors get `activity`:
    // they can see it happened in a feed, but a supervisor's record view should
    // not carry a nudge addressed to someone else.
    id: "first_hello_pending",
    domain: "mentor",
    signals: {
      mentor: "attention",
      leadMentor: "activity",
      supervisor: "activity",
    },
    contextualHome: "overview",
    // THE ACTUAL NEXT ACTION is to open the chat and type. Routing to the
    // Overview tab a reader is already on would be a link to nowhere.
    routeTarget: "chat",
    rollupTemplate: "Say hi to {name}",
    severity: "routine",
    label: "New match",
  },
  {
    // PURE BYSTANDER CONTENT for staff, and the clearest case for why activity
    // and notification are separate values: the TEEN performed this, so nobody
    // on staff is its performer, and nobody needs to respond.
    id: "activity_completed",
    domain: "mentor",
    signals: {
      mentor: "attention",
      leadMentor: "activity",
      supervisor: "activity",
    },
    contextualHome: "overview",
    // NOTHING TO OPEN. The activity feed is out of scope and a record has no
    // Activity tab, so the row states the fact and offers no affordance rather
    // than pointing at a surface that does not exist.
    routeTarget: "none",
    rollupTemplate: "{name} finished {n} activities",
    severity: "routine",
    label: "Activity",
  },

  // ── NOTIFICATION TIER. Real data exists, but the signal is delivery-only, so
  // nothing renders at the record level this run.
  {
    // The BYSTANDER case in the pattern comment, with real data behind it:
    // resolved flags exist on five teens. The raiser should learn their
    // escalation was closed — as a notification, not as a task, and not on the
    // record they are already looking at.
    id: "escalation_resolved",
    domain: "supervisor",
    signals: {
      mentor: "notification",
      leadMentor: "notification",
      supervisor: "activity",
    },
    contextualHome: "overview",
    routeTarget: "overview",
    rollupTemplate: "Escalation on {name} was resolved",
    severity: "routine",
    label: "Escalation",
  },

  // ── FUTURE-ONLY. Registered, never rendered. See `future`.
  {
    // Audited: zero hits anywhere in the repo for a call note of any kind. There
    // is no record, no field and no route. Registered here so the alert has an
    // identity before it has a table, and so nobody adds a second one.
    id: "call_notes_incomplete",
    domain: "mentor",
    signals: {
      mentor: "action",
      leadMentor: "attention",
      supervisor: "activity",
    },
    contextualHome: "overview",
    routeTarget: "overview",
    rollupTemplate: "Call notes outstanding for {name}",
    severity: "routine",
    label: "Call notes",
    future: true,
  },
  {
    // Distinct from `presentation_review_due`: that is a review of an EXISTING
    // presentation, this is a teen who has never had one assigned. Today the
    // empty state is expressed by the Care page rendering nothing, which is
    // correct and is not an alert.
    id: "billing_code_unassigned",
    domain: "supervisor",
    signals: { mentor: "none", leadMentor: "attention", supervisor: "action" },
    contextualHome: "care",
    routeTarget: "care",
    rollupTemplate: "No primary presentation on file",
    severity: "routine",
    label: "Presentation",
    future: true,
  },
];

// ── Lookups ─────────────────────────────────────────────────────────────────

const BY_ID = new Map(ALERTS.map((a) => [a.id, a]));

export function alertDef(id: string): AlertDef | undefined {
  return BY_ID.get(id);
}

/** Registry index, so every consumer sorts by ONE priority order (the table's
 *  own) instead of each inventing a comparator. Unknown ids sort last. */
export function alertOrder(id: string): number {
  const i = ALERTS.findIndex((a) => a.id === id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** What this role sees for this alert. Returns "none" for an unknown id — a
 *  typo renders nothing rather than defaulting to work. */
export function signalFor(id: string, role: AlertRole): AlertSignal {
  return BY_ID.get(id)?.signals[role] ?? "none";
}

/** Renders at the RECORD level this run? Action and attention do; activity and
 *  notification are feed/delivery signals with no record surface yet, and
 *  `future` entries have no data at all.
 *
 *  Both halves matter: a future entry could carry an action signal (call notes
 *  does), and it still must render nothing. */
export function rendersOnRecord(id: string, role: AlertRole): boolean {
  const def = BY_ID.get(id);
  if (!def || def.future) return false;
  const s = def.signals[role];
  return s === "action" || s === "attention";
}

/** THE ALERTS THAT EXIST BUT CANNOT BE SEEN on a record, per role — reported
 *  rather than left to be discovered. Feeds the audit note in the report and a
 *  dev-time check; deliberately not rendered as UI. */
export function invisibleOnRecord(role: AlertRole): {
  activity: string[];
  notification: string[];
  future: string[];
} {
  return {
    activity: ALERTS.filter(
      (a) => !a.future && a.signals[role] === "activity"
    ).map((a) => a.id),
    notification: ALERTS.filter(
      (a) => !a.future && a.signals[role] === "notification"
    ).map((a) => a.id),
    future: ALERTS.filter((a) => a.future).map((a) => a.id),
  };
}

/** THE OVERDUE COLLAPSE. Given the ids present on a record, drop any base alert
 *  whose overdue variant is also present — the overdue entry supersedes it, and
 *  the card expresses overdue as state rather than as a second card.
 *
 *  The registry keeps both entries because a FEED needs two events with two
 *  timestamps ("opened", then "went overdue"). The RECORD needs one card. Both
 *  are right for their surface; this function is the seam between them. */
export function collapseOverdue(ids: string[]): string[] {
  const present = new Set(ids);
  const superseded = new Set(
    ids
      .map((id) => BY_ID.get(id)?.overdueOf)
      .filter((base): base is string => !!base)
  );
  return ids.filter((id) => !(superseded.has(id) && present.has(id)));
}

/** Persona → alert role. The store's personas are finer-grained than the tiers
 *  work is routed to (admin acts as supervisor; the review personas read). One
 *  mapping, so no consumer re-derives it. */
export function alertRoleFor(
  persona: string | undefined
): AlertRole {
  if (persona === "supervisor" || persona === "admin") return "supervisor";
  if (persona === "lead-mentor") return "leadMentor";
  return "mentor";
}
