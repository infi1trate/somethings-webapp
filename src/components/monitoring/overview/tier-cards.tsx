"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE CARD VIEW, STREAMLINED (Monitoring v3, §4)
//
// Every datum kept; the labels the icons already carry cut; tone by CONTOUR,
// not fill. A card is an `article` named by the teen — 20px radius, 20 in,
// the soft elevation, a hover lift. Top to bottom:
//   header      40px neutral avatar · name 17/22 (Avantt — weight is not a
//               channel) · mentor 13 beneath, the presence chip inline when
//               live · the live stage, when there is one · the tier tag
//               top-right (11/16; filled for Tiers 1–2, outlined 3–4)
//   engagement  ENGAGEMENT · 7 DAYS (11/16, tracked, tertiary); the numeral
//               at 32/36 with "of N days" on its baseline; the 120×20
//               sparkline directly beneath — so its meaning is the block's
//   signals     ONE line, icon-led, no labels: ⚑ 4 · 48h · ▲ 1 · closed Tue
//               · ▤ 2 · PHQ-9 Mon — each named for assistive tech and on
//               hover; a zero is text-muted with no detail
//   time        a 2px track and "Day 3 of 7" right-aligned; never Tier 4
//   footer      the review reason as a sunken pill, and a chevron
// ═══ THE COLOUR RULE ═══ Cards are surface-raised white. Tier is a 1px
// contour — Tier 1 the t1 hue at 50%, Tier 2 the t2 hue at 45%, Tier 3
// border-default, Tier 4 border-subtle — plus the tag. FILL is spent in one
// place only: the live Tier 1 lane. Tier 2's amber fill is gone.
// ═══ TIER 4 IS A REGISTRY, NOT A WATCH LIST ═══ It renders as the list's
// 64px rows (two, then "Show all 100"), not cards.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { monitoringEntryHref } from "@/lib/monitoring/entry-href";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import { Tier4Registry } from "@/components/monitoring/overview/tier-list";
import type { Tier } from "@/lib/monitoring/tiers";
import { EmptyTierLane, Tier1Lane, PresenceChip } from "@/components/monitoring/overview/tier1-lane";
import { ESCALATION, FLAG, Sparkline, SURVEY, TierAvatar, TierGroupHeader, TierTag } from "@/components/monitoring/overview/tier-bits";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** The card's contour: the tier, in one line of colour. */
function cardContour(tier: Tier): string {
  switch (tier) {
    case 1:
      return "border-[color:color-mix(in_srgb,var(--t1)_50%,transparent)]";
    case 2:
      return "border-[color:color-mix(in_srgb,var(--t2)_45%,transparent)]";
    case 3:
      return "border-[color:var(--border-default)]";
    case 4:
      return "border-[color:var(--border-subtle)]";
  }
}

/** ═══ ONE SIGNAL, ICON-LED ═══ The 16px glyph (tertiary), the number at 15
 *  tabular (primary; a zero muted — text-muted passes AA where Bloom's
 *  text/disabled does not, AGENTS.md), and its detail at 13 secondary. No
 *  label: the glyph is the label, and the accessible name and the hover
 *  title say it in words. */
