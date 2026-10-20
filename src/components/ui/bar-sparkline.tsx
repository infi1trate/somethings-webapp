"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A BAR SPARKLINE (proto/monitoring-merge) — shared
//
// Seven (or any number of) bars, 4px wide, 2px apart, 16px tall, in
// `--border-default`. Decorative: the number beside it carries the value, so
// it is aria-hidden. The record's `care-sparkline` and `score-sparkline` are
// LINES; this is the bar form Monitoring's engagement week asks for, added
// once here rather than inside the surface.

export function BarSparkline({ values }: { values: number[] }) {
  return (
    <span aria-hidden data-sparkline className="inline-flex h-4 shrink-0 items-end gap-[2px]">
      {values.map((v, i) => (
        <span
          key={i}
          className="block w-1 rounded-[1px] bg-[var(--border-default)]"
          style={{ height: `${Math.max(8, v)}%` }}
        />
      ))}
    </span>
  );
}
