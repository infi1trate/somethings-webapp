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
      className={cn("flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}
    >
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[28px] font-bold leading-[36px] text-[var(--text-primary)]">
          {title}
        </h1>
        {/* ═══ THE PURPOSE, NOT THE STATE ═══
            A sentence about what this destination IS, which does not change
            when the data does. Monitoring's old subtitle stated obligations —
            a reading, which is what the metrics are for — and the two were
            competing for the same line. */}
        <p
          data-anno-ref="page-purpose"
          className="mt-1.5 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]"
        >
          {purpose}
        </p>
      </div>
      {(metrics.length > 0 || progress || children) && (
        <div className="flex shrink-0 flex-col items-end gap-2">
          {metrics.length > 0 && (
            <div data-anno-ref="page-metrics" className="flex items-start gap-6">
              {metrics.map((m) => (
                <div key={m.label} className="min-w-0 text-right">
                  <p
                    data-metric-value={m.label}
                    className="font-display text-[22px] font-bold leading-[28px] tabular-nums text-[var(--text-primary)]"
                  >
                    {m.value}
                  </p>
                  {/* QUIET, AND NOT UPPERCASE. An all-caps label at 11px is
                      the treatment this codebase uses for an EYEBROW above
                      content; under a figure it would compete with the figure
                      it describes. */}
                  <p className="mt-0.5 text-[12px] leading-[16px] text-[var(--text-secondary)]">
                    {m.label}
                  </p>
                </div>
              ))}
            </div>
          )}
          {progress}
          {children}
        </div>
      )}
    </div>
  );
}
