"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to a media query and re-renders when it flips.
 *
 * `useSyncExternalStore` rather than `useState` + an effect, matching
 * `use-mounted.ts`: an effect-based version renders once with the wrong answer
 * and then corrects itself, which on a layout query means a visible flash of the
 * other mode. The server snapshot is always `false`, so SSR renders the
 * below-the-breakpoint layout and the client corrects on hydration — the same
 * trade every other client-only read on this page makes.
 *
 * The subscription is per-query and the listener is torn down on unsubscribe, so
 * a component that changes its query string does not leak the old one.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia)
        return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(query).matches
        : false,
    () => false
  );
}
