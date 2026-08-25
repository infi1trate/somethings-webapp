"use client";

// SCORE SPARKLINE — the page's ONLY data-viz, and it is deliberately the least
// chart-like thing that still shows a trajectory: no axes, no gridlines, no
// labels, no tooltip, no fill, one muted stroke, and a single dot on the latest
// point. Trajectory is what a supervisor actually assesses; three numbers in a
// column make them do the differencing themselves.
//
// THREE POINTS IS THE FLOOR. The brief asked for 4–6; only two teens in the
// roster have four or more, so at that floor this renders on 2 records out of 26
// and cannot be judged. At three it reaches six records and a two-point segment
// — which is a line, not a trend — never renders. Below three, nothing renders
// at all: no empty slot, no placeholder.
//
// ONE INSTRUMENT ONLY. PHQ-9 tops out at 27 and GAD-7 at 21, so plotting them on
// one line would put two different scales on one stroke. The caller passes a
// single instrument's series; if a teen ever switches instrument mid-course, the
// locked-instrument rule in `cadenceFor` means the series is the locked one.
//
// NOT NORMALISED TO ZERO. The stroke spans the series' own min and max, because
// the question a supervisor is asking is "which way and how sharply", not "how
// close to the instrument's ceiling". A flat series renders as a flat line
// through the middle rather than collapsing onto an edge.
//
// NO GRADIENTS, NO SHADOW — house rules, and there is nothing here that wants
// either.

const W = 64;
const H = 20;
const PAD = 2;

export const SPARKLINE_MIN_POINTS = 3;

export function ScoreSparkline({
  scores,
  label,
}: {
  /** Oldest → newest. */
  scores: number[];
  /** For the accessible name — the visual carries no text at all. */
  label: string;
}) {
  if (scores.length < SPARKLINE_MIN_POINTS) return null;

  // Last six, so a long series stays readable at 64px rather than turning into
  // a comb.
  const series = scores.slice(-6);
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;

  const pts = series.map((v, i) => {
    const x = PAD + (i * (W - PAD * 2)) / (series.length - 1);
    // Inverted: a HIGHER score is a worse score on both instruments, and a line
    // that climbs when things worsen is the direction every clinician expects.
    const y = PAD + ((max - v) * (H - PAD * 2)) / span;
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={label}
      className="shrink-0 overflow-visible"
    >
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The latest point, marked. Ringed in the card surface so it reads as
          sitting on the stroke rather than punched through it. */}
      <circle
        cx={last[0]}
        cy={last[1]}
        r="2.5"
        fill="var(--text-primary)"
        stroke="var(--surface-card)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
