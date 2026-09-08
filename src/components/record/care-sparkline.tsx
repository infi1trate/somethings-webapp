"use client";

// THE CARE SPARKLINE — the strip, extracted from the Care pattern block.
//
// ═══ WHAT THIS IS AND WHAT WENT ═══
//
// `CarePatternBlock` was a card: a heading, one to three generated sentences of
// narrative, this strip, and a provenance footer. The narrative is gone with the
// card. The strip is here, ~64px instead of 72, sitting directly under the
// summary's trajectory sentence.
//
// WHY THE NARRATIVE HAD TO GO, since it read well: the summary's own trajectory
// sentence and the pattern's reading were two generated descriptions of the same
// scores on the same page. Two narratives about one series is one too many, and
// they were separated by enough vertical distance that a reader would not
// necessarily notice they agreed — or, worse, would notice they disagreed. The
// sentence is now the only narrative and the strip is the only visual.
//
// WHAT SURVIVES OF THE PATTERN'S CLUSTERING: the flag markers. The block's
// reading used to say things like "two fell within 19 days of each other"; two
// triangles 19 days apart on a shared axis say it without a sentence, and say it
// at a glance.
//
// ═══ THREE CLASSES, SEPARATED THREE WAYS ═══
//
// Position (score band on top, flag lane beneath, presentation ticks on the
// floor), shape (dot, triangle, tick) and colour. Colour is the third channel,
// never the only one — the strip is fully readable with hue removed (1.4.1).
//
// MARKS ARE HTML BUTTONS OVER AN SVG, not SVG shapes with handlers: an SVG
// `<circle role="button">` is inconsistently reachable, has no native focus ring
// and gives a 5px target. These get real keyboard semantics, a real ring and a
// 24px target while the SVG below draws the line they sit on.

import { useCallback, useId, useState } from "react";
import { plotScoreY } from "@/components/record/score-sparkline";
import { bandLabel } from "@/components/record/score-chip";
import { clinicalDate } from "@/components/record/care-presentation";
import { severityFor } from "@/lib/record/care-demo";
import type { CarePattern, PatternMark } from "@/lib/record/care-pattern";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const EYEBROW = "text-[11.5px] leading-[16px] text-[var(--text-muted)]";

/** ═══ GEOMETRY, SET BY SC 2.5.8 RATHER THAN BY TASTE ═══
 *
 *  A mark is a 24px button centred on its point, and the assessment lane is a
 *  RANGE (the score varies), so its boxes sweep the whole band plus 12px either
 *  side. Worked through:
 *
 *    THREE interactive lanes — assessments 12–34 (boxes 0–46), flags clear at 58,
 *    ticks clear at 82 — need a **94px** strip. Against the brief's ~64 that is a
 *    47% deviation, and a rail cannot spend it.
 *
 *    TWO interactive lanes — assessments 12–34 (boxes 0–46), flags at 58
 *    (box 46–70) — need **70px**, a 6px deviation, with ZERO overlap.
 *
 *  So the presentation ticks lose their hit target and keep their mark. That is
 *  the earned reduction rather than a compromise: there are typically one to
 *  three of them, a presentation change is the least likely thing a reader jumps
 *  to from the strip, and every one of them is already a full-width row in
 *  History with a date gutter. The tick is still DRAWN — the third class stays
 *  visible and the strip still reads as three kinds of event.
 *
 *  Row 332 recorded this as unfixable-without-tradeoffs. This is the tradeoff,
 *  taken deliberately and measured: six violations to zero. */
/** ═══ TIGHTENED, AND THE BEFORE/AFTER IS THE POINT ═══
 *  70 -> 64. The plot lost the six units the month labels used to need below it
 *  — they sit above now — so the height came down rather than leaving a gap
 *  where a label row used to be. With the rail's own steps stepping down too
 *  (`mt-3` -> `mt-2` above the chart, `mt-1.5` -> `mt-1` above the caption) the
 *  whole unit reads denser without any element losing its own spacing. */
