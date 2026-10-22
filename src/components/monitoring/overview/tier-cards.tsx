"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE CARD VIEW, NOW THE DEFAULT (Monitoring v2, Part B)
//
// The same array as the list, one tier group per h3. A card is an `article`
// named by the teen — 20px radius, 20 in, at least 240 tall, 16px apart,
// 3-up (2-up below a 960 canvas, ~1200 viewport; 1-up on a phone). Top to
// bottom, and SPACING does the grouping — there is no line inside a card:
//   header   36px neutral avatar (presence dot when live) · name 17/22 ·
//            mentor 13 beneath · the tier tag top-right
//   metric   days engaged as a 28/32 heading numeral, "engaged · of N on
//            platform" beneath; the 96×24 sparkline on the right, on its
//            baseline — what a supervisor reads first, so it has the weight
//   signals  risk flags · escalations · surveys, three equal columns: label
//            12 tertiary, then glyph + 15 tabular, then its detail
//   tier     "Time in tier" · "Day 1 of 7" over a 3px track (not on Tier 4)
//   footer   the review reason as a soft pill, and a chevron
// The whole card is the link (the name's, stretched); it lifts on hover.
// Tier rides on the tag and the surface — T3 by elevation, not colour.

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
  TierTag,
  tierDetailInk,
  tierSurface,
} from "@/components/monitoring/overview/tier-bits";
import { cn } from "@/lib/utils";

function flagTone(t: MonitoringTeen): "t1" | "t2" | null {
  if (t.tier === 1) return "t1";
  if (t.tier === 2 && t.riskFlags.trigger === "surge") return "t2";
  return null;
}

/** One signal: label 12 above, the glyph and number, the detail beneath —
 *  the same reading order in all three. No box. */
function Signal({ label, detail, quiet, children }: { label: string; detail?: string | null; quiet: string; children: React.ReactNode }) {
  return (
    <div data-card-signal={label} className="min-w-0">
      <div className={cn("text-[12px] leading-[16px]", quiet)}>{label}</div>
      <div className="mt-1">{children}</div>
      <div data-signal-detail className={cn("mt-0.5 truncate text-[12px] leading-[16px]", quiet)}>{detail || "\u00a0"}</div>
    </div>
  );
}

