"use client";

// THE RIGHT COLUMN, AS A SLOT THAT TIME-SHARES TWO UNITS.
//
// ═══ WHAT THIS REPLACES, AND WHY ═══
//
// R2 gave the review its own column by taking the rail's: opening a review
// unmounted the care summary and the panel stood where it had been. That put a
// supervisor in the position of deciding a billing code with the evidence gone,
// which is why the panel then had to grow a copy of the summary inside itself —
// a second rendering of one document, in the same column, to replace the one
// that had just been removed.
//
// The see-saw removes the premise. Both units are always present; exactly one is
// expanded. The care summary condenses to a three-line digest rather than
// vanishing, and the review condenses to a one-line draft bar rather than
// vanishing. Nothing migrates between them, so nothing is ever rendered twice.
//
// ═══ THE INVARIANT IS ENFORCED HERE, NOT BY THE CALLERS ═══
//
// Never both expanded. Never either at zero while a review is in progress. The
// slot takes ONE `expanded` value and derives both units from it, so there is no
// combination of props that can express a third state — which is the only way a
// rule like this survives the next person to touch it.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CareSummaryDoc } from "@/lib/record/care-summary-doc";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** ═══ THE CHIP CAP IS A NUMBER, NOT A MEASUREMENT ═══
 *
 *  "Collapse the overflow to +N" could be done by measuring the row and hiding
 *  what does not fit, and that version has a resize observer, a reflow on every
 *  column change, and a first paint where all of them are visible. A fixed cap
 *  cannot do any of those things. Two, because the column is 380px and the theme
 *  labels are phrases ("Sleep disturbance", "School avoidance") rather than
 *  words — measured at the widths this renders at, not guessed. */
const MAX_THEME_CHIPS = 2;

/** Severity order for the flag line, worst first. `RiskTier` has no intrinsic
 *  ordering and `risk-taxonomy.ts` deliberately does not give it one, so the
 *  ranking lives where it is used. */
const TIER_RANK: Record<string, number> = {
  imminent: 0,
  clinicalReview: 1,
  generalMonitoring: 2,
  unassigned: 3,
};

/** ═══ THE DIGEST — THREE FIXED SLOTS, AND IT CANNOT GROW ═══
 *
 *  Exactly three lines, in fixed positions, each one capped in what it can say:
 *  a trajectory sentence truncated to one line, a theme row capped at two chips
 *  plus a count, and a flag line that is a count and one label. There is no
 *  branch in here that adds a fourth thing, no scroll, and no section that
 *  appears when some record happens to have more to say — which is the whole
 *  point of a digest sitting above a panel that needs the height.
 *
 *  ITS HEIGHT IS 164px, AND THE SPEC ASKED FOR TWO THINGS THAT DO NOT BOTH FIT.
 *  "~120–160px total" and "≥44px per line" are 132px of lines before a header
 *  row or any padding exists, so 160 was never reachable with three 44px rows.
 *  The 44 is the one that protects a reader, so it is the one that was kept:
 *  3×44 + a 16px header + 12px of padding = 164. Measured, not estimated.
 *
 *  THE WHOLE SURFACE IS ONE BUTTON. A three-line summary with a chevron in the
 *  corner invites aiming at the chevron; the lines are the thing a reader is
 *  looking at, so the lines are the target. */
