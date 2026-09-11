"use client";

// ═══ CURRENT → RECOMMENDED, AND THE THREE KINDS OF PROPOSAL ═══
//
// THE TASKS BILLING PANE'S DIFF, MOVED OUT OF IT. It renders on exactly one
// surface today: the billing review pane. It lives in `record/` rather than
// `tasks/` because what it draws is a record-domain fact — a presentation and
// its code — and because the Care page's review card is where the vocabulary and
// the framing were settled.
//
// ═══ THE CARE PAGE INFLUENCED THIS AND WAS NOT CHANGED BY IT ═══
//
// An earlier pass graduated this component onto the Care review card too,
// replacing its single code-chip-beside-a-statement block. THAT WAS REVERTED at
// the product owner's instruction: the Care page is the reference standard for
// the billing queue, not a surface to be edited in the course of raising the
// queue to it. So the Care card is untouched and still draws its own
// presentation block, and what it contributed here is the part that travels —
// the three proposal kinds, their vocabulary, and the code-chip-inline-before-
// the-statement arrangement.
//
// WHAT THAT COSTS, STATED: the Care card states the code on record nowhere in
// the region making the proposal — a reader carries it down from the metadata
// strip above. That is a real observation from the recon pass and it is not this
// file's business to fix.
//
// ═══ WHAT THIS OWNS, AND WHY IT IS ONE COMPONENT AND NOT TWO ═══
//
// The framing and the chip are the same decision seen twice. A renewal has no
// second column AND says "Renewal proposed"; a first assignment has no second
// column AND says "Presentation proposed"; only a change gets an arrow AND the
// attention chip. Splitting them left two components deriving the same three
// cases from the same two codes, which is two places for them to disagree about
// which case is on screen.
//
// ═══ THE TINT IS SAND — NEUTRAL-WARM, NEVER GREEN ═══
//
// Tasks tinted the changed elements with `--band-sage-*`, which is emerald/100.
// Green is the committed-and-confirmed colour in this product, and a proposal is
// the state BEFORE that — so the old tint said "done" on the one screen whose
// whole question is "should this happen?". `--band-sand-*` is the warm neutral
// the system already reserves for routine/review-due (7.38:1 fg on bg, measured
// in `settings-tokens.css`), which is exactly this register: look at this, it
// is not an alarm and it is not a result.
//
// THE TINT MARKS THE PART THAT MOVED, per element. The statement and the code do
// not always move together — R45.89 → F41.1 is both, a re-worded statement under
// a stable code is only one — so each is tinted on its own comparison.
//
// A BAND FILL, NEVER A BORDER. A bordered box inside a bordered container reads
// as a second card; a fill reads as "this is the part that moved".

