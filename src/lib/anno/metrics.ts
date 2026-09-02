// THE INSTRUMENTATION THE PRD REQUIRES AND DOES NOT SPECIFY.
//
// ═══ WHY THIS FILE EXISTS ═══
//
// The PRD sets a kill criterion — "stop if the orphan rate exceeds 10%" — and
// defines nothing that measures it. A threshold with no instrument is not a
// criterion, it is an intention: nobody can enforce it, and the first time
// anyone asks "what IS the orphan rate" the answer is a guess. So the counter is
// built before the UI, and the number it produces is what the anno-02 gate is
// decided on.
//
// ═══ WHAT COUNTS AS AN ORPHAN, PRECISELY ═══
//
// Only tier 3 — the tagged region could not be found. Deliberately NOT counted:
//
//   • OFFSCREEN pins. The anchor resolved; the element is scrolled out of its
//     container. Counting these would make the rate a function of where the
//     reader happened to leave the scrollbar.
//   • Pins on a route other than the current one. They have no DOM to resolve
//     against here, which is not the same as failing to resolve.
//
// Both exclusions make the rate HARDER to satisfy, not easier — they keep the
// denominator honest rather than padding it with pins that were never at risk.

import type { ResolutionTier } from "@/lib/anno/anchor";

export type TierCounts = {
  total: number;
  tier1: number;
  tier2: number;
  orphan: number;
  /** Resolved, but not paintable right now. Excluded from `orphan`. */
  offscreen: number;
  /** Not evaluated — a pin belonging to a different route. */
  skipped: number;
};

export type TierReport = TierCounts & {
  /** Orphans as a percentage of pins actually evaluated on this route. */
  orphanRate: number;
  /** The PRD's kill criterion. */
  exceedsKillCriterion: boolean;
};

export const KILL_CRITERION = 10; // percent

export function emptyCounts(): TierCounts {
  return { total: 0, tier1: 0, tier2: 0, orphan: 0, offscreen: 0, skipped: 0 };
}

export function record(
  counts: TierCounts,
  tier: ResolutionTier,
  offscreen: boolean
): TierCounts {
  const next = { ...counts, total: counts.total + 1 };
  if (tier === 1) next.tier1 += 1;
  else if (tier === 2) next.tier2 += 1;
  else next.orphan += 1;
  if (offscreen) next.offscreen += 1;
  return next;
}

export function recordSkipped(counts: TierCounts): TierCounts {
  return { ...counts, total: counts.total + 1, skipped: counts.skipped + 1 };
}

export function report(counts: TierCounts): TierReport {
  /* THE DENOMINATOR IS EVALUATED PINS, not every pin in the store. A pin on
     another route was never given a chance to resolve, so including it would
     dilute the rate toward zero and make the criterion unfireable. */
  const evaluated = counts.total - counts.skipped;
  const orphanRate = evaluated === 0 ? 0 : (counts.orphan / evaluated) * 100;
  return {
    ...counts,
    orphanRate: Math.round(orphanRate * 10) / 10,
    exceedsKillCriterion: orphanRate > KILL_CRITERION,
  };
}

/** Merge counts across routes / phases for a whole-exercise figure. */
export function merge(a: TierCounts, b: TierCounts): TierCounts {
  return {
    total: a.total + b.total,
    tier1: a.tier1 + b.tier1,
    tier2: a.tier2 + b.tier2,
    orphan: a.orphan + b.orphan,
    offscreen: a.offscreen + b.offscreen,
    skipped: a.skipped + b.skipped,
  };
}

export function formatReport(r: TierReport): string {
  return [
    `total ${r.total}`,
    `tier1 ${r.tier1}`,
    `tier2 ${r.tier2}`,
    `orphan ${r.orphan}`,
    `offscreen ${r.offscreen}`,
    `skipped ${r.skipped}`,
    `orphanRate ${r.orphanRate}%`,
    r.exceedsKillCriterion ? "KILL CRITERION EXCEEDED" : "within criterion",
  ].join(" · ");
}
