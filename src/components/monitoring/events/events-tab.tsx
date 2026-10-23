"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING · EVENTS — a calm log, not a filter console (Monitoring v3, §5)
//
// Escalations, risk flags, tier changes and reviews as EVENTS, newest first —
// a log, unlike the per-teen timeline. Top to bottom:
//   toolbar   ONE row: the range control · a Filters button (its badge counts
//             the applied facets; a popover holds event types, tiers, mentor,
//             supervisor) · Export CSV at the right. The loose chip rows are
//             gone; applied filters show as removable chips in a second row,
//             and only when any are active.
//   summary   one sentence, 13 secondary, numerals tabular
//   stream    day headers (sticky, the day's count after a middle dot), then
//             56px rows: time · the type glyph in a soft circle · teen ·
//             mentor · the detail beneath · the state as quiet text at the
//             right (a 6px dot only while Open). Consecutive flags on one
//             teen in a day collapse into one row that expands to them.
//
// ONE SOURCE: `monitoringEvents` (lib/monitoring/events.ts), derived from the
// store the Watch tab reads; the hero above reads the same filtered range.
//
// ═══ WINDOWED BY DAY ═══ A day section renders only near the viewport;
// elsewhere it is a placeholder at its MEASURED height (estimated until
// seen), so 400+ events are a short DOM and the scrollbar stays honest. The
// day header stays sticky inside its rendered section.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Check, ChevronDown, Download, FileText, Flag, SlidersHorizontal, Triangle, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LucideIcon } from "lucide-react";
import { AuditLozenge } from "@/components/tiering/tier-history";
import {
  KIND_LABEL,
  collapseRepeats,
  duration,
  filterFacets,
  isRun,
  eventsCsv,
  rangeSummary,
  timelineHref,
  type EventFilter,
  type EventItem,
  type FlagRun,
  type MonitoringEvent,
  type MonitoringEventKind,
  type RangeId,
} from "@/lib/monitoring/events";
import type { Tier } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DAY_LABEL = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const FULL = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const GLYPH: Record<MonitoringEventKind, LucideIcon> = { escalation: Triangle, flag: Flag, tier_change: ArrowUpDown, note: FileText };
const KINDS: MonitoringEventKind[] = ["escalation", "flag", "tier_change", "note"];
const RANGES: { id: RangeId; label: string }[] = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "custom", label: "Custom" },
];
const RANGE_NAME: Record<RangeId, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", "90d": "90 days", custom: "this range" };
const STATE_LABEL: Record<MonitoringEvent["state"], string> = { open: "Open", confirmed: "Confirmed", closed: "Closed", recorded: "Recorded" };

/** A roving radiogroup, the WAI pattern — one tab stop, arrows move and select. */
function onRadioKeys(ev: React.KeyboardEvent<HTMLElement>) {
  const step = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  const radios = [...ev.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const i = radios.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  ev.preventDefault();
  const next = radios[(i + step + radios.length) % radios.length];
  next.focus();
  next.click();
}

function Toggle({ on, onClick, children, slot }: { on: boolean; onClick: () => void; children: React.ReactNode; slot: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      data-filter-chip={slot}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] leading-[18px]",
        on ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)] text-[var(--text-primary)]" : "border-[color:var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
        RING
      )}
    >
      {on && <Check aria-hidden className="size-3.5" />}
      {children}
    </button>
  );
}

function Picker({ label, value, onChange, options, slot }: { label: string; value: string; onChange: (v: string) => void; options: string[]; slot: string }) {
  const id = useId();
  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <input
        type="search"
        data-filter-picker={slot}
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        /* TODO-COPY */
        placeholder={label}
        className={cn("h-8 w-36 rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-[13px] leading-[18px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]", RING)}
      />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </label>
  );
}

// ── THE TOOLBAR — one row ────────────────────────────────────────────────────

