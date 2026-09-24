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
// ═══ AND THE FLAG TYPES ARE ONE NOW (Phase 4) ═══
//
// The three tier types collapsed into `riskFlagReview`. The order the
// restructure ran in was deliberate and worth recording: the IA collapsed FIRST,
// so `risk-flags` was a real destination holding a real queue before the schema
// changed, and Phase 4 then proved the per-flag tier gone by grep against a
// finished surface rather than a half-built one.
//
// ═══ AND IT IS THREE AGAIN (addendum §2.1, §2.2) ═══
//
// It briefly held five. `mentor-practice` and `coverage` were destinations with
// NO task types — a practice event was a different primitive and coverage was a
// roster of conversations — so both sat here as empty arrays, which is a
// destination this file cannot answer questions about. Mentor Practice is gone
// from the product; Coverage became Chat, which is a conversation surface and
// not a queue of work. Neither absence costs this file anything, because neither
// ever had a mapping to lose.
//
// CHAT IS NOT LISTED, and that is the same rule rather than an oversight: this
// file answers "which work lives where", and Chat holds no work items. It is a
// nav destination without being an IA one, which is why `NAV.chat` exists and
// `DestinationId` does not carry it.

import type { TaskType } from "@/lib/tasks/types";

export type DestinationId =
  | "escalations"
  | "risk-flags"
  | "care-reviews";

/** ROUTE SEGMENTS ARE THE IDS. `/app/{id}` resolves for every one of them, so
 *  `hrefFor` needs no table and a typo becomes a 404 rather than a silent
 *  mis-link. */
export const DESTINATION_ORDER: readonly DestinationId[] = [
  "escalations",
  "risk-flags",
  "care-reviews",
];

/** Which task types a destination holds. Every destination here holds some: the
 *  two that did not are gone (see the note above). */
export const DESTINATION_TYPES: Record<DestinationId, readonly TaskType[]> = {
  escalations: ["activeEscalation", "escalationDocumentation"],
  /** ═══ ONE FLAG TYPE, ONE DESTINATION (Phase 4 landed) ═══
   *  This listed all three tier types with the note "That mapping is the whole
   *  point at this phase: the IA collapses first, so the destination is real
   *  before the schema change lands, and Phase 4 can then prove the per-flag tier
   *  gone with a grep rather than against a half-built surface."
   *  The schema change has landed. The three-to-one mapping was the scaffolding
   *  and this is what it was scaffolding for. */
  "risk-flags": ["riskFlagReview"],
  "care-reviews": ["intakeBillingReview", "monthlyReReview"],
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
