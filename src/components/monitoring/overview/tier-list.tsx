"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE LIST VIEW
//
// A `role="table"` on one CSS grid whose rows are SUBGRIDS, so the seven
// columns align across every tier group without a fixed width per cell:
//   Teen · Mentor · Days on platform · Days engaged · Risk flags ·
//   Escalations · Surveys
//
// ═══ ONE CONTAINER (Monitoring v2, Part B) ═══ The whole list sits in a
// single raised surface — 24px radius, soft elevation, 16px in — whose first
// row is the STICKY column header, 12/16 tertiary, on the cell grid, 12px
// above a hairline. (They floated 40px above the data, in canvas space.)
// Tier groups are section rows inside it; the Tier 1 lane is the first
// section's only row. Rows are 64px, 14px radius, 8px apart; tier rides on
// the quiet signifier (tag + surface), never a ring. A row LIFTS on hover and
// the whole row is the link — the name's link stretched over it, so the
// grid keeps its row / cell semantics.

import { useRef, useState } from "react";
import Link from "next/link";
import { monitoringEntryHref } from "@/lib/monitoring/entry-href";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import { useWindowedRange } from "@/lib/ui/use-windowed-range";
import type { Tier } from "@/lib/monitoring/tiers";
import { Tier1Lane, PresenceChip } from "@/components/monitoring/overview/tier1-lane";
import {
  ESCALATION,
  FLAG,
  GlyphCount,
  Sparkline,
  SURVEY,
  TierAvatar,
  TierGroupHeader,
  TierTag,
  tierDetailInk,
  tierSurface,
} from "@/components/monitoring/overview/tier-bits";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* The seven tracks, shared by every row through `subgrid`. */
const COLUMNS =
  "grid-cols-[minmax(220px,2.2fr)_minmax(110px,1fr)_minmax(96px,0.8fr)_minmax(132px,1fr)_minmax(110px,0.9fr)_minmax(96px,0.7fr)_minmax(84px,0.7fr)]";
const ROW = "col-span-full grid grid-cols-subgrid";

/** TODO-COPY, all seven. */
const HEADERS = ["Teen", "Mentor", "Days on platform", "Days engaged", "Risk flags", "Escalations", "Surveys"];

/** Flags take tone only where the pack spends it: T1 always, T2 on a surge.
 *  A Tier 3 / 4 slow-burn is neutral, with its ↗ glyph. */
function flagTone(t: MonitoringTeen): "t1" | "t2" | null {
  if (t.tier === 1) return "t1";
  if (t.tier === 2 && t.riskFlags.trigger === "surge") return "t2";
  return null;
}

/** "Day 3 of 7" — the pack's words, sans. */
export const dayOf = (t: MonitoringTeen) => (t.timeInTier ? `Day ${t.timeInTier.day} of ${t.timeInTier.minimum}` : null);

