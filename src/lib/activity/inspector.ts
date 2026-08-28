// THE OBJECT INSPECTOR'S DATA LAYER (A12).
//
// ═══════════════════════════════════════════════════════════════════════════
// THIS IS THE HIGHEST-RISK LEAK SURFACE IN THE FEATURE, and A12 says so: it is
// exactly where a developer would reasonably put "all the context".
//
// So the gate is the FIRST thing this module does, it is derived rather than
// trusted, and there is only one way in. `objectDetailFor` recomputes the
// relationship through `relationshipOf` — the same function A5's degradation runs
// through — rather than reading `row.degraded`, because a caller that built a row
// by hand, or passed a row from a different viewer, would otherwise get detail it
// should never see. The row's flag is a rendering hint; this is enforcement.
//
// A DEGRADED ROW RETURNS `null`. Not a partially-filled object, not an object with
// blanked fields — null, so there is no shape a component could destructure and
// render half of. The component's only choice is pane-or-message.
// ═══════════════════════════════════════════════════════════════════════════
//
// WHY THIS IS AN OBJECT INSPECTOR AND NOT THE EVENT PANE SPEC §11 REJECTED. §11
// was right that a ledger row is one sentence with nothing behind it. This pane
// is not about the row; it is about the row's OBJECT — the teen, the mentor, the
// conversation — which has plenty behind it and is the thing a supervisor
// actually wants when they stop on a line.

import type { ActivityEvent } from "@/lib/activity/events";
import type { FeedRow } from "@/lib/activity/query";
import {
  relationshipOf,
  type ActivityViewer,
} from "@/lib/activity/resolve-alert-type";
import { STAFF, TEENS, staffFirstName, teenFirstName } from "@/lib/activity/seed";

/** A row of the pane: a label and a value. Deliberately flat — the pane renders a
 *  definition list and owns no per-field layout, so a new field is one entry here
 *  rather than a new block in a component. */
export interface DetailField {
  /** TODO-COPY */
  label: string;
  value: string;
}

export interface ObjectDetail {
  kind: "teen" | "mentor" | "conversation";
  /** The heading. A teen's first name only, and it can only ever BE a first name
   *  because `teenFirstName` is the only source — the activity fixture stores no
   *  surnames (gap row 284). Standing rule 6, which used to be the reason, was
   *  retired 2026-08-28; this is now a property of the data, not a policy. */
  title: string;
  /** TODO-COPY. What kind of thing this is, under the title. */
  subtitle: string;
  fields: DetailField[];
  /** Where "open the full record" goes. */
  href: string;
  /** TODO-COPY */
  hrefLabel: string;
}

const DAY = 86_400_000;

/** ═══ THE GATE ═══
 *
 *  `null` when the viewer is a bystander to this row's object. Recomputed from the
 *  viewer and the event, never read off the row — see the module note. */
export function objectDetailFor(opts: {
  row: FeedRow;
  /** The scenario's full ledger, for the counts. */
  events: ActivityEvent[];
  viewer: ActivityViewer;
  /** Simulated clock, so "140 days" is stable in a fixture. */
  now: number;
}): ObjectDetail | null {
  const { row, events, viewer, now } = opts;

  // The event this row stands for. A group's first member is enough: every member
  // of a group shares an objectId, which is half the group key.
  const event = events.find((e) => e.id === row.eventIds[0]);
  if (!event) return null;

  // ── THE GATE. Same function A5's degradation runs through.
  if (relationshipOf(event, viewer) === "network") return null;

  const teenId =
    typeof event.payload.teenId === "string"
      ? event.payload.teenId
      : event.objectType === "teen"
        ? event.objectId
        : null;

  if (event.objectType === "conversation") {
    return conversationDetail(event.objectId, teenId, events);
  }
  if (event.objectType === "mentor") {
    return mentorDetail(event.objectId);
  }
  return teenId ? teenDetail(teenId, events, now) : null;
}

/** Open escalations for a teen: raised, less closed. Derived from the ledger
 *  rather than stored, because a stored count is a second source of truth that
 *  drifts the first time an event is appended without updating it. */
function openEscalations(teenId: string, events: ActivityEvent[]): number {
  let open = 0;
  for (const e of events) {
    const t =
      typeof e.payload.teenId === "string" ? e.payload.teenId : e.objectId;
    if (t !== teenId) continue;
    if (e.eventType === "ESCALATION_RAISED") open += 1;
    if (e.eventType === "ESCALATION_CLOSED") open -= 1;
  }
  // A ledger that closes something it never recorded raising is possible in a
  // fixture; a negative count is not a fact about a teen.
  return Math.max(0, open);
}

