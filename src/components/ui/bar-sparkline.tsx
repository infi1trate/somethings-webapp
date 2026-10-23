"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A BAR SPARKLINE (proto/monitoring-merge) — shared
//
// Seven (or any number of) bars, 4px wide, 2px apart, 16px tall, in
// `--border-default`. Decorative: the number beside it carries the value, so
// it is aria-hidden. The record's `care-sparkline` and `score-sparkline` are
// LINES; this is the bar form Monitoring's engagement week asks for, added
// once here rather than inside the surface.

/** ═══ SIZES (Monitoring v2) ═══ The row's 18px: 4px bars, 2px apart. The
 *  card's 96×24: seven bars sharing the width. Rounded ends, `border-strong`
 *  (it was `border-default`, square). */
export function BarSparkline({ values, height = 18, width, variant }: { values: number[]; height?: 16 | 18 | 20 | 24; width?: number; variant?: "card-v3" }) {
  /* ═══ THE CARD'S v3 FORM (Monitoring v3, §4) ═══ 120×20 under the
     engagement numeral: bars share the width 3px apart, a 3px round, in
     text-tertiary — the LAST bar (today) in text-primary, so the week reads
     towards now. */
  if (variant === "card-v3")
    return (
      <span aria-hidden data-sparkline="card-v3" className="flex shrink-0 items-end gap-[3px]" style={{ height: 20, width: 120 }}>
        {values.map((v, i) => (
          <span
            key={i}
            data-bar-last={i === values.length - 1 || undefined}
            className={i === values.length - 1 ? "block flex-1 rounded-[3px] bg-[var(--text-primary)]" : "block flex-1 rounded-[3px] bg-[var(--text-tertiary)]"}
            style={{ height: `${Math.max(15, v)}%` }}
          />
        ))}
      </span>
    );
  return (
    /* The card's form: 8px bars spread across the width, a 3px round — a
       full pill turned a low bar into a dot (measured at 24px tall). */
    <span aria-hidden data-sparkline className={width ? "inline-flex shrink-0 items-end justify-between" : "inline-flex shrink-0 items-end gap-[2px]"} style={{ height, width }}>
      {values.map((v, i) => (
        <span
          key={i}
          className={width ? "block w-2 rounded-[3px] bg-[var(--border-strong)]" : "block w-1 rounded-full bg-[var(--border-strong)]"}
          style={{ height: `${Math.max(width ? 20 : 12, v)}%` }}
        />
      ))}
    </span>
  );
}