function Row({ teen }: { teen: MonitoringTeen }) {
  const second = [teen.reviewReason, dayOf(teen)].filter(Boolean).join(" · ");
  const detail = tierDetailInk(teen.tier);
  const tint = teen.tier <= 2;
  const link = monitoringEntryHref(teen);
  return (
    <div
      role="row"
      data-monitoring-row={teen.id}
      data-tier={teen.tier}
      className={cn(ROW, "group relative h-16 items-center rounded-[14px] px-4", tierSurface(teen.tier), link && "mon-lift cursor-pointer")}
    >
      {/* TEEN */}
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <TierAvatar name={teen.teen} live={!!teen.presence} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {/* ═══ THE WHOLE ROW IS THE LINK ═══ The name's link, its hit area
                stretched over the row (`after:inset-0`), so the row is one
                target while the grid keeps its row / cell semantics. Into the
                conversation, or the record where there is no thread; plain
                text when there is neither. */}
            {link ? (
              <Link
                href={link.href}
                data-entry-link={link.kind}
                className="mon-focus truncate rounded-sm font-display text-[15px] leading-[20px] font-bold text-[var(--text-primary)] after:absolute after:inset-0 after:rounded-[14px] after:content-['']"
              >
                {teen.teen}
              </Link>
            ) : (
              <span className="truncate font-display text-[15px] leading-[20px] font-bold text-[var(--text-primary)]">{teen.teen}</span>
            )}
            <TierTag tier={teen.tier} />
            {teen.presence && <PresenceChip text={teen.presence} />}
          </div>
          {second && <p data-row-second className={cn("m-0 truncate text-[13px] leading-[18px]", tint ? "text-[var(--text-secondary)]" : "text-[var(--text-secondary)]")}>{second}</p>}
        </div>
      </div>
      {/* MENTOR */}
      <div role="cell" className="truncate text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {teen.mentor}
      </div>
      {/* DAYS ON PLATFORM */}
      <div role="cell" className="font-mono text-[15px] leading-[20px] tabular-nums text-[var(--text-primary)]">
        {teen.daysOnPlatform}
      </div>
      {/* DAYS ENGAGED: the week, then the number */}
      <div role="cell" className="flex items-center gap-2">
        <Sparkline values={teen.engagement7d} />
        <span className="font-mono text-[15px] leading-[20px] tabular-nums text-[var(--text-primary)]">{teen.daysEngaged}</span>
      </div>
      {/* RISK FLAGS: count, then the window in 12 sans */}
      <div role="cell">
        <GlyphCount
          icon={FLAG}
          count={teen.riskFlags.count}
          tone={flagTone(teen)}
          onTint={tint}
          label=" risk flags"
          suffix={
            teen.riskFlags.count > 0 && teen.riskFlags.window ? (
              <span data-flag-window className={cn("ml-0.5 text-[12px] leading-[16px]", detail)}>
                {teen.riskFlags.window}
                {teen.riskFlags.trigger === "slow-burn" && " ↗"}
              </span>
            ) : null
          }
        />
      </div>
      {/* ESCALATIONS */}
      <div role="cell">
        <GlyphCount icon={ESCALATION} count={teen.escalations.count} tone={teen.tier === 1 ? "t1" : null} onTint={tint} label=" escalations" />
      </div>
      {/* SURVEYS, and the chevron that fades in on hover */}
      <div role="cell" className="flex items-center justify-between gap-2">
        <GlyphCount icon={SURVEY} count={teen.surveys.count} onTint={tint} label=" surveys" />
        {link && <ChevronRight aria-hidden data-row-chevron className="size-4 shrink-0 text-[var(--icon-secondary)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none" />}
      </div>
    </div>
  );
}

function TierRows({
  tier,
  teens,
  action,
  children,
}: {
  tier: Tier;
  teens: MonitoringTeen[];
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const id = `tier-${tier}-heading`;
  return (
    <div role="rowgroup" aria-labelledby={id} data-tier-group={tier} className={cn(ROW, "gap-y-2")}>
      {/* The group header is a row of its own, one cell wide as the table. */}
      <div role="row" className={ROW}>
        <div role="cell" className="col-span-full">
          <TierGroupHeader tier={tier} count={teens.length} id={id} action={action} />
        </div>
      </div>
      {children ?? teens.map((t) => <Row key={t.id} teen={t} />)}
    </div>
  );
}

/** ═══ SHOW ALL ═══ A quiet button. In the list it is FULL WIDTH inside the
 *  container, after Tier 4's two preview rows; the cards keep it in the
 *  group header (`inline`). */
export function ShowAll({ open, onToggle, controls, total, inline = false }: { open: boolean; onToggle: () => void; controls: string; total?: number; inline?: boolean }) {
  return (
    <button
      type="button"
      data-tier4-toggle
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        "mon-focus inline-flex shrink-0 items-center justify-center rounded-[14px] text-[13px] leading-[18px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
        inline ? "min-h-8 px-3" : "min-h-11 w-full"
      )}
    >
      {/* TODO-COPY */}
      {open ? "Show fewer" : `Show all${total ? ` ${total}` : ""}`}
    </button>
  );
}

/** Collapsed, Tier 4 previews two rows, as the board does. */
export const T4_PREVIEW = 2;
/** A list row and the gap after it. */
const ROW_PITCH = 64 + 8;

/** ═══ TIER 4, WINDOWED ═══ Expanded, only the rows near the viewport
 *  render; aria-hidden spacers hold the rest's height, so the page is as
 *  long as the group. A nested subgrid, so the columns stay the table's. */
