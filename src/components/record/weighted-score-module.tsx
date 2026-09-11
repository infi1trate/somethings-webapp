"use client";

// ═══ THE WEIGHTED SCORE, AND THE ITEMS BEHIND IT ═══
//
// SHARED BY THE CARE PAGE REVIEW CARD AND THE TASKS BILLING PANE. Extracted
// verbatim from the Care card, which is where it was written; nothing about the
// treatment changed in the move, deliberately — an extraction that also
// restyles is two changes reviewed as one, and the diff stops being readable.
//
// THREE DATA IN A FIXED-HEIGHT DISCLOSURE HEADER, then the comparison grid.
//
// THE WHOLE ROW IS THE TARGET, not the caret. A 14px chevron is a ~14px hit area
// next to a 200px row that looks pressable and is not; readers aim at the number
// and nothing happens. It is a real <button> spanning the panel, so Enter and
// Space come free, focus is native, and the caret is a state indicator with
// `aria-hidden`.
//
// MIN-HEIGHT, NOT FIXED. The fixed height existed so the expanded body could not
// move anything in the header — and it still cannot, because the body is a
// SIBLING of the button and a wrap in here is caused by container width, not by
// the body opening. Three data need to be able to go to two lines rather than
// squeeze a value.
//
// ═══ BOTH SURFACES DEFAULT CLOSED ═══
//
// The revision brief carried a deliberate-difference entry saying Tasks defaults
// collapsed and Care defaults open, for queue throughput vs. single-record
// depth. It was struck at review, because the Care page did not do that: its own
// state has always been `useState(false)`. So there is one default, it is closed,
// and `defaultOpen` exists for the caller that one day wants otherwise rather
// than to encode a difference that was never there.

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { clinicalDate } from "@/components/record/care-presentation";
import { bandLabel } from "@/components/record/score-chip";
import { SurveyComparisonGrid } from "@/components/record/survey-comparison-grid";
import { INSTRUMENT_MAX, type PresentationReview } from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** The strip's value style, in one place — 20px tabular primary. */
const STAT_VALUE = "text-[20px] leading-[24px] tabular-nums text-[var(--text-primary)]";

/** The band name beside the score, on ONE baseline with it — 12px, card tone,
 *  hairline ring. Neutral: severity lives in the task label band, and a second
 *  coloured chip inside the card would be a second severity signal. */
function BandChip({ severity }: { severity: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-[12px] leading-[16px] text-[var(--text-secondary)] ring-1 ring-inset ring-[color:var(--border-subtle)]">
      {bandLabel(severity)}
    </span>
  );
}

