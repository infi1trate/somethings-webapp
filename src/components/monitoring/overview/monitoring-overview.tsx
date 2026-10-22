"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING (proto/monitoring-merge) — the supervisor's view over every teen
//
// The page at /app/monitoring, inside the console shell (its top bar, rail,
// fonts and tokens). Top to bottom: the Tier 1 alert strip (alert only), the
// title row with the list / cards toggle, the hero metrics, the Tier 1 lane
// (always, both views), then Tiers 2 → 4.
//
// THE ONE TIER STORE DRIVES IT (Tiering & Escalation pack). The roster is
// read through `useTierRoster`, and "alert" is a teen in the Tier 1 lane —
// an open Tier 1 escalation, from the dev bar's Alert scenario or from a
// mentor raising one in the chat. The page tells the alert clock, so the
// strip and the lane share one countdown.
//
// It folds the Escalations and Risk Flags dashboards (answered 2026-10-19):
// /app/escalations and /app/risk-flags redirect here. Escalations surface as
// the Tier 1 lane and the escalations column; flags roll up to the teen row.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { monitoringMetrics, SUPERVISORS_ON_SHIFT } from "@/lib/monitoring/tier-roster";
import { useTierRoster } from "@/lib/monitoring/use-tier-roster";
import { syncTierAlert } from "@/lib/monitoring/alert-clock";
import { setMonitoringLayout, useMonitoringLayout, type MonitoringLayout } from "@/lib/monitoring/layout-pref";
import { HeroMetrics } from "@/components/monitoring/overview/hero-metrics";
import { MonitoringList } from "@/components/monitoring/overview/tier-list";
import { MonitoringCards } from "@/components/monitoring/overview/tier-cards";
import { Tier1AlertStrip } from "@/components/monitoring/overview/tier1-alert-strip";
import { EventsTab } from "@/components/monitoring/events/events-tab";
import { DEFAULT_FILTER, filterEvents, rangeSummary, type EventFilter } from "@/lib/monitoring/events";
import { cn } from "@/lib/utils";

/** ═══ LIST / CARDS ═══ Two 36×32 icon buttons in a bordered 10px group;
 *  pressed is raised white with Elevation 1. `aria-pressed` on each, and the
 *  choice is kept in localStorage (`monitoring-view-pref.ts`). */
function LayoutToggle() {
  const layout = useMonitoringLayout();
  const btn = (value: MonitoringLayout, Icon: LucideIcon, label: string) => {
    const on = layout === value;
    return (
      <button
        type="button"
        data-layout-toggle={value}
        aria-pressed={on}
        aria-label={label}
        onClick={() => setMonitoringLayout(value)}
        className={cn(
          "flex h-8 w-9 items-center justify-center rounded-[8px] transition-colors",
          on ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--elevation-1)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
        )}
      >
        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
      </button>
    );
  };
  return (
    /* TODO-COPY */
    <div role="group" aria-label="Layout" data-layout-group className="flex shrink-0 gap-0.5 rounded-[10px] border border-[color:var(--border-default)] p-0.5">
      {btn("list", List, "List")}
      {btn("cards", LayoutGrid, "Cards")}
    </div>
  );
}

const DATE = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

export type MonitoringTab = "watch" | "events";
const TABS: { id: MonitoringTab; label: string }[] = [
  { id: "watch", label: "Watch" },
  { id: "events", label: "Events" },
];

/** ═══ WATCH · EVENTS (Monitoring v2) ═══ A segmented tablist in the title
 *  row, left of the view toggle. The tab is the URL (`?tab=events`), so it
 *  deep-links; arrows move between the two. */
