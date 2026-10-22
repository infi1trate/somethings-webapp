"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE CARD VIEW (proto/monitoring-merge)
//
// The same array as the list, three columns, 12px apart, one tier group per
// h3. A card is an `article` named by the teen; 16px radius, padded 14 / 16:
//   header   ringed 32px avatar · name 15px · mentor (· presence) 12px ·
//            the long lozenge ("T2 · High risk") at the right
//   engaged  the 7-day sparkline · days engaged / on platform ("48 / 132")
//   stats    a 2×2: risk flags · escalations · surveys · time in tier
//   footer   review reason (or "No review due") · Open ›
// Tier is the ring, the lozenge and the surface — T3 cards take Elevation 2,
// the cards' own signifier — and alert colour stays on Tiers 1 and 2.
//
// OPEN is a stub: there is no teen record in the prototype yet.

import { useRef, useState } from "react";
import Link from "next/link";
import { monitoringEntryHref } from "@/lib/monitoring/entry-href";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import { useWindowedRange } from "@/lib/ui/use-windowed-range";
import { ShowAll } from "@/components/monitoring/overview/tier-list";
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

const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

function flagTone(t: MonitoringTeen): "t1" | "t2" | null {
  if (t.tier === 1) return "t1";
  if (t.tier === 2 && t.riskFlags.trigger === "surge") return "t2";
  return null;
}

