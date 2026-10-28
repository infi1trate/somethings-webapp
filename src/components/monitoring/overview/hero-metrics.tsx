"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE HERO METRICS BAR (proto/monitoring-merge)
//
// One raised surface (white, 20px, the soft elevation — Monitoring v2) cut
// into five cells by hairlines. Every number is derived from the teen array
// (`monitoringMetrics`).
//
// ═══ SUPERSEDED (Monitoring v4, §1 · §3) ═══ "Not clickable in v1": a cell
// with a target is a BUTTON now — In crisis goes to the Tier 1 queue and
// focuses its first row. The In-crisis cell no longer tints `t1-soft` (the
// only red fill on the page is the Tier 1 queue's container, and Join): its
// numeral is `t1` past zero, the dot before it pulses, and at zero the dot
// is gone. Its detail reads the queue: "6 awaiting · oldest 14m overdue".
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
  onActivate,
  target,
}: {
  value: number;
  label: string;
  detail: string;
  crisis?: boolean;
  /** A cell with somewhere to go is a button. */
  onActivate?: () => void;
  /** Where it goes, for its accessible name. TODO-COPY. */
  target?: string;
}) {
  const hot = crisis && value > 0;
  const Tag = onActivate ? "button" : "div";
  return (
    <Tag
      {...(onActivate ? { type: "button" as const, onClick: onActivate, "aria-label": `${value} ${label}, ${detail}${target ? ` — ${target}` : ""}` } : {})}
      data-hero-cell={label}
      data-hot={hot ? "true" : undefined}
      data-hero-button={onActivate ? "" : undefined}
      className={cn(
        "flex h-[120px] min-w-0 flex-col justify-center gap-1 overflow-hidden bg-[var(--surface-raised)] px-5 py-4 text-left transition-[transform,box-shadow] duration-150 @max-[880px]/canvas:last:col-span-2",
        /* Hover lifts 1px with the soft shadow; focus is the token ring. */
        onActivate && "relative cursor-pointer hover:z-[1] hover:-translate-y-px hover:shadow-[var(--el-soft)] focus-visible:z-[1] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus-ring)] motion-reduce:hover:translate-y-0"
      )}
    >
      <div className="flex items-center gap-2">
        {/* The dot BEFORE the numeral, only while there is a crisis. */}
        {hot && <span aria-hidden data-crisis-dot className="size-2.5 shrink-0 rounded-full bg-[var(--t1)] motion-safe:animate-pulse" />}
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
      {/* The In-crisis detail is a SENTENCE about the queue ("4 awaiting ·
          oldest 14m overdue") and set in the sans at 12 — the mono's width
          cut it at "over…" in a 236px cell (measured). The other details
          stay mono figures. */}
      <span data-hero-detail className={cn("truncate whitespace-nowrap leading-[14px]", hot ? "text-[12px] tabular-nums text-[var(--text-secondary)]" : "font-mono text-[11px] text-[var(--text-tertiary)]")}>
        {detail}
      </span>
    </Tag>
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

export function HeroMetrics({ m, range, className, crisisDetail, onCrisis }: { m: MonitoringMetrics; range?: HeroRange; className?: string; crisisDetail?: string | null; onCrisis?: () => void }) {
  return (
    <section
      aria-label="Monitoring summary"
      data-hero-metrics
      className={cn(className, "grid grid-cols-5 gap-px overflow-hidden rounded-[20px] bg-[var(--border-subtle)] shadow-[var(--el-soft)] @max-[880px]/canvas:grid-cols-3 @max-[520px]/canvas:grid-cols-2")}
    >
      {/* TODO-COPY, every label and detail line. */}
      <Cell crisis value={m.inCrisis} label="In crisis" detail={crisisDetail ?? "Tier 1 · live"} onActivate={onCrisis} target="go to the Tier 1 queue" />
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
