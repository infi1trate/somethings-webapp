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

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ChevronRight, RefreshCw } from "lucide-react";
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
  expanded = false,
  onCollapse,
  workspace,
  hasDraft = false,
  currentCode = null,
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
  /** ═══ THE CARD IS THE WORKSPACE WHEN IT IS OPEN ═══
   *  Owned by the page, not by the card: committing and the draft both live
   *  there, and a card that opened itself would be the only thing on the tab
   *  that knew whether a review was in progress. */
  expanded?: boolean;
  onCollapse?: () => void;
  /** Rendered inside the card when expanded — the decision, the three fields and
   *  the commit row. Passed as a node so the card stays a card and does not grow
   *  a dependency on the review's own commit path. */
  workspace?: React.ReactNode;
  /** A draft exists for this review, so the collapsed band says so. */
  hasDraft?: boolean;
  /** The code on record, so the band can say whether the proposal is a change.
   *  The card never decides anything with it — see the chip's note. */
  currentCode?: string | null;
}) {
  /** Lifted out of the old Disclosure component: the header must not own the
   *  body's open state, or it re-renders around it. */
  const [open, setOpen] = useState(false);

  /** ═══ COLLAPSING HANDS FOCUS BACK TO THE BAND ═══
   *  Closing the card unmounts nothing a keyboard reader was standing on, so
   *  without this focus falls to <body> and they are dropped at the top of a long
   *  clinical page — the same failure the DSM-5 dialog had to fix explicitly.
   *  Queried out of a wrapper rather than taken as a ref on `PillButton`, which
   *  does not declare one.
   *  Guarded on a PREVIOUS value so this only fires on a true → false
   *  transition: focusing on mount would steal the caret from whatever the reader
   *  was doing when the card first appeared. */
  const bandRef = useRef<HTMLSpanElement | null>(null);
  const wasExpanded = useRef(expanded);
  useEffect(() => {
    if (wasExpanded.current && !expanded) {
      bandRef.current?.querySelector("button")?.focus();
    }
    wasExpanded.current = expanded;
  }, [expanded]);
  // One flag for the whole acting half of the card.
  const canAct = !!onReviewRequest;
  /** Whether the PROPOSAL is a change. Nothing to do with the draft. */
  const proposesChange = currentCode !== review.recommended.code;

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

  /* THE PROPOSAL CHIP, built once and rendered beside the title below. It
   *  describes the PROPOSAL and never the draft — a supervisor who changes the
   *  code does not rewrite what was proposed. */
  const proposalChip = canAct ? (
    <>
            {/* ═══ THE PROPOSAL CHIP — WHAT THE MODEL SUGGESTED ═══
        It describes the PROPOSAL and never the draft. A supervisor who
        selects "change" against a renewal proposal does not rewrite what
        was proposed, so this chip does not move — the decision row owns
        draft state, and a band that tracked both would be two sources
        for one fact.
        LABEL AND ICON CARRY IT, not the tone (SC 1.4.1): the words
        differ, and a change gets the swap glyph. Attention band, not the
        risk ramp — a proposed code change is a thing to look at, not a
        danger.
        THE CODE TRUNCATES, THE WORDS DO NOT. `min-w-0` on the code span
        alone means a narrow band clips "F43.22" before it clips "Change
        proposed", and `title` carries the whole thing either way. */}
    {proposesChange ? (
      <span
        title={`Change proposed → ${review.recommended.code}`}
        className="flex min-w-0 shrink items-center gap-1 whitespace-nowrap rounded-full bg-[var(--band-amber-bg)] px-2 py-0.5 text-[12px] leading-[16px] text-[var(--band-amber-fg)]"
      >
        <ArrowLeftRight className="size-3 shrink-0" aria-hidden />
        {/* TODO-COPY */}
        Change proposed
        <span className="min-w-0 truncate tabular-nums">
          → {review.recommended.code}
        </span>
      </span>
    ) : (
      <span
        title="Renewal proposed"
        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--surface-s1)] px-2 py-0.5 text-[12px] leading-[16px] text-[var(--text-secondary)]"
      >
        <RefreshCw className="size-3 shrink-0" aria-hidden />
        {/* TODO-COPY */}
        Renewal proposed
      </span>
    )}
    </>
  ) : null;

  return (
    <TaskCard
      tone="routine"
      section="care-review-card"
      ariaLabel="Presentation review"
      /* ═══ R6: THE STATUS CHIP NAMES WHAT IS ON OFFER, NOT THE CLOCK ═══
          "Review due" described the timing; the band already carries the timing
          in the metadata row's Next review cell and in the Action-required
          region above it. "Recommended presentation" names the thing a supervisor
          is being asked to look at, which is what the Figma composition puts
          here. PLACEHOLDER pending copy verification. TODO-COPY. */
      type="Recommended presentation"
      meta={STAGE_LABEL[review.stage]}
      actions={
        canAct && (
          <span ref={bandRef} className="flex items-center gap-2">
            {/* ═══ THE DRAFT CHIP LIVES IN THE ACTIONS CLUSTER ═══
                The band's label side is `TaskLabel`, whose `qualifier` is typed
                as a string and which is SHARED with the flag cards on Overview —
                out of this brief's scope. Widening it for one consumer would
                have edited a component two surfaces away for a chip, so the
                indicator sits at the other end of the same band instead. Same
                row, same glance, nothing shared touched. TODO-COPY. */}
            {/* ═══ R7/D: PLAIN TEXT, NOT A CHIP ═══
                The band now carries one chip on the left ("Recommended
                presentation") and the proposal chip has moved to the title. A
                tinted pill for "Draft" beside a plain Review button made a
                private, reversible state look like a status the record holds.
                Secondary text says the same thing at the weight it deserves.
                SAME VISIBILITY RULE and same accessible name as the chip it
                replaces — it renders only when a draft exists. TODO-COPY. */}
            {hasDraft && !expanded && (
              <span className="shrink-0 text-[12px] leading-[16px] text-[var(--text-secondary)]">
                Draft
              </span>
            )}
            {expanded ? (
              /* ═══ CLOSE, NOT A GHOSTED REVIEW ═══
                 The mock ghosts the Review button while the card is open, which
                 leaves a dead control in the primary position saying nothing
                 about how to get out. Close is the same position, live, and it
                 names the way back — the draft is already written, so it costs
                 nothing. Flagged for design-lead veto. TODO-COPY. */
              <button
                type="button"
                onClick={() => onCollapse?.()}
                className={cn(
                  "h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[14px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                Close
              </button>
            ) : (
              /* ═══ ONE CTA, AND THE ELLIPSIS THAT HELD ONE THING IS GONE ═══
                 "Change presentation…" was the menu's only item, so removing
                 change from the card emptied it entirely. Both the menu and its
                 trigger were deleted rather than left with a remainder; there
                 was none. */
              <PillButton
                onClick={() => onReviewRequest?.()}
                className="h-9 whitespace-nowrap px-5 text-[14px]"
              >
                {/* TODO-COPY */}
                Review
              </PillButton>
            )}
          </span>
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
      {/* 1 · RECOMMENDATION. Code ABOVE, statement beneath — same move as the
          presentation card (R6/B1), and the same reason: below the statement the
          code competed with it for the eye at the moment the statement is the
          thing to read. Above, it is the identifier you check over the sentence
          you read. `font-mono` matches the presentation card's line so the two
          codes on this tab look like the same kind of object. */}
      <div>
        <p className="mb-1 font-mono text-[12px] leading-[16px] tabular-nums text-[var(--text-secondary)]">
          {review.recommended.code}
        </p>
        {/* ═══ R7/A: THE PROPOSAL CHIP SITS WITH THE TITLE ═══
            It was at the far right of the header band, a whole row away from the
            thing it describes — a reader had to hold "change proposed" in their
            head while crossing the card to find out change to what. Beside the
            title it is read in one movement.

            `flex-wrap` WITH THE TITLE ALLOWED TO TAKE THE WHOLE LINE: the title
            is `min-w-0`-free and the chip is `shrink-0`, so at a narrow container
            the chip drops to its own line, left-aligned, and the title is never
            truncated to make room for it. The title is the thing being reviewed;
            the chip is a note about it.

            `items-baseline` rather than `items-center`: centring a 16px chip on a
            26px line box floats it above the title's baseline. TODO-COPY. */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-[20px] font-normal leading-[26px] tracking-[-0.2px] text-[var(--text-primary)]">
            {review.recommended.statement}
          </p>
          {proposalChip}
        </div>
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
          {/* ═══ R6/C3: THE LABEL NAMES THE COUNT, AND THE SUB-LINE GOES ═══
              "Weighted across this period" and the row's own "recency-weighted
              across 3 surveys" were two statements of one fact, eight pixels
              apart. The count moves UP into the label — where it answers "across
              what?" at the moment the reader meets the number — and the sub-line
              below reverts to naming the instrument and date, which is what it
              says on a single-survey review and is the thing the aggregate row
              was otherwise not saying at all. PLACEHOLDER. TODO-COPY. */}
          {review.aggregate
            ? `Weighted across ${review.aggregate.surveys.length} surveys`
            : "Most recent survey"}
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
                  {/* NO LONGER REPEATS THE COUNT — see the label above. For an
                      aggregate this names the instrument and the span it covers,
                      which the count alone never said. TODO-COPY. */}
                  {review.aggregate
                    ? `${evidence.instrument} · ${clinicalDate(
                        review.aggregate.surveys[review.aggregate.surveys.length - 1].at
                      )} – ${clinicalDate(review.aggregate.surveys[0].at)}`
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

      {/* ═══ THE EXPANSION — A GRID ROW THAT GOES 0fr → 1fr ═══
          Height is not animatable from `auto`, and there is no motion library
          here, so the options were a measured `max-height` (a guess that clips
          the day the content grows) or this: a one-row grid whose track animates
          between zero and its content size. The browser interpolates the track,
          the child clips while it is closed, and nothing has to know how tall the
          form is.
          `overflow-hidden` is on the INNER wrapper, not the card — the Change
          selector is an inline list so it is safe, and the assessment dropdown is
          a Radix popover that portals out.
          300ms sits inside the 250–350ms the spec asks for; `motion-reduce`
          drops the transition so the height change lands on one frame. */}
      {workspace && (
        <div
          data-record-section="care-review-expansion"
          data-expanded={expanded}
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          {/* ═══ `inert` WHILE CLOSED ═══
              A 0fr grid row clips the form to no height but leaves every control
              in it focusable — measured: 8 tab stops inside a collapsed card,
              so a keyboard reader could Tab into a form they cannot see and type
              into a clinical field with no visible caret. `inert` takes the whole
              subtree out of the tab order and the accessibility tree without
              touching layout, so the height still animates. */}
          <div className="overflow-hidden" inert={!expanded}>
            <div className="mt-4 border-t border-[color:var(--border-subtle)] pt-4">
              {workspace}
            </div>
          </div>
        </div>
      )}

      {/* THE PROVIDER NOTE USED TO BE SECTION 4 AND IS GONE.
          The card is deliberately short now: recommendation, rationale with its
          provenance, survey evidence. Approve opens the care update form, and the
          required-field gating that lived here moved to that form's own fields.
          `DecisionNote` and `noteReady` are NOT deleted — the flag review modal
          still uses both, and that surface is out of scope. */}
    </TaskCard>
  );
}
