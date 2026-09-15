"use client";

// ═══ THE NOW BAND ═══
//
// Conversation STATE CHANGES, never messages, and only items that stop being
// actionable if you see them an hour later. A response-time breach seen at minute
// four is a save; the same breach at 10pm is a coaching note.
//
// ═══ ACCESSIBILITY, WHICH MOST LIVE FEEDS GET WRONG ═══
//
//  · `aria-live="off"` on the band, with a manual "N new" affordance. A
//    high-frequency live region announces continuously and makes the page
//    unusable with a screen reader — the band would be the loudest thing on a
//    safety surface and the least important.
//  · `aria-live="assertive"` is reserved for escalation arrival, and it lives on
//    the escalation region, not here.
//  · Status messages never move focus (WCAG 4.1.3): the "N new" control is a
//    button the reader chooses to press.
//  · A pause control, because content that auto-updates needs one (WCAG 2.2.2).
//  · No auto-scroll, no continuous motion. A new item gets ONE quiet entrance,
//    suppressed entirely under `prefers-reduced-motion`.

import { useState } from "react";
import { Pause, Play, Radio, WifiOff } from "lucide-react";
import { elapsedLabel } from "@/components/tasks/strips";
import { LIVE_BAND_MAX } from "@/lib/monitoring/constants";
import { LIVE_STATE_LINE, bandItems, type LiveBandState, type LiveItem } from "@/lib/monitoring/live";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function NowBand({
  state,
  items,
  now,
  paused,
  onTogglePause,
}: {
  state: LiveBandState;
  items: LiveItem[];
  now: number;
  paused: boolean;
  onTogglePause: () => void;
}) {
  /** ═══ WHAT THE READER HAS SEEN ═══
   *  The band renders the items it had when the reader last acknowledged. New
   *  arrivals are counted, not injected — so nothing on screen moves under a
   *  reader mid-review, and the count is the affordance a screen-reader user
   *  presses when they are ready. */
  const [seenAt, setSeenAt] = useState(now);
  if (state === "off") return null;

  const visible = items.filter((i) => i.at <= seenAt);
  const fresh = items.filter((i) => i.at > seenAt).length;
  const { shown, overflow } = bandItems(visible);

  const degraded = state === "degraded";
  return (
    <section
      data-slot="now-band"
      data-live-state={state}
      /* OFF. Deliberately, and the comment at the top says why. */
      aria-live="off"
      /* NEEDS-COPY-NICOLE */
      aria-label="Now"
      className={cn(
        "mt-4 shrink-0 rounded-[var(--radius-elevated)] border px-4 py-2.5",
        degraded
          ? "border-[color:var(--border-contour)] bg-[var(--surface-s1)]"
          : "border-[color:var(--border-subtle)] bg-[var(--surface-card)]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
          {degraded ? <WifiOff className="size-3.5" aria-hidden /> : <Radio className="size-3.5" aria-hidden />}
          {/* NEEDS-COPY-NICOLE */}
          Now
        </p>
        <span className="flex items-center gap-2">
          {fresh > 0 && (
            <button
              type="button"
              onClick={() => setSeenAt(Date.now())}
              data-action="show-new"
              className={cn(
                "inline-flex min-h-8 items-center rounded-full border border-[color:var(--border-contour)] px-2.5 text-[12px] font-semibold text-[var(--text-primary)]",
                "hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {/* NEEDS-COPY-NICOLE. The manual affordance that replaces a live
                  region — a reader asks for the update. */}
              {fresh} new
            </button>
          )}
          <button
            type="button"
            onClick={onTogglePause}
            data-action="toggle-pause"
            aria-pressed={paused}
            className={cn(
              "inline-flex min-h-8 items-center gap-1 rounded-full border border-[color:var(--border-subtle)] px-2.5 text-[12px] text-[var(--text-secondary)]",
              "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
            {/* NEEDS-COPY-NICOLE */}
            {paused ? "Resume" : "Pause"}
          </button>
        </span>
      </div>

      {state !== "live" ? (
        /* ═══ THE THREE SILENCES, EACH NAMED ═══
           Dormant, degraded and quiet look identical if the band says nothing,
           and on a safety surface the difference between "nothing is happening"
           and "I cannot tell you what is happening" is the whole point. */
        <p className="mt-1 text-[12.5px] leading-[18px] text-[var(--text-secondary)]">
          {LIVE_STATE_LINE[state]}
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {shown.map((i) => (
            <li
              key={i.id}
              data-live-kind={i.kind}
              /* ONE QUIET ENTRANCE, AND NONE AT ALL UNDER REDUCED MOTION. No
                 auto-scroll and nothing continuous: the band never animates
                 again after an item arrives. */
              className={cn(
                "flex items-baseline gap-2 text-[13px] leading-[18px] text-[var(--text-primary)]",
                "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
                "motion-reduce:animate-none"
              )}
            >
              <span className="min-w-0 flex-1 truncate">{i.line}</span>
              <span
                className="shrink-0 text-[11.5px] tabular-nums text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {elapsedLabel(i.at, now)} ago
              </span>
            </li>
          ))}
          {overflow > 0 && (
            <li className="text-[12px] leading-[17px] text-[var(--text-secondary)]">
              {/* THE CAP COLLAPSES TO A COUNT rather than scrolling — a band that
                  scrolls is the second list this design refused to build. */}
              {overflow} more not shown (band holds {LIVE_BAND_MAX})
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