function TabSwitch({ tab, onTab }: { tab: MonitoringTab; onTab: (t: MonitoringTab) => void }) {
  const refs = useRef<Partial<Record<MonitoringTab, HTMLButtonElement | null>>>({});
  return (
    <div role="tablist" aria-label="Monitoring views" data-monitoring-tabs className="flex shrink-0 gap-0.5 rounded-[10px] border border-[color:var(--border-default)] p-0.5">
      {TABS.map((t, i) => {
        const on = t.id === tab;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`monitoring-tab-${t.id}`}
            aria-selected={on}
            aria-controls="monitoring-tabpanel"
            tabIndex={on ? 0 : -1}
            data-monitoring-tab={t.id}
            onClick={() => onTab(t.id)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
              onTab(next);
              refs.current[next]?.focus();
            }}
            className={cn(
              "h-8 rounded-[8px] px-3 text-[13px] leading-[18px] font-medium transition-colors",
              on ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--elevation-1)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            )}
          >
            {/* TODO-COPY */}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function MonitoringOverview({ tab = "watch" }: { tab?: MonitoringTab }) {
  /* Fixed at mount, the house pattern: `Date.now()` in render is impure. */
  const [now] = useState(() => Date.now());
  const router = useRouter();
  const { teens, live, events } = useTierRoster(now);
  const m = useMemo(() => monitoringMetrics(teens), [teens]);
  /* ═══ THE EVENTS FILTER, PAGE-LOCAL ═══ One filter for the stream, the
     summary line, the export and the hero's range cells. */
  const [filter, setFilterState] = useState<EventFilter>(DEFAULT_FILTER);
  const setFilter = (p: Partial<EventFilter>) => setFilterState((f) => ({ ...f, ...p }));
  const filtered = useMemo(() => filterEvents(events, filter, now), [events, filter, now]);
  const sum = useMemo(() => rangeSummary(filtered), [filtered]);
  const mentors = useMemo(() => [...new Set(events.map((e) => e.mentorName))].sort(), [events]);
  const supervisors = useMemo(() => [...new Set(events.map((e) => e.supervisorName).filter((x): x is string => !!x))].sort(), [events]);
  const onTab = (t: MonitoringTab) => router.replace(t === "watch" ? "/app/monitoring" : "/app/monitoring?tab=events", { scroll: false });
  const layout = useMonitoringLayout();
  /* The alert clock is module state; telling it is an external write. */
  useEffect(() => {
    syncTierAlert(live);
  }, [live]);
  /* Mount-gated by the route, so a date in render cannot disagree with a
     server render. */
  const today = DATE.format(new Date());

  return (
    <div data-monitoring className="mx-auto max-w-[1400px] space-y-5 px-6 py-6 lg:px-8">
      {live && <Tier1AlertStrip teens={teens} />}

      {/* ── TITLE ROW ────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[24px] leading-[32px] font-bold text-[var(--text-primary)]">
            {/* TODO-COPY */}
            Monitoring
          </h1>
          <p data-monitoring-subline className="m-0 font-mono text-[12px] leading-[16px] text-[var(--text-tertiary)]">
            {today} · {m.onWatch} on watch · {SUPERVISORS_ON_SHIFT} supervisors on shift
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TabSwitch tab={tab} onTab={onTab} />
          {tab === "watch" && <LayoutToggle />}
        </div>
      </div>

      <HeroMetrics
        m={m}
        range={
          tab === "events"
            ? { label: filter.range === "custom" ? "custom" : filter.range, flags: sum.flags, surge: sum.surge, escalations: sum.escalations, open: sum.open, closed: sum.closed }
            : undefined
        }
      />

      <div id="monitoring-tabpanel" role="tabpanel" aria-labelledby={`monitoring-tab-${tab}`}>
        {tab === "events" ? (
          <EventsTab events={filtered} filter={filter} setFilter={setFilter} now={now} mentors={mentors} supervisors={supervisors} />
        ) : /* ── THE TIERS, from the same array either way ───────────── */
        layout === "cards" ? (
          <MonitoringCards teens={teens} />
        ) : (
          <MonitoringList teens={teens} />
        )}
      </div>
    </div>
  );
}
