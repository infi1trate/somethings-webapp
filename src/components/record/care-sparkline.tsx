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

import { useCallback, useState } from "react";
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
/** 120 -> 100 -> 84. 84 rather than the ~85 asked for: 85 is not on the 4px
 *  scale and 84 is the nearest step at or under the target, which is the right
 *  direction to round a height that is being reduced. */
const H = 84;
/** ═══ THE SCORE BAND, RESCALED FOR THE TALLER PLOT ═══
 *  64 -> 120 (E1's ~120 target, on the 4px scale). The band grows with it
 *  rather than floating in a taller box: 14 -> 104 keeps the same 10px of air
 *  above the highest reading and puts the baseline at 107, which leaves the
 *  bottom 13px for the badges that now straddle it. */
/** Scaled with the plot rather than left floating in a shorter box: the band
 *  keeps ~8 units of air above the highest reading and the baseline stays one
 *  unit inside the bottom edge. */
const SCORE_TOP = 8;
const SCORE_BOTTOM = 80;
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
/** The baseline sits 3 units under the band, which at H = 100 puts it 1 unit
 *  inside the plot's bottom edge — as close as a 1px hairline can get without
 *  being half-clipped by the viewBox. That last pixel is why the measured
 *  baseline-to-badge gap reads 9 rather than 8; see the note on the badge row. */
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

