"use client";

// Record → Overview: the mentor's performance dashboard (replaces the earlier
// status mosaic; absorbs the retired Insights tab). Hand-rolled SVG charts —
// the repo has no chart lib. Third-person framing (staff view a mentor).
//
// TODO-DATA: every number here is illustrative demo data. Real values come from
// the IMP-6 aggregations (engagement/caseload series, retention, bonus, match
// rate) when they land — swap the DEMO_* consts for the live source.
//
// Charts (dataviz method): Engagement = change-over-time line (2 data series +
// a dashed Target reference); Retention = stacked bars (magnitude); Bonus = a
// progress meter; Match Rate = a stat tile. Categorical hues in fixed order,
// legend always present, recessive grid/axes; the Target's low-contrast green
// is carried by its dashed pattern + legend label (secondary encoding), never
// color alone (WCAG 1.4.1).

import { useState } from "react";
import { Timer, TrendingUp, UsersRound } from "lucide-react";

const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]";

// Series colors (fixed order). Engagement blue + Caseload orange are the
// CVD-safe pair; Target green is dashed (secondary encoding) — see header note.
const C_ENGAGEMENT = "#2f6fed";
const C_CASELOAD = "var(--brand)"; // #ff5001
const C_TARGET = "var(--doodle-green)"; // #3dbe6b
const C_RETAINED = "var(--brand)";
const C_DEACTIVATED = "#ffc7ad"; // light tangelo tint

const MONTHS = ["June 2025", "May 2025", "April 2025", "March 2025"];

// ── Engagement time series (day-of-month → count) ────────────────────────────
const DEMO_ENGAGEMENT: [number, number][] = [
  [0, 1], [2, 4], [4, 5], [6, 6], [8, 9], [10, 12],
  [12, 13], [14, 15], [16, 17], [18, 19], [20, 21],
];
const DEMO_CASELOAD: [number, number][] = [
  [0, 31], [2, 30], [4, 31], [6, 33], [8, 32], [10, 33],
  [12, 34], [14, 34], [16, 35], [18, 36], [20, 34],
];
const DEMO_TARGET = 29;
const DEMO_ENGAGED = { done: 6, total: 10, daysLeft: 14 };

// ── Retention (stacked: retained + de-activated per month) ───────────────────
const DEMO_RETENTION = [
  { month: "Jan", retained: 62, deactivated: 38 },
  { month: "Feb", retained: 88, deactivated: 26 },
  { month: "Mar", retained: 60, deactivated: 30 },
  { month: "Apr", retained: 42, deactivated: 30 },
  { month: "May", retained: 46, deactivated: 36 },
];
const DEMO_RETENTION_AVG = 34;

const DEMO_BONUS = { earned: 150, total: 300, remaining: 11, unlock: 60 };
const DEMO_MATCH = { rate: 65, viewed: 50, picked: 17 };

