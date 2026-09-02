"use client";

// THE SURVEY COMPARISON GRID — one table, two homes.
//
// ═══ WHAT IT IS FOR, IN ONE SENTENCE ═══
//
// A supervisor reads a rationale claiming the movement "sits in the items that
// carry the presentation on record". This is where they check that claim, and
// they should be able to do it in seconds without reading a word of prose.
//
// ═══ WHY IT IS A GRID AND NOT THREE TABLES ═══
//
// The thing being verified is a COMPARISON: did question 3 move, or has it been
// a 2 for seven months? Stacked per-survey tables put the two numbers a reader is
// comparing on different screens. Questions as rows and surveys as columns puts
// them side by side, which is the entire job.
//
// ═══ POINTS IN THE CELLS, WORDS IN THE LEGEND ═══
//
// The previous display put the answer text in every cell — "More than half the
// days" nine times down a column — and at three columns it stopped being a table
// and became a wall. The cell carries the number, which is what varies and what
// sums; the wording sits once in the legend beneath, and on the cell's own label
// for anyone who wants it per-cell.
//
// THE LEGEND IS DERIVED FROM THE DATA, not from a constant in here. A second copy
// of the answer scale is how a future instrument gets labelled with PHQ-9's
// wording — the grid reads the labels off the items it was handed, so it is
// correct for any instrument by construction.
//
// ═══ COLUMN ORDER RUNS OLDEST → NEWEST ═══
//
// The data arrives newest-first, because that is the order every other surface
// reads it in. Time reads left to right, so the columns are reversed for display
// and the weights stay pinned to the ORIGINAL index — reversing both would have
// quietly weighted the oldest survey most.

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AGGREGATE_WEIGHTS,
  INSTRUMENT_MAX,
  type CareAssessment,
} from "@/lib/record/care-demo";
import { bandLabel } from "@/components/record/score-chip";
import { Provenance } from "@/components/record/provenance";
import { clinicalDate } from "@/components/record/care-presentation";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** ═══ TWO INTENSITY STEPS, AND THE DIGIT IS ALWAYS THERE ═══
 *
 *  A weighted item at 2 or 3 is what "carries the presentation" means in
 *  practice, so those cells take a tint from the record's own attention ramp —
 *  sand at 2, amber at 3. Nothing below 2 is tinted: a table where most cells
 *  are coloured has no emphasis, only texture.
 *
 *  COLOUR IS NEVER THE CARRIER (SC 1.4.1). The number is in the cell whether it
 *  is tinted or not, the totals reconcile without reference to any tint, and the
 *  band chips name their band in words. The tint is an accelerant for the eye,
 *  and removing every colour from this table loses nothing but speed.
 *
 *  Each step pairs its own `-fg` with its `-bg`, which is what those token pairs
 *  are for — picking a foreground by hand is how a tint ends up at 3:1. */
const TINT: Record<number, string> = {
  2: "bg-[var(--band-sand-bg)] text-[var(--band-sand-fg)]",
  3: "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]",
};

/** TODO-COPY. Plain language, not formula soup — see the brief. It says what the
 *  number leans on and what it is for, and stops. */
const WEIGHTING_NOTE =
  "The weighted score leans on the most recent survey more than the ones before it, so a single old reading cannot hold the number up or drag it down. It is here to show the direction of a period rather than the result of one day.";

export interface SurveyComparisonGridProps {
  /** NEWEST FIRST — the order `weightedAggregate` and every other surface uses.
   *  Up to three are read; anything beyond is ignored rather than squeezed in. */
  surveys: CareAssessment[];
  /** The aggregate the card headline shows, so the totals row can reconcile with
   *  it. Null on a single-survey record, where a weighted column would be the
   *  mean of one number. */
  weighted: { score: number; severity: string } | null;
  className?: string;
}

