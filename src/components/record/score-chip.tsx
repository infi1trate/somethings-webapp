"use client";

// SCORE CHIP — ONE component, three consumers (Prompt B Phase 2 / Prompt C
// Phase 2): the review card's survey evidence, the care summary's Last
// assessment cell, and History's Result column. The brief is explicit that this
// is one component and not two, because a score that reads "11 · Moderate" in
// one place and "11 — moderate" in another makes a reader wonder whether they
// are the same measurement.
//
// DELIBERATELY NOT TINTED BY SEVERITY. The obvious design is to colour the chip
// by band — amber for moderate, red for severe — and it is wrong here. Tinted
// fills on this page are reserved for OPEN ESCALATIONS AND RISK FLAGS. A PHQ-9
// in the moderate band is a measurement, not an alarm; painting it in the
// warning family would put alarm chrome on the most common row in the history
// table, and then the one row that IS an alarm has nothing left to say. The band
// name carries the severity, in words, which is also the only version a screen
// reader or a monochrome print can use.
//
// The band NAME is capitalised here and lower-case in the timeline's prose
// ("11 — moderate"), because a chip is a label and prose is a sentence.

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

/** Is this a band this codebase knows? Used only by the dev-time check below. */
export function isKnownBand(severity: string): boolean {
  return (BAND_ORDER as readonly string[]).includes(severity.trim().toLowerCase());
}

export function ScoreChip({
  score,
  severity,
  className,
}: {
  score: number;
  /** The instrument's own band name, as stored ("moderate"). */
  severity: string;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface-s1)] px-2.5 py-0.5",
        "text-[13px] leading-[18px] text-[var(--text-primary)]",
        className ?? "",
      ].join(" ")}
    >
      <span className="font-semibold tabular-nums">{score}</span>
      <span aria-hidden className="text-[var(--text-muted)]">
        ·
      </span>
      <span>{bandLabel(severity)}</span>
    </span>
  );
}
