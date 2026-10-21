"use client";

// THE GUIDED ASSESSMENT — in the rail, beside the conversation it is about.
//
// ═══ WHY THE RAIL AND NOT A DIALOG ═══
//
// Every step here is a question about what the teen has actually said, and the
// messages are immediately to the left. A dialog would cover the evidence at the one
// moment it is being weighed — and it would trap focus, so re-reading a message
// would mean abandoning the checklist.
//
// It also means the assessment cannot be "finished and closed". It stays where it
// is, half-done, while the mentor goes back to the conversation and comes back —
// which is exactly what happens.
//
// ═══ CHECKING A STEP RECORDS A TIME, NOT A VALUE ═══
//
// `{checked, at}` rather than a boolean, so the record says WHEN each thing was
// covered. That is the difference between a form's current state and a record of
// what happened, and the second is what a supervisor reading back needs.
//
// Steps do not un-check. Once something has been asked it has been asked, and a
// checkbox that toggles would let the record be quietly walked back — which is the
// same reasoning that makes a note read-only and an event log append-only.
//
// ═══ SUPERSEDED IN PART (Tiering & Escalation pack, Phase 2) ═══ This was
// the whole of the "Now" tab, with Emergency information and Resolve at its
// foot. Care replaced Now (answered 2026-10-20), and the checklist is one
// section of Care's active state now — so the footer moved to the Care
// panel, which owns the order the pack sets. What changed here:
//   · the next uncovered step is EXPANDED with its suggested line; the rest
//     show their prompt and why, and open on press (make it magical, 2 —
//     covering a step advances the counter and opens the next, so a mentor
//     mid-crisis never hunts for what comes next);
//   · "Put this in the message box" → the pack's "Put in message box";
//   · a supervisor watching reads it without the controls (`onCheck` absent).
//
// ═══ NO SCORE, NO TOTAL, NO COLOUR THAT CHANGES ═══
//
// See `lib/chat/assessment.ts`. A number would invite a mentor to decide whether
// this is bad enough, and that is not a judgement this surface asks them to make —
// a supervisor was notified before the assessment opened.

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ASSESSMENT } from "@/lib/chat/assessment";
import type { EscalationState } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

function clock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AssessmentPanel({
  escalation,
  theirName,
  onCheck,
  /** Puts the step's suggested wording into the composer. See the button's note. */
  onUseWording,
}: {
  escalation: EscalationState;
  theirName: string;
  /** Absent for a read-only viewer. */
  onCheck?: (stepId: string) => void;
  onUseWording?: (text: string) => void;
}) {
  const covered = ASSESSMENT.filter((s) => escalation.assessment[s.id]?.checked).length;
  const next = ASSESSMENT.find((s) => !escalation.assessment[s.id]?.checked)?.id ?? null;
  /* The step a reader opened by hand, if any; otherwise the next uncovered
     one is open. Derived, so covering a step moves the open one with no
     effect to run. */
  const [picked, setPicked] = useState<{ id: string; covered: number } | null>(null);
  const openId = picked && picked.covered === covered ? picked.id : next;

  return (
    <div data-slot="assessment" className="space-y-3">
      <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
        {/* TODO-COPY. Says what this is FOR and removes the pressure in one
            sentence — "in any order" is the part that stops a frightened
            mentor freezing on step one. */}
        Work through these with {theirName}, in any order ·{" "}
        {/* A COUNT, NOT A SCORE. Keyed on the count, so it settles once each
            time a step is covered. */}
        <span key={covered} data-assessment-count className="tier-settle inline-block tabular-nums text-[var(--text-primary)]">
          {covered} of {ASSESSMENT.length}
        </span>
      </p>

      <ol className="space-y-2">
        {ASSESSMENT.map((step) => {
          const state = escalation.assessment[step.id];
          const done = !!state?.checked;
          const expanded = !done && openId === step.id;
          return (
            <li
              key={step.id}
              data-assessment-step={step.id}
              data-expanded={expanded || undefined}
              className={cn(
                "rounded-[var(--radius-inset)] px-3 py-2.5",
                done ? "bg-[var(--band-sage-bg)] text-[var(--band-sage-fg)]" : "bg-[var(--surface-s1)]"
              )}
            >
              <div className="flex items-start gap-2.5">
                {/* ═══ A BUTTON, NOT A CHECKBOX, AND IT DOES NOT TOGGLE ═══
                    A one-way record of something having been asked, so it is a
                    button that becomes a statement of fact — `aria-disabled`
                    once done, so it stays in the order. Read-only viewers get
                    the mark without the button. */}
                {onCheck ? (
                  <button
                    type="button"
                    onClick={() => !done && onCheck(step.id)}
                    aria-disabled={done}
                    /* TODO-COPY */
                    aria-label={done ? `Covered at ${clock(state.at)}: ${step.prompt}` : `Mark as covered: ${step.prompt}`}
                    className={cn(
                      "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border",
                      done ? "border-current bg-current/15" : "border-[color:var(--border-contour)] hover:bg-[var(--tint-hover)]",
                      RING
                    )}
                  >
                    {done && <Check className="size-3" aria-hidden />}
                  </button>
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border",
                      done ? "border-current bg-current/15" : "border-[color:var(--border-contour)]"
                    )}
                  >
                    {done && <Check className="size-3" />}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  {done ? (
                    <p style={{ font: "var(--type-body)" }}>{step.prompt}</p>
                  ) : (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setPicked({ id: expanded ? "" : step.id, covered })}
                      className={cn("flex w-full items-start justify-between gap-2 text-left text-[var(--text-primary)]", RING)}
                      style={{ font: "var(--type-body)" }}
                    >
                      <span>{step.prompt}</span>
                      <ChevronDown aria-hidden className={cn("mt-0.5 size-4 shrink-0 text-[var(--icon-secondary)] transition-transform motion-reduce:transition-none", expanded && "rotate-180")} />
                    </button>
                  )}
                  <p className={cn("mt-0.5", done ? "opacity-80" : "text-[var(--text-muted)]")} style={{ font: "var(--type-field-label)" }}>
                    {done ? `Covered ${clock(state.at)}` : step.why}
                  </p>

                  {/* ═══ THE WORDING, AND A WAY TO USE IT ═══ One press puts the
                      sentence in the composer; nothing goes to a teen that a
                      mentor did not press Send on. */}
                  {expanded && step.say && onUseWording && (
                    <button
                      type="button"
                      data-assessment-wording={step.id}
                      onClick={() => onUseWording(step.say!)}
                      className={cn(
                        "mt-1.5 w-full rounded-[var(--radius-inset)] border border-dashed border-[color:var(--border-contour)] px-2.5 py-1.5 text-left",
                        "transition-colors hover:bg-[var(--tint-hover)]",
                        RING
                      )}
                    >
                      <span className="block italic text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
                        &ldquo;{step.say}&rdquo;
                      </span>
                      <span className="mt-0.5 block text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
                        {/* TODO-COPY. The pack's label. */}
                        Put in message box
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