function CardSignal({ icon: Icon, name, count, detail, words }: { icon: LucideIcon; name: string; count: number; detail?: string | null; words: string }) {
  const zero = count === 0;
  return (
    <span data-card-signal={name} role="img" aria-label={words} title={words} className="inline-flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
      <Icon aria-hidden className="size-4 shrink-0 self-center text-[var(--text-tertiary)]" strokeWidth={1.75} />
      <span data-signal-count className={cn("text-[15px] leading-[20px] tabular-nums", zero ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]")}>
        {count}
      </span>
      {!zero && detail && (
        <span data-signal-detail className="truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
          · {detail}
        </span>
      )}
    </span>
  );
}

function Card({ teen }: { teen: MonitoringTeen }) {
  const nameId = `card-${teen.id}-name`;
  const tit = teen.tier !== 4 ? teen.timeInTier : undefined;
  const link = monitoringEntryHref(teen);
  const escDetail = teen.escalations.count > 0 && teen.escalations.lastStatus ? `${teen.escalations.lastStatus}${teen.escalations.lastWhen ? ` ${teen.escalations.lastWhen}` : ""}` : null;
  const surveyDetail = teen.surveys.count > 0 && teen.surveys.lastInstrument ? `${teen.surveys.lastInstrument}${teen.surveys.lastDate ? ` ${teen.surveys.lastDate}` : ""}` : null;
  const flagDetail = teen.riskFlags.count > 0 && teen.riskFlags.window ? `${teen.riskFlags.window}${teen.riskFlags.trigger === "slow-burn" ? " ↗" : ""}` : null;
  /* TODO-COPY, the three spoken names — "Risk flags: 4 in 48h". */
  const said = (name: string, n: number, tail?: string | null) => `${name}: ${n}${tail ? (tail.startsWith(",") ? tail : ` ${tail}`) : ""}`;
  return (
    <article
      aria-labelledby={nameId}
      data-monitoring-card={teen.id}
      data-tier={teen.tier}
      className={cn("group relative flex flex-col rounded-[20px] border bg-[var(--surface-raised)] p-5 shadow-[var(--el-soft)]", cardContour(teen.tier), link && "mon-lift cursor-pointer")}
    >
      {/* 1 · HEADER */}
      <header className="flex items-start gap-3">
        <TierAvatar name={teen.teen} live={!!teen.presence} size={40} />
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
          <p data-card-mentor className="m-0 mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
            {teen.mentor}
            {teen.presence && <PresenceChip text={teen.presence} />}
          </p>
          {/* The live stage (pack v5.0, C4), one quiet line. */}
          {teen.stage && (
            <p data-teen-stage className="m-0 mt-0.5 truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
              {teen.stage}
            </p>
          )}
        </div>
        <TierTag tier={teen.tier} />
      </header>

      {/* 2 · ENGAGEMENT — labelled and grouped, the sparkline under the numeral */}
      <div data-card-metric className="mt-5">
        <p data-card-metric-label className="m-0 text-[11px] leading-[16px] font-medium tracking-[0.06em] text-[var(--text-tertiary)] uppercase">
          {/* TODO-COPY */}
          Engagement · 7 days
        </p>
        <p className="m-0 mt-1 flex items-baseline gap-2">
          <span data-card-days className="font-display text-[32px] leading-[36px] font-bold tabular-nums text-[var(--text-primary)]">
            {teen.daysEngaged}
          </span>
          <span data-card-days-label className="text-[15px] leading-[20px] text-[var(--text-secondary)]">
            {/* TODO-COPY */}
            of {teen.daysOnPlatform} days
          </span>
        </p>
        <div className="mt-1.5">
          <Sparkline values={teen.engagement7d} variant="card-v3" />
        </div>
      </div>

      {/* 3 · THE SIGNALS — one line, icon-led, 20 apart */}
      <div data-card-stats className="mt-5 flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1">
        <CardSignal icon={FLAG} name="Risk flags" count={teen.riskFlags.count} detail={flagDetail} words={said("Risk flags", teen.riskFlags.count, flagDetail && `in ${flagDetail}`)} />
        <CardSignal icon={ESCALATION} name="Escalations" count={teen.escalations.count} detail={escDetail} words={said("Escalations", teen.escalations.count, escDetail && `, ${escDetail}`)} />
        <CardSignal icon={SURVEY} name="Surveys" count={teen.surveys.count} detail={surveyDetail} words={said("Surveys", teen.surveys.count, surveyDetail && `, last ${surveyDetail}`)} />
      </div>

      {/* 4 · TIME IN TIER — a 2px track, the caption at its right; never Tier 4 */}
      {tit && (
        <div data-card-tit className="mt-4 flex items-center gap-3">
          <span aria-hidden data-tit-track className="block h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <span className="block h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${Math.min(100, Math.round((tit.day / tit.minimum) * 100))}%` }} />
          </span>
          <span data-tit-caption className="shrink-0 text-[13px] leading-[18px] tabular-nums text-[var(--text-secondary)]">
            {/* TODO-COPY */}
            Day {tit.day} of {tit.minimum}
          </span>
        </div>
      )}

      {/* 5 · FOOTER — the reason pill only when a review is due */}
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

/** ═══ 3-UP FROM 1280, 2-UP BELOW (§4) ═══ Read off the viewport, with the
 *  canvas as a guard (Support open narrows it), and one-up on a phone. */
const GRID = "grid grid-cols-2 gap-4 min-[1280px]:@min-[900px]/canvas:grid-cols-3 @max-[620px]/canvas:grid-cols-1";

function TierCards({ tier, teens }: { tier: Tier; teens: MonitoringTeen[] }) {
  const id = `tier-${tier}-heading`;
  return (
    <section aria-labelledby={id} data-tier-group={tier}>
      <TierGroupHeader tier={tier} count={teens.length} id={id} />
      {teens.length === 0 ? (
        <EmptyTierLane tier={tier} />
      ) : (
        <div data-card-grid className={GRID}>
          {teens.map((t) => (
            <Card key={t.id} teen={t} />
          ))}
        </div>
      )}
    </section>
  );
}

export function MonitoringCards({ teens, tier4Open = false, now, heldBy }: { teens: MonitoringTeen[]; tier4Open?: boolean; now: number; heldBy?: Readonly<Record<string, string>> }) {
  const of = (tier: Tier) => teens.filter((t) => t.tier === tier);
  const t4 = of(4);
  return (
    <div data-monitoring-cards>
      {/* Tier 1 is never cards: the same queue as the list (Monitoring v4). */}
      <Tier1Lane teens={teens} now={now} heldBy={heldBy} />
      <TierCards tier={2} teens={of(2)} />
      <TierCards tier={3} teens={of(3)} />
      {/* TIER 4 — the registry's rows, inside the card view */}
      <section aria-labelledby="tier-4-heading" data-tier-group={4}>
        <TierGroupHeader tier={4} count={t4.length} id="tier-4-heading" />
        <Tier4Registry teens={t4} defaultOpen={tier4Open} />
      </section>
    </div>
  );
}