export function RecordOverview({ mentorName }: { mentorName: string }) {
  const [month, setMonth] = useState(MONTHS[0]);
  const first = mentorName.split(" ")[0] || "This mentor";

  return (
    <div className="space-y-5">
      {/* Header — month context + selector (third-person; the greeting the
          mock shows is first-person and doesn't fit a staff record). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            className="text-[var(--text-primary)]"
            style={{ font: "var(--type-card-title)" }}
          >
            Performance
          </h2>
          <p
            className="mt-0.5 text-[var(--text-secondary)]"
            style={{ font: "var(--type-helper)" }}
          >
            {mentorName} · {month}
          </p>
        </div>
        <label className="sr-only" htmlFor="overview-month">
          Month
        </label>
        <select
          id="overview-month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-1.5 text-sm text-[var(--text-secondary)]"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <EngagementCard first={first} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <BonusCard first={first} />
          <RetentionCard />
          <MatchRateCard />
        </div>
      </div>
    </div>
  );
}

// ── Engagement line chart ─────────────────────────────────────────────────────

const VB_W = 640;
const VB_H = 320;
const M = { top: 16, right: 14, bottom: 26, left: 32 };
const X_MAX = 30;
const Y_MAX = 37;
const px = (day: number) =>
  M.left + (day / X_MAX) * (VB_W - M.left - M.right);
const py = (v: number) => VB_H - M.bottom - (v / Y_MAX) * (VB_H - M.top - M.bottom);
const path = (pts: [number, number][]) =>
  pts.map(([d, v], i) => `${i ? "L" : "M"}${px(d)} ${py(v)}`).join(" ");

function EngagementCard({ first }: { first: string }) {
  // Hover crosshair: snap to the nearest sampled day (dataviz — line charts
  // ship an interactive layer). Pure SVG so it scales with the viewBox.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const days = DEMO_ENGAGEMENT.map(([d]) => d);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * VB_W;
    const day = ((vx - M.left) / (VB_W - M.left - M.right)) * X_MAX;
    let nearest = 0;
    for (let i = 1; i < days.length; i++) {
      if (Math.abs(days[i] - day) < Math.abs(days[nearest] - day)) nearest = i;
    }
    setHoverIdx(nearest);
  };

  const hx = hoverIdx != null ? px(days[hoverIdx]) : 0;
  const eng = hoverIdx != null ? DEMO_ENGAGEMENT[hoverIdx][1] : 0;
  const cas = hoverIdx != null ? DEMO_CASELOAD[hoverIdx][1] : 0;

  return (
    <section aria-label="Engagement" className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[var(--text-secondary)]"
            style={{ font: "var(--type-helper)" }}
          >
            Engagement
          </p>
          <h3 className="mt-0.5 font-display text-xl font-bold tracking-tight text-[var(--text-primary)]">
            {DEMO_ENGAGED.done} of {DEMO_ENGAGED.total} teens engaged
          </h3>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[var(--text-secondary)] tabular-nums" style={{ font: "var(--type-helper)" }}>
          <Timer className="size-4" aria-hidden />
          {DEMO_ENGAGED.daysLeft} days left
        </span>
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${first}'s engagement rose to ${DEMO_ENGAGEMENT.at(-1)?.[1]} against a caseload near ${DEMO_CASELOAD.at(-1)?.[1]} and a target of ${DEMO_TARGET}.`}
      >
        {/* Y gridlines + labels (recessive) */}
        {[5, 10, 15, 20, 25, 30, 35].map((v) => (
          <g key={v}>
            <line
              x1={M.left}
              x2={VB_W - M.right}
              y1={py(v)}
              y2={py(v)}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={py(v) + 3}
              textAnchor="end"
              className="fill-[var(--text-muted)]"
              fontSize={10}
            >
              {v}
            </text>
          </g>
        ))}
        {/* X labels */}
        {[0, 5, 10, 15, 20, 25, 30].map((d) => (
          <text
            key={d}
            x={px(d)}
            y={VB_H - 8}
            textAnchor="middle"
            className="fill-[var(--text-muted)]"
            fontSize={10}
          >
            {d}
          </text>
        ))}

        {/* Target — dashed reference (secondary encoding for the low-contrast green) */}
        <line
          x1={px(0)}
          x2={px(X_MAX)}
          y1={py(DEMO_TARGET)}
          y2={py(DEMO_TARGET)}
          stroke={C_TARGET}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        {/* Caseload */}
        <path d={path(DEMO_CASELOAD)} fill="none" stroke={C_CASELOAD} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* Engagement */}
        <path d={path(DEMO_ENGAGEMENT)} fill="none" stroke={C_ENGAGEMENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover crosshair + markers + tooltip */}
        {hoverIdx != null && (
          <g>
            <line x1={hx} x2={hx} y1={M.top} y2={VB_H - M.bottom} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={hx} cy={py(cas)} r={4} fill={C_CASELOAD} stroke="#fff" strokeWidth={2} />
            <circle cx={hx} cy={py(eng)} r={4} fill={C_ENGAGEMENT} stroke="#fff" strokeWidth={2} />
            <g transform={`translate(${Math.min(hx + 8, VB_W - 128)}, ${M.top})`}>
              <rect width={120} height={52} rx={8} fill="var(--surface-card)" stroke="var(--border-contour)" />
              <text x={10} y={18} fontSize={11} className="fill-[var(--text-muted)]">Day {days[hoverIdx]}</text>
              <text x={10} y={34} fontSize={11} className="fill-[var(--text-primary)]">
                <tspan fill={C_ENGAGEMENT}>●</tspan> Engaged {eng}
              </text>
              <text x={10} y={47} fontSize={11} className="fill-[var(--text-primary)]">
                <tspan fill="#ff5001">●</tspan> Caseload {cas}
              </text>
            </g>
          </g>
        )}

        {/* Transparent hit layer for hover */}
        <rect
          x={M.left}
          y={M.top}
          width={VB_W - M.left - M.right}
          height={VB_H - M.top - M.bottom}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
        />
      </svg>

      {/* Legend — identity never by color alone */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[var(--text-secondary)]" style={{ font: "var(--type-helper)" }}>
        <LegendKey color={C_ENGAGEMENT} label="Engagement" />
        <LegendKey color={C_TARGET} label="Target" dashed />
        <LegendKey color="var(--brand)" label="Caseload" />
      </div>
    </section>
  );
}

