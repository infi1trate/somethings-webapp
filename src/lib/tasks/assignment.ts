// ═══════════════════════════════════════════════════════════════════════════
// WHICH SUPERVISOR A CARE REVIEW IS ASSIGNED TO (admin column, 2026-10-06)
//
// ═══ THE DEFINITION, AS GIVEN ═══
// "The supervisor is determined by the mentors who are in their caseload — and
// the mentees in the mentors' caseload." Two caseloads, chained:
//
//     teen ──(is in the caseload of)──▶ mentor ──(is in the caseload of)──▶ supervisor
//
// The first link is the review's own: a care review is about one teen, and the
// task carries the teen's mentor (`TaskItem.mentorId`). The second is the table
// below. Nothing here is inferred from who happens to submit a review — that is
// `ClosedCareReview.submittedBy`, a different fact.
//
// ═══ TODO-DATA: THE SECOND LINK IS A FIXTURE, AND WHY ═══
// The record data DOES model this chain (`people-demo.ts`: mentor → `leadId` →
// lead → `supervisorId`), but it is a different namespace from the task
// fixture — the gap row 432 problem — and it holds exactly one supervisor
// (Stephen Rowe), so bridging to it would put one name on every row. Of the
// task fixture's ten mentors only Maria Lopez exists there at all.
// So, answered 2026-10-06: the task fixture gets its own supervisor caseloads,
// across three supervisors — Stephen Rowe from the record data, and Sasha
// Rivera and Dana Okafor, who already sign closed reviews in the history
// fixture. When the two namespaces are unified, this table is what goes.

import type { TaskItem } from "@/lib/tasks/types";

export interface Supervisor {
  id: string;
  name: string;
}

export const TASK_SUPERVISORS = {
  stephen: { id: "tk-s-stephen", name: "Stephen Rowe" },
  sasha: { id: "tk-s-sasha", name: "Sasha Rivera" },
  dana: { id: "tk-s-dana", name: "Dana Okafor" },
} as const satisfies Record<string, Supervisor>;

/** ═══ EACH SUPERVISOR'S CASELOAD OF MENTORS ═══
 *  Written as the caseloads themselves (supervisor → mentors) rather than as a
 *  per-mentor lookup, because that is the shape of the definition. A mentor
 *  appears in at most one caseload — asserted in the tests, since a mentor in
 *  two would make "assigned to" ambiguous. */
export const SUPERVISOR_CASELOADS: Record<string, readonly string[]> = {
  [TASK_SUPERVISORS.stephen.id]: ["tk-m-brandon", "tk-m-maria", "tk-m-brandy", "tk-m-omar"],
  [TASK_SUPERVISORS.sasha.id]: ["tk-m-tasha", "tk-m-daniel", "tk-m-priscilla"],
  [TASK_SUPERVISORS.dana.id]: ["tk-m-jae", "tk-m-nour", "tk-m-vic"],
};

const BY_ID = new Map<string, Supervisor>(
  Object.values(TASK_SUPERVISORS).map((s) => [s.id, s])
);
const SUPERVISOR_OF_MENTOR = new Map<string, Supervisor>(
  Object.entries(SUPERVISOR_CASELOADS).flatMap(([sid, mentors]) =>
    mentors.map((m) => [m, BY_ID.get(sid)!] as const)
  )
);

/** The supervisor whose caseload holds this mentor, or null. */
export function supervisorOfMentor(mentorId: string): Supervisor | null {
  return SUPERVISOR_OF_MENTOR.get(mentorId) ?? null;
}

/** The supervisor a review is assigned to: its teen's mentor's supervisor.
 *  NULL IS A REAL ANSWER — a mentor in no caseload — and renders as such,
 *  rather than falling back to whoever is signed in. */
export function assignedSupervisor(item: Pick<TaskItem, "mentorId">): Supervisor | null {
  return supervisorOfMentor(item.mentorId);
}
