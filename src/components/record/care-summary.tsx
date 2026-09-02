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
import { bandLabel } from "@/components/record/score-chip";
import { TonalChip } from "@/components/record/tonal-chip";
import { Provenance } from "@/components/record/provenance";
// `ScoreSparkline` is no longer imported here: trajectory belongs to the care
// summary rail, which renders the same series legibly instead of squeezing a
// 5-point copy of it beside a score chip.
import { RecordButton } from "@/components/record/record-button";
import { RecordAvatar } from "@/components/record/record-avatar";
import {
  currentMentorId,
  daysInMentorship,
  endedMatchDateFor,
  formatDaysInMentorship,
  type RelationshipSlice,
} from "@/lib/record/relationships";
import {
  defaultMenteeStatus,
  DEMO_PEOPLE,
  type DemoTeen,
} from "@/lib/record/people-demo";
import { LIVE_ID, recordHrefFor } from "@/lib/record/subject";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-4";
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
  label: React.ReactNode;
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
}) {
  // A DEACTIVATED TEEN'S PAIRING IS OVER even when no relationship event says
  // so: the fixture population carries `active: false` and nothing else, so
  // `currentMentorId` happily keeps returning the mentor they last pointed at.
  // Treating the mentee's own standing as the end of the pairing is what makes
  // the Mentor cell tell the truth on a closed record.
  const closed = defaultMenteeStatus(teen) === "deactivated";
  const liveMentorId = currentMentorId(teen, relationships);
  const mentorId = closed ? null : liveMentorId;
  const fixtureMentor =
    mentorId && mentorId !== LIVE_ID
      ? DEMO_PEOPLE.find((p) => p.id === mentorId)
      : undefined;
  const mentorName =
    mentorId === LIVE_ID
      ? (liveMentorName ?? "Jordan Rivera")
      : (fixtureMentor?.goesBy ?? fixtureMentor?.name);
  // THE ENDED DATE IS OFTEN UNAVAILABLE, and the copy has to survive that.
  // A match ended in session carries a real `endedAt`; the fixture-deactivated
  // teens — which are exactly the population showing a closed review clock —
  // carry only `active: false` and no end date at all. So the month is appended
  // only when it exists, and the sentence still reads without it. Reported.
  const endedAt = endedMatchDateFor(teen, relationships);
  const endedLabel = endedAt
    ? /* TODO-COPY */ `ended ${new Date(endedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : /* TODO-COPY */ "no end date on file";

  const due = cadence.nextReviewDue
    ? reviewDueState(cadence.nextReviewDue, now)
    : null;

  return (
    <section aria-label="Primary presentation" data-record-section="care-summary" data-anno-ref="care-summary-panel">
      {/* ═══ THE CARD IS A CONTAINER, SO ITS CONTENTS CAN ASK ITS WIDTH ═══
          The metrics row below keyed off the VIEWPORT (`sm:` / `xl:`), which was
          right up to the day something else started taking width off this
          column. Open the review drawer at 1280–1440 and the viewport still says
          "xl" while the column has lost 520px to the panel — five stats at
          ~127px each, wrapping mid-word. A container query asks the only
          question that was ever relevant: how wide is THIS box. */}
      <div className={cn(CARD, "@container")}>
        {/* ── THE LOCKUP, INSIDE THE CARD. The section label used to float above
            the card as an h2 with the Change button beside it, so the card's
            most important line had a heading it did not own and an action
            anchored to nothing. Both come inside: a small muted eyebrow named
            "Primary presentation" — more informative than "Care summary", which
            described the container rather than the content — and the button on
            the same row, aligned to it. ──────────────────────────────────── */}
        <div className="flex min-h-9 flex-wrap items-start justify-between gap-3">
          <h2 className="text-[var(--text-muted)]" style={LABEL_STYLE}>
            {/* TODO-COPY */}
            Primary presentation
          </h2>
          {/* EDITORIAL CTA — secondary outline in the section header, never
              filled: the filled button in this region belongs to a task. */}
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

        {/* ── HERO: the presentation on record ─────────────────────────── */}
        <div className="mt-2.5">
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
                as a subtitle.

                TIGHT TO THE STATEMENT — and tight to its LAST LINE, which is
                why this is a sibling in normal flow rather than anything
                absolutely positioned: a wrapping statement pushes the chip down
                with it. The box gap is 4px, not 8: the statement's 30px/1.15
                line box carries ~2.25px of half-leading below the descender, so
                6px of margin lands the OPTICAL gap at 8.25px. Measured on a
                two-line statement, not assumed. */}
            <div className="mt-1.5">
              <TonalChip mono className="text-[var(--text-secondary)]">
                {presentation.code}
              </TonalChip>
            </div>
            {/* THEN A LARGER BREAK. Statement→chip was 10px and chip→provenance
                was also 10px, so all three read as equally weighted lines. 18px
                here against 4px above makes the first two a lockup and the
                provenance a subordinate note. */}
            <p
              className="mt-[18px] text-[var(--text-muted)]"
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

        </div>

        {/* ── METRICS: a hairline and a grid, NOT a nested card ─────────── */}
        <div
          /* ═══ FOUR ACROSS, OR TWO BY TWO — NOTHING IN BETWEEN ═══
             REPLACES the R2 rule (`grid-cols-2 / @[480px]:3 / @[760px]:5`)
             rather than layering on it: that one existed to keep five equal
             columns from crushing each other, and five equal columns are what
             this change removes.

             THE MENTOR TRACK IS PROTECTED, the other three flex. `max-content`
             as its floor is what makes "names never truncate" structural rather
             than a promise — the track cannot shrink below the name it holds, so
             there is nothing for an ellipsis to do.

             760px for four, MEASURED against the worst case rather than the
             fixtures: a 24-character name is 200px of text plus 28px of avatar
             and gap, and 760 − 72px of gaps leaves exactly enough beside it for
             the other three. The narrowest this card ever gets is 558px (main
             column at its floor, 1100px viewport), which is comfortably 2×2 —
             267px a cell, where a 228px mentor cell fits with room. */
          className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--border-subtle)] pt-4 @[760px]:grid-cols-[minmax(max-content,1.2fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,1.1fr)]"
        >
          {/* TODO-COPY on every label. */}
          {/* RELATIONSHIP STATE BELONGS TO THE PAIRING, not to the review
              cadence — which is why "Mentorship ended" moved out of Next review
              and into here. A 20px avatar sits beside the name so the metrics row
              carries a face rather than only a string. */}
          <Metric
            label="Mentor"
            sub={!mentorId && endedLabel ? endedLabel : undefined}
          >
            {mentorId && mentorName ? (
              <>
                <RecordAvatar name={mentorName} size={20} />
                <Link
                  href={recordHrefFor(mentorId)}
                  /* NO `truncate`, and no `min-w-0` to shrink under. The cell's
                     own track is floored at `max-content`, so the name always
                     has its width — clipping a person's name to fit a column is
                     the failure this row had, and an ellipsis on it was the
                     mechanism. */
                  className={cn(
                    "whitespace-nowrap rounded-sm underline decoration-[var(--border-contour)] underline-offset-2 transition-opacity hover:opacity-70",
                    RING
                  )}
                >
                  {mentorName}
                </Link>
              </>
            ) : (
              // TODO-COPY. A real state, not missing data.
              <span className="text-[var(--text-muted)]">No current mentor</span>
            )}
          </Metric>

          <Metric label="Days in mentorship">
            {formatDaysInMentorship(daysInMentorship(teen))}
          </Metric>

          {/* ═══ ONE ASSESSMENT CELL, FROM TWO ═══
              "Assigned survey" and "Last assessment" were two cells restating
              one fact from two angles — the instrument appeared in both, and a
              reader comparing them had to notice they agreed. Merged: the
              instrument, the score and the band on one line, when it was taken
              underneath.
              THE LOCK DATE MOVED TO THE ⓘ. It answers "why this instrument and
              not another", which is a question about the record's history rather
              than about the current reading, and it was costing a whole line of
              a four-line cell to say so.
              THE SPARKLINE IS GONE from this row. Trajectory is the care summary
              rail's job — it renders the same series at a size you can actually
              read, with its own sentence — and a 5-point sparkline squeezed
              beside a score chip was the smallest, least legible copy of it. */}
          <Metric
            label={
              /* ═══ THE LABEL BOX STAYS 16px ═══
                 `Provenance`'s trigger is a 20px circle, and a 20px child in a
                 16px label line pushed this cell's value 4px below the other
                 three — measured, and visible as soon as you look along the row.
                 A fixed 16px height lets the icon overflow its box by 2px either
                 side without moving anything; nothing clips, because nothing here
                 hides overflow. */
              <span className="flex h-4 items-center gap-1.5">
                {/* TODO-COPY */}
                Assessment
                {cadence.surveyLockedAt && cadence.assignedSurvey && (
                  /* The record's one focus-triggerable info affordance — hover,
                     focus AND click, Escape to dismiss, hoverable panel. Reused
                     rather than reinvented; see `provenance.tsx`. TODO-COPY. */
                  <Provenance
                    label="Survey"
                    /* TODO-COPY */
                    triggerLabel="About the assigned survey"
                    note={`${cadence.assignedSurvey} assigned and locked ${clinicalDate(cadence.surveyLockedAt)}.`}
                  />
                )}
              </span>
            }
            sub={
              cadence.lastAssessment
                ? /* TODO-COPY */ `Last taken ${clinicalDate(cadence.lastAssessment.at)}`
                : cadence.outstandingSurvey
                  ? /* TODO-COPY */ `Sent ${clinicalDate(cadence.outstandingSurvey.sentAt)} · not returned yet`
                  : undefined
            }
          >
            {cadence.lastAssessment ? (
              <>
                <span className="tabular-nums">
                  {cadence.lastAssessment.instrument} ·{" "}
                  {cadence.lastAssessment.score}
                </span>
                {/* THE SHARED CHIP: one component across this cell, the review
                    card's survey evidence and History's Result column, so a
                    score never reads two ways on one page. Band only here — the
                    number is already on the line beside it. */}
                <TonalChip>{bandLabel(cadence.lastAssessment.severity)}</TonalChip>
              </>
            ) : cadence.assignedSurvey || cadence.outstandingSurvey ? (
              <span className="text-[var(--text-muted)]">
                {cadence.assignedSurvey ?? cadence.outstandingSurvey?.instrument}
              </span>
            ) : (
              // TODO-COPY. A real state, not missing data.
              <span className="text-[var(--text-muted)]">Not yet assigned</span>
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
                  ? "Not scheduled"
                  : "At first survey"}
              </span>
            )}
          </Metric>
        </div>
      </div>
    </section>
  );
}
