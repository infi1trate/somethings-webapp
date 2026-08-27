"use client";

// THE CARE PATTERN BLOCK — Care tab, between the presentation card and History.
//
// ═══════════════════════════════════════════════════════════════════════════
// GUARDRAILS. Each one is enforced somewhere specific; this is where to look.
//
// CO-OCCURRENCE, NEVER CAUSATION. Every sentence is built in `care-pattern.ts`,
// which joins facts with "across the same stretch" and has no branch that can
// emit "because", "driven by", "due to" or "led to". A test asserts the absence
// over every teen. This component renders those sentences and authors none.
//
// NO PREDICTION. Nothing here reads forward. There is no extrapolated segment on
// the strip, no dashed future, no "continuing".
//
// NO TIERING OF THE TEEN. The taxonomy carries a tier per FLAG and it is never
// read on this surface — not for sorting, not for colour, not for a badge. Flag
// marks are one shape regardless of tier, deliberately: the moment the strip
// encoded severity it would be grading the person by proxy. Periods get
// described; people do not get graded.
//
// NEVER THE PRIMARY CARRIER OF AN ACTIVE CONCERN. Open flags reach a supervisor
// through the Overview attention pipeline, which has an owner, a clock and a
// resolution path. This block does not know whether a flag is open and does not
// sort or emphasise by it. If you are here to add "2 still open" — that belongs
// on Overview, and putting it here would give a concern a second home with no
// owner.
//
// NO ACTIONS AT ANY TIER. The only interactive elements are the marks, and all
// they do is filter and scroll History. Nothing here writes to the record; this
// block is never the author of a history entry.
//
// NO VERBATIM CONTENT. Mark labels are type plus date. The event `description`
// is never rendered — it can carry content.
// ═══════════════════════════════════════════════════════════════════════════
//
// THE STRIP SHARES THE SPARKLINE'S SCALE (`plotScoreY`) rather than introducing a
// second charting approach. Same inversion, same min/max spanning. Two score
// visuals on one record that disagreed about which way "up" meant would be worse
// than having neither.
//
// MARKS ARE HTML BUTTONS OVER AN SVG, not SVG shapes with click handlers. An SVG
// <circle role="button"> is reachable in some browsers and not others, has no
// native focus ring, and gives a 5px hit target. Absolutely-positioned buttons
// get real keyboard semantics, a real focus-visible ring and a 24px target, while
// the SVG underneath draws the trajectory line the buttons sit on.

import { plotScoreY } from "@/components/record/score-sparkline";
import type { CarePattern, PatternMark } from "@/lib/record/care-pattern";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const EYEBROW = "text-[11.5px] leading-[16px] text-[var(--text-muted)]";

/** Strip geometry. The score band occupies the top, the flag lane sits under it
 *  and presentation ticks run along the floor — SEPARATION BY POSITION, so the
 *  three classes are distinguishable with colour removed entirely (WCAG 1.4.1).
 *  Shape differs too: dot, triangle, tick. */
const H = 72;
const SCORE_TOP = 8;
const SCORE_BOTTOM = 40;
const FLAG_Y = 52;
const TICK_TOP = 62;
const TICK_BOTTOM = 70;

