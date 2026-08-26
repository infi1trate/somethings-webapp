"use client";

// THE ACTIVITY LEDGER — the supervisor's feed. Assembles the rail, the toolbar,
// the day-grouped feed and the prototype scenario simulator.
//
// SINGLE COLUMN, ~880px, NO RIGHT-HAND DETAIL PANE. The brief is explicit that a
// detail pane must not be added (spec §11, unavailable). The reasoning that IS
// available holds on its own: every row already links to the record where the work
// lives, so a pane would be a second, worse version of a surface that exists — and
// it would turn a ledger you scan into a thing you click through.
//
// STORE READS ARE GATED BEHIND useMounted (standing rule 3). These failures
// produce ZERO console errors, so the gate is not defensive — it is the only thing
// standing between a persisted overlay and a hydration mismatch that shows up as
// silently wrong read state.

import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Search } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { queryFeed, visibleEventIds, type FeedRow } from "@/lib/activity/query";
import { seedOverlay, unreadCount } from "@/lib/activity/read-state";
import {
  ACTIVITY_SCENARIOS,
  DEFAULT_SCENARIO_ID,
  SIM_NOW,
  scenarioById,
} from "@/lib/activity/seed";
import { DEFAULT_VIEW_ID, viewById } from "@/lib/activity/views";
import type { ActivityViewer } from "@/lib/activity/resolve-alert-type";
import { ActivityRow } from "@/components/activity/activity-row";
import { FilterDialog } from "@/components/activity/filter-dialog";
import { ViewRail } from "@/components/activity/view-rail";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  hasActiveFilters,
  type ActivityFilters,
} from "@/lib/activity/filters";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ UNREAD BADGE: BUILT, SHIPPED OFF ═══
 *
 *  Flip to true in one line when real notification events exist.
 *
 *  WHY OFF (spec §3.3, unavailable; the reasoning from A3 step 9 is recorded
 *  here instead): inside scope `mine` the supervisor column resolves to activity
 *  and action only, never notification — see the reconciliation note at the top of
 *  resolve-alert-type.ts. So today the badge would count nothing but the
 *  supervisor's OWN actions, i.e. it would tell them how much of their own work
 *  they had not yet scrolled past. That is noise dressed as signal.
 *
 *  The component is built rather than deferred so that flipping this flag is the
 *  entire change. */
const SHOW_UNREAD_BADGE = false;

// ── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({
  unreadOnly,
  onUnreadOnly,
  filters,
  onOpenFilters,
  onResetFilters,
  filterTriggerRef,
}: {
  unreadOnly: boolean;
  onUnreadOnly: (v: boolean) => void;
  filters: ActivityFilters;
  onOpenFilters: () => void;
  onResetFilters: () => void;
  filterTriggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const count = activeFilterCount(filters);
  return (
    // NOTHING ON THE RIGHT. No density toggle, no bulk select — both were
    // explicitly excluded, and an empty right side is what keeps the toolbar from
    // reading as a table header.
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onUnreadOnly(!unreadOnly)}
        aria-pressed={unreadOnly}
        className={cn(
          "inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors",
          unreadOnly
            ? "border-[color:var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverse)]"
            : "border-[color:var(--border-contour)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {/* TODO-COPY */}
        Unread
      </button>

      {/* THE FILTER TRIGGER. The COUNT IS IN THE ACCESSIBLE NAME, not only in the
          badge — a reader who cannot see the number still needs to know the list
          in front of them is narrowed. */}
      <button
        ref={filterTriggerRef}
        type="button"
        onClick={onOpenFilters}
        /* TODO-COPY */
        aria-label={
          count === 0
            ? "Filter activity"
            : `Filter activity, ${count} ${count === 1 ? "filter" : "filters"} active`
        }
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors",
          count > 0
            ? "border-[color:var(--text-primary)] bg-[var(--surface-card)] text-[var(--text-primary)]"
            : "border-[color:var(--border-contour)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        <Filter className="size-3.5" aria-hidden />
        Filter
        {count > 0 && (
          <span
            aria-hidden
            className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--text-primary)] px-1.5 text-[11.5px] font-semibold leading-[16px] tabular-nums text-[var(--text-inverse)]"
          >
            {count}
          </span>
        )}
      </button>

      {/* RESET APPEARS ONLY WHEN THERE IS SOMETHING TO RESET. A permanently
          visible Reset on an unfiltered list is a control that does nothing. */}
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={onResetFilters}
          className={cn(
            "inline-flex min-h-9 items-center rounded-full px-2 text-[13px] font-semibold",
            "text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          {/* TODO-COPY */}
          Reset
        </button>
      )}
      <button
        type="button"
        disabled
        aria-disabled
        /* TODO-COPY */
        title="Search is not built yet"
        className="inline-flex min-h-9 cursor-not-allowed items-center gap-1.5 rounded-full border border-[color:var(--border-subtle)] px-3 text-[13px] font-semibold text-[var(--text-muted)]"
      >
        <Search className="size-3.5" aria-hidden />
        Search
      </button>
    </div>
  );
}

