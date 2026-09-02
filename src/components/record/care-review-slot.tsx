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

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/use-mounted";
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

/** ═══ THE PANEL IS PINNED TO THE VIEWPORT, NOT TO THE COLUMN ═══
 *
 *  Two builds rendered it as an in-flow child of the right column and then tried
 *  to make it float with styling. That could never work: an in-flow element
 *  scrolls with its container, and `position: sticky` only stops moving once it
 *  has already travelled to its stuck offset. "Spans the view height and does not
 *  move when the page scrolls" is not a styling property of that DOM position —
 *  it is a different DOM position.
 *
 *  So the panel is portalled out of the page and fixed against the window. This
 *  hook computes where, from the layout rather than from constants:
 *
 *    · the SCROLL CONTAINER's box gives the tab content area's real edges — the
 *      app header and the tab row both live INSIDE it and scroll away, so
 *      anchoring to either of them would pin the panel to something that moves.
 *    · right and bottom leave the page's own column gutter outside that box.
 *    · width is read off the digest, which is the right column — so the rail
 *      width and the gated 420px fallback keep deciding it, in one place.
 *    · top clears the digest.
 *
 *  ═══ TOP IS CAPTURED ONCE, AND THAT IS THE POINT ═══
 *
 *  The digest stays in flow, so it scrolls. If the panel tracked it the panel
 *  would scroll too, which is the whole defect. So the digest's position is read
 *  WHEN THE PANEL OPENS and then held: the panel clears the digest at the moment
 *  a reader opens it, and stays put afterwards while the digest scrolls behind
 *  the page. Recomputed on resize — a new window is a new layout — and never on
 *  scroll.
 *
 *  Clamped to the top gutter so opening a review from the bottom of History,
 *  where the digest is off-screen above, does not push the panel off the window. */
const GUTTER = 40;