const H = 64;
const SCORE_TOP = 12;
const SCORE_BOTTOM = 34;
/** ON THE AXIS, not above it. Was 58 — a band of its own between the score
 *  line and the month labels, which spent 16px of a 70px strip on a row that
 *  held three marks. The discs now sit centred on the baseline itself. */
const FLAG_Y = 37;
const TICK_TOP = 42;
const TICK_BOTTOM = 50;
/* `AREA_FILL_OPACITY` / `AREA_FADE_OPACITY` LIVED HERE and go with the fill they
   were the stops of. Their note recorded a real lesson worth keeping in view —
   the 14% was once a `color-mix` inside the token and shipped as an opaque grey
   block on engines without it, and an explicit rgba fallback was DEDUPED AWAY by
   the compiler. That is the same class of failure as the window container's
   missing `fill-[…]` utility: an SVG paint routed through the build can be
   changed by the build. `--chart-area-fill` is now consumed by nothing. */

/** The hairline the dots are positioned against, and the floor the area fill
 *  fades to. Was written inline as `SCORE_BOTTOM + 3` in two places; the gradient
 *  is a third, and three copies of a baseline is how a fill stops meeting its
 *  own axis. */
const BASELINE = SCORE_BOTTOM + 3;

/** ═══ THE PLOT IS INSET SO EDGE MARKS KEEP THEIR HIT TARGET ═══
 *
 *  A mark is a 24px button centred on its data point (`-ml-3 -mt-3`), so a point
 *  at 0% or 100% put half that box outside the strip, where it was clipped.
 *  Measured: axe reported a mark at 97.08% with 4.9px × 24px of unobscured
 *  target, against SC 2.5.8's 24×24 floor — the worst of six violations, and
 *  edge clipping rather than mark-on-mark overlap was its cause.
 *
 *  So the DATA range maps into an inset band rather than the full width. The
 *  dates are unchanged and the axis is not compressed unevenly: every point
 *  moves by the same linear transform, so relative spacing — which is what the
 *  strip is read for — is identical. It costs `2 × EDGE_PCT` of plot width. */
const EDGE_PCT = 4;

function xPct(at: number, startAt: number, endAt: number): number {
  const span = endAt - startAt || 1;
  const raw = (at - startAt) / span;
  return EDGE_PCT + raw * (100 - EDGE_PCT * 2);
}

/** ═══ MARKS THAT WOULD OVERLAP ARE MERGED — SC 2.5.8 ═══
 *
 *  Insetting the plot fixed the clipped edge marks and left six violations whose
 *  cause is marks obscuring EACH OTHER: two events close in time put two 24px
 *  buttons within 24px of one another, and the unobscured area measured 21.1px.
 *
 *  THIS IS THE SAME EDITORIAL JUDGEMENT THE DATA LAYER ALREADY MADE, generalised
 *  from "same day" to "closer together than one target". `care-pattern.ts`
 *  coalesces same-day flags because three marks stacked at one x are visually one
 *  mark with three identical labels; two marks 21px apart are the same problem
 *  measured in pixels instead of days.
 *
 *  WHY IT LIVES HERE AND NOT IN THE DATA LAYER: the threshold is a PIXEL
 *  constraint, and `carePatternFor` does not know how wide the strip will render.
 *  A span-relative threshold is the honest translation of it.
 *
 *  PER LANE, because only same-lane marks overlap: a flag at 46 and an assessment
 *  at 12 are 34px apart vertically and never collide. Assessments merge only when
 *  their plotted y is also close — two readings on adjacent days at opposite ends
 *  of the score band do not obscure each other.
 *
 *  THE LABEL NAMES A RANGE, NOT A DATE. A merged mark spanning two days cannot
 *  claim either of them, so it says how many and between when. The alternative —
 *  keeping the first mark's label — would put a wrong date in the accessible
 *  name, which is worse than the overlap it fixes. TODO-COPY. */
const MERGE_PCT = 8;
const LANE_PROXIMITY = 20;