function Card({ teen, measure }: { teen: MonitoringTeen; measure?: (el: HTMLElement | null) => void }) {
  const quiet = tierDetailInk(teen.tier);
  const tint = teen.tier <= 2;
  const nameId = `card-${teen.id}-name`;
  const tit = teen.tier !== 4 ? teen.timeInTier : undefined;
  const link = monitoringEntryHref(teen);
  const escDetail = teen.escalations.count > 0 && teen.escalations.lastStatus ? `${teen.escalations.lastStatus}${teen.escalations.lastWhen ? ` ${teen.escalations.lastWhen}` : ""}` : null;
  const surveyDetail = teen.surveys.count > 0 && teen.surveys.lastInstrument ? `${teen.surveys.lastInstrument}${teen.surveys.lastDate ? ` · ${teen.surveys.lastDate}` : ""}` : null;
  const flagDetail = teen.riskFlags.count > 0 && teen.riskFlags.window ? `${teen.riskFlags.window}${teen.riskFlags.trigger === "slow-burn" ? " ↗" : ""}` : null;
  return (
    <article
      ref={measure}
      aria-labelledby={nameId}
      data-monitoring-card={teen.id}
      data-tier={teen.tier}
      className={cn("group relative flex min-h-60 flex-col rounded-[20px] p-5", tierSurface(teen.tier), link && "mon-lift cursor-pointer")}
    >
      {/* 1 · HEADER */}
      <header className="flex items-start gap-3">
        <TierAvatar name={teen.teen} live={!!teen.presence} />
        <div className="min-w-0 flex-1">
          <h4 id={nameId} className="m-0 truncate font-display text-[17px] leading-[22px] font-bold text-[var(--text-primary)]">
            {link ? (
              /* THE WHOLE CARD IS THE LINK: the name's, stretched over it. */
              <Link href={link.href} data-card-open={link.kind} className="mon-focus rounded-sm after:absolute after:inset-0 after:rounded-[20px] after:content-['']">
                {teen.teen}
              </Link>
            ) : (
              teen.teen
            )}
          </h4>
          <p className="m-0 mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
            {teen.mentor}
            {teen.presence && <PresenceChip text={teen.presence} />}
          </p>
        </div>
        <TierTag tier={teen.tier} />
      </header>

      {/* 2 · THE PRIMARY METRIC — read first, so it has the weight */}
      <div data-card-metric className="mt-4">
        {/* The sparkline sits on the NUMERAL's baseline (the line's last
            baseline is the bars' bottom), the label beneath both. */}
        <div className="flex items-baseline justify-between gap-3">
          <span data-card-days className="font-display text-[28px] leading-[32px] font-bold tabular-nums text-[var(--text-primary)]">
            {teen.daysEngaged}
          </span>
          <Sparkline values={teen.engagement7d} height={24} width={96} />
        </div>
        <div data-card-days-label className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
          {/* TODO-COPY */}
          engaged · of {teen.daysOnPlatform} on platform
        </div>
      </div>

      {/* 3 · THE SIGNALS — three equal columns, no boxes */}
      <div data-card-stats className="mt-5 grid grid-cols-3 gap-3">
        {/* TODO-COPY, the three labels. */}
        <Signal label="Risk flags" quiet={quiet} detail={flagDetail}>
          <GlyphCount icon={FLAG} count={teen.riskFlags.count} tone={flagTone(teen)} onTint={tint} label=" risk flags" />
        </Signal>
        <Signal label="Escalations" quiet={quiet} detail={escDetail}>
          <GlyphCount icon={ESCALATION} count={teen.escalations.count} tone={teen.tier === 1 ? "t1" : null} onTint={tint} label=" escalations" />
        </Signal>
        <Signal label="Surveys" quiet={quiet} detail={surveyDetail}>
          <GlyphCount icon={SURVEY} count={teen.surveys.count} onTint={tint} label=" surveys" />
        </Signal>
      </div>

      {/* 4 · TIME IN TIER — one line over a track; never on Tier 4 */}
      {tit && (
        <div data-card-tit className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn("text-[12px] leading-[16px]", quiet)}>Time in tier</span>
            <span className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
              Day {tit.day} of {tit.minimum}
            </span>
          </div>
          <span aria-hidden data-tit-track className="mt-1.5 block h-[3px] w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
            <span className="block h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${Math.min(100, Math.round((tit.day / tit.minimum) * 100))}%` }} />
          </span>
        </div>
      )}

      {/* 5 · FOOTER — no hairline above it; a pill only when a review is due */}
      <footer className="mt-auto flex items-center justify-between gap-3 pt-4">
        {teen.reviewReason ? (
          <span data-card-review className="truncate rounded-full bg-[var(--surface-sunken)] px-2.5 py-0.5 text-[12px] leading-[16px] text-[var(--text-secondary)]">
            {teen.reviewReason}
          </span>
        ) : (
          <span />
        )}
        {link && <ChevronRight aria-hidden data-card-chevron className="size-4 shrink-0 text-[var(--icon-secondary)]" />}
      </footer>
    </article>
  );
}

/** Collapsed, Tier 4 previews one row of three. */
const T4_CARD_PREVIEW = 3;
const GAP = 16;
/** Three across (1440), two below a 960 canvas (~1200 viewport), one on a
 *  phone — read off the canvas (`@container/canvas`), so a phone and a
 *  desktop with Support open take the same step. 16px apart. */
const GRID = "grid grid-cols-3 gap-4 @max-[960px]/canvas:grid-cols-2 @max-[620px]/canvas:grid-cols-1";

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
        action={<ShowAll inline open={t4Open} onToggle={() => setT4Open((o) => !o)} controls="tier-4-cards" />}
      >
        <div id="tier-4-cards">
          <Tier4Cards teens={t4} open={t4Open} />
        </div>
      </TierCards>
    </div>
  );
}
