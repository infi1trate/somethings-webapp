"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TIER LOZENGE (proto/monitoring-merge) — shared
//
// A stepped-care tier, said in words: `T2` in a list, `T2 · High risk` on a
// card. Mono 11px. T1 / T2 are filled with their AA ink (`--t1-ink`,
// `--t2-ink`) under `--text-inverse` — white in light, and warmGrey/950 in
// dark, where the inks are light steps and white on them failed axe; T3 is
// outlined secondary; T4 outlined
// border-default with tertiary text. The text is what makes tier never
// colour alone (WCAG 1.4.1).

import { TIER_NAME, type Tier } from "@/lib/monitoring/tiers";
import { cn } from "@/lib/utils";

export function TierLozenge({
  tier,
  long = false,
  legend,
}: {
  tier: Tier;
  long?: boolean;
  /** ═══ THE LEGEND PAIR (TierSelect, amendment v10.1) ═══ An outline ↔
   *  filled state at all four tier colours, from the scoped
   *  `--tier-legend-{n}-ink` tokens — the selection indicator of a tier
   *  card, and nothing else. Omitted everywhere outside TierSelect, where
   *  the lozenge keeps its one canonical look above. */
  legend?: "outline" | "filled";
}) {
  if (legend) {
    return (
      <span
        data-tier-lozenge={tier}
        data-lozenge-state={legend}
        className="inline-flex h-5 shrink-0 items-center rounded-full border px-2 font-mono text-[11px] leading-none whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none"
        style={
          legend === "filled"
            ? /* FCP-3: the tier's bright step under near-black, both themes. */
              { borderColor: "transparent", backgroundColor: `var(--tier-legend-${tier}-fill)`, color: `var(--tier-legend-${tier}-fill-ink)` }
            : { borderColor: `var(--tier-legend-${tier}-ink)`, backgroundColor: "transparent", color: `var(--tier-legend-${tier}-ink)` }
        }
      >
        T{tier}
        {long && ` · ${TIER_NAME[tier]}`}
      </span>
    );
  }
  return (
    <span
      data-tier-lozenge={tier}
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border px-2 font-mono text-[11px] leading-none whitespace-nowrap",
        tier === 1 && "border-transparent bg-[var(--t1-ink)] text-[var(--text-inverse)]",
        tier === 2 && "border-transparent bg-[var(--t2-ink)] text-[var(--text-inverse)]",
        tier === 3 && "border-[color:var(--text-secondary)] text-[var(--text-secondary)]",
        tier === 4 && "border-[color:var(--border-default)] text-[var(--text-tertiary)]"
      )}
    >
      T{tier}
      {long && ` · ${TIER_NAME[tier]}`}
    </span>
  );
}