/** One cell of the 2×2: a label, then the value line. */
function Stat({ label, detail, children }: { label: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={cn("text-[11px] leading-[14px]", detail)}>{label}</div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

function Card({ teen, measure }: { teen: MonitoringTeen; measure?: (el: HTMLElement | null) => void }) {
  const detail = tierDetailInk(teen.tier);
  const tint = teen.tier <= 2;
  const nameId = `card-${teen.id}-name`;
  const tit = teen.timeInTier;
  return (
    <article
      ref={measure}
      aria-labelledby={nameId}
      data-monitoring-card={teen.id}
      data-tier={teen.tier}
      className={cn("flex flex-col gap-3 rounded-[16px] px-4 py-3.5", tierSurface(teen.tier))}
    >
      {/* HEADER */}
      <header className="flex items-start gap-3">
        <TierAvatar name={teen.teen} live={!!teen.presence} />
        <div className="min-w-0 flex-1">
          <h4 id={nameId} className="m-0 truncate font-sans text-[15px] leading-[20px] font-semibold text-[var(--text-primary)]">
            {teen.teen}
          </h4>
          <p className={cn("m-0 flex min-w-0 items-center gap-1.5 truncate text-[12px] leading-[16px]", detail)}>
            {teen.mentor}
            {teen.presence && (
              <>
                <span aria-hidden>·</span>
                <PresenceChip text={teen.presence} />
              </>
            )}
          </p>
        </div>
        <TierLozenge tier={teen.tier} long />
      </header>

      {/* ENGAGED */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className={cn("text-[11px]", detail)}>
            {/* TODO-COPY */}
            Engaged · 7d
          </span>
          <Sparkline values={teen.engagement7d} />
        </span>
        <span data-card-days className="font-mono text-[13px] tabular-nums text-[var(--text-primary)]">
          {teen.daysEngaged} <span className={detail}>/ {teen.daysOnPlatform}</span>
          <span className="sr-only"> days engaged of {teen.daysOnPlatform} on platform</span>
        </span>
      </div>

      {/* THE 2×2 */}
      <div data-card-stats className="grid grid-cols-2 gap-x-4 gap-y-3">
        {/* TODO-COPY, the four labels. */}
        <Stat label="Risk flags" detail={detail}>
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
        </Stat>
        <Stat label="Escalations" detail={detail}>
          <GlyphCount
            icon={ESCALATION}
            count={teen.escalations.count}
            tone={teen.tier === 1 ? "t1" : null}
            onTint={tint}
            label=" escalations"
            suffix={
              teen.escalations.count > 0 && teen.escalations.lastStatus ? (
                <span className={cn("truncate font-mono text-[11px]", detail)}>
                  {teen.escalations.lastStatus}
                  {teen.escalations.lastWhen && ` ${teen.escalations.lastWhen}`}
                </span>
              ) : null
            }
          />
        </Stat>
        <Stat label="Surveys" detail={detail}>
          <GlyphCount
            icon={SURVEY}
            count={teen.surveys.count}
            onTint={tint}
            label=" surveys"
            suffix={
              teen.surveys.count > 0 && teen.surveys.lastInstrument ? (
                <span className={cn("truncate font-mono text-[11px]", detail)}>
                  {teen.surveys.lastInstrument}
                  {teen.surveys.lastDate && ` · ${teen.surveys.lastDate}`}
                </span>
              ) : null
            }
          />
        </Stat>
        <Stat label="Time in tier" detail={detail}>
          {tit ? (
            <span data-card-tit className="flex w-full min-w-0 flex-col gap-1">
              <span className="font-mono text-[13px] tabular-nums text-[var(--text-primary)]">
                Day {tit.day} <span className={detail}>/ {tit.minimum}</span>
              </span>
              <span aria-hidden className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
                <span
                  className="block h-full rounded-full bg-[var(--text-secondary)]"
                  style={{ width: `${Math.min(100, Math.round((tit.day / tit.minimum) * 100))}%` }}
                />
              </span>
            </span>
          ) : (
            <span className={cn("font-mono text-[13px]", tint ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]")}>—</span>
          )}
        </Stat>
      </div>

      {/* FOOTER */}
      <footer
        className={cn(
          "mt-auto flex items-center justify-between gap-3 border-t pt-2.5",
          teen.tier <= 2 ? "border-[color:var(--border-default)]" : "border-[color:var(--border-subtle)]"
        )}
      >
        <span className={cn("truncate font-mono text-[11px] leading-[14px]", detail)}>
          {/* TODO-COPY */}
          {teen.reviewReason ?? "No review due"}
        </span>
        {/* ═══ OPEN › GOES SOMEWHERE (pack v3.0) ═══ The conversation, or
            the record where there is no thread; absent when there is neither
            — a no-op button was a door that did not open. */}
        {(() => {
          const link = monitoringEntryHref(teen);
          return link ? (
            <Link
              href={link.href}
              data-card-open={link.kind}
              aria-label={`Open ${teen.teen}${link.kind === "conversation" ? "'s conversation" : "'s record"}`}
              className={cn("inline-flex min-h-6 shrink-0 items-center rounded-full px-2 text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
            >
              Open ›
            </Link>
          ) : null;
        })()}
      </footer>
    </article>
  );
}

/** Collapsed, Tier 4 previews one row of three. */
const T4_CARD_PREVIEW = 3;
const GAP = 12;
/** Three across, then two, then one, read off the canvas (`@container/canvas`)
 *  as Care Reviews and Risk Flags do, so a phone and a desktop with Support
 *  open take the same step. */
const GRID = "grid grid-cols-3 gap-3 @max-[1000px]/canvas:grid-cols-2 @max-[620px]/canvas:grid-cols-1";

/** ═══ TIER 4 CARDS, WINDOWED BY ROWS ═══ A row's height is the first card's,
 *  measured (the cards in a tier share one anatomy), plus the 12px gap; and
 *  the row's WIDTH is the grid's live track count, because the grid steps
 *  three → two → one with the canvas. Spacers hold the rest. A ref callback,
 *  not an effect. */
function Tier4Cards({ teens, open }: { teens: MonitoringTeen[]; open: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pitch, setPitch] = useState(300);
  const [cols, setCols] = useState(3);
  const rows = Math.ceil(teens.length / cols);
  const { start, end } = useWindowedRange({ ref, count: rows, itemSize: pitch, overscan: 3, enabled: open });
  const measure = (el: HTMLElement | null) => {
    if (!el) return;
    if (el.offsetHeight + GAP !== pitch) setPitch(el.offsetHeight + GAP);
    const grid = el.parentElement;
    const n = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : cols;
    if (n > 0 && n !== cols) setCols(n);
  };
  if (!open) {
    return (
      <div data-card-grid className={GRID}>
        {teens.slice(0, T4_CARD_PREVIEW).map((t) => (
          <Card key={t.id} teen={t} />
        ))}
      </div>
    );
  }
  const shown = teens.slice(start * cols, end * cols);
  return (
    <div ref={ref} data-card-grid data-tier4-window={`${start}-${end}`} className={GRID}>
      {start > 0 && <div aria-hidden data-spacer className="col-span-full" style={{ height: start * pitch - GAP }} />}
      {shown.map((t, i) => (
        <Card key={t.id} teen={t} measure={i === 0 ? measure : undefined} />
      ))}
      {end < rows && <div aria-hidden data-spacer className="col-span-full" style={{ height: (rows - end) * pitch - GAP }} />}
    </div>
  );
}

function TierCards({
  tier,
  teens,
  all,
  action,
  children,
}: {
  tier: Tier;
  teens: MonitoringTeen[];
  all: number;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const id = `tier-${tier}-heading`;
  if (children) {
    return (
      <section aria-labelledby={id} data-tier-group={tier}>
        <TierGroupHeader tier={tier} count={all} id={id} action={action} />
        {children}
      </section>
    );
  }
  return (
    <section aria-labelledby={id} data-tier-group={tier}>
      <TierGroupHeader tier={tier} count={all} id={id} action={action} />
      <div data-card-grid className={GRID}>
        {teens.map((t) => (
          <Card key={t.id} teen={t} />
        ))}
      </div>
    </section>
  );
}

export function MonitoringCards({ teens }: { teens: MonitoringTeen[] }) {
  const of = (tier: Tier) => teens.filter((t) => t.tier === tier);
  const t4 = of(4);
  const [t4Open, setT4Open] = useState(false);
  return (
    <div data-monitoring-cards className="space-y-1">
      <Tier1Lane teens={teens} />
      <TierCards tier={2} teens={of(2)} all={of(2).length} />
      <TierCards tier={3} teens={of(3)} all={of(3).length} />
      <TierCards
        tier={4}
        teens={t4}
        all={t4.length}
        action={<ShowAll open={t4Open} onToggle={() => setT4Open((o) => !o)} controls="tier-4-cards" />}
      >
        <div id="tier-4-cards">
          <Tier4Cards teens={t4} open={t4Open} />
        </div>
      </TierCards>
    </div>
  );
}
