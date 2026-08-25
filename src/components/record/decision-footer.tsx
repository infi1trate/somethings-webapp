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
// THE REQUIREMENT IS STATED BEFORE THE REACH, never as an error after. A
// validation message that only appears post-click teaches the rule by punishing
// it, and this page carries a clinical diagnosis about a minor.
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  permanenceNoun?: string;
  rows?: number;
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
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        required
        className={cn(
          "mt-2 block w-full max-w-prose resize-y rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2.5",
          "text-[14px] leading-[20px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
          RING
        )}
        placeholder={placeholder}
      />
    </div>
  );
}

/** TODO-COPY. The helper line that rides under a gated primary action. */
export function gateHelp(ready: boolean, verb: string): string {
  return ready
    ? `${verb} appends this to the record.`
    : `Add a note to enable ${verb}.`;
}
