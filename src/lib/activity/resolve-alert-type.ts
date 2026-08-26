// THE JOIN. One event, three roles, three relationships → one alert type each.
//
// Standing rule 8 lives here. `resolveAlertType` is the ONLY way to learn what an
// event means to a viewer, and nothing writes the answer back onto the event.
//
// ═══════════════════════════════════════════════════════════════════════════
// PROVENANCE OF THIS TABLE — READ BEFORE TRUSTING A CELL.
//
// `activity-page-spec.md` is NOT PRESENT IN THIS REPOSITORY. It was searched for
// in the repo, ~/Desktop, ~/Documents and ~/Downloads and does not exist, so
// §3.2's MO-8 supervisor column could not be transcribed. Rather than invent a
// load-bearing table silently (standing rule 4), every cell below carries a
// provenance marker and the reasoning is stated:
//
//   [GIVEN]   Stated explicitly in a phase prompt. Cite the phase.
//   [DERIVED] Follows from the performer/responder/bystander rule already
//             documented in lib/record/alerts.ts (same taxonomy, same five
//             values, authored from an earlier brief in this project) plus a
//             stated constraint. Mechanical, not a judgement call.
//   [INFERRED] A judgement call. NEEDS §3.2 CONFIRMATION. Flagged in the report.
//
// THE ONE RECONCILIATION WORTH CHECKING. Two prompts appear to contradict:
//   · A3 step 3 seeds "Network" as scope all, types [notification].
//   · A3 step 9 says "the supervisor column has zero NOTIFICATION events".
// Taken flatly, Network is structurally empty for every supervisor forever — and
// A5 then spends a whole phase degrading rows that could never appear.
//
// They reconcile if step 9 is scoped to the CASELOAD relationship, which is the
// only relationship "My caseload" can contain: within scope `mine` the viewer is
// always either the actor or the current owner, never a bystander. So:
//   · supervisor × {actor, caseload} → never "notification"  (step 9 holds, the
//     unread badge would only ever count the supervisor's own actions)
//   · supervisor × network          → "notification"          (step 3 holds, A5
//     has rows to degrade)
// That reading makes all three prompts simultaneously true, and it is the reading
// implemented below. If §3.2 says otherwise, this is the assumption to correct
// first — it is the load-bearing one.
// ═══════════════════════════════════════════════════════════════════════════
//
// WHY THE MENTOR AND LEAD-MENTOR COLUMNS ARE HERE WITH NO CONSUMER. Requested:
// the table is the documentation of the join, and the asymmetry is the point. A
// supervisor's ledger is mostly their own work (activity) plus what needs them
// (action); a mentor's is mostly things other people did to their teens
// (notification). Seeing those columns side by side is what stops someone later
// "simplifying" the resolver into a per-role switch that loses the relationship
// dimension entirely.

import type { ActivityEvent, ActivityEventType, AlertType } from "@/lib/activity/events";

/** The tiers work is routed to. Same three as `AlertRole` in lib/record/alerts.ts,
 *  deliberately — a fourth tier would have to be added in both, and having two
 *  compilers complain is the cheapest possible reminder. */
export type ViewerRole = "mentor" | "leadMentor" | "supervisor";

/** THE THIRD DIMENSION, and the one a per-role switch statement loses.
 *
 *  "actor"    the viewer did this thing themselves
 *  "caseload" the viewer currently owns the object (their teen / their mentor)
 *  "network"  neither — a bystander reading someone else's work
 *
 *  `actor` OUTRANKS `caseload`: a supervisor reading their own past action on a
 *  teen who has since been reassigned still sees it as their own action. That is
 *  A5's clause (a), and it is why this is a three-value axis rather than an
 *  in-caseload boolean. */
export type ViewerRelationship = "actor" | "caseload" | "network";

export interface ActivityViewer {
  id: string;
  role: ViewerRole;
  /** The teens this viewer currently owns. Named `caseloadTeenIds` per the phase
   *  prompt.
   *
   *  VOCABULARY NOTE: elsewhere in this codebase "caseload" is reserved by
   *  vocabulary law for the CAPACITY concept only (see people-demo.ts and
   *  mentees-demo.ts — "always 'mentees' for the people"). This field and the
   *  "My caseload" view label are the prompt's chosen names and are kept
   *  verbatim, but they do collide with that law. Flagged in the report; renaming
   *  is a one-line change here plus the view label. */
  caseloadTeenIds: string[];
}

type Row = Record<ViewerRelationship, AlertType>;
type Column = Record<ViewerRole, Row>;

/** Shorthand so a 14×3×3 table stays readable. Order is always
 *  (actor, caseload, network). */
const r = (actor: AlertType, caseload: AlertType, network: AlertType): Row => ({
  actor,
  caseload,
  network,
});

/** `none` throughout — used where a role has no business with a domain at all
 *  (a mentor and a billing code) and where a cell is structurally unreachable
 *  (a human viewer as the "actor" of a system-generated event). */
