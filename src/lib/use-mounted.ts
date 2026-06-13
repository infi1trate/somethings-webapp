"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns true only after the component has mounted on the client. Used to gate
 * UI that reads from localStorage-backed state so server and first client render
 * match (avoids hydration mismatches). Uses useSyncExternalStore so there's no
 * setState-in-effect.
 */
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false // server snapshot
  );
}