export function SurveyComparisonGrid({
  surveys,
  weighted,
  className,
}: SurveyComparisonGridProps) {
  /** ONE TOOLTIP FOR THE WHOLE GRID, fixed-positioned.
   *
   *  A tooltip per cell would be ~30 popovers, and an absolutely-positioned one
   *  inside a table that may scroll horizontally gets clipped by its own
   *  container. One element at the root, positioned to whichever cell is hovered
   *  or FOCUSED, has neither problem.
   *
   *  It is `aria-hidden`, deliberately: every cell button already carries the
   *  whole sentence in its own `aria-label`, so a screen reader gets the answer
   *  wording directly from the cell rather than from a floating node it would
   *  have to be told to follow. This tooltip is a sighted convenience — for the
   *  pointer and for the keyboard, which is why focus opens it too.
   *
   *  1.4.13: the content is NOT hover-only. It is on the cell's label and in the
   *  legend under the table, both permanently. Escape dismisses. */
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);

  const show = useCallback((el: HTMLElement, text: string) => {
    const r = el.getBoundingClientRect();
    setTip({ text, x: r.left + r.width / 2, y: r.top });
  }, []);

  const ordered = useMemo(
    () => surveys.slice(0, AGGREGATE_WEIGHTS.length),
    [surveys]
  );
  /** Columns run oldest → newest. The weight for a column is looked up by its
   *  ORIGINAL newest-first index, never by its display position. */
  const columns = useMemo(
    () => ordered.map((s, i) => ({ survey: s, weight: AGGREGATE_WEIGHTS[i] ?? 0 })).reverse(),
    [ordered]
  );

  /** The question list comes from the newest survey — same instrument across the
   *  set, so the rows are its rows. */
  const questions = useMemo(
    () => ordered[0]?.items.map((i) => i.question) ?? [],
    [ordered]
  );

  /** THE PER-QUESTION WEIGHTED VALUE, by the same rule as the headline score.
   *  This is the column a reader actually scans: which items carry the
   *  presentation across the period, not just last Tuesday. */
  const weightedPoints = useMemo(
    () =>
      questions.map((_, qi) => {
        let total = 0;
        let divisor = 0;
        ordered.forEach((s, si) => {
          const w = AGGREGATE_WEIGHTS[si] ?? 0;
          const pts = s.items[qi]?.points;
          if (pts === undefined) return;
          total += pts * w;
          divisor += w;
        });
        return divisor ? Math.round(total / divisor) : 0;
      }),
    [questions, ordered]
  );

  /** SINGLE SURVEY: NO WEIGHTED COLUMN. A recency-weighted mean of one reading is
   *  the reading, and a column that restates its neighbour teaches a reader that
   *  columns here can be noise. The totals row still renders — it is the line
   *  that reconciles with the card's headline. */
  const showWeighted = !!weighted && ordered.length >= 2;

  /** Points → wording, read off the items themselves. See the module note. */
  const legend = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of ordered) {
      for (const it of s.items) if (!m.has(it.points)) m.set(it.points, it.answer);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [ordered]);

  /** ═══ SHORT DATES, WITH THE YEAR ONLY WHERE IT EARNS ITS PLACE ═══
   *  "May 12" rather than "May 12, 2026": four of the header's characters were
   *  the same year repeated across every column, and the header is the tightest
   *  space in the table. The full date lives in the column's tooltip.
   *  THE EXCEPTION IS A COLLISION. Two surveys a year apart land on the same
   *  month and day, and then the short forms are indistinguishable — so the year
   *  comes back, on the colliding columns only, rather than on all of them
   *  forever. */
  const headerDates = useMemo(() => {
    const short = columns.map((c) =>
      new Date(c.survey.at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );
    const seen = new Map<string, number>();
    for (const d of short) seen.set(d, (seen.get(d) ?? 0) + 1);
    return short.map((d, i) =>
      (seen.get(d) ?? 0) > 1
        ? `${d}, ${new Date(columns[i]!.survey.at).getFullYear()}`
        : d
    );
  }, [columns]);

  if (ordered.length === 0) return null;


  const instrument = ordered[0]?.instrument ?? "";
  const max = INSTRUMENT_MAX[instrument as keyof typeof INSTRUMENT_MAX];
  const totalFor = (s: CareAssessment) =>
    s.items.reduce((a, i) => a + i.points, 0);

  /** 32–36px rows, per the density spec — `h-[34px]` sits in the middle of it
   *  and holds 13px text with room to breathe at 200% zoom. */
  const ROW = "h-[34px]";
  const NUMCOL = "w-[58px]";

  return (
    <div
      ref={rootRef}
      className={cn("min-w-0", className)}
      onKeyDown={(e) => {
        // 1.4.13 — dismissible without moving the pointer or the focus.
        if (e.key === "Escape" && tip) {
          e.stopPropagation();
          setTip(null);
        }
      }}
      onMouseLeave={() => setTip(null)}
    >
      {/* The table is allowed its own horizontal scroll rather than forcing the
          drawer or the card to grow. In practice it fits both at the widths
          these live at — the guard is for 200% zoom. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[300px] border-collapse text-left tabular-nums">
          <caption className="sr-only">
            {/* TODO-COPY */}
            {instrument} answers by question, one column per survey, oldest
            first{showWeighted ? ", with the recency-weighted value last" : ""}.
          </caption>
          <colgroup>
            <col />
            {columns.map((c) => (
              <col key={c.survey.at} className={NUMCOL} />
            ))}
            {showWeighted && <col className={NUMCOL} />}
          </colgroup>

          <thead>
            <tr>
              <th
                scope="col"
                className="pb-2 pr-3 align-bottom font-medium text-[var(--text-muted)]"
                style={LABEL_STYLE}
              >
                {/* TODO-COPY */}
                Question
              </th>
              {columns.map((c, i) => (
                <th
                  key={c.survey.at}
                  scope="col"
                  className="pb-2 pl-2 align-bottom text-right font-normal"
                  /* THE FULL DATE, on the column. `title` is the right weight
                     here: the header is not interactive, the information is a
                     nicety rather than the content, and the totals row below
                     already carries the number this column is about. */
                  title={`${c.survey.instrument} · ${clinicalDate(c.survey.at)}`}
                >
                  <span className="block text-[12px] leading-[16px] text-[var(--text-muted)]">
                    {headerDates[i]}
                  </span>
                  {/* LINE 2 — total and band together, so the header is two
                      lines rather than three and the columns stay short. */}
                  <span className="block truncate text-[13px] leading-[18px] text-[var(--text-primary)]">
                    {totalFor(c.survey)}{" "}
                    <span className="text-[var(--text-muted)]">
                      · {bandLabel(c.survey.severity)}
                    </span>
                  </span>
                </th>
              ))}
              {showWeighted && (
                /* THE WEIGHTED COLUMN IS THE ONE WITH A FILL. It is the only
                   column that is not a survey — it is an interpretation of the
                   three beside it — so it reads as a different kind of thing
                   rather than a fourth reading. */
                <th
                  scope="col"
                  className="rounded-t-[var(--radius-inset)] bg-[var(--surface-s1)] pb-2 pl-2 pr-2 align-bottom text-right font-normal"
                >
                  <span className="flex items-center justify-end gap-1 text-[12px] leading-[16px] text-[var(--text-muted)]">
                    {/* TODO-COPY */}
                    Weighted
                    {/* THE EXISTING ⓘ, reused with its own note — see
                        `provenance.tsx`. It is already dismissible, hoverable
                        and focus-openable, which is the 1.4.13 machinery this
                        would otherwise have to grow for itself. */}
                    <Provenance label="Weighted" note={WEIGHTING_NOTE} />
                  </span>
                  <span className="block truncate text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]">
                    {weighted!.score}{" "}
                    <span className="font-normal text-[var(--text-muted)]">
                      · {bandLabel(weighted!.severity)}
                    </span>
                  </span>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {questions.map((q, qi) => {
              const wv = weightedPoints[qi] ?? 0;
              return (
                <tr key={q} className="border-t border-[var(--border-subtle)]">
                  <th
                    scope="row"
                    className={cn(
                      ROW,
                      "max-w-0 truncate pr-3 text-left align-middle text-[13px] font-normal leading-[18px] text-[var(--text-primary)]"
                    )}
                    title={q}
                  >
                    {q}
                  </th>

                  {columns.map((c) => {
                    const it = c.survey.items[qi];
                    return (
                      <td key={c.survey.at} className={cn(ROW, "pl-2 align-middle")}>
                        <button
                          type="button"
                          /* THE WHOLE SENTENCE, on the cell itself. A screen
                             reader never has to find the tooltip, and this is
                             what makes the visual tooltip a convenience rather
                             than the only route to the wording. TODO-COPY. */
                          aria-label={`${q}, ${c.survey.instrument} ${clinicalDate(c.survey.at)}: ${it?.answer ?? "no answer"}, ${it?.points ?? 0} ${it?.points === 1 ? "point" : "points"}`}
                          onFocus={(e) =>
                            it && show(e.currentTarget, it.answer)
                          }
                          onBlur={() => setTip(null)}
                          onMouseEnter={(e) =>
                            it && show(e.currentTarget, it.answer)
                          }
                          className={cn(
                            "block w-full rounded-[var(--radius-inset)] py-1 text-right text-[13px] leading-[18px] text-[var(--text-primary)]",
                            "transition-colors hover:bg-[var(--tint-hover)]",
                            RING
                          )}
                        >
                          {it?.points ?? "—"}
                        </button>
                      </td>
                    );
                  })}

                  {showWeighted && (
                    <td
                      className={cn(
                        ROW,
                        "bg-[var(--surface-s1)] px-2 align-middle text-right"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block min-w-[24px] rounded-[var(--radius-inset)] px-1.5 py-0.5 text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]",
                          TINT[wv]
                        )}
                      >
                        {wv}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* ═══ THE TOTALS ROW IS PINNED ═══
              It is the line that has to reconcile with the card's headline
              score, so it stays put while the questions scroll under it. Sticky
              rather than merely last: at 200% zoom, or in a short drawer, the
              questions are what scrolls and the totals are what a reader is
              checking them against. */}
          {/* ═══ THE TOTALS ARE A ROW, NOT A BAR ═══
              It used to be `sticky bottom-0` on its own card-coloured fill with
              a 2px rule — which made it a component sitting under the table
              rather than the table's last line, and the fill cut across the
              weighted column's tint so that column visibly stopped short of its
              own total. Sticky bought nothing either: nine questions never
              scroll.
              Now it is a row like the others — same height, the same hairline
              the question rows use, no fill of its own — and the weighted
              column's tint runs through it unbroken. */}
          <tfoot>
            <tr className="border-t border-[color:var(--border-subtle)]">
              <th
                scope="row"
                className={cn(ROW, "pr-3 text-left align-middle font-medium text-[var(--text-muted)]")}
                style={LABEL_STYLE}
              >
                {/* TODO-COPY — the denominator comes from the instrument, never
                    a literal, for the reason the card states at length. */}
                Total{max ? ` / ${max}` : ""}
              </th>
              {columns.map((c) => (
                <td
                  key={c.survey.at}
                  className={cn(
                    ROW,
                    "pl-2 align-middle text-right text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]"
                  )}
                >
                  {totalFor(c.survey)}
                </td>
              ))}
              {showWeighted && (
                <td
                  className={cn(
                    ROW,
                    "rounded-b-[var(--radius-inset)] bg-[var(--surface-s1)] px-2 align-middle text-right"
                  )}
                >
                  <span className="text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]">
                    {weighted!.score}
                  </span>
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ═══ THE LEGEND — the accessible fallback, and the reason cells can be
              bare numbers at all ═══
          One line, derived from the items on screen. TODO-COPY.

          ═══ R6/C4: A FOOTER STRIP ON THE GRID, NOT A FLOATING CAPTION ═══
          It was a bare line of muted text sitting on the page below the table,
          which read as a stray sentence rather than as part of the grid — and at
          the width of the table it was a very long thin line with nothing holding
          it. On the grid's own subtle surface, full width, flush to the table
          above it, it reads as the table's footer: the same object, quietly. No
          new token — `--surface-s1` is the grid's existing inset surface, and the
          hairline is the one the table's own rows use. */}
      <p className="rounded-b-[var(--radius-inset)] border-t border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-3 py-2 text-[12px] leading-[16px] text-[var(--text-muted)]">
        {legend.map(([pts, label], i) => (
          <span key={pts}>
            {i > 0 && <span aria-hidden> · </span>}
            <span className="tabular-nums">{pts}</span>
            {` ${label}`}
          </span>
        ))}
      </p>

      {tip && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-[var(--radius-inset)] bg-[var(--text-primary)] px-2 py-1 text-[12px] leading-[16px] text-[var(--text-inverse)] shadow-md"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
