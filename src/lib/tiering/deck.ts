// ═══════════════════════════════════════════════════════════════════════════
// THE ASSESSMENT DECK'S RULES (pack v8.0)
//
// ═══ THE SKIP RULE — CLINICAL POLICY, SUPPLIED, A BLOCKED CONSTANT ═══
//   Q1 = No AND Q2 = No  →  Q3–Q5 are skipped; the deck advances to Q6.
//   · Skip applies to UNANSWERED rows only: a recorded answer on Q3–Q5 is
//     never auto-discarded (append-only records), and it still counts.
//   · Amending Q1 or Q2 to Yes un-skips Q3–Q5.
//   Any further gating is clinical policy (Meg / Dr. Nissan) — not invented.
//
// ═══ COMPLETENESS ═══ Q1, Q2 and Q6 answered (Q6's three-month follow-up too,
// on a Yes), and each of Q3–Q5 answered or skipped. The risk computation is
// unchanged (`riskLevel`) and runs on RECORDED answers only — a skipped row
// contributes nothing.
//
// Derived, never stored: the record holds answers; skipped-ness is read here.

import type { SafetyCheck } from "@/lib/chat/types";
import { ASSESSMENT_QUESTIONS, type AssessmentQuestion } from "@/lib/tiering/escalation";

type Answers = SafetyCheck["answers"];

/** The three the rule can skip, in instrument order. */
export const SKIPPABLE = ["q3", "q4", "q5"] as const;

/** The rule's trigger: no ideation indicated on Q1 and Q2. */
export const noIdeation = (a: Answers) => a.q1?.value === "no" && a.q2?.value === "no";

/** Skipped rows: Q3–Q5 that are UNANSWERED while the rule holds. */
export function skippedIds(a: Answers): Set<string> {
  if (!noIdeation(a)) return new Set();
  return new Set(SKIPPABLE.filter((id) => !a[id]));
}

/** A question counts as done once answered — Q6 on a Yes needs its follow-up. */
export function questionDone(a: Answers, q: AssessmentQuestion): boolean {
  const x = a[q.id];
  if (!x) return false;
  return !(q.followUp && x.value === "yes" && !a[q.followUp.id]);
}

/** The questions still REQUIRED: everything not skipped. */
export const requiredQuestions = (a: Answers): AssessmentQuestion[] => {
  const skip = skippedIds(a);
  return ASSESSMENT_QUESTIONS.filter((q) => !skip.has(q.id));
};

/** "3 of 3 needed answered". */
export function deckProgress(a: Answers): { done: number; needed: number } {
  const req = requiredQuestions(a);
  return { done: req.filter((q) => questionDone(a, q)).length, needed: req.length };
}

export const deckComplete = (a: Answers) => {
  const p = deckProgress(a);
  return p.done === p.needed;
};

/** The deck's next card: the first REQUIRED question not done, in
 *  instrument order — or "review" once complete. Never null: an interactive
 *  deck always has exactly one active card. */
export type DeckCard = string | "review";
export const nextCard = (a: Answers): DeckCard => requiredQuestions(a).find((q) => !questionDone(a, q))?.id ?? "review";

/** A segment's state on the coverage rail. */
export type SegmentState = "empty" | "yes" | "no" | "skipped";
export function segmentState(a: Answers, id: string): SegmentState {
  const x = a[id];
  if (x) return x.value;
  return skippedIds(a).has(id) ? "skipped" : "empty";
}

/** The answers as they will be after a write — `answer`'s own rule (a Q6
 *  No drops the follow-up; nothing else is ever removed). */
export function afterRecord(a: Answers, id: string, value: "yes" | "no"): Answers {
  const next = { ...a, [id]: { value, at: Date.now() } };
  if (id === "q6" && value === "no") delete next.q6b;
  return next;
}

/** Did this write START the skip (it was not in effect before)? The skip is
 *  announced once, on that transition. */
export const skipStarted = (before: Answers, after: Answers) => skippedIds(before).size === 0 && skippedIds(after).size > 0;
/** Did this write END it (an amend to Yes un-skipped Q3–Q5)? */
export const skipEnded = (before: Answers, after: Answers) => skippedIds(before).size > 0 && skippedIds(after).size === 0;
