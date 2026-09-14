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

import { useEffect, useRef } from "react";
import { PillButton } from "@/components/settings/pill-button";
// The dropdown-menu import is gone with the ellipsis it served — see the actions
// slot below for what that menu contained.
import type { ReviewDecision } from "@/lib/record/review-draft";
import { ReviewBody } from "@/components/record/review-body";
import { TaskCard } from "@/components/record/task-card";
// `decision-footer` is deliberately NOT imported any more. It still exists and
// the flag review modal still uses `DecisionNote` + `noteReady`; this card simply
// stopped being a consumer when the provider note was retired. Leaving the
// component alone is what keeps that out-of-scope surface from shifting.
import type { PresentationReview } from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
/* `LABEL_STYLE`, `STAT_VALUE`, `SECTION` and `BandChip` LEFT WITH THE BLOCKS.
   Every one of them was read only by the recommendation, rationale and evidence
   JSX, which is `review-body.tsx` now. Deleted rather than kept "in case" — a
   constant nothing reads is a constant the next person has to check. */

export function PresentationReviewCard({
  review,
  onReviewRequest,
  expanded = false,
  onCollapse,
  workspace,
  hasDraft = false,
  currentCode = null,
  currentStatement = null,
  decision = null,
  onDecisionChange,
}: {
  review: PresentationReview;
  /** `currentCode` was here so approving could name what it replaced. The owner
   *  needs it for that now, not this card. */
  /* `actor` / `actorRole` are GONE. Their only reader was the provenance
     footer — "Proposed by {actor} · {actorRole}" — and that footer is removed,
     so the card was taking the deciding supervisor's name and tier in order to
     render nothing with them. The commit still records both; it reads them from
     the store, not from this card's props. */
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
  /** The statement for `currentCode`, so the delta bar can name what is being
   *  replaced rather than showing a bare code. */
  currentStatement?: string | null;
  /** ═══ THE PENDING CHANGE ═══
   *  Owned by `care-tab`. The title block is where it is SET (the picker) and
   *  where it is SHOWN (the delta bar); the workspace reads the same value for
   *  its CTA and its commit. `null` is unchanged. */
  decision?: ReviewDecision | null;
  onDecisionChange?: (next: ReviewDecision | null) => void;
}) {
  /* THE GRID'S DISCLOSURE STATE MOVED with the grid. */

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
  /* THE PICKER'S STATE WENT WITH THE PICKER — `pickerOpen`, `query`,
     `changeRef`, `pickerInputRef` and `closePicker` are all `ReviewBody`'s now.
     `bandRef` above stays: it belongs to the band, which stays. */
  const wasExpanded = useRef(expanded);
  useEffect(() => {
    if (wasExpanded.current && !expanded) {
      bandRef.current?.querySelector("button")?.focus();
    }
    wasExpanded.current = expanded;
  }, [expanded]);
  // One flag for the whole acting half of the card.
  const canAct = !!onReviewRequest;
  return (
    <TaskCard
      tone="routine"
      section="care-review-card"
      ariaLabel="Presentation review"
      /* ═══ THE LOZENGE NAMES THE CARD, NOT ITS CONTENT ═══
          It read "Recommended presentation", which is what the BODY's first
          label now says — and a card whose band and whose first line say the
          same four words spends its most prominent slot on a repeat. The band
          names the task ("Presentation review"); the body names the thing.
          TODO-COPY. */
      type="Presentation review"
      /* NO QUALIFIER. "90-day review" is stated by the cadence row in the
         metadata strip above this region and by Next review beside it; a third
         copy in the band was the clock told three times. */
      elevated
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
      /* ═══ NO PROVENANCE FOOTER ═══
          It read "Raised by the care cadence" / "Proposed by {actor}" under a
          closing hairline. The distinction it drew is real, but it was the
          card's LAST line — the least-read position — restating something the
          Rationale block states with more authority two inches above: that
          block's own label already says whether a person, a model or the intake
          mapping produced this. One statement of provenance, in the place a
          reader is already looking. */
    >
      {/* ═══ THE BODY IS A COMPONENT NOW ═══
          These four blocks — the recommendation's label and title line, the
          rationale, the weighted strip and its grid, and the picker dialog —
          were inline here, inside `TaskCard`. That made them unreachable by the
          Tasks billing pane, which commits the same code onto the same record
          and had to reimplement or go without; it went without.

          WHAT THIS CARD KEPT is the attention layer: the band and its tone, the
          Review / Close control, the `Draft` indicator, the expansion motion and
          the collapse-focus effect. None of that is about a presentation review.

          `interactive={expanded}` IS THE ONE RENAME. It gates the `Change code`
          button, the picker, and the resolution of `pending` — all three read
          `expanded` before the move and all three read this now, so nothing on
          this surface changes. `review-body-parity.mjs` proves that against
          seventeen DOM snapshots taken before the extraction. */}
      <ReviewBody
        review={review}
        currentCode={currentCode}
        currentStatement={currentStatement}
        decision={decision}
        onDecisionChange={onDecisionChange}
        canAct={canAct}
        interactive={expanded}
      />

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
          {/* `px-1 -mx-1` — THE SAME RING ROOM AS THE COMPOSE MODAL. This
              `overflow-hidden` is load-bearing: it is what clips the form while
              the grid row is at 0fr, so it cannot simply go. Padding moves the
              clip edge out, the negative margin puts the box back, and the
              focused textarea inside keeps its whole ring.
              THE NUMBER IS NOT ARBITRARY: for a `w-full` child, SLACK = PADDING
              MINUS THE RING'S REACH, and the ring reaches 4px. `px-1` gave
              exactly 0 — flush with the clip edge and one antialiased pixel
              from clipping again — so it is 6px, for 2px of slack. */}
          <div className="-mx-1.5 overflow-hidden px-1.5" inert={!expanded}>
            {/* NO RULE HERE. This drew one hairline and the Documentation
                section below drew a second, four lines apart with nothing
                between them — the gap the decision row used to fill. The strip
                above is a FILLED panel, which already separates itself from what
                follows; a rule immediately under it was drawing a boundary that
                the surface change had already drawn. */}
            <div className="mt-6">
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
