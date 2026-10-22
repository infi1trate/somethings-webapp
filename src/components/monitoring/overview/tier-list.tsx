"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE LIST VIEW (proto/monitoring-merge)
//
// A `role="table"` on one CSS grid whose rows are SUBGRIDS, so the seven
// columns align across every tier group without a fixed width per cell:
//   Teen · Mentor · Days on platform · Days engaged · Risk flags ·
//   Escalations · Surveys
// The column headers sit on top, as the board draws them; then the Tier 1
// lane (its own full-width row); then Tiers 2 → 4, each a `rowgroup` under
// a real `h3`. Rows are 52px, 10px radius, 4px apart, and carry tier the
// pack's three ways only — ring, lozenge, surface — never a bar or a left
// border, and never alert colour below Tier 2.

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
  TierLozenge,
  tierDetailInk,
  tierSurface,
} from "@/components/monitoring/overview/tier-bits";
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

function Row({ teen }: { teen: MonitoringTeen }) {
  const second = [teen.reviewReason, teen.timeInTier && `Day ${teen.timeInTier.day}/${teen.timeInTier.minimum}`]
    .filter(Boolean)
    .join(" · ");
  const detail = tierDetailInk(teen.tier);
  const tint = teen.tier <= 2;
  const link = monitoringEntryHref(teen);
  return (
    <div
      role="row"
      data-monitoring-row={teen.id}
      data-tier={teen.tier}
      className={cn(ROW, "h-[52px] items-center rounded-[10px] px-3", tierSurface(teen.tier))}
    >
      {/* TEEN */}
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <TierAvatar name={teen.teen} tier={teen.tier} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {/* ═══ THE NAME IS THE DOOR (pack v3.0) ═══ Into the conversation,
                or the record when this prototype has no thread for the teen;
                plain text when there is neither. A link on the name, not on
                the row, so the grid's row/cell semantics stay intact. */}
            {link ? (
              <Link
                href={link.href}
                data-entry-link={link.kind}
                className="truncate rounded-sm text-[14px] leading-[20px] font-semibold text-[var(--text-primary)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
              >
                {teen.teen}
              </Link>
            ) : (
              <span className="truncate text-[14px] leading-[20px] font-semibold text-[var(--text-primary)]">{teen.teen}</span>
            )}
            <TierLozenge tier={teen.tier} />
            {teen.presence && <PresenceChip text={teen.presence} />}
          </div>
          {second && <p className={cn("m-0 truncate font-mono text-[11px] leading-[14px]", detail)}>{second}</p>}
        </div>
      </div>
      {/* MENTOR */}
      <div role="cell" className="truncate text-[13px] text-[var(--text-secondary)]">
        {teen.mentor}
      </div>
      {/* DAYS ON PLATFORM */}
      <div role="cell" className="font-mono text-[13px] tabular-nums text-[var(--text-primary)]">
        {teen.daysOnPlatform}
      </div>
      {/* DAYS ENGAGED: the week, then the number */}
      <div role="cell" className="flex items-center gap-2">
        <Sparkline values={teen.engagement7d} />
        <span className="font-mono text-[13px] tabular-nums text-[var(--text-primary)]">{teen.daysEngaged}</span>
      </div>
      {/* RISK FLAGS: count, then the window in tertiary mono */}
      <div role="cell">
        <GlyphCount
          icon={FLAG}
          count={teen.riskFlags.count}
          tone={flagTone(teen)}
          onTint={tint}
          label=" risk flags"
          suffix={
            teen.riskFlags.count > 0 && teen.riskFlags.window ? (
              <span className={cn("font-mono text-[11px]", detail)}>
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
      {/* SURVEYS */}
      <div role="cell">
        <GlyphCount icon={SURVEY} count={teen.surveys.count} onTint={tint} label=" surveys" />
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
    <div role="rowgroup" aria-labelledby={id} data-tier-group={tier} className={cn(ROW, "gap-y-1")}>
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

/** ═══ SHOW ALL ═══ A mono ghost button at the right of Tier 4's header. */
export function ShowAll({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }) {
  return (
    <button
      type="button"
      data-tier4-toggle
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="inline-flex min-h-7 shrink-0 items-center rounded-md px-2 font-mono text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
    >
      {/* TODO-COPY */}
      {open ? "Show fewer" : "Show all"}
    </button>
  );
}

/** Collapsed, Tier 4 previews two rows, as the board does. */
export const T4_PREVIEW = 2;
/** A list row and the gap after it. */
const ROW_PITCH = 52 + 4;

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
    <div ref={ref} role="presentation" data-tier4-window={`${start}-${end}`} className={cn(ROW, "gap-y-1")}>
      {before > 0 && <div aria-hidden data-spacer className="col-span-full" style={{ height: before - 4 }} />}
      {teens.slice(start, end).map((t) => (
        <Row key={t.id} teen={t} />
      ))}
      {after > 0 && <div aria-hidden data-spacer className="col-span-full" style={{ height: after - 4 }} />}
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
    <div
      role="region"
      aria-label="Teens by tier"
      tabIndex={0}
      data-monitoring-list-scroll
      className="relative overflow-x-auto rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
    >
      <div role="table" aria-label="Teens by tier" data-monitoring-list className={cn("grid gap-x-4", COLUMNS)}>
        <div role="rowgroup" className={ROW}>
          <div role="row" className={cn(ROW, "px-3 pb-1")}>
            {HEADERS.map((h) => (
              <div key={h} role="columnheader" className="text-[12px] leading-[16px] font-medium text-[var(--text-secondary)]">
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
        <TierRows
          tier={4}
          teens={t4}
          action={<ShowAll open={t4Open} onToggle={() => setT4Open((o) => !o)} controls="tier-4-rows" />}
        >
          <div id="tier-4-rows" role="presentation" className={cn(ROW, "gap-y-1")}>
            <Tier4Rows teens={t4} open={t4Open} />
          </div>
        </TierRows>
      </div>
    </div>
  );
}
