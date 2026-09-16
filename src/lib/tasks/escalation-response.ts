// ═══ THE RESPONSE DISPOSITION (arch-G, G2/G4) ═══
//
// What a supervisor DID about a live escalation, recorded when the response task
// is completed. Three values, and the shape is deliberately the same as the
// billing disposition and Monitoring's clinical one: a named constant every
// consumer reads, so the day a fourth value arrives the compiler lists the sites.
//
// ═══ THIS IS NOT THE ESCALATION NOTE ═══
//
// The response task records WHAT WAS DONE and WHEN, in three words. The note —
// the clinical-legal record — belongs to the documentation task, 24 hours later,
// and has its own module. Collapsing the two would ask a supervisor to write an
// audit record during an incident, which is when they should be on the phone.

import type { TaskItem } from "@/lib/tasks/types";

export type ResponseDispositionId = "dispatched911" | "guidingMentor" | "nonUrgent";

export interface ResponseDisposition {
  id: ResponseDispositionId;
  /** NEEDS-COPY-NICOLE, all three. These are the words that go on the record
   *  about a crisis, so they are the highest-stakes strings in this phase. */
  label: string;
  /** The one-line consequence, shown at the control — the same discipline the
   *  clinical disposition follows on Monitoring. */
  consequence: string;
}

export const RESPONSE_DISPOSITIONS: readonly ResponseDisposition[] = [
  {
    id: "dispatched911",
    label: "911 dispatched",
    consequence: "Records that emergency services were called, and when.",
  },
  {
    id: "guidingMentor",
    label: "Guiding mentor",
    consequence: "Records that you are coaching the mentor through it live.",
  },
  {
    id: "nonUrgent",
    label: "Non-urgent",
    consequence: "Records that this did not need an emergency response.",
  },
];

export function responseDispositionById(
  id: string | null | undefined
): ResponseDisposition | null {
  if (!id) return null;
  return RESPONSE_DISPOSITIONS.find((d) => d.id === id) ?? null;
}

/** ═══ WHAT THE ROW SAYS ABOUT AN ESCALATION ═══
 *
 *  The same slot the billing row spends on its proposal preview. For an
 *  escalation the useful preview is its STATE — what has been decided so far —
 *  because that is what tells a supervisor scanning the list whether this one is
 *  already in hand.
 *
 *  `is911` WINS OVER THE RECORDED DISPOSITION, and that is not redundancy: a
 *  dispatch is a fact about the world, the disposition is a fact about the
 *  supervisor's judgment, and when both exist the dispatch is the one a reader
 *  scanning a queue needs first.
 *
 *  NEEDS-COPY-NICOLE on both fallbacks. */
export function escalationStateLine(item: TaskItem): string | null {
  const p = item.payload;
  if (p.kind === "escalation") {
    if (p.is911) return "911 dispatched";
    const recorded = responseDispositionById(
      (p as unknown as { responseDisposition?: string }).responseDisposition
    );
    return recorded ? recorded.label : "Awaiting response";
  }
  if (p.kind === "documentation") return "Awaiting documentation";
  return null;
}
