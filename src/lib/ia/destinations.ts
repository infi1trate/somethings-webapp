// ═══════════════════════════════════════════════════════════════════════════
// THE THREE WORK DESTINATIONS — the IA contract
//
// Work is owned by DESTINATIONS now, not by a page with queues on it. This file
// is the one place that says which task types belong to which destination, and
// it is deliberately small: a route id, the types it holds, and nothing else.
//
// ═══ WHAT THIS REPLACES, AND WHY THE SHAPE CHANGED ═══
//
// `lib/home/focus.ts` held a four-queue model — `imminent · clinical · routine ·
// billing` — where the first three were the severity taxonomy this system
// stamped onto individual flags without computing it, promoted to top-level IA.
// Three of four queues were one destination wearing three hats.
//
// So: three destinations. `escalations` (a lifecycle), `risk-flags` (one queue,
// no tiers, ordered by the single comparator), `care-reviews` (the one thing
// here with a published deadline).
//
// ═══ THE FLAG TYPES ARE STILL THREE, AND THAT IS PHASE 4's JOB NOT THIS ONE'S ═══
//
// `imminentFlagReview` / `clinicalFlagReview` / `routineFlagReview` remain as
// TASK TYPES in the data model, and all three map to the one `risk-flags`
// destination. That mapping is the whole point at this phase: the IA collapses
// first, so the destination is real before the schema change lands, and Phase 4
// can then prove the per-flag tier gone with a grep rather than against a
// half-built surface.
//
// `mentor-practice` and `coverage` HAVE NO TASK TYPES. Practice events are a
// different primitive (`lib/monitoring/practice.ts`) and coverage is a roster of
// conversations, not a queue of items — so neither appears here, and a caller
// asking this file about them gets nothing rather than an empty promise.

import type { TaskType } from "@/lib/tasks/types";

export type DestinationId =
  | "escalations"
  | "risk-flags"
  | "care-reviews"
  | "mentor-practice"
  | "coverage";

/** ROUTE SEGMENTS ARE THE IDS. `/app/{id}` resolves for every one of them, so
 *  `hrefFor` needs no table and a typo becomes a 404 rather than a silent
 *  mis-link. */
export const DESTINATION_ORDER: readonly DestinationId[] = [
  "escalations",
  "risk-flags",
  "mentor-practice",
  "coverage",
  "care-reviews",
];

/** Which task types a destination holds. The two destinations whose subjects are
 *  not task items map to nothing, deliberately — see the note above. */
export const DESTINATION_TYPES: Record<DestinationId, readonly TaskType[]> = {
  escalations: ["activeEscalation", "escalationDocumentation"],
  /** ALL THREE FLAG TYPES, ONE DESTINATION. */
  "risk-flags": [
    "imminentFlagReview",
    "clinicalFlagReview",
    "routineFlagReview",
  ],
  "care-reviews": ["intakeBillingReview", "monthlyReReview"],
  "mentor-practice": [],
  coverage: [],
};

/** The destination a task item belongs to, or null for a type nothing owns —
 *  which should be impossible and is therefore worth returning rather than
 *  guessing at. */
export function destinationOf(taskType: TaskType): DestinationId | null {
  for (const id of DESTINATION_ORDER) {
    if (DESTINATION_TYPES[id].includes(taskType)) return id;
  }
  return null;
}