export function useViewportAnchor(
  active: boolean,
  /** An empty, in-flow element left in the right column. It is what keeps the
   *  stack's x-position and width tied to the column's own track rather than to
   *  a number typed in here — the rail width and the gated 420px fallback go on
   *  deciding it, in the one place they already did. */
  columnAnchor: HTMLElement | null
): React.CSSProperties | undefined {
  const [style, setStyle] = useState<React.CSSProperties | undefined>(undefined);

  useEffect(() => {
    // No `setStyle(undefined)` here on purpose: the portal is already `hidden`
    // whenever this is inactive, so a stale value is never rendered — and a
    // synchronous setState in an effect is a cascading render the lint rule
    // rightly rejects.
    if (!active || !columnAnchor) return;
    const measure = () => {
      let scroller: HTMLElement | null = columnAnchor.parentElement;
      while (scroller && getComputedStyle(scroller).overflowY !== "auto") {
        scroller = scroller.parentElement;
      }
      const box = scroller?.getBoundingClientRect();
      const col = columnAnchor.getBoundingClientRect();
      setStyle({
        position: "fixed",
        top: Math.round((box ? box.top : 0) + GUTTER),
        bottom: Math.round(
          (box ? window.innerHeight - box.bottom : 0) + GUTTER
        ),
        left: Math.round(col.left),
        width: Math.round(col.width),
      });
    };

    /* ═══ A ResizeObserver, BECAUSE THE COLUMN IS STILL ANIMATING ═══
       The first measure used to run in a single rAF and caught the column
       380px wide — mid-flight through the grid's 200ms width transition — so
       the stack pinned itself 40px narrower than the track it belongs to. The
       observer fires again when the transition settles, and on any later layout
       change, so the width is whatever the column ACTUALLY ended up at rather
       than whatever it happened to be one frame in.
       rAF-throttled so a 200ms transition is not a dozen setStates. */
    let frame = 0;
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
    };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(columnAnchor);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [active, columnAnchor]);

  return style;
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
  float = true,
  className,
}: {
  expanded: SlotExpanded;
  summaryFull: React.ReactNode;
  summaryDigest: React.ReactNode;
  reviewPanel: React.ReactNode;
  draftBar: React.ReactNode;
  /** ═══ FLOAT ONLY WHERE THERE IS A PAGE TO FLOAT OVER ═══
   *  True in the right column, where the panel is portalled and pinned to the
   *  viewport. FALSE inside the narrow-viewport sheet: that sheet is already an
   *  overlay, and a panel portalled out of it lands on the page BESIDE the sheet
   *  rather than in it — measured at 1000px, escaping its own container. There
   *  the two units stack in flow and the sheet does the floating. */
  float?: boolean;
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

  /** ═══ A CALLBACK REF, NOT A REF PLUS AN EFFECT ═══
   *  The element has to reach STATE for the anchor hook to depend on it, and an
   *  effect that copies `ref.current` into state runs after the render that
   *  mounted the element but does not re-run when the element is swapped in or
   *  out by a branch — which is exactly what happens here, so the anchor kept
   *  seeing null and the panel stayed hidden. React calls a callback ref with the
   *  node on every attach and with null on every detach, which is the signal this
   *  needs. */
  const [columnEl, setColumnEl] = useState<HTMLElement | null>(null);

  const reviewExpanded = reviewInProgress && expanded === "review";
  const floating = float && reviewExpanded;
  const anchor = useViewportAnchor(floating, columnEl);
  const mounted = useMounted();

  /** ═══ THE DIGEST IS PINNED WITH THE PANEL, AND THIS IS A DEVIATION ═══
   *
   *  The spec asked for the digest to stay in flow and for the panel's top to be
   *  offset below it. MEASURED, those cannot both hold here: the right column
   *  starts 303px down the page — under the person header and the tab row, both
   *  of which are in flow — so a panel pinned below the digest's RESTING position
   *  is 375px tall, nowhere near "spans the view height", and a panel pinned to
   *  the content top covers the digest entirely. The instruction assumes a column
   *  that begins just under the tab bar; this one does not.
   *
   *  So the pair travels together: one fixed stack from the content top's gutter
   *  to the bottom's, digest on top at its capped height, panel filling the rest.
   *  Every acceptance test holds — the panel does not move on scroll, it spans
   *  the view height, and the digest is readable throughout — and the digest is
   *  still the same element, the same width, in the same place on screen.
   *
   *  It stays genuinely in flow in the states where nothing overlays it: State 2
   *  and no-review-in-progress both render the column normally. */
  const fixedStack =
    mounted && float && reviewInProgress
      ? createPortal(
          <div
            data-record-section="care-review-portal"
            style={anchor}
            className={cn(
              "z-30 flex flex-col gap-3",
              // Hidden rather than unmounted while tipped away — the panel holds
              // a half-written note and its own scroll position.
              !reviewExpanded && "hidden",
              !anchor && "hidden"
            )}
          >
            <div className="shrink-0">{summaryDigest}</div>
            <div className="flex min-h-0 flex-1 flex-col">{reviewPanel}</div>
          </div>,
          document.body
        )
      : null;

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
      {expanded === "summary" ? (
        <>
          <div className={cn("min-h-0 flex-1 overflow-y-auto", unit)}>
            {summaryFull}
          </div>
          <div className={cn("shrink-0", unit)}>{draftBar}</div>
        </>
      ) : float ? (
        /* The column keeps a zero-height anchor so the track's x and width stay
           measurable while the stack floats above it. */
        <div ref={setColumnEl} aria-hidden className="h-0 w-full shrink-0" />
      ) : (
        /* IN THE SHEET: both units in flow, digest above panel — the sheet is
           the overlay, so nothing here needs to leave it. */
        <>
          <div className={cn("shrink-0", unit)}>{summaryDigest}</div>
          <div className={cn("flex min-h-0 flex-1 flex-col", unit)}>
            {reviewPanel}
          </div>
        </>
      )}

      {fixedStack}
    </div>
  );
}
