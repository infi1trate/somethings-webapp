"use client";

// ═══ CURRENT → RECOMMENDED, AND THE THREE KINDS OF PROPOSAL ═══
//
// SHARED BY THE CARE PAGE AND THE TASKS BILLING PANE. Both surfaces commit the
// same clinical decision — an ICD code onto a minor's record — and both used to
// draw it their own way: Tasks had a two-column diff with an arrow, Care had a
// single code chip beside a statement with the code on record stated nowhere in
// the region making the proposal. Extracted from Tasks, which had the better
// one, and graduated onto Care.
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
 *  assignment" for the `assign` case; "Presentation proposed" is what ships on
 *  both now, and it is the better string: it names what the card IS (a proposal)
 *  rather than where the record is in its life. */
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
 *  `pending` IS THE SUPERVISOR'S OWN PICK, and when it exists it is what the
 *  RECOMMENDED side shows — the region states the presentation this review is
 *  now about, not a frozen record of what the model proposed. That is also what
 *  makes a footer button safe to read "Submit" rather than "Confirm {code}": the
 *  outcome is stated here, beside the evidence, and it moves when the decision
 *  moves. Import the short label without the moving proposal and the last check
 *  before writing to a minor's billing record becomes a button that cannot be
 *  wrong.
 *
 *  `chip` REPLACES THE PROPOSAL CHIP when the caller has something better to put
 *  in that slot — the Care page passes a "Revert back to …" link once a change is
 *  pending, because "Renewal proposed" is false the moment a different code is
 *  chosen and the slot is more useful carrying the way back.
 *
 *  `action` IS THE MODIFIER, NEXT TO ITS OBJECT. `Change…` belongs with the thing
 *  it changes, not in the footer with the commit. */
export function PresentationDiff({
  current,
  recommended,
  pending,
  chip,
  action,
  className,
}: {
  /** The code on record, or null when nothing has been assigned yet. */
  current: PresentationSide | null;
  /** What this review proposes. */
  recommended: PresentationSide;
  /** What the supervisor picked instead, if they have. */
  pending?: PresentationSide | null;
  /** Overrides the proposal chip. Pass `null` to render no chip at all. */
  chip?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const shown = pending ?? recommended;
  /* THE KIND FOLLOWS WHAT IS ON SCREEN, not what was proposed: picking a
     different code turns a renewal into a change, and a chip still reading
     "Renewal proposed" beside a changed code is the one wrong thing this region
     could say. */
  const kind = proposalKindFor(current?.code ?? null, shown.code);
  const codeChanged = !!current && current.code !== shown.code;
  const statementChanged = !!current && current.statement !== shown.statement;

  const chipNode =
    chip !== undefined ? chip : <ProposalChip kind={kind} code={shown.code} />;

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
            side={shown}
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
          side={shown}
        />
      )}

      {(chipNode || action) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            {chipNode}
          </span>
          {action}
        </div>
      )}
    </div>
  );
}