function LegendKey({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-0.5 w-4 rounded-full"
        style={
          dashed
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` }
            : { backgroundColor: color }
        }
      />
      {label}
    </span>
  );
}

// ── Monthly bonus meter ───────────────────────────────────────────────────────

function BonusCard({ first }: { first: string }) {
  const pct = Math.round((DEMO_BONUS.earned / DEMO_BONUS.total) * 100);
  return (
    <section aria-label="Monthly bonus" className={CARD}>
      <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-helper)" }}>
        Monthly Bonus
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--doodle-green)] tabular-nums">
          Bonus: ${DEMO_BONUS.earned}
        </span>
        <span className="text-[var(--text-muted)] tabular-nums" style={{ font: "var(--type-helper)" }}>
          ${DEMO_BONUS.total}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-s1)]"
        role="progressbar"
        aria-valuenow={DEMO_BONUS.earned}
        aria-valuemin={0}
        aria-valuemax={DEMO_BONUS.total}
        aria-label="Bonus progress"
      >
        <div className="h-full rounded-full bg-[var(--doodle-green)]" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--surface-s1)] px-3 py-2 text-[var(--text-secondary)]" style={{ font: "var(--type-helper)", lineHeight: 1.5 }}>
        <UsersRound className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
        <span>
          Engage {DEMO_BONUS.remaining} more teens to unlock {first}&apos;s ${DEMO_BONUS.unlock} bonus.
        </span>
      </div>
    </section>
  );
}

// ── Retention stacked bars ────────────────────────────────────────────────────

function RetentionCard() {
  const RB_W = 280;
  const RB_H = 140;
  const pad = { top: 8, bottom: 22, left: 6, right: 6 };
  const maxTotal = Math.max(...DEMO_RETENTION.map((m) => m.retained + m.deactivated));
  const n = DEMO_RETENTION.length;
  const slot = (RB_W - pad.left - pad.right) / n;
  const barW = 30;
  const h = (v: number) => (v / maxTotal) * (RB_H - pad.top - pad.bottom);

  return (
    <section aria-label="Average monthly retention" className={CARD}>
      <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-helper)" }}>
        Avg. Monthly Retention
      </p>
      <h3 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
        {DEMO_RETENTION_AVG}%
      </h3>

      <svg viewBox={`0 0 ${RB_W} ${RB_H}`} className="mt-3 w-full" role="img" aria-label="Retained vs de-activated mentees, January through May.">
        {DEMO_RETENTION.map((m, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const x = cx - barW / 2;
          const retH = h(m.retained);
          const deactH = h(m.deactivated);
          const baseY = RB_H - pad.bottom;
          // De-activated on top, retained on the bottom; 2px surface gap between.
          const retY = baseY - retH;
          const deactY = retY - 2 - deactH;
          return (
            <g key={m.month}>
              <rect x={x} y={deactY} width={barW} height={Math.max(0, deactH)} rx={4} fill={C_DEACTIVATED}>
                <title>{m.month}: {m.deactivated} de-activated</title>
              </rect>
              <rect x={x} y={retY} width={barW} height={Math.max(0, retH)} rx={4} fill={C_RETAINED}>
                <title>{m.month}: {m.retained} retained</title>
              </rect>
              <text x={cx} y={RB_H - 6} textAnchor="middle" className="fill-[var(--text-muted)]" fontSize={11}>
                {m.month}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-center gap-x-5 text-[var(--text-secondary)]" style={{ font: "var(--type-helper)" }}>
        <LegendDot color={C_RETAINED} label="Retained" />
        <LegendDot color={C_DEACTIVATED} label="De-activated" />
      </div>
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ── Match rate stat tile ──────────────────────────────────────────────────────

function MatchRateCard() {
  return (
    <section aria-label="Match rate" className={CARD}>
      <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-helper)" }}>
        Match Rate
      </p>
      <h3 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
        {DEMO_MATCH.rate}%
      </h3>
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--alert-critical-bg)] px-3 py-2 text-[var(--text-secondary)]" style={{ font: "var(--type-helper)", lineHeight: 1.5 }}>
        <TrendingUp className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
        <span>
          Profile was viewed {DEMO_MATCH.viewed} times and picked {DEMO_MATCH.picked} times.
        </span>
      </div>
    </section>
  );
}
