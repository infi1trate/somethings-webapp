"use client";

// ═══ THE REVIEW BODY — EVERYTHING A PRESENTATION REVIEW SHOWS ABOVE ITS FORM ═══
//
// Four blocks and a dialog: the recommendation's label and title line, the
// rationale with its provenance, the weighted score strip with its survey grid,
// and the DSM-5 picker that the title line's `Change code` opens.
//
// ═══ WHY IT IS A COMPONENT NOW ═══
//
// It was inline JSX inside `<TaskCard>` in `care-review-card.tsx` — which meant
// the only way for the Tasks billing pane to show a presentation review was to
// reimplement it, and reimplementing it is exactly how the two surfaces diverged
// in the first place. The queue commits the same ICD code onto the same minor's
// record and had none of this: no title line, no rationale, no weighted score,
// no item grid, and a code picker that was a different component.
//
// MOVED VERBATIM. Not one class, string, or attribute changed in the extraction;
// the only edit is the rename described below. An extraction that also restyles
// is two changes reviewed as one, and there is no way to tell which of them broke
// something. `review-body-parity.mjs` holds seventeen DOM snapshots of the Care
// card — four records x collapsed / expanded / grid-open / pending, plus a
// validation failure — captured before the move and compared byte-for-byte after.
//
// ═══ WHAT STAYED BEHIND, AND WHY THAT IS THE WHOLE POINT ═══
//
// The attention layer: `TaskCard`'s band and tone, the Review / Close control,
// the `Draft` indicator, the 0fr -> 1fr expansion motion, the collapse-focus
// effect. None of it is about a presentation review — it is about a card on a
// page that has other cards. The Tasks pane has a pane header and a queue
// instead, and inherits none of it.
//
// ═══ `interactive` REPLACES `expanded`, 1:1 ═══
//
// Three things were gated on the card's `expanded`: the `Change code` button,
// the picker dialog, and — easy to miss — the resolution of `pending` itself, so
// a collapsed card never showed a pending change. All three now read
// `interactive`, and Care passes exactly `expanded`, so the semantics are
// unchanged on that surface. Tasks passes `true`: it has no collapsed state, and
// a prop called `expanded` would be a lie there.

import { useState, useRef } from "react";
import { ArrowLeftRight, ChevronRight, FilePlus, Pencil, RefreshCw } from "lucide-react";
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
import { clinicalDate } from "@/components/record/care-presentation";
import { bandLabel } from "@/components/record/score-chip";
import { SurveyComparisonGrid } from "@/components/record/survey-comparison-grid";
import {
  INSTRUMENT_MAX,
  RATIONALE_SOURCE_LABEL,
  type AssessmentItem,
  type PresentationReview,
} from "@/lib/record/care-demo";
import { Provenance } from "@/components/record/provenance";
import { proposalKindFor } from "@/lib/record/proposal-kind";
import { cn } from "@/lib/utils";

/* VERBATIM FROM THE CARD, and it was wrong for one run: this was written with a
   leading `rounded-sm` copied from a different module's RING, which put a radius
   on every control in the moved JSX and reordered their class strings. The
   snapshot probe caught it on five of seventeen states — which is the entire
   reason the probe exists, and worth recording rather than quietly fixing. */
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** The weighted strip's value style, in one place. */
const STAT_VALUE = "text-[20px] leading-[24px] tabular-nums text-[var(--text-primary)]";

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

