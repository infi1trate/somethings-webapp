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
import { queryFeed, unreadRowCount, type FeedRow } from "@/lib/activity/query";
import { seedOverlay } from "@/lib/activity/read-state";
import {
  ACTIVITY_SCENARIOS,
  DEFAULT_SCENARIO_ID,
  SIM_NOW,
  scenarioById,
} from "@/lib/activity/seed";
import { DEFAULT_VIEW_ID, viewById } from "@/lib/activity/views";
import type { ActivityViewer } from "@/lib/activity/resolve-alert-type";
import { RecordButton } from "@/components/record/record-button";
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

/** ═══ LOAD STATES ═══
 *
 *  Simulated, because there is no fetch to fail — the ledger reads fixtures. They
 *  exist so the states are DESIGNED rather than discovered in production, and the
 *  simulator can reach every one of them.
 *
 *  "partial" is the interesting one: some day-groups loaded and one range did not.
 *  The rows that arrived render; the range that failed shows an inline strip IN
 *  PLACE rather than replacing the whole feed with an error. A reader who can see
 *  three days of history should not lose it because the fourth timed out. */
type LoadState = "ready" | "loading" | "error" | "partial";

/** THE PAGINATION WINDOW, in days. 30 per the brief.
 *
 *  Infinite scroll AND a real button, and the button is not a fallback — it is the
 *  keyboard and screen-reader path. An intersection-observer-only feed is
 *  unreachable for anyone who does not scroll with a pointer, and "scroll more" is
 *  not an instruction a screen reader can act on. */
const PAGE_DAYS = 30;

/** TODO-COPY throughout. §9 IS UNAVAILABLE — activity-page-spec.md is not in this
 *  repository, so this copy is written to the brief's stated CONSTRAINTS rather
 *  than transcribed:
 *    · no empty state says "You have no activity"
 *    · an empty My caseload is a SUCCESS state and reads calm
 *    · an empty Network is closer to a failure and reads as a RANGE problem, not
 *      reassurance — deliberately NOT homogenised with the caseload copy
 *    · errors are non-blaming and carry a next step
 *    · no exclamation points, no celebration on completion rows */
const COPY = {
  emptyMine: "Nothing has happened on your caseload today.",
  emptyNetwork: "No network activity in this range. Try a wider date range.",
  emptyBilling: "No billing activity in this range.",
  emptyUnread: "Everything here has been read.",
  emptyFiltered: "No activity matches these filters. Try clearing one.",
  emptyCleared: "You have not cleared anything in this view.",
  firstRun:
    "Activity will appear here as work happens on your caseload — reviews, escalations, and survey results.",
  error:
    "This feed did not load. Nothing is lost — try again, and the ledger will catch up.",
  errorRetry: "Try again",
  partial: "One range of history did not load. The rest is below.",
  endOfFeed: "That is the end of the record.",
  loadOlder: "Load older",
} as const;

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
  loadState,
  onLoadState,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  loadState: LoadState;
  onLoadState: (s: LoadState) => void;
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
            {/* LOAD STATES, in the same panel. Every state in the brief has to be
                reachable from the simulator, and three of them are not properties
                of the data — they are properties of a fetch that does not exist
                here. */}
            <li className="mt-2 border-t border-dashed border-[color:var(--border-contour)] pt-2">
              <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {/* TODO-COPY */}
                Load state
              </p>
              <div className="flex flex-wrap gap-1 px-1">
                {(["ready", "loading", "error", "partial"] as LoadState[]).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => onLoadState(st)}
                      aria-current={st === loadState ? "true" : undefined}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11.5px] transition-colors",
                        st === loadState
                          ? "bg-[var(--surface-s2)] font-semibold text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                        RING
                      )}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Load states ─────────────────────────────────────────────────────────────

/** EIGHT SKELETON ROWS, WITH DAY DIVIDERS. The dividers matter: a skeleton that
 *  omits them re-flows the whole feed the moment real rows arrive, which reads as
 *  a second load. Shaped like the thing it is standing in for.
 *
 *  `motion-safe:animate-pulse` — reduced motion gets a static block. */
