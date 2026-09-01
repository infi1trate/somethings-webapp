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
import { Eye, Link2 } from "lucide-react";
import { chatHrefFor } from "@/lib/record/chat";
import type { EventEvidence } from "@/lib/activity/evidence";
import {
  ChangeLog,
  DocumentPreview,
  MetadataList,
  PaneActions,
  PaneHeader,
  PaneSection,
  PaneShell,
  QuoteBlock,
  RelatedRecord,
  TrendStrip,
  type MetadataItem,
} from "@/components/activity/pane";
import { codeLabel, type CodeChange, type Reading } from "@/lib/activity/pane-fixtures";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY on all three. */
const NOTHING_SELECTED = "Select an event to see what was decided.";

/** ═══ THE OUTCOME COMES OUT OF THE FACTS AND INTO THE HEADER ═══
 *
 *  The pane used to render "Status: Active" and "Decision: Closed" as metadata
 *  rows indistinguishable from a timestamp — so the answer to "how did this come
 *  out" was buried in a list whose other entries were "When" and "Approved by".
 *
 *  These three labels ARE the outcome, so the first one found is lifted into the
 *  header pill and removed from the list. A closed set rather than a heuristic:
 *  a label that means "outcome" is a decision the evidence model makes, and
 *  guessing from the value would promote the wrong row the first time a fact
 *  happened to read like a status word. */
const OUTCOME_LABELS = ["Status", "Decision", "Outcome"];

function splitOutcome(facts: EventEvidence["facts"]): {
  outcome: string | null;
  rest: MetadataItem[];
} {
  const i = facts.findIndex((f) => OUTCOME_LABELS.includes(f.label));
  if (i < 0) return { outcome: null, rest: facts.map((f) => ({ ...f })) };
  return {
    outcome: facts[i].value,
    rest: facts.filter((_, j) => j !== i).map((f) => ({ ...f })),
  };
}

/** A body whose label names NOTES is a quotation — someone wrote it and the
 *  attribution is the point. Anything else is a document. The distinction is the
 *  1:1 re-expression of what the pane already had: two `body` shapes that were
 *  rendering identically. */
function bodyIsQuote(label: string): boolean {
  return /note/i.test(label);
}

export function EventEvidencePane({
  evidence,
  hasSelection,
  /** True when a row IS selected but degraded — a different message from "pick a
   *  row", because the reader did pick one and is owed the reason. */
  degradedMessage,
  /** The teen this evidence concerns, for the chat link. */
  teenId,
  /** FIRST NAME ONLY. Pre-formatted by the ledger, which owns the rule — this
   *  surface never renders a surname. Drives the header's subject line. */
  subjectName,
  /** Prior code changes for the same object, derived from the ledger itself —
   *  see `codeHistoryFor`. Empty for every type but billing. */
  codeHistory = [],
  /** The last five readings of this survey's instrument, oldest first. */
  readings = [],
  /** Resolves an actor id to a display name, for the change log. */
  actorName,
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

  /** ═══ THE SHORT-CONTENT TREATMENT (layout item 9) ═══
   *  Both empty states use the same shell as a full pane, so the footer sits on
   *  the bottom edge either way and a short record never reads as a pane that
   *  failed to finish rendering. */
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

  const { outcome, rest } = splitOutcome(evidence.facts);

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
            outcome={outcome}
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
                    ?.writeText(
                      `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(
                        evidence.eventType
                      )}`
                    )
                    .catch(() => {});
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                },
              },
            ]}
          />
        }
      >
        {/* ── WHAT WAS DECIDED ── */}
        {rest.length > 0 && (
          <PaneSection>
            <MetadataList items={rest} />
          </PaneSection>
        )}

        {/* ── THE ARTIFACT ──
            A body whose label names notes is a QUOTE with attribution; anything
            else is a document. Both used to render as a paragraph under a label. */}
        {evidence.body &&
          (bodyIsQuote(evidence.body.label) ? (
            <PaneSection label={evidence.body.label} divided>
              <QuoteBlock attribution={actorName ? undefined : undefined}>
                {evidence.body.text}
              </QuoteBlock>
            </PaneSection>
          ) : (
            <PaneSection divided>
              {/* NO SECTION HEADING — the document carries its own title line, and
                  a heading above it would be the same word twice (layout item 10). */}
              <DocumentPreview
                title={evidence.body.label}
                paragraphs={evidence.body.text.split(/\n{2,}/)}
              />
            </PaneSection>
          ))}

        {/* ── THE TREND, when this event is a reading ── */}
        {readings.length > 1 && (
          <PaneSection label="Recent readings" divided>
            <TrendStrip
              instrument={
                evidence.facts.find((f) => f.label === "Instrument")?.value ?? ""
              }
              readings={readings}
            />
          </PaneSection>
        )}

        {/* ── FLAGGED CONTENT, BEHIND A CONTROL ──
            ═══ AND THIS DIFFERS FROM THE TASKS PANE ON PURPOSE ═══
            Tasks shows the message on open, which is right there: an active queue
            of items to act on now, one open at a time. Activity is a browsable
            30-day history, so the same content has a far wider exposure surface —
            a reader scrolling a month of rows would surface teen messages
            incidentally, dozens of times, while looking for something else.
            See `flaggedContentFor` and gap row 328. Revealing LOGS. */}
        {evidence.hasFlaggedContent && (
          <PaneSection label="Flagged content" divided>
            {revealed ? (
              <QuoteBlock
                attribution={subjectName ?? undefined}
                /* TODO-COPY */
                meta="flagged message"
              >
                {revealed}
              </QuoteBlock>
            ) : (
              <div>
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
                  {/* TODO-COPY. Says WHY it is behind a control, so the control
                      does not read as an arbitrary extra click. */}
                  A teen&apos;s own message. Opening it is recorded.
                </p>
              </div>
            )}
            {teenId && (
              <a
                href={chatHrefFor(teenId)}
                className={cn(
                  "mt-2.5 inline-flex items-center gap-1.5 rounded-sm py-1.5 text-[13px] font-semibold text-[var(--text-primary)]",
                  "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
                  RING
                )}
              >
                {/* TODO-COPY */}
                View chat context
              </a>
            )}
          </PaneSection>
        )}

        {/* ── RELATED RECORDS ──
            ═══ THIS REPLACES THE DEAD CHIP ═══
            "Primary presentation: F33.1" was a neutral chip that named a record
            and did nothing — not a link, not expandable, no content. A reader who
            did not already know the code learned nothing from it. */}
        {evidence.related && evidence.related.length > 0 && (
          <PaneSection label="Related" divided>
            <div className="space-y-2.5">
              {evidence.related.map((r) => (
                <RelatedRecord
                  key={r.label}
                  kind={r.label}
                  title={<span className="font-mono text-[13.5px]">{r.value}</span>}
                  summary={
                    codeLabel(r.value) ??
                    /* TODO-COPY. An honest fallback: the pane knows the code and
                       not its descriptor, and saying so beats inventing one. */
                    "No descriptor on file for this code."
                  }
                  href={evidence.record.href}
                />
              ))}
            </div>
          </PaneSection>
        )}

        {/* ── THE CODE HISTORY, free from the append-only ledger ── */}
        {codeHistory.length > 0 && actorName && (
          <PaneSection label="Earlier changes" divided>
            <ChangeLog changes={codeHistory} actorName={actorName} />
          </PaneSection>
        )}
      </PaneShell>
    </aside>
  );
}
