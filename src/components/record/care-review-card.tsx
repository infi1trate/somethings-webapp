"use client";

// PRESENTATION REVIEW CARD (Prompt B Phase 2) — ONE surface, sectioned by
// hairlines and vertical rhythm. Replaces the old action slot, which was a
// tinted box containing FIVE nested white panels: recommendation, rationale,
// survey, and a card per survey inside the aggregate disclosure.
// Containers inside containers, and the nesting was doing the sectioning that
// typography and a hairline do here.
//
// ROUTINE TONE ON THE SHARED LABEL BAND (task-card.tsx). The band carries NO
// fill for a review — a scheduled cadence review is ordinary work — while the
// escalation and risk-flag cards tint theirs. Same anatomy, different
// temperature, and the action sits in the same place on all three.
//
// SECTION ORDER: band ("Review due · 90-day review" + Approve top right) →
// recommendation + code → AI rationale (30/90-day only) → survey evidence,
// collapsed to one line. Hairlines between, no nested cards.
//
// SHORT ENOUGH THAT THE NOTE AND THE BUTTON SHARE A SCREEN. That was the point
// of moving Approve into the band: with the button at the top and the note as
// the last body section, a supervisor no longer scrolls past their own reasoning
// to reach the commit. The helper text stating the requirement rides under the
// button, so it is read before the reach rather than found after the click.
//
// PROVENANCE IS NEVER OPTIONAL. The rationale carries a label saying which kind
// it is, muted and small, ABOVE prose that reads as body text. Unattributed
// clinical prose on a minor's record is the thing this label exists to prevent.
//
// THE "mentorship signal" IN THE AI LABEL IS FORWARD-LOOKING BY DECISION. Nothing
// in this codebase computes a mentorship signal, and the AI summary's own
// provenance line was narrowed for exactly that reason. The user's call was to
// keep this label verbatim because the signal is coming — so this is a known,
// accepted overstatement, not an oversight. Do not "fix" it; see
// RATIONALE_SOURCE_LABEL.

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
// The dropdown-menu import is gone with the ellipsis it served — see the actions
// slot below for what that menu contained.
import { TaskCard } from "@/components/record/task-card";
// `decision-footer` is deliberately NOT imported any more. It still exists and
// the flag review modal still uses `DecisionNote` + `noteReady`; this card simply
// stopped being a consumer when the provider note was retired. Leaving the
// component alone is what keeps that out-of-scope surface from shifting.
import { clinicalDate } from "@/components/record/care-presentation";
import { bandLabel } from "@/components/record/score-chip";
import { SurveyComparisonGrid } from "@/components/record/survey-comparison-grid";
import { INSTRUMENT_MAX } from "@/lib/record/care-demo";
import {
  RATIONALE_SOURCE_LABEL,
  STAGE_LABEL,
  type AssessmentItem,
  type PresentationReview,
} from "@/lib/record/care-demo";
import { Provenance } from "@/components/record/provenance";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;
/** The hairline that does the sectioning a nested card used to do. */
const SECTION = "mt-4 border-t border-[var(--border-subtle)] pt-4";

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

/** `ItemTable` lived here — one survey, three columns, answer text in every
 *  cell. `SurveyComparisonGrid` replaced it: the question a supervisor is
 *  answering is comparative, and a table of one survey cannot answer it. */