const NONE = r("none", "none", "none");

/** Supervisor-shaped row for a thing the supervisor DOES: their own is activity,
 *  a peer's on their caseload is activity, a stranger's is a degraded
 *  notification. Never "notification" in the first two — see step 9 above. */
const SUP_OWN_WORK = r("activity", "activity", "notification");

/** Supervisor-shaped row for a thing that WANTS the supervisor: raising, and
 *  going overdue.
 *
 *  ═══ A9 CORRECTION — THE ACTOR CELL WAS "activity" AND THAT WAS THE ACTION LEAK.
 *
 *  The reasoning for "activity" was that a supervisor who raised the thing was
 *  looking at their own work. It is wrong, and the symptom was
 *  "You raised Maya's escalation." sitting in the default view: `mine` admits
 *  activity + notification, so an "activity" actor cell put every raising the
 *  supervisor had done straight into the record — the exact rows A3 step 8
 *  excludes, and the reason the unread badge over-counted.
 *
 *  A raising is OPEN WORK regardless of who opened it. The identity of the person
 *  who raised it does not change whether the thing still needs someone; it only
 *  changes who to ask. So all three cells that are not a bystander's read as
 *  `action`, and the row is reachable through A4's "Include actions" like every
 *  other action.
 *
 *  This also removes the last place an ACTION row could take first-person voice —
 *  see `recordVoice` in sentences.ts, which §5.1 requires. */
const SUP_WANTS_ACTION = r("action", "action", "notification");

/** Mentor/lead-shaped row for a thing done TO their teen by someone else. */
const STAFF_BYSTANDER = r("activity", "notification", "none");

export const ALERT_TABLE: Record<ActivityEventType, Column> = {
  // ── ESCALATIONS ──────────────────────────────────────────────────────────
  ESCALATION_RAISED: {
    // [DERIVED] responder → action; performer → activity; bystander → notification.
    supervisor: SUP_WANTS_ACTION,
    // [DERIVED] a mentor who raised it needs to see it is still open (the
    // read-wide half of standing rule 1's affordance rule), but it is not theirs
    // to work.
    mentor: STAFF_BYSTANDER,
    leadMentor: STAFF_BYSTANDER,
  },
  ESCALATION_CLOSED: {
    // [GIVEN — Phase A1 step 3] supervisor-who-closed → "activity".
    supervisor: SUP_OWN_WORK,
    // [GIVEN — Phase A1 step 3] mentor → "notification", lead mentor →
    // "notification". This is the row the rule-8 test asserts.
    mentor: STAFF_BYSTANDER,
    leadMentor: STAFF_BYSTANDER,
  },
  ESCALATION_OVERDUE: {
    // [GIVEN — Phase A3 step 7] all OVERDUE types are system-actor, so the
    // `actor` cell is unreachable for any human viewer.
    supervisor: r("none", "action", "notification"),
    mentor: r("none", "notification", "none"),
    // [INFERRED] a lead reads it as attention rather than a notification: they
    // are accountable for the mentor, not for the escalation. NEEDS §3.2.
    leadMentor: r("none", "attention", "none"),
  },

  // ── RISK FLAGS ───────────────────────────────────────────────────────────
  RISK_FLAG_RAISED: {
    // [GIVEN — Phase A6] "RISK FLAG OPENED resolves to ACTION and is filter-only".
    supervisor: SUP_WANTS_ACTION,
    mentor: STAFF_BYSTANDER,
    leadMentor: STAFF_BYSTANDER,
  },
  RISK_FLAG_CLOSED: {
    // [GIVEN — Phase A6] "RISK FLAG CLOSED resolves to ACTIVITY and is in the
    // default view". This is the coalescing case that is visible without
    // toggling "Include actions".
    supervisor: SUP_OWN_WORK,
    mentor: STAFF_BYSTANDER,
    leadMentor: STAFF_BYSTANDER,
  },
  RISK_FLAG_OVERDUE: {
    supervisor: r("none", "action", "notification"),
    mentor: r("none", "notification", "none"),
    leadMentor: r("none", "attention", "none"),
  },

  // ── BILLING ──────────────────────────────────────────────────────────────
  BILLING_REVIEW_OPENED: {
    // [GIVEN — Phase A3 step 7] the ACTION sentence example is "A billing review
    // opened for Jordan." — past-tense record of raising, never imperative.
    supervisor: SUP_WANTS_ACTION,
    // [DERIVED] billing is not a mentor's surface at all. `none` is absence, not
    // a quieter notification — a mentor never sees a billing row.
    mentor: NONE,
    // [INFERRED] a lead sees that it happened, and acts on nothing. NEEDS §3.2.
    leadMentor: r("activity", "attention", "none"),
  },
  BILLING_REVIEW_COMPLETE: {
    // [GIVEN — Phase A8] "BILLING REVIEW COMPLETE is the only billing ACTIVITY
    // event", which is what makes the object-scoped feed a code history.
    supervisor: SUP_OWN_WORK,
    mentor: NONE,
    leadMentor: r("activity", "attention", "none"),
  },
  BILLING_REVIEW_OVERDUE: {
    supervisor: r("none", "action", "notification"),
    mentor: NONE,
    leadMentor: r("none", "attention", "none"),
  },

  // ── REVIEWS ──────────────────────────────────────────────────────────────
  PRESENTATION_REVIEW_COMPLETE: {
    supervisor: SUP_OWN_WORK,
    mentor: STAFF_BYSTANDER,
    leadMentor: STAFF_BYSTANDER,
  },
  SURVEY_COMPLETED: {
    // [DERIVED] the TEEN performed this, so no staff viewer is ever its actor.
    supervisor: r("none", "activity", "notification"),
    // [INFERRED] attention, not notification: worth noticing, asks nothing.
    // NEEDS §3.2.
    mentor: r("none", "attention", "none"),
    leadMentor: r("none", "attention", "none"),
  },

  // ── TEEN LIFECYCLE ───────────────────────────────────────────────────────
  TEEN_MATCHED: {
    supervisor: SUP_OWN_WORK,
    // [INFERRED] attention — this is the "say hi to a new teen" signal, which the
    // record's own Overview regions already treat as attention for the mentor and
    // activity for staff above them. Consistent with lib/record/alerts.ts
    // `first_hello_pending`. NEEDS §3.2.
    mentor: r("activity", "attention", "none"),
    leadMentor: r("activity", "attention", "none"),
  },
  TEEN_PAUSED: {
    supervisor: SUP_OWN_WORK,
    mentor: STAFF_BYSTANDER,
    leadMentor: STAFF_BYSTANDER,
  },
  TEEN_DEACTIVATED: {
    supervisor: SUP_OWN_WORK,
    mentor: STAFF_BYSTANDER,
    leadMentor: STAFF_BYSTANDER,
  },
};

