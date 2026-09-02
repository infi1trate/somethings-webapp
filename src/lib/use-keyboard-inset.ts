"use client";

// HOW MUCH OF THE VIEWPORT THE ON-SCREEN KEYBOARD IS COVERING, IN PX.
//
// ═══ WHY THIS IS NEEDED AT ALL: TWO VIEWPORTS, ONE OF WHICH LIES ═══
//
// When a phone keyboard opens, the LAYOUT viewport does not change — `100dvh`,
// `position: fixed` and a flex column pinned to the bottom all keep measuring
// against the full screen, including the part now hidden behind the keyboard.
// Only the VISUAL viewport shrinks. So a composer sitting at the bottom of the
// layout viewport is, at that moment, behind the keyboard: the mentor is typing
// into a field they cannot see.
//
// `dvh` does not solve this. It tracks the browser's own retracting chrome (the
// URL bar), not the keyboard — which is exactly why the composer looked correct
// in every measurement taken without one.
//
// ═══ WHAT THE NUMBER IS ═══
//
//   layoutHeight − (visualViewport.height + visualViewport.offsetTop)
//
// `offsetTop` is load-bearing, not defensive: iOS also SCROLLS the visual
// viewport within the layout viewport when the keyboard opens, and without that
// term the inset is overstated by however far it scrolled — which pushes the
// composer up off the top of the keyboard by that much.
//
// Clamped at 0 so a rubber-band overscroll (where the sum exceeds the layout
// height) reads as "no keyboard" rather than as a negative offset.
//
// ═══ WHY `useSyncExternalStore` ═══
//
// It is the house idiom for reading a browser value that changes outside React,
// and it keeps this out of an effect — `react-hooks/set-state-in-effect` forbids
// the setState-in-effect shape this would otherwise take. The server snapshot is
// 0, which is also the right answer for every desktop browser and for the first
// client paint, so nothing hydrates differently.

import { useSyncExternalStore } from "react";

/** No `visualViewport` (older browsers, jsdom, SSR) means no keyboard to report:
 *  subscribing to nothing and snapshotting 0 makes this a no-op rather than a
 *  crash, and the `env(safe-area-inset-bottom)` fallback still applies. */
const noop = () => () => {};

function subscribe(onChange: () => void) {
  const vv = window.visualViewport;
  if (!vv) return noop();
  /* BOTH EVENTS. `resize` fires when the keyboard opens and closes; `scroll`
     fires when the visual viewport slides within the layout viewport, which
     changes `offsetTop` and therefore the answer, without any resize. */
  vv.addEventListener("resize", onChange);
  vv.addEventListener("scroll", onChange);
  return () => {
    vv.removeEventListener("resize", onChange);
    vv.removeEventListener("scroll", onChange);
  };
}

function snapshot(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const covered = window.innerHeight - (vv.height + vv.offsetTop);
  /* ROUNDED, and that is not cosmetic. These values are fractional and jitter by
     sub-pixel amounts during the keyboard's own animation; an unrounded snapshot
     returns a different float on every scroll event, and `useSyncExternalStore`
     compares with `Object.is` — so every frame of the animation would be a
     re-render. Rounding makes the snapshot stable once the keyboard settles. */
  return covered > 0 ? Math.round(covered) : 0;
}

/** Px of the viewport currently hidden behind the on-screen keyboard; 0 when
 *  there is none. Feed it to a bottom inset so a pinned control stays visible. */
export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
