"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING (proto/monitoring-merge) — the supervisor's view over every teen
//
// The page at /app/monitoring, inside the console shell (its top bar, rail,
// fonts and tokens). Top to bottom: the Tier 1 alert strip (alert only), the
// title row with the list / cards toggle, the hero metrics, the Tier 1 lane
// (always, both views), then Tiers 2 → 4.
//
// THE SCENARIO DRIVES IT. The dev bar's Scenario, on the Monitoring axis
// (`monitoringScenarioId`), decides calm or alert (`tierAlertLive`); the page
// tells the alert clock, so the strip and the lane share one countdown.
//
// It folds the Escalations and Risk Flags dashboards (answered 2026-10-19):
// /app/escalations and /app/risk-flags redirect here. Escalations surface as
// the Tier 1 lane and the escalations column; flags roll up to the teen row.

import { useEffect, useMemo } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { monitoringMetrics, SUPERVISORS_ON_SHIFT, tierAlertLive, tierRoster } from "@/lib/monitoring/tier-roster";
import { syncTierAlert } from "@/lib/monitoring/alert-clock";
import { setMonitoringLayout, useMonitoringLayout, type MonitoringLayout } from "@/lib/monitoring/layout-pref";
import { HeroMetrics } from "@/components/monitoring/overview/hero-metrics";
import { MonitoringList } from "@/components/monitoring/overview/tier-list";
import { MonitoringCards } from "@/components/monitoring/overview/tier-cards";
import { Tier1AlertStrip } from "@/components/monitoring/overview/tier1-alert-strip";
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

export function MonitoringOverview() {
  const scenarioId = useOnboardingStore((s) => s.monitoringScenarioId);
  const live = tierAlertLive(scenarioId);
  const teens = useMemo(() => tierRoster(live), [live]);
  const m = useMemo(() => monitoringMetrics(teens), [teens]);
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
        <LayoutToggle />
      </div>

      <HeroMetrics m={m} />

      {/* ── THE TIERS, from the same array either way ───────────────── */}
      {layout === "cards" ? <MonitoringCards teens={teens} /> : <MonitoringList teens={teens} />}
    </div>
  );
}