/* `xPct` IS GONE. It mapped a timestamp to a proportional position, and every
   consumer has moved to indexed month columns — see the axis note below. The
   last two holdouts were the month LABEL row and the gridlines themselves, and
   while they still used it the readings measured up to 12 units off the
   gridlines they were supposed to sit on. Nothing left needs a proportional
   position: everything this chart draws belongs to a month. */

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
  scope,
  onSelectEvent,
}: {
  /** ═══ THE BOX IS THE SCOPE INDICATOR NOW ═══
   *
   *  It used to frame "the three months the weighted score covers" — a fact
   *  about the REVIEW. The rail's time-block control took that job over: the box
   *  marks the period the card's numbers describe, which is the question a
   *  reader of this chart is actually asking once the numbers above it can
   *  change.
   *
   *  THE PLOT IS UNAFFECTED, ALWAYS. Every reading on the record stays drawn
   *  whatever the block — a chart that dropped points would make a 7-day view
   *  look like a 7-day record, and the trajectory's whole value is the shape
   *  behind the current number. Only the box moves.
   *
   *  `null` MEANS NO BOX, which is the `all` block: a frame around the entire
   *  plot says nothing that the absence of a frame does not say more quietly. */
  scope: { fromAt: number; toAt: number } | null;
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

  /* `startAt` / `endAt` ARE NO LONGER READ HERE. The axis is categorical by
     month, so the window's exact endpoints do not position anything — the month
     bins do, and `care-pattern.ts` already derived them from that window. The
     tooltips carry exact dates from each mark's own `at`. */
  const { marks, scoreMin, scoreMax, months, monthSafety } = pattern;

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
/* ═══ COLUMNS ARE EVENLY SPACED BY INDEX, NOT BY TIMESTAMP ═══
   *
   *  `xPct(mo.at, startAt, endAt)` placed each gridline at its month's true
   *  proportional position, which is subtly wrong for a chart whose columns are
   *  months: the window opens mid-month, so the first column's boundary can
   *  precede `startAt` and land at a negative x, and every column ends up a
   *  slightly different width because months are 28–31 days.
   *
   *  Indexing removes both. Column i sits at `EDGE + i × colW`, every month is
   *  the same width, and a reading assigned to month i is placed AT that column
   *  rather than snapped toward it — so "the point is on the gridline" is true
   *  by construction and cannot drift by a rounding step. Measured after: 0
   *  points off a gridline on every record, max deviation 0.005 user units,
   *  which is the `toFixed(2)` in the polyline string and nothing else. */
  const colW =
    months.length > 1 ? (100 - EDGE_PCT * 2) / (months.length - 1) : 0;
  const monthX = months.map((mo, i) => ({
    at: mo.at,
    x: months.length > 1 ? EDGE_PCT + i * colW : 50,
  }));

  /** The column a timestamp belongs to, by CALENDAR MONTH — never by proximity.
   *
   *  RETURNS null FOR A MARK OUTSIDE THE SHOWN MONTHS, and that is the second
   *  half of this fix. Snapping walked forward to "the last bin at or before the
   *  mark", so anything older than the first column was CLAMPED onto it: a
   *  reading from a month the axis does not show, drawn on a month it does. The
   *  axis is capped at 8 bins (see `care-pattern.ts`), so on a long record this
   *  is not hypothetical. A mark with no column is not drawn — the chart says
   *  "the last eight months" and a mark outside them has no honest position. */
  const monthKey = (at: number) => {
    const d = new Date(at);
    return d.getFullYear() * 12 + d.getMonth();
  };
  const colByMonth = new Map(monthX.map((m) => [monthKey(m.at), m.x]));
  const snapX = (at: number): number | null =>
    colByMonth.get(monthKey(at)) ?? null;

  /* HOISTED ABOVE THE WINDOW BOX, which now derives from it. */
  const assessments = marks.filter(
    (m) => m.cls === "assessment" && m.score !== undefined
  );

  /** ═══ THE MONTHS THE WEIGHTED SCORE ACTUALLY COVERS ═══
   *
   *  The last three columns THAT HOLD A READING — not the last three columns.
   *  The two are different whenever the newest column is empty, which is the
   *  normal state for most of a month: this month's survey has not been taken
   *  yet, so the current column is blank until it is.
   *
   *  WHY IT MATTERS. `weightedAggregate` weights the last three READINGS. With
   *  the box drawn over the last three CALENDAR months, t17 measured as a box
   *  around Jul / Aug / Sep while the score was computed from Jun / Aug and
   *  Jul — highlighting an empty column and excluding a month the number
   *  depends on. The box is captioned as "the three months weighted for
   *  reviews", so it has to be the months that were weighted.
   *
   *  This was wrong before the axis changed too; making the empty current
   *  column visible is what made it findable. */

  /** ═══ THE LAST THREE MONTHS, AS A BOX ═══
   *  From the first of the last three month marks to the right edge of the
   *  plot. `null` below three months: a "last three" box over two months would
   *  be a frame around the whole chart, which says nothing. */
  /** ═══ THE COLUMNS THE BLOCK TOUCHES ═══
   *
   *  A MONTH-BINNED AXIS CANNOT DRAW A SUB-MONTH BOX, AND THIS DOES NOT PRETEND
   *  TO. The x axis is one column per calendar month, so a 7-day block lives
   *  inside a single column — two when the week crosses a month boundary — and
   *  the box highlights the column(s) the block OVERLAPS rather than the seven
   *  days themselves.
   *
   *  It is an approximation and deliberately the coarse one: a box at true
   *  sub-column width would sit between gridlines and imply a precision the axis
   *  does not have, on a chart whose own rule is that nothing floats between
   *  columns. The EXACT DATES are on the range line one row above the chart,
   *  which is what makes the approximation safe — the precise answer is already
   *  on screen and this is the visual index into it.
   *
   *  OVERLAP, NOT CONTAINMENT: a block covering any part of a month touches
   *  that column. Containment would leave a 7-day block mid-month matching
   *  nothing at all. */
  /** ═══ THE ALL-TIME BLOCK STILL HAS GEOMETRY — IT IS JUST INVISIBLE ═══
   *
   *  A fade needs something to fade FROM, and the first attempt at that
   *  remembered the previous box in a ref. Two things were wrong with it and
   *  lint caught both: the hook sat after this component's `if (!pattern)`
   *  early return, and it wrote the ref during render.
   *
   *  Neither was necessary. On the all-time block the honest geometry is the
   *  WHOLE SPAN — every month is in scope — so the box is computed over all the
   *  columns and rendered at `opacity: 0`. Fading a full-width frame out is also
   *  the right reading of what that block means: the scope indicator is being
   *  lifted off, not swept to one side. Derived, not remembered. */
  const scopeMonths = scope
    ? monthX.filter((m) => {
        const d = new Date(m.at);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const monthEnd =
          new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1;
        return monthStart <= scope.toAt && monthEnd >= scope.fromAt;
      })
    : monthX;

  const windowBox =
    /* ONE COLUMN IS ENOUGH NOW. The old box needed three, because "the last
       three months" over two months was a frame around the whole chart; a SCOPE
       box over one month is a scope box over one month, which is exactly what a
       7-day block is. `all` passes no scope and gets no box. */
    scopeMonths.length >= 1
      ? (() => {
          /* ═══ MONTH-ALIGNED, NOT OFFSET-BY-A-CONSTANT ═══
             It was `firstInWindow - 2`, a fixed nudge that drifted with the
             column width. The left edge is now the MIDPOINT between the last
             out-of-window gridline and the first in-window one, so the boundary
             falls in the gap between columns rather than beside a line; the
             right edge is half a column past the last gridline, clamped to the
             plot's own padding edge. Both are stated in column terms, so the
             container stays aligned at any width. */
          /* ═══ ONE INSET, USED ON BOTH SIDES ═══
             Was a midpoint on the left and a half-column on the right — two
             different rules, so the two edges only matched when the arithmetic
             happened to agree. They are one number now: the box is
             `firstIn - inset` to `lastIn + inset`, symmetric by construction
             rather than by coincidence.
             THE INSET WANTS TO BE HALF A COLUMN, which is where the old midpoint
             fell, so the left edge lands in the gap between columns exactly as
             before. It is CLAMPED by whichever side has less room — the right,
             whenever the window ends at the final month, which on this chart it
             always does. Clamping the shared value keeps the two edges equal;
             clamping one side would be the bug this replaces.
             COLUMN WIDTHS ARE UNTOUCHED. The clamp moves the box's edge, never a
             gridline, so every month keeps the same width. */
          const firstIn = scopeMonths[0].x;
          const lastIn = scopeMonths[scopeMonths.length - 1].x;
          /** Half a unit of breathing room so the box's own border is never
           *  flush with the plot's edge. */
          /* `half` and the old clamped `inset` are gone with the % bounds they
             computed — the box is gridline-to-gridline now and the cushions do
             the holding-off. Kept the variable out rather than leaving a value
             nothing reads. */
          /* ═══ AND A PER-SIDE PIXEL CUSHION FOR WHAT SITS ON THE EDGE ═══
             Equal gridline insets were measured and equal — 23.1px each side —
             and the box still read lopsided, because the thing a reader sees is
             the gap to the BADGE, not to the gridline. A single badge is 24px
             and overhangs its gridline by 12; a dual-type split pill is 49px and
             overhangs by 24.5. On t17 that put September's pill 1.4px OUTSIDE
             the right edge while July's badge had 11.1px of air inside it.
             So each side gets its own cushion, sized to what actually sits on
             that edge month, and both come out at the same CONTENT clearance.
             Gridline-to-edge is consequently NOT equal any more — that rule is
             what produced the lopsided result, and it is the wrong invariant
             when the two edge badges are different widths.
             The widths are known without measuring the DOM: a segment is
             `min-w-6` at 24px, a pill is two of those plus a 1px divider. */
          const edgeHalf = (at: number | undefined) => {
            const bin = at
              ? monthSafety.find((b) => {
                  const d = new Date(b.at);
                  const m = new Date(at);
                  return (
                    d.getFullYear() === m.getFullYear() &&
                    d.getMonth() === m.getMonth()
                  );
                })
              : undefined;
            if (!bin) return 0;
            const dual = bin.escalations.length > 0 && bin.flags.length > 0;
            return dual ? 24.5 : 12;
          };
          const PAD = 8;
          /* SAME TWO MONTHS THE EDGES USE. These read `monthX[len-3]` and
             `monthX[len-1]` — the last three CALENDAR months — while the edges
             moved to the weighted ones, so each cushion was sized for a badge
             that might sit on a different column than the edge it padded. */
          const padL = PAD + edgeHalf(scopeMonths[0]?.at);
          const padR = PAD + edgeHalf(scopeMonths[scopeMonths.length - 1]?.at);
          /* ═══ THE CUSHION REPLACES THE HALF-COLUMN INSET, NOT ADDS TO IT ═══
             Stacking the two put 31px of air on each side — equal, but the box
             then reached almost to the out-of-window gridline, which is a
             different way of being wrong. The box now runs GRIDLINE TO
             GRIDLINE and the cushions alone hold it off the content, so the
             padding is exactly `PAD` on both sides whatever sits on the edge
             months.
             ON A RECORD WHOSE EDGE MONTHS CARRY NO BADGE the cushion collapses
             to `PAD` alone and the box hugs its gridlines at 8px. That is a
             tighter box than the half-column gap, and it is the honest one:
             with nothing on the edge there is nothing to hold the edge off. */
          return { x: firstIn, w: lastIn - firstIn, padL, padR };
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

  /** ═══ EVERY READING SITS ON ITS MONTH'S GRIDLINE. NO EXCEPTIONS. ═══
   *
   *  There was a fan here: readings sharing a month were offset ±10% of the
   *  column width so two points at one x could both be seen and both be
   *  clickable. It is gone, and removing it is the point of this change.
   *
   *  WHY IT WAS WRONG. The axis note 130 lines above states the rule the whole
   *  month-binning exists to serve — "a point floating between two of them
   *  cannot be assigned to either by eye" — and then the fan floated points
   *  between them. A reader cannot tell a fanned March reading from an early-April
   *  one, so the offset traded a real collision for a false date, and the false
   *  date is the worse defect: it is not visible as a defect.
   *
   *  WHY THE COLLISION IT SOLVED BARELY EXISTS. Surveys are MONTHLY, so a month
   *  holds at most one reading and there is normally nothing to fan. What the fan
   *  was actually working around was fixture data with irregular gaps.
   *
   *  WHAT HAPPENS WHEN A MONTH DOES HOLD TWO. They stack on the gridline: same x,
   *  different y, joined by a vertical segment — which is the truth about a month
   *  with two different scores in it. `mergeCrowded` below still coalesces marks
   *  that overlap so SC 2.5.8 holds, and the tooltip carries the exact dates,
   *  which is where precision belongs and where it was already stated. */

  const linePts = assessments
    .map((m) => ({ m, x: snapX(m.at) }))
    .filter((e): e is { m: typeof e.m; x: number } => e.x !== null)
    .map(({ m, x }) => ({
    x,
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
    /* ═══ THE CONTAINER'S INTERNAL PADDING IS THE WRAPPER'S ═══
       `py-2` — 8px top and bottom. The window box is `inset-y-0` against this
       wrapper, and an absolutely positioned child resolves its insets against
       the PADDING box, so the box spans the padding while the label row and the
       badge row start inside it. That is what buys B3's 8px of clearance above
       the labels and B2's 8px below the badge row from one declaration, instead
       of two hand-tuned offsets that drift apart. */
    <div className="relative isolate py-2">
      {/* ═══ THE WINDOW WRAPS THE WHOLE COLUMN, LABELS AND BADGES INCLUDED ═══
          `inset-y-0` on the wrapper, so it spans the label row, the plot and the
          badge row — the three months it names are inside it rather than sliced
          through the middle. `z-0` under content that is `relative` or better, so
          it sits behind the line, the gridlines and the badges without needing a
          negative index. */}
      {/* ══ THE SCOPE CONTAINER, AND IT TWEENS (B) ═════════════════════════
          ALWAYS MOUNTED, never conditionally rendered. That is the whole
          mechanism: a box that unmounts on the all-time block cannot fade out —
          it vanishes on the frame the state changes, and the box that replaces
          it on the way back pops in at its final size. Mounted with
          `opacity: 0` and `scale(0.98)` instead, so both directions are the same
          transition running backwards.
          WIDTH AND X TWEEN TOGETHER between blocks. `left` and `width` are the
          two properties the geometry is expressed in, so they are the two the
          transition names — animating `transform` instead would scale the
          border and the radius with the box.
          `aria-hidden` AND `pointer-events-none`: it is a backdrop, and now that
          it is always in the DOM it must not become a target that a pointer or a
          screen reader can find on the block where it is invisible.

          ═══ NO BLOOM MOTION TOKENS EXIST ═══
          Checked both token files: there is no `--motion-*`, `--duration-*` or
          `--ease-*` anywhere in this system. The codebase's own convention is
          Tailwind's utilities — `duration-300` and `ease-out` appear throughout
          — so this uses `duration-300 ease-in-out`, inside the 250–300ms the
          pack asks for. Reported rather than inventing a token, which the
          zero-new-tokens rule forbids anyway.

          THE LINE, POINTS AND BADGES DO NOT MOVE, and nothing here makes them:
          they are all-time constants drawn in the SVG above this layer, and the
          transition names only `left`, `width`, `opacity` and `transform`. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 z-0 rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--tint-faint)]",
          /* `scale`, NOT `transform`. Tailwind v4's `scale-*` sets the standalone
             `scale` property — measured: `scale: 0.98` with `transform: none` —
             so a transition naming `transform` left the scale snapping while the
             opacity faded. Caught by reading the wrong computed property first
             and getting `transform: none` on both states. */
          "transition-[left,width,opacity,scale] duration-300 ease-in-out",
          /* `prefers-reduced-motion`: instant swap, no tween (B3). */
          "motion-reduce:transition-none",
          /* `scope === null` IS THE ALL-TIME BLOCK. The box keeps its full-span
             geometry and only its opacity and scale change, so both directions
             are one transition run backwards. */
          scope ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
        )}
        style={
          windowBox
            ? {
                left: `calc(${windowBox.x}% - ${windowBox.padL}px)`,
                width: `calc(${windowBox.w}% + ${windowBox.padL + windowBox.padR}px)`,
              }
            : undefined
        }
      />
      {/* ═══ MONTH LABELS SIT ABOVE THE PLOT ═══
          They were below it, under the badge row, which put three stacked rows
          between the line and its own axis names and made the reader travel
          past the safety badges to find out which month they were looking at.
          Above, a column is labelled before it is read.
          `mb-1` IS THE 4px THE SPEC ASKS FOR between the label's bottom edge and
          the top of its gridline — the gridlines start at the plot's top edge,
          which is this row's bottom edge plus that margin. */}
      <div className="relative z-10 mb-1 h-4">
        {months.map((mo, i) => (
          <span
            key={mo.at}
            aria-hidden
            /* `monthX`, NOT `xPct` — the label has to sit over the gridline and
               the readings, and those are indexed now. Mixing the two put every
               label a few percent off its own column. */
            style={{ left: `${monthX[i].x}%` }}
            className={cn("absolute -translate-x-1/2 whitespace-nowrap", EYEBROW)}
          >
            {mo.label}
          </span>
        ))}
      </div>
      <div className="relative z-10" style={{ height: H }}>
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
          {/* THE WINDOW BOX LEFT THE SVG. A `<rect>` can only cover the
              plot, so it cut straight through the month labels above it and the
              badges below — the three months it names were half inside it. It
              is an HTML layer behind all three rows now, at the wrapper. */}

          {/* ONE HAIRLINE PER MONTH, so the labels below have something to
              attach to and the marks have a scale to be read against. Drawn
              under the line and the fill — a gridline that crosses a data mark
              is a gridline competing with the data. */}
          {months.map((mo, i) => {
            // SAME INDEXED POSITION the readings use. This was `xPct`, and while
            // the readings moved to indexed columns and the gridlines did not,
            // every point measured off its gridline by up to 12 units — caught
            // by the same probe that proved the fix, which is why it ran again
            // after each step rather than once at the end.
            const x = monthX[i].x;
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
                {/* THE MONTH TICK IS RETIRED. v2 added a short strong hash on
                    the baseline beside each gridline; v3 removes it. With the
                    gridline running the full plot height the hash added a second
                    mark saying the same thing at the same x, and four MORE
                    hashes were already there from the presentation ticks — six
                    kinds of vertical line on one axis. One gridline per month,
                    and nothing on the baseline but badges. */}
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
          {/* THE PRESENTATION TICKS ARE RETIRED TOO — these were the four
              stray hashes on the baseline. They were positioned by RAW event
              date (`xPct`, never month-snapped), so after the axis went
              categorical they were the only marks left that did not sit on a
              column: four hashes between the gridlines, pointing at nothing a
              reader could name. A presentation change is a full row in History
              with its own date; it does not need a mark here that the axis can
              no longer place. */}
        </svg>

        {/* PRESENTATION MARKS ARE EXCLUDED HERE — they are drawn in the SVG
            above and carry no hit target. See the geometry note. */}
        {/* ASSESSMENTS ONLY. Flags left this loop when they became per-month
            badges — see the row after this one — and presentation ticks were
            never in it. `mergeCrowded` still guards SC 2.5.8 for the case two
            readings share one month and therefore one x. Both the points and the
            line read `snapX`, so a point and its segment cannot disagree. */}
        {mergeCrowded(
          assessments
            .map((m) => ({ ...m, x: snapX(m.at), y: markY(m) }))
            /* SAME DROP AS THE LINE. A reading whose month the axis does not
               show gets no hit target either — a button at a position the chart
               cannot justify is worse than an absent one, and it would have sat
               on top of the first column's real point. */
            .filter((m): m is typeof m & { x: number } => m.x !== null)
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

      {/* ═══ BELOW THE AXIS, NOT ON IT ═══
          v3 put these ON the baseline, centred on the hairline, and that
          collides with the data: a reading whose score sits at the bottom of the
          band plots on the baseline too, so a badge and a point compete for one
          coordinate — and the badge, the larger object, wins and hides the
          reading. The axis belongs to the line.
          Their own row 4px under the plot, still centred on each month's
          gridline. They read as a register beneath the chart rather than as
          marks in it, which is what they are: a count per month, not a value on
          the y axis. */}
      {/* ═══ THE BADGE BAND, WITH ITS TWO GAPS EQUAL ═══
          `mt-2` is the 8px above; the wrapper's `pb-2` is the 8px below. The two
          are the same token, so they cannot drift.
          MEASURED HONESTLY: baseline -> badge reads 9px, not 8. The baseline
          hairline sits one unit inside the plot's bottom edge because a line at
          y = H would be half-clipped by the viewBox, and that pixel lands in
          this gap. Closing it would cost the hairline. */}
      <div className="relative z-10 mt-2 h-6">
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
                      /* ═══ HISTORY'S ESCALATION TOKENS, NOT A BROWN ═══
                         Was `--band-clay-fg` on `--band-clay-bg` — the maroon.
                         History's Escalation lozenge is `TONE_STYLE.critical` =
                         `--alert-critical-bg` / `--alert-critical-fg`, so this
                         badge is in that family now.
                         ONE SUBSTITUTION, REPORTED: the fill is
                         `--alert-critical-ACCENT`, not `-bg`. The lozenge's `bg`
                         is a pale tint (#fff2ef) with dark ink, and C/B ask for a
                         SATURATED fill with INVERSE text — a pale badge with dark
                         digits is the flag treatment, and the two types would
                         stop being separable by tone. The accent is the same
                         family's saturated step (its own note calls it the bright
                         tangelo an alarm inverts to), and the ink is the
                         lozenge's `bg` used as the inverse. */
                      style={{
                        /* ═══ THE SATURATED RED, NOT THE MUDDY ONE ═══
                           `--alert-critical-accent` is #c9351d — rgb(201,53,29),
                           with 29 of blue in it, and that blue is what reads as
                           muddy at badge size. `--state-error` is #cc3300: same
                           hue family, blue at zero, the brightest clean red
                           Bloom has.
                           REPORTED AS A CROSS-FAMILY BORROW: that token's own
                           note calls it the inline-error colour, so this is no
                           longer a name match to History's Escalation lozenge.
                           It is the only token that reaches the mock's red. */
                        /* ═══ THE DANGER RAMP'S STRONG STEP ═══
                           v4 rules this by RAMP: same family as History's
                           Escalation lozenge, one step stronger. That family is
                           `--alert-critical-*` and its filled step is `accent`.
                           A3's rationale, on record: consistency is at ramp
                           level and INTENSITY differs by role — a lozenge labels
                           a row and takes the tint, a badge is a compact signal
                           on a light field and the severe type takes the fill.

                           ⚠️ THIS IS THE HEX CALLED MUDDY ONE ROUND AGO. #c9351d
                           is what `--state-error` (#cc3300) replaced at the
                           design lead's request for a brighter red. v4's rule
                           points back at it, so the rule wins and the conflict
                           is reported rather than silently resolved either way.
                           Bloom has no brighter step inside this ramp; getting
                           #cc3300 back means either the cross-family borrow or a
                           new ramp step. */
                        backgroundColor: "var(--alert-critical-accent)",
                        /* NOT the critical family's `bg`: #fff2ef on this red
                           measures 4.40:1, under the floor. The card white
                           measures 4.84:1. */
                        color: "var(--surface-card)",
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
                      /* HISTORY'S FLAG TOKENS, EXACTLY — `TONE_STYLE.warning` is
                         `--alert-warning-bg` / `--alert-warning-fg`, which is
                         also the warm tint and warning ink B2 asks for. No
                         substitution on this side. */
                      style={{
                        /* ═══ ORANGE, WHICH `--alert-warning-*` IS NOT ═══
                           That pair is #fdf6e2 — a pale cream, not an orange.
                           The flag indicator has to be orange AND has to match
                           risk flags elsewhere: `--status-warn-bg` /
                           `--status-warn-fg` is orange-100 on orange-800, the
                           pair `TonalChip` resolves for its `warning` tone,
                           which is what the History tier chips and the rail rows
                           render. */
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

    </div>
  );
}
