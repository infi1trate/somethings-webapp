"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE TIER SIGNIFIER AND THE SMALL PARTS
//
// ═══ SUPERSEDED: THE AVATAR RING (Monitoring v2, Part B) ═══ Tier was a
// ring on every avatar, a lozenge and a surface; the rings read as alarm on
// every row. Three QUIET carriers now:
//   avatar   36px, a neutral soft fill, no ring — the only ring left is the
//            6px green presence dot when someone is in the session
//   tag      `T2` in 11/16 medium: filled with the tier's AA ink for Tiers
//            1–2, outlined for 3–4 — for scanning, not shouting
//   surface  T1 t1-soft + its one keyline · T2 t2-soft · T3 raised, soft
//            elevation · T4 canvas, a hairline, no shadow
// Alert colour is spent on Tiers 1–2 only. Text sits on the INK tokens
// (`--t1-ink`, `--t2-ink`); the board's t1 / t2 fail AA as text and stay for
// dots and the one keyline. Tier is never colour alone: the tag SAYS it.
//
// ═══ MONO RETREATS ═══ Mono is for numerals and timestamps only; secondary
// lines are the sans at 13px.

import { ClipboardList, Flag, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TIER_CADENCE, TIER_NAME, type Tier } from "@/lib/monitoring/tiers";
import { cn } from "@/lib/utils";

/** The row / card surface for a tier — tint and elevation, not keylines;
 *  the single keyline is Tier 1's. */
export function tierSurface(tier: Tier): string {
  switch (tier) {
    case 1:
      return "bg-[var(--t1-soft)] border border-[color:var(--t1)]";
    case 2:
      return "bg-[var(--t2-soft)] border border-transparent";
    case 3:
      return "bg-[var(--surface-raised)] border border-transparent shadow-[var(--el-soft)]";
    case 4:
      return "bg-[var(--surface-canvas)] border border-[color:var(--border-subtle)]";
  }
}

/** Tertiary on t1-soft measures 4.39:1 — under AA — so quiet text on a Tier
 *  1 or 2 surface falls back to secondary (the pack's own rule). */
export const tierDetailInk = (tier: Tier) =>
  tier <= 2 ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]";

const initial = (name: string) => (name.trim()[0] || "?").toUpperCase();

/** ═══ THE AVATAR: NEUTRAL, NO RING ═══ 36px, `surface-sunken` with a
 *  `text-secondary` initial. `live` adds the 6px green presence dot — the one
 *  ring anywhere. Decorative: the name is always beside it. */
export function TierAvatar({ name, live = false }: { name: string; live?: boolean }) {
  return (
    <span aria-hidden data-tier-avatar data-live={live || undefined} className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[13px] leading-none font-medium text-[var(--text-secondary)]">
      {initial(name)}
      {live && <span data-presence-dot className="absolute right-0 bottom-0 size-1.5 rounded-full bg-[var(--status-online)] ring-2 ring-[var(--surface-raised)]" />}
    </span>
  );
}

/** ═══ THE TIER TAG ═══ `T2`, 11/16 medium. Filled with the tier's AA ink
 *  under `--text-inverse` for Tiers 1–2; outlined `border-default` with
 *  `text-secondary` for 3–4. The tier's name rides in the accessible name. */
export function TierTag({ tier }: { tier: Tier }) {
  return (
    <span
      data-tier-tag={tier}
      className={cn(
        "inline-flex h-4 shrink-0 items-center rounded-[5px] px-1.5 text-[11px] leading-[16px] font-medium",
        tier === 1 && "bg-[var(--t1-ink)] text-[var(--text-inverse)]",
        tier === 2 && "bg-[var(--t2-ink)] text-[var(--text-inverse)]",
        tier >= 3 && "border border-[color:var(--border-default)] text-[var(--text-secondary)]"
      )}
    >
      T{tier}
      <span className="sr-only"> · {TIER_NAME[tier]}</span>
    </span>
  );
}

/* The lozenge and the sparkline are shared primitives now
   (`components/ui/tier-lozenge.tsx`, `components/ui/bar-sparkline.tsx`). */
export { TierLozenge } from "@/components/ui/tier-lozenge";
export { BarSparkline as Sparkline } from "@/components/ui/bar-sparkline";

/** ═══ A TIER GROUP'S HEADER ═══ A real `h3`, so the tiers are navigable by
 *  heading: the 8px dot (tinted for 1–2, `border-strong` for 3–4), the name
 *  14/20, the count in mono, and the cadence on the SAME line after a middle
 *  dot, 13/18 tertiary — not a second line. */
export function TierGroupHeader({
  tier,
  count,
  id,
  action,
}: {
  tier: Tier;
  count: number;
  id: string;
  action?: React.ReactNode;
}) {
  return (
    <div data-tier-header={tier} className="flex items-center justify-between gap-3 pt-6 pb-2">
      <h3 id={id} className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-2 text-[14px] leading-[20px] font-normal">
        <span
          aria-hidden
          className="size-2 shrink-0 self-center rounded-full"
          style={{ background: tier === 1 ? "var(--t1)" : tier === 2 ? "var(--t2)" : "var(--border-strong)" }}
        />
        <span className="font-display font-bold text-[var(--text-primary)]">
          Tier {tier} · {TIER_NAME[tier]}
        </span>
        <span className="font-mono text-[13px] tabular-nums text-[var(--text-secondary)]">{count}</span>
        <span data-tier-cadence className="text-[13px] leading-[18px] font-normal text-[var(--text-tertiary)]">
          <span aria-hidden>· </span>
          {TIER_CADENCE[tier]}
        </span>
      </h3>
      {action}
    </div>
  );
}

/** ═══ A SIGNAL: 16px GLYPH + 15 TABULAR NUMBER ═══ The glyph is tertiary,
 *  the number primary; `suffix` (the window, "48h") is 12 sans after 6px.
 *  ZERO IS `text-muted` (5.3:1), not Bloom's text/disabled (warmGrey/300,
 *  ~1.5:1) — answered on the context report: a "0" is content and must pass
 *  AA. TONE only on Tier 1–2 rows, only on the number and the glyph. Never
 *  an icon alone: the number is always there. */
export function GlyphCount({
  icon: Icon,
  count,
  tone,
  suffix,
  label,
  onTint = false,
}: {
  icon: LucideIcon;
  count: number;
  tone?: "t1" | "t2" | null;
  suffix?: React.ReactNode;
  label: string;
  /** On a t1 / t2 tint the quiet inks fall back to secondary (AA). */
  onTint?: boolean;
}) {
  const zero = count === 0;
  const toneInk = !zero && tone === "t1" ? "text-[var(--t1-ink)]" : !zero && tone === "t2" ? "text-[var(--t2-ink)]" : null;
  const glyphInk = toneInk ?? (onTint ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]");
  const numInk = toneInk ?? (zero ? (onTint ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]") : "text-[var(--text-primary)]");
  return (
    <span data-glyph-count={zero ? "zero" : "some"} className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon aria-hidden className={cn("size-4 shrink-0", glyphInk)} strokeWidth={1.75} />
      <span className={cn("font-mono text-[15px] leading-[20px] tabular-nums", numInk)}>{count}</span>
      {suffix}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export const FLAG = Flag;
export const ESCALATION = ShieldAlert;
export const SURVEY = ClipboardList;
