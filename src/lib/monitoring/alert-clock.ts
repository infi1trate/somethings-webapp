// ═══════════════════════════════════════════════════════════════════════════
// THE TIER 1 ALERT'S ONE CLOCK (proto/monitoring)
//
// The alert strip and the Tier 1 lane both show the response window, and
// they disagreed (the strip counted from a hard-coded 42, the lane from 60).
// One start instant now, set when a Tier 1 alert goes live and cleared when
// it ends (`syncTierAlert`, called by the page from the scenario); both read it. It also remembers whether THIS alert was
// joined or acknowledged, which is what ends the strip ("persists until
// joined or acknowledged") — so lowering the mitigation layer back to Alert
// does not raise a strip the supervisor already answered.
//
// Module state through `useSyncExternalStore`; no setState in an effect.

import { useSyncExternalStore } from "react";
import { T1_RESPONSE_SECONDS } from "@/lib/monitoring/tiers";

let startedAt: number | null = null;
let answered = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called with whether an alert is live: starts the clock on the way in,
 *  clears it (and the answered mark) on the way out. A module write, so a
 *  page may call it from an effect. */
export function syncTierAlert(live: boolean) {
  if (!live) {
    if (startedAt !== null || answered) {
      startedAt = null;
      answered = false;
      emit();
    }
  } else if (startedAt === null) {
    startedAt = Date.now();
    answered = false;
    emit();
  }
}

/** Joined or acknowledged: the strip is done for this alert. */
export function answerAlert(): void {
  if (answered) return;
  answered = true;
  emit();
}

/* A one-second tick, only while someone is listening. */
let tick = Date.now();
const tickListeners = new Set<() => void>();
let timer: number | null = null;
function subscribeTick(l: () => void) {
  tickListeners.add(l);
  if (timer === null && typeof window !== "undefined") {
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

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAlertState(): { startedAt: number | null; answered: boolean } {
  const s = useSyncExternalStore(subscribe, () => startedAt, () => null);
  const a = useSyncExternalStore(subscribe, () => answered, () => false);
  return { startedAt: s, answered: a };
}

/** Seconds left in the response window, ticking. */
export function useResponseSecondsLeft(): number {
  const { startedAt: s } = useAlertState();
  const now = useSyncExternalStore(subscribeTick, () => tick, () => 0);
  if (s === null) return T1_RESPONSE_SECONDS;
  return Math.max(0, T1_RESPONSE_SECONDS - Math.floor((Math.max(now, s) - s) / 1000));
}

/** m:ss. */
export const responseClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
