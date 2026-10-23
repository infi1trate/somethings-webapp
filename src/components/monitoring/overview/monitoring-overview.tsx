"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING (proto/monitoring-merge) — the supervisor's view over every teen
//
// The page at /app/monitoring, inside the console shell (its top bar, rail,
// fonts and tokens). Top to bottom: the Tier 1 alert strip (alert only), the
// title, the toolbar, the hero metrics, then the tab's content.
//
// ═══ HEADER PARITY WITH CARE REVIEWS (Monitoring v3, §1) ═══ The title and
// its date line are the shared `PageHeader` (32/40 Avantt; 16/24 sans in
// text-secondary), its toolbar slot holds Watch · Events (the SAME pill
// control as Care Reviews' Open/Closed, `ui/pill-segments.tsx`) and the view
// toggle, and the container is Care Reviews' — so the title + toolbar block is
// identical across the two pages and across both tabs, structurally.
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

import { useEffect, useMemo, useState } from "react";
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
import { PageHeader } from "@/components/ia/page-header";
import { PillSegments } from "@/components/ui/pill-segments";
import { shiftDateLabel } from "@/lib/home/shift-date";
import { cn } from "@/lib/utils";

/** ═══ LIST / CARDS ═══ The toolbar's right end, in the pill control's own
 *  language (Monitoring v3, §1): a recessed track, the pressed view raised
 *  on card white with the tile shadow — 44 tall, matching the row. Two icon
 *  buttons with `aria-pressed`; the choice is kept in localStorage
 *  (`lib/monitoring/layout-pref.ts`). */
function LayoutToggle({ hidden = false }: { hidden?: boolean }) {
  const layout = useMonitoringLayout();
  const btn = (value: MonitoringLayout, Icon: LucideIcon, label: string) => {
    const on = layout === value;
    return (
      <button
        type="button"
        data-layout-toggle={value}
        aria-pressed={on}
        aria-label={label}
        tabIndex={hidden ? -1 : undefined}
        onClick={() => setMonitoringLayout(value)}
        className={cn(
          "relative flex h-9 w-11 items-center justify-center rounded-full transition-[color,background-color,box-shadow] after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
          on ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-tile)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
        )}
      >
        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
      </button>
    );
  };
  return (
    /* TODO-COPY */
    <div role="group" aria-label="Layout" aria-hidden={hidden || undefined} data-layout-group data-layout-hidden={hidden || undefined} className={cn("ml-auto flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-[var(--surface-s2)] p-1", hidden && "invisible")}>
      {btn("list", List, "List")}
      {btn("cards", LayoutGrid, "Cards")}
    </div>
  );
}

export type MonitoringTab = "watch" | "events";
const TABS: { id: MonitoringTab; label: string }[] = [
  { id: "watch", label: "Watch" },
  { id: "events", label: "Events" },
];

/** ═══ WATCH · EVENTS ═══ Care Reviews' pill control, as a tablist (Monitoring
 *  v3, §1). The tab is the URL (`?tab=events`), so it deep-links; the arrows
 *  move between the two. */
function TabSwitch({ tab, onTab }: { tab: MonitoringTab; onTab: (t: MonitoringTab) => void }) {
  return (
    <PillSegments
      role="tablist"
      /* TODO-COPY */
      ariaLabel="Monitoring views"
      trackAttrs={{ "data-monitoring-tabs": "" }}
      panelId="monitoring-tabpanel"
      idPrefix="monitoring-tab"
      value={tab}
      onChange={onTab}
      segments={TABS.map((t) => ({ id: t.id, label: t.label, attrs: { "data-monitoring-tab": t.id } }))}
    />
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
  return (
    /* Care Reviews' container, to the class (`tasks-page.tsx`). */
    <div data-monitoring className="mx-auto flex w-full max-w-[1800px] flex-col px-6 py-6 lg:px-8">
      {live && (
        <div className="mb-5">
          <Tier1AlertStrip teens={teens} />
        </div>
      )}

      {/* ── THE HEADER AND ITS TOOLBAR — never change between tabs ─────── */}
      <PageHeader
        /* TODO-COPY */
        title="Monitoring"
        /* The date in the schedule's zone, Care Reviews' own line, then the
           watch's facts. Mount-gated by the route. */
        purpose={`${shiftDateLabel(now)} · ${m.onWatch} on watch · ${SUPERVISORS_ON_SHIFT} supervisors on shift`}
        toolbar={
          <>
            <TabSwitch tab={tab} onTab={onTab} />
            {/* ═══ NOTHING MOVES ON A TAB SWITCH (Monitoring v3, §2) ═══ The
                toggle unmounting on Events was the jolt: it shifted the
                toolbar. It stays in place, `visibility: hidden` and out of
                the tab order and the accessibility tree. */}
            <LayoutToggle hidden={tab === "events"} />
          </>
        }
      />

      <HeroMetrics
        className="mt-6"
        m={m}
        range={
          tab === "events"
            ? { label: filter.range === "custom" ? "custom" : filter.range, flags: sum.flags, surge: sum.surge, escalations: sum.escalations, open: sum.open, closed: sum.closed }
            : undefined
        }
      />

      {/* ═══ THE CONTENT CROSS-FADES (§2) ═══ 120ms of opacity, keyed on the
          tab; the header, toolbar and hero do not animate. Off under reduced
          motion. */}
      <div key={tab} id="monitoring-tabpanel" role="tabpanel" aria-labelledby={`monitoring-tab-${tab}`} className="tab-fade mt-5">
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
