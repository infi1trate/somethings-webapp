"use client";

// SCORE CHIP — ONE component, now three consumers: the care summary's Last
// assessment metric, the review card's survey evidence, and History's Result
// column. The brief is explicit that this is one component and not two, because
// a score reading "11 · Moderate" in one place and "11 — moderate" in another
// makes a reader wonder whether they are the same measurement.
//
// A thin wrapper over TonalChip since that primitive landed — see its note for
// why score bands stay neutral rather than colour-coded.
//
// The band NAME is capitalised here and lower-case in the timeline's prose,
// because a chip is a label and prose is a sentence.

import { TonalChip } from "@/components/record/tonal-chip";

const BAND_ORDER = [
  "minimal",
  "mild",
  "moderate",
  "moderately severe",
  "severe",
] as const;

/** Capitalise a band name for chip use. Unknown bands pass through rather than
 *  being forced into the list — a real instrument may add one. */
export function bandLabel(severity: string): string {
  const s = severity.trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Is this a band this codebase knows? */
export function isKnownBand(severity: string): boolean {
  return (BAND_ORDER as readonly string[]).includes(severity.trim().toLowerCase());
}

export function ScoreChip({
  score,
  severity,
  className,
}: {
  score: number;
  /** The instrument's own band name, as stored ("moderate"). Banded upstream by
   *  `severityFor`, which holds the PHQ-9 and GAD-7 cut-points — the chip never
   *  re-derives a band, so two surfaces cannot disagree about one. */
  severity: string;
  className?: string;
}) {
  return (
    <TonalChip mono className={className}>
      <span className="font-semibold">{score}</span>
      <span aria-hidden className="opacity-45">
        ·
      </span>
      <span>{bandLabel(severity)}</span>
    </TonalChip>
  );
}