export function ReviewBody({
  review,
  /** The code on record, so the body can say whether the proposal is a change. */
  currentCode = null,
  /** ═══ THE SUBORDINATE CURRENT LINE — OPT-IN, AND THAT IS THE POINT ═══
   *
   *  The parity spec asks for the code on record as a quiet line beneath the
   *  recommendation title. It has never existed: `currentCode` and
   *  `currentStatement` reach this module only to derive the proposal kind and to
   *  mark "On record" in the picker, which is why the Tasks host built a context
   *  strip of its own to state it (arch-F's recon found both halves).
   *
   *  IT IS A PROP RATHER THAN ALWAYS-ON because Care states the code in the spine
   *  ABOVE this card, and rendering it here too would both duplicate that and
   *  change Care's rendered output — which the seventeen parity snapshots exist
   *  to forbid. Tasks opts in; Care does not pass it and is byte-identical. */
  showCurrentLine = false,
  /** The statement for `currentCode`. */
  currentStatement = null,
  /** The pending change, owned by the caller. `null` is unchanged. */
  decision = null,
  onDecisionChange,
  /** The tier gate: read-wide, act-narrow. False renders no proposal chip and no
   *  decision controls at all — there is no disabled state. */
  canAct,
  /** See the module note. Care passes its `expanded`; Tasks passes `true`. */
  interactive,
}: {
  review: PresentationReview;
  currentCode?: string | null;
  currentStatement?: string | null;
  showCurrentLine?: boolean;
  decision?: ReviewDecision | null;
  onDecisionChange?: (next: ReviewDecision | null) => void;
  canAct: boolean;
  interactive: boolean;
}) {
  /** Lifted out of the old Disclosure component: the header must not own the
   *  body's open state, or it re-renders around it. */
  const [open, setOpen] = useState(false);

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

  /** ═══ WHICH OF THE THREE PROPOSALS THIS IS ═══
   *
   *  The derivation and its history moved to `lib/record/proposal-kind.ts` in
   *  arch-E, because the Tasks row needs the same answer: it previews the weight
   *  of the decision before a supervisor opens it, and a row labelled differently
   *  from the pane it opens would be two answers to one question. Nothing about
   *  the three cases changed — see that file for why a null current code is an
   *  assignment rather than a change from nothing. */
  const proposalKind = proposalKindFor(currentCode, review.recommended.code);

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
  /** How many assessments stand behind the score — the aggregate's list, or the
   *  single survey. Read by the Assessments datum and by the disclosure. */
  const surveyCount = review.aggregate?.surveys.length ?? (review.survey ? 1 : 0);

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
    interactive && decision?.kind === "change" && decision.code ? decision : null;

  /** WHAT THE HEADER STATES. The recommendation until someone changes it, and
   *  the change from the moment they do — the header is the presentation this
   *  review is now about, not a frozen record of what was proposed. */
  const shown = pending ?? review.recommended;

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
    <>
      {/* 1 · RECOMMENDATION — LABEL, THEN CODE-CHIP + STATEMENT ON ONE LINE.
          The code was a bare mono line ABOVE the statement. It is now a bordered
          chip sitting INLINE before it, which is the design file's arrangement
          and a better one: a code on its own line reads as a heading for the
          sentence under it, where what it actually is is an identifier ATTACHED
          to that sentence. Boxed and inline, it reads as a tag.
          The eyebrow above them names the slot, so the band no longer has to. */}
      <div>
        <p className="mb-1 text-[var(--text-tertiary)]" style={LABEL_STYLE}>
          {/* TODO-COPY */}
          Recommended presentation
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
          <span className="flex min-w-48 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {/* `items-center` NOT `items-baseline` on this row now: the chip is a
                22px box, and a box has no baseline of its own to share with the
                20px statement beside it — aligning them by baseline hung the box
                low. Centres agree; baselines only agree for text. */}
            <span className="inline-flex h-[22px] shrink-0 items-center rounded-[4px] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-1 font-mono text-[12px] leading-[16px] tabular-nums text-[var(--text-secondary)]">
              {shown.code}
            </span>
            <p className="text-[20px] font-semibold leading-[24px] tracking-[-0.2px] text-[var(--text-primary)]">
              {shown.statement}
            </p>
            {proposalChip}
          </span>
          {interactive && canAct && onDecisionChange && (
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

        {/* ═══ WHAT IS ON RECORD, SUBORDINATE TO WHAT IS PROPOSED ═══
            Quiet, one line, directly beneath the title it qualifies — the
            recommendation is the card's claim and this is the thing it would
            replace. Tasks only (see `showCurrentLine`).
            ABSENT FOR A FIRST ASSIGNMENT, and that is not an omission: there is
            nothing on record, and a line reading "Current · none" would invent a
            state. The proposal chip already says "Presentation proposed", which
            is the same fact stated as the thing that matters. */}
        {showCurrentLine && currentCode && (
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] leading-[17px] text-[var(--text-secondary)]">
            {/* NEEDS-COPY-NICOLE */}
            <span>Current</span>
            <span aria-hidden className="opacity-40">·</span>
            <span className="font-mono tabular-nums">{currentCode}</span>
            {currentStatement && <span className="min-w-0">{currentStatement}</span>}
          </p>
        )}
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
      {interactive && canAct && onDecisionChange && (
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
        {evidence && (
          /* Same ring room. The rounded corners need the clip, so the clip edge
             moves rather than the rule. A PLAIN BLOCK COMMENT, not `{/* … *\/}`:
             this position is inside `cond && ( … )`, which takes one expression
             — a JSX comment is only valid in children position, and putting one
             here is a parse error. */
          <div className="-mx-1.5 mt-2 overflow-hidden rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-1.5">
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
                "flex min-h-[92px] w-full cursor-pointer items-center gap-x-3 px-6 py-3 text-left",
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
              <span className="flex min-w-0 flex-1 flex-wrap items-start gap-x-10 gap-y-3">
                {/* ═══ DATUM 1 — THE INSTRUMENT ═══
                    It was a prefix on the Surveys sub-line, where it read as part
                    of the date range rather than as the thing being measured.
                    TODO-COPY — PLACEHOLDER. */}
                <span className="flex shrink-0 flex-col gap-y-1">
                  <span className="text-[var(--text-muted)]" style={LABEL_STYLE}>
                    Assigned assessment
                  </span>
                  <span className={STAT_VALUE}>
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
                      <span className={STAT_VALUE}>
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
                    Assessments
                  </span>
                  <span className={STAT_VALUE}>
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
                {/* TODO-COPY — PLACEHOLDER. "View results (n)" is the design
                    file's label. The count came back with it: it had been
                    dropped as a duplicate of the Assessments datum two columns
                    left, and the counter-argument is that this control has to be
                    self-describing at the moment of aiming at it — a reader's
                    eye is on the right edge of the row, not on a cell across the
                    panel.
                    IT STILL TOGGLES. The file only ever draws the collapsed
                    state, so it says nothing about the open one, and an action
                    phrase that never changes reads "View results" while the
                    results are on screen. Open drops the count with the verb —
                    "Hide results (3)" would be offering to hide three of
                    something. */}
                {open ? "Hide results" : `View results (${surveyCount})`}
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
              <div className="border-t border-[var(--border-subtle)] px-6 py-3">
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

    </>
  );
}
