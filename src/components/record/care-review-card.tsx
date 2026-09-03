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
import { ArrowLeftRight, ChevronRight, Pencil, RefreshCw } from "lucide-react";
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
import type { Dsm5Entry } from "@/lib/record/dsm5";
import type { ReviewDecision } from "@/lib/record/review-draft";
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
  currentStatement = null,
  decision = null,
  onDecisionChange,
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

  /** ═══ THE PENDING CHANGE, RESOLVED ONCE ═══
   *  `null` unless a supervisor has picked something in the picker. Everything
   *  that reflects it below — the code line, the title, the revert link — reads
   *  this one value, so the header cannot show one presentation while the
   *  control beside it offers to revert to another. */
  const pending =
    expanded && decision?.kind === "change" && decision.code ? decision : null;

  /** WHAT THE HEADER STATES. The recommendation until someone changes it, and
   *  the change from the moment they do — the header is the presentation this
   *  review is now about, not a frozen record of what was proposed. */
  const shown = pending ?? review.recommended;

  /* THE CHIP SLOT — the proposal chip, or the way back out of a change. */
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
    ) : proposesChange ? (
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
          {shown.code}
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
        {/* ═══ TITLE → CHIP │ CHANGE CODE ═══
            TWO GROUPS, AND ONLY THE INNER ONE WRAPS. A single `flex-wrap` row
            put the whole button on its own line as soon as the title got long,
            which is exactly backwards: the chip is a NOTE about the title and can
            drop, the button is the row's ACTION and has to stay on the title's
            line to be found. So title+chip share a wrapping group and the button
            sits outside it, `shrink-0`.

            The title wraps rather than truncating — it is the thing being
            reviewed, and half a presentation name is worse than two lines of it.

            AND THE OUTER ROW WRAPS TOO, below a floor. `min-w-48` on the title
            group is what decides where: with the button and its gap needing
            ~138px, a card narrower than ~330px cannot seat both, and without the
            floor the title group simply kept shrinking — measured at 375px as a
            139px column running the presentation name down FIVE lines beside a
            button. Past the floor the button takes its own line and the title
            gets the full width, which is the right trade on a phone: the action
            is still directly under the thing it acts on.

            THE BUTTON IS EXPANDED-ONLY. A collapsed card keeps Review as its one
            action; offering a code change from a card nobody has opened would be
            acting before reading. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="flex min-w-48 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-[20px] font-normal leading-[26px] tracking-[-0.2px] text-[var(--text-primary)]">
              {shown.statement}
            </p>
            {proposalChip}
          </span>
          {expanded && canAct && onDecisionChange && (
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
                "inline-flex min-h-9 shrink-0 items-center gap-1.5 self-center rounded-full",
                "border border-[color:var(--border-contour)] px-3 py-1.5",
                "text-[13px] font-semibold leading-[18px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              <Pencil className="size-3.5 shrink-0" aria-hidden />
              {/* TODO-COPY — PLACEHOLDER. */}
              Change code
            </button>
          )}
        </div>
      </div>

      {/* THE DELTA BAR IS GONE. It stated the change as old-struck → new with
          Edit and Remove, on the premise that the title had to keep showing the
          code on record until commit. The product decision is the other one: the
          HEADER now moves to the new presentation the moment it is picked, and
          the only thing a supervisor still needs is the way back — which is the
          revert link in the chip's slot above. A bar restating a change the
          header already states is the same fact twice, and its Edit was a second
          door into the picker "Change code" already opens. */}

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
        {/* ═══ THE EYEBROW IS GONE ═══
            It read "Weighted across {n} surveys" and was doing two jobs badly:
            naming the unit, and stating a count. The strip below now carries a
            LABEL PER DATUM, so the count is a value with its own label instead
            of a clause in a heading — and the heading is not needed to say what
            the numbers are once each number says so itself. */}
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
                /* THE HEIGHT IS FIXED AND HAS GROWN. 68px held a two-line lockup; the
                   stat row is label + value + sub-line, so 92px. It stays FIXED
                   for the original reason — the expanded body is a sibling, and
                   nothing the body does may move anything in this header. */
                /* MIN-height, not fixed. The fixed height existed so the expanded
                   body could not move anything in this header — and it still
                   cannot, because a wrap here is caused by CONTAINER WIDTH, not
                   by the body opening. Three data need to be able to go to two
                   lines rather than squeeze a value. */
                "flex min-h-[92px] w-full cursor-pointer items-center gap-x-3 px-3.5 py-2 text-left",
                "transition-colors hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {/* ═══ TWO DATA, THE PRESENTATION CARD'S PATTERN ═══
                  Label over value, the metadata row's styles — 12px muted label,
                  20px tabular value, 13px muted sub-line — so a supervisor
                  reading down the page meets the same shape twice rather than a
                  headline number here and a stat row there.

                  BOTH VALUES SHARE A BASELINE by construction: the two data are
                  `items-start` siblings whose labels are the same style and
                  therefore the same height, so the value lines begin at the same
                  y without either being told a height.

                  THE SCORE DROPS 24px → 20px. That is the pattern's size, and
                  matching it is the point of adopting the pattern. */}
              {/* ═══ THREE DATA, WRAPPING 2+1 BEFORE ANY VALUE TRUNCATES ═══
                  `flex-wrap` with each datum `shrink-0`: the row would rather go
                  to two lines than squeeze a value, because a truncated "10 / 21"
                  is not a score and a truncated date range is not a window. The
                  instrument leaves the Surveys sub-line and becomes its own
                  datum, so the sub-line is dates alone. */}
              <span className="flex min-w-0 flex-1 flex-wrap items-start gap-x-8 gap-y-3">
                {/* ═══ DATUM 1 — THE INSTRUMENT ═══
                    It was a prefix on the Surveys sub-line, where it read as part
                    of the date range rather than as the thing being measured.
                    TODO-COPY — PLACEHOLDER. */}
                <span className="flex shrink-0 flex-col gap-y-1">
                  <span className="text-[var(--text-muted)]" style={LABEL_STYLE}>
                    Assigned survey
                  </span>
                  <span className="text-[20px] leading-[26px] tabular-nums text-[var(--text-primary)]">
                    {evidence.instrument}
                  </span>
                </span>

                {/* ═══ DATUM 1 ═══
                    "Weighted score" ONLY when there is a weighting. One reading
                    weighted is not a weighting, and calling it one would be the
                    single-survey lie A5 exists to prevent. TODO-COPY —
                    PLACEHOLDERS. */}
                <span className="flex shrink-0 flex-col gap-y-1">
                  <span className="text-[var(--text-muted)]" style={LABEL_STYLE}>
                    {review.aggregate ? "Weighted score" : "Score"}
                  </span>
                  <span className="flex items-baseline gap-x-2">
                    <span className="flex shrink-0 items-baseline gap-x-1">
                      <span className="text-[20px] leading-[26px] tabular-nums text-[var(--text-primary)]">
                        {evidence.score}
                      </span>
                      {/* THE DENOMINATOR. A bare "9" has no scale. The maximum
                          comes from the INSTRUMENT DEFINITION, never a literal
                          here: a per-card constant is how one surface ends up
                          saying /21 for a PHQ-9. */}
                      <span className="text-[14px] leading-[26px] tabular-nums text-[var(--text-muted)]">
                        / {maxScore}
                      </span>
                    </span>
                    <BandChip severity={evidence.severity} />
                  </span>
                </span>

                {/* ═══ DATUM 2 ═══
                    The count is a value now rather than a clause in the deleted
                    eyebrow, and the window it covers is its sub-line. */}
                <span className="flex shrink-0 flex-col gap-y-1">
                  <span className="text-[var(--text-muted)]" style={LABEL_STYLE}>
                    {/* TODO-COPY — PLACEHOLDER. */}
                    Surveys
                  </span>
                  <span className="text-[20px] leading-[26px] tabular-nums text-[var(--text-primary)]">
                    {review.aggregate ? review.aggregate.surveys.length : 1}
                  </span>
                  <span className="whitespace-nowrap text-[13px] leading-[18px] text-[var(--text-muted)]">
                    {/* DATES ALONE. The instrument moved to its own datum, so
                        repeating it here would state one fact twice in one row.
                        Oldest → newest; on one survey it is that survey's own
                        date, with no range and no "weighted" language anywhere in
                        the unit. TODO-COPY. */}
                    {review.aggregate
                      ? `${clinicalDate(
                          review.aggregate.surveys[review.aggregate.surveys.length - 1].at
                        )} – ${clinicalDate(review.aggregate.surveys[0].at)}`
                      : clinicalDate(evidence.at)}
                  </span>
                </span>
              </span>

              {/* PINNED, and now a LABEL rather than a control. Its own flex
                  child in a fixed-height row, so it cannot move. */}
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)]">
                {/* TODO-COPY — PLACEHOLDER. Was "Survey answers"; "Show results"
                    names the action rather than the destination, which is what a
                    disclosure label is for. NO COUNT SUFFIX: the Surveys datum
                    two columns to the left already carries the number, and a
                    second copy in the control would be the same fact twice on one
                    row.
                    IT TOGGLES, because the old label did not have to. "Survey
                    answers" was a NOUN — true in both states, with the chevron
                    carrying the state. An action phrase that never changes says
                    "Show results" while the results are on screen, which is the
                    label contradicting the thing it labels. */}
                {open ? "Hide results" : "Show results"}
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