function FeedSkeleton() {
  return (
    <div aria-hidden className="mt-1">
      {[0, 1].map((group) => (
        <div key={group}>
          {group > 0 && (
            <div className="my-3 flex items-center justify-center">
              <span className="h-[22px] w-[104px] rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
            </div>
          )}
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex min-h-11 items-center gap-3 border-t border-[color:var(--border-subtle)] px-3 py-2 first:border-t-0"
            >
              <span className="size-6 shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
              <span className="size-4 shrink-0 rounded-[4px] bg-[var(--surface-s2)] motion-safe:animate-pulse" />
              <span
                className="h-3 flex-1 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse"
                style={{ maxWidth: `${58 + ((row * 11) % 30)}%` }}
              />
              <span className="h-3 w-12 shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      ))}
      {/* The visual skeleton is aria-hidden; this is what a screen reader gets. */}
      <p className="sr-only" role="status">
        Loading activity.
      </p>
    </div>
  );
}

/** NON-BLAMING, WITH A NEXT STEP (standing rule 5). It does not say the reader did
 *  anything, and it says what is safe: nothing was lost. */
function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center"
    >
      <p className="max-w-sm text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {COPY.error}
      </p>
      <RecordButton onClick={onRetry}>{COPY.errorRetry}</RecordButton>
    </div>
  );
}

/** THE PARTIAL-FAILURE STRIP. Sits IN PLACE of the range that failed, between the
 *  day groups that loaded — not at the top, and not instead of them. */
function PartialFailureStrip({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-surface)] border border-dashed border-[color:var(--border-contour)] px-3.5 py-2.5"
    >
      <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
        {COPY.partial}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "shrink-0 rounded-full px-2 py-1 text-[12.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {COPY.errorRetry}
      </button>
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
  const [loadState, setLoadState] = useState<LoadState>("ready");
  /** Days of history loaded. Grows by PAGE_DAYS on "Load older" and on the
   *  infinite-scroll sentinel — both paths call the same function, so they cannot
   *  drift. */
  const [daysLoaded, setDaysLoaded] = useState(PAGE_DAYS);
  /** POLITE ANNOUNCEMENT after a clear. A live region rather than an alert: a
   *  clear is a thing the reader just did, so it should not interrupt. */
  const [announcement, setAnnouncement] = useState("");
  const feedRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinel = useRef<HTMLDivElement | null>(null);

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
    return (id: string) =>
      // ROWS, not events — a coalesced group counts as one (A6).
      unreadRowCount({
        events: scenario.events,
        viewer,
        view: viewById(id),
        overlay,
        now: SIM_NOW,
      });
  }, [mounted, scenario, viewer, overlay]);

  /** THE WINDOW. Applied AFTER the query so the query stays a pure projection and
   *  pagination is a view concern — which is also what lets "Load older" widen it
   *  without re-deriving anything. */
  const windowed = useMemo(() => {
    const cutoff = SIM_NOW - daysLoaded * 86_400_000;
    return days.filter((d) => {
      const [y, m, dd] = d.dayKey.split("-").map(Number);
      return new Date(y, m - 1, dd).getTime() >= cutoff;
    });
  }, [days, daysLoaded]);

  const hasOlder = windowed.length < days.length;
  const total = windowed.reduce((n, d) => n + d.rows.length, 0);

  const loadOlder = () => setDaysLoaded((d) => d + PAGE_DAYS);

  /** INFINITE SCROLL, sharing `loadOlder` with the button. Reduced motion does not
   *  disable it — this is not an animation — but a reader who never scrolls with a
   *  pointer still has the button, which is the point of having both. */
  useEffect(() => {
    const el = loadMoreSentinel.current;
    if (!el || !hasOlder || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadOlder();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasOlder]);

  /** STAFF WHO APPEAR IN THIS SCENARIO'S NETWORK ROWS — the "Specific staff"
   *  filter's options.
   *
   *  NETWORK SCOPE ONLY, and `undefined` rather than `[]` in caseload scope so the
   *  dialog HIDES the group rather than rendering it empty or disabled. A disabled
   *  filter advertises a narrowing that cannot apply here, which is the same
   *  objection standing rule 1 makes about greyed-out actions.
   *
   *  The viewer is excluded: filtering "activity by Lydia" while you ARE Lydia is
   *  what My caseload already is. */
  const networkStaffIds = useMemo(() => {
    if (!mounted || view.scope !== "all") return undefined;
    const ids = new Set<string>();
    for (const e of scenario.events) {
      if (e.actorType === "system") continue;
      if (e.actorId === viewer.id) continue;
      ids.add(e.actorId);
    }
    return [...ids].sort();
  }, [mounted, view.scope, scenario, viewer.id]);

  const onSeen = (row: FeedRow) =>
    markRows(viewer.id, view.scope, row.eventIds);
  const onClear = (row: FeedRow) => {
    // Clears every constituent of a group — `eventIds` is the membership.
    //
    // FOCUS MOVES TO THE NEXT ROW BEFORE the state change unmounts this one.
    // Without it the browser drops focus to <body> and a keyboard reader is
    // silently teleported to the top of a long feed. Captured from the live DOM
    // rather than from `days`, because the next row on screen is what the reader
    // was actually looking at.
    const li = feedRef.current?.querySelector<HTMLElement>(
      `[data-row-id="${row.id}"]`
    );
    const nextLink =
      li?.nextElementSibling?.querySelector<HTMLElement>("a") ??
      // Last row in its day: fall forward to the first row of the next day.
      li?.closest("section")?.nextElementSibling?.querySelector<HTMLElement>("a") ??
      null;

    for (const id of row.eventIds) clearRowAction(viewer.id, view.scope, id);
    // TODO-COPY. The brief's example: "Cleared. Maya's escalation." — the fact,
    // then what it was, so a reader who clears several in a row can tell them
    // apart. No exclamation, no "Done!".
    setAnnouncement(`Cleared. ${row.sentence}`);
    requestAnimationFrame(() => nextLink?.focus());
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
        ref={feedRef}
        id="activity-panel"
        role="tabpanel"
        aria-labelledby={`activity-tab-${viewId}`}
        tabIndex={-1}
        className="mt-4"
      >
        {loadState === "loading" ? (
          <FeedSkeleton />
        ) : loadState === "error" ? (
          <FeedError onRetry={() => setLoadState("ready")} />
        ) : total === 0 ? (
          <EmptyState
            viewId={viewId}
            unreadOnly={unreadOnly}
            filtered={hasActiveFilters(filters)}
            showCleared={filters.showCleared}
            firstRun={scenario.events.length === 0}
          />
        ) : (
          windowed.map((day, i) => (
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

              {/* PARTIAL FAILURE, IN PLACE. Rendered between day groups rather
                  than at the top, so the rows that loaded keep their position and
                  the gap is where the missing range actually is. */}
              {loadState === "partial" && i === 0 && (
                <PartialFailureStrip onRetry={() => setLoadState("ready")} />
              )}
            </section>
          ))
        )}

        {/* PAGINATION. The sentinel and the button share `loadOlder`. */}
        {loadState === "ready" && total > 0 && (
          <>
            <div ref={loadMoreSentinel} aria-hidden className="h-1" />
            {hasOlder ? (
              <div className="mt-4 flex justify-center">
                <RecordButton onClick={loadOlder}>{COPY.loadOlder}</RecordButton>
              </div>
            ) : (
              /* END OF FEED. A statement, not a celebration — this is a ledger
                 and reaching its start is a fact about the record. */
              <p className="mt-6 text-center text-[12.5px] leading-[16px] text-[var(--text-muted)]">
                {COPY.endOfFeed}
              </p>
            )}
          </>
        )}
      </div>

      {/* POLITE LIVE REGION for the clear announcement. Always present so the
          region is registered before it ever has content — a live region added to
          the DOM at the same moment as its text is frequently missed. */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <FilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        applied={filters}
        onApply={setFilters}
        caseloadTeenIds={viewer.caseloadTeenIds}
        networkStaffIds={networkStaffIds}
        returnFocusTo={filterTrigger}
      />

      <ScenarioSimulator
        activeId={scenario.id}
        onSelect={(id) => {
          setScenarioId(id);
          // A new ledger starts at the first page and in a good state.
          setDaysLoaded(PAGE_DAYS);
          setLoadState("ready");
        }}
        loadState={loadState}
        onLoadState={setLoadState}
      />
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
  showCleared,
  firstRun,
}: {
  viewId: string;
  unreadOnly: boolean;
  filtered: boolean;
  showCleared: boolean;
  firstRun: boolean;
}) {
  // ORDER MATTERS: the most specific cause wins, so a reader is told the actual
  // reason the list is empty rather than the most general one that happens to be
  // true. A first-run record that also has a filter on is still first-run.
  let copy: string;
  if (firstRun) copy = COPY.firstRun;
  else if (showCleared) copy = COPY.emptyCleared;
  else if (filtered) copy = COPY.emptyFiltered;
  else if (unreadOnly) copy = COPY.emptyUnread;
  // THE ASYMMETRY IS DELIBERATE and must not be homogenised: an empty caseload is
  // a success state and reads calm; an empty Network is closer to a failure and
  // reads as a range problem rather than reassurance.
  else if (viewId === "network") copy = COPY.emptyNetwork;
  else if (viewId === "billing") copy = COPY.emptyBilling;
  else copy = COPY.emptyMine;

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="max-w-sm text-center text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {copy}
      </p>
    </div>
  );
}
