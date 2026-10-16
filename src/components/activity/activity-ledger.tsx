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
import { AlignJustify, Filter, Rows3, Search, X } from "lucide-react";
import {
  DEFAULT_LOAD_STATE,
  type LoadState,
} from "@/lib/dev/load-state";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { queryFeed, unreadRowCount, type FeedRow } from "@/lib/activity/query";
import { DEGRADED_MESSAGE } from "@/lib/activity/inspector";
import {
  eventEvidenceFor,
  flaggedContentFor,
} from "@/lib/activity/evidence";
import { codeHistoryFor, readingsFor } from "@/lib/activity/pane-fixtures";
import { EventEvidencePane } from "@/components/activity/event-evidence-pane";
import { staffFirstName, teenFirstName } from "@/lib/activity/seed";
import { seedOverlay } from "@/lib/activity/read-state";
import {
  DEFAULT_SCENARIO_ID,
  SIM_NOW,
  scenarioById,
} from "@/lib/activity/seed";
import {
  DEFAULT_VIEW_ID,
  viewById,
  type ActivityDensity,
} from "@/lib/activity/views";
import type { ActivityDomain } from "@/lib/activity/events";
import type { ActivityViewer } from "@/lib/activity/resolve-alert-type";
import { RecordButton } from "@/components/record/record-button";
import { ActivityRow } from "@/components/activity/activity-row";
import { FilterDialog } from "@/components/activity/filter-dialog";
import { ViewRail } from "@/components/activity/view-rail";
import {
  DOMAIN_FILTERS,
  EMPTY_FILTERS,
  activeFilterCount,
  hasActiveFilters,
  type ActivityFilters,
} from "@/lib/activity/filters";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ THE TASKS PAGE'S LAYOUT CONTRACT, ADOPTED VERBATIM (A13) ═══
 *
 *  Activity had invented its own: `max-w-[880px] px-6 py-8` with a
 *  `[480px_minmax(0,1fr)]` grid. Tasks uses `max-w-[1400px] px-6 py-6 lg:px-8`
 *  with `gap-5` and a 40/60 split. Two pages in one console, two page geometries.
 *
 *  COPIED, NOT APPROXIMATED. The strings below are the same strings
 *  `tasks-page.tsx` uses, so a change there is a grep away from being applied
 *  here rather than a coincidence that quietly stops holding.
 *
 *  THE 480px FIGURE IS DELETED. A12 invented it without reference to Tasks, where
 *  the DETAIL column is the wider of the two — 60fr against the list's 40fr. The
 *  detail side holds the thing you are reading about; the list holds one sentence
 *  per row and does not need to be the bigger half.
 *
 *  `COLUMNS` IS USED THREE TIMES — the toolbar row, the content grid, and nothing
 *  else. The toolbar shares it so the density toggle can right-align to the LIST
 *  column's edge (§5) by simply being the last thing in the first cell, rather
 *  than by a hand-computed offset that would drift the moment the ratio changed. */
const PAGE_WRAPPER = "mx-auto w-full max-w-[1400px] px-6 py-6 lg:px-8";
const COLUMNS = "grid gap-5 xl:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]";
/** ═══ AND ONE COLUMN WHEN THE LIST IS EMPTY (item 7) ═══
 *
 *  With no rows there is nothing to select, so the pane has nothing to hold and
 *  rendered as a second large empty slab beside the first — two empty states
 *  side by side, one of which was explaining that nothing was selected while the
 *  other explained that nothing exists.
 *
 *  The pane returns the moment rows exist. Applied to the TOOLBAR row as well as
 *  the content, because the two share this definition on purpose (§5): the
 *  filter cluster aligns to the first column's edge by being the last thing in
 *  that cell, and leaving the toolbar on two columns while the content collapsed
 *  would strand it mid-page. */
const ONE_COLUMN = "grid gap-5";

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
// The union moved to `lib/dev/load-state.ts` when the axis became a harness
// control shared with the dev bar — one definition, so the bar's options and the
// branches below cannot drift apart.

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
  // RENAMED WITH THE TAB. The key keeps the internal name (see views.ts).
  emptyNetwork: "No team activity in this range. Try a wider date range.",
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
  // SPEC §9's OWN WORDS, restored in A9. The built version read "That is the end
  // of the record.", which is colder than this surface should be and also says
  // something different: "the record" claims completeness, when what the feed
  // actually reached is the bottom of a 30-day window. The spec copy names the
  // window, so a reader who expected more knows where it went.
  endOfFeed: "That's everything from the last 30 days.",
  loadOlder: "Load older",
} as const;

// ── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({
  unreadOnly,
  onUnreadOnly,
  filters,
  onFilters,
  onOpenFilters,
  onResetFilters,
  paneVisible,
  filterTriggerRef,
  density,
  onDensity,
}: {
  unreadOnly: boolean;
  onUnreadOnly: (v: boolean) => void;
  filters: ActivityFilters;
  /** Per-chip removal. The popover owns adding; a chip owns taking one away. */
  onFilters: (f: ActivityFilters) => void;
  onOpenFilters: () => void;
  onResetFilters: () => void;
  /** False when the list is empty — see ONE_COLUMN. */
  paneVisible: boolean;
  filterTriggerRef: React.RefObject<HTMLButtonElement | null>;
  density: ActivityDensity;
  onDensity: (d: ActivityDensity) => void;
}) {
  const count = activeFilterCount(filters);
  return (
    // ═══ THE TOOLBAR IS A GRID ON THE PAGE'S OWN COLUMNS (A13 §5) ═══
    //
    // It used to be one flex row across the full width, which put the density
    // toggle out at the page's right gutter — floating above the PANE, a column it
    // has nothing to do with. The toggle controls the LIST, so it belongs on the
    // list's right edge.
    //
    // Achieved by giving the toolbar the same `COLUMNS` definition as the content
    // grid and putting everything in the first cell: `ml-auto` on the toggle then
    // lands it exactly on the list column's right edge, whatever the ratio is,
    // with no hand-computed offset to drift. The second cell is deliberately
    // empty — there is nothing in this toolbar that acts on the pane.
    //
    // The row itself still SPANS the full content width (§2), because the grid
    // does; it is the contents that are confined to the first column.
    <div className={cn(paneVisible ? COLUMNS : ONE_COLUMN, "mt-3")}>
      <div className="flex flex-wrap items-center gap-2">
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

      {/* ═══ APPLIED FILTERS, LEGIBLE WITHOUT OPENING ANYTHING (item 5) ═══
          The count badge on the trigger said HOW MANY narrowings were in force
          and never WHICH — so a reader looking at a short list had to open the
          popover to find out why it was short. Each chip names one filter and
          removes it; the popover stays the place you ADD them.
          They sit after the trigger and before Reset, which is the order of the
          sentence they make: filter · these ones · start over. */}
      <FilterChips filters={filters} onChange={onFilters} />

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

      {/* ═══ DENSITY (A11). RIGHT SIDE, TWO ICONS, ONE CONTROL ═══
          
          `ml-auto` rather than a spacer, so it stays on the right when the
          toolbar wraps on a narrow window instead of stranding itself on its own
          line under the left-hand group.
          
          A RADIOGROUP, not two toggle buttons. The two options are mutually
          exclusive and exactly one is always chosen, which is what a radiogroup
          means; two independent `aria-pressed` buttons would announce a state
          where both or neither could be on. Arrow keys come free with the roles.
          
          ICON-ONLY, SO EACH CARRIES ITS NAME. `aria-label` on each radio and a
          `title` for the pointer reader — an unlabelled pair of line icons is a
          guess for everyone. */}
      <div
        role="radiogroup"
        /* TODO-COPY */
        aria-label="Row density"
        className="ml-auto inline-flex items-center gap-0.5 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-0.5"
      >
        {(
          [
            { value: "dense" as const, Icon: AlignJustify, label: "Compact rows" },
            { value: "detailed" as const, Icon: Rows3, label: "Detailed rows" },
          ]
        ).map(({ value, Icon, label }) => {
          const on = density === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              // No `title=`: exact duplicate of the aria-label.
              onClick={() => onDensity(value)}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-full transition-colors",
                on
                  ? "bg-[var(--text-primary)] text-[var(--text-inverse)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

/** ═══ ONE CHIP PER APPLIED FILTER ═══
 *
 *  Every chip is removable and every chip names its own filter, so the row reads
 *  as the state of the list rather than as a count. Ordered so the axes a reader
 *  is most likely to be surprised by come first: a domain narrowing changes what
 *  KINDS of row exist, a person narrowing changes whose, and the two inclusion
 *  toggles only widen.
 *
 *  A CHIP IS NOT A BUTTON WITH AN X GLUED ON — the whole chip is the control, so
 *  the target is the chip and not a 12px glyph inside it. The label is in the
 *  accessible name as "Remove …", because "Billing ×" tells a screen-reader user
 *  what the chip IS and not what activating it does. */
function FilterChips({
  filters,
  onChange,
}: {
  filters: ActivityFilters;
  onChange: (f: ActivityFilters) => void;
}) {
  const chips: Array<{ key: string; label: string; next: ActivityFilters }> = [];

  for (const d of filters.domains) {
    const label = DOMAIN_FILTERS.find((x) => x.id === d)?.label ?? d;
    chips.push({
      key: `domain-${d}`,
      label,
      next: { ...filters, domains: filters.domains.filter((x) => x !== d) },
    });
  }
  if (filters.teenId) {
    chips.push({
      key: "teen",
      // TODO-COPY
      label: teenFirstName(filters.teenId),
      next: { ...filters, teenId: null },
    });
  }
  if (filters.staffId) {
    chips.push({
      key: "staff",
      // TODO-COPY
      label: staffFirstName(filters.staffId),
      next: { ...filters, staffId: null },
    });
  }
  if (filters.includeActions) {
    // TODO-COPY
    chips.push({
      key: "actions",
      label: "Including actions",
      next: { ...filters, includeActions: false },
    });
  }
  if (filters.showCleared) {
    // TODO-COPY
    chips.push({
      key: "cleared",
      label: "Including cleared",
      next: { ...filters, showCleared: false },
    });
  }

  if (chips.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.next)}
          /* TODO-COPY */
          aria-label={`Remove the ${c.label} filter`}
          className={cn(
            "inline-flex min-h-9 items-center gap-1 rounded-full bg-[var(--surface-s2)] px-2.5 text-[12.5px] font-medium text-[var(--text-secondary)]",
            "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          {c.label}
          <X className="size-3 shrink-0" aria-hidden />
        </button>
      ))}
    </span>
  );
}

// ═══ THE SCENARIO SIMULATOR PANEL IS GONE ═══
//
// A dashed collapsible panel pinned bottom-right, holding this page's scenario
// list AND the load-state toggle. Both axes moved into the footer dev bar, which
// is where every other harness axis already lives (persona, teen scenario, staff
// scenario). Its own comment named this as the remaining step: "this switcher's
// state is page-local, so folding it into the bar means lifting it."
//
// WHAT THE MOVE FIXED BEYOND TIDINESS:
//  · The load state was `useState` here, so it reset on every navigation — you
//    could not set "error", leave and come back to it. It is `devLoadState` in
//    the store now.
//  · The panel sat under the fixed bottom nav below `md` and could not be
//    tapped at all — the same defect row 311 records for the Tasks switcher.
//    A control in the bar has no such problem.
//  · Two collapsible scenario panels on two pages meant two patterns for one
//    job. The bar's grouped select is the one pattern.

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

export function ActivityLedger({
  /** A8 deep link: ?objectId=<teenId>. Seeds the teen filter. */
  initialTeenId = null,
  /** A8 deep link: ?domain=billing. Seeds the domain filter AND the view, because
   *  arriving on a billing deep link and landing in My caseload would filter a
   *  view that may not contain the teen at all. */
  initialDomain = null,
  /** `?scope=mine|team`. Resolves the RAIL; the domain resolves the filter. */
  initialScope = null,
  /** `?event=<eventId>`. Restores the selected row. */
  initialEventId = null,
  /** ═══ THE BELL (2026-10-16) ═══
   *  Activity moved out of its tab into the top bar's bell. `"popover"` keeps
   *  the Mine/Team rail, the toolbar and the feed, and drops the page frame,
   *  the heading (the popover has its own) and the evidence pane: "activity
   *  events no longer need a detail — the event list item is good enough." So
   *  rows are LINKS to their object (`ActivityRow`'s link mode) and nothing is
   *  selected or mirrored into the URL. */
  variant = "page",
  /** Called as a row's link is followed, so the bell can close. */
  onRowNavigate,
}: {
  variant?: "page" | "popover";
  onRowNavigate?: () => void;
  initialTeenId?: string | null;
  initialDomain?: string | null;
  initialScope?: string | null;
  initialEventId?: string | null;
} = {}) {
  const mounted = useMounted();
  const overlay = useOnboardingStore((s) => s.activityRead);
  const seedActivityRead = useOnboardingStore((s) => s.seedActivityRead);
  const markRows = useOnboardingStore((s) => s.markActivityRowsRead);
  const clearRowAction = useOnboardingStore((s) => s.clearActivityRow);
  const restoreRowAction = useOnboardingStore((s) => s.restoreActivityRow);
  /** PERSISTED PER USER (store v38). Read behind `useMounted` like every other
   *  store read on this surface — a density read before hydration renders the
   *  wrong layout for one frame with no error to show for it. */
  const storedDensity = useOnboardingStore((st) => st.activityDensity);
  const setDensity = useOnboardingStore((st) => st.setActivityDensity);
  const scenarioId = useOnboardingStore((s) => s.activityScenarioId);
  // `setActivityScenarioId` is the DEV BAR'S to call now — the select there owns
  // the axis. This page only reads it.

  const [viewId, setViewId] = useState(() =>
    /* ═══ A DEEP LINK RESOLVES TO A SCOPE, AND THE FILTER CARRIES THE DOMAIN ═══
       This used to send a billing link to the Billing tab, "the only view
       guaranteed to contain the row being linked to regardless of whose caseload
       the teen is on". That guarantee came from `scope: "all"`, not from the
       domain — so with the tab gone the link resolves to the widest SCOPE and
       the domain travels in the filter instead. Same guarantee, expressed on the
       axis that owns it.
       `?scope=` is honoured directly when given, so
       `/app/activity?scope=team&domain=billing` lands on Team with billing
       applied, and a link with only a domain still lands somewhere it can be
       seen. */
    initialScope === "team"
      ? "network"
      : initialScope === "mine"
        ? "mine"
        : initialDomain
          ? "network"
          : DEFAULT_VIEW_ID
  );
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>(() => {
    const domains = DOMAIN_FILTERS.some((d) => d.id === initialDomain)
      ? [initialDomain as ActivityDomain]
      : [];
    return {
      ...EMPTY_FILTERS,
      ...(initialTeenId ? { teenId: initialTeenId } : {}),
      domains,
    };
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterTrigger = useRef<HTMLButtonElement | null>(null);
  /** FROM THE STORE, not from local state — see the note where the panel used to
   *  be. `mounted` gates it like every other store read on this page: reading
   *  before hydration renders the wrong branch for one frame and reports
   *  nothing (standing rule 3). */
  const storedLoadState = useOnboardingStore((s) => s.devLoadState);
  /** THE RETRY BUTTONS ARE PRODUCT, NOT HARNESS. `FeedError` and the partial
   *  strip both offer "Retry", and in this prototype recovering means returning
   *  the axis to `ready`. They write to the same store field the dev bar sets —
   *  one source, so a retry cannot leave the bar showing "error" over a feed
   *  that has recovered. */
  const setLoadState = useOnboardingStore((s) => s.setDevLoadState);
  const loadState: LoadState = mounted ? storedLoadState : DEFAULT_LOAD_STATE;
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

  /** THE PAGING RESET, DERIVED RATHER THAN EFFECTED. Comparing the rendered
   *  scenario against the last one and resetting during render is the pattern
   *  this codebase already uses for `initialOpen` and the tab param — no
   *  `useEffect`, no extra paint at the old page length. */
  const [prevScenarioId, setPrevScenarioId] = useState(scenario.id);
  if (scenario.id !== prevScenarioId) {
    setPrevScenarioId(scenario.id);
    setDaysLoaded(PAGE_DAYS);
  }

  /** Same `mounted` gate as the scenario above, and for the same reason: a store
   *  read before hydration renders the wrong layout for one frame and reports
   *  nothing. */
  const density: ActivityDensity = mounted ? storedDensity : "dense";

  /** ═══ SELECTION (A12) ═══
   *
   *  The row id, not the row — a row object is rebuilt on every query and holding
   *  one would pin a stale sentence, a stale state and a stale count in the pane
   *  after the reader cleared something or switched density. */
  /** ═══ SELECTION IS DEEP-LINKABLE ═══
   *
   *  Seeded from `?event=<eventId>` and mirrored back on every change, so a link
   *  pasted into Slack for a handover restores the scope, the filters, the list
   *  position and the selected row — the scope and filters come from their own
   *  params, which is why this only has to carry the row.
   *
   *  A LINK TO A ROW OUTSIDE THE OPENER'S CASELOAD IS NOT AN ERROR. The id simply
   *  does not resolve to a row in their scope, `selectedRow` is null, and the pane
   *  shows its nothing-selected state. That is the no-pane state B3 asks for
   *  rather than a failure, and it falls out of the lookup rather than needing a
   *  branch — a bystander cannot be told "that event exists but is not for you",
   *  because that sentence is itself a disclosure. */
  const [selectedRowId, setSelectedRowId] = useState<string | null>(
    initialEventId
  );
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
  /** THE PANE EXISTS ONLY IF THERE IS SOMETHING TO SELECT. Keyed on the row
   *  count rather than on `selected`, so the column does not appear and vanish
   *  as a reader clicks around a populated list. `loading` keeps the pane too:
   *  the skeleton is a promise that rows are coming, and collapsing the layout
   *  under it would make every load reflow the page twice. */
  const paneVisible = variant === "page" && (total > 0 || loadState === "loading");

  /** THE SELECTED ROW, RE-FOUND IN THE CURRENT RESULT SET each render — which is
   *  what makes the selection survive a density change and evaporate when the row
   *  leaves the view (cleared, filtered out, marked read under Unread-only). A
   *  selection pointing at a row nobody can see would leave the pane describing
   *  something absent from the list beside it. */
  /** ═══ MIRRORED WITH `replaceState`, NOT THE ROUTER ═══
   *
   *  Selecting a row is a bookmarkable POSITION, not a navigation. `router.push`
   *  would put a history entry behind every click, so Back would walk a reader
   *  through their own reading rather than out of the page; `router.replace`
   *  re-renders the route. `replaceState` updates the address bar and nothing
   *  else, which is exactly the scope of the claim.
   *
   *  Deliberately NOT wrapped in `useEffect` over `selectedRowId` alone — the URL
   *  is written where the selection changes, so a hydration pass cannot rewrite a
   *  URL nobody clicked. */
  const selectRow = (next: string | null) => {
    setSelectedRowId(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("event", next);
    else url.searchParams.delete("event");
    window.history.replaceState(null, "", url.toString());
  };

  const selectedRow = useMemo(() => {
    if (!selectedRowId) return null;
    for (const day of windowed) {
      for (const row of day.rows) {
        if (row.id === selectedRowId) return row;
        const member = row.members?.find((m) => m.id === selectedRowId);
        if (member) return member;
      }
    }
    return null;
  }, [selectedRowId, windowed]);

  /** ═══ THE PANE'S CONTENT COMES FROM THE DATA LAYER, GATED THERE ═══
   *
   *  Still A12's hard rule, now against the EVIDENCE model rather than the object
   *  summary A12 specified (see `evidence.ts` for why that was superseded).
   *  `eventEvidenceFor` returns null for a degraded row — a degraded row has no
   *  `payload` at all — for a coalesced group, and for the types that open no
   *  pane. So this component has no branch that could decide otherwise and no
   *  shape it could half-render. */
  const evidence = useMemo(
    () => (selectedRow ? eventEvidenceFor(selectedRow) : null),
    [selectedRow]
  );

  /** ═══ IS THE FEED ALREADY ONE DOMAIN? (A10 item 6) ═══
   *
   *  If it is, every row's type glyph is the same glyph, and a column of twelve
   *  identical receipts is decoration occupying the row's leftmost content slot.
   *
   *  THE FILTER WINS OVER THE VIEW when it is set, because filters narrow WITHIN
   *  the view (see filters.ts) — a Billing view with a billing filter is still one
   *  domain, and an all-domain view filtered to one domain is one domain too. Read
   *  from the SAME two sources the query reads, so the suppression cannot disagree
   *  with what the feed actually contains. */
  const effectiveDomains =
    filters.domains.length > 0 ? filters.domains : view.domains;
  const singleDomain = effectiveDomains?.length === 1;

  /** ESCAPE DESELECTS AND CLOSES THE PANE (A12).
   *
   *  On the document rather than the list, because the reader may well be focused
   *  inside the pane — on its link — when they decide to dismiss it, and a handler
   *  scoped to the list would not hear that.
   *
   *  IT YIELDS TO ANY OPEN DIALOG. The filter popover is a Radix dialog and owns
   *  Escape while it is up; closing the pane out from under it would dismiss two
   *  things on one keystroke. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="dialog"]')) return;
      selectRow(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
    /* ANNO REGIONS — see the note in roster.tsx. Inert markers only. The feed
       ROWS are deliberately left untagged: a row is record-bound, and anchoring
       to one is refused by the accepted anno-02 trade. */
    <div
      data-anno-ref="activity-ledger"
      data-variant={variant}
      className={variant === "popover" ? "flex min-h-0 flex-col" : PAGE_WRAPPER}
    >
      <h1
        className={cn(
          "font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]",
          /* The bell's popover titles itself; the page heading would repeat it. */
          variant === "popover" && "sr-only"
        )}
      >
        {/* TODO-COPY */}
        Activity
      </h1>

      <div data-anno-ref="activity-view-rail" className={variant === "popover" ? "" : "mt-5"}>
        <ViewRail
          activeId={viewId}
          onSelect={(id) => {
            setViewId(id);
            /* ═══ THE RESET RULE IS REVERSED, AND THE OLD ONE WAS RIGHT UNTIL
                   THE RAIL STOPPED BEING THE ONLY AXIS ═══

               It read: "switching views resets filters. A view is a different
               question, and the filters were answers to the previous one." True
               while the rail mixed scope and domain — carrying "only
               escalations" into a Billing tab really did answer a question
               nobody asked.

               Now the rail is PURELY scope and the filters are purely domain, so
               they are orthogonal: "billing" and "my caseload" are two
               independent halves of one question, and clearing one when the
               other changes destroys the combination the instant you toggle,
               which is the whole reason the Billing tab was removed.

               SCOPE-SPECIFIC FILTERS STILL CLEAR, because they stop applying:
               `staffId` narrows to one colleague, which is only meaningful when
               the scope includes colleagues. Leaving it set on My caseload would
               be a filter with nothing to filter, silently returning nothing.

               `unreadOnly` also clears. It is not a domain filter — it is a
               question about THIS view's unread set, and the rail already shows
               a per-view unread count beside each tab. */
            setUnreadOnly(false);
            setFilters((f) =>
              viewById(id).scope === "mine" ? { ...f, staffId: null } : f
            );
          }}
          unreadFor={unreadFor}
        />
      </div>

      <Toolbar
        density={density}
        onDensity={setDensity}
        unreadOnly={unreadOnly}
        onUnreadOnly={setUnreadOnly}
        filters={filters}
        paneVisible={paneVisible}
        onFilters={setFilters}
        onOpenFilters={() => setFiltersOpen(true)}
        onResetFilters={() => setFilters(EMPTY_FILTERS)}
        filterTriggerRef={filterTrigger}
      />

      {/* ═══ TWO COLUMNS IN ONE GRID (A13 §3) ═══
          
          Not two floating boxes. Both are grid items in the same row, so they
          share a top edge and — because grid items stretch by default — a bottom
          edge, without either being told a height. The list's left edge is the
          page's left gutter and the pane's right edge is the page's right gutter,
          because the grid spans the wrapper's whole content box.
          
          THE PANE STILL ONLY EXISTS AT `xl` AND UP. Below that the grid collapses
          to one column and the list takes the full width; selection still happens
          and the row still takes its selected treatment, there is just nowhere for
          the pane to go. Gap row 239. */}
      <div className={cn(paneVisible ? COLUMNS : ONE_COLUMN, "mt-4")}>
      {/* ═══ ONE ELEVATED CONTAINER (A10 items 1 and 3) ═══
          
          The feed used to sit directly on the page background with no figure/
          ground separation at all, which is most of why it read as loose text
          rather than as a record.
          
          ONE CONTAINER WITH INTERNAL DIVIDERS, not per-row cards: per-row cards
          are A11's detailed-mode treatment, and using them here would leave that
          phase with nothing to change. `--surface-card` is a lighter fill than
          the page's `--surface-s1`, and elevation is a surface step plus a contour
          — this design language has no shadows to step through.
          
          `overflow-hidden` so the inset row fills and the unread bands cannot
          paint over the rounded corners.
          
          MIN-HEIGHT so the container occupies the content region instead of
          ending where the content does and leaving most of the viewport as dead
          page (item 3). `flex-col` with the pagination inside means the
          end-of-feed caption sits INSIDE the container, at the end of the record
          it belongs to, rather than floating on the page below it. Clamped at
          both ends: a floor so a three-row feed still reads as a surface, a
          ceiling so a very tall window does not stretch it into emptiness. */}
      <div
        ref={feedRef}
        data-anno-ref="activity-feed"
        id="activity-panel"
        role="tabpanel"
        aria-labelledby={`activity-tab-${viewId}`}
        tabIndex={-1}
        className={cn(
          // NO `mt-4` HERE ANY MORE. It lived on the list alone, which pushed the
          // list 16px below the pane and broke §3's shared top edge — invisible
          // until both columns were real. The spacing belongs to the grid.
          "flex flex-col overflow-hidden",
          variant === "popover"
            ? /* IN THE BELL the popover is the container: no second card, no
                 page-height floor — a three-row feed is a short popover. */
              "px-0 py-1"
            : [
                "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]",
                "min-h-[clamp(360px,calc(100dvh-17rem),820px)]",
                "px-1.5 py-1.5",
              ]
        )}
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
                /* RHYTHM (A10 item 2, and see the report): the ROWS were already
                   49px, under the 52-56px target. The 96px pitch the feed
                   actually carries came from HERE — 24px of margin plus a
                   generously padded pill between every day group. Halved. */
                <div className="mb-1 mt-2 flex items-center justify-center">
                  <span
                    id={`activity-day-${day.dayKey}`}
                    className="rounded-full bg-[var(--surface-s2)] px-2.5 py-0.5 text-[11.5px] font-semibold leading-[16px] text-[var(--text-secondary)]"
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
                /* NO `divide-y`. The divider moved inside the row so the hover
                   fill can cover it (item 4) — a border on the list item is
                   painted by the item's own box and nothing inside it can. */
              >
                {day.rows.map((row, rowIndex) => (
                  <ActivityRow
                    key={row.id}
                    row={row}
                    href={hrefFor(row)}
                    onClear={onClear}
                    // ITS PRESENCE is what swaps Clear for Restore.
                    onRestore={filters.showCleared ? onRestore : undefined}
                    onSeen={onSeen}
                    showGlyph={!singleDomain}
                    showDivider={rowIndex > 0}
                    density={density}
                    selected={variant === "page" && selectedRowId === row.id}
                    onSelect={
                      variant === "page"
                        ? (r) =>
                            // CLICKING THE SELECTED ROW AGAIN DESELECTS. The pane is
                            // a reading aid, not a mode, and Escape should not be
                            // the only way out of it.
                            selectRow(selectedRowId === r.id ? null : r.id)
                        : undefined
                    }
                    onNavigate={onRowNavigate}
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

        {/* PAGINATION, INSIDE THE CONTAINER (item 3). The sentinel and the
            button share `loadOlder`. `mt-auto` puts the caption at the bottom of
            the container when the content is shorter than the min-height, so a
            quiet feed reads as a record with room left rather than as a caption
            stranded in whitespace. */}
        {loadState === "ready" && total > 0 && (
          <>
            <div ref={loadMoreSentinel} aria-hidden className="h-1" />
            {hasOlder ? (
              <div className="mt-4 flex justify-center pb-2">
                <RecordButton onClick={loadOlder}>{COPY.loadOlder}</RecordButton>
              </div>
            ) : (
              /* END OF FEED. A statement, not a celebration — this is a ledger
                 and reaching its start is a fact about the record. */
              <p className="mt-auto pb-2 pt-6 text-center text-[12.5px] leading-[16px] text-[var(--text-muted)]">
                {COPY.endOfFeed}
              </p>
            )}
          </>
        )}
      </div>

        {/* THE INSPECTOR IS THE SECOND GRID ITEM ITSELF (A13 §4).
            
            It used to be wrapped in a `hidden xl:block` div. That div was the grid
            item and stretched to the row's height, but the `<aside>` inside it had
            no height of its own — so the pane rendered as a small box at the top of
            a tall empty column, which is exactly what §4 reports. Making the aside
            the grid item means it stretches, and its own `flex flex-col` then
            centres the empty state in the full column. */}
        {/* NOT RENDERED AT ALL WHEN THE LIST IS EMPTY. `hidden` would leave the
            grid item in place and the collapsed template would still reserve
            nothing for it — but an aside that exists and displays nothing is
            also a thing a screen reader walks into. Unmounted, so the empty
            state is one column and one message. */}
        {paneVisible && (
          <EventEvidencePane
            /* KEYED ON THE ROW so the flagged-content disclosure resets when the
               selection moves. Without the key, one reveal would leave every
               subsequent flagged message open for free. */
            key={selectedRow?.id ?? "none"}
            evidence={evidence}
            hasSelection={selectedRow !== null}
            degradedMessage={selectedRow?.degraded ? DEGRADED_MESSAGE : null}
            teenId={selectedRow?.groupObjectId ?? null}
            /* ═══ THE ROW ALREADY CARRIES THE NAME ═══
               This resolved `teenFirstName(groupObjectId)` and rendered "this
               teen" on every risk-flag pane — because for a risk flag
               `objectId` is the CONVERSATION id, not the teen's (see the note on
               `ActivityEvent.objectId`), so the lookup missed and fell back.
               `FeedRow.teenName` is the query's own resolution, correct for every
               type and already first-name-only. Re-deriving what the row hands
               over was the whole mistake. */
            subjectName={selectedRow?.teenName ?? null}
            /* ═══ HISTORY AND READINGS COME FROM THE LEDGER ITSELF ═══
               Both are derived from `scenario.events` — the append-only store the
               feed is already reading — rather than from a second model. A
               billing row's earlier `BILLING_REVIEW_COMPLETE` events ARE its code
               history, and a survey row's earlier `SURVEY_COMPLETED` events ARE
               its trend.

               DERIVED FOR THE SELECTED ROW ONLY, and only when it has a payload:
               a degraded row opens no pane at all (rule 12), so this never runs
               for one — but scoping it to `evidence` keeps that true by
               construction rather than by the caller remembering. */
            {...(() => {
              /* BOTH DERIVATIONS KEY ON THE TEEN, and `groupObjectId` is only the
                 teen for these two types — on a risk flag it is the conversation.
                 Read from the payload where it exists so the key is the teen by
                 construction rather than by which types happen to be listed. */
              const teen =
                (typeof selectedRow?.payload?.teenId === "string"
                  ? selectedRow.payload.teenId
                  : selectedRow?.groupObjectId) ?? "";
              return {
                codeHistory:
                  evidence?.eventType === "BILLING_REVIEW_COMPLETE" && selectedRow
                    ? codeHistoryFor(scenario.events, teen, selectedRow.occurredAt)
                    : [],
                readings:
                  evidence?.eventType === "SURVEY_COMPLETED" && selectedRow
                    ? readingsFor(
                        scenario.events,
                        teen,
                        String(selectedRow.payload?.instrument ?? ""),
                        selectedRow.occurredAt
                      )
                    : [],
              };
            })()}
            actorName={staffFirstName}
            /* REVEALING LOGS, and the log needs the viewer — which the pane does
               not have and should not need. The seam lives in the data layer;
               this is the only call site. */
            onRevealFlaggedContent={() =>
              selectedRow
                ? flaggedContentFor(selectedRow, viewer.id, SIM_NOW)
                : null
            }
          />
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

      {/* ═══ A NEW SCENARIO MUST STILL RESET THE PAGE ═══
          The panel's `onSelect` did two things besides setting the id: it
          returned the feed to its first page and to a normal load. With the
          control now in the dev bar, the reset has to happen HERE — the bar
          cannot know about `daysLoaded`, and a scenario switch that left the
          reader 90 days deep in a feed that no longer has 90 days is the kind of
          bug that looks like the scenario is broken.
          `setDevLoadState` is called from the bar, so only the paging half is
          left to us; the store's own `setActivityScenarioId` already clears the
          read overlay. */}
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
 *  An empty "My caseload" is a SUCCESS state and reads calm. An empty "Team" is
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
