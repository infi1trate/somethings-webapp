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
import { clinicalDate, Statement } from "@/components/record/care-presentation";
import { ScoreChip } from "@/components/record/score-chip";
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
      <p className="mt-1 truncate tabular-nums text-[15px] leading-[20px] text-[var(--text-primary)]">
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
        {/* A quiet text action, never a filled button. The page's one filled
            button is Approve inside the task region, and changing a minor's
            diagnosis should read as deliberate rather than inviting. */}
        {onChange && presentation ? (
          <button
            type="button"
            onClick={onChange}
            className={cn(
              "rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70",
              RING
            )}
          >
            {/* TODO-COPY */}
            Change
          </button>
        ) : onAssignSurvey ? (
          <button
            type="button"
            onClick={onAssignSurvey}
            className={cn(
              "rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2 transition-opacity hover:opacity-70",
              RING
            )}
          >
            {/* TODO-COPY */}
            Assign first survey
          </button>
        ) : null}
      </div>

      <div className={`mt-3 ${CARD}`}>
        {/* ── HERO: the presentation on record ─────────────────────────── */}
        {presentation ? (
          <>
            <Statement value={presentation} />
            <p className="mt-3 text-[13px] leading-[18px] text-[var(--text-muted)]">
              {/* TODO-COPY */}
              {`Assigned ${clinicalDate(presentation.assignedAt)} by ${presentation.assignedBy}${
                presentation.reviewedAt
                  ? ` · reviewed ${clinicalDate(presentation.reviewedAt)}`
                  : " · not yet reviewed"
              }`}
            </p>
          </>
        ) : (
          <p className="text-[15px] leading-[20px] text-[var(--text-muted)]">
            {/* TODO-COPY — an empty state, never an em dash. The cadence facts
                below still populate: a teen without a presentation still has a
                mentor, a tenure and a survey clock. */}
            Not yet assigned. A presentation is set once the first survey is
            reviewed.
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
              // THE SHARED CHIP (Prompt B Phase 2): one component across this
              // cell, the review card's survey evidence and History's Result
              // column, so a score never reads two ways on one page.
              <ScoreChip
                score={cadence.lastAssessment.score}
                severity={cadence.lastAssessment.severity}
              />
            ) : (
              <span className="text-[var(--text-muted)]">None yet</span>
            )}
          </Metric>

          <Metric
            label="Next review"
            tone={due?.tone === "warning" ? "warning" : "default"}
            sub={
              due ? `${due.label} · ${STAGE_LABEL[cadence.stage]}` : undefined
            }
          >
            {cadence.nextReviewDue ? (
              clinicalDate(cadence.nextReviewDue)
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
