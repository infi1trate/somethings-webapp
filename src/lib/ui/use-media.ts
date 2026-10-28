"use client";

import { useSyncExternalStore } from "react";

/** Does `query` match? Subscribed, so a resize re-renders; `false` on the
 *  server and on the hydrating frame, so the first paint never disagrees
 *  with the markup. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (on) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
