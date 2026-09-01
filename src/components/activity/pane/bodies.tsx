"use client";

// ONE BODY PER EVENT TYPE (C3).
//
// ═══ WHY THE SWITCH IS HERE AND NOT IN THE PANE ═══
//
// C2 gave every type the same body — metadata, then an optional document, then
// an optional related card — in one order. That was correct while the primitives
// were being built and wrong once they existed, because the ORDER is part of the
// content: a billing review is read code-first and a closed flag is read
// judgement-first, and a single ordering cannot be right for both.
//
// The pane keeps the shell, the header and the actions, which genuinely are the
// same for every type. Only the body varies, so only the body branches.
//
// ═══ NOTHING HERE MUTATES THE SELECTED EVENT (rule 13) ═══
//
// Every control below is a disclosure or a link. The one that reveals flagged
// content calls through the data layer, which LOGS the access — it reads, and
// the reading is recorded; it does not write to the event.

import { Eye } from "lucide-react";
import { chatHrefFor } from "@/lib/record/chat";
import type {
  BillingEvidence,
  EscalationEvidence,
  RiskFlagEvidence,
  SurveyEvidence,
} from "@/lib/activity/evidence";
import { codeLabel, type CodeChange, type Reading } from "@/lib/activity/pane-fixtures";
import { ChangeLog } from "./change-log";
import { DocumentPreview } from "./document-preview";
import { MetadataList } from "./metadata-list";
import { PaneSection } from "./pane-shell";
import { QuoteBlock } from "./quote-block";
import { RelatedRecord } from "./related-record";
import { TrendStrip } from "./trend-strip";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

// ─────────────────────────────────────────────────────────────────────────────
// BILLING — read code-first: what changed, what it means, why, what came before.
// ─────────────────────────────────────────────────────────────────────────────

