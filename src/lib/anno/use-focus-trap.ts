"use client";

// A FOCUS TRAP FOR THE DRAWER — SC 2.1.1, 2.4.3.
//
// ═══ WHY HAND-ROLLED ═══
//
// anno-00 inventoried this: the repo has no focus-trap utility of its own, and
// the only trap available is the one Radix `Dialog` brings. Using `Dialog` would
// mean fighting its centring, its `z-50` (the drawer must clear the layer at 60),
// and its overlay — for a right-edge panel that is none of those things. Thirty
// lines here is less code than the overrides would be.
//
// ═══ WHAT A TRAP IS ACTUALLY FOR HERE ═══
//
// The drawer is the KEYBOARD EQUIVALENT of the pin layer: every action on a pin
// has to be reachable without a pointer. That only holds if Tab cannot wander
// out of it — a reviewer who tabs off the last button and lands in the prototype
// behind has lost the drawer without being told.
//
// ═══ AND WHAT IT IMPLIES FOR 2.4.11 ═══
//
// With the trap in place, no element underneath can receive focus while the
// drawer is open, so "a focused element hidden behind the drawer" is not
// reachable by construction rather than by luck. That is the honest reading of
// focus-not-obscured for a modal panel, and it is reported that way rather than
// claimed as a tab-through of the prototype.

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.hasAttribute("inert")) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden";
  });
}

/** Traps Tab inside `ref` while `active`, and returns focus to whatever was
 *  focused when it opened.
 *
 *  `returnTo` is captured at ACTIVATION, not at teardown: by teardown the
 *  triggering element may have re-rendered, and `document.activeElement` is by
 *  then something inside the drawer that is about to disappear. */
export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
  /** ═══ WHERE FOCUS GOES ON CLOSE, NAMED EXPLICITLY ═══
   *
   *  Restoring `document.activeElement` alone is not enough, and the anno-05
   *  verification measured why: the drawer can be opened by something that does
   *  not move focus — a programmatic click, a keyboard shortcut, a restored
   *  session — and then the captured element is `<body>`, so Esc closed the
   *  drawer and dropped focus on the floor. Measured: `focusedNow: "BODY"`.
   *
   *  The requirement is that focus returns to THE TOGGLE, so the toggle is
   *  passed in rather than inferred. The captured element still wins when it is
   *  a real control, because a reviewer who opened the drawer from somewhere
   *  else should go back there. */
  fallback?: () => HTMLElement | null
): void {
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    returnTo.current = document.activeElement as HTMLElement | null;

    /* Focus the first thing in the panel. Deferred one frame: on the commit that
       opens the drawer the children may not have laid out, and focusing a
       zero-size element is a no-op that leaves focus outside the trap. */
    const raf = requestAnimationFrame(() => {
      const items = focusableWithin(root);
      (items[0] ?? root).focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusableWithin(root);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;

      /* WRAP, rather than letting the browser walk out. Also handles the case
         where focus is somehow already outside the panel — it is pulled back to
         an edge rather than left loose. */
      if (!root.contains(at)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && at === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKey, { capture: true });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, { capture: true });
      /* Prefer whatever genuinely had focus; fall back to the named control when
         that was nothing (see the note on `fallback`). `<body>` counts as
         nothing — it is what `activeElement` reports when no element is focused,
         not a place a reviewer was. */
      const captured = returnTo.current;
      const usable =
        captured && captured !== document.body && document.body.contains(captured)
          ? captured
          : fallback?.() ?? null;
      if (usable && document.body.contains(usable)) usable.focus();
    };
  }, [ref, active, onEscape, fallback]);
}
