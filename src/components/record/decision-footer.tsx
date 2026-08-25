"use client";

// DECISION FOOTER — ONE component across both commit paths: the presentation
// review's provider note, and the flag review modal's close note.
//
// UNIFIED VERB GRAMMAR. Presentation review is Approve / Change; escalation and
// risk flag are Review / Close. Different verbs, identical grammar: a primary
// action in the band, and a decision that cannot commit without a required,
// permanent note. That sameness is the whole reason this is one component —
// a supervisor learns the rule once.
//
// ERROR RECOVERY OVER ERROR PREVENTION — a deliberate reversal, and worth
// recording because the previous version argued the opposite.
//
// The old gate disabled the primary button and explained itself in helper text
// beneath it. That reads well in a spec and fails in use: a disabled primary
// gives no feedback when pressed, its helper text sits far from the field that
// actually needs filling, and disabled controls are unreliably reachable for
// assistive technology — so the one person most likely to need the explanation is
// the least likely to receive it. Visibility of system status loses twice.
//
// Now the button is ALWAYS live. Pressing it with an empty note moves focus to
// the field, gives the field error styling, and announces the message from beside
// the field via aria-live. The requirement is still stated up front in the
// helper line; what changed is that failing to meet it now produces a response
// rather than silence.
//
// PERMANENCE IS STATED TOO. Append-only means a note cannot be edited once it
// lands, and a supervisor should know that while they are still writing.

import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** Is a note substantive? Whitespace is not a rationale. */
export function noteReady(note: string): boolean {
  return note.trim().length > 0;
}

export function DecisionNote({
  id,
  label,
  value,
  onChange,
  placeholder,
  /** What the note is attached to, named in the permanence line. */
  permanenceNoun = "decision",
  rows = 3,
  error = false,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  permanenceNoun?: string;
  rows?: number;
  /** Set once a commit was attempted with an empty note. */
  error?: boolean;
  /** So the committer can move focus here on a failed attempt. */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[var(--text-muted)]"
        style={LABEL_STYLE}
      >
        {label}
      </label>
      <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-muted)]">
        {/* TODO-COPY — the requirement AND the permanence, up front. */}
        {`Required. Your reasoning is recorded with this ${permanenceNoun} and cannot be edited afterwards.`}
      </p>
      <textarea
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        required
        aria-invalid={error || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "mt-2 block w-full max-w-prose resize-y rounded-[var(--radius-surface)] bg-[var(--surface-card)] px-3 py-2.5",
          "text-[14px] leading-[20px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
          error
            ? "border-2 border-[color:var(--state-error)]"
            : "border border-[color:var(--border-subtle)]",
          RING
        )}
        placeholder={placeholder}
      />
      {/* THE MESSAGE LIVES BESIDE THE FIELD, not under the button — that is the
          whole point of the change. aria-live so it is announced when it appears
          rather than only found by someone who goes looking. */}
      <p
        id={`${id}-error`}
        aria-live="polite"
        className="mt-1.5 min-h-[18px] text-[13px] leading-[18px] text-[var(--state-error)]"
      >
        {/* TODO-COPY */}
        {error ? "A note is required before approving" : ""}
      </p>
    </div>
  );
}

// `gateHelp` is GONE. It produced "Add a note to enable Approving." under a
// disabled button — both halves of the pattern this file just replaced. The
// requirement now lives in DecisionNote's own helper line, and the failure lives
// beside the field.
