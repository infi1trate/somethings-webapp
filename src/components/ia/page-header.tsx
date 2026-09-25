"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ONE HEADER, EVERY DESTINATION (addendum §2.10)
//
// ═══ WHAT IT REPLACES ═══
//
// Four headers written four times: Monitoring's h1-plus-subtitle, Tasks' own,
// the record surfaces', and whatever each placeholder did. They agreed on
// nothing — not the title's size, not whether a subtitle existed, not where a
// count went. A reader moving between destinations re-learned the top of the
// page each time.
//
// ═══ THE THREE PARTS, AND WHY THE THIRD IS A PAIR ═══
//
//  · TITLE. Larger than it was, with more room under it.
//  · PURPOSE. One line, on EVERY page, in one voice. A destination that cannot
//    say what it is for in a sentence is a destination that needs a brief, not
//    a header that hides the question.
//  · METRICS. Two at most, as a PAIR — not chips and not badges. Value
//    prominent, label quiet, figures tabular so the column does not jitter as
//    numbers change.
//
// A PAIR RATHER THAN CHIPS IS THE LOAD-BEARING PART. Chips are filters
// everywhere else in this product; a chip-shaped thing that cannot be pressed
// teaches a reader that chips sometimes do nothing. A badge implies an inbox.
// Two figures with quiet labels under them are a reading, which is what these
// are.
//
// ═══ NO METRIC MAY FRAME WORK AS AN INBOX TO EMPTY ═══
//
// §2.10's standing rule, and the reason `Today` and `Chat` take none at all:
// Today MIRRORS its destinations and a figure here would be a sixth copy of a
// number that already appears on a card, and a conversation count is not work.
//
// EVERY METRIC STRING IS NEEDS-COPY-NICOLE.

import { cn } from "@/lib/utils";

export interface PageMetric {
  /** The figure. A string, not a number: "oldest 20h" is a metric and "20" is
   *  not, and forcing a number here would push formatting into every caller. */
  value: string;
  /** NEEDS-COPY-NICOLE. What the figure counts, quietly. */
  label: string;
}

export function PageHeader({
  title,
  purpose,
  metrics = [],
  progress,
  children,
  className,
}: {
  title: string;
  /** NEEDS-COPY-NICOLE. One line, present on every destination. */
  purpose: string;
  /** At most two. A third is a dashboard, which this is not. */
  metrics?: PageMetric[];
  /** §2.11's track, when the destination has one. Sits in the header region,
   *  never as a modal and never as an interrupt. */
  progress?: React.ReactNode;
  /** Anything the destination pins beside its metrics — the live band's pause
   *  control is the only caller today. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-anno-ref="page-header"
      /* ═══ TWO PEER BLOCKS, TOPS ALIGNED (Refinement §2, §3.2) ═══
         It was `items-baseline`, which put the title's baseline and the first
         metric figure's on one line — right for two runs of text, wrong now
         that §3.2 gives the metric cluster a PANEL. A bordered box cannot sit
         on a text baseline without its top edge floating above the title.
         Tops aligned is what makes them read as one band of two peers, which
         is what §2 asked for and what the baseline trick was approximating. */
      className={cn("flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}
    >
      <div className="min-w-0 flex-1">
        {/* ═══ 32/40 — A BLOOM STOP, AND THE OFF-RAMP TITLE RETIRES ═══
            It was 28/36, which is not a step on the ramp (32/40 · 24/32 ·
            16/24 · 14/20 · 12/16). §2 asks for one more step up and the ramp's
            next stop is exactly that, so the instruction and the scale agree.
            Reported last pass as the one off-ramp value left deliberately
            alone; this is where it goes. */}
        <h1 className="font-display text-[32px] font-bold leading-[40px] text-[var(--text-primary)]">
          {title}
        </h1>
        {/* ═══ THE PURPOSE, NOT THE STATE ═══
            A sentence about what this destination IS, which does not change
            when the data does. Monitoring's old subtitle stated obligations —
            a reading, which is what the metrics are for — and the two were
            competing for the same line.
            ═══ 16/24, AND `mt-1` TIGHTENS THE LOCKUP (§2) ═══
            Larger rather than higher-contrast: against a 32px title, 14px read
            as a caption hanging off the heading rather than as its second line.
            16/24 is the ramp stop below 24/32, so the title and the purpose are
            two steps apart — enough hierarchy without the purpose receding.
            The gap goes 6px → 4px so the two read as ONE lockup; the air moves
            below the header instead, where it separates the block from the
            content. */}
        <p
          data-anno-ref="page-purpose"
          className="mt-1 max-w-prose text-[16px] leading-[24px] text-[var(--text-secondary)]"
        >
          {purpose}
        </p>
      </div>
      {(metrics.length > 0 || progress || children) && (
        /* ═══ THE CLUSTER IS A PANEL NOW (§3.2) ═══
           MEASURED before: `backgroundColor: rgba(0,0,0,0)`, `borderWidth: 0`,
           `borderRadius: 0` — bare page background, while the list and the pane
           both sit on `--surface-card` inside `--border-contour` at
           `--radius-elevated`. That is why it receded: it was the only content
           on the page with no panel under it.
           THE SAME THREE TOKENS, NOT A NEW TREATMENT. Zero new tokens is the
           standing rule, and a peer element should be built from the peers'
           own parts.
           ═══ AND IT IS ONE OBJECT, NOT THREE FRAGMENTS (§3.3) ═══
           Figures, labels and the track are inside one border with one padding
           box, so the grouping is structural rather than implied by proximity. */
        <div
          data-anno-ref="page-metric-panel"
          className="flex shrink-0 flex-col items-end gap-3 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-5 py-4"
        >
          <div className="flex items-baseline gap-5">
            {children}
            {metrics.length > 0 && (
              <div data-anno-ref="page-metrics" className="flex items-baseline gap-6">
                {metrics.map((m) => (
                  /* ═══ THE FIGURE AND ITS LABEL ON ONE LINE (§3.3) ═══
                     They were stacked — figure over label — which made each
                     pair two fragments and the cluster four. Inline, a pair is
                     one phrase ("69 open"), and the two pairs are two phrases
                     rather than a 2×2 grid.
                     THE NUMERAL CARRIES THE WEIGHT and the label stays quiet,
                     which is the same division the row uses. */
                  <p key={m.label} className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      data-metric-value={m.label}
                      className="font-display text-[24px] font-bold leading-[32px] tabular-nums text-[var(--text-primary)]"
                    >
                      {m.value}
                    </span>
                    {/* QUIET, AND NOT UPPERCASE. An all-caps label at 11px is
                        the treatment this codebase uses for an EYEBROW above
                        content; beside a figure it would compete with the
                        figure it describes. */}
                    <span className="truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
                      {m.label}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </div>
          {progress && <div className="w-full">{progress}</div>}
        </div>
      )}
    </div>
  );
}
