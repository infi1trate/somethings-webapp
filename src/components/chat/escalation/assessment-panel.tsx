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
// ═══ NO SCORE, NO TOTAL, NO COLOUR THAT CHANGES ═══
//
// See `lib/chat/assessment.ts`. A number would invite a mentor to decide whether
// this is bad enough, and that is not a judgement this surface asks them to make —
// a supervisor was notified before the assessment opened.

import { Check } from "lucide-react";
import { ASSESSMENT, assessmentProgress } from "@/lib/chat/assessment";
import { PanelSection } from "@/components/chat/rail/rail-panel";
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
  onOpenCrisis,
  onResolve,
}: {
  escalation: EscalationState;
  theirName: string;
  onCheck: (stepId: string) => void;
  onUseWording: (text: string) => void;
  onOpenCrisis: () => void;
  onResolve: () => void;
}) {
  return (
    <div data-slot="assessment" className="space-y-4">
      <PanelSection>
        <p
          className="text-[var(--text-secondary)]"
          style={{ font: "var(--type-body)" }}
        >
          {/* TODO-COPY. Says what this is FOR and removes the pressure in one
              sentence — a mentor working through this is frightened, and "in any
              order" is the part that stops them freezing on step one. */}
          Work through these with {theirName}, in any order. Your supervisor already
          knows.
        </p>
        <p
          className="mt-1.5 tabular-nums text-[var(--text-muted)]"
          style={{ font: "var(--type-field-label)" }}
        >
          {/* A COUNT, NOT A SCORE — see the module note. */}
          {assessmentProgress(escalation.assessment)}
        </p>
      </PanelSection>

      <ol className="space-y-2.5">
        {ASSESSMENT.map((step) => {
          const state = escalation.assessment[step.id];
          const done = !!state?.checked;
          return (
            <li
              key={step.id}
              className={cn(
                "rounded-[var(--radius-inset)] px-3 py-2.5",
                done
                  ? "bg-[var(--band-sage-bg)] text-[var(--band-sage-fg)]"
                  : "bg-[var(--surface-s1)]"
              )}
            >
              <div className="flex items-start gap-2.5">
                {/* ═══ A BUTTON, NOT A CHECKBOX, AND IT DOES NOT TOGGLE ═══
                    A checkbox promises two-way state. This is a one-way record of
                    something having been asked, so it is a button that becomes a
                    statement of fact — and `aria-disabled` once done, so a screen
                    reader knows it is no longer actionable without the control
                    vanishing from the order. */}
                <button
                  type="button"
                  onClick={() => !done && onCheck(step.id)}
                  aria-disabled={done}
                  /* TODO-COPY */
                  aria-label={
                    done
                      ? `Covered at ${clock(state.at)}: ${step.prompt}`
                      : `Mark as covered: ${step.prompt}`
                  }
                  className={cn(
                    "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border",
                    done
                      ? "border-current bg-current/15"
                      : "border-[color:var(--border-contour)] hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  {done && <Check className="size-3" aria-hidden />}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(done ? "" : "text-[var(--text-primary)]")}
                    style={{ font: "var(--type-body)" }}
                  >
                    {step.prompt}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5",
                      done ? "opacity-80" : "text-[var(--text-muted)]"
                    )}
                    style={{ font: "var(--type-field-label)" }}
                  >
                    {done ? `Covered ${clock(state.at)}` : step.why}
                  </p>

                  {/* ═══ THE WORDING, AND A WAY TO USE IT ═══
                      The field that matters most at 2am: a mentor who cannot find
                      their words gets the sentence, and one press puts it in the
                      composer rather than making them retype it. Not sent — the
                      mentor still says it in their own voice if they want to, and
                      nothing goes to a teen that a mentor did not press Send on. */}
                  {!done && step.say && (
                    <button
                      type="button"
                      onClick={() => onUseWording(step.say!)}
                      className={cn(
                        "mt-1.5 w-full rounded-[var(--radius-inset)] border border-dashed border-[color:var(--border-contour)] px-2.5 py-1.5 text-left",
                        "transition-colors hover:bg-[var(--tint-hover)]",
                        RING
                      )}
                    >
                      <span
                        className="block italic text-[var(--text-secondary)]"
                        style={{ font: "var(--type-body)" }}
                      >
                        &ldquo;{step.say}&rdquo;
                      </span>
                      <span
                        className="mt-0.5 block text-[var(--text-muted)]"
                        style={{ font: "var(--type-field-label)" }}
                      >
                        {/* TODO-COPY. Says exactly what pressing it does, including
                            what it does NOT do. */}
                        Put this in the message box
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <PanelSection divided>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onOpenCrisis}
            className={cn(
              "flex min-h-10 w-full items-center justify-center gap-2 rounded-full",
              "bg-[var(--alert-critical-accent)] text-[var(--text-inverse)]",
              "transition-opacity hover:opacity-90",
              RING
            )}
            style={{ font: "var(--type-button)" }}
          >
            {/* TODO-COPY. Available from here as well as from the banner, because a
                mentor part-way through the assessment is exactly who needs it and
                should not have to look back up. */}
            Emergency information
          </button>
          <button
            type="button"
            onClick={onResolve}
            className={cn(
              "flex min-h-9 w-full items-center justify-center rounded-full border border-[color:var(--border-contour)] text-[var(--text-primary)]",
              "transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
            style={{ font: "var(--type-body)" }}
          >
            {/* NOT GATED ON THE CHECKLIST. An escalation can be over before every
                step is covered — the teen's guardian arrives, a supervisor takes it
                — and a Resolve that demanded five ticks would push a mentor into
                ticking them. TODO-COPY. */}
            Resolve this escalation
          </button>
        </div>
      </PanelSection>
    </div>
  );
}
