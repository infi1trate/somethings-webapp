"use client";

// CARE SUMMARY — the page's spine (Prompt A Phase 2). ONE card, merging what
// used to be two: the primary-presentation card and the cadence card, which sat
// side by side in an xl:grid-cols-2 split and made a reader look in two places
// for one story.
//
// NO CONTAINERS INSIDE CONTAINERS. The card is sectioned by a hairline and
// vertical rhythm, never by nesting a second surface inside it. The hero is
// typography; the metrics band below it is a hairline and a grid.
//
// CLINICAL DATES ARE EXPLICIT DATES. The elapsed-time standard governs secondary
// lines everywhere else in this product and is deliberately SUSPENDED for the
// provenance line: "assigned 4 months ago" is unusable to anyone reconciling
// this record against an outside provider's notes, and a diagnosis date is a
// fact of record rather than a recency signal. The next-review COUNTDOWN keeps
// the elapsed framing, because a countdown is a distance and not a date of
// record — so this card deliberately carries both forms.
//
// SEVERITY IS HONEST. A scheduled cadence review is routine work. The Next
// review cell carries no tint, no icon and no accent bar; the only thing that
// changes when it goes overdue is the countdown's colour and the word "overdue".
// Tinted surfaces on this page are reserved for open escalations and risk flags.
//
// THE METRICS BAND IS FIVE CELLS, AND TWO OF THEM ARE NOT THE ONES SPECIFIED.
// The brief named Mentor · Days in mentorship · Days engaged · Messages sent ·
// Next review. "Days engaged" and "Messages sent" DO NOT EXIST in this codebase
// and cannot be derived: the only message data on a teen is two scalars
// (`mentorLastSentDaysAgo`, `menteeLastSentDaysAgo` — "days since last sent"),
// and days-with-an-exchange needs a per-day log that was never built. Rather
// than invent two numbers on a clinical record, their slots carry the two
// cadence facts that would otherwise have lost their home when the cadence card
// was merged away: Assigned survey and Last assessment. Nothing is dropped and
// nothing is fabricated. Reported.

import Link from "next/link";
import {
  reviewDueState,
  STAGE_LABEL,
  type CareCadence,
  type CarePresentation,
} from "@/lib/record/care-demo";
import { clinicalDate } from "@/components/record/care-presentation";
import { ScoreChip } from "@/components/record/score-chip";
import { TonalChip } from "@/components/record/tonal-chip";
import {
  ScoreSparkline,
  SPARKLINE_MIN_POINTS,
} from "@/components/record/score-sparkline";
import { RecordButton } from "@/components/record/record-button";
import {
  currentMentorId,
  daysInMentorship,
  formatDaysInMentorship,
  type RelationshipSlice,
} from "@/lib/record/relationships";
import { DEMO_PEOPLE, type DemoTeen } from "@/lib/record/people-demo";
import { LIVE_ID, recordHrefFor } from "@/lib/record/subject";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-4";
const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** THE STATEMENT STOP. ~30px, -0.4px tracking, 1.15 line-height — the largest
 *  text on the page after the person's name.
 *
 *  LAUSANNE 400, NOT THE DISPLAY FACE, and that is a constraint rather than a
 *  preference: this app loads exactly two faces, Avantt Bold (700) and TWK
 *  Lausanne Regular (400). There is no medium weight in either family, and
 *  browsers synthesise bolder but never lighter, so `font-weight: 500` renders
 *  as 400 here. The brief asked for medium weight; 400 in the text face is the
 *  closest available, and it has the property the hierarchy actually needs —
 *  the person's name (Avantt 700 at the same 30px) still dominates by weight
 *  AND typeface, so "largest after the name" holds at equal size. Reported. */
const STATEMENT = {
  fontSize: "30px",
  lineHeight: "1.15",
  letterSpacing: "-0.4px",
  fontWeight: 400,
} as const;

/** One metric: label ABOVE value, per the brief. Values are tabular so the
 *  numbers line up down a column of records, which is the whole point of a
 *  named metric keeping its own format. */