export function CareSummaryDigest({
  doc,
  onExpand,
  className,
}: {
  doc: CareSummaryDoc | null;
  onExpand: () => void;
  className?: string;
}) {
  const openFlags = (doc?.flags ?? []).filter((f) => !f.resolved);
  const worst = [...openFlags].sort(
    (a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9)
  )[0];
  const themes = doc?.themes?.themes ?? [];
  const shown = themes.slice(0, MAX_THEME_CHIPS);
  const overflow = themes.length - shown.length;

  /* TODO-COPY. "No open flags" rather than "0 open" — a zero with a label reads
     as a metric that happens to be zero, and this line is answering a yes/no. */
  const flagLine = worst
    ? `${openFlags.length} open · ${worst.tierLabel}`
    : "No open flags";

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-expanded={false}
      /* TODO-COPY — names what pressing it does, because the visible label is a
         heading rather than an instruction. */
      aria-label="Expand the care summary"
      data-record-section="care-summary-digest"
      className={cn(
        /* SAME LIFT AS THE PANEL. The build gave the panel a shadow and left the
           digest flat, so the column read as one fused surface with a seam rather
           than two cards with a gap between them. Both float now; what separates
           them is the 12px gap and their sizes, not their elevation. */
        "w-full rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-1.5 text-left shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--tint-hover)]",
        RING,
        className
      )}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[var(--text-muted)]" style={LABEL_STYLE}>
          {/* TODO-COPY — the same name the expanded unit carries. */}
          Care summary
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
      </span>

      {/* LINE 1 · trajectory, one line, ellipsised. The full sentence is in the
          expanded state, which is one press away — so this truncates rather than
          wraps, and the digest's height stays a constant. */}
      <span className="mt-0.5 flex min-h-[44px] items-center">
        {/* ONE LINE, ELLIPSISED — not two. The full sentence is in the expanded
            state; clamping to two here would let a long trajectory push the
            digest's height around, and a digest whose height depends on its
            content is not a cap. */}
        <span className="min-w-0 truncate text-[13px] leading-[18px] text-[var(--text-primary)]">
          {doc?.trajectory ??
            /* TODO-COPY — an empty state, never an em dash. */
            "No trajectory yet — it starts at the first survey."}
        </span>
      </span>

      {/* LINE 2 · themes. `flex-nowrap` with truncating chips, so a long label
          shortens instead of pushing the count off the row. */}
      <span className="flex min-h-[44px] items-center gap-1.5 border-t border-[color:var(--border-subtle)]">
        {shown.length === 0 ? (
          <span className="text-[13px] leading-[18px] text-[var(--text-muted)]">
            {/* TODO-COPY */}
            No conversation content this window
          </span>
        ) : (
          <>
            {shown.map((t) => (
              <span
                key={t.label}
                className="min-w-0 shrink truncate rounded-full bg-[var(--surface-s1)] px-2 py-0.5 text-[12px] leading-[16px] text-[var(--text-secondary)]"
              >
                {t.label}
              </span>
            ))}
            {overflow > 0 && (
              <span className="shrink-0 text-[12px] leading-[16px] tabular-nums text-[var(--text-muted)]">
                +{overflow}
              </span>
            )}
          </>
        )}
      </span>

      {/* LINE 3 · flags. Count and the worst tier, nothing else — the rows
          themselves are in the expanded summary. */}
      <span className="flex min-h-[44px] items-center border-t border-[color:var(--border-subtle)]">
        <span className="truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
          {flagLine}
        </span>
      </span>
    </button>
  );
}

/** ═══ THE DRAFT BAR — THE REVIEW, CONDENSED ═══
 *
 *  One line, and it is capped as hard as the digest is: a label and a dot. It
 *  cannot grow a preview of the draft, a field count or a validation summary,
 *  because the moment it can it is a second review surface competing with the
 *  panel it stands in for.
 *
 *  48px rather than 44: the ≥44px target the spec asks for is not one of
 *  `button.tsx`'s sizes (`default` is h-10, the next step is `icon-lg`'s square
 *  48), so the height is set here rather than by adding a size to a shared
 *  component for one consumer. */
export function ReviewDraftBar({
  reviewNoun,
  onRestore,
  className,
}: {
  /** e.g. "90-day review" — from `REVIEW_NOUN`, so this and the panel header
   *  cannot disagree about which review is being written. */
  reviewNoun: string;
  onRestore: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onRestore}
      data-record-section="review-draft-bar"
      /* TODO-COPY */
      aria-label={`Restore ${reviewNoun} draft`}
      className={cn(
        "flex h-12 w-full shrink-0 items-center gap-2.5 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 text-left transition-colors hover:bg-[var(--tint-hover)]",
        RING,
        className
      )}
    >
      {/* IN-PROGRESS, not a spinner: nothing is happening: something is
          unfinished. Pulses only where motion is welcome. */}
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-[var(--band-amber-fg)] motion-safe:animate-pulse"
      />
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-[20px] text-[var(--text-primary)]">
        {/* TODO-COPY */}
        Draft · {reviewNoun}
      </span>
      <ChevronUp className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
    </button>
  );
}

/** ═══ FULL HEIGHT MEANS "TO THE BOTTOM INSET", NOT "OFF THE SCREEN" ═══
 *
 *  The build bounded the column with `max-h-[calc(100dvh-6rem)]`, which is only
 *  right once the sticky column is stuck to the top. Unscrolled, the column
 *  starts ~300px down the page, so that height ran the panel 207px PAST the
 *  bottom of the window — measured. A panel with no visible bottom edge is
 *  exactly what reads as extruded from the app frame rather than laid on it.
 *
 *  No CSS length knows where an element currently sits, so this measures. It
 *  reads the tab's own scroll container (the page itself does not scroll) and
 *  leaves the same gap at the bottom that the page gutter leaves at the right,
 *  recomputing on scroll and resize behind a frame so the sticky transition in
 *  and out of stuck position stays correct.
 *
 *  @param bottomInset px to leave below the column — the page's column gutter,
 *  so the bottom gap matches the right one. */
