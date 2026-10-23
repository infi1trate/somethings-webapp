// ═══════════════════════════════════════════════════════════════════════════
// THE INTAKE AS ROWS (pack v6.1, Component A)
//
// ═══ WHY ═══ Crisis information arrives non-linearly — teens volunteer
// answers out of order. All six questions are answerable in ANY order; any
// conditional gating between questions is clinical policy (Meg / Dr. Nissan)
// and is not invented here — a blocked constant. The one structure that
// exists is the chart's own: Q6's "within the past 3 months?" follow-up,
// asked on a Yes, nested inside Q6's row.
//
// The risk computation is unchanged (`riskLevel`, Low Q1–Q2 · Moderate Q3 ·
// High Q4–Q6) and is not restated here.

import type { SafetyCheck } from "@/lib/chat/types";
import { ASSESSMENT_QUESTIONS, type AssessmentQuestion } from "@/lib/tiering/escalation";

type Answers = SafetyCheck["answers"];

/** A row is complete when its question is answered — and, for Q6 on a Yes,
 *  its follow-up too. */
export function questionComplete(answers: Answers, q: AssessmentQuestion): boolean {
  const a = answers[q.id];
  if (!a) return false;
  return !(q.followUp && a.value === "yes" && !answers[q.followUp.id]);
}

/** The row that opens: the first incomplete, TOP-DOWN from the top — so an
 *  out-of-order answer never skips an earlier gap. Null when all six are. */
export const firstOpenQuestion = (answers: Answers): string | null => ASSESSMENT_QUESTIONS.find((q) => !questionComplete(answers, q))?.id ?? null;

export const assessmentComplete = (answers: Answers) => firstOpenQuestion(answers) === null;

/** The question a step id belongs to (`q6b` → Q6). */
export const questionOf = (id: string): AssessmentQuestion | undefined => ASSESSMENT_QUESTIONS.find((q) => q.id === id || q.followUp?.id === id);

/** The answers as they will be after a write — `answer`'s own rule (a Q6 No
 *  drops the follow-up), so the component can advance on what was recorded. */
export function afterAnswer(answers: Answers, id: string, value: "yes" | "no"): Answers {
  const next = { ...answers, [id]: { value, at: Date.now() } };
  if (id === "q6" && value === "no") delete next.q6b;
  return next;
}