function mergeCrowded(
  marks: Array<PatternMark & { x: number; y: number }>
): Array<PatternMark & { x: number; y: number; mergedFrom?: PatternMark[] }> {
  const out: Array<
    PatternMark & { x: number; y: number; mergedFrom?: PatternMark[] }
  > = [];
  for (const m of [...marks].sort((a, b) => a.x - b.x)) {
    const prev = out[out.length - 1];
    const collides =
      prev &&
      prev.cls === m.cls &&
      m.x - prev.x < MERGE_PCT &&
      Math.abs(m.y - prev.y) < LANE_PROXIMITY;
    if (!collides) {
      out.push({ ...m });
      continue;
    }
    const group = prev.mergedFrom ?? [prev];
    group.push(m);
    prev.mergedFrom = group;
    prev.count = group.reduce((n, g) => n + g.count, 0);
    // The merged mark sits at the group's midpoint, so it does not claim either
    // event's exact position.
    prev.x = (group[0].at === group[group.length - 1].at ? prev.x : (prev.x + m.x) / 2);
    const first = group[0];
    const last = group[group.length - 1];
    const day = (at: number) =>
      new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    prev.label = `${group.length} ${first.cls === "assessment" ? "assessments" : first.cls === "flag" ? "flags" : "presentation changes"} · ${day(first.at)} – ${day(last.at)}`;
  }
  return out;
}