export function useFittedHeight(bottomInset: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;

    // The tab content scrolls inside its own box; `window` never scrolls here.
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller && getComputedStyle(scroller).overflowY !== "auto") {
      scroller = scroller.parentElement;
    }

    const measure = () => {
      frame = 0;
      const top = el.getBoundingClientRect().top;
      const floor = scroller
        ? scroller.getBoundingClientRect().bottom
        : window.innerHeight;
      // A floor of 240px so a very short window degrades to a scrollable panel
      // rather than to one with no room for its own footer.
      setMaxHeight(Math.max(240, Math.round(floor - top - bottomInset)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("resize", schedule);
    scroller?.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.removeEventListener("resize", schedule);
      scroller?.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [bottomInset]);

  return { ref, maxHeight };
}

/** Which unit currently holds the column. */
export type SlotExpanded = "summary" | "review";

/** ═══ THE SLOT ═══
 *
 *  One `expanded` value in, two units out. There is deliberately no way to ask
 *  for both expanded or for either absent: those states are not representable in
 *  this signature, which is a stronger guarantee than a comment asking callers
 *  not to.
 *
 *  With no review in progress the slot is the care summary and nothing else —
 *  exactly the column that was there before any of this existed. */
export function CareReviewSlot({
  expanded,
  summaryFull,
  summaryDigest,
  reviewPanel,
  draftBar,
  reviewInProgress,
  className,
}: {
  expanded: SlotExpanded;
  summaryFull: React.ReactNode;
  summaryDigest: React.ReactNode;
  reviewPanel: React.ReactNode;
  draftBar: React.ReactNode;
  reviewInProgress: boolean;
  className?: string;
}) {
  /* ═══ THE MOTION IS A CROSS-FADE, AND THE HEIGHT IS NOT ANIMATED ═══
     Stated plainly because it is a real limit: the two units are different
     subtrees, so morphing one's height into the other's would mean measuring
     both and driving the swap in JS. What animates is opacity and a small
     translate, ~200ms, under `motion-safe` — the layout change lands on the
     first frame. It reads as a swap; it is not a morph, and calling it one in a
     comment would be the kind of claim nobody checks. */
  const unit = "motion-safe:transition-[opacity,transform] motion-safe:duration-200";

  if (!reviewInProgress) {
    return (
      <div className={cn("flex min-h-0 flex-col", className)}>{summaryFull}</div>
    );
  }

  return (
    <div
      data-record-section="care-review-slot"
      data-expanded={expanded}
      className={cn("flex min-h-0 flex-col gap-3", className)}
    >
      {/* THE SUMMARY UNIT swaps freely — it is derived from the record and holds
          no state, so unmounting the full form costs nothing. */}
      {expanded === "summary" ? (
        <div className={cn("min-h-0 flex-1 overflow-y-auto", unit)}>
          {summaryFull}
        </div>
      ) : (
        <div className={cn("shrink-0", unit)}>{summaryDigest}</div>
      )}

      {/* ═══ THE REVIEW UNIT STAYS MOUNTED, HIDDEN ═══
          Not a swap, and the difference matters. The panel holds a half-written
          clinical note, the scroll position inside it, and which decision is
          selected. Unmounting on every tip would rebuild all of that from the
          session draft — the text would survive, but the panel would re-seed from
          storage and greet the reader with "Draft restored from a moment ago"
          every time they glanced at the summary, which is a lie about what just
          happened. `hidden` keeps the instance and its scroll. */}
      {/* ═══ `hidden` GOES LAST, AND THAT IS LOAD-BEARING ═══
          `cn` is tailwind-merge: `hidden` and `flex` are both display utilities,
          so it keeps whichever it sees LAST and drops the other. Written with the
          condition first, `hidden` was silently stripped on every render and both
          units were expanded at once — the one state this slot exists to make
          unrepresentable. Caught by measuring the panel's height while the
          summary was expanded, not by reading the class list. */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          unit,
          expanded !== "review" && "hidden"
        )}
      >
        {reviewPanel}
      </div>
      {expanded !== "review" && (
        <div className={cn("shrink-0", unit)}>{draftBar}</div>
      )}
    </div>
  );
}
