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
import { ArrowLeftRight, FilePlus, Pencil, RefreshCw } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
// The dropdown-menu import is gone with the ellipsis it served — see the actions
// slot below for what that menu contained.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Dsm5SearchList } from "@/components/record/dsm5-search";
import { PresentationDiff } from "@/components/record/presentation-diff";
import { WeightedScoreModule } from "@/components/record/weighted-score-module";
import type { Dsm5Entry } from "@/lib/record/dsm5";
import type { ReviewDecision } from "@/lib/record/review-draft";
import { TaskCard } from "@/components/record/task-card";
// `decision-footer` is deliberately NOT imported any more. It still exists and
// the flag review modal still uses `DecisionNote` + `noteReady`; this card simply
// stopped being a consumer when the provider note was retired. Leaving the
// component alone is what keeps that out-of-scope surface from shifting.
import {
  RATIONALE_SOURCE_LABEL,
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

/* `STAT_VALUE` AND `BandChip` LEFT WITH THE STRIP. Both were only ever read by
   the weighted-score block, which is now `weighted-score-module.tsx`; the brief
   exported them from here for the rail to import and that export is gone with
   the reason for it — the rail renders the module, not its pieces. */
const SECTION = "mt-4 border-t border-[var(--border-subtle)] pt-4";

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
  /* THE DISCLOSURE STATE WENT WITH THE STRIP. It was lifted out of an old
     Disclosure component so the header could not own the body's open state; the
     module owns both now, which is the same fix at one level down. */

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
  /** The picker's open state and its search query — moved here with the button
   *  and the dialog. `changeRef` is the picker's focus-return target AND the
   *  landing spot after Remove, so it is one ref for one control. */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const changeRef = useRef<HTMLButtonElement | null>(null);
  const pickerInputRef = useRef<HTMLInputElement | null>(null);

  /** ═══ ONE CLOSE PATH, BECAUSE FOCUS HAS TO COME BACK FROM ALL OF THEM ═══
   *
   *  `onOpenChange` fires only when the PRIMITIVE closes itself — Esc, the
   *  overlay, the close control. Picking a row closes it from our own code, so a
   *  focus-return hung on `onOpenChange` was measured never running on the one
   *  path a supervisor actually takes: focus stayed on the search field of a
   *  dialog that was no longer on screen.
   *
   *  The return is done by hand rather than by `onCloseAutoFocus` because every
   *  dialog in this app stays mounted at `data-state="closed"` — Radix waits on
   *  an `animate-out` that never reports finishing. Escaping the care summary's
   *  own "Change Presentation" dialog parks the keyboard in exactly the same
   *  way, so the defect is app-wide and lives in the shared `ui/dialog` that
   *  every surface here uses; fixing it THERE is outside this brief.
   *
   *  A TIMER RATHER THAN THE TWO-FRAME IDIOM used elsewhere in this file's
   *  neighbourhood. Radix does its focus work in effects and microtasks, not on
   *  frames, so a macrotask is both the smaller wait and the correct one — and
   *  it still runs when the document is hidden, which `requestAnimationFrame`
   *  does not. Someone who opens the picker and switches tabs still gets the
   *  keyboard back on the control they left. */
  const closePicker = () => {
    setPickerOpen(false);
    setTimeout(() => changeRef.current?.focus(), 0);
  };
  const wasExpanded = useRef(expanded);
  useEffect(() => {
    if (wasExpanded.current && !expanded) {
      bandRef.current?.querySelector("button")?.focus();
    }
    wasExpanded.current = expanded;
  }, [expanded]);
  // One flag for the whole acting half of the card.
  const canAct = !!onReviewRequest;
  /** ═══ WHAT KIND OF PROPOSAL THIS IS — THREE STATES, NOT TWO ═══
   *
   *  It was a boolean, `currentCode !== review.recommended.code`, and a record
   *  with NOTHING on record satisfies it: `null !== "F43.22"` is true, so t9's
   *  first-ever review wore "Change proposed → F43.22" beside a header already
   *  reading F43.22 — a change from nothing to something, with the same code on
   *  both sides of the arrow.
   *
   *  The codebase already models three outcomes here: `outcomeFor` in
   *  `care-tab.tsx` returns `presentation_assigned` on exactly this
   *  `currentCode === null` branch, before it ever compares the two codes. The
   *  chip was the one place that collapsed them to two. */
  const proposalKind: "assign" | "change" | "renewal" =
    currentCode === null
      ? "assign"
      : currentCode === review.recommended.code
        ? "renewal"
        : "change";

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


  // `outcome` used to be computed here, for the decision this card built. The
  // owner derives it now — see `outcomeFor` in `care-tab.tsx` — because the
  // decision is assembled where the care update's id is known.

  /** ═══ THE PENDING CHANGE, RESOLVED ONCE ═══
   *  `null` unless a supervisor has picked something in the picker. Everything
   *  that reflects it below — the code line, the title, the revert link — reads
   *  this one value, so the header cannot show one presentation while the
   *  control beside it offers to revert to another. */
  const pending =
    expanded && decision?.kind === "change" && decision.code ? decision : null;


  /* THE CHIP SLOT — the proposal chip, or the way back out of a change. */
  const proposalChip = canAct ? (
    <>
    {/* ═══ THE PROPOSAL CHIP — WHAT KIND OF PROPOSAL THIS IS ═══
        THREE KINDS, and which one is on screen is the only thing this slot
        says: a first assignment, a renewal of the code on record, or a change
        away from it. It describes the PROPOSAL, never the draft — until a
        supervisor picks something, at which point the slot hands over entirely
        to the revert link above, because "Renewal proposed" is false the moment
        a different code is chosen.

        LABEL AND ICON CARRY IT, not the tone (SC 1.4.1): the words differ and
        each kind gets its own glyph. Only a CHANGE takes the attention band —
        an assignment and a renewal are the expected course of a record, and
        `EVENT_TONE` says the same where the timeline renders their committed
        forms. Attention, not the risk ramp: a proposed code change is a thing
        to look at, not a danger.

        THE CODE TRUNCATES, THE WORDS DO NOT. `min-w-0` on the code span alone
        means a narrow band clips "F43.22" before it clips "Change proposed",
        and `title` carries the whole thing either way. */}
    {pending ? (
      /* ═══ REVERT REPLACES THE PROPOSAL CHIP ═══
         "Renewal proposed" stops being true the moment a supervisor picks a
         different code — nothing is being renewed any more — so the chip's slot
         carries the way back instead of a label that has gone stale.
         IT NAMES ITS DESTINATION. "Revert" alone would ask someone to remember
         what the header said before they changed it; naming the presentation and
         its code means the link states exactly what pressing it restores, which
         is the same thing the header will read afterwards.
         A LINK, NOT A BUTTON PAIR. Re-picking is what "Change code" already
         does, so the old bar's Edit was a second door to one room. */
      <button
        type="button"
        onClick={() => {
          onDecisionChange?.(null);
          // Focus goes to the control that survives this render, not to the
          // link that is about to unmount.
          setTimeout(() => changeRef.current?.focus(), 0);
        }}
        className={cn(
          /* `-my-1 py-1` BUYS THE TARGET HEIGHT WITHOUT MOVING ANYTHING.
             A 12.5px link is a 16px box, and this is now the only way back from
             a change — too small to be the one control that undoes something.
             The padding takes it to 24px for SC 2.5.8 while the negative margin
             hands the row back the four pixels, so the baseline it shares with
             the title is exactly where it was. */
          "-my-1 min-w-0 rounded-sm py-1 text-left text-[12.5px] leading-[16px] text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)]",
          RING
        )}
      >
        {/* TODO-COPY — PLACEHOLDER. */}
        Revert back to {review.recommended.statement} (
        <span className="tabular-nums">{review.recommended.code}</span>)
      </button>
    ) : proposalKind === "assign" ? (
      /* ═══ NOTHING IS ON RECORD, SO NOTHING IS BEING CHANGED ═══
         The first presentation a record ever gets. NEUTRAL, not the attention
         band: `EVENT_TONE.presentation_assigned` is already "neutral" where the
         timeline renders the committed version of this same event, and a first
         assignment is the expected course of a new record rather than something
         to look twice at.
         "PROPOSED", NOT "ASSIGNED", which is the timeline's word. Nothing has
         been assigned yet — this card is the proposal, and the parallel with
         the other two chips is what says so. NO ARROW AND NO CODE: there is no
         second code to point at, and the header states the one there is. */
      <span
        title="Presentation proposed"
        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--surface-s1)] px-2 py-0.5 text-[12px] leading-[16px] text-[var(--text-secondary)]"
      >
        <FilePlus className="size-3 shrink-0" aria-hidden />
        {/* TODO-COPY — PLACEHOLDER. */}
        Presentation proposed
      </span>
    ) : proposalKind === "change" ? (
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
      {/* ═══ 1 · THE PROPOSAL, AS A DIFF ═══
          IT WAS AN IMPLICIT CURRENT-CODE PRESENTATION: one code chip beside one
          statement, showing whatever is now proposed — and the code ON RECORD,
          the thing the proposal is a proposal to change, appeared nowhere in the
          region making it. A reader had to carry it down from the metadata strip
          above. The Tasks billing pane drew the comparison properly, so its
          version is the shared one and this is where it graduates to.

          THE CHIP SLOT STILL CARRIES THE WAY BACK. Once a supervisor picks a
          different code, "Renewal proposed" is false — nothing is being renewed
          any more — so the slot hands over to a revert link that names its
          destination. Passing it in rather than teaching the diff about drafts:
          the diff knows which of the three kinds it is drawing, and nothing
          about whose decision is pending.

          `Change code` RIDES IN THE `action` SLOT, expanded-only. A collapsed
          card keeps Review as its one action; offering a code change from a card
          nobody has opened would be acting before reading. */}
      <PresentationDiff
        current={
          currentCode
            ? { code: currentCode, statement: currentStatement ?? "" }
            : null
        }
        recommended={review.recommended}
        pending={pending}
        chip={proposalChip}
        action={
          expanded && canAct && onDecisionChange ? (
            <button
              type="button"
              ref={changeRef}
              /* OPENING THE PICKER DECIDES NOTHING. Seeding a
                 `{kind:"change", code:""}` here to "start" a change would make a
                 cancelled look into a pending change with no code — enough to
                 dirty the draft and to feed an empty string to the workspace's
                 `outcomeCode`. The decision is made by picking a row. */
              onClick={() => setPickerOpen(true)}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full",
                "border border-[color:var(--border-contour)] px-3 py-1.5",
                "text-[13px] font-semibold leading-[18px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              <Pencil className="size-3.5 shrink-0" aria-hidden />
              {/* TODO-COPY — PLACEHOLDER. */}
              Change code
            </button>
          ) : null
        }
      />


      {/* ═══ THE PICKER ═══
          Moved here with the button that opens it. Built from `Dsm5SearchList`
          inside a plain Bloom dialog rather than reusing `Dsm5SearchDialog`: that
          component carries a two-step confirm this flow does not want, and it is
          SHARED with the Tasks billing picker, so changing its steps would change
          a surface outside this brief. The list is the shared part; the chrome is
          not. */}
      {expanded && canAct && onDecisionChange && (
        <Dialog
          open={pickerOpen}
          /* ═══ FOCUS IS PUT BACK BY HAND, NOT LEFT TO THE PRIMITIVE ═══
             MEASURED, and it is not this picker's doing: every dialog in this
             app stays mounted at `data-state="closed"` — Radix waits on an
             `animate-out` that never reports finishing — and focus stays parked
             inside the invisible panel. Escaping the care summary's own "Change
             Presentation" dialog leaves the keyboard in exactly the same place,
             so the defect is app-wide and lives in the shared `ui/dialog`, which
             every surface in the product uses.
             Fixing it THERE is out of this brief's scope, so the return is done
             here instead. Two frames, the idiom this codebase already uses when
             it has to land after someone else's layout work: the first yields to
             Radix's own restoration, the second wins. */
          onOpenChange={(next) => (next ? setPickerOpen(true) : closePicker())}
        >
          <DialogContent
            className="sm:max-w-lg"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              pickerInputRef.current?.focus();
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              // Focus returns to the control that opened it, not to <body>.
              changeRef.current?.focus();
            }}
          >
            <DialogHeader>
              {/* TODO-COPY */}
              <DialogTitle>Find a presentation</DialogTitle>
              <DialogDescription>
                Search by code or by wording. Nothing is saved until you submit
                the review.
              </DialogDescription>
            </DialogHeader>
            <Dsm5SearchList
              current={
                currentCode
                  ? {
                      code: currentCode,
                      statement: currentStatement ?? review.recommended.statement,
                    }
                  : null
              }
              query={query}
              onQueryChange={setQuery}
              inputRef={pickerInputRef}
              onPick={(e: Dsm5Entry) => {
                /* PICKING THE CODE ON RECORD IS NOT A CHANGE. The list marks one
                   row "On record"; choosing it resolves to the unchanged state
                   rather than producing a delta bar reading "F41.1 → F41.1". */
                if (currentCode && e.code === currentCode) {
                  onDecisionChange(null);
                } else {
                  onDecisionChange({
                    kind: "change",
                    code: e.code,
                    statement: e.statement,
                  });
                }
                // NO CONFIRM STEP. The review's own commit is that step.
                // Closed through the SAME path Esc and the overlay take, so
                // picking a code returns the keyboard where dismissing does.
                closePicker();
              }}
              listClassName="max-h-72"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* 2 · RATIONALE — ON EVERY RECOMMENDATION, WITHOUT EXCEPTION.
          It was gated on `source !== "templated"`, on the argument that a
          templated rationale is the intake mapping restating a score the survey
          evidence below already shows. That gate is removed: it left the 30-day
          review — the FIRST thing a supervisor ever decides on a record — as the
          one card in the tab that recommends a code and says nothing about why,
          jumping from the title straight to the strip.

          And the argument was not quite right. The mapping rationale states
          something the evidence block cannot: that a score in a given band is
          what RETURNS this particular code. The strip shows 9 / 21 · Mild; only
          the rationale says which presentation that maps to and on what basis.

          THE PROVENANCE LABEL IS WHAT KEEPS IT HONEST, and it is why showing it
          costs nothing: "Templated from intake mapping" claims exactly as much
          authority as it has, sitting in the same slot where a human rationale
          reads "Selected by a supervisor" and a generated one wears the shared
          AI badge. A reader is told which of the three they are looking at
          before they read a word of it. */}
      <div className={SECTION}>
        <p
          className="flex items-center gap-1.5 text-[var(--text-muted)]"
          style={LABEL_STYLE}
        >
          {/* ═══ THE LABEL NAMES THE BLOCK; THE MARK CARRIES THE PROVENANCE ═══
              Two of the three sources used to spell their provenance INTO the
              label — "Templated from intake mapping", "Selected by a supervisor"
              — so the block was named three different things depending on where
              its text came from, and none of those names was "Rationale". A
              reader scanning the card for the reasoning had no fixed word to
              scan for.
              So the label is always "Rationale", and the provenance moves to
              its right: the AI mark for a generated one, and a quiet suffix for
              the other two.

              ═══ AND THE MARK IS NOT PUT ON HUMAN TEXT ═══
              The design file draws an info mark here in every state, but it only
              ever draws the generated state. `Provenance` labels its panel "AI"
              unconditionally and — by an explicit decision recorded in that file
              — has no prop to suppress it, because a generated block must not be
              able to render without the tag. Hanging it off "Selected by a
              supervisor" would therefore stamp AI on a person's own words. So
              the mark stays on the generated case and the other two say plainly
              where they came from. */}
          <span>Rationale</span>
          {review.rationale.source === "ai" ? (
            <Provenance />
          ) : (
            <span className="min-w-0 truncate">
              <span aria-hidden className="opacity-50">
                ·
              </span>{" "}
              {RATIONALE_SOURCE_LABEL[review.rationale.source]}
            </span>
          )}
        </p>
        <p className="mt-1.5 max-w-prose text-[16px] leading-[24px] text-[var(--text-primary)]">
          {review.rationale.text}
        </p>
      </div>

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
      {/* ONE HAIRLINE IN THE BODY, AND IT IS THE ONE ABOVE RATIONALE. This
          block had a second, which made the card read as three stacked panels
          of equal weight. The rule above Rationale earns its place — it closes
          the recommendation, which is the card's claim — and from there down the
          spacing does the sectioning, with the strip's own filled panel marking
          where the evidence starts. */}
      <div className="mt-4">
        {/* ═══ THE EYEBROW IS BACK, AND IT SAYS WHAT THE DATA CANNOT ═══
            It was removed as a heading that restated the strip's own labels. It
            returns saying the one thing no cell in the strip can: that the score
            beside them is WEIGHTED, and across how many. "Weighted score" in the
            strip names the value; only this says what the weighting spans.
            NO MARK ON IT, unlike the design file's drawing. The mark this card
            has is an AI-provenance mark, and this score is a recency-weighted
            mean — arithmetic, not generation. Labelling it "AI generated" would
            be a false claim about how a clinical number was produced, which is
            the one direction this component must never err in. If the intent is
            a plain "how is this weighted?" explainer, that is a different
            control and worth adding as one. */}
        {evidence && (
          <p
            className="flex items-center gap-1.5 text-[var(--text-muted)]"
            style={LABEL_STYLE}
          >
            {/* TODO-COPY */}
            {review.aggregate
              ? `Weighted across ${review.aggregate.surveys.length} assessments`
              : "Most recent assessment"}
            <Provenance triggerLabel="About this score" />
          </p>
        )}
        {/* ═══ EXTRACTED, AND THE TASKS PANE RENDERS THE SAME ONE ═══
            The strip and its comparison grid were ~190 lines inline here. The
            billing queue commits the same decision from the same evidence and
            had no weighted score at all — one survey, no items, no date range —
            so the block moved out whole rather than being copied. Nothing about
            the treatment changed in the move; an extraction that also restyles is
            two changes reviewed as one.
            A PLAIN BLOCK COMMENT, not `{/* … *\/}`: the position below is inside
            `cond && ( … )`, which takes one expression — a JSX comment is only
            valid in children position, and putting one there is a parse error. */}
        {evidence && (
          /* `mt-2` RIDES ON THE MODULE rather than inside it: the gap belongs to
             this card's rhythm, not to the component. */
          <WeightedScoreModule review={review} className="mt-2" />
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
