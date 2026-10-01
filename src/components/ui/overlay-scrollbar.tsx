"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A CUSTOM OVERLAY SCROLLBAR (Care Reviews scrollbar pass, third attempt)
//
// ═══ WHY THIS EXISTS — THE CAUSE, MEASURED ═══
//
// Two passes tried to make the native bar behave and both shipped a gutter.
// The cause was the previous attempt itself: `.scroll-slim` styled
// `::-webkit-scrollbar { width: 24px }`, and styling that pseudo-element opts
// Chromium and WebKit into a CUSTOM CLASSIC scrollbar, which always takes
// layout width — even on macOS set to overlay. Measured on this machine's real
// Chrome 152: an unstyled `overflow: scroll` box reserves 15px, the same box
// with `.scroll-slim` reserves 24px. So the utility widened the gutter on
// classic platforms and CREATED one on overlay ones.
//
// IT WAS INVISIBLE TO EVERY CHECK BECAUSE OF THE MEASURING TOOL. Playwright
// launches Chromium with `--hide-scrollbars`, so `offsetWidth - clientWidth`
// was 0 in every probe across three passes. With the flag removed the list
// reserves 24px, the header stops 25px short, and the trailing age sits 49px
// from the edge against the marker's 25 — the asymmetry that was reported.
//
// AND CSS CANNOT FIX IT ALONE. On Windows, and on macOS with "always show
// scroll bars", a native bar takes layout space however it is styled, and
// `overflow: overlay` is deprecated to `auto`. So the native bar is hidden and
// this draws one.
//
// ═══ WHAT STAYS NATIVE ═══
//
// SCROLLING. Nothing about the scroll container changes except that its own bar
// is not painted: wheel, trackpad, touch, keyboard (arrow keys, Page Up/Down,
// Space, Home/End) and scroll anchoring are all the browser's. This draws a
// thumb and lets you drag it; it does not implement scrolling.
//
// ═══ THE PRICE, STATED ═══
//
// Visibility and drag are now code this repo maintains — the tradeoff the pack
// named. In return the gutter is 0 on every platform BY CONSTRUCTION, because
// there is no native bar left to reserve one.

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useScrollActivity } from "@/lib/ui/use-scroll-activity";

/** The visual mark's width and the grab zone around it. SC 2.5.8 wants 24x24
 *  CSS px of hit area; the mark itself stays thin. Kept as constants so the
 *  probe and the component read the same numbers. */
export const THUMB_HIT_PX = 24;
export const THUMB_MARK_PX = 6;
/** The thumb never gets shorter than this, so the hit area's height clears 24
 *  as well as its width — a long list would otherwise produce a 6px-tall thumb
 *  that is easy to see and impossible to grab. */
export const THUMB_MIN_PX = 32;
/** Inset from the scroller's top and bottom edges, so the mark does not run into
 *  the card's rounded corners. */
const INSET_PX = 4;

/**
 *  RENDER IT AS THE FIRST CHILD OF THE SCROLLER. It is a zero-height `sticky`
 *  rail pinned to the scroller's top, so it stays in view without being part of
 *  the scrolled content's flow — the thumb inside it is positioned against the
 *  VIEWPORT of the scroller rather than against the content, which is what makes
 *  it overlay rather than scroll away.
 *
 *  STICKY RATHER THAN A TRANSFORM. An absolutely-positioned thumb translated by
 *  `scrollTop` moves WITH the content for a frame before the scroll handler
 *  corrects it, which reads as jitter on a fast flick. A sticky rail is held in
 *  place by the compositor; only the thumb's offset within it updates, and that
 *  update is the one the eye expects to lag.
 */
