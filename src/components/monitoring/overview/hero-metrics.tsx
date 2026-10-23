"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE HERO METRICS BAR (proto/monitoring-merge)
//
// One raised surface (white, 20px, the soft elevation — Monitoring v2) cut into five cells by
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

/* ═══ A CELL THAT CANNOT REFLOW (Monitoring v3, §2) ═══ Fixed height, and
   two text lines that never wrap: the label (the SAME five on both tabs, so
   no cell changes its label's length between them) and the detail — only
   numbers and details change. The In-crisis dot sits BEFORE the numeral. */
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
        "flex h-[120px] min-w-0 flex-col justify-center gap-1 overflow-hidden px-5 py-4 transition-colors @max-[880px]/canvas:last:col-span-2",
        hot ? "bg-[var(--t1-soft)]" : "bg-[var(--surface-raised)]"
      )}
    >
      <div className="flex items-center gap-2">
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
        <span
          data-hero-value
          className={cn(
            "font-display text-[32px] leading-[36px] font-bold tabular-nums",
            hot ? "text-[var(--t1)]" : value === 0 ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
          )}
        >
          {value}
        </span>
      </div>
      <span data-hero-label className="truncate whitespace-nowrap text-[13px] leading-[16px] font-medium text-[var(--text-secondary)]">{label}</span>
      {/* Tertiary fails on t1-soft (4.39:1), so the hot cell's detail is secondary. */}
      <span data-hero-detail className={cn("truncate whitespace-nowrap font-mono text-[11px] leading-[14px]", hot ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]")}>
        {detail}
      </span>
    </div>
  );
}

/** ═══ ON THE EVENTS TAB, THE RANGE'S NUMBERS (Monitoring v2) ═══ The flags
 *  and escalations cells count the selected range instead of the fixed 48h /
 *  30d; the live cells (in crisis, high risk, active teens) stay live. */
export interface HeroRange {
  label: string;
  flags: number;
  surge: number;
  escalations: number;
  open: number;
  closed: number;
}

export function HeroMetrics({ m, range, className }: { m: MonitoringMetrics; range?: HeroRange; className?: string }) {
  return (
    <section
      aria-label="Monitoring summary"
      data-hero-metrics
      className={cn(className, "grid grid-cols-5 gap-px overflow-hidden rounded-[20px] bg-[var(--border-subtle)] shadow-[var(--el-soft)] @max-[880px]/canvas:grid-cols-3 @max-[520px]/canvas:grid-cols-2")}
    >
      {/* TODO-COPY, every label and detail line. */}
      <Cell crisis value={m.inCrisis} label="In crisis" detail="Tier 1 · live" />
      <Cell value={m.highRisk} label="High risk" detail={`Tier 2 · ${m.reviewsDue} review${m.reviewsDue === 1 ? "" : "s"} due`} />
      {/* The SAME labels on both tabs; the range lives in the detail. */}
      {range ? (
        <>
          <Cell value={range.flags} label="Risk flags" detail={`${range.label} · ${range.surge} surge`} />
          <Cell value={range.escalations} label="Escalations" detail={`${range.label} · ${range.open} open · ${range.closed} closed`} />
        </>
      ) : (
        <>
          <Cell value={m.openFlags48h} label="Risk flags" detail="open · last 48h" />
          <Cell value={m.escalations30d} label="Escalations" detail={`30d · ${m.escalationsOpen} open · ${m.escalationsClosed} closed`} />
        </>
      )}
      <Cell value={m.activeTeens} label="Active teens" detail={`${m.mentors} mentors · ${m.engagedThisWeek} engaged`} />
    </section>
  );
}
