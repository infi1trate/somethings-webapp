"use client";

// CLOSING AN ESCALATION.
//
// ═══ RESOLVING IS EXPLICIT, AND IT WRITES A NOTE ═══
//
// An escalation does not time out, does not close when the conversation moves on,
// and does not close when the assessment is complete. Somebody has to say it is
// over — which is why the banner persists across navigation until this dialog is
// used, and why nothing else in the surface can clear it.
//
// A resolution note is REQUIRED. This is the one place on this surface that demands
// prose, and the reason is specific: an escalation with no account of how it ended
// is the single worst record this product can hold. Six weeks later, a supervisor
// looking at "escalation opened 4:12 PM, escalation resolved 5:40 PM" learns
// nothing about whether a teenager is all right.
//
// ═══ A DIALOG, UNLIKE THE ASSESSMENT ═══
//
// The assessment lives in the rail because it is worked through against the
// conversation. Resolving is a single decision made once, and it deserves the focus
// trap: it is the one moment in this flow where a mis-click has a consequence that
// cannot be undone from the UI.
//
// ═══ NOTHING HERE CELEBRATES ═══
//
// No tick, no green, no "Nice work". An escalation ending well is a relief; an
// escalation ending is not an achievement, and a mentor who has spent an hour on
// the phone with a frightened teenager does not need a product congratulating them.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assessmentProgress, checkedCount, ASSESSMENT } from "@/lib/chat/assessment";
import type { EscalationState } from "@/lib/chat/types";
import { NO_THREAT_OUTCOME, escalationTarget, stepDownFor } from "@/lib/tiering/escalation";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ WHY, AS A CHOICE, THEN THE PROSE ═══
 *
 *  A blank box asked of a mentor who has just come off a difficult call produces
 *  either nothing or one word. Naming the common endings first gives them somewhere
 *  to start — and it makes the record comparable across escalations, which a free
 *  field never is.
 *
 *  There is no "other" option and no way to skip: every ending here is a real one,
 *  and if a mentor's ending is not on the list the prose is where it goes.
 *
 *  TODO-COPY on all four, and these need the same clinical review the assessment
 *  script does (gap row 357). */
const OUTCOMES: Array<{ id: string; label: string }> = [
  { id: "guardian", label: "A guardian or trusted adult is with them" },
  { id: "supervisor", label: "My supervisor has taken it from here" },
  { id: "services", label: "Emergency services were called" },
  { id: "settled", label: "They are safe and we have a plan" },
  /* ═══ ADDED (Tiering & Escalation pack, Phase 3) ═══ The canon's one
     outcome that lets a Tier 1 crisis note exit to Tier 3 rather than
     Tier 2 (`stepDownFor`). The id is the constant the tier rule reads. */
  { id: NO_THREAT_OUTCOME, label: "The danger has passed — they're no longer a threat to themselves" },
];

export function ResolveDialog({
  escalation,
  theirName,
  open,
  onOpenChange,
  onResolve,
}: {
  escalation: EscalationState;
  theirName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (resolution: { outcomeId: string; note: string }) => void;
}) {
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState("");
  /* BOTH REQUIRED. The outcome makes the record comparable; the prose makes it
     mean something. Neither alone is a record of how this ended. */
  const canResolve = !!outcome && note.trim().length > 0;
  const covered = checkedCount(escalation.assessment);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="resolve-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{/* TODO-COPY */}Resolve this escalation</DialogTitle>
          <DialogDescription>
            {/* TODO-COPY. Names who reads it, which is what changes how it is
                written. */}
            Your lead and your supervisor will read this.
            {/* ═══ FOR TIER 1 THIS IS THE CRISIS NOTE ═══ The only way out of
                Tier 1, so it says so: submitting asks for the step down, and
                a supervisor's confirmation completes it. */}
            {escalationTarget(escalation) === 1 && (
              <span data-crisis-note className="mt-1 block">
                {/* TODO-COPY */}
                For Tier 1 this is the crisis note. Submitting asks your supervisor to step {theirName} down to Tier{" "}
                {outcome ? stepDownFor(escalation, outcome) : 2}.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ═══ THE ASSESSMENT'S STATE, STATED, NOT ENFORCED ═══
              A mentor resolving with two of five covered is told so — because a
              supervisor reading back will see the same thing and should not be the
              first person to notice. But it does not BLOCK: an escalation can be
              over before every step applies, and a gate here would push a mentor
              into ticking boxes to get past it. */}
          {covered < ASSESSMENT.length && (
            <p
              className="rounded-[var(--radius-inset)] bg-[var(--alert-warning-bg)] px-3 py-2.5 text-[var(--alert-warning-fg)]"
              style={{ font: "var(--type-body)" }}
            >
              {/* TODO-COPY */}
              {assessmentProgress(escalation.assessment)} on the checklist. That is
              fine if the situation moved on — say so below.
            </p>
          )}

          <fieldset>
            <legend
              className="mb-2 text-[var(--text-muted)]"
              style={{
                font: "var(--type-field-label)",
                letterSpacing: "var(--type-field-label-tracking)",
              }}
            >
              {/* TODO-COPY */}
              How did it end?
            </legend>
            <div className="space-y-1.5">
              {OUTCOMES.map((o) => {
                const on = outcome === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setOutcome(o.id)}
                    className={cn(
                      "flex w-full items-center rounded-[var(--radius-inset)] px-3 py-2.5 text-left transition-colors",
                      on
                        ? "bg-[var(--surface-s2)] text-[var(--text-primary)]"
                        : "bg-[var(--surface-s1)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                      RING
                    )}
                    style={{ font: "var(--type-body)" }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span
              className="mb-1 block text-[var(--text-muted)]"
              style={{
                font: "var(--type-field-label)",
                letterSpacing: "var(--type-field-label-tracking)",
              }}
            >
              {/* TODO-COPY. NOT marked optional, because it is not — see the module
                  note on why this is the one required prose field on the surface. */}
              What happened
            </span>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              /* TODO-COPY. An example in the register wanted: what was said, what
                 was done, where it stands. Not a diagnosis. */
              placeholder={`Called ${theirName}, her aunt came home at 6. She is not alone tonight and I will check in tomorrow morning.`}
              className={cn(
                "block w-full resize-none rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2",
                "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                RING
              )}
              style={{ font: "var(--type-body)" }}
            />
          </label>

          <button
            type="button"
            disabled={!canResolve}
            onClick={() => {
              onResolve({ outcomeId: outcome!, note: note.trim() });
              onOpenChange(false);
            }}
            className={cn(
              "flex min-h-10 w-full items-center justify-center rounded-full transition-colors",
              canResolve
                ? "bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
                : "bg-[var(--surface-s2)] text-[var(--text-muted)]",
              RING
            )}
            style={{ font: "var(--type-button)" }}
          >
            {/* NOT "Done", NOT a tick. The word is the act. TODO-COPY. */}
            Resolve
          </button>

          {!canResolve && (
            <p
              className="text-[var(--text-muted)]"
              style={{ font: "var(--type-field-label)" }}
            >
              {/* SAYS WHAT IS MISSING rather than leaving a disabled button to be
                  puzzled over — which on this surface would be a mentor stuck at
                  the last step of a crisis. TODO-COPY. */}
              {!outcome
                ? "Choose how it ended."
                : "Add a line about what happened."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { OUTCOMES as RESOLUTION_OUTCOMES };