// ── Scenario simulator ──────────────────────────────────────────────────────

/** PROTOTYPE CHROME, and dressed as it. Dashed border and an explicit label, so
 *  nobody reviewing a screenshot mistakes it for product. Collapsible because it
 *  sits over the feed's bottom-right corner. */
function ScenarioSimulator({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    // bottom-20, NOT bottom-4: the dev persona toggle is also fixed bottom
    // chrome and the two overlapped at narrow widths (measured — the simulator's
    // lower edge sat inside the toggle's box). Raised to clear it rather than
    // moving the toggle, which is shared chrome on every screen.
    <div className="fixed bottom-20 right-4 z-40 max-w-[260px]">
      <div // --radius-surface, NOT --radius-inset: the 12px inset token is added in an
        // as-yet-uncommitted pass, and this phase must not depend on work outside
        // it or reverting A3 alone would leave a dangling var(). 16px is right for
        // a panel anyway.
        className="rounded-[var(--radius-surface)] border border-dashed border-[color:var(--border-contour)] bg-[var(--surface-card)] p-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-sm px-1 py-0.5 text-left",
            "text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]",
            RING
          )}
        >
          {/* TODO-COPY */}
          Prototype scenarios
          <span aria-hidden>{open ? "–" : "+"}</span>
        </button>
        {open && (
          <ul className="mt-1.5 space-y-0.5">
            {ACTIVITY_SCENARIOS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={s.id === activeId ? "true" : undefined}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-[12.5px] leading-[16px] transition-colors",
                    s.id === activeId
                      ? "bg-[var(--surface-s2)] font-semibold text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  {s.label}
                  <span className="block text-[11px] leading-[14px] text-[var(--text-muted)]">
                    {s.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── The ledger ──────────────────────────────────────────────────────────────

export function ActivityLedger() {
  const mounted = useMounted();
  const overlay = useOnboardingStore((s) => s.activityRead);
  const seedActivityRead = useOnboardingStore((s) => s.seedActivityRead);
  const markRows = useOnboardingStore((s) => s.markActivityRowsRead);
  const clearRowAction = useOnboardingStore((s) => s.clearActivityRow);
  const restoreRowAction = useOnboardingStore((s) => s.restoreActivityRow);
  const scenarioId = useOnboardingStore((s) => s.activityScenarioId);
  const setScenarioId = useOnboardingStore((s) => s.setActivityScenarioId);

  const [viewId, setViewId] = useState(DEFAULT_VIEW_ID);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterTrigger = useRef<HTMLButtonElement | null>(null);

  const scenario = scenarioById(mounted ? scenarioId : DEFAULT_SCENARIO_ID);
  const view = viewById(viewId);

  const viewer: ActivityViewer = useMemo(
    () => ({
      id: scenario.viewerId,
      role: "supervisor",
      caseloadTeenIds: scenario.caseloadTeenIds,
    }),
    [scenario]
  );

  /** SEED ON SCENARIO CHANGE ONLY. Re-seeding on every mount would wipe the read
   *  state the viewer set, which would also mean the persistence added in A2 was
   *  never actually exercised. The scenario id is persisted alongside the overlay,
   *  so a reload restores both and this effect does nothing. */
  useEffect(() => {
    if (!mounted) return;
    const first = scenario.events[0]?.id;
    // Already seeded for this scenario if any of its events has an entry.
    const seeded =
      first !== undefined &&
      Object.keys(overlay).some((k) => k.endsWith(`::${first}`));
    if (seeded || scenario.events.length === 0) return;
    seedActivityRead(
      seedOverlay(
        scenario.events.map((e) => e.id),
        scenario.unreadEventIds,
        scenario.viewerId
      )
    );
    // `overlay` is deliberately not a dependency: this must run when the SCENARIO
    // changes, not every time the overlay does — which is on every row read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, scenario, seedActivityRead]);

  const days = useMemo(
    () =>
      mounted
        ? queryFeed({
            events: scenario.events,
            viewer,
            view,
            overlay,
            unreadOnly,
            filters,
            now: SIM_NOW,
          })
        : [],
    [mounted, scenario, viewer, view, overlay, unreadOnly, filters]
  );

  /** Unread per view. Returns null when the badge is flagged off, so the rail
   *  renders nothing rather than a zero. */
  const unreadFor = useMemo(() => {
    if (!SHOW_UNREAD_BADGE || !mounted) return undefined;
    return (id: string) => {
      const v = viewById(id);
      const ids = visibleEventIds({
        events: scenario.events,
        viewer,
        view: v,
        overlay,
        now: SIM_NOW,
      });
      return unreadCount(overlay, viewer.id, v.scope, ids);
    };
  }, [mounted, scenario, viewer, overlay]);

  const total = days.reduce((n, d) => n + d.rows.length, 0);

  const onSeen = (row: FeedRow) =>
    markRows(viewer.id, view.scope, row.eventIds);
  const onClear = (row: FeedRow) => {
    // A6 will clear every constituent of a group; the loop is already correct for
    // that because `eventIds` is the group's membership.
    for (const id of row.eventIds) clearRowAction(viewer.id, view.scope, id);
  };
  /** RESTORE THE WHOLE GROUP, not a member — same `eventIds` membership, so A6's
   *  rule ("restoring restores the whole group") is already satisfied. */
  const onRestore = (row: FeedRow) => {
    for (const id of row.eventIds) restoreRowAction(viewer.id, view.scope, id);
  };

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-8 lg:px-8">
      <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
        {/* TODO-COPY */}
        Activity
      </h1>

      <div className="mt-5">
        <ViewRail
          activeId={viewId}
          onSelect={(id) => {
            setViewId(id);
            // SWITCHING VIEWS RESETS FILTERS. A view is a different question, and
            // the filters were answers to the previous one — carrying "only
            // escalations" from My caseload into Network silently answers a
            // question nobody asked.
            setUnreadOnly(false);
            setFilters(EMPTY_FILTERS);
          }}
          unreadFor={unreadFor}
        />
      </div>

      <Toolbar
        unreadOnly={unreadOnly}
        onUnreadOnly={setUnreadOnly}
        filters={filters}
        onOpenFilters={() => setFiltersOpen(true)}
        onResetFilters={() => setFilters(EMPTY_FILTERS)}
        filterTriggerRef={filterTrigger}
      />

      <div
        id="activity-panel"
        role="tabpanel"
        aria-labelledby={`activity-tab-${viewId}`}
        tabIndex={-1}
        className="mt-4"
      >
        {total === 0 ? (
          <EmptyState
            viewId={viewId}
            unreadOnly={unreadOnly}
            filtered={hasActiveFilters(filters)}
          />
        ) : (
          days.map((day) => (
            <section key={day.dayKey} className="mb-1">
              {/* TODAY HAS NO DIVIDER — the feed opens straight into it. */}
              {day.label && (
                <div className="my-3 flex items-center justify-center">
                  <span
                    id={`activity-day-${day.dayKey}`}
                    className="rounded-full bg-[var(--surface-s2)] px-3 py-1 text-[11.5px] font-semibold leading-[16px] text-[var(--text-secondary)]"
                  >
                    {day.label}
                  </span>
                </div>
              )}
              {/* An <ol>, one <li> per row, each labelled off its day divider —
                  the accessibility shape A7 formalises, built right the first
                  time because retrofitting list semantics means rewriting the
                  row. */}
              <ol
                aria-labelledby={
                  day.label ? `activity-day-${day.dayKey}` : undefined
                }
                /* TODO-COPY */
                aria-label={day.label ? undefined : "Today"}
                className="divide-y divide-[color:var(--border-subtle)]"
              >
                {day.rows.map((row) => (
                  <ActivityRow
                    key={row.id}
                    row={row}
                    href={hrefFor(row)}
                    onClear={onClear}
                    // ITS PRESENCE is what swaps Clear for Restore.
                    onRestore={filters.showCleared ? onRestore : undefined}
                    onSeen={onSeen}
                  />
                ))}
              </ol>
            </section>
          ))
        )}
      </div>

      <FilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        applied={filters}
        onApply={setFilters}
        caseloadTeenIds={viewer.caseloadTeenIds}
        // A5 adds network-scope staff here. Absent in caseload scope, so the
        // group is HIDDEN rather than disabled.
        networkStaffIds={undefined}
        returnFocusTo={filterTrigger}
      />

      <ScenarioSimulator activeId={scenario.id} onSelect={setScenarioId} />
    </div>
  );
}

/** Where a row opens. The teen's record, on the tab that owns the domain — the
 *  ledger records, the record works. */
function hrefFor(row: FeedRow): string {
  const tab = row.domain === "billing" || row.domain === "review" ? "care" : "overview";
  // TODO-DATA: the seed's teen ids (`teen-maya`) are the ledger's own fixtures and
  // do not resolve against the app's people fixtures (`t17`). The link shape is
  // correct and will resolve when the ledger reads real events; today it lands on
  // the record's not-found copy rather than pretending to work.
  return `/admin/person/${row.teenName.toLowerCase()}?tab=${tab}`;
}

/** THE EMPTY STATES. Deliberately asymmetric, and A7 formalises the rest.
 *
 *  An empty "My caseload" is a SUCCESS state and reads calm. An empty "Network" is
 *  closer to a failure and reads as a range problem, not reassurance. They are not
 *  homogenised, and neither says "You have no activity" (standing rule 5). */
function EmptyState({
  viewId,
  unreadOnly,
  filtered,
}: {
  viewId: string;
  unreadOnly: boolean;
  filtered: boolean;
}) {
  let copy: string;
  if (filtered) {
    /* TODO-COPY. Names the cause and the way out — a filtered-empty list is a
       filter problem, not an absence of work, and saying "nothing here" would
       send a reader looking for a bug. */
    copy = "No activity matches these filters. Try clearing one.";
  } else if (unreadOnly) {
    /* TODO-COPY */
    copy = "Everything here has been read.";
  } else if (viewId === "network") {
    /* TODO-COPY. A range problem, not reassurance. */
    copy = "No network activity in this range. Try a wider date range.";
  } else if (viewId === "billing") {
    /* TODO-COPY */
    copy = "No billing activity in this range.";
  } else {
    /* TODO-COPY. Calm: a quiet caseload is the good outcome. */
    copy = "Nothing has happened on your caseload today.";
  }
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="max-w-sm text-center text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {copy}
      </p>
    </div>
  );
}
