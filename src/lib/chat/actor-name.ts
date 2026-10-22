// ═══════════════════════════════════════════════════════════════════════════
// WHO DID THIS — the one name an event chip and a timeline row show
// (pack v3.0, Workstream E1)
//
// ═══ THE DEFECT IT REPLACES ═══ Both chip hosts (the thread and the History
// rail) named the actor `actorId === LIVE_ID ? "You" : theirName` — so any
// actor who was not the live mentor rendered as the TEEN. A supervisor's close
// is written by `staff-{persona}`, and it read "Caleb resolved the
// escalation": the teen never resolves an escalation.
//
// One function now, by actor id, for both hosts and both lenses:
//   the viewer themself        → "You"
//   the live mentor, observed  → the mentor's name
//   the teen of this thread    → the teen's first name
//   a staff persona            → the supervisor this escalation notified
//   anyone in the directory    → their first name

import { DEMO_PEOPLE } from "@/lib/record/people-demo";
import { LIVE_ID } from "@/lib/record/subject";

export interface ActorContext {
  /** Who is reading: `LIVE_ID` for the mentor, `staff-{persona}` for staff. */
  viewerId: string;
  /** The thread's teen. */
  teenId: string;
  teenFirst: string;
  /** How an observing supervisor names the live mentor. */
  mentorName: string;
  /** The escalation's notified supervisor, for staff-written events. */
  supervisorFirst: string;
}

const first = (n: string) => n.split(" ")[0];

export function actorName(actorId: string, c: ActorContext): string {
  if (actorId === c.viewerId) return "You"; // TODO-COPY
  if (actorId === LIVE_ID) return c.mentorName || "The mentor";
  if (actorId === c.teenId) return c.teenFirst;
  if (actorId.startsWith("staff-")) return c.supervisorFirst || "A supervisor";
  const person = DEMO_PEOPLE.find((p) => p.id === actorId);
  return person ? first(person.name) : "Someone";
}
