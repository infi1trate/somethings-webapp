// ═══════════════════════════════════════════════════════════════════════════
// THE TIER DECISION'S CTA — its words, as a pure function (pack v10.0)
//
// `TierSelect` relabels its one filled button live, so the consequence of
// the checked row is always spelled out before it is committed. Pure, so the
// live region can say the NEXT label in the same handler that changes it,
// and so every path is a unit test rather than a probe. TODO-COPY, all.

import { TIER_NAME, type Tier } from "@/lib/tiering/tiers";

export type TierCtaContext =
  | { mode: "raise" }
  | { mode: "review"; kind: "confirm" | "update"; current: Tier | null; requested: Tier | null };

export function tierCta(c: TierCtaContext, tier: Tier | null): string {
  if (c.mode === "raise") return "Confirm escalation";
  if (tier === null) return "Choose a tier";
  /* Confirming a request — the escalation's, or a pending one in update —
     names the tier in full: "Confirm Tier 2 · High risk". */
  if (c.kind === "confirm" || c.requested === tier) return `Confirm Tier ${tier} · ${TIER_NAME[tier]}`;
  /* Update with the current tier checked would be a no-op: the button says
     what is missing instead, and stays pressable (it names the gap). */
  if (tier === c.current) return "Choose a new tier";
  return `Update to Tier ${tier}`;
}
