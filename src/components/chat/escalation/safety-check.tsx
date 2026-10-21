"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE SAFETY CHECK — C-SSRS, Tier 1–2 escalations only (pack, Phase 2)
//
// Six questions. Each has a labelled "Put in message box" — the mentor still
// sends it, in their own voice if they want — and a Yes / No capture.
//
// ═══ IT STREAMS ═══ Every answer is written to the escalation record the
// moment it is captured, not on Submit. The supervisor's view renders that
// same record, so they read the answers as they arrive. Submit converts the
// check to a read-only "Sent to supervisor" state with its timestamp; after
// that nothing here can change.
//
// ═══ THE QUESTION TEXT IS A PLACEHOLDER — AND SAYS SO ═══ The Columbia
// protocol's wording is a blocked constant: verbatim or not at all. Until it
// is supplied (`SAFETY_QUESTIONS`), each question renders as an explicit
// placeholder and the section carries a visible note.
//
// No score, no total, no colour that changes with the answers — the same
// reasoning as the checklist (`lib/chat/assessment.ts`). Yes is not red.

import { Check } from "lucide-react";
import type { SafetyCheck as SafetyCheckRecord } from "@/lib/chat/types";
import { SAFETY_PLACEHOLDER, SAFETY_QUESTIONS } from "@/lib/tiering/escalation";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function SafetyCheck({
  check,
  onAnswer,
  onUseWording,
  onSubmit,
}: {
  check: SafetyCheckRecord;
  /** Absent for a read-only viewer (a supervisor watching). */
  onAnswer?: (questionId: string, value: "yes" | "no") => void;
  onUseWording?: (text: string) => void;
  onSubmit?: () => void;
}) {
  const sent = check.submittedAt !== null;
  const answered = Object.keys(check.answers).length;
  const readOnly = sent || !onAnswer;

  return (
    <div data-safety-check data-sent={sent || undefined} className="space-y-2.5">
      <p className="tabular-nums text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
        {/* TODO-COPY */}
        {sent
          ? `Sent to supervisor ${TIME.format(check.submittedAt!)}`
          : `${answered} of ${SAFETY_QUESTIONS.length} answered · your supervisor sees each answer as you give it`}
      </p>
      {SAFETY_PLACEHOLDER && (
        <p data-safety-placeholder className="rounded-[var(--radius-inset)] border border-dashed border-[color:var(--border-default)] px-3 py-2 text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          Placeholder questions. The verbatim Columbia (C-SSRS) wording replaces these before this is used with a teen.
        </p>
      )}
      <ol className="space-y-2">
        {SAFETY_QUESTIONS.map((q, i) => {
          const a = check.answers[q.id];
          return (
            <li key={q.id} data-safety-question={q.id} className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
              <p className="text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
                <span className="tabular-nums text-[var(--text-muted)]">{i + 1}. </span>
                {q.text}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {!readOnly && onUseWording && (
                  <button
                    type="button"
                    data-safety-wording={q.id}
                    onClick={() => onUseWording(q.text)}
                    className={cn("inline-flex min-h-8 items-center rounded-full border border-dashed border-[color:var(--border-contour)] px-3 text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]", RING)}
                    style={{ font: "var(--type-field-label)" }}
                  >
                    {/* TODO-COPY */}
                    Put in message box
                  </button>
                )}
                <div role="radiogroup" aria-label={`Answer to question ${i + 1}`} className="ml-auto flex gap-1.5">
                  {(["yes", "no"] as const).map((v) => {
                    const on = a?.value === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-disabled={readOnly || undefined}
                        data-safety-answer={`${q.id}:${v}`}
                        onClick={() => !readOnly && onAnswer?.(q.id, v)}
                        className={cn(
                          "inline-flex min-h-8 min-w-12 items-center justify-center gap-1 rounded-full border px-3",
                          on
                            ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)] text-[var(--text-primary)]"
                            : "border-[color:var(--border-subtle)] text-[var(--text-secondary)]",
                          !readOnly && !on && "hover:bg-[var(--tint-hover)]",
                          RING
                        )}
                        style={{ font: "var(--type-body)" }}
                      >
                        {on && <Check aria-hidden className="size-3.5" />}
                        {v === "yes" ? "Yes" : "No"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {!readOnly && onSubmit && (
        <button
          type="button"
          data-safety-submit
          onClick={onSubmit}
          className={cn("inline-flex min-h-9 w-full items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)] transition-opacity hover:opacity-90", RING)}
          style={{ font: "var(--type-button)" }}
        >
          {/* TODO-COPY. Sends what is answered; an unanswered question is
              itself information a supervisor needs. */}
          Submit to supervisor
        </button>
      )}
    </div>
  );
}
