"use client";

// TRUNCATE AT A WORD BOUNDARY, MEASURED AGAINST THE ACTUAL AVAILABLE WIDTH.
//
// ═══ WHY CSS CANNOT DO THIS ═══
//
// `text-overflow: ellipsis` cuts at the character, so the dev bar's status line
// has been reading things like "Two competing items at once: an open esc…" —
// a word sliced in half, which is the specific complaint this fixes. There is no
// CSS property for "cut at the last whole word that fits": `line-clamp` is
// per-line and this is a single line inside a 40px bar.
//
// So it is measured — but NOT by writing into the live node.
//
// ═══ THE BUG THAT DICTATED THE MEASUREMENT STRATEGY ═══
//
// The first version set `node.textContent` to each candidate and read
// `scrollWidth`. It worked once and then froze: after growing 1280 → 1440 the
// status stayed cut to 8 characters and never re-expanded, measured stuck across
// 1.8 seconds. Mutating the DOM inside a `ResizeObserver` callback re-triggers
// layout on the observed element, Chrome recognises the loop, and it silently
// stops delivering notifications to that observer — so the first truncation was
// permanent and every later resize was invisible.
//
// Measurement now goes through a detached `<canvas>` and `measureText` using the
// node's own computed font. No DOM write, so no loop, so the observer keeps
// firing — and nothing forces layout at all.
//
// ═══ WHY A ResizeObserver AND NOT A RESIZE LISTENER ═══
//
// The available width changes for reasons the window never hears about: the
// scenario select's own width shifts when its value changes, the role group grows
// when a longer persona name is selected, and the whole bar is a flex row where
// any sibling's size changes this element's. `ResizeObserver` sees all of those;
// `window.resize` sees none of them. This codebase has already been caught by a
// single measurement taken at the wrong moment, so the observer is the default.

import { useCallback, useEffect, useRef, useState } from "react";

export type WordTruncation = {
  /** Put on the element that CLIPS — the one with a bounded width. */
  containerRef: (el: HTMLElement | null) => void;
  /** Put on the element that HOLDS THE TEXT, inside the container. */
  measureRef: (el: HTMLElement | null) => void;
  /** What to render: the full string, or a word-boundary prefix plus an ellipsis. */
  display: string;
  /** Whether anything was cut — the caller uses this to decide whether the
   *  full-text affordance is worth offering at all. */
  truncated: boolean;
};

/** One character, appended when text is cut. `…` rather than `...` — a real
 *  ellipsis is one glyph, so it cannot be broken across the cut it marks. */
const ELLIPSIS = "…";

export function useWordTruncate(full: string, enabled = true): WordTruncation {
  const [display, setDisplay] = useState(full);
  const [truncated, setTruncated] = useState(false);
  const containerEl = useRef<HTMLElement | null>(null);
  const measureEl = useRef<HTMLElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  /** One canvas for the life of the hook. Detached — never in the document, so
   *  nothing it does can affect layout. */
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const recompute = useCallback(() => {
    const box = containerEl.current;
    const node = measureEl.current;
    if (!box || !node) return;

    if (!enabled) {
      setDisplay(full);
      setTruncated(false);
      return;
    }

    const available = box.clientWidth;
    if (available === 0) return;

    if (!ctxRef.current) {
      ctxRef.current = document.createElement("canvas").getContext("2d");
    }
    const ctx = ctxRef.current;
    if (!ctx) {
      /* No 2D context (a very old browser, or a test environment). Show the full
         string rather than guessing — an uncut label is a worse layout, not a
         wrong one. */
      setDisplay(full);
      setTruncated(false);
      return;
    }

    /* THE NODE'S OWN FONT, read fresh each time: the bar's type scale is token
       driven and a theme change can alter it without this hook remounting. */
    const cs = getComputedStyle(node);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const width = (t: string) => ctx.measureText(t).width;

    if (width(full) <= available) {
      setDisplay(full);
      setTruncated(false);
      return;
    }

    const words = full.split(/\s+/);
    /* Binary search the largest word count that fits. `lo` is always a known-fit
       (0 words) and `hi` a known-overflow, so the loop cannot run away even if a
       single word is wider than the box — it settles on the ellipsis alone, which
       is honest: nothing fits. */
    let lo = 0;
    let hi = words.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (width(words.slice(0, mid).join(" ") + ELLIPSIS) <= available) lo = mid;
      else hi = mid - 1;
    }

    setDisplay(lo === 0 ? ELLIPSIS : words.slice(0, lo).join(" ") + ELLIPSIS);
    setTruncated(true);
  }, [full, enabled]);

  const containerRef = useCallback(
    (el: HTMLElement | null) => {
      containerEl.current = el;
      roRef.current?.disconnect();
      if (!el) return;
      const ro = new ResizeObserver(() => recompute());
      ro.observe(el);
      roRef.current = ro;
      recompute();
    },
    [recompute]
  );

  const measureRef = useCallback(
    (el: HTMLElement | null) => {
      measureEl.current = el;
      if (el) recompute();
    },
    [recompute]
  );

  /* ═══ NO EFFECT FOR "THE STRING CHANGED" — THE REF ALREADY COVERS IT ═══
   *
   *  A different scenario has a different description at the same width, so this
   *  looked like it needed an effect watching `full`. It does not, and the effect
   *  was also a `react-hooks/set-state-in-effect` violation.
   *
   *  `recompute` is keyed on `full`, and both callback refs are keyed on
   *  `recompute` — so a new string produces new ref callbacks, React detaches and
   *  re-attaches, and the attach path recomputes. The measurement is already
   *  driven by the only two things that can invalidate it: the element changing
   *  and the text changing. */

  useEffect(() => () => roRef.current?.disconnect(), []);

  return { containerRef, measureRef, display, truncated };
}
