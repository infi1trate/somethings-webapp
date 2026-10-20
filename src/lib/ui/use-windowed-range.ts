// ═══════════════════════════════════════════════════════════════════════════
// A WINDOWED RANGE — a virtualisation stub (Monitoring's Tier 4, proto/monitoring-merge)
//
// Tier 4 is the long group (100–200 teens). Expanded, only the items near the
// viewport render; spacers stand in for the rest, so the scrollbar and the
// page height still say how long it is. Fixed-size items (a list row is
// 52 + 4; a card row is measured once), counted against the page's own
// scroller — the nearest scrolling ancestor.
//
// The range is read through `useSyncExternalStore` from the DOM's scroll
// position: an external store by any other name, and no setState in an
// effect. A stub: no variable heights, no anchoring on resize.

import { useCallback, useSyncExternalStore } from "react";

function scrollParent(el: HTMLElement | null): HTMLElement | Window {
  for (let e = el?.parentElement ?? null; e; e = e.parentElement) {
    const o = getComputedStyle(e).overflowY;
    if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight) return e;
  }
  return window;
}

export function useWindowedRange({
  ref,
  count,
  itemSize,
  overscan = 6,
  enabled,
}: {
  ref: React.RefObject<HTMLElement | null>;
  count: number;
  itemSize: number;
  overscan?: number;
  enabled: boolean;
}): { start: number; end: number } {
  const subscribe = useCallback(
    (l: () => void) => {
      if (!enabled) return () => {};
      const target = scrollParent(ref.current);
      target.addEventListener("scroll", l, { passive: true });
      window.addEventListener("resize", l);
      /* Once after mount, so the first window is measured, not guessed. */
      const raf = requestAnimationFrame(l);
      return () => {
        target.removeEventListener("scroll", l);
        window.removeEventListener("resize", l);
        cancelAnimationFrame(raf);
      };
    },
    [ref, enabled]
  );
  const snapshot = useCallback(() => {
    if (!enabled) return `0:${count}`;
    const el = ref.current;
    if (!el) return `0:${Math.min(count, overscan * 2)}`;
    const target = scrollParent(el);
    const vh = target === window ? window.innerHeight : (target as HTMLElement).clientHeight;
    const top = el.getBoundingClientRect().top - (target === window ? 0 : (target as HTMLElement).getBoundingClientRect().top);
    const first = Math.floor(-top / itemSize);
    const last = Math.ceil((vh - top) / itemSize);
    const start = Math.max(0, Math.min(count, first - overscan));
    const end = Math.max(start, Math.min(count, last + overscan));
    return `${start}:${end}`;
  }, [ref, count, itemSize, overscan, enabled]);
  const range = useSyncExternalStore(subscribe, snapshot, () => `0:${Math.min(count, overscan * 2)}`);
  const [start, end] = range.split(":").map(Number);
  return { start, end };
}
