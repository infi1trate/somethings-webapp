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

/* ═══ THE ANSWER IS A STATE, NOT A DISMISSAL (Monitoring v3, §6) ═══ It was
   one boolean that ended the strip. Three answers now, each with its own
   rendering: none (the strip, the clock running), acknowledged (the strip
   STAYS, the clock STOPS, "Acknowledged by you"), joined (a slim bar, the
   lane says "You in session"). And `heldBy`: another supervisor holds the
   alert, so this one's actions are Observe / Hand to me. */
export type AlertAnswer = "none" | "acknowledged" | "joined";

let startedAt: number | null = null;
let answer: AlertAnswer = "none";
let answeredAt: number | null = null;
let heldBy: string | null = null;
let seedKey = "";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called with whether an alert is live: starts the clock on the way in,
 *  clears it on the way out. `seed` is a scenario's starting state; a new
 *  seed restarts the alert in it. A module write, so a page may call it from
 *  an effect. */
export function syncTierAlert(live: boolean, seed?: { answer: AlertAnswer; heldBy?: string }) {
  const key = seed ? `${seed.answer}:${seed.heldBy ?? ""}` : "";
  if (!live) {
    if (startedAt !== null || answer !== "none" || heldBy !== null) {
      startedAt = null;
      answer = "none";
      answeredAt = null;
      heldBy = null;
      seedKey = "";
      emit();
    }
  } else if (startedAt === null || key !== seedKey) {
    const at = Date.now();
    startedAt = at;
    answer = seed?.answer ?? "none";
    /* A seeded acknowledgement stopped the clock a few seconds in. */
    answeredAt = answer === "none" ? null : at + 18_000;
    heldBy = seed?.heldBy ?? null;
    seedKey = key;
    emit();
  }
}

/** Acknowledged (the strip stays, the clock stops) or joined (a slim bar). */
export function answerAlert(kind: Exclude<AlertAnswer, "none"> = "acknowledged"): void {
  if (answer === kind) return;
  answer = kind;
  answeredAt ??= Date.now();
  emit();
}

/** Hand to me: the alert is this supervisor's now. */
export function takeAlert(): void {
  if (heldBy === null) return;
  heldBy = null;
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

export function useAlertState(): { startedAt: number | null; answered: boolean; answer: AlertAnswer; answeredAt: number | null; heldBy: string | null } {
  const s = useSyncExternalStore(subscribe, () => startedAt, () => null);
  const a = useSyncExternalStore(subscribe, () => answer, () => "none" as AlertAnswer);
  const at = useSyncExternalStore(subscribe, () => answeredAt, () => null);
  const h = useSyncExternalStore(subscribe, () => heldBy, () => null);
  return { startedAt: s, answered: a !== "none", answer: a, answeredAt: at, heldBy: h };
}

/** Seconds left in the response window, ticking — frozen once answered. */
export function useResponseSecondsLeft(): number {
  const { startedAt: s, answeredAt } = useAlertState();
  const now = useSyncExternalStore(subscribeTick, () => tick, () => 0);
  if (s === null) return T1_RESPONSE_SECONDS;
  const at = answeredAt ?? Math.max(now, s);
  return Math.max(0, T1_RESPONSE_SECONDS - Math.floor((at - s) / 1000));
}

/** m:ss. */
export const responseClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