/** TODO-COPY */
function updatedLabel(at: number): string {
  return `Updated ${new Date(at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function xPct(at: number, startAt: number, endAt: number): number {
  const span = endAt - startAt || 1;
  return ((at - startAt) / span) * 100;
}

export function CarePatternBlock({
  pattern,
  onSelectEvent,
}: {
  /** Null means SUPPRESSED — the caller renders nothing. Kept in the signature
   *  so the caller cannot forget that null is a real, designed outcome. */
  pattern: CarePattern | null;
  /** Filters History to this event and scrolls to it. The block's only
   *  interaction, and it is a read, not a write. */
  onSelectEvent: (eventId: string) => void;
}) {
  if (!pattern) return null;

  const { startAt, endAt, marks, scoreMin, scoreMax, months } = pattern;

  const assessments = marks.filter((m) => m.cls === "assessment" && m.score !== undefined);
  const line = assessments
    .map((m) => {
      const x = xPct(m.at, startAt, endAt);
      const y = plotScoreY(
        m.score!,
        scoreMin,
        scoreMax,
        SCORE_BOTTOM - SCORE_TOP,
        4
      ) + SCORE_TOP;
      return `${x.toFixed(2)},${y.toFixed(1)}`;
    })
    .join(" ");

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
    <section
      /* TODO-COPY */
      aria-label="Care pattern"
      data-record-section="care-pattern"
      className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-5 py-4"
    >
      {/* ── HEADER. NO ACTIONS AT ANY TIER — the qualifier states the span so the
          reading's scope is visible before it is read. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-semibold leading-[22px] text-[var(--text-primary)]">
          {/* TODO-COPY */}
          Care pattern
        </h2>
        <p className={EYEBROW}>
          {/* TODO-COPY. Provenance without scrolling: the span and the stamp. */}
          {`across ${pattern.spanDays} days of mentorship · ${updatedLabel(pattern.generatedAt)}`}
        </p>
      </div>

      {/* ── READING. One to three sentences, prose carries the meaning. */}
      <div className="mt-2.5 space-y-1.5">
        {pattern.reading.map((s) => (
          <p
            key={s}
            className="max-w-[78ch] text-[14px] text-[var(--text-primary)]"
            style={{ lineHeight: 1.55 }}
          >
            {s}
          </p>
        ))}
      </div>

      {/* ── TIMELINE STRIP. No axes, no gridlines, no legend box. */}
      <div className="relative mt-4">
        <div className="relative" style={{ height: H }}>
          <svg
            viewBox={`0 0 100 ${H}`}
            preserveAspectRatio="none"
            width="100%"
            height={H}
            aria-hidden
            className="absolute inset-0"
          >
            {/* THE QUIET BASELINE the score dots sit on. A single hairline, not a
                grid — it gives the dots something to be positioned against
                without turning the strip into a chart. */}
            <line
              x1="0"
              x2="100"
              y1={SCORE_BOTTOM + 4}
              y2={SCORE_BOTTOM + 4}
              stroke="var(--border-subtle)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {/* THE TRAJECTORY. Same muted stroke as the sparkline. */}
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
            {/* PRESENTATION TICKS — vertical strokes on the floor lane. Shape and
                position both differ from the other two classes. */}
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

          {/* ── THE MARKS, AS REAL BUTTONS. See the module note on why these are
              HTML rather than SVG shapes. */}
          {marks.map((m) => {
            const left = xPct(m.at, startAt, endAt);
            const top = markY(m);
            return (
              <button
                key={m.eventId}
                type="button"
                onClick={() => onSelectEvent(m.eventId)}
                /* TODO-COPY. Type and date — never the description. */
                aria-label={m.label}
                title={m.label}
                style={{ left: `${left}%`, top }}
                className={cn(
                  // 24px hit target, centred on the data point, so the visual
                  // mark can stay small without the control being small.
                  "absolute -ml-3 -mt-3 flex size-6 items-center justify-center rounded-full",
                  "transition-colors hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                {/* SHAPE PER CLASS. Colour is never the only channel: a dot, a
                    triangle and a tick differ with hue removed, and each sits in
                    its own vertical lane on top of that. */}
                {m.cls === "assessment" && (
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-[var(--text-primary)] ring-[1.5px] ring-[color:var(--surface-card)]"
                  />
                )}
                {m.cls === "flag" && (
                  <span aria-hidden className="relative flex items-center justify-center">
                    <span
                      // A triangle, drawn with borders so it needs no second svg.
                      className="size-0 border-x-[5px] border-b-[8px] border-x-transparent"
                      style={{ borderBottomColor: "var(--band-clay-fg)" }}
                    />
                    {/* A COALESCED MARK CARRIES ITS COUNT (see PatternMark.count).
                        The number is also in the accessible label, so this is the
                        second channel rather than the only one — a bigger mark
                        alone would be size-as-meaning. */}
                    {m.count > 1 && (
                      <span
                        className="absolute -right-2 -top-1.5 text-[9px] font-semibold leading-none tabular-nums text-[var(--text-primary)]"
                      >
                        {m.count}
                      </span>
                    )}
                  </span>
                )}
                {m.cls === "presentation" && (
                  // The tick itself is drawn in the SVG; this is the hit target,
                  // so it carries no mark of its own.
                  <span aria-hidden className="size-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── MONTH LABELS, muted and minimal. */}
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

      {/* ── FOOTER PROVENANCE. */}
      <p className={cn("mt-3", EYEBROW)}>
        {/* TODO-COPY */}
        AI-generated from events on this record, for context only — not a clinical
        determination.
      </p>
    </section>
  );
}
