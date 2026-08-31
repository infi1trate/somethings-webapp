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

import { plotScoreY } from "@/components/record/score-sparkline";
import type { CarePattern, PatternMark } from "@/lib/record/care-pattern";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const EYEBROW = "text-[11.5px] leading-[16px] text-[var(--text-muted)]";

/** Strip geometry, compacted from the block's 72px to the brief's ~64. The lane
 *  ORDER and their separation are unchanged — only the gaps tightened, because
 *  the lanes are what make the classes distinguishable without colour. */
const H = 64;
const SCORE_TOP = 6;
const SCORE_BOTTOM = 34;
const FLAG_Y = 46;
const TICK_TOP = 54;
const TICK_BOTTOM = 62;

function xPct(at: number, startAt: number, endAt: number): number {
  const span = endAt - startAt || 1;
  return ((at - startAt) / span) * 100;
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
  if (!pattern) return null;

  const { startAt, endAt, marks, scoreMin, scoreMax, months } = pattern;

  const assessments = marks.filter(
    (m) => m.cls === "assessment" && m.score !== undefined
  );
  const line = assessments
    .map((m) => {
      const x = xPct(m.at, startAt, endAt);
      const y =
        plotScoreY(m.score!, scoreMin, scoreMax, SCORE_BOTTOM - SCORE_TOP, 4) +
        SCORE_TOP;
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
          {/* One hairline for the dots to be positioned against — not a grid.
              A grid would make this a chart, and it is a sparkline. */}
          <line
            x1="0"
            x2="100"
            y1={SCORE_BOTTOM + 3}
            y2={SCORE_BOTTOM + 3}
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
                <span
                  aria-hidden
                  className="relative flex items-center justify-center"
                >
                  <span
                    // A triangle drawn with borders, so it needs no second svg.
                    className="size-0 border-x-[5px] border-b-[8px] border-x-transparent"
                    style={{ borderBottomColor: "var(--band-clay-fg)" }}
                  />
                  {/* A coalesced mark carries its count — same-day flags become
                      one mark, or three identical labels stack at one x. The
                      number is in the accessible label too, so this is a second
                      channel rather than size-as-meaning. */}
                  {m.count > 1 && (
                    <span className="absolute -right-2 -top-1.5 text-[9px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">
                      {m.count}
                    </span>
                  )}
                </span>
              )}
              {m.cls === "presentation" && (
                // Drawn in the SVG; this is only the hit target.
                <span aria-hidden className="size-2" />
              )}
            </button>
          );
        })}
      </div>

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