export function WeightedScoreModule({
  review,
  defaultOpen = false,
  className,
}: {
  review: PresentationReview;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  /** ONE shape for both variants: the aggregate's weighted score reads in the
   *  same position as a single survey's, which is what makes the two variants
   *  legible as the same block rather than two designs. */
  const evidence = review.aggregate
    ? {
        score: review.aggregate.score,
        severity: review.aggregate.severity,
        instrument: review.aggregate.surveys[0]?.instrument ?? "",
        at: review.aggregate.surveys[0]?.at ?? 0,
      }
    : review.survey;

  if (!evidence) return null;

  /** THE DENOMINATOR, from the instrument definition — never a literal in the
   *  markup: a per-card constant is how one surface ends up saying /21 for a
   *  PHQ-9. */
  /* THE CAST IS THE CARE CARD'S OWN. `INSTRUMENT_MAX` is keyed on the two
     instruments this codebase has cut-offs for, and `instrument` is a string on
     the fixture — so an instrument outside those two renders the number with NO
     denominator rather than a wrong one. Honest: a "/21" under a scale nobody
     defined would assert a maximum that does not exist. */
  const maxScore =
    INSTRUMENT_MAX[evidence.instrument as keyof typeof INSTRUMENT_MAX] ?? null;
  const surveyCount = review.aggregate ? review.aggregate.surveys.length : 1;
  const surveys = review.aggregate
    ? review.aggregate.surveys
    : review.survey
      ? [review.survey]
      : [];

  return (
    <div
      data-record-section="weighted-score"
      className={cn(
        "-mx-1.5 overflow-hidden rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-1.5",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex min-h-[92px] w-full cursor-pointer items-center gap-x-3 px-6 py-3 text-left",
          "transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {/* ═══ THREE DATA, WRAPPING 2+1 BEFORE ANY VALUE TRUNCATES ═══
            `flex-wrap` with each datum `shrink-0`: the row would rather go to two
            lines than squeeze a value, because a truncated "10 / 21" is not a
            score and a truncated date range is not a window.

            BOTH VALUES SHARE A BASELINE by construction: the data are
            `items-start` siblings whose labels are the same style and therefore
            the same height, so the value lines begin at the same y without
            either being told a height. */}
        <span className="flex min-w-0 flex-1 flex-wrap items-start gap-x-10 gap-y-3">
          {/* DATUM 1 — THE INSTRUMENT. It was a prefix on the Surveys sub-line,
              where it read as part of the date range rather than as the thing
              being measured. TODO-COPY — PLACEHOLDER. */}
          <span className="flex shrink-0 flex-col gap-y-1">
            <span className="text-[var(--text-muted)]" style={LABEL_STYLE}>
              Assigned assessment
            </span>
            <span className={STAT_VALUE}>{evidence.instrument}</span>
          </span>

          {/* DATUM 2 — "Weighted score" ONLY when there is a weighting. One
              reading weighted is not a weighting, and calling it one would be the
              single-survey lie this block exists to prevent. TODO-COPY. */}
          <span className="flex shrink-0 flex-col gap-y-1">
            <span className="text-[var(--text-muted)]" style={LABEL_STYLE}>
              {review.aggregate ? "Weighted score" : "Score"}
            </span>
            <span className="flex items-baseline gap-x-2">
              <span className="flex shrink-0 items-baseline gap-x-1">
                <span className={STAT_VALUE}>{evidence.score}</span>
                {maxScore !== null && (
                  <span className="text-[14px] leading-[26px] tabular-nums text-[var(--text-muted)]">
                    / {maxScore}
                  </span>
                )}
              </span>
              <BandChip severity={evidence.severity} />
            </span>
          </span>

          {/* DATUM 3 — the count is a value and the window it covers is its
              sub-line. Dates alone: the instrument is its own datum, so repeating
              it here would state one fact twice in one row. Oldest → newest; on
              one survey it is that survey's own date, with no range and no
              "weighted" language anywhere in the unit. TODO-COPY. */}
          <span className="flex shrink-0 flex-col gap-y-1">
            <span className="text-[var(--text-muted)]" style={LABEL_STYLE}>
              Assessments
            </span>
            <span className={STAT_VALUE}>{surveyCount}</span>
            <span className="whitespace-nowrap text-[13px] leading-[18px] text-[var(--text-muted)]">
              {review.aggregate
                ? `${clinicalDate(
                    review.aggregate.surveys[review.aggregate.surveys.length - 1].at
                  )} – ${clinicalDate(review.aggregate.surveys[0].at)}`
                : clinicalDate(evidence.at)}
            </span>
          </span>
        </span>

        {/* PINNED, and a LABEL rather than a control — its own flex child, so it
            cannot move. IT STILL TOGGLES: an action phrase that never changes
            reads "View results" while the results are on screen. Open drops the
            count with the verb — "Hide results (3)" would be offering to hide
            three of something. TODO-COPY — PLACEHOLDER. */}
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)]">
          {open ? "Hide results" : `View results (${surveyCount})`}
          <ChevronRight
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
            aria-hidden
          />
        </span>
      </button>

      {/* BODY — expanded only, beneath a hairline, full width, BELOW the header
          rather than beside the score.

          THE SHARED GRID. The same component the evidence strip renders, so a
          supervisor who opens the answers here and then opens the review is
          looking at one table rather than two layouts of one dataset. It replaced
          a stacked pair — the contributing surveys, then the newest survey's
          answers — which could show what the period contained OR what one day
          contained, never both. The claim being checked ("the movement sits in
          these items") is a comparison, so the display is one. */}
      {open && (
        <div className="border-t border-[var(--border-subtle)] px-6 py-3">
          <SurveyComparisonGrid
            surveys={surveys}
            weighted={
              review.aggregate
                ? {
                    score: review.aggregate.score,
                    severity: review.aggregate.severity,
                  }
                : null
            }
          />
        </div>
      )}
    </div>
  );
}