export function OverlayScrollbar({
  scrollerRef,
}: {
  scrollerRef: React.RefObject<HTMLElement | null>;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ startY: number; startTop: number } | null>(null);

  /* §1's "shows on scroll" — the existing attribute writer, reused rather than
     duplicated. Hover, focus and drag are CSS and the `data-dragging` flag. */
  useScrollActivity(scrollerRef);

  /** ═══ ONE LAYOUT PASS, WRITTEN TO THE DOM, NEVER TO REACT STATE ═══
   *  A scroll fires many times a frame on a trackpad. Putting the thumb's
   *  position in `useState` would re-render the list — a 123-row virtualiser —
   *  on every one of them, and `set-state-in-effect` is an error in this repo
   *  regardless. So geometry is computed and written as inline style. */
  /** ═══ THE SCROLLER IS THE RAIL'S PARENT, NOT `scrollerRef.current` ═══
   *  MEASURED, the first build never sized the thumb: it rendered 24x0, so there
   *  was nothing to grab and drag did nothing. The cause is React's commit
   *  order. This rail is a CHILD of the scroller, and a child's layout effect
   *  runs BEFORE its parent's ref is attached — so on mount `scrollerRef.current`
   *  was still null, the setup returned early, and no listener was ever
   *  attached. The scroll-activity hook kept working because it is a passive
   *  `useEffect`, which runs after every ref is set — which is exactly why the
   *  bug was half-visible rather than total.
   *  `parentElement` IS AVAILABLE IN THE CHILD'S OWN EFFECT, because the rail's
   *  own DOM node is attached first. "Render me as the scroller's first child" is
   *  already this component's contract, so the parent is the scroller by
   *  definition; the ref stays as the fallback and for the activity hook. */
  const scrollerOf = useCallback(
    () => (railRef.current?.parentElement as HTMLElement | null) ?? scrollerRef.current,
    [scrollerRef]
  );

  const layout = useCallback(() => {
    const sc = scrollerOf();
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!sc || !rail || !thumb) return;

    const view = sc.clientHeight;
    const total = sc.scrollHeight;
    /* NOTHING TO SCROLL, NOTHING TO DRAW. A thumb on a list that fits would
       claim a scroll that is not there. */
    if (total <= view + 1) {
      thumb.style.display = "none";
      return;
    }
    thumb.style.display = "";

    /* THE RAIL REACHES THE PADDING EDGE, not the content edge. The pane's
       scroller is `px-5`, so a rail sized to its content box would sit 20px
       inside the card — the same alley this component exists to remove. */
    const cs = getComputedStyle(sc);
    rail.style.marginRight = `-${cs.paddingRight}`;
    rail.style.marginLeft = `-${cs.paddingLeft}`;
    rail.style.marginTop = `-${cs.paddingTop}`;

    const track = view - INSET_PX * 2;
    const h = Math.max(THUMB_MIN_PX, Math.round((view / total) * track));
    const range = track - h;
    const ratio = sc.scrollTop / (total - view);
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translateY(${INSET_PX + Math.round(ratio * range)}px)`;
  }, [scrollerOf]);

  useLayoutEffect(() => {
    const sc = scrollerOf();
    if (!sc) return;
    layout();
    sc.addEventListener("scroll", layout, { passive: true });

    /* THE CONTENT CHANGES HEIGHT WITHOUT A SCROLL — a virtualiser resizing its
       spacer, a tab switch, rows arriving. Observing the scroller covers its
       own box; observing its children covers `scrollHeight`, which no event
       announces. */
    const ro = new ResizeObserver(layout);
    ro.observe(sc);
    for (const child of Array.from(sc.children)) ro.observe(child);
    /* Children are replaced on a tab switch, and a ResizeObserver on a removed
       node observes nothing, so new children are picked up as they arrive. */
    const mo = new MutationObserver(() => {
      for (const child of Array.from(sc.children)) ro.observe(child);
      layout();
    });
    mo.observe(sc, { childList: true });

    return () => {
      sc.removeEventListener("scroll", layout);
      ro.disconnect();
      mo.disconnect();
    };
  }, [scrollerOf, layout]);

  /* ═══ DRAG — THE ONE BEHAVIOUR THE NATIVE BAR GAVE FOR FREE ═══
     Pointer capture so a drag that leaves the 24px column keeps tracking, which
     is how a native thumb behaves and what a reader's hand expects. */
  useEffect(() => {
    const thumb = thumbRef.current;
    const sc = scrollerOf();
    if (!thumb || !sc) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      thumb.setPointerCapture(e.pointerId);
      drag.current = { startY: e.clientY, startTop: sc.scrollTop };
      sc.setAttribute("data-dragging", "true");
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      const view = sc.clientHeight;
      const total = sc.scrollHeight;
      const track = view - INSET_PX * 2;
      const h = Math.max(THUMB_MIN_PX, Math.round((view / total) * track));
      const range = Math.max(1, track - h);
      /* Pixels of thumb travel to pixels of content: the same ratio a native
         bar uses, so a drag of the full track scrolls the full list. */
      const dy = e.clientY - drag.current.startY;
      sc.scrollTop = drag.current.startTop + (dy * (total - view)) / range;
    };
    const onUp = (e: PointerEvent) => {
      if (!drag.current) return;
      drag.current = null;
      if (thumb.hasPointerCapture(e.pointerId)) thumb.releasePointerCapture(e.pointerId);
      sc.removeAttribute("data-dragging");
    };

    thumb.addEventListener("pointerdown", onDown);
    thumb.addEventListener("pointermove", onMove);
    thumb.addEventListener("pointerup", onUp);
    thumb.addEventListener("pointercancel", onUp);
    return () => {
      thumb.removeEventListener("pointerdown", onDown);
      thumb.removeEventListener("pointermove", onMove);
      thumb.removeEventListener("pointerup", onUp);
      thumb.removeEventListener("pointercancel", onUp);
    };
  }, [scrollerOf]);

  return (
    /* `aria-hidden` ON THE WHOLE RAIL. A native scrollbar is not in the
       accessibility tree as a control either; assistive tech scrolls the
       region, which stays focusable and named at its call site. */
    <div ref={railRef} aria-hidden data-overlay-rail className="ovl-rail">
      <div ref={thumbRef} data-overlay-thumb className="ovl-thumb">
        <div className="ovl-mark" />
      </div>
    </div>
  );
}