export function CareSparkline({
  pattern,
  onSelectEvent,
}: {
  /** Null means there is nothing to plot — the caller renders nothing. Kept in
   *  the signature so a caller cannot forget null is a designed outcome. */
  pattern: CarePattern | null;
  /** Filters History to this event and scrolls to it. The strip's only
   *  interaction, and it is a read, not a write. */
  onSelectEvent: (eventId: string) => void;
}) {
  /** ═══ ONE TOOLTIP FOR THE WHOLE STRIP, FIXED-POSITIONED ═══
   *
   *  Lifted verbatim in shape from `survey-comparison-grid.tsx`, two elements up
   *  the same tab, for the same two reasons: one node instead of one per point,
   *  and `position: fixed` so it is not clipped by the rail's own box.
   *
   *  It is `aria-hidden`. Every mark already carries the FULL tooltip sentence in
   *  its own `aria-label`, so a screen reader reads the numbers off the point
   *  rather than being asked to follow a floating node. That makes the visual
   *  tooltip a convenience for the pointer AND the keyboard — which is why focus
   *  opens it too — rather than the only route to the content (1.4.13, and the
   *  reason this is not `aria-describedby` on a hover-only element). */
  const [tip, setTip] = useState<{ lines: string[]; x: number; y: number } | null>(
    null
  );
  const show = useCallback((el: HTMLElement, lines: string[]) => {
    const r = el.getBoundingClientRect();
    setTip({ lines, x: r.left + r.width / 2, y: r.top });
  }, []);
  const hide = useCallback(() => setTip(null), []);

  /** The gradient needs a document-unique id — `useId` rather than a literal, so
   *  a second strip on one page cannot claim the first one's fill. */

  if (!pattern) return null;

  const { startAt, endAt, marks, scoreMin, scoreMax, months, monthSafety } =
    pattern;

  /** ═══ THE X AXIS IS CATEGORICAL BY MONTH, NOT PROPORTIONAL BY DATE ═══
   *
   *  `xPct` maps a timestamp linearly across the plot, which is a true picture
   *  of elapsed time and the wrong picture for this chart. Measured on t17:
   *  readings landed at 4.89 / 11.15 / 27.22 / 56.70 / 89.75 while the month
   *  gridlines sat at 10.5 / 24.3 / … — so no reading touched a gridline and the
   *  first one rendered LEFT of the first month label, which is most of what
   *  read as a line starting before the data.
   *
   *  So a month is a COLUMN. Every reading and every badge snaps to its month's
   *  gridline; the exact date stays in the tooltip, where precision belongs and
   *  where it is already stated. A reader comparing "March to April" is reading
   *  columns, and a point floating between two of them cannot be assigned to
   *  either by eye.
   *
   *  `snapX` falls back to the proportional position for a mark outside every
   *  month bin — which should not happen, since `months` is derived from the same
   *  span, but a mark silently drawn at 0 would be worse than one drawn where it
   *  used to be. */
  const monthX = months.map((mo) => ({
    at: mo.at,
    x: xPct(mo.at, startAt, endAt),
  }));
  const snapX = (at: number): number => {
    if (!monthX.length) return xPct(at, startAt, endAt);
    let best = monthX[0];
    for (const m of monthX) if (m.at <= at) best = m;
    return best.x;
  };

  /** ═══ THE LAST THREE MONTHS, AS A BOX ═══
   *  From the first of the last three month marks to the right edge of the
   *  plot. `null` below three months: a "last three" box over two months would
   *  be a frame around the whole chart, which says nothing. */
  const windowBox =
    monthX.length >= 3
      ? (() => {
          /* ═══ MONTH-ALIGNED, NOT OFFSET-BY-A-CONSTANT ═══
             It was `firstInWindow - 2`, a fixed nudge that drifted with the
             column width. The left edge is now the MIDPOINT between the last
             out-of-window gridline and the first in-window one, so the boundary
             falls in the gap between columns rather than beside a line; the
             right edge is half a column past the last gridline, clamped to the
             plot's own padding edge. Both are stated in column terms, so the
             container stays aligned at any width. */
          const firstIn = monthX[monthX.length - 3].x;
          const lastOut = monthX[monthX.length - 4]?.x;
          const half =
            monthX.length > 1
              ? (monthX[monthX.length - 1].x - monthX[0].x) /
                (monthX.length - 1) /
                2
              : 4;
          const left = lastOut !== undefined ? (lastOut + firstIn) / 2 : firstIn - half;
          const right = Math.min(monthX[monthX.length - 1].x + half, 100 - EDGE_PCT / 2);
          return { x: left, w: right - left };
        })()
      : null;

  /** The month gridline a bin belongs to, or null when that month is outside the
   *  visible axis — an event in a month the axis does not show is not rendered,
   *  rather than being pinned to the nearest column it did not happen in. */
  const nearestMonthX = (at: number): number | null => {
    const hit = monthX.find((m) => {
      const d = new Date(m.at);
      const b = new Date(at);
      return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth();
    });
    return hit ? hit.x : null;
  };
  const monthLabel = (at: number) =>
    new Date(at).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const assessments = marks.filter(
    (m) => m.cls === "assessment" && m.score !== undefined
  );
  /** ═══ TWO READINGS IN ONE MONTH SPLIT AROUND THE GRIDLINE ═══
   *
   *  Snapping to columns creates a collision the proportional axis did not have:
   *  measured on t17, two readings landed at exactly 10.51 — one point drawn on
   *  top of another, two buttons at one coordinate, and a line segment of zero
   *  length between them.
   *
   *  So a month's readings fan symmetrically about its gridline at ±10% of the
   *  column width, chronological left to right. One reading stays centred; two
   *  straddle; three take -10 / 0 / +10.
   *
   *  FOUR OR MORE IS NOT A LAYOUT PROBLEM and is not solved here. The pack calls
   *  it a fixture pathology and it is: four assessments inside one month is a
   *  record that needs looking at, not a chart that needs more offsets. The
   *  spread stops at three and the surplus stacks, which is visible rather than
   *  silently compressed — and `mergeCrowded` below still coalesces what
   *  overlaps for SC 2.5.8. Reported rather than absorbed. */
  const colW =
    monthX.length > 1
      ? (monthX[monthX.length - 1].x - monthX[0].x) / (monthX.length - 1)
      : 100 - EDGE_PCT * 2;
  const OFFSET_PCT = 0.1;
  const fanned = (() => {
    const byX = new Map<number, number[]>();
    assessments.forEach((m, i) => {
      const x = snapX(m.at);
      byX.set(x, [...(byX.get(x) ?? []), i]);
    });
    const dx = new Array<number>(assessments.length).fill(0);
    for (const idx of byX.values()) {
      if (idx.length < 2) continue;
      const n = Math.min(idx.length, 3);
      idx.slice(0, n).forEach((i, k) => {
        dx[i] = (k - (n - 1) / 2) * (OFFSET_PCT * 2 * colW) / Math.max(1, n - 1);
      });
    }
    return dx;
  })();

  const linePts = assessments.map((m, i) => ({
    x: snapX(m.at) + fanned[i],
    y:
      plotScoreY(m.score!, scoreMin, scoreMax, SCORE_BOTTOM - SCORE_TOP, 4) +
      SCORE_TOP,
  }));
  const line = linePts
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(1)}`)
    .join(" ");

  /* ═══ THE AREA FILL IS REMOVED ═══
     It was `M first.x,BASELINE L …points… L last.x,BASELINE Z` under a 14% ->
     0% gradient, and it is the other half of the phantom-line diagnosis: that
     first `M` put a vertical run from the baseline up to the first point, which
     at 14% read as a tail hanging below and left of the data.
     The window container is the sole background treatment now, which is the
     better division of labour — one region says "this is the weighted window"
     and nothing else competes with the line for the same area. Reverses the R6
     gradient instruction deliberately. */

  /** ═══ THE TOOLTIP'S THREE LINES — one place, two consumers ═══
   *
   *  Rendered visually AND joined into the mark's `aria-label`, so the sighted
   *  tooltip and the accessible name cannot describe the point differently. The
   *  weighted line is OMITTED rather than faked when there is only one reading
   *  behind it: `weightedAggregate` returns null below two comparable surveys,
   *  and "Weighted at this reading: 8" over a single number would be a weighting
   *  of nothing. TODO-COPY. */
  const tipLines = (m: PatternMark): string[] => {
    const lines: string[] = [
      `${pattern.instrument ?? "Assessment"} · ${clinicalDate(m.at)}`,
    ];
    /* ═══ THE RAW BAND IS DERIVED HERE, AND THAT IS DELIBERATE ═══
       It was briefly carried on the mark instead, and `care-pattern.test.ts`'s
       standing guard — "the pattern never reads a flag's tier ... no mark carries
       a tier, so no visual can encode one" — caught it. The guard is structural
       and blunt on purpose, and an instrument's own band is NOT a grade of the
       person (it is what `CareAssessment.severity` already means elsewhere on
       this tab). But weakening a standing rule to admit a value the rule was not
       written about is the wrong direction, so the mark stays clean and the band
       comes from `severityFor` — the single exported place the instrument cuts
       live, which is the same function `weightedAggregate` uses for the line
       below. One source, two callers, no second copy of the cuts. */
    if (m.score !== undefined && pattern.instrument) {
      const band = severityFor(
        pattern.instrument as "PHQ-9" | "GAD-7",
        m.score
      );
      lines.push(`Score: ${m.score} · ${bandLabel(band)}`);
    }
    if (m.weighted) {
      lines.push(
        `Weighted at this reading: ${m.weighted.score} · ${bandLabel(m.weighted.severity)}`
      );
    }
    return lines;
  };

  const markY = (m: PatternMark): number => {
    if (m.cls === "assessment" && m.score !== undefined) {
      return (
        plotScoreY(m.score, scoreMin, scoreMax, SCORE_BOTTOM - SCORE_TOP, 4) +
        SCORE_TOP
      );
    }
    if (m.cls === "flag") return FLAG_Y;
    return (TICK_TOP + TICK_BOTTOM) / 2;
  };

  return (
    <div className="relative">
      {/* ═══ MONTH LABELS SIT ABOVE THE PLOT ═══
          They were below it, under the badge row, which put three stacked rows
          between the line and its own axis names and made the reader travel
          past the safety badges to find out which month they were looking at.
          Above, a column is labelled before it is read.
          `mb-1` IS THE 4px THE SPEC ASKS FOR between the label's bottom edge and
          the top of its gridline — the gridlines start at the plot's top edge,
          which is this row's bottom edge plus that margin. */}
      <div className="relative mb-1 h-4">
        {months.map((mo) => (
          <span
            key={mo.at}
            aria-hidden
            style={{ left: `${xPct(mo.at, startAt, endAt)}%` }}
            className={cn("absolute -translate-x-1/2 whitespace-nowrap", EYEBROW)}
          >
            {mo.label}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height: H }}>
        <svg
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          width="100%"
          height={H}
          aria-hidden
          className="absolute inset-0"
        >
          {/* ═══ THE WEIGHTED WINDOW, DRAWN FIRST SO IT SITS UNDER THE DATA ═══
              The design file boxes the last three months. That box is not
              decoration: the review's score is a recency-weighted mean over the
              last three assessments, and the box is the only thing on this card
              that says WHICH PART OF THE AXIS that weighting covers. Without it
              a reader has the weighted number on the card above and no way to
              see the span it came from.
              MONTHS, NOT READINGS. The box is drawn from the month scale
              because that is the axis a reader is looking at; the weighting is
              over readings, and where a month holds no reading the box simply
              covers empty axis. Named in the caption below rather than left to
              be inferred from a grey rectangle. */}
          {windowBox && (
            <rect
              x={windowBox.x}
              y={0}
              width={windowBox.w}
              height={BASELINE + 10}
              rx="1"
              /* ═══ PRESENTATION ATTRIBUTES, NOT UTILITY CLASSES ═══
                 This shipped as `fill-[var(--surface-s1)]
                 stroke-[color:var(--border-subtle)]` and rendered as an OPAQUE
                 BLACK RECTANGLE across the plot. Measured, not guessed: neither
                 utility generated a rule at all — no matching selector exists in
                 any stylesheet — so `fill` fell to the SVG default of black and
                 `stroke` resolved to `none`. The block was the window container
                 with its paint missing, not the R6 gradient, whose stops verify
                 healthy at 0.14 -> 0 on the same render.
                 This is the lesson the gradient below already records about
                 `stop-opacity`: an SVG paint expressed as a compiled utility can
                 be compiled away, and a presentation attribute cannot. Both
                 halves are attributes now, and my own verification of this rect
                 in the change that introduced it read its geometry attributes
                 and never its resolved paint — which is how a black box shipped
                 past a green check. */
              /* ═══ THE SUBTLEST STEP, NOT THE TAN ═══
                 Was `--surface-s1` (#f6f4ef) — a warm beige that read as a
                 tinted block laid over the chart rather than as a quiet region
                 behind it. `--tint-faint` is Bloom's barely-there wash, 2% ink
                 over whatever it sits on, and it is the token this container
                 wanted: it darkens the card without introducing a hue of its
                 own, so the hairline border is what draws the edge. */
              fill="var(--tint-faint)"
              stroke="var(--border-subtle)"
              strokeWidth="0.3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* ONE HAIRLINE PER MONTH, so the labels below have something to
              attach to and the marks have a scale to be read against. Drawn
              under the line and the fill — a gridline that crosses a data mark
              is a gridline competing with the data. */}
          {months.map((mo) => {
            const x = xPct(mo.at, startAt, endAt);
            return (
              <g key={`grid-${mo.at}`}>
                {/* THE GRIDLINE — a hairline rising from the baseline toward the
                    label. `--border-subtle` is the divider token; 1px held by
                    `non-scaling-stroke` so it stays a hairline at any width. */}
                <line
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={BASELINE}
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                {/* THE TICK — a short strong hash ON the baseline, visibly
                    heavier than the gridline it shares a position with. That
                    contrast IS the anatomy: the hairline is a reading aid and
                    the tick is the axis itself, so they cannot be the same
                    weight. 6 units = 6px here, since the viewBox maps 1:1
                    vertically; centred on the baseline so it reads as sitting on
                    it rather than hanging off it. */}
                <line
                  x1={x}
                  x2={x}
                  y1={BASELINE - 3}
                  y2={BASELINE + 3}
                  stroke="var(--text-secondary)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}


          {/* One hairline for the dots to be positioned against — not a grid.
              A grid would make this a chart, and it is a sparkline. */}
          <line
            x1="0"
            x2="100"
            y1={BASELINE}
            y2={BASELINE}
            stroke="var(--border-subtle)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {assessments.length > 1 && (
            <polyline
              points={line}
              fill="none"
              /* THE DARKEST INK, NOT THE MUTED ONE. The mock's line is the
                 chart's foreground; `--text-muted` made it recede behind its own
                 gridlines. `--text-primary` is the nearest Bloom token to the
                 mock's near-black — reported as a substitution.
                 2.5 IS NOT ON A 1px SCALE, so 2 is the nearest with
                 `non-scaling-stroke` keeping it 2 CSS px at any width — the
                 substitution, reported. A `polyline` is straight segments by
                 definition, which is the no-smoothing requirement for free. */
              stroke="var(--text-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {marks
            .filter((m) => m.cls === "presentation")
            .map((m) => (
              <line
                key={m.eventId}
                x1={xPct(m.at, startAt, endAt)}
                x2={xPct(m.at, startAt, endAt)}
                y1={TICK_TOP}
                y2={TICK_BOTTOM}
                stroke="var(--text-secondary)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </svg>

        {/* PRESENTATION MARKS ARE EXCLUDED HERE — they are drawn in the SVG
            above and carry no hit target. See the geometry note. */}
        {/* ASSESSMENTS ONLY. Flags left this loop when they became per-month
            badges — see the row after this one — and presentation ticks were
            never in it. `mergeCrowded` still guards SC 2.5.8 for the case two
            readings in one month sit ±10% apart. X comes from the same fanned
            positions the line is drawn through, so a point and its segment
            cannot disagree. */}
        {mergeCrowded(
          assessments.map((m, i) => ({
            ...m,
            x: snapX(m.at) + fanned[i],
            y: markY(m),
          }))
        ).map((m) => {
          const left = m.x;
          const top = m.y;
          const lines = m.cls === "assessment" ? tipLines(m) : null;
          return (
            <button
              key={m.eventId}
              type="button"
              onClick={() => onSelectEvent(m.eventId)}
              /* ═══ THE FULL TOOLTIP SENTENCE IS THE ACCESSIBLE NAME ═══
                  Not `aria-describedby` pointing at the floating tip: the tip is
                  `aria-hidden` and a screen reader gets instrument, date, score,
                  band and the weighted reading from the point itself. A merged
                  mark and a flag keep their existing range/type label, which is
                  the only honest name for something that is not one reading.
                  TODO-COPY. */
              aria-label={lines && !m.mergedFrom ? lines.join(". ") : m.label}
              onFocus={(e) => lines && show(e.currentTarget, lines)}
              onBlur={hide}
              onMouseEnter={(e) => lines && show(e.currentTarget, lines)}
              onMouseLeave={hide}
              /* DISMISSIBLE — SC 1.4.13. Stops propagation so Escape closes the
                 tip without also collapsing whatever contains the strip. */
              onKeyDown={(e) => {
                if (e.key === "Escape" && tip) {
                  e.stopPropagation();
                  hide();
                }
              }}
              style={{ left: `${left}%`, top }}
              className={cn(
                "absolute -ml-3 -mt-3 flex size-6 items-center justify-center rounded-full",
                "transition-colors hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {m.cls === "assessment" && (
                /* ═══ CORE + RING, IDENTICAL EVERYWHERE ON THE AXIS ═══
                    The mock draws a dark core with a light grey collar. The core
                    was already the line's ink; what changes is the ring — it was
                    `--surface-card`, i.e. the card behind it, which made the
                    point read as a hole punched in the line rather than as a
                    marker sitting on it. `--border-subtle` is the nearest Bloom
                    token to the mock's light grey, reported as a substitution.
                    SIZES: core `size-2` (8px) for the mock's ~7px and a
                    `2.5px` ring for its ~3px — both the nearest available step,
                    and the ring is a `ring-` utility so it grows outward without
                    changing the point's layout box. The 24px hit target is the
                    BUTTON around this, unchanged.
                    NO IN-WINDOW VARIANT. The window container is the only thing
                    that marks that region; a second treatment on the points
                    would say the same thing twice and imply the readings differ
                    in kind. */
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-[var(--text-primary)] ring-[2.5px] ring-[color:var(--border-subtle)]"
                />
              )}
              {/* THE PER-MARK FLAG DISC IS GONE. Flags are no longer a mark
                  on this axis at all: they aggregate into PER-MONTH TYPED
                  COUNTS rendered as one badge (or one split pill) per month,
                  below. A mark-per-coalesced-day and a badge-per-month are two
                  groupings of one thing, and keeping both would put two
                  different counts for the same events on one axis. */}

            </button>
          );
        })}
      </div>

      {/* ── THE TOOLTIP ─────────────────────────────────────────────────
          `aria-hidden` and `pointer-events-none`: it is a sighted convenience
          (see the note on the state above), and it must never intercept a click
          meant for the mark underneath it. `z-50` is the app's overlay floor —
          the strip sits in a rail that scrolls, and a tip clipped by its own
          container was the reason the grid's version is fixed too. */}
      {tip && (
        <div
          aria-hidden
          data-care-sparkline-tip
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-[var(--radius-inset)] bg-[var(--text-primary)] px-2 py-1 text-[12px] leading-[16px] text-[var(--text-inverse)] shadow-md"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          {tip.lines.map((l) => (
            /* `whitespace-nowrap` per line — three short lines stacked, never a
               wrapped paragraph beside a 24px point. */
            <span key={l} className="block whitespace-nowrap tabular-nums">
              {l}
            </span>
          ))}
        </div>
      )}

      {/* ═══ PER-MONTH TYPED SAFETY BADGES ═══
          One badge per month that has safety events, centred on that month's
          gridline. Escalations and flags are counted SEPARATELY and a month with
          both renders ONE split pill rather than two badges — two badges for one
          month would read as two months.

          TYPE IS NEVER HUE ALONE. Three channels carry it: fixed ORDER
          (escalation always the left segment), TONE (escalation filled and
          inverse, flag tinted with dark ink) and the accessible NAME, which
          spells both counts out in words.

          THE TOKENS ARE THE ONES HISTORY'S CHIPS USE — `--status-warn-*` for
          flags and `--band-clay-*` for escalations, the same pairs `TonalChip`
          resolves for its `warning` and `risk` tones. The escalation INVERTS its
          pair (ink as fill, wash as text) to carry the filled-versus-tinted cue
          the order and tone rule requires; it stays inside the same ramp, so the
          chart and the chip are the same colour family on both surfaces. */}
      <div className="relative h-6">
        {monthSafety
          .map((b) => ({ ...b, x: nearestMonthX(b.at) }))
          .filter((b) => b.x !== null)
          .map((b) => {
            const e = b.escalations.length;
            const f = b.flags.length;
            const label =
              `${e ? `${e} escalation${e === 1 ? "" : "s"}` : ""}` +
              `${e && f ? ", " : ""}` +
              `${f ? `${f} flag${f === 1 ? "" : "s"}` : ""}` +
              ` · ${monthLabel(b.at)}`;
            return (
              <span
                key={b.at}
                style={{ left: `${b.x}%` }}
                className="absolute top-0 -translate-x-1/2"
              >
                <span
                  title={label}
                  aria-label={label}
                  tabIndex={0}
                  role="img"
                  className={cn(
                    "flex h-6 items-center overflow-hidden rounded-full text-[10px] font-semibold leading-none tabular-nums",
                    RING
                  )}
                >
                  {e > 0 && (
                    <span
                      className="flex h-6 min-w-6 items-center justify-center px-1.5"
                      style={{
                        backgroundColor: "var(--band-clay-fg)",
                        color: "var(--band-clay-bg)",
                      }}
                    >
                      {e}
                    </span>
                  )}
                  {e > 0 && f > 0 && (
                    /* THE INTERNAL DIVIDER, so the capsule reads as two segments
                       of one object rather than as a colour change. */
                    <span
                      aria-hidden
                      className="h-6 w-px shrink-0 bg-[var(--surface-card)]"
                    />
                  )}
                  {f > 0 && (
                    <span
                      className="flex h-6 min-w-6 items-center justify-center px-1.5"
                      style={{
                        backgroundColor: "var(--status-warn-bg)",
                        color: "var(--status-warn-fg)",
                      }}
                    >
                      {f}
                    </span>
                  )}
                </span>
              </span>
            );
          })}
      </div>

    </div>
  );
}
