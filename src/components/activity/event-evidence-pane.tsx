"use client";

// THE EVENT EVIDENCE PANE — what was decided, on what basis.
//
// ═══ IT REUSES THE TASKS PANE'S PRIMITIVES, DELIBERATELY ═══
//
// `PANE_LABEL`, `PaneField`, `QuoteBlock`, `PaneChip` and `PaneLink` all come
// from `ui/evidence-primitives.tsx`, which is where the Tasks
// pane's own definitions now live. The section rhythm is therefore the same one a
// supervisor already reads on `/app/tasks` — eyebrow, then content, `space-y-4`
// between — rather than a second dialect for the same job.
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
// ═══ NO `SystemBlock` HERE, AND THAT IS NOT AN OVERSIGHT ═══
//
// The Tasks pane's shape includes an AI-rationale inset, and B3 names it as part
// of the rhythm to reuse. Nothing in the Activity payloads is AI-generated: a
// closed flag carries a decision, categories and reviewer notes — all authored by
// the person who closed it. Reviewer notes therefore render as prose under their
// own label, NOT in the system-attributed inset, because attributing a human's
// notes to a model would be a worse error than an inconsistent pane. The block is
// imported the moment a type carries generated content.

import { useState } from "react";
import { Eye } from "lucide-react";
import {
  PANE_LABEL,
  PaneChip,
  PaneField,
  PaneLink,
  QuoteBlock,
} from "@/components/ui/evidence-primitives";
import { chatHrefFor } from "@/lib/record/chat";
import type { EventEvidence } from "@/lib/activity/evidence";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

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
  /** Reveals the flagged message. Returns null if there is none to reveal. The
   *  ledger owns this because revealing LOGS, and the log needs the viewer id. */
  onRevealFlaggedContent,
}: {
  evidence: EventEvidence | null;
  hasSelection: boolean;
  degradedMessage?: string | null;
  teenId: string | null;
  onRevealFlaggedContent: () => string | null;
}) {
  /** ═══ THE DISCLOSURE RESETS PER SELECTION, AND THAT IS THE POINT ═══
   *  Keyed on the pane's own remount rather than kept in the ledger: moving to
   *  another row must not carry a previous row's revealed state, or one
   *  disclosure would open every subsequent flagged message for free. */
  const [revealed, setRevealed] = useState<string | null>(null);

  return (
    <aside
      /* TODO-COPY */
      aria-label="Event evidence"
      data-slot="event-evidence-pane"
      className="flex min-w-0 flex-col rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      {evidence ? (
        <>
          <div className="min-w-0 flex-1 px-5 py-4">
            <h2
              className="text-[var(--text-primary)]"
              style={{ font: "var(--type-card-title)" }}
            >
              {evidence.title}
            </h2>

            <div className="mt-4 space-y-4">
              {/* ── WHAT WAS DECIDED ── */}
              {evidence.facts.map((f) => (
                <PaneField key={f.label} label={f.label}>
                  {f.value}
                </PaneField>
              ))}

              {/* ── THE ARTIFACT, when the event has one. Prose, so it reads as
                     a document rather than as another value. ── */}
              {evidence.body && (
                <PaneField label={evidence.body.label}>
                  <p className="whitespace-pre-line text-[13.5px] leading-[20px] text-[var(--text-secondary)]">
                    {evidence.body.text}
                  </p>
                </PaneField>
              )}

              {/* ═══ FLAGGED CONTENT, BEHIND A CONTROL ═══
                  ═══ AND THIS DIFFERS FROM THE TASKS PANE ON PURPOSE ═══

                  Tasks shows the message on open, which is right there: it is an
                  active queue of items to act on now, the content IS the thing
                  being judged, and one item is open at a time.

                  Activity is a browsable 30-day history, so the same content has
                  a far wider exposure surface — a reader scrolling a month of
                  rows would surface teen messages incidentally, dozens of times,
                  while looking for something else.

                  Someone will notice the two panes differ and try to make them
                  match. This is the reason not to. See `flaggedContentFor` and
                  design-system-gaps row 328. Revealing LOGS. */}
              {evidence.hasFlaggedContent && (
                <div>
                  <p className={PANE_LABEL}>
                    {/* TODO-COPY */}
                    Flagged content
                  </p>
                  {revealed ? (
                    <div className="mt-2">
                      <QuoteBlock>{revealed}</QuoteBlock>
                      {teenId && (
                        <PaneLink href={chatHrefFor(teenId)}>
                          {/* TODO-COPY */}
                          View chat context
                        </PaneLink>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setRevealed(onRevealFlaggedContent())}
                        className={cn(
                          "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3 text-[13px] font-semibold text-[var(--text-primary)]",
                          "transition-colors hover:bg-[var(--tint-hover)]",
                          RING
                        )}
                      >
                        <Eye className="size-3.5 shrink-0" aria-hidden />
                        {/* TODO-COPY */}
                        View flagged content
                      </button>
                      <p className="mt-2 text-[12px] leading-[16px] text-[var(--text-muted)]">
                        {/* TODO-COPY. Says WHY it is behind a control, so the
                            control does not read as an arbitrary extra click.
                            Non-blaming and factual: it does not imply the reader
                            should not look. */}
                        A teen&apos;s own message. Opening it is recorded.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── RELATED CONTEXT, last: it frames the decision rather than
                     being part of it. ── */}
              {evidence.related && evidence.related.length > 0 && (
                <div className="border-t border-[color:var(--border-subtle)] pt-4">
                  <p className={PANE_LABEL}>
                    {/* TODO-COPY */}
                    Related
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {evidence.related.map((r) => (
                      <PaneChip key={r.label}>
                        {r.label}: {r.value}
                      </PaneChip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ THE PERSISTENT FOOTER LINK ═══
              Every pane has one, in the same place, whatever the type. The pane
              shows what was decided; the record is where the work lives, and a
              reader who wants more should never have to hunt for the way there. */}
          <div className="shrink-0 border-t border-[color:var(--border-subtle)] px-5 py-3">
            <PaneLink href={evidence.record.href} icon={false}>
              {evidence.record.label}
              <span aria-hidden> →</span>
            </PaneLink>
          </div>
        </>
      ) : (
        // BOTH EMPTY STATES CENTRE IN THE FULL COLUMN. `flex-1` on the aside plus
        // this wrapper's own centring, rather than a fixed height — see the note
        // in the ledger about the pane being the grid item itself.
        <div className="flex min-h-[12rem] flex-1 items-center justify-center px-6 py-8">
          <p className="max-w-[28ch] text-center text-[13.5px] leading-[20px] text-[var(--text-muted)]">
            {hasSelection && degradedMessage ? degradedMessage : NOTHING_SELECTED}
          </p>
        </div>
      )}
    </aside>
  );
}
