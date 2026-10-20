// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — THE TIERS, IN ONE PLACE (proto/monitoring-merge)
//
// The stepped-care tiers as the Monitoring page states them. PENDING the
// tiering doc (reference/stepped-care-tiering.md is not in the repo yet):
// these follow the pack's §5, and every string a tier says lives here so
// the doc can be swapped in by editing this file alone.
//
// ═══ THE EXIT RULE IS THE OCT FLOW'S ═══ Tier 1 and Tier 2 both exit to
// Tier 3 (a crisis note, a high-risk note). The tiering doc says T1 → T2;
// the flow is what the prototype follows. One line: `EXITS_TO`.

export type Tier = 1 | 2 | 3 | 4;

export const TIER_NAME: Record<Tier, string> = {
  1: "Active crisis",
  2: "High risk",
  3: "Monitoring",
  4: "General",
};

/** The group header's cadence line. TODO-COPY, all four. */
export const TIER_CADENCE: Record<Tier, string> = {
  1: "Respond in under 60s · exits via crisis note",
  2: "Live coaching · 4h review on automated flags · 7-day minimum",
  3: "7-day update note · 14-day quiet period",
  4: "Passive",
};

/** Where a tier steps down to. The Oct flow: T1 and T2 → T3. */
export const EXITS_TO: Partial<Record<Tier, Tier>> = { 1: 3, 2: 3, 3: 4 };

/** Minimum days in tier, where a tier has one. */
export const TIER_MINIMUM_DAYS: Partial<Record<Tier, number>> = { 2: 7, 3: 14 };

/** The response window a Tier 1 alert counts down from. */
export const T1_RESPONSE_SECONDS = 60;

/* ═══ THE SIGNIFIER, AND NOTHING ELSE ═══ Tier is a ring, a lozenge and a
   surface, together (WCAG 1.4.1). No coloured bars or left borders. Alert
   colour is spent on Tiers 1 and 2 only. */
export const TIER_RING: Record<Tier, string | null> = {
  1: "var(--t1)",
  2: "var(--t2)",
  3: "var(--text-secondary)",
  4: null,
};
