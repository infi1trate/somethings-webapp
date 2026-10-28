"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TIER 1 QUEUE'S LIVE STATE (Monitoring v4)
//
// ═══ SUPERSEDES `alert-clock.ts` (Monitoring v3) — deleted, not orphaned ═══
// It held ONE clock for ONE alert strip, and the strip's answer (none ·
// acknowledged · joined) as module state. The strips are gone; each queue
// row reads its own escalation's `openedAt` (`t1-queue.ts`), so what is left
// here is what no record holds:
//   a one-second tick, only while a row is listening — the response cell
//   a set of escalations YOU joined this session — Join → Resume
//
// Module state through `useSyncExternalStore`; no setState in an effect.

import { useSyncExternalStore } from "react";

let tick = 0;
const tickListeners = new Set<() => void>();
let timer: number | null = null;
function subscribeTick(l: () => void) {
  tickListeners.add(l);
  if (timer === null && typeof window !== "undefined") {
    tick = Date.now();
    timer = window.setInterval(() => {
      tick = Date.now();
      tickListeners.forEach((x) => x());
    }, 1000);
  }
  return () => {
    tickListeners.delete(l);
    if (tickListeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

const idle = () => () => {};
/** Now, ticking once a second; `fallback` on the server and before the
 *  first tick, so a render is never impure. `active: false` does not
 *  subscribe — the bell ticks only while a Tier 1 is waiting. */
export function useNowTick(fallback: number, active = true): number {
  const t = useSyncExternalStore(active ? subscribeTick : idle, () => (active ? tick : 0), () => 0);
  return t || fallback;
}

/* ═══ JOINED, THIS SESSION ═══ Joining opens the conversation; coming back to
   Monitoring while it is still open, the row offers Resume. Never stored:
   who is in a session is presence, not record. */
let joined: ReadonlySet<string> = new Set();
const joinListeners = new Set<() => void>();
export function markJoined(escalationId: string) {
  if (joined.has(escalationId)) return;
  joined = new Set(joined).add(escalationId);
  joinListeners.forEach((l) => l());
}
export function useJoined(): ReadonlySet<string> {
  return useSyncExternalStore(
    (l) => {
      joinListeners.add(l);
      return () => joinListeners.delete(l);
    },
    () => joined,
    () => joined
  );
}