function Tier4Rows({ teens, open }: { teens: MonitoringTeen[]; open: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { start, end } = useWindowedRange({ ref, count: teens.length, itemSize: ROW_PITCH, enabled: open });
  if (!open) return <>{teens.slice(0, T4_PREVIEW).map((t) => <Row key={t.id} teen={t} />)}</>;
  const before = start * ROW_PITCH;
  const after = (teens.length - end) * ROW_PITCH;
  return (
    <div ref={ref} role="presentation" data-tier4-window={`${start}-${end}`} className={cn(ROW, "gap-y-2")}>
      {before > 0 && <div aria-hidden data-spacer className="col-span-full" style={{ height: before - 8 }} />}
      {teens.slice(start, end).map((t) => (
        <Row key={t.id} teen={t} />
      ))}
      {after > 0 && <div aria-hidden data-spacer className="col-span-full" style={{ height: after - 8 }} />}
    </div>
  );
}

export function MonitoringList({ teens }: { teens: MonitoringTeen[] }) {
  const of = (tier: Tier) => teens.filter((t) => t.tier === tier);
  const t4 = of(4);
  const [t4Open, setT4Open] = useState(false);
  /* A DATA TABLE KEEPS ITS COLUMNS. Seven tracks need ~944px; below that the
     table scrolls inside its own region rather than the page scrolling
     sideways (WCAG 1.4.10 exempts two-dimensional data from reflow). The
     region is focusable so the keyboard can scroll it, and the Alert strip
     above stays full width, so the Tier 1 action is never off-screen.
     `relative` is load-bearing: without it the cells' absolutely positioned
     `sr-only` labels take the canvas as their containing block, escape this
     clip, and widened the canvas to 884px at 375 (measured). */
  return (
    /* THE CONTAINER: raised, 24px, soft elevation, 16px in. It scrolls
       sideways only BELOW the table's width (960 of canvas); above it, it is
       not a scroll container, so the header can stick to the page. */
    <div
      role="region"
      aria-label="Teens by tier"
      tabIndex={0}
      data-monitoring-list-scroll
      className="mon-focus relative overflow-x-auto rounded-[24px] bg-[var(--surface-raised)] px-4 pb-4 shadow-[var(--el-soft)] @min-[960px]/canvas:overflow-visible"
    >
      <div role="table" aria-label="Teens by tier" data-monitoring-list className={cn("grid gap-x-4", COLUMNS)}>
        {/* ═══ THE STICKY HEADER ROW ═══ On the cell grid (the row's own
            px-4 matches the rows'), 12/16 tertiary, 12px above a hairline. */}
        <div role="rowgroup" data-list-header className={cn(ROW, "sticky top-0 z-[2] -mx-4 rounded-t-[24px] bg-[var(--surface-raised)] px-4")}>
          <div role="row" className={cn(ROW, "border-b border-[color:var(--border-subtle)] px-4 pt-4 pb-3")}>
            {HEADERS.map((h) => (
              <div key={h} role="columnheader" className="text-[12px] leading-[16px] font-medium text-[var(--text-tertiary)]">
                {h}
              </div>
            ))}
          </div>
        </div>

        {/* TIER 1: the lane, in its own full-width row */}
        <div role="rowgroup" className={ROW}>
          <div role="row" className={ROW}>
            <div role="cell" className="col-span-full">
              <Tier1Lane teens={teens} />
            </div>
          </div>
        </div>

        <TierRows tier={2} teens={of(2)} />
        <TierRows tier={3} teens={of(3)} />
        <TierRows tier={4} teens={t4}>
          <div id="tier-4-rows" role="presentation" className={cn(ROW, "gap-y-2")}>
            <Tier4Rows teens={t4} open={t4Open} />
          </div>
          <div role="row" className={ROW}>
            <div role="cell" className="col-span-full">
              <ShowAll open={t4Open} onToggle={() => setT4Open((o) => !o)} controls="tier-4-rows" total={t4.length} />
            </div>
          </div>
        </TierRows>
      </div>
    </div>
  );
}