export function PresentationReviewCard({
  review,
  actor,
  actorRole,
  onReviewRequest,
}: {
  review: PresentationReview;
  /** `currentCode` was here so approving could name what it replaced. The owner
   *  needs it for that now, not this card. */
  /** The deciding supervisor's name + tier — the appended entry's author. */
  actor: string;
  actorRole: string;
  /** ═══ ONE CALLBACK, AND IT DECIDES NOTHING ═══
   *
   *  This card used to carry two: `onApproveRequest`, which opened the care
   *  update form pre-loaded with "approve", and `onChangeRequest`, which opened
   *  the DSM-5 dialog from an ellipsis menu. That shape asserted the answer
   *  before the supervisor had judged — the recommendation sat under a one-click
   *  Approve while its peer outcome was two interactions away behind a glyph.
   *  On an append-only clinical record, a single tap is also the weakest error
   *  prevention available.
   *
   *  Both are replaced by one request to OPEN THE REVIEW. Confirm and change are
   *  peer outcomes of one decision, and that decision — with its commit — lives
   *  only in the drawer. Nothing on this card can approve anything.
   *
   *  Still the tier gate: read-wide, act-narrow. Mentors and lead mentors read
   *  the recommendation, the provenance-labelled rationale and the survey
   *  evidence, and simply are not handed the callback, so the action row does not
   *  render at all. There is no disabled Review. */
  onReviewRequest?: () => void;
}) {
  /** Lifted out of the old Disclosure component: the header must not own the
   *  body's open state, or it re-renders around it. */
  const [open, setOpen] = useState(false);
  // One flag for the whole acting half of the card.
  const canAct = !!onReviewRequest;

  /** ONE shape for both variants: the aggregate's weighted score reads in the
   *  same position as a single survey's, which is what makes the two variants
   *  legible as the same block rather than two designs. */
  const evidence = review.aggregate
    ? {
        score: review.aggregate.score,
        severity: review.aggregate.severity,
        instrument: review.aggregate.surveys[0]?.instrument ?? "",
        at: review.aggregate.surveys[0]?.at ?? 0,
        items: [] as AssessmentItem[],
      }
    : review.survey;

  /** THE DENOMINATOR, from the instrument definition — never a literal in the
   *  markup. A per-card constant is exactly how one surface ends up printing
   *  "/21" beside a PHQ-9 score, and a wrong denominator on a minor's record is
   *  worse than no denominator.
   *
   *  Falls back to the score itself when the instrument is unknown, so the pair
   *  still reads as a fraction rather than "9 / undefined". An unknown instrument
   *  is a data problem, and it should look like a full bar rather than a crash. */
  const maxScore =
    (evidence &&
      INSTRUMENT_MAX[evidence.instrument as keyof typeof INSTRUMENT_MAX]) ||
    evidence?.score ||
    0;

  // `outcome` used to be computed here, for the decision this card built. The
  // owner derives it now — see `outcomeFor` in `care-tab.tsx` — because the
  // decision is assembled where the care update's id is known.

  return (
    <TaskCard
      tone="routine"
      section="care-review-card"
      ariaLabel="Presentation review"
      /* TODO-COPY */
      type="Review due"
      meta={STAGE_LABEL[review.stage]}
      actions={
        canAct && (
          /* ═══ THE ELLIPSIS IS GONE, AND IT HELD EXACTLY ONE THING ═══
             "Change presentation…" was its only item, so removing change from
             the card emptied the menu entirely — a glyph opening a one-item menu
             is a control that costs an interaction to reveal nothing. Both the
             menu and its trigger are deleted rather than left with a remainder
             surfaced inline; there was no remainder.
             What survives is a single filled CTA that opens the review. It is
             the only affordance on this card, which is the point: the card is a
             statement of what needs review, and the workspace is elsewhere. */
          <PillButton
            onClick={() => onReviewRequest?.()}
            className="h-9 whitespace-nowrap px-5 text-[14px]"
          >
            {/* TODO-COPY */}
            Review
          </PillButton>
        )
      }
      /* PROVENANCE, same slot as the flag cards'. It answers a real question
         rather than restating the band: a supervisor looking at a recommendation
         needs to know whether the SCHEDULE surfaced it or a person proposed it —
         a cadence review and a colleague's proposal deserve different reading.
         TODO-COPY. */
      footer={
        review.rationale.source === "supervisor"
          ? `Proposed by ${actor} · ${actorRole}`
          : "Raised by the care cadence"
      }
    >
      {/* 1 · RECOMMENDATION. ~20px statement, code beneath. */}
      <div>
        <p className="text-[20px] font-normal leading-[26px] tracking-[-0.2px] text-[var(--text-primary)]">
          {review.recommended.statement}
        </p>
        <p className="mt-1 text-[13px] leading-[18px] tabular-nums text-[var(--text-secondary)]">
          {review.recommended.code}
        </p>
      </div>

      {/* 2 · RATIONALE — only where a human or a model actually wrote one.
          A `templated` rationale is the intake mapping restating the score it
          was just handed; it told a supervisor nothing the survey evidence
          below does not already show, while a provenance label gave it a
          clinician's authority. Intake reviews have none, by design. */}
      {review.rationale.source !== "templated" && (
        <div className={SECTION}>
          <p
            className="flex items-center gap-1.5 text-[var(--text-muted)]"
            style={LABEL_STYLE}
          >
            {/* ═══ THE AI CASE NOW CARRIES THE SHARED PROVENANCE MARK ═══
                The label used to read "AI-generated from survey history and
                mentorship signal" — a third wording of the same policy, on a
                third surface, differing from the summary's by which inputs it
                happened to name. The badge replaces the sentence and the popover
                carries the full note, so all three surfaces say one thing.
                THE OTHER TWO SOURCES KEEP THEIR LABELS, and that distinction is
                the point: "Selected by a supervisor" is a human attribution and
                must not wear an AI badge. Only the generated case does. */}
            {review.rationale.source === "ai" ? (
              <>
                {/* TODO-COPY. Names the block, where the badge names the origin. */}
                <span>Rationale</span>
                <Provenance />
              </>
            ) : (
              RATIONALE_SOURCE_LABEL[review.rationale.source]
            )}
          </p>
          <p className="mt-1.5 max-w-prose text-[14px] leading-[20px] text-[var(--text-primary)]">
            {review.rationale.text}
          </p>
        </div>
      )}

      {/* 3 · SURVEY EVIDENCE — header row and body are SIBLINGS.
          THE OLD STRUCTURE WAS THE BUG. The disclosure lived as the third child
          of a `flex items-center flex-wrap` row, and the expanded table rendered
          INSIDE it. Measured: expanding took the row 80px → 186px, which made
          `items-center` re-centre every sibling — the score dropped 53px into
          dead space — while the table's width forced a wrap that shifted the
          disclosure 106px left and 10px up. The control migrated because it was
          inside the thing that grew.
          Now the header is a fixed-height row that contains only the header, and
          the body is its sibling. Nothing in the header can move when the body
          appears, because the body is not in it. */}
      <div className={SECTION}>
        <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
          {/* TODO-COPY */}
          {review.aggregate ? "Weighted across this period" : "Most recent survey"}
        </p>

        {evidence && (
          <div className="mt-2 overflow-hidden rounded-[var(--radius-inset)] bg-[var(--surface-s1)]">
            {/* ══ THE HEADER IS THE DISCLOSURE ══════════════════════════════
                THE WHOLE ROW IS THE TARGET, not the caret. A 14px chevron is a
                ~14px hit area next to a 200px row that looks pressable and is
                not; readers aim at the number and nothing happens. It is a real
                <button> spanning the panel, so Enter and Space come free, focus
                is native, and the caret drops to what it should always have been
                — a state indicator with `aria-hidden`.

                FIXED HEIGHT, PIXEL-IDENTICAL IN BOTH STATES. 68px, holding two
                lines: the score lockup on one baseline, the provenance beneath.
                The expanded body is a SIBLING of this button, never a child, so
                nothing the body does can move anything in here. */}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className={cn(
                "flex h-[68px] w-full cursor-pointer items-center gap-x-3 px-3.5 text-left",
                "transition-colors hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-y-1">
                {/* LINE 1 — score, denominator, band. ONE BASELINE via
                    `items-baseline`, so the 24px numeral and the 14px
                    denominator sit on the same line rather than centring on
                    each other's boxes. */}
                <span className="flex items-baseline gap-x-2.5">
                  <span className="flex shrink-0 items-baseline gap-x-1">
                    <span className="text-[24px] font-normal leading-none tabular-nums text-[var(--text-primary)]">
                      {evidence.score}
                    </span>
                    {/* THE DENOMINATOR. A bare "9" has no scale — it could be
                        anything out of anything. The maximum comes from the
                        INSTRUMENT DEFINITION (INSTRUMENT_MAX), never a literal
                        here: a per-card constant is how one surface ends up
                        saying /21 for a PHQ-9. */}
                    <span className="text-[14px] leading-none tabular-nums text-[var(--text-muted)]">
                      / {maxScore}
                    </span>
                  </span>
                  <BandChip severity={evidence.severity} />
                </span>

                {/* LINE 2 — provenance, muted, beneath. For the aggregate this
                    is the qualifier that explains the number instead. */}
                <span className="min-w-0 truncate text-[13px] leading-[18px] text-[var(--text-muted)]">
                  {review.aggregate
                    ? /* TODO-COPY */ `recency-weighted across ${review.aggregate.surveys.length} surveys`
                    : `${evidence.instrument} · ${clinicalDate(evidence.at)}`}
                </span>
              </span>

              {/* PINNED, and now a LABEL rather than a control. Its own flex
                  child in a fixed-height row, so it cannot move. */}
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)]">
                {/* TODO-COPY. Was "Question by question" — this names the thing
                    the reader gets rather than describing the layout of it. */}
                Survey answers
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform",
                    open && "rotate-90"
                  )}
                  aria-hidden
                />
              </span>
            </button>

            {/* BODY — expanded only, beneath a hairline, full width, BELOW the
                header rather than beside the score. */}
            {open && (
              <div className="border-t border-[var(--border-subtle)] px-3.5 py-3">
                {/* ═══ THE SHARED GRID ═══
                    The same component the drawer's evidence strip renders, so a
                    supervisor who opens the answers here and then opens the
                    review is looking at one table rather than two layouts of one
                    dataset.
                    It replaces a stacked pair — a list of the contributing
                    surveys, then the newest survey's answers — which could show
                    what the period contained OR what one day contained, never
                    both at once. The claim being checked ("the movement sits in
                    these items") is a comparison, so the display is one. */}
                <SurveyComparisonGrid
                  surveys={
                    review.aggregate
                      ? review.aggregate.surveys
                      : review.survey
                        ? [review.survey]
                        : []
                  }
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
        )}
      </div>

      {/* THE PROVIDER NOTE USED TO BE SECTION 4 AND IS GONE.
          The card is deliberately short now: recommendation, rationale with its
          provenance, survey evidence. Approve opens the care update form, and the
          required-field gating that lived here moved to that form's own fields.
          `DecisionNote` and `noteReady` are NOT deleted — the flag review modal
          still uses both, and that surface is out of scope. */}
    </TaskCard>
  );
}
