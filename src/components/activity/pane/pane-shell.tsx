"use client";

// THE PANE'S LAYOUT SYSTEM — header, scrolling content, pinned footer.
//
// ═══ THE PROBLEM THIS SOLVES ═══
//
// The pane filled its top quarter and left the rest white. Two separate faults
// were doing that, and only one is about height:
//
//  1. NOTHING WAS PINNED. Header, body and footer were one flow, so a short
//     event left the footer link floating just below the content with a column
//     of nothing beneath it — which reads as a rendering mistake rather than as
//     a short record.
//  2. THERE WAS NO CONTENT to fill it, which is C3's problem, not this phase's.
//
// So the shell fixes the first and stops the second from LOOKING like a defect.
// Content is top-aligned and the actions sit on the pane's bottom edge, so a
// two-fact event reads as "this event is short" rather than "this pane failed".
//
// ═══ THE GRID IS THE MECHANISM ═══
//
// `grid-rows-[auto_minmax(0,1fr)_auto]` — the middle row is the only flexible
// one, so the header and footer are pinned without either needing a sticky
// position, and `minmax(0,…)` is what lets the middle row SHRINK below its
// content and scroll. A plain `1fr` would refuse to go under its content's
// height and the whole pane would grow instead of the region scrolling. That is
// the same trap the care-update modal hit; it is written down here because the
// next person to build a pane will hit it too.

import { cn } from "@/lib/utils";

/** ONE SPACING RHYTHM FOR EVERY PRIMITIVE. Exported so a section cannot invent
 *  its own gap — the brief asks for consistent vertical spacing between
 *  primitives, and a shared constant is the only version of that which survives
 *  a second author. */
export const SECTION_GAP = "space-y-5";

/** The horizontal padding every band in the pane shares, so the header's title,
 *  the content and the footer's actions sit on one left edge. */
export const PANE_PAD = "px-5";

export function PaneShell({
  header,
  footer,
  children,
  className,
}: {
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]",
        className
      )}
    >
      {/* FIXED HEADER — a hairline beneath rather than a fill, so the header
          reads as the top of one surface rather than as a separate bar. */}
      <div className={cn("border-b border-[color:var(--border-subtle)] py-4", PANE_PAD)}>
        {header}
      </div>

      {/* THE ONE SCROLLING REGION. `overscroll-contain` so reaching the end does
          not hand the gesture to the feed behind it — a reader scrolling the
          pane must not lose their place in the list. */}
      <div data-anno-ref="activity-evidence-scroller" className={cn("min-h-0 overflow-y-auto overscroll-contain py-5", PANE_PAD)}>
        <div className={SECTION_GAP}>{children}</div>
      </div>

      {/* PINNED FOOTER. Rendered only when there are actions — an empty bar with
          a border above it is chrome that announces nothing. */}
      {footer && (
        <div
          className={cn(
            "border-t border-[color:var(--border-subtle)] py-3",
            PANE_PAD
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/** ═══ A MAJOR SECTION, WITH ITS OWN RULE ═══
 *
 *  The brief asks for a hairline between major sections and NO header for a
 *  single-item section. Both are handled here rather than at each call site, so
 *  "does this section get a heading" stops being a decision anyone re-makes.
 *
 *  `label` omitted → no heading, and the section is just its content. That is
 *  the single-item case: a heading over one document, above a document that
 *  already has a title line, is the same word twice. */
export function PaneSection({
  label,
  children,
  /** The rule is drawn ABOVE, so the first section never carries one — a rule at
   *  the very top of a scroll region reads as a second header border. */
  divided = false,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  divided?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        divided && "border-t border-[color:var(--border-subtle)] pt-5",
        className
      )}
    >
      {label && (
        <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
          {label}
        </h3>
      )}
      {children}
    </section>
  );
}
