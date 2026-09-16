"use client";

import { useSyncExternalStore } from "react";

// A REAL CLOCK FOR THE DEVICE MOCK'S STATUS BAR.
//
// ═══ WHY `useSyncExternalStore` AND NOT `useEffect` + `setState` ═══
//
// The current time is, precisely, external mutable state that the component has
// to subscribe to — which is what this hook is for. It also solves the SSR half
// for free: `getServerSnapshot` returns the fallback, so the server and the
// first client render agree and there is no hydration mismatch. The alternative
// (render a placeholder, then `setState` in an effect) is the same thing with an
// extra render and a lint rule against it, and this codebase's `useMounted` is
// already built this way for the same reason.
//
// ═══ IT TICKS ON THE MINUTE BOUNDARY, NOT EVERY 60s ═══
//
// A plain `setInterval(60_000)` fires 60s after MOUNT, so a clock mounted at
// 9:41:59 shows 9:41 until 9:42:59 — up to a minute stale, permanently, and the
// error is invisible because the display has no seconds. Each tick therefore
// schedules the next one to land just after the next minute rolls over.
//
// ═══ NO SECONDS ON PURPOSE ═══
//
// The status bar it feeds shows `h:mm`, so a per-second timer would re-render 59
// times out of 60 to paint an identical string.

/** ═══ THE HARNESS FREEZE ═══
 *
 *  `scripts/responsive/` captures a screenshot matrix — dozens of views across
 *  nine viewports — and diffing those images is the point. A clock that changes
 *  every minute makes every re-run differ from the last, which would quietly
 *  destroy that: the fixtures' relative dates already shift, but only daily.
 *
 *  So a harness may pin the displayed time by setting this global before the app
 *  loads. Nothing in the product sets it, and when it is unset this hook is an
 *  ordinary clock. It is a STRING rather than a timestamp deliberately — it
 *  substitutes for the formatted output, so a frozen run cannot also depend on
 *  the machine's locale or timezone. */
declare global {
  interface Window {
    __SOMETHINGS_FIXED_CLOCK__?: string;
  }
}

/** iOS shows no AM/PM in the status bar, and this is a mock of that status bar.
 *
 *  ═══ PADDING DEPENDS ON THE CYCLE, AND THAT IS NOT COSMETIC ═══
 *
 *  A 12-hour status bar reads "9:41"; a 24-hour one reads "03:41", not "3:41".
 *  `hour: "numeric"` never pads and `hour: "2-digit"` always does, so neither
 *  alone is right for both — the first version of this shipped `numeric` and
 *  rendered "3:41" in de-DE and "2:41" in en-GB, caught by running it under five
 *  locales rather than by reading it. So the resolved cycle picks the option.
 *
 *  ═══ WHY `formatToParts` ═══
 *
 *  To drop the period marker wherever the locale puts it. en-US trails it
 *  ("9:41 AM"), zh-CN leads it ("上午9:41"); removing the `dayPeriod` part
 *  handles both, and the `trim` clears the separator it leaves behind. */
const clockFormat = (() => {
  let cached: Intl.DateTimeFormat | null = null;
  return () => {
    if (cached) return cached;
    // The probe reports what the runtime's locale actually resolved to, which is
    // the only reliable way to know the cycle — it is not derivable from the
    // language tag alone (en-GB is 24-hour, en-US is not).
    const cycle = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).resolvedOptions();
    cached = new Intl.DateTimeFormat(undefined, {
      hour: cycle.hour12 ? "numeric" : "2-digit",
      minute: "2-digit",
    });
    return cached;
  };
})();

function formatClock(at: number): string {
  return clockFormat()
    .formatToParts(new Date(at))
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
}

function subscribe(onChange: () => void): () => void {
  if (typeof window !== "undefined" && window.__SOMETHINGS_FIXED_CLOCK__) {
    // Frozen: nothing to subscribe to, and no timer to leave running.
    return () => {};
  }
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const now = Date.now();
    // +50ms so the timeout lands just AFTER the boundary rather than racing it;
    // firing at :59.999 would format the previous minute and then wait a full
    // minute to correct itself.
    timer = setTimeout(() => {
      onChange();
      schedule();
    }, 60_000 - (now % 60_000) + 50);
  };
  schedule();
  return () => clearTimeout(timer);
}

/** The client snapshot. A fresh string each call, which is fine: React compares
 *  snapshots with `Object.is`, and equal strings are equal — so this only
 *  triggers a render when the minute has actually changed. */
const getSnapshot = () =>
  window.__SOMETHINGS_FIXED_CLOCK__ ?? formatClock(Date.now());

/**
 * The current time as `h:mm` (or `HH:mm` in a 24-hour locale), updated on each
 * minute boundary.
 *
 * `fallback` is the SERVER snapshot only — on the client the real value is read
 * from the first render, so there is no placeholder frame. (An earlier comment
 * here claimed the fallback painted briefly on the client; it does not.)
 *
 * Behaviour is covered by `scripts/responsive/clock.mjs`, which drives virtual
 * time and five locales in a real browser — neither of which a Node test can do.
 */
export function useClock(fallback: string): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}

/** ═══ A TICKING TIMESTAMP, FOR ELAPSED COUNTERS (arch-G, G2) ═══
 *
 *  `useClock` returns a formatted time of day; a live elapsed counter needs the
 *  INSTANT, not a label. Same external store, same minute boundary, so a page
 *  using both cannot show a clock and a counter that disagree about the minute.
 *
 *  MINUTE GRANULARITY IS THE RIGHT GRAIN and it is a deliberate ceiling: the
 *  counter this feeds reads "4m elapsed" against a five-minute SLA, so a second
 *  hand would redraw sixty times per useful change and turn the one saturated
 *  region on the surface into continuous motion — which `prefers-reduced-motion`
 *  exists to suppress and which a supervisor cannot read anyway.
 *
 *  THE SERVER SNAPSHOT IS 0, never `Date.now()`: a server timestamp would differ
 *  from the client's by the request latency and hydrate as a mismatch. Callers
 *  treat 0 as "not mounted yet" and fall back to their own frozen clock. */
const getTickSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;

export function useMinuteTick(): number {
  return useSyncExternalStore(subscribe, getTickSnapshot, () => 0);
}