import { ArrowLeftRight, ArrowRight, FilePlus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PresentationSide {
  code: string;
  statement: string;
}

/** ═══ WHICH OF THE THREE THIS IS ═══
 *
 *  KEYED ON THE CODE ALONE, deliberately. A re-worded statement under the same
 *  code is a renewal of that code — the billable fact has not changed — and
 *  calling it a change would put the attention chip on a copy edit.
 *
 *  Exported so a caller that needs the kind for something else (a list chip, a
 *  footer label) derives it from the same function the diff draws from, rather
 *  than re-deriving the comparison and drifting. */
export type ProposalKind = "assign" | "change" | "renewal";

export function proposalKindFor(
  currentCode: string | null | undefined,
  recommendedCode: string
): ProposalKind {
  if (currentCode == null) return "assign";
  return currentCode === recommendedCode ? "renewal" : "change";
}

/** TODO-COPY, all three. THE CARE PAGE'S VOCABULARY IS CANONICAL — it is the
 *  more refined of the two and the product owner's call. Tasks said "First
 *  assignment" for the `assign` case and these three strings replace it: they
 *  name what the card IS (a proposal) rather than where the record is in its
 *  life. The Care card holds its own copies of the same three strings, which is
 *  the one duplication this file's reversion leaves behind — flagged rather than
 *  resolved, because resolving it means editing the Care card. */
export const PROPOSAL_LABEL: Record<ProposalKind, string> = {
  assign: "Presentation proposed",
  change: "Change proposed",
  renewal: "Renewal proposed",
};

const CHIP_BASE =
  "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] leading-[16px]";

/** ═══ THE PROPOSAL CHIP ═══
 *
 *  LABEL AND ICON CARRY THE KIND, not the tone (SC 1.4.1): the words differ and
 *  each kind has its own glyph.
 *
 *  ONLY A CHANGE TAKES THE ATTENTION BAND. An assignment and a renewal are the
 *  expected course of a record — `EVENT_TONE` says the same where the timeline
 *  renders their committed forms. Attention, not the risk ramp: a proposed code
 *  change is a thing to look at, not a danger.
 *
 *  THE CODE TRUNCATES AND THE WORDS DO NOT. `min-w-0` on the code span alone, so
 *  a narrow container clips "F43.22" before it clips "Change proposed", and
 *  `title` carries the whole string either way. */
export function ProposalChip({
  kind,
  code,
  className,
}: {
  kind: ProposalKind;
  code: string;
  className?: string;
}) {
  const label = PROPOSAL_LABEL[kind];
  if (kind === "change") {
    return (
      <span
        title={`${label} → ${code}`}
        className={cn(
          CHIP_BASE,
          "min-w-0 shrink bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]",
          className
        )}
      >
        <ArrowLeftRight className="size-3 shrink-0" aria-hidden />
        {label}
        <span className="min-w-0 truncate tabular-nums">→ {code}</span>
      </span>
    );
  }
  const Icon = kind === "assign" ? FilePlus : RefreshCw;
  return (
    <span
      title={label}
      className={cn(
        CHIP_BASE,
        "shrink-0 bg-[var(--surface-s1)] text-[var(--text-secondary)]",
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

/** ═══ ONE SIDE OF THE COMPARISON ═══
 *
 *  The code is a bordered mono chip INLINE BEFORE the statement rather than a
 *  bare line above it: a code on its own line reads as a heading for the sentence
 *  under it, and what it actually is is an identifier attached to that sentence.
 *  That arrangement came from the Care page and is kept for both. */
function Side({
  label,
  side,
  statementChanged,
  codeChanged,
}: {
  label: string;
  side: PresentationSide;
  statementChanged?: boolean;
  codeChanged?: boolean;
}) {
  const tint = "rounded-[6px] bg-[var(--band-sand-bg)] text-[var(--band-sand-fg)]";
  return (
    <div className="min-w-0">
      <p
        className="text-[var(--text-tertiary)]"
        style={{
          font: "var(--type-field-label)",
          letterSpacing: "var(--type-field-label-tracking)",
        }}
      >
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            "inline-flex h-[22px] shrink-0 items-center rounded-[4px] border border-[color:var(--border-subtle)] px-1 font-mono text-[12px] leading-[16px] tabular-nums",
            codeChanged
              ? "bg-[var(--band-sand-bg)] text-[var(--band-sand-fg)]"
              : "bg-[var(--surface-s1)] text-[var(--text-secondary)]"
          )}
        >
          {side.code}
        </span>
        <p
          className={cn(
            "min-w-0 text-[15px] leading-[22px] text-[var(--text-primary)]",
            statementChanged && cn(tint, "-mx-1 px-1")
          )}
        >
          {side.statement}
        </p>
      </div>
    </div>
  );
}

/** ═══ THE DIFF ═══
 *
 *  `recommended` IS WHATEVER IS NOW PROPOSED, not a frozen record of what the
 *  model suggested: the billing pane passes its override-aware value, so picking
 *  a different code from the picker turns a renewal into a change and re-tints
 *  the elements that moved. That is also what would make a footer button safe to
 *  read "Submit" rather than "Confirm {code}" — the outcome is stated here,
 *  beside the evidence, and it moves when the decision moves.
 *
 *  `action` IS THE MODIFIER, NEXT TO ITS OBJECT. `Change…` belongs with the thing
 *  it changes, not in the footer with the commit.
 *
 *  TWO PROPS LEFT WITH THE CARE CONSUMER. There were a `pending` (the
 *  supervisor's pick, held apart from the model's proposal) and a `chip` slot
 *  (which the Care card filled with a "Revert back to …" link once a change was
 *  pending). Both existed for that caller and nothing passes them now, so they
 *  are removed rather than kept as speculative surface — the billing pane gets
 *  the same moves-with-the-decision behaviour by passing the override as
 *  `recommended`. If a revert affordance is wanted here, it arrives with its
 *  consumer. */
export function PresentationDiff({
  current,
  recommended,
  action,
  className,
}: {
  /** The code on record, or null when nothing has been assigned yet. */
  current: PresentationSide | null;
  /** What is now proposed — the caller's override-aware value, not the model's
   *  original suggestion. See the note above. */
  recommended: PresentationSide;
  action?: React.ReactNode;
  className?: string;
}) {
  /* THE KIND FOLLOWS WHAT IS ON SCREEN, not what was originally proposed:
     picking a different code turns a renewal into a change, and a chip still
     reading "Renewal proposed" beside a changed code is the one wrong thing this
     region could say. `recommended` IS what is on screen — see the note above on
     why there is no second `pending` prop holding the two apart. */
  const kind = proposalKindFor(current?.code ?? null, recommended.code);
  const codeChanged = !!current && current.code !== recommended.code;
  const statementChanged = !!current && current.statement !== recommended.statement;

  return (
    <div
      data-record-section="presentation-diff"
      className={cn(
        "rounded-[var(--radius-inset)] border border-[color:var(--border-contour)] px-3.5 py-3",
        className
      )}
    >
      {kind === "change" ? (
        /* ═══ TWO COLUMNS AND AN ARROW ═══
           Side by side, the change is a single glance; stacked in two blocks with
           other content between them it was answered by scrolling up and holding
           two sentences in your head. */
        <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          {/* TODO-COPY */}
          <Side label="Current" side={current!} />
          {/* THE ARROW TURNS WITH THE LAYOUT. Below `sm` the two sides stack and
              a right-pointing arrow between two stacked boxes points at nothing.
              `aria-hidden` because the two labels already say which is which — an
              arrow read aloud adds a symbol, not a fact. */}
          <ArrowRight
            aria-hidden
            className="mt-6 size-4 shrink-0 rotate-90 justify-self-center text-[var(--text-muted)] sm:rotate-0"
          />
          <Side
            /* TODO-COPY */
            label="Recommended"
            side={recommended}
            statementChanged={statementChanged}
            codeChanged={codeChanged}
          />
        </div>
      ) : (
        /* ═══ A RENEWAL AND AN ASSIGNMENT ARE NOT CHANGES ═══
           Neither has a second code to point at. An assignment has nothing on
           record — which is the reason the review exists — and a renewal's
           current and recommended are the same value, so a two-column diff would
           print one sentence twice under an arrow. One column, labelled for what
           it is: an empty box beside an arrow is a diagram of an absence, and two
           identical boxes are a diagram of nothing at all. */
        <Side
          /* TODO-COPY. "Presentation" rather than "Recommended" — there is
             nothing to recommend it against. */
          label="Presentation"
          side={recommended}
        />
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ProposalChip kind={kind} code={recommended.code} />
        {action}
      </div>
    </div>
  );
}