export function BillingBody({
  evidence,
  codeHistory,
  actorName,
}: {
  evidence: BillingEvidence;
  codeHistory: CodeChange[];
  actorName: (id: string) => string;
}) {
  return (
    <>
      <PaneSection>
        <MetadataList items={evidence.facts} />
      </PaneSection>

      {/* THE CODE IN FORCE, WITH ITS DESCRIPTOR. This is the card that replaced a
          chip reading "Primary presentation: F33.1" and doing nothing — a reader
          who did not already know the code learned nothing from it. */}
      <PaneSection divided>
        <RelatedRecord
          /* TODO-COPY */
          kind="Primary presentation"
          title={<span className="font-mono text-[13.5px]">{evidence.code}</span>}
          summary={
            codeLabel(evidence.code) ??
            /* An honest fallback: the pane knows the code and not its descriptor,
               and saying so beats inventing one. */
            "No descriptor on file for this code."
          }
          href={evidence.record.href}
        />
      </PaneSection>

      {/* NO SECTION HEADING — the document carries its own title line, and a
          heading above it would be the same word twice. */}
      <PaneSection divided>
        <DocumentPreview
          title={evidence.document.title}
          paragraphs={evidence.document.paragraphs}
        />
      </PaneSection>

      {/* THE HISTORY IS THE LEDGER, FILTERED — see `codeHistoryFor`. Rendered
          only when there is one: "no earlier changes" is worth saying inside a
          section a reader opened, and not worth a section of its own. */}
      {codeHistory.length > 0 && (
        <PaneSection label="Earlier changes" divided>
          <ChangeLog changes={codeHistory} actorName={actorName} />
        </PaneSection>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SURVEY — read series-first: the number means nothing without the ones before.
// ─────────────────────────────────────────────────────────────────────────────

export function SurveyBody({
  evidence,
  readings,
}: {
  evidence: SurveyEvidence;
  readings: Reading[];
}) {
  return (
    <>
      {/* ═══ THE TREND COMES FIRST, ABOVE THE METADATA ═══
          Every other type reads facts-first. A survey does not: "GAD-7" and a
          date are the least of what a supervisor needs, and the score in its
          series is the whole event. Eleven after a fourteen is a recovery;
          eleven after a six is a deterioration; eleven on its own is a digit. */}
      <PaneSection>
        {readings.length > 1 ? (
          <TrendStrip instrument={evidence.instrument} readings={readings} />
        ) : (
          // ONE READING IS NOT A TREND. The score renders on its own, with its
          // band, rather than as a strip of one — a "trend" from a single point
          // is a number with an arrow next to it.
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-[22px] font-semibold leading-[26px] tabular-nums text-[var(--text-primary)]">
              {evidence.score}
            </span>
            {evidence.band && (
              <span className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
                {evidence.band}
              </span>
            )}
            <span className="text-[12.5px] leading-[18px] text-[var(--text-muted)]">
              {/* TODO-COPY. Says WHY there is no comparison, so the absence reads
                  as a fact about the record rather than a missing component. */}
              First reading on this instrument
            </span>
          </div>
        )}
      </PaneSection>

      <PaneSection divided>
        <MetadataList items={evidence.facts} />
      </PaneSection>

      {/* THE INSTRUMENT ITSELF, collapsed. A supervisor reconciling a score
          against what was actually asked should not have to leave the pane, and
          the items are the same nine questions every time — so they are a
          document, not a list of facts. */}
      {evidence.items.length > 0 && (
        <PaneSection divided>
          <DocumentPreview
            title={evidence.instrumentName ?? evidence.instrument}
            /* TODO-COPY. The scale is named because an item list without it is
               ambiguous about what a response even was. */
            paragraphs={[
              "Each item is scored 0–3, from “not at all” to “nearly every day”, over the last two weeks.",
              ...evidence.items.map((it, i) => `${i + 1}. ${it}`),
            ]}
          />
        </PaneSection>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK FLAG — read judgement-first, then the words the judgement was about.
// ─────────────────────────────────────────────────────────────────────────────

export function RiskFlagBody({
  evidence,
  subjectName,
  teenId,
  revealed,
  onReveal,
}: {
  evidence: RiskFlagEvidence;
  subjectName: string | null;
  teenId: string | null;
  revealed: string | null;
  onReveal: () => void;
}) {
  return (
    <>
      <PaneSection>
        <MetadataList items={evidence.facts} />
      </PaneSection>

      {/* THE REVIEWER'S REASONING, ATTRIBUTED. On this type the attribution is
          load-bearing: the section below holds a teen's own words, and two
          quotes in one pane must never be confusable about who is speaking. */}
      {evidence.reviewerNote && (
        <PaneSection label="Reviewer notes" divided>
          <QuoteBlock
            attribution={evidence.reviewerNote.attribution}
            meta={evidence.reviewerNote.meta}
          >
            {evidence.reviewerNote.text}
          </QuoteBlock>
        </PaneSection>
      )}

      {/* ═══ FLAGGED CONTENT, BEHIND A CONTROL ═══
          ═══ AND THIS DIFFERS FROM THE TASKS PANE ON PURPOSE ═══
          Tasks shows the message on open, which is right there: an active queue
          of items to act on now, one open at a time. Activity is a browsable
          30-day history, so the same content has a far wider exposure surface —
          a reader scrolling a month of rows would surface teen messages
          incidentally, dozens of times, while looking for something else.
          Someone will notice the two panes differ and try to make them match.
          This is the reason not to. Gap row 328. Revealing LOGS. */}
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
                onClick={onReveal}
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
                {/* TODO-COPY. Says WHY it is behind a control, so the control does
                    not read as an arbitrary extra click. Non-blaming: it does not
                    imply the reader should not look. */}
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
              <span aria-hidden>→</span>
            </a>
          )}
        </PaneSection>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALATION — read outcome-first. Read-only by design; nothing here acts.
// ─────────────────────────────────────────────────────────────────────────────

export function EscalationBody({ evidence }: { evidence: EscalationEvidence }) {
  return (
    <>
      <PaneSection>
        <MetadataList items={evidence.facts} />
      </PaneSection>

      {evidence.notes && (
        <PaneSection label="Notes and recorded discussion" divided>
          <QuoteBlock
            attribution={evidence.notes.attribution}
            meta={evidence.notes.meta}
          >
            {evidence.notes.text}
          </QuoteBlock>
        </PaneSection>
      )}
    </>
  );
}
