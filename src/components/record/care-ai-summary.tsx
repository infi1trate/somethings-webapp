"use client";

// AI SUMMARY (Prompt A Phase 3) — moved out of the deleted Care rail into the
// main column, third in the page order: care summary → task region → AI summary.
//
// DECISION SUPPORT, NOT RECORD, and the typography says so: 13px against the
// care update's 15px, secondary ink, never bold. Mentors read this page, and an
// AI paragraph set like an authored clinical account would be read as one. It
// carries an explicit label, an AI-marked icon, a limitation line, an "Updated"
// date and a manual refresh.
//
// FULL WIDTH NOW, BUT STILL COMPACT. Losing the 320px rail could have let this
// grow into the visual peer of the human clinical text beneath it, which is
// exactly the hierarchy the brief forbids. The prose is therefore held to a
// reading measure (max-w-prose) rather than run to the full column, so the card
// stays subordinate by shape as well as by size.
//
// EVENTS, NOT MESSAGE CONTENT. "View conversation" leaves for the conversation
// surface rather than excerpting anything here.
//
// PROVENANCE IS NOW ACCURATE. The limitation line used to claim this was
// generated "from survey history and mentorship activity" — but the generator
// consumes assessments and nothing else: no message, contact or video data
// reaches it. On a page carrying a clinical diagnosis, a provenance line that
// overstates its own inputs is the worst possible thing to be wrong about, so
// the claim was narrowed to what actually happens. See AI_SUMMARY_LIMITATION.

import Link from "next/link";
import { MessagesSquare, RefreshCw, Sparkles } from "lucide-react";
import { clinicalDate } from "@/components/record/care-presentation";
import { chatHrefFor } from "@/lib/record/chat";
import {
  AI_SUMMARY_LIMITATION,
  type CareAiSummary,
} from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-4";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;
const TEXT_LINK =
  "rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70";

export function AiSummaryCard({
  summary,
  refreshedAt,
  onRefresh,
  personId,
}: {
  summary: CareAiSummary | null;
  /** A supervisor's manual refresh, if one has happened. */
  refreshedAt: number | null;
  /** Supervisor tier only — absent below it, never a disabled refresh. */
  onRefresh?: () => void;
  personId: string;
}) {
  const updatedAt = refreshedAt ?? summary?.generatedAt ?? null;

  return (
    <section aria-label="AI summary" data-record-section="care-ai-summary">
      <div className={CARD}>
        <div className="flex items-start justify-between gap-3">
          <p
            className="flex items-center gap-1.5 text-[var(--text-muted)]"
            style={LABEL_STYLE}
          >
            <Sparkles className="size-3.5" aria-hidden />
            {/* TODO-COPY */}
            AI summary
          </p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              /* TODO-COPY */
              aria-label="Refresh the AI summary"
              className={cn(
                "-m-1.5 shrink-0 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <RefreshCw className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        {summary ? (
          <p className="mt-2.5 max-w-prose text-[13px] font-normal leading-[19px] text-[var(--text-secondary)]">
            {summary.text}
          </p>
        ) : (
          <p className="mt-2.5 text-[13px] leading-[19px] text-[var(--text-muted)]">
            {/* TODO-COPY — before a trend exists to describe. */}
            Not enough data yet.
          </p>
        )}

        {/* The limitation line renders whether or not there is a summary: what
            this thing IS matters as much when it has nothing to say. */}
        <p className="mt-3 max-w-prose border-t border-[var(--border-subtle)] pt-2.5 text-[12px] leading-[17px] text-[var(--text-muted)]">
          {AI_SUMMARY_LIMITATION}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {updatedAt && (
            <p className="text-[12px] leading-[17px] text-[var(--text-muted)]">
              {/* Clinical-adjacent date: explicit, not elapsed — same reason as
                  the care summary's provenance line. */}
              {`Updated ${clinicalDate(updatedAt)}`}
            </p>
          )}
          {/* Events, not content: this LEAVES for the conversation rather than
              excerpting a message here. */}
          <Link
            href={chatHrefFor(personId)}
            className={cn(TEXT_LINK, "inline-flex items-center gap-1.5")}
          >
            <MessagesSquare className="size-3.5" aria-hidden />
            {/* TODO-COPY */}
            View conversation
          </Link>
        </div>
      </div>
    </section>
  );
}
