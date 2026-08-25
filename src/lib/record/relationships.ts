// RELATIONSHIPS — the seam that separates a PERSON from their PAIRINGS.
//
// THE BUG THIS EXISTS TO FIX. Two different objects were conflated in one table
// cell. Platform status is a property of the PERSON (Marcus is deactivated on
// Somethings). List membership is a property of the RELATIONSHIP (Marcus is
// matched to Brandon). The mentees table rendered the person's status inside the
// relationship's table and offered a one-click dropdown on it — so a user
// intending to end a pairing could instead mutate someone's account. Worse: the
// store key behind that dropdown (`menteeStatus`) is keyed by TEEN ID, not by
// pairing, so it was never capable of ending a match at all. It only hid the row.
//
// Ending a relationship now writes HERE, and nothing here touches account state.
//
// APPEND-ONLY. Ending a pairing appends a `RelationshipEvent`; it never deletes
// a row and never edits an earlier event. The current edge is derived by
// replaying the log over the fixture edge, so history and present state can't
// disagree — there is no second source to drift.
//
// TWO VOCABULARIES, NEVER CROSSED (Phase 3):
//   • Teens are MATCHED / UNMATCHED to mentors.
//   • Staff are ASSIGNED / UNASSIGNED to supervisors.
// Not "removed", not "deleted", not "deactivated" — those words belong to
// account state, which is exactly the thing these actions must not touch.

import {
  DEMO_MENTORS,
  DEMO_STAFF,
  DEMO_TEENS,
  type DemoMentorRow,
  type DemoTeen,
} from "@/lib/record/people-demo";

/** What kind of pairing ended. One event type per vocabulary — a shared
 *  "relationship_ended" would force every reader to re-derive which. */
export type RelationshipKind = "match" | "assignment";

export interface RelationshipEvent {
  id: string;
  kind: RelationshipKind;
  /** The teen (match) or the staff member (assignment). */
  personId: string;
  /** The mentor (match) or the supervising lead (assignment) they left. */
  counterpartId: string;
  endedAt: number;
  /** Who did it, for the history line. */
  actor: string;
  actorRole: string;
}

/** Everything the store contributes. One options object so a future event class
 *  is a field here rather than a signature change in every reader. */
export interface RelationshipSlice {
  events?: RelationshipEvent[];
}

const eventsFor = (
  slice: RelationshipSlice,
  kind: RelationshipKind,
  personId: string
) =>
  (slice.events ?? []).filter((e) => e.kind === kind && e.personId === personId);

// ── Current edges ───────────────────────────────────────────────────────────

/** The mentor a teen is matched to RIGHT NOW: the fixture edge unless an event
 *  has ended it. Null means unmatched — which says nothing about their account. */
export function currentMentorId(
  teen: DemoTeen,
  slice: RelationshipSlice = {}
): string | null {
  if (!teen.mentorId) return null;
  const ended = eventsFor(slice, "match", teen.id).some(
    (e) => e.counterpartId === teen.mentorId
  );
  return ended ? null : teen.mentorId;
}

/** The lead/supervisor a staff member is assigned to right now. */
export function currentSupervisorId(
  person: DemoMentorRow,
  slice: RelationshipSlice = {}
): string | null {
  const edge = person.leadId ?? person.supervisorId;
  if (!edge) return null;
  const ended = eventsFor(slice, "assignment", person.id).some(
    (e) => e.counterpartId === edge
  );
  return ended ? null : edge;
}

/** A mentor's CURRENT mentees. Replaces bare `teensForMentor` on any surface
 *  that must respect an unmatch — the fixture helper can't see the event log. */
export function currentMenteesOf(
  mentorId: string,
  slice: RelationshipSlice = {}
): DemoTeen[] {
  return DEMO_TEENS.filter((t) => currentMentorId(t, slice) === mentorId);
}

/** Everyone currently reporting to this person, FLAT and one tier.
 *
 *  DELIBERATE CHANGE from `superviseesOf`, which returned leads + their mentors
 *  as separate groups and made the Supervision tab render two tables (three on
 *  some records). The design is ONE "Mentors" table, so this returns one list:
 *  a supervisor sees the leads who report to them AND the mentors under those
 *  leads, in a single roster, because both are people whose standing they are
 *  accountable for. */
export function currentSuperviseesOf(
  id: string,
  slice: RelationshipSlice = {}
): DemoMentorRow[] {
  const assignedTo = (p: DemoMentorRow, target: string) =>
    currentSupervisorId(p, slice) === target;
  const leads = DEMO_STAFF.filter((s) => assignedTo(s, id));
  const direct = DEMO_MENTORS.filter((m) => assignedTo(m, id));
  const viaLeads = leads.flatMap((l) =>
    DEMO_MENTORS.filter((m) => assignedTo(m, l.id))
  );
  // De-duplicated: a mentor reachable both directly and through a lead is one
  // person, and a roster that lists them twice is a bug a reader has to debug.
  return [...new Map([...leads, ...direct, ...viaLeads].map((p) => [p.id, p])).values()];
}

// ── Ended pairings (the append-only history, rendered) ──────────────────────

