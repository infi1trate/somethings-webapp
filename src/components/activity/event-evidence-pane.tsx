"use client";

// THE EVENT EVIDENCE PANE — what was decided, on what basis.
//
// ═══ IT HAS A CONTENT VOCABULARY NOW (C2) ═══
//
// This pane used to import the TASKS pane's primitives — `PaneField`,
// `PaneChip`, `PaneLink` — which gave it one shape, label-over-value, and it used
// that shape for everything. A document, a decision, a timestamp and a related
// record all arrived looking the same, which is why the pane read as a form
// readout rather than as evidence. It was under-designed for want of primitives,
// not for want of length.
//
// It now draws from `components/activity/pane`: a header with an outcome pill, a
// tightened metadata list, a document surface, a quote with attribution, a
// related-record card, a trend strip, a change log, and a pinned action bar.
//
// THE TASKS PANE IS UNTOUCHED. `ui/evidence-primitives.tsx` still exists and
// still serves `/app/tasks`; this surface stopped borrowing from it rather than
// changing it, because a shared primitive edited for one surface's brief is how
// both surfaces end up with one surface's decisions.
//
// ═══ THREE STATES, AND TWO OF THEM ARE NOT ERRORS ═══
//
//  · NOTHING SELECTED — the reader has not picked a row.
//  · NO EVIDENCE — the row degraded, or its type opens no pane. Both are results
//    the data layer returns, not failures. See `evidence.ts`.
//  · EVIDENCE.
//
// The column itself is unmounted by the ledger when the list is empty (B2), so
// this component never has to render "nothing to select" beside "nothing exists".
//
// ═══ NOTHING HERE MUTATES THE SELECTED EVENT (rule 13) ═══
//
// Every control is navigational, referential or additive. `PaneActions` carries
// the long-form statement of that rule; it is repeated here because this is the
// file someone edits when they want to add a button.

import { useState } from "react";
import { Link2 } from "lucide-react";
import type { EventEvidence } from "@/lib/activity/evidence";
import { PaneActions, PaneHeader, PaneShell } from "@/components/activity/pane";
import {
  BillingBody,
  EscalationBody,
  RiskFlagBody,
  SurveyBody,
} from "@/components/activity/pane/bodies";
import type { CodeChange, Reading } from "@/lib/activity/pane-fixtures";

/** TODO-COPY on all three. */
const NOTHING_SELECTED = "Select an event to see what was decided.";

export function EventEvidencePane({
  evidence,
  hasSelection,
  /** True when a row IS selected but degraded — a different message from "pick a
   *  row", because the reader did pick one and is owed the reason. */
  degradedMessage,
  /** The teen this evidence concerns, for the chat link. */
  teenId,
  /** FIRST NAME ONLY. Pre-formatted by the ledger, which owns the rule. */
  subjectName,
  /** Prior code changes for the same object, derived from the ledger itself. */
  codeHistory = [],
  /** The last five readings of this survey's instrument, oldest first. */
  readings = [],
  /** Resolves an actor id to a display name, for the change log. */
  actorName = (id) => id,
  /** Reveals the flagged message. Returns null if there is none to reveal. The
   *  ledger owns this because revealing LOGS, and the log needs the viewer id. */
  onRevealFlaggedContent,
}: {
  evidence: EventEvidence | null;
  hasSelection: boolean;
  degradedMessage?: string | null;
  teenId: string | null;
  subjectName?: string | null;
  codeHistory?: CodeChange[];
  readings?: Reading[];
  actorName?: (id: string) => string;
  onRevealFlaggedContent: () => string | null;
}) {
  /** ═══ THE DISCLOSURE RESETS PER SELECTION, AND THAT IS THE POINT ═══
   *  Keyed on the pane's own remount rather than kept in the ledger: moving to
   *  another row must not carry a previous row's revealed state, or one
   *  disclosure would open every subsequent flagged message for free. */
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** ═══ THE SHORT-CONTENT TREATMENT (C2 item 9) ═══
   *  Both empty states use the same frame as a full pane, so a short record
   *  never reads as a pane that failed to finish rendering. */
  if (!evidence) {
    return (
      <aside
        /* TODO-COPY */
        aria-label="Event evidence"
        data-slot="event-evidence-pane"
        className="flex min-w-0 flex-col rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
      >
        <div className="flex min-h-[12rem] flex-1 items-center justify-center px-6 py-8">
          <p className="max-w-[28ch] text-center text-[13.5px] leading-[20px] text-[var(--text-muted)]">
            {hasSelection && degradedMessage ? degradedMessage : NOTHING_SELECTED}
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      /* TODO-COPY */
      aria-label="Event evidence"
      data-slot="event-evidence-pane"
      className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      <PaneShell
        header={
          <PaneHeader
            eventName={evidence.title}
            outcome={evidence.outcome}
            subjectName={subjectName}
          />
        }
        footer={
          <PaneActions
            primary={{ href: evidence.record.href, label: evidence.record.label }}
            secondary={[
              {
                // REFERENTIAL. Reads the event's identity; writes nothing.
                label: copied ? "Link copied" : "Copy link",
                icon: <Link2 className="size-3.5 shrink-0" aria-hidden />,
                onClick: () => {
                  void navigator.clipboard
                    ?.writeText(window.location.href)
                    .catch(() => {});
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                },
              },
            ]}
          />
        }
      >
        {/* ═══ ONE BODY PER TYPE (C3) ═══
            The shell, the header and the actions are the same for every event —
            they are about the pane. The BODY is not: a billing review is read
            code-first and a closed flag judgement-first, and one ordering cannot
            be right for both. The switch is exhaustive over the union, so a new
            event type cannot be added without deciding what its body is. */}
        {evidence.kind === "billing" && (
          <BillingBody
            evidence={evidence}
            codeHistory={codeHistory}
            actorName={actorName}
          />
        )}
        {evidence.kind === "survey" && (
          <SurveyBody evidence={evidence} readings={readings} />
        )}
        {evidence.kind === "riskFlag" && (
          <RiskFlagBody
            evidence={evidence}
            subjectName={subjectName ?? null}
            teenId={teenId}
            revealed={revealed}
            onReveal={() => setRevealed(onRevealFlaggedContent())}
          />
        )}
        {evidence.kind === "escalation" && <EscalationBody evidence={evidence} />}
      </PaneShell>
    </aside>
  );
}