/** THE VIEWER'S RELATIONSHIP TO AN EVENT'S OBJECT.
 *
 *  `actor` is checked FIRST and wins outright. That ordering is A5's clause (a)
 *  and it is load-bearing: caseload composition changes, and without this a
 *  supervisor's own past rows would silently lose their detail and their
 *  first-person voice the moment a teen was reassigned — in a ledger whose whole
 *  premise is that rows never change.
 *
 *  For clause (b) we use PRESENT-DAY ownership deliberately. Point-in-time
 *  caseload reconstruction is not attempted: no historical snapshots exist in this
 *  data model, and inventing them here is out of scope. Present-day ownership is
 *  the right approximation for other people's rows, and clause (a) covers the case
 *  that actually matters. */
export function relationshipOf(
  event: ActivityEvent,
  viewer: ActivityViewer
): ViewerRelationship {
  if (event.actorId === viewer.id) return "actor";
  // The teen the event concerns. Risk-flag events carry a CONVERSATION objectId,
  // so the teen comes from the payload's `teenId` when present.
  const teenId =
    event.objectType === "teen"
      ? event.objectId
      : typeof event.payload.teenId === "string"
        ? event.payload.teenId
        : null;
  if (teenId && viewer.caseloadTeenIds.includes(teenId)) return "caseload";
  return "network";
}

/** Resolve what this event means to this viewer. The whole of standing rule 8. */
export function resolveAlertType(
  event: ActivityEvent,
  viewer: ActivityViewer
): AlertType {
  const column = ALERT_TABLE[event.eventType];
  // An unknown event type resolves to "none" — it renders nowhere rather than
  // defaulting into someone's work queue. A type that reaches here without a
  // table row is a bug, and the quiet failure mode is the safe one.
  if (!column) return "none";
  return column[viewer.role][relationshipOf(event, viewer)];
}

/** Every (role, relationship) pair that can ever produce "notification". Exported
 *  for the test that pins the A3-step-9 reading described at the top of this file
 *  — if someone later adds a notification cell to supervisor × caseload, the
 *  unread badge silently starts counting other people's work and that test is the
 *  only thing that will say so. */
export function notificationCells(): Array<{
  eventType: ActivityEventType;
  role: ViewerRole;
  relationship: ViewerRelationship;
}> {
  const out: Array<{
    eventType: ActivityEventType;
    role: ViewerRole;
    relationship: ViewerRelationship;
  }> = [];
  for (const [eventType, column] of Object.entries(ALERT_TABLE) as Array<
    [ActivityEventType, Column]
  >) {
    for (const role of ["mentor", "leadMentor", "supervisor"] as ViewerRole[]) {
      for (const relationship of [
        "actor",
        "caseload",
        "network",
      ] as ViewerRelationship[]) {
        if (column[role][relationship] === "notification")
          out.push({ eventType, role, relationship });
      }
    }
  }
  return out;
}
