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
const H = 70;
const SCORE_TOP = 12;
const SCORE_BOTTOM = 34;
/** ON THE AXIS, not above it. Was 58 — a band of its own between the score
 *  line and the month labels, which spent 16px of a 70px strip on a row that
 *  held three marks. The discs now sit centred on the baseline itself. */
const FLAG_Y = 37;
const TICK_TOP = 42;
const TICK_BOTTOM = 50;
/** ═══ THE AREA FILL'S STOP OPACITIES ═══
 *
 *  The 14% used to live inside the token as a `color-mix`, and that shipped
 *  broken on browsers without `color-mix` — the compiler emitted the bare
 *  `--text-muted` as its fallback, i.e. an opaque grey block under the line. An
 *  explicit rgba fallback above the mix was deduped away. See the token's own
 *  note in `settings-tokens.css`.
 *
 *  `stop-opacity` has been in SVG since 1.1, cannot be compiled away, and keeps
 *  the fill deriving from the line's token rather than from a literal. The pair
 *  is one gradient definition: 14% where the fill meets the line, nothing at the
 *  baseline. */
const AREA_FILL_OPACITY = 0.14;
const AREA_FADE_OPACITY = 0;

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
  const gradientId = useId();

  if (!pattern) return null;

  const { startAt, endAt, marks, scoreMin, scoreMax, months } = pattern;

  /** ═══ THE LAST THREE MONTHS, AS A BOX ═══
   *  From the first of the last three month marks to the right edge of the
   *  plot. `null` below three months: a "last three" box over two months would
   *  be a frame around the whole chart, which says nothing. */
  const windowBox =
    months.length >= 3
      ? (() => {
          const from = xPct(months[months.length - 3].at, startAt, endAt);
          return { x: from - 2, w: 100 - (from - 2) };
        })()
      : null;

  const assessments = marks.filter(
    (m) => m.cls === "assessment" && m.score !== undefined
  );
  const linePts = assessments.map((m) => ({
    x: xPct(m.at, startAt, endAt),
    y:
      plotScoreY(m.score!, scoreMin, scoreMax, SCORE_BOTTOM - SCORE_TOP, 4) +
      SCORE_TOP,
  }));
  const line = linePts
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(1)}`)
    .join(" ");

  /** ═══ THE AREA, CLOSED ONTO THE BASELINE ═══
   *
   *  Derived from the SAME `linePts` as the polyline, so the fill's top edge is
   *  the line by construction rather than by two calculations agreeing. Closed
   *  down to `BASELINE` — the hairline the dots sit on — so the fill terminates
   *  exactly at the axis instead of at the lowest point or at the strip's floor,
   *  either of which would read as a shape rather than as an area under a curve. */
  const areaPath =
    linePts.length > 1
      ? `M ${linePts[0].x.toFixed(2)},${BASELINE} ` +
        linePts.map((p) => `L ${p.x.toFixed(2)},${p.y.toFixed(1)}`).join(" ") +
        ` L ${linePts[linePts.length - 1].x.toFixed(2)},${BASELINE} Z`
      : null;

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
              className="fill-[var(--surface-s1)] stroke-[color:var(--border-subtle)]"
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
              <line
                key={`grid-${mo.at}`}
                x1={x}
                x2={x}
                y1={SCORE_TOP - 6}
                y2={BASELINE}
                className="stroke-[color:var(--border-subtle)]"
                strokeWidth="0.25"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* ═══ THE AREA FILL — a documented CHART-ONLY extension ═══
              Bloom prohibits gradients on surfaces. `--chart-area-fill` is
              defined once in the token block as the top stop of THIS fill, mixed
              from the same `--text-muted` the line is stroked with, and is never
              to be used on a non-chart surface. See the token's own note.

              `userSpaceOnUse` anchors the ramp to the SCORE BAND rather than to
              the path's bounding box: with `objectBoundingBox` a flat series
              would have a near-zero-height box and the whole fill would render at
              the top stop, so the gradient's steepness would change with the
              data. Anchored to the band, the fade is the same on every record. */}
          {areaPath && (
            <>
              <defs>
                <linearGradient
                  id={`care-area-${gradientId}`}
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1={SCORE_TOP}
                  x2="0"
                  y2={BASELINE}
                >
                  {/* ONE COLOUR, TWO OPACITIES — not a colour and a
                      `transparent`. A `transparent` keyword stop interpolates
                      through transparent BLACK in some engines, which greys the
                      fade; an explicit opacity on the same colour interpolates
                      only the alpha. */}
                  <stop
                    offset="0"
                    stopColor="var(--chart-area-fill)"
                    stopOpacity={AREA_FILL_OPACITY}
                  />
                  <stop
                    offset="1"
                    stopColor="var(--chart-area-fill)"
                    stopOpacity={AREA_FADE_OPACITY}
                  />
                </linearGradient>
              </defs>
              <path d={areaPath} fill={`url(#care-area-${gradientId})`} />
            </>
          )}
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
              stroke="var(--text-muted)"
              strokeWidth="1.5"
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
        {mergeCrowded(
          marks
            .filter((m) => m.cls !== "presentation")
            .map((m) => ({
              ...m,
              x: xPct(m.at, startAt, endAt),
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
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-[var(--text-primary)] ring-[1.5px] ring-[color:var(--surface-card)]"
                />
              )}
              {m.cls === "flag" && (
                /* ═══ A DISC ON THE AXIS, NOT A TRIANGLE ABOVE IT ═══
                    The design file draws these as filled circles sitting on the
                    baseline with their count inside, and that is the better
                    shape here: a triangle floating in the plot competed with the
                    score line for the same vertical space, where a disc on the
                    axis reads as an event ON the timeline.

                    COLOUR SPLITS ESCALATION FROM FLAG, and never carries the
                    distinction alone — the accessible label says "Escalation" or
                    "Flag" in words, so greyscale, a screen reader and a
                    monochrome print all get it. This is the event's TYPE, not a
                    grade of the teen; see the note on `PatternMark.escalation`. */
                <span
                  aria-hidden
                  className={cn(
                    "flex items-center justify-center rounded-full text-[8.5px] font-semibold leading-none tabular-nums",
                    m.count > 1 ? "size-4" : "size-2.5"
                  )}
                  /* ═══ EACH BAND'S OWN PAIR, NOT TWO FOREGROUNDS ═══
                     Both discs first took a `-fg` token as their fill, and the
                     two measured 1.09:1 against EACH OTHER — two dark browns,
                     indistinguishable at 10px, so the colour split was doing
                     nothing at all. The words carried it, which is why this was
                     a design failure rather than an accessibility one.
                     Now each takes the fill and ink it was designed with: the
                     escalation is the loud one (clay ink as fill, light text)
                     and the flag is the quiet one (amber wash, amber ink). That
                     hierarchy is also true — an escalation IS the louder event —
                     and the two are separable at a glance without either being
                     read for its hue alone. */
                  style={
                    m.escalation
                      ? {
                          backgroundColor: "var(--band-clay-fg)",
                          color: "var(--band-clay-bg)",
                        }
                      : {
                          backgroundColor: "var(--band-amber-bg)",
                          color: "var(--band-amber-fg)",
                        }
                  }
                >
                  {/* THE COUNT ONLY WHEN THERE IS ONE TO STATE. A "1" inside
                      every disc is a number that never varies, which is noise a
                      reader has to learn to ignore; the single-flag disc is
                      simply smaller. Both sizes clear the 24px target because
                      the BUTTON around them carries it, not the disc. */}
                  {m.count > 1 ? m.count : null}
                </span>
              )}

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

      <div className="relative mt-1 h-4">
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
    </div>
  );
}