export interface EndedMatch {
  teen: DemoTeen;
  endedAt: number;
  actor: string;
}
export interface EndedAssignment {
  person: DemoMentorRow;
  endedAt: number;
  actor: string;
}

/** Matches this mentor USED to hold, newest first, from the event log alone.
 *  The fixtures' own `pastMentors` ranges stay where they are — this is the
 *  history staff created in-session, and it carries a real timestamp rather
 *  than a hand-written string. */
export function endedMatchesFor(
  mentorId: string,
  slice: RelationshipSlice = {}
): EndedMatch[] {
  return (slice.events ?? [])
    .filter((e) => e.kind === "match" && e.counterpartId === mentorId)
    .map((e) => ({
      teen: DEMO_TEENS.find((t) => t.id === e.personId),
      endedAt: e.endedAt,
      actor: e.actor,
    }))
    .filter((x): x is EndedMatch => !!x.teen)
    .sort((a, b) => b.endedAt - a.endedAt);
}

/** Assignments this record used to hold, newest first.
 *
 *  Includes assignments ended from a LEAD's roster when that lead reports here:
 *  a supervisor's live table shows mentors reached through their leads, so the
 *  history has to show the same population or a row would vanish from the table
 *  with nothing to account for it. */
export function endedAssignmentsFor(
  supervisorId: string,
  slice: RelationshipSlice = {}
): EndedAssignment[] {
  const all = [...DEMO_STAFF, ...DEMO_MENTORS];
  const leadIds = DEMO_STAFF.filter(
    (s) => (s.leadId ?? s.supervisorId) === supervisorId
  ).map((s) => s.id);
  const owned = new Set([supervisorId, ...leadIds]);
  return (slice.events ?? [])
    .filter((e) => e.kind === "assignment" && owned.has(e.counterpartId))
    .map((e) => ({
      person: all.find((p) => p.id === e.personId),
      endedAt: e.endedAt,
      actor: e.actor,
    }))
    .filter((x): x is EndedAssignment => !!x.person)
    .sort((a, b) => b.endedAt - a.endedAt);
}

// ── Relationship start dates ────────────────────────────────────────────────

/** Days since the MATCH began — the relationship fact, not the person's platform
 *  join date. `matchedDaysAgo` falls back to `joinedDaysAgo` only where the
 *  fixture omits it. */
export function matchedDaysAgo(teen: DemoTeen): number {
  return teen.matchedDaysAgo ?? teen.joinedDaysAgo;
}

/** Days since the ASSIGNMENT began. TODO-DATA: `assignedDaysAgo` is new fixture
 *  data — staff carried no assignment date at all before this pass, so the
 *  column had nothing true to show. Absent means we say so rather than
 *  borrowing a date that means something else. */
export function assignedDaysAgo(person: DemoMentorRow): number | null {
  return person.assignedDaysAgo ?? null;
}

// ─── NAMED PLATFORM METRICS ─────────────────────────────────────────────────

/** WHEN this teen's match ended, if that is knowable.
 *
 *  Returns null far more often than you would like, and the caller has to cope.
 *  A match ended IN SESSION appends a `RelationshipEvent` with a real `endedAt`.
 *  A teen whose fixture simply says `active: false` — which is the entire
 *  deactivated population — has no end date anywhere: `pastMentors` carries a
 *  prose range, but that describes a PREVIOUS mentor rather than the end of the
 *  current pairing, so reading it here would date the wrong event. Reported
 *  rather than papered over with a guess. */
export function endedMatchDateFor(
  teen: DemoTeen,
  slice: RelationshipSlice = {}
): number | null {
  const ev = (slice.events ?? [])
    .filter((e) => e.kind === "match" && e.personId === teen.id)
    .sort((a, b) => b.endedAt - a.endedAt)[0];
  return ev?.endedAt ?? null;
}

/** "Days in mentorship" — a NAMED PLATFORM METRIC, and a deliberate exception to
 *  the elapsed-time standard. Everything else on these surfaces reads "2 weeks
 *  ago"; a named metric keeps its own unit so the number is comparable across
 *  records and against whatever else reports it. "122 days", never "4 months".
 *
 *  THE CLOCK DOES NOT PAUSE. Audited: no pause timestamp exists anywhere in the
 *  data (`menteeStatus` stores a bare string per teen, with no history), so a
 *  paused period cannot be excluded even in principle. A teen paused 60 days
 *  reads 122 days here, not 62. That is what the platform currently means by the
 *  phrase — when pause history lands, this is the one place to change.
 *
 *  New shared utility: nothing like it existed. The four duration helpers already
 *  in the codebase (relJoined, relLength, relativeAgo, elapsedShort, relTime) all
 *  produce ELAPSED prose, which is the opposite of what a named metric needs. */
export function formatDaysInMentorship(days: number): string {
  // TODO-COPY. Singular matters at 1 — "1 days in mentorship" reads as a bug.
  return days === 1 ? "1 day" : `${days} days`;
}

/** Days in mentorship for a teen, from the relationship's own start date. */
export function daysInMentorship(teen: DemoTeen): number {
  return matchedDaysAgo(teen);
}
