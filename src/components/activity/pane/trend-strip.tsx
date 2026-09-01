"use client";

// THE LAST FIVE READINGS — what makes a score mean something.
//
// ═══ A NUMBER IS NOT A FINDING ═══
//
// "Score: 11" tells a supervisor nothing they can act on. Eleven after a
// fourteen is a recovery; eleven after a six is a deterioration; eleven on its
// own is a digit. The strip is the smallest thing that turns one into the other.
//
// NOT A CHART LIBRARY, deliberately: five values, one emphasised, one delta.
// Everything a sparkline would add here — axes, interpolation, hover targets —
// costs more than it explains at five points, and the record surface already has
// a real sparkline for the case where a trajectory is the subject.
//
// ═══ DIRECTION IS PER INSTRUMENT, NOT PER SIGN ═══
//
// PHQ-9 and GAD-7 run higher-is-worse; WHO-5 runs the other way. A strip that
// tinted "down" as good would be actively misleading on one of the three
// instruments this product uses, so the improvement question is asked of the
// instrument (`isImprovement`) rather than answered from the arithmetic.

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { bandFor, isImprovement, type Reading } from "@/lib/activity/pane-fixtures";
import { cn } from "@/lib/utils";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function TrendStrip({
  instrument,
  readings,
  className,
}: {
  instrument: string;
  /** Oldest first. The current reading is the last. */
  readings: Reading[];
  className?: string;
}) {
  if (readings.length === 0) return null;

  const current = readings[readings.length - 1];
  const previous = readings.length > 1 ? readings[readings.length - 2] : null;
  const band = bandFor(instrument, current.score);
  const improved = previous
    ? isImprovement(instrument, previous.score, current.score)
    : null;
  const delta = previous ? current.score - previous.score : null;

  return (
    <div className={cn("min-w-0", className)}>
      {/* ── THE CURRENT VALUE, AND WHAT MOVED ── */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-[22px] font-semibold leading-[26px] tabular-nums text-[var(--text-primary)]">
          {current.score}
        </span>
        {band && (
          <span className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
            {band}
          </span>
        )}
        {delta !== null && (
          // THE DELTA NAMES ITS DIRECTION IN WORDS AND AN ARROW, never in tint
          // alone. "3 lower" rather than "−3": a signed number on a
          // higher-is-worse instrument requires the reader to hold the
          // instrument's polarity in their head to know whether it is good news.
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-medium leading-[18px]",
              improved === null
                ? "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]"
                : improved
                  ? "bg-[var(--status-positive-bg)] text-[var(--status-positive-fg)]"
                  : "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]"
            )}
          >
            {delta === 0 ? (
              <ArrowRight className="size-3 shrink-0" aria-hidden />
            ) : delta > 0 ? (
              <ArrowUp className="size-3 shrink-0" aria-hidden />
            ) : (
              <ArrowDown className="size-3 shrink-0" aria-hidden />
            )}
            {/* TODO-COPY */}
            {delta === 0
              ? "unchanged"
              : `${Math.abs(delta)} ${delta > 0 ? "higher" : "lower"}`}
          </span>
        )}
      </div>

      {/* ── THE FIVE, WITH THE CURRENT ONE EMPHASISED ── */}
      <ol className="mt-2.5 flex flex-wrap items-end gap-1.5">
        {readings.map((r, i) => {
          const isCurrent = i === readings.length - 1;
          return (
            <li
              key={r.at}
              className={cn(
                "flex min-w-[46px] flex-col items-center rounded-[var(--radius-control)] px-2 py-1",
                isCurrent
                  ? "bg-[var(--surface-s2)]"
                  : "bg-[var(--surface-s1)]"
              )}
            >
              <span
                className={cn(
                  "text-[13px] leading-[18px] tabular-nums",
                  isCurrent
                    ? "font-semibold text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]"
                )}
              >
                {r.score}
              </span>
              <span className="text-[11px] leading-[15px] tabular-nums text-[var(--text-muted)]">
                {shortDate(r.at)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
