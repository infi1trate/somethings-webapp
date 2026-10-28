"use client";

// ═══════════════════════════════════════════════════════════════════════════
// METRIC — the Care Record stat (moved from `care-summary.tsx`, pack v11.0)
//
// Label over value; the value a pure number at 20/26, tabular, so a column
// of records lines up and a row of values shares a baseline; units and
// windows live in the label. One component, so the record's Care tab and the
// chat Care hero cannot drift apart (§4.4: "reuse those styles, do not
// invent").

import { cn } from "@/lib/utils";

const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

export /** One metric: label ABOVE value, per the brief. Values are tabular so the
 *  numbers line up down a column of records, which is the whole point of a
 *  named metric keeping its own format. */
function Metric({
  slot,
  label,
  children,
  sub,
  tone = "default",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  /** The muted second line — a date, a lock, a countdown. */
  sub?: React.ReactNode;
  /** "warning" is used ONLY by an overdue countdown, and only on the sub-line.
   *  It never tints a surface — see the module note on honest severity. */
  tone?: "default" | "warning";
  /** A hook for probes and the hero's live tick. */
  slot?: string;
}) {
  return (
    <div className="min-w-0" data-metric={slot}>
      <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
        {label}
      </p>
      {/* ~20px, tabular. Values rise so the row scans as data; labels dropped
          to 12px so the pair reads label-then-value rather than two peers. */}
      <p className="mt-1 flex min-w-0 items-center gap-2 text-[20px] leading-[26px] tabular-nums text-[var(--text-primary)]">
        {children}
      </p>
      {sub && (
        <p
          className={cn(
            "mt-0.5 text-[13px] leading-[18px]",
            tone === "warning"
              ? "font-semibold text-[var(--alert-warning-fg)]"
              : "text-[var(--text-muted)]"
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

