// WHEN TO RE-RESOLVE.
//
// ═══ NOT EVERY FRAME ═══
//
// The naive version of this is a `requestAnimationFrame` loop calling
// `getBoundingClientRect()` on every pin. It is always correct and it is never
// acceptable: fifty pins × a forced layout each × 60fps is a permanent stall on
// a page whose own lists are already virtualized to stay smooth. So repositioning
// is EVENT-DRIVEN, and this module owns the events.
//
// Four triggers, from the brief:
//
//   • window resize          — rects change wholesale
//   • scroll of any registered scroll container — anno-00 found every `/app/*`
//     route scrolls an inner div while the document does not move, so listening
//     on `window` alone would miss almost every scroll in this app
//   • route change           — a different DOM entirely
//   • DOM mutation inside a tagged region — the case that makes tier 2 and tier 3
//     happen at all, and the only one with no browser event of its own
//
// ═══ TWO DIFFERENT DEBOUNCES, ON PURPOSE ═══
//
// Scroll and resize are COALESCED TO AN ANIMATION FRAME, not debounced on a
// timer: a pin that lags its element while the reader drags a scrollbar reads as
// drift, which is the exact failure this phase exists to rule out. One rAF is the
// shortest delay that still avoids re-entrant layout.
//
// Mutations ARE debounced on a timer, because a React commit fires many records
// for one logical change and re-resolving per record would be pure waste. 120ms
// is long enough to swallow a commit and its follow-up effects, short enough that
// an expanding card (300ms, `care-review-card`) repositions while it is still
// moving rather than snapping at the end.
//
// ANIMATED REGIONS ARE WHY THE MUTATION OBSERVER IS NOT ENOUGH ON ITS OWN.
// anno-00 catalogued six transitions whose geometry settles up to 700ms after the
// change, and a height transition emits no mutation records while it runs. The
// `settleAfter` sweep is what covers them.

export type RepositionReason =
  | "resize"
  | "scroll"
  | "route"
  | "mutation"
  | "settle"
  | "manual";

export type ObserverHandle = { disconnect(): void };

const ANNO_REF_ATTR = "data-anno-ref";

/** Frames after a settling change to re-check. Covers the 300ms in-card
 *  expansion and the 700ms onboarding entrances without holding a timer open
 *  indefinitely. */
const SETTLE_STEPS_MS = [120, 320, 720];

const MUTATION_DEBOUNCE_MS = 120;

export type ObserveOptions = {
  /** Selectors of scroll containers to listen on, from anchors'
   *  `scrollContainer`. Re-queried on every call because the containers are
   *  themselves remounted by route changes. */
  scrollContainers: string[];
  onReposition: (reason: RepositionReason) => void;
};

/** Wire every trigger. Returns one handle that removes all of them — there is no
 *  partial teardown, because a listener that outlives its overlay repositions
 *  pins that no longer exist. */
export function observeReposition(opts: ObserveOptions): ObserverHandle {
  const { onReposition } = opts;
  let frame = 0;
  let mutationTimer: number | undefined;
  let settleTimers: number[] = [];
  let disposed = false;

  /** Coalesce to one animation frame. Repeated calls inside a frame collapse. */
  const onFrame = (reason: RepositionReason) => () => {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!disposed) onReposition(reason);
    });
  };

  const handleScroll = onFrame("scroll");
  const handleResize = onFrame("resize");

  window.addEventListener("resize", handleResize, { passive: true });
  /* CAPTURE PHASE ON `window` catches scroll from EVERY container in one
     listener — scroll events do not bubble, but they do capture. That is the
     difference between one listener and one per scroller, and it means a
     container that mounts later is covered with no re-registration. The
     per-container listeners below remain for containers that stop propagation. */
  window.addEventListener("scroll", handleScroll, { passive: true, capture: true });

  const bound: Element[] = [];
  for (const sel of opts.scrollContainers) {
    if (!sel) continue;
    try {
      const el = document.querySelector(sel);
      if (el && !bound.includes(el)) {
        el.addEventListener("scroll", handleScroll, { passive: true });
        bound.push(el);
      }
    } catch {
      /* a stale selector from an older record — not a reason to fail setup */
    }
  }

  /* ═══ MUTATIONS, SCOPED TO TAGGED REGIONS ═══
     Observing `document.body` with `subtree: true` fires on every keystroke in
     the composer and every clock tick in a relative timestamp. Scoping to tagged
     regions is both cheaper and more accurate: a change that cannot affect a
     tagged region cannot move a pin. */
  const mo = new MutationObserver(() => {
    if (disposed) return;
    window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(() => {
      if (!disposed) onReposition("mutation");
    }, MUTATION_DEBOUNCE_MS);
  });

  for (const region of document.querySelectorAll(`[${ANNO_REF_ATTR}]`)) {
    mo.observe(region, { childList: true, subtree: true, attributes: false });
  }

  return {
    disconnect() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(mutationTimer);
      settleTimers.forEach((t) => window.clearTimeout(t));
      settleTimers = [];
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, { capture: true });
      bound.forEach((el) => el.removeEventListener("scroll", handleScroll));
      mo.disconnect();
    },
  };
}

/** Re-check a few times after a change whose geometry settles late.
 *
 *  Call after a route change, a scenario switch, or anything that starts a
 *  transition. anno-00 measured six animated regions in this codebase settling
 *  between 260ms and 700ms, and a single post-change measurement lands
 *  mid-transition — this repo has already shipped that bug once, reading a
 *  column at 380px while it was on its way to 420px. */
export function settleAfter(onReposition: (reason: RepositionReason) => void): () => void {
  const timers = SETTLE_STEPS_MS.map((ms) =>
    window.setTimeout(() => onReposition("settle"), ms)
  );
  return () => timers.forEach((t) => window.clearTimeout(t));
}
