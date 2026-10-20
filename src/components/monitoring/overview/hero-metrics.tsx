"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE HERO METRICS BAR (proto/monitoring-merge)
//
// One raised surface (white, 16px, Elevation 1) cut into five cells by
// hairlines — not cards, and not clickable in v1. Every number is derived
// from the teen array (`monitoringMetrics`). The In-crisis cell is the only
// one that can change colour: past zero it tints `t1-soft`, its numeral and
// dot go `t1`, and the dot pulses (none under reduced motion — the dot is
// still there, so the pulse is never the only signal).
//
// The hairlines are the grid's 1px gaps over `--border-subtle`, not a
// border-left per cell, so the bar can wrap on a narrow canvas (five → three
// → two across, read off `@container/canvas`) and every seam stays one line.
// The last cell spans two whenever it wraps, so no empty slot shows.

import type { MonitoringMetrics } from "@/lib/monitoring/tier-roster";
import { cn } from "@/lib/utils";

function Cell({
  value,
  label,
  detail,
  crisis = false,
}: {
  value: number;
  label: string;
  detail: string;
  crisis?: boolean;
}) {
  const hot = crisis && value > 0;
  return (
    <div
      data-hero-cell={label}
      data-hot={hot ? "true" : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-1 px-5 py-4 transition-colors @max-[880px]/canvas:last:col-span-2",
        hot ? "bg-[var(--t1-soft)]" : "bg-[var(--surface-raised)]"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-display text-[32px] leading-[36px] font-bold tabular-nums",
            hot ? "text-[var(--t1)]" : value === 0 ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
          )}
        >
          {value}
        </span>
        {crisis && (
          <span
            aria-hidden
            data-crisis-dot
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              hot ? "motion-safe:animate-pulse bg-[var(--t1)]" : "bg-[var(--border-default)]"
            )}
          />
        )}
      </div>
      <span className="text-[13px] leading-[16px] font-medium text-[var(--text-secondary)]">{label}</span>
      {/* Tertiary fails on t1-soft (4.39:1), so the hot cell's detail is secondary. */}
      <span className={cn("font-mono text-[11px] leading-[14px]", hot ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]")}>
        {detail}
      </span>
    </div>
  );
}

export function HeroMetrics({ m }: { m: MonitoringMetrics }) {
  return (
    <section
      aria-label="Monitoring summary"
      data-hero-metrics
      className="grid grid-cols-5 gap-px overflow-hidden rounded-[16px] bg-[var(--border-subtle)] shadow-[var(--elevation-1)] @max-[880px]/canvas:grid-cols-3 @max-[520px]/canvas:grid-cols-2"
    >
      {/* TODO-COPY, every label and detail line. */}
      <Cell crisis value={m.inCrisis} label="In crisis" detail="Tier 1 · live" />
      <Cell value={m.highRisk} label="High risk" detail={`Tier 2 · ${m.reviewsDue} review${m.reviewsDue === 1 ? "" : "s"} due`} />
      <Cell value={m.openFlags48h} label="Open risk flags" detail="in last 48h" />
      <Cell value={m.escalations30d} label="Escalations · 30d" detail={`${m.escalationsOpen} open · ${m.escalationsClosed} closed`} />
      <Cell value={m.activeTeens} label="Active teens" detail={`${m.mentors} mentors · ${m.engagedThisWeek} engaged this week`} />
    </section>
  );
}