function Toolbar({ f, set, mentors, supervisors, onExport }: { f: EventFilter; set: (p: Partial<EventFilter>) => void; mentors: string[]; supervisors: string[]; onExport: () => void }) {
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const facets = filterFacets(f);
  return (
    <div className="space-y-2">
      <div data-events-filter className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {/* THE RANGE — the pill control's look, kept a roving radiogroup:
            one tab stop, the arrows move and select. */}
        <div role="radiogroup" aria-label="Time range" onKeyDown={onRadioKeys} data-range-group className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-[var(--surface-s2)] p-1">
          {RANGES.map((r) => {
            const on = f.range === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                data-range={r.id}
                onClick={() => set({ range: r.id })}
                className={cn(
                  "relative inline-flex h-9 items-center rounded-full px-4 text-[14px] leading-[20px] tabular-nums transition-[color,background-color,box-shadow] after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
                  on ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-tile)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        {f.range === "custom" && (
          <span data-custom-range className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
            <input type="date" aria-label="From" data-range-from value={f.from ?? ""} onChange={(e) => set({ from: e.target.value })} className={cn("h-9 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3 text-[13px] text-[var(--text-primary)]", RING)} />
            <span aria-hidden>–</span>
            <input type="date" aria-label="To" data-range-to value={f.to ?? ""} onChange={(e) => set({ to: e.target.value })} className={cn("h-9 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3 text-[13px] text-[var(--text-primary)]", RING)} />
          </span>
        )}
        {/* THE FILTERS — one button, its badge the count of applied facets */}
        <Popover>
          <PopoverTrigger
            data-filters-button
            aria-label={facets.length ? `Filters, ${facets.length} applied` : "Filters"}
            className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 text-[14px] leading-[20px] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
          >
            <SlidersHorizontal aria-hidden className="size-4 text-[var(--icon-secondary)]" />
            {/* TODO-COPY */}
            Filters
            {facets.length > 0 && (
              <span aria-hidden data-filters-badge className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[11px] leading-none tabular-nums text-[var(--text-inverse)]">
                {facets.length}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" data-filters-popover className="w-80 gap-4 rounded-[16px] bg-[var(--surface-raised)] p-4">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-[12px] leading-[16px] font-medium text-[var(--text-tertiary)]">
                {/* TODO-COPY */}
                Event types
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <Toggle key={k} slot={k} on={f.kinds.includes(k)} onClick={() => set({ kinds: toggle(f.kinds, k) })}>
                    {KIND_LABEL[k]}
                  </Toggle>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-[12px] leading-[16px] font-medium text-[var(--text-tertiary)]">
                {/* TODO-COPY */}
                Tiers
              </legend>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4] as Tier[]).map((t) => (
                  <Toggle key={t} slot={`t${t}`} on={f.tiers.includes(t)} onClick={() => set({ tiers: toggle(f.tiers, t) })}>
                    T{t}
                  </Toggle>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <Picker slot="mentor" label="Mentor" value={f.mentor} onChange={(v) => set({ mentor: v })} options={mentors} />
              <Picker slot="supervisor" label="Supervisor" value={f.supervisor} onChange={(v) => set({ supervisor: v })} options={supervisors} />
            </div>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          data-export-csv
          onClick={onExport}
          className={cn("ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 text-[14px] leading-[20px] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
        >
          <Download aria-hidden className="size-4 text-[var(--icon-secondary)]" />
          {/* TODO-COPY */}
          Export CSV
        </button>
      </div>
      {/* THE APPLIED FILTERS — a second row, only when any are active */}
      {facets.length > 0 && (
        <div data-applied-filters role="group" aria-label="Applied filters" className="flex flex-wrap items-center gap-1.5">
          {facets.map((x) => (
            <button
              key={x.key}
              type="button"
              data-applied-chip={x.key}
              aria-label={`Remove filter: ${x.label}`}
              onClick={() => set(x.clear)}
              className={cn("inline-flex h-8 items-center gap-1 rounded-full bg-[var(--surface-s2)] pr-2 pl-3 text-[13px] leading-[18px] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
            >
              {x.label}
              <X aria-hidden className="size-3.5 text-[var(--icon-secondary)]" />
            </button>
          ))}
          <button
            type="button"
            data-clear-filters
            onClick={() => set(Object.assign({}, ...facets.map((x) => x.clear)))}
            className={cn("inline-flex h-8 items-center rounded-sm px-1 text-[13px] leading-[18px] text-[var(--text-secondary)] underline underline-offset-2 hover:no-underline", RING)}
          >
            {/* TODO-COPY */}
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

// ── SUMMARY LINE ────────────────────────────────────────────────────────────

/** A numeral in the summary: tabular, in the sentence's own face. */
function N({ v }: { v: string | number }) {
  return <span className="tabular-nums text-[var(--text-primary)]">{v}</span>;
}

function Summary({ events, range }: { events: MonitoringEvent[]; range: RangeId }) {
  const s = rangeSummary(events);
  return (
    <p data-events-summary className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
      {/* TODO-COPY */}
      <N v={range === "custom" ? "Custom" : range} /> · <N v={s.escalations} /> escalation{s.escalations === 1 ? "" : "s"} (<N v={s.t1} /> T1, <N v={s.t2} /> T2) · median response{" "}
      <N v={s.medianResponseSeconds === null ? "—" : duration(s.medianResponseSeconds * 1000)} /> · <N v={s.flags} /> flag{s.flags === 1 ? "" : "s"}, <N v={s.surge} /> surge · <N v={s.tierChanges} /> tier change{s.tierChanges === 1 ? "" : "s"}
    </p>
  );
}

// ── THE STREAM ──────────────────────────────────────────────────────────────

function dayKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(ms: number, now: number) {
  const k = dayKey(ms);
  if (k === dayKey(now)) return "Today";
  if (k === dayKey(now - 86_400_000)) return "Yesterday";
  return DAY_LABEL.format(ms);
}

/** ═══ THE RECORD, EXPANDED ═══ Inset 16, the same quiet type, and the way
 *  into the timeline. */
function EventRecord({ e, panel, href }: { e: MonitoringEvent; panel: string; href: string | null }) {
  return (
    <div id={panel} data-event-record className="mx-4 mt-2 mb-2 space-y-2 rounded-[12px] bg-[var(--surface-sunken)] px-4 py-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px] leading-[18px]">
        <dt className="text-[var(--text-tertiary)]">When</dt>
        <dd className="tabular-nums text-[var(--text-primary)]">{FULL.format(e.at)}</dd>
        <dt className="text-[var(--text-tertiary)]">Who</dt>
        <dd className="text-[var(--text-primary)]">{[e.mentorName, e.supervisorName].filter(Boolean).join(" · ")}</dd>
        {e.responseSeconds !== undefined && (
          <>
            <dt className="text-[var(--text-tertiary)]">Response</dt>
            <dd className="font-mono tabular-nums text-[var(--text-primary)]">{duration(e.responseSeconds * 1000)}</dd>
          </>
        )}
        {e.document && (
          <>
            <dt className="text-[var(--text-tertiary)]">Document</dt>
            <dd data-event-document className="text-[var(--text-primary)]">
              {e.document.title}
              {e.document.fields === null ? (
                <span className="text-[var(--text-secondary)]"> · fields TBD</span>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {e.document.fields.map((x) => (
                    <li key={x.label} className="text-[var(--text-secondary)]">
                      <span className="text-[var(--text-tertiary)]">{x.label}: </span>
                      {x.value || "—"}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </>
        )}
      </dl>
      {href && (
        <Link href={href} data-event-timeline className={cn("inline-flex min-h-8 items-center rounded-sm text-[13px] leading-[18px] text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}>
          {/* TODO-COPY */}
          Open timeline ›
        </Link>
      )}
    </div>
  );
}

/** The state, as quiet text — a 6px dot only while Open, in the alert hue for
 *  Tiers 1–2 alone (alert colour is never spent on Tier 3–4), neutral above. */
function StateText({ e }: { e: { state: MonitoringEvent["state"]; tier?: Tier } }) {
  return (
    <span data-event-chip className="inline-flex shrink-0 items-center gap-1.5 text-[13px] leading-[18px] text-[var(--text-tertiary)]">
      {e.state === "open" && <span aria-hidden data-open-dot className={cn("size-1.5 rounded-full", e.tier !== undefined && e.tier <= 2 ? "bg-[var(--t1)]" : "bg-[var(--text-secondary)]")} />}
      {STATE_LABEL[e.state]}
    </span>
  );
}

/** The expand control: present for the keyboard always, shown to the
 *  pointer on hover (and while open). */
function Chevron({ open, panel, label, onToggle }: { open: boolean; panel: string; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panel}
      aria-label={label}
      data-event-expand
      onClick={onToggle}
      className={cn("flex size-7 items-center justify-center rounded-full text-[var(--icon-secondary)] transition-opacity hover:bg-[var(--tint-hover)] focus-visible:opacity-100 group-hover:opacity-100", open ? "opacity-100" : "opacity-0", RING)}
    >
      <ChevronDown aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
    </button>
  );
}

const ROW_GRID = "grid min-h-14 grid-cols-[64px_28px_minmax(0,1fr)_auto_28px] items-center gap-x-3 px-3 py-2";

function Glyph({ e }: { e: { kind: MonitoringEvent["kind"]; tier?: Tier } }) {
  const G = GLYPH[e.kind];
  /* The Tier 1 escalation's glyph in the t1 ink; everything else secondary. */
  return (
    /* surface-sunken-strong: Bloom's surface-sunken IS the page's canvas, so
       a circle in it vanished on this surface (measured, Monitoring v3). */
    <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-[var(--surface-sunken-strong)]">
      <G className={cn("size-3.5", e.kind === "escalation" && e.tier === 1 ? "text-[var(--t1-ink)]" : "text-[var(--text-secondary)]")} strokeWidth={1.75} />
    </span>
  );
}

function TeenLine({ name, href, mentor, kind }: { name: string; href: string | null; mentor: string; kind: string }) {
  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span className="sr-only">{kind}: </span>
      {href ? (
        <Link href={href} data-event-teen className={cn("truncate rounded-sm font-display text-[15px] leading-[20px] font-bold text-[var(--text-primary)] underline-offset-2 hover:underline", RING)}>
          {name}
        </Link>
      ) : (
        <span data-event-teen className="truncate font-display text-[15px] leading-[20px] font-bold text-[var(--text-primary)]">
          {name}
        </span>
      )}
      <span className="truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">{mentor}</span>
    </p>
  );
}

function EventRow({ e, nested = false }: { e: MonitoringEvent; nested?: boolean }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const href = timelineHref(e);
  return (
    <li data-event={e.id} data-event-kind={e.kind} data-event-state={e.state} data-event-tier={e.tier} className={cn("group rounded-[12px] hover:bg-[var(--tint-hover)]", nested && "ml-[76px]")}>
      <div className={ROW_GRID}>
        <time dateTime={new Date(e.at).toISOString()} data-event-time className="text-[13px] leading-[18px] tabular-nums text-[var(--text-tertiary)]">
          {TIME.format(e.at)}
        </time>
        <Glyph e={e} />
        <div className="min-w-0">
          <TeenLine name={e.teenName} href={href} mentor={e.mentorName} kind={KIND_LABEL[e.kind]} />
          <p data-event-detail className="truncate text-[14px] leading-[20px] text-[var(--text-secondary)]">{e.detail}</p>
        </div>
        {e.immutable && e.auditLabel ? <AuditLozenge>{e.auditLabel}</AuditLozenge> : <StateText e={e} />}
        <Chevron open={open} panel={panel} label={`${open ? "Hide" : "Show"} the record for ${e.teenName}, ${KIND_LABEL[e.kind].toLowerCase()} at ${TIME.format(e.at)}`} onToggle={() => setOpen((o) => !o)} />
      </div>
      {open && <EventRecord e={e} panel={panel} href={href} />}
    </li>
  );
}

/** ═══ A RUN OF FLAGS, AS ONE ROW (§5) ═══ "Jordan T. · 3 flags today · not
 *  safe tonight", the count in the glyph's place of honour; expanding lists
 *  the individual flags, each its own row. */
function RunRow({ run, today }: { run: FlagRun; today: boolean }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const href = timelineHref(run.flags[0]);
  const n = run.flags.length;
  return (
    <li data-event={run.id} data-event-run={n} data-event-kind="flag" className="group rounded-[12px] hover:bg-[var(--tint-hover)]">
      <div className={ROW_GRID}>
        <time dateTime={new Date(run.at).toISOString()} data-event-time className="text-[13px] leading-[18px] tabular-nums text-[var(--text-tertiary)]">
          {TIME.format(run.at)}
        </time>
        <span aria-hidden className="relative flex size-7 items-center justify-center rounded-full bg-[var(--surface-sunken-strong)]">
          <Flag className="size-3.5 text-[var(--text-secondary)]" strokeWidth={1.75} />
          <span data-run-count className="absolute -right-1 -bottom-1 flex min-w-4 items-center justify-center rounded-full bg-[var(--text-primary)] px-1 text-[10px] leading-4 tabular-nums text-[var(--text-inverse)]">
            {n}
          </span>
        </span>
        <div className="min-w-0">
          <TeenLine name={run.teenName} href={href} mentor={run.mentorName} kind="Risk flags" />
          <p data-event-detail className="truncate text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {/* TODO-COPY */}
            <span className="tabular-nums">{n}</span> flags{today ? " today" : ""} · {run.detail}
          </p>
        </div>
        <StateText e={run.flags[0]} />
        <Chevron open={open} panel={panel} label={`${open ? "Hide" : "Show"} ${n} flags for ${run.teenName}`} onToggle={() => setOpen((o) => !o)} />
      </div>
      {open && (
        <ol id={panel} data-run-flags className="space-y-0.5 pb-1">
          {run.flags.map((f) => (
            <EventRow key={f.id} e={f} nested />
          ))}
        </ol>
      )}
    </li>
  );
}

/** ═══ A DAY, WINDOWED ═══ Rendered only near the viewport (an
 *  IntersectionObserver with a generous margin); otherwise a placeholder at
 *  its last measured height — estimated from its rows until first seen. */
function DaySection({ label, count, kinds, items, today, eager }: { label: string; count: number; kinds: string; items: EventItem[]; today: boolean; eager: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  /* `shown` is DERIVED: a section that was off-screen and becomes one of the
     first days (a filter moved it up) must render at once — measured, it
     stayed a placeholder when `eager` seeded the state only at mount. */
  const [near, setNear] = useState(false);
  const shown = eager || near;
  const [height, setHeight] = useState(48 + items.length * 58);
  useEffect(() => {
    const el = ref.current;
    if (!el || eager) return;
    /* ROOTED ON THE SCROLLER: the page scrolls inside the shell, and an
       observer on the viewport is clipped by it — measured, only the eager
       days ever rendered. The margin then reaches beyond the scroller. */
    let root: HTMLElement | null = el.parentElement;
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { root, rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !shown) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown]);
  return (
    <section ref={ref} data-event-day={label} data-day-kinds={kinds} data-day-rendered={shown || undefined} aria-label={`${label}, ${count} event${count === 1 ? "" : "s"}`} style={shown ? undefined : { height }}>
      {shown && (
        <>
          {/* 24 above, 8 below; the day's count after a middle dot. */}
          <h2 data-day-header className="sticky top-[var(--events-head,0px)] z-[1] bg-[var(--surface-canvas)] pt-6 pb-2 font-display text-[13px] leading-[18px] font-bold text-[var(--text-primary)]">
            {label}
            <span data-day-count className="font-sans font-normal text-[var(--text-tertiary)]">
              {" "}
              · <span className="tabular-nums">{count}</span>
            </span>
          </h2>
          <ol className="space-y-0.5">
            {items.map((x) => (isRun(x) ? <RunRow key={x.id} run={x} today={today} /> : <EventRow key={x.id} e={x} />))}
          </ol>
        </>
      )}
    </section>
  );
}

export function EventsTab({ events, filter, setFilter, now, mentors, supervisors }: { events: MonitoringEvent[]; filter: EventFilter; setFilter: (p: Partial<EventFilter>) => void; now: number; mentors: string[]; supervisors: string[] }) {
  /* ═══ STICKY, STACKED ═══ The filter row is sticky at the top; each day
     header sticks just under it. Its measured height is written to a CSS
     variable (a DOM write, not React state), so the two never overlap. */
  const head = useRef<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = head.current;
    const host = root.current;
    if (!el || !host) return;
    const ro = new ResizeObserver(() => host.style.setProperty("--events-head", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: MonitoringEvent[] }[] = [];
    for (const e of events) {
      const k = dayKey(e.at);
      const last = out.at(-1);
      if (last?.key === k) last.items.push(e);
      else out.push({ key: k, label: dayLabel(e.at, now), items: [e] });
    }
    /* Repeats collapse WITHIN a day (§5). */
    return out.map((g) => ({
      ...g,
      count: g.items.length,
      today: g.key === dayKey(now),
      rows: collapseRepeats(g.items),
      /* The day's events by kind, on the section whether or not it renders —
         so the whole range is countable through the windowing. */
      kinds: KINDS.map((k) => `${k}:${g.items.filter((e) => e.kind === k).length}`).join(","),
    }));
  }, [events, now]);

  const exportCsv = () => {
    const blob = new Blob([eventsCsv(events)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoring-events-${filter.range === "custom" ? `${filter.from ?? "start"}_${filter.to ?? "today"}` : filter.range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section data-events aria-label="Events" ref={root} className="space-y-3">
      <div ref={head} data-events-head className="sticky top-0 z-[2] -mx-2 space-y-2 bg-[var(--surface-canvas)] px-2 py-2">
        <Toolbar f={filter} set={setFilter} mentors={mentors} supervisors={supervisors} onExport={exportCsv} />
        <Summary events={events} range={filter.range} />
      </div>
      {events.length === 0 ? (
        <p data-events-empty className="py-10 text-center text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {/* TODO-COPY */}
          No events in {filter.range === "custom" ? "this range" : `the last ${RANGE_NAME[filter.range]}`}
        </p>
      ) : (
        <>
          {groups.map((g, i) => (
            /* The first few days render at once — the top of the log is what
               a reader sees first, and it must not wait for an observer. */
            <DaySection key={g.key} label={g.label} count={g.count} kinds={g.kinds} items={g.rows} today={g.today} eager={i < 3} />
          ))}
          <p data-events-end className="py-6 text-center text-[13px] leading-[18px] text-[var(--text-tertiary)]">
            {/* TODO-COPY */}
            End of {RANGE_NAME[filter.range]}
          </p>
        </>
      )}
    </section>
  );
}
