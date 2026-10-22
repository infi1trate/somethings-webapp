"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING · EVENTS (Monitoring v2, Part A) — the platform-wide audit view
//
// Escalations, risk flags, tier changes and reviews as EVENTS, newest first —
// a log, unlike the per-teen timeline, which reads oldest-first. Top to
// bottom: a sticky filter row, one quiet summary line, then the stream,
// grouped by day under sticky day headers. A row expands inline to its record
// and links to the teen's timeline.
//
// ONE SOURCE: `monitoringEvents` (lib/monitoring/events.ts), derived from the
// store the Watch tab reads. The filter is the page's; the hero bar above
// reads the same filtered range.
//
// ═══ VIRTUALISED PAST 200 ═══ by `content-visibility: auto` on each day
// group, so the browser skips laying out what is off screen without a
// fixed-height windowing scheme — rows here are variable (they expand).

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Check, ChevronDown, FileText, Flag, Triangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AuditLozenge } from "@/components/tiering/tier-history";
import {
  KIND_LABEL,
  duration,
  rangeSummary,
  timelineHref,
  type EventFilter,
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

// ── FILTER ROW ──────────────────────────────────────────────────────────────

function FilterRow({ f, set, mentors, supervisors }: { f: EventFilter; set: (p: Partial<EventFilter>) => void; mentors: string[]; supervisors: string[] }) {
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div data-events-filter className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div role="radiogroup" aria-label="Time range" onKeyDown={onRadioKeys} data-range-group className="flex shrink-0 gap-0.5 rounded-[10px] border border-[color:var(--border-default)] p-0.5">
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
                "h-7 rounded-[8px] px-2.5 text-[13px] leading-[18px] transition-colors",
                on ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--elevation-1)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
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
          <input type="date" aria-label="From" data-range-from value={f.from ?? ""} onChange={(e) => set({ from: e.target.value })} className={cn("h-8 rounded-[8px] border border-[color:var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-[13px] text-[var(--text-primary)]", RING)} />
          <span aria-hidden>–</span>
          <input type="date" aria-label="To" data-range-to value={f.to ?? ""} onChange={(e) => set({ to: e.target.value })} className={cn("h-8 rounded-[8px] border border-[color:var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-[13px] text-[var(--text-primary)]", RING)} />
        </span>
      )}
      <div role="group" aria-label="Event types" className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <Toggle key={k} slot={k} on={f.kinds.includes(k)} onClick={() => set({ kinds: toggle(f.kinds, k) })}>
            {KIND_LABEL[k]}
          </Toggle>
        ))}
      </div>
      <div role="group" aria-label="Tiers" className="flex gap-1.5">
        {([1, 2, 3, 4] as Tier[]).map((t) => (
          <Toggle key={t} slot={`t${t}`} on={f.tiers.includes(t)} onClick={() => set({ tiers: toggle(f.tiers, t) })}>
            T{t}
          </Toggle>
        ))}
      </div>
      <Picker slot="mentor" label="Mentor" value={f.mentor} onChange={(v) => set({ mentor: v })} options={mentors} />
      <Picker slot="supervisor" label="Supervisor" value={f.supervisor} onChange={(v) => set({ supervisor: v })} options={supervisors} />
    </div>
  );
}

// ── SUMMARY LINE ────────────────────────────────────────────────────────────

/** A numeral in the summary: mono, tabular; the labels stay sans. */
function N({ v }: { v: string | number }) {
  return <span className="font-mono tabular-nums text-[var(--text-primary)]">{v}</span>;
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

function EventRow({ e }: { e: MonitoringEvent }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const Glyph = GLYPH[e.kind];
  const href = timelineHref(e);
  return (
    <li data-event={e.id} data-event-kind={e.kind} data-event-state={e.state} data-event-tier={e.tier} className="rounded-[12px] px-3 py-2.5 hover:bg-[var(--tint-hover)]">
      <div className="grid grid-cols-[64px_28px_minmax(0,1fr)_auto_28px] items-center gap-x-3">
        <time dateTime={new Date(e.at).toISOString()} className="font-mono text-[12px] leading-[16px] tabular-nums text-[var(--text-tertiary)]">
          {TIME.format(e.at)}
        </time>
        <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
          <Glyph className="size-3.5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="sr-only">{KIND_LABEL[e.kind]}: </span>
            {href ? (
              <Link href={href} data-event-teen className={cn("truncate rounded-sm text-[14px] leading-[20px] font-semibold text-[var(--text-primary)] underline-offset-2 hover:underline", RING)}>
                {e.teenName}
              </Link>
            ) : (
              <span data-event-teen className="truncate text-[14px] leading-[20px] font-semibold text-[var(--text-primary)]">{e.teenName}</span>
            )}
            <span className="truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">{e.mentorName}</span>
          </p>
          <p data-event-detail className="truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">{e.detail}</p>
        </div>
        {e.immutable && e.auditLabel ? (
          <AuditLozenge>{e.auditLabel}</AuditLozenge>
        ) : (
          <span data-event-chip className="inline-flex h-6 items-center rounded-full border border-[color:var(--border-default)] px-2.5 text-[12px] leading-[16px] text-[var(--text-secondary)]">
            {STATE_LABEL[e.state]}
          </span>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          aria-label={`${open ? "Hide" : "Show"} the record for ${e.teenName}, ${KIND_LABEL[e.kind].toLowerCase()} at ${TIME.format(e.at)}`}
          data-event-expand
          onClick={() => setOpen((o) => !o)}
          className={cn("flex size-7 items-center justify-center rounded-full text-[var(--icon-secondary)] hover:bg-[var(--tint-hover)]", RING)}
        >
          <ChevronDown aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div id={panel} data-event-record className="mt-2 ml-[104px] space-y-2 rounded-[10px] bg-[var(--surface-sunken)] px-3 py-2.5">
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
      )}
    </li>
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
    return out;
  }, [events, now]);
  const big = events.length > 200;

  return (
    <section data-events aria-label="Events" ref={root} className="space-y-3">
      <div ref={head} data-events-head className="sticky top-0 z-[2] -mx-2 space-y-2 bg-[var(--surface-canvas)] px-2 py-2">
        <FilterRow f={filter} set={setFilter} mentors={mentors} supervisors={supervisors} />
        <Summary events={events} range={filter.range} />
      </div>
      {events.length === 0 ? (
        <p data-events-empty className="py-10 text-center text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {/* TODO-COPY */}
          No events in {filter.range === "custom" ? "this range" : `the last ${RANGE_NAME[filter.range]}`}
        </p>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.key} data-event-day={g.label} aria-label={g.label} style={big ? { contentVisibility: "auto", containIntrinsicSize: `auto ${g.items.length * 64 + 40}px` } : undefined}>
              <h2 data-day-header className="sticky top-[var(--events-head,0px)] z-[1] bg-[var(--surface-canvas)] py-1.5 text-[13px] leading-[18px] font-semibold text-[var(--text-primary)]">
                {g.label}
              </h2>
              <ol className="space-y-0.5">
                {g.items.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </ol>
            </section>
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
