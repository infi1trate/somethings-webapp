// THE ACTIVITY LEDGER'S EVENT MODEL.
//
// An ActivityEvent is IMMUTABLE and APPEND-ONLY. It records that a thing happened:
// who, to what, when, and the payload the thing carried. It is not a task, not a
// notification, and not a row in anyone's inbox — those are all readings OF an
// event, and different readers get different ones.
//
// ═══════════════════════════════════════════════════════════════════════════
// NOTE THE ABSENCE: THERE IS NO `alertType` FIELD ON ActivityEvent.
//
// Standing rule 8. Alert type is resolved per viewer at READ time from
// (eventType, viewerRole, viewerRelationshipToObject) — see resolve-alert-type.ts.
// The same ESCALATION_CLOSED row is "activity" to the supervisor who closed it and
// "notification" to the mentor whose teen it was. Storing one answer on the row
// would pick a winner among three readers and be wrong for two of them.
//
// If you are here to add `alertType` because a component needed it and threading
// the viewer through felt like work: thread the viewer through. There is a test
// named after this rule.
// ═══════════════════════════════════════════════════════════════════════════
//
// WHY A SECOND EVENT MODEL, given `CareEvent` and `ActivityItem` already exist:
//   · `CareEvent` (care-demo) is the Care tab's clinical timeline for ONE teen. It
//     is scoped to a record, has no actor/viewer dimension, and its types are
//     clinical (assessment, presentation_assigned) rather than operational.
//   · `ActivityItem` (lib/types) is the MENTOR's profile-review feed. It carries
//     `read` ON THE ROW — the exact shape rules 8 and 9 forbid — and is persisted
//     that way. It is left alone (standing rule 7); this model sits alongside it.
// Neither can carry a cross-teen, multi-role, per-viewer ledger. This one can.

/** The five readings an event can have for a given viewer. See
 *  resolve-alert-type.ts for the join, and the performer/responder/bystander note
 *  in lib/record/alerts.ts for why activity and notification are not the same
 *  thing and must never be flattened together. */
export type AlertType =
  | "action"
  | "attention"
  | "activity"
  | "notification"
  | "none";

/** WORKFLOW DOMAINS — the filter groups in A4's popover, and the glyph families.
 *  One domain per event type, fixed on the type rather than per-event, so a
 *  filter cannot disagree with a glyph. */
export type ActivityDomain =
  | "escalation"
  | "risk"
  | "billing"
  | "review"
  | "lifecycle";

/** Every event type the ledger knows.
 *
 *  SCREAMING_SNAKE because these are wire values that will outlive this
 *  prototype, and because the prompts name them that way (ESCALATION_CLOSED).
 *  They are NEVER rendered — every display string goes through the sentence
 *  builder, and there is a lint-visible test that no raw value reaches a
 *  sentence. */
export type ActivityEventType =
  // ── Escalations
  | "ESCALATION_RAISED"
  | "ESCALATION_CLOSED"
  | "ESCALATION_OVERDUE"
  // ── Risk flags
  | "RISK_FLAG_RAISED"
  | "RISK_FLAG_CLOSED"
  | "RISK_FLAG_OVERDUE"
  // ── Billing
  | "BILLING_REVIEW_OPENED"
  | "BILLING_REVIEW_COMPLETE"
  | "BILLING_REVIEW_OVERDUE"
  // ── Reviews
  | "PRESENTATION_REVIEW_COMPLETE"
  | "SURVEY_COMPLETED"
  // ── Teen lifecycle
  | "TEEN_MATCHED"
  | "TEEN_PAUSED"
  | "TEEN_DEACTIVATED";

export interface ActivityEvent {
  id: string;
  eventType: ActivityEventType;
  /** WHO DID IT. A staff id, or SYSTEM_ACTOR_ID for a machine-generated event. */
  actorId: string;
  /** Kept explicit rather than derived from `actorId === SYSTEM_ACTOR_ID`, because
   *  the row's avatar treatment branches on it (A3 step 7: system-actor events get
   *  a Somethings glyph avatar, not a person) and a display decision should not
   *  depend on a string comparison holding forever. */
  actorType: "staff" | "system";
  objectType: "teen" | "mentor" | "conversation";
  /** For risk-flag events this is the CONVERSATION id, not the teen id — A6
   *  coalesces on (eventType, objectId, day) and one conversation is the thing
   *  that generates thirty flags. `teenId` below stays available for scope and
   *  sentence-building. */
  objectId: string;
  /** ISO 8601. A string, not a number, so a ledger row is human-readable in a
   *  fixture file and in a log line. Parsed once at the query boundary. */
  occurredAt: string;
  /** Everything type-specific. WITHHELD WHOLESALE IN NETWORK SCOPE (rule 12,
   *  A5) — the degrading query omits this key rather than blanking its contents,
   *  so a component cannot accidentally read a field it should not have. */
  payload: Record<string, unknown>;
}

/** The machine actor. One id so "was this a person?" is one comparison. */
export const SYSTEM_ACTOR_ID = "system";

/** Domain per event type. TOTAL BY CONSTRUCTION — a new event type will not
 *  compile without a domain, which is what keeps the A4 filter groups honest. */
export const EVENT_DOMAIN: Record<ActivityEventType, ActivityDomain> = {
  ESCALATION_RAISED: "escalation",
  ESCALATION_CLOSED: "escalation",
  ESCALATION_OVERDUE: "escalation",
  RISK_FLAG_RAISED: "risk",
  RISK_FLAG_CLOSED: "risk",
  RISK_FLAG_OVERDUE: "risk",
  BILLING_REVIEW_OPENED: "billing",
  BILLING_REVIEW_COMPLETE: "billing",
  BILLING_REVIEW_OVERDUE: "billing",
  PRESENTATION_REVIEW_COMPLETE: "review",
  SURVEY_COMPLETED: "review",
  TEEN_MATCHED: "lifecycle",
  TEEN_PAUSED: "lifecycle",
  TEEN_DEACTIVATED: "lifecycle",
};

/** THE SYSTEM-GENERATED TYPES. A3 step 7 states it as "all OVERDUE types", and
 *  this is that list rather than a substring test on the type name — a future
 *  `SURVEY_OVERDUE_REMINDER` raised by a human would break a substring test
 *  silently. */
export const SYSTEM_EVENT_TYPES: ReadonlySet<ActivityEventType> = new Set([
  "ESCALATION_OVERDUE",
  "RISK_FLAG_OVERDUE",
  "BILLING_REVIEW_OVERDUE",
]);

export function isSystemEvent(t: ActivityEventType): boolean {
  return SYSTEM_EVENT_TYPES.has(t);
}

/** The day an event falls on, as a local-date key. A6 never coalesces across a
 *  day divider and A3 groups by day, so both need one definition of "day" —
 *  derived here so a timezone decision lives in exactly one place.
 *
 *  TODO-DATA: local to the RUNTIME's zone. The seed convention is 4:05 PM ET, so
 *  a viewer in another zone sees the dividers fall differently. Real fix is a
 *  viewer-timezone preference; out of scope for these phases. */
export function dayKeyOf(occurredAt: string): string {
  const d = new Date(occurredAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