/** The most recent code a completed billing review landed on. */
function currentBillingCode(
  teenId: string,
  events: ActivityEvent[]
): string | null {
  const completed = events
    .filter((e) => {
      const t =
        typeof e.payload.teenId === "string" ? e.payload.teenId : e.objectId;
      return t === teenId && e.eventType === "BILLING_REVIEW_COMPLETE";
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const code = completed[0]?.payload.code;
  return typeof code === "string" ? code : null;
}

function teenRecord(teenId: string) {
  return Object.values(TEENS).find((t) => t.id === teenId) ?? null;
}

function teenDetail(
  teenId: string,
  events: ActivityEvent[],
  now: number
): ObjectDetail | null {
  const teen = teenRecord(teenId);
  if (!teen) return null;

  const code = currentBillingCode(teenId, events);
  const open = openEscalations(teenId, events);
  const intakeAt = now - teen.intakeDaysAgo * DAY;

  const fields: DetailField[] = [
    // TODO-COPY on every label.
    {
      label: "Billing code",
      // A teen with no completed review has no current code, and saying so is a
      // fact — "—" would read as a rendering failure.
      value: code ? `${code} · ${teen.status}` : `Not yet assigned · ${teen.status}`,
    },
    {
      label: "Intake",
      // NAMED PLATFORM METRIC FORMAT for the tenure figure ("140 days"), and an
      // absolute date beside it so the reader does not have to do the arithmetic.
      value: `${teen.intakeDaysAgo} days · ${new Date(intakeAt).toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric" }
      )}`,
    },
    { label: "Mentor", value: staffFirstName(teen.mentorId) },
    {
      label: "Open escalations",
      value: open === 0 ? "None" : open === 1 ? "1" : String(open),
    },
  ];

  return {
    kind: "teen",
    title: teen.firstName,
    subtitle: "Mentee",
    fields,
    href: `/app/mentees?teen=${encodeURIComponent(teenId)}`,
    hrefLabel: "Open the full record",
  };
}

/** ═══ REACHABLE ONLY IN TESTS TODAY ═══
 *
 *  A12 specifies a mentor pane, and the pane must handle any `objectType` it is
 *  handed. But NO EVENT TYPE IN THE LEDGER PRODUCES A MENTOR-OBJECT ROW: every
 *  fixture builds `objectType` as "teen" or "conversation", and the fourteen event
 *  types are all about a teen's escalation, flag, billing, review or lifecycle.
 *  Producing one would mean adding an event type, which A9's taxonomy audit is the
 *  wrong moment to do unilaterally.
 *
 *  So this branch is implemented and unit-tested against a synthetic event, and
 *  flagged in the gap report rather than left as a hole that throws the day a
 *  mentor-object event exists. */
function mentorDetail(mentorId: string): ObjectDetail | null {
  const staff = Object.values(STAFF).find((s) => s.id === mentorId);
  if (!staff) return null;
  const role =
    staff.role === "supervisor"
      ? "Supervisor"
      : staff.role === "leadMentor"
        ? "Lead mentor"
        : "Mentor";
  const leadId = "leadId" in staff ? staff.leadId : undefined;
  const reviewStatus = "reviewStatus" in staff ? staff.reviewStatus : undefined;

  const fields: DetailField[] = [{ label: "Role", value: role }];
  if (leadId) fields.push({ label: "Lead mentor", value: staffFirstName(leadId) });
  if (reviewStatus) fields.push({ label: "Review", value: reviewStatus });

  return {
    kind: "mentor",
    title: staff.firstName,
    subtitle: role,
    fields,
    href: `/app/team?person=${encodeURIComponent(mentorId)}`,
    hrefLabel: "Open the full record",
  };
}

function conversationDetail(
  conversationId: string,
  teenId: string | null,
  events: ActivityEvent[]
): ObjectDetail | null {
  const flags = events.filter(
    (e) => e.objectId === conversationId && e.eventType.startsWith("RISK_FLAG_")
  ).length;
  const teen = teenId ? teenRecord(teenId) : null;
  const mentorName = teen ? staffFirstName(teen.mentorId) : null;

  const fields: DetailField[] = [
    {
      label: "Participants",
      // First name and mentor — the two people in the thread. Reads `firstName`
      // directly rather than the chokepoint, which is safe here for the same
      // reason it is unavoidable: this module's fixtures carry no surnames at all
      // (gap row 284). Rule 6 was retired 2026-08-28.
      value: [teen?.firstName, mentorName].filter(Boolean).join(" and ") || "Unknown",
    },
    { label: "Risk flags", value: flags === 1 ? "1" : String(flags) },
  ];

  return {
    kind: "conversation",
    title: teen ? `${teen.firstName}’s conversation` : "Conversation",
    subtitle: "Monitored thread",
    fields,
    href: `/app/chat?with=${encodeURIComponent(teenId ?? conversationId)}`,
    hrefLabel: "Open the conversation",
  };
}

/** TODO-COPY. A12's exact words, kept as a constant so the pane and any test read
 *  the same string. */
export const DEGRADED_MESSAGE =
  "Full context is available for mentees on your caseload.";

/** TODO-COPY. */
export const NOTHING_SELECTED_MESSAGE = "Select an event to see context.";

/** Re-exported so a test can assert the gate without importing the seed. */
export { teenFirstName };