function Metric({
  label,
  children,
  sub,
  tone = "default",
}: {
  label: string;
  children: React.ReactNode;
  /** The muted second line — a date, a lock, a countdown. */
  sub?: React.ReactNode;
  /** "warning" is used ONLY by an overdue countdown, and only on the sub-line.
   *  It never tints a surface — see the module note on honest severity. */
  tone?: "default" | "warning";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
        {label}
      </p>
      {/* ~20px, tabular. Values rise so the row scans as data; labels dropped
          to 12px so the pair reads label-then-value rather than two peers. */}
      <p className="mt-1 flex min-w-0 items-center gap-2 text-[20px] leading-[26px] tabular-nums text-[var(--text-primary)]">
        {children}
      </p>
      {sub && (
        <p
          className={cn(
            "mt-0.5 text-[13px] leading-[18px]",
            tone === "warning"
              ? "font-semibold text-[var(--alert-warning-fg)]"
              : "text-[var(--text-muted)]"
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export function CareSummaryCard({
  teen,
  presentation,
  cadence,
  now,
  relationships = {},
  onChange,
  onAssignSurvey,
  liveMentorName,
  series,
}: {
  teen: DemoTeen;
  presentation: CarePresentation | null;
  cadence: CareCadence;
  now: number;
  relationships?: RelationshipSlice;
  /** Supervisor tier ONLY. The prop being absent is how the affordance is
   *  absent — there is no disabled twin of this control. */
  onChange?: () => void;
  /** Also supervisor-only, and MUTUALLY EXCLUSIVE with `onChange` in practice:
   *  a record with no survey has no presentation to change, and a record with a
   *  presentation has long since had one. They share the header slot rather than
   *  competing for it. Inherited from the merged-away cadence card so the
   *  capability isn't silently lost. */
  onAssignSurvey?: () => void;
  /** The store-backed mentor's name. "live" has NO fixture row in DEMO_PEOPLE,
   *  so looking them up there returns nothing and the cell would read
   *  "Unmatched" for the eleven teens actually matched to them. Resolved by the
   *  caller from the draft, the same way the mentee table and five other
   *  surfaces do it. */
  liveMentorName?: string;
  /** The locked instrument's scores, oldest → newest, from `scoreSeriesFor`.
   *  Passed in rather than derived here so this card keeps taking data and not
   *  a store. */
  series?: { instrument: string; scores: number[] } | null;
}) {
  const mentorId = currentMentorId(teen, relationships);
  const fixtureMentor =
    mentorId && mentorId !== LIVE_ID
      ? DEMO_PEOPLE.find((p) => p.id === mentorId)
      : undefined;
  const mentorName =
    mentorId === LIVE_ID
      ? (liveMentorName ?? "Jordan Rivera")
      : (fixtureMentor?.goesBy ?? fixtureMentor?.name);
  const due = cadence.nextReviewDue
    ? reviewDueState(cadence.nextReviewDue, now)
    : null;

  return (
    <section aria-label="Care summary" data-record-section="care-summary">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        {/* TODO-COPY */}
        <h2 className={H2}>Care summary</h2>
        {/* AN EXPLICIT, DELINEATED CTA — a properly styled secondary button in
            the block's header row, not a bare underlined link floating above the
            card. THE NOUN IS THE POINT: "Change presentation" cannot be confused
            with the care update's "Write care update" one section below, where a
            lone "Change" could. Supervisor tier only; absent below, never
            disabled. */}
        {onChange && presentation ? (
          <RecordButton onClick={onChange}>
            {/* TODO-COPY */}
            Change presentation
          </RecordButton>
        ) : onAssignSurvey ? (
          <RecordButton onClick={onAssignSurvey}>
            {/* TODO-COPY */}
            Assign first survey
          </RecordButton>
        ) : null}
      </div>

      <div className={`mt-3 ${CARD}`}>
        {/* ── HERO: the presentation on record ─────────────────────────── */}
        {presentation ? (
          <>
            <p
              className="text-[var(--text-primary)]"
              style={STATEMENT}
            >
              {presentation.statement}
            </p>
            {/* THE CODE IS AN IDENTIFIER, so it looks like one: a tonal chip
                with tabular figures rather than a line of grey text that reads
                as a subtitle. */}
            <div className="mt-2.5">
              <TonalChip mono className="text-[var(--text-secondary)]">
                {presentation.code}
              </TonalChip>
            </div>
            <p
              className="mt-2.5 text-[var(--text-muted)]"
              style={{ font: "var(--type-helper)" }}
            >
              {/* TODO-COPY. Explicit dates — the clinical-date exception. */}
              {`Assigned ${clinicalDate(presentation.assignedAt)} by ${presentation.assignedBy}${
                presentation.reviewedAt
                  ? ` · reviewed ${clinicalDate(presentation.reviewedAt)}`
                  : " · not yet reviewed"
              }`}
            </p>
          </>
        ) : (
          // AT STATEMENT SCALE, so the card keeps its shape instead of
          // collapsing to a caption when nothing is assigned yet. The cadence
          // facts below still populate: a teen without a presentation still has
          // a mentor, a tenure and a survey clock.
          <p
            className="max-w-[24ch] text-[var(--text-muted)]"
            style={STATEMENT}
          >
            {/* TODO-COPY — an empty state, never an em dash. */}
            Not yet assigned
          </p>
        )}

        {/* ── METRICS: a hairline and a grid, NOT a nested card ─────────── */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3 xl:grid-cols-5">
          {/* TODO-COPY on every label. */}
          <Metric label="Mentor">
            {mentorId && mentorName ? (
              <Link
                href={recordHrefFor(mentorId)}
                className={cn(
                  "rounded-sm underline decoration-[var(--border-contour)] underline-offset-2 transition-opacity hover:opacity-70",
                  RING
                )}
              >
                {mentorName}
              </Link>
            ) : (
              // Unmatched is a real state, not missing data.
              <span className="text-[var(--text-muted)]">Unmatched</span>
            )}
          </Metric>

          <Metric label="Days in mentorship">
            {formatDaysInMentorship(daysInMentorship(teen))}
          </Metric>

          <Metric
            label="Assigned survey"
            sub={
              cadence.surveyLockedAt
                ? `Locked ${clinicalDate(cadence.surveyLockedAt)}`
                : cadence.outstandingSurvey
                  ? `Sent ${clinicalDate(cadence.outstandingSurvey.sentAt)} · not returned yet`
                  : undefined
            }
          >
            {cadence.assignedSurvey ??
              cadence.outstandingSurvey?.instrument ?? (
                <span className="text-[var(--text-muted)]">Not yet assigned</span>
              )}
          </Metric>

          <Metric
            label="Last assessment"
            sub={
              cadence.lastAssessment
                ? `${cadence.lastAssessment.instrument} · ${clinicalDate(cadence.lastAssessment.at)}`
                : undefined
            }
          >
            {cadence.lastAssessment ? (
              <>
                {/* THE SHARED CHIP: one component across this cell, the review
                    card's survey evidence and History's Result column, so a
                    score never reads two ways on one page. */}
                <ScoreChip
                  score={cadence.lastAssessment.score}
                  severity={cadence.lastAssessment.severity}
                />
                {/* TRAJECTORY, beside the reading. Renders only from three
                    assessments up — see the sparkline's note. */}
                {series && series.scores.length >= SPARKLINE_MIN_POINTS && (
                  <ScoreSparkline
                    scores={series.scores}
                    /* TODO-COPY */
                    label={`${series.instrument} scores over time: ${series.scores.join(", ")}`}
                  />
                )}
              </>
            ) : (
              <span className="text-[var(--text-muted)]">None yet</span>
            )}
          </Metric>

          <Metric
            label="Next review"
            /* The framing moved INSIDE the chip below, so the sub-line is gone
               and with it the coloured text it used to carry. */
            sub={
              cadence.nextReviewDue ? clinicalDate(cadence.nextReviewDue) : undefined
            }
          >
            {cadence.nextReviewDue && due ? (
              // A TONAL CHIP, not coloured text: neutral while a review is
              // merely upcoming, warning once it is inside the window or past
              // it. The framing rides inside the chip so the state and the
              // stage are one object rather than a colour plus a caption.
              <TonalChip tone={due.tone === "warning" ? "warning" : "neutral"}>
                {`${due.label} · ${STAGE_LABEL[cadence.stage]}`}
              </TonalChip>
            ) : (
              <span className="text-[var(--text-muted)]">
                {/* TODO-COPY. Two different reasons for no date, and they must
                    not share a sentence — a closed record has usually had
                    surveys, so "starts at the first survey" would contradict the
                    history further down the page. */}
                {cadence.reviewClock === "closed"
                  ? "Mentorship ended"
                  : "At first survey"}
              </span>
            )}
          </Metric>
        </div>
      </div>
    </section>
  );
}
