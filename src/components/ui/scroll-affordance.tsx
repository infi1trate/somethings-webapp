"use client";

// ═══════════════════════════════════════════════════════════════════════════
// SCROLL AFFORDANCE — "there is more this way", for a region that scrolls
// horizontally without drawing a scrollbar.
//
// EXTRACTED FROM `user-record-shell.tsx` (Phase 3), where it was written for the
// record's tab strip. Phase 5 needs the identical thing for tables, and a second
// copy is how two affordances that mean the same thing end up looking different.
// The tab strip now imports from here; its behaviour is unchanged.
//
// ═══ WHY A FADE AND NOT A SCROLLBAR ═══
//
// `user-record-shell.tsx` records the measured bug that made scrollbars
// unacceptable in the strip: authoring only `overflow-x` silently made the Y axis
// scrollable too (per the CSS overflow spec, when one axis is `visible` and the
// other is not, the `visible` one computes to `auto`), and a 1px-outside active
// indicator gave it something to report — clientHeight 44, scrollHeight 45, and a
// 15px vertical scrollbar eating the strip.
//
// For TABLES the reasoning is different but lands in the same place: a horizontal
// scrollbar under a table is legitimate chrome, but it only appears on hover on
// macOS and not at all on touch, so it cannot be the affordance. The Definition
// of Done is explicit — "any horizontally scrolling strip has a VISIBLE overflow
// affordance; scroll-with-no-signal fails Nielsen #6."
//
// ═══ NO ARIA, DELIBERATELY ═══
//
// Everything in a scrolling region stays in the DOM and in the tab order at every
// width, so nothing is hidden from assistive tech and a screen-reader or keyboard
// user reaches the last column exactly as they reach the first. The fades address
// sighted pointer users, who are the only ones who cannot otherwise tell that the
// region scrolls — which is also why they must never be the sole carrier of
// anything (WCAG 1.4.1).
//
// design-system-gaps rows 257, 266.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** SSR-safe layout effect — measuring needs the DOM, and React warns when
 *  useLayoutEffect runs on the server. Same shape as
 *  `segmented-control.tsx`'s. */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** How far a fade reaches. 24px is about one character of a label — wide enough
 *  to read as "there is more", narrow enough not to wash out a whole cell. */
export const FADE_W = 24;

export interface Edges {
  start: boolean;
  end: boolean;
}

/** Which edges of a scroller have content hidden past them.
 *
 *  A fade that is always drawn is worse than none: it says "more this way" at the
 *  exact moment there is nothing more. */
export function useEdgeOverflow(
  ref: React.RefObject<HTMLElement | null>,
): Edges {
  const [edges, setEdges] = useState<Edges>({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px of slack: fractional layout widths mean scrollLeft rarely reaches
    // scrollWidth - clientWidth exactly, and a permanently-visible end fade at
    // the true end is the failure this guards against.
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 });
  }, [ref]);

  useIsoLayoutEffect(measure, [measure]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    // The CONTENT's width can change without the viewport changing — a live
    // badge count in a tab, a sort that swaps a short cell for a long one — so
    // the children are observed too, not just the scroller. Same reason
    // `segmented-control.tsx` observes its segments rather than the window.
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    ro?.observe(el);
    Array.from(el.children).forEach((c) => ro?.observe(c));
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
    };
  }, [ref, measure]);

  return edges;
}

/** The two gradient overlays. Render inside a `relative` wrapper that is a
 *  SIBLING of the scroller, never a child of it — a child of an
 *  `overflow-x-auto` element scrolls with the content and adds to its
 *  scrollWidth, so a fade placed inside would drift away from the edge it marks
 *  and make the region wider at the same time. */
export function EdgeFades({
  edges,
  surface,
  className,
  width = FADE_W,
}: {
  edges: Edges;
  /** The colour the gradient resolves to — the surface the region sits ON, so
   *  the fade reads as content passing under the page rather than as a grey
   *  smudge on top of it. A token reference, e.g. `var(--surface-card)`. */
  surface: string;
  /** Vertical inset, e.g. `bottom-0.5` to keep a hairline crisp. */
  className?: string;
  width?: number;
}) {
  return (
    <>
      {/* OPACITY IS AN INLINE VALUE, NOT AN `opacity-0`/`opacity-100` CLASS PAIR.
          
          It is a continuously-derived value — a function of scrollLeft — so it
          belongs in `style` rather than in a class the component swaps between
          two literals. Nothing about the class pair is broken (the record's tab
          strip shipped it in Phase 3 and it worked); this is simply the honest
          home for a computed value, and it removes any dependence on Tailwind
          having generated both halves of a ternary.
          
          A NOTE FOR WHOEVER VERIFIES THIS: the fade cannot be confirmed by
          reading `getComputedStyle().opacity` in the in-app Browser pane. That
          pane reports `document.hidden === true`, where scroll events and
          ResizeObserver never fire and `requestAnimationFrame` never runs — so
          the `transition-opacity` below is frozen at its start value and computed
          opacity reads 0 no matter what this element is told to be. Read
          `el.style.opacity` instead, or verify in a real browser tab.
          design-system-gaps rows 228, 266. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 transition-opacity duration-150",
          className,
        )}
        style={{
          width,
          opacity: edges.start ? 1 : 0,
          backgroundImage: `linear-gradient(to right, ${surface}, transparent)`,
        }}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 transition-opacity duration-150",
          className,
        )}
        style={{
          width,
          opacity: edges.end ? 1 : 0,
          backgroundImage: `linear-gradient(to left, ${surface}, transparent)`,
        }}
      />
    </>
  );
}
