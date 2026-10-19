"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE TIER SIGNIFIER AND THE SMALL PARTS (proto/monitoring-merge)
//
// Tier is three things together and nothing else (the pack's §2): a ring on
// the avatar, a lozenge that SAYS the tier, and the surface. No coloured
// bars, no left borders. Alert colour (t1 / t2) is spent on Tiers 1 and 2
// only; a Tier 3 or 4 row carries no red or amber anywhere, its slow-burn
// glyph included. Text sits on the INK tokens (`--t1-ink`, `--t2-ink`) —
// the board's t1 / t2 fail AA as text — and the board values stay for
// rings, dots and keylines.

import { ClipboardList, Flag, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RecordAvatar } from "@/components/record/record-avatar";
import { TIER_CADENCE, TIER_NAME, TIER_RING, type Tier } from "@/lib/monitoring/tiers";
import { cn } from "@/lib/utils";

/** The row / card surface for a tier. `card` takes Elevation 2 on Tier 3. */
export function tierSurface(tier: Tier, card = false): string {
  switch (tier) {
    case 1:
      return "bg-[var(--t1-soft)] border border-[color:var(--t1)]";
    case 2:
      return "bg-[var(--t2-soft)] border border-transparent";
    case 3:
      return cn("bg-[var(--surface-raised)] border border-transparent", card ? "shadow-[var(--shadow-panel)]" : "shadow-[var(--elevation-1)]");
    case 4:
      return "bg-transparent border border-[color:var(--border-default)]";
  }
}

/** The colour behind the ring's 2px offset: the tier's own surface. */
const RING_OFFSET: Record<Tier, string> = {
  1: "var(--t1-soft)",
  2: "var(--t2-soft)",
  3: "var(--surface-raised)",
  4: "var(--surface-canvas)",
};

/** Tertiary on t1-soft measures 4.39:1 — under AA — so detail text on a Tier
 *  1 or 2 surface falls back to secondary (the pack's own rule). */
export const tierDetailInk = (tier: Tier) =>
  tier <= 2 ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]";

export function TierAvatar({ name, tier, size = 30 }: { name: string; tier: Tier; size?: 30 | 32 }) {
  const ring = TIER_RING[tier];
  return (
    <span
      data-tier-ring={ring ? tier : "none"}
      className="inline-flex shrink-0 rounded-full"
      /* 2px ring, 2px off the avatar: the offset is the surface's colour. */
      style={ring ? { boxShadow: `0 0 0 2px ${RING_OFFSET[tier]}, 0 0 0 4px ${ring}` } : undefined}
    >
      <RecordAvatar name={name} size={size} />
    </span>
  );
}

/* The lozenge and the sparkline are shared primitives now
   (`components/ui/tier-lozenge.tsx`, `components/ui/bar-sparkline.tsx`). */
export { TierLozenge } from "@/components/ui/tier-lozenge";
export { BarSparkline as Sparkline } from "@/components/ui/bar-sparkline";

/** A tier group's header: a real `h3`, so the tiers are navigable by heading.
 *  The dot is coloured for Tiers 1 and 2 only. */
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
    <div className="flex items-end justify-between gap-3 px-1 pt-4 pb-2">
      <div className="min-w-0">
        <h3 id={id} className="m-0 flex items-center gap-2 text-[14px] leading-[20px]">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: tier === 1 ? "var(--t1)" : tier === 2 ? "var(--t2)" : "var(--border-default)" }}
          />
          <span className="font-display font-bold text-[var(--text-primary)]">
            Tier {tier} · {TIER_NAME[tier]}
          </span>
          <span className="font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">{count}</span>
        </h3>
        <p className="m-0 pl-4 text-[12px] leading-[16px] text-[var(--text-tertiary)]">{TIER_CADENCE[tier]}</p>
      </div>
      {action}
    </div>
  );
}

/** A glyph and a tabular mono count. Zero is `text-disabled`; tone is spent
 *  only where the pack allows it (T1 flags and escalations, T2 surge flags). */
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
  /** On a t1 / t2 tint a zero is SECONDARY, not disabled: the pack wants text
   *  on the tints at 4.5:1, and text-disabled measures 1.77:1 on t2-soft.
   *  Off a tint it is TERTIARY, the quietest ink that is still text: the port
   *  had `--state-inactive` there (a disabled FILL), measured 2.1:1 on a
   *  raised row and 1.91:1 on a Tier 4 row — a "0" is content, not chrome. */
  onTint?: boolean;
}) {
  const zero = count === 0;
  const ink = zero
    ? onTint
      ? "text-[var(--text-secondary)]"
      : "text-[var(--text-tertiary)]"
    : tone === "t1"
      ? "text-[var(--t1-ink)]"
      : tone === "t2"
        ? "text-[var(--t2-ink)]"
        : "text-[var(--text-primary)]";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", ink)}>
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
      <span className="font-mono text-[13px] tabular-nums">{count}</span>
      {suffix}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export const FLAG = Flag;
export const ESCALATION = ShieldAlert;
export const SURVEY = ClipboardList;
