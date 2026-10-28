"use client";

// THE TASKS WORKLIST — shell. Phase T2.
//
// SINGLE SURFACE, MASTER-DETAIL (locked decision 2). Summary cards act as tabs;
// list left, persistent detail pane right. NO DRAWER. The pane is always populated
// when the active tab has items — which is why the pre-selected item is derived
// from the sort rather than left null until someone clicks.
//
// T4 SCOPE: the pane is real, and resolving works — auto-advance, undo toast, tab
// completion, and §6's ledger timing rule.
//
// RESOLUTION LIVES IN COMPONENT STATE, not the store. Tasks are fixtures with no
// writer, so a resolved id set plus a payload-override map is the honest model: it
// is the scenario's own state, it resets with the scenario, and it does not pretend
// a task service exists. What DOES leave this component is the Activity event, via
// resolveWithUndo — and that is deliberate, because the ledger is the real record.
//
// LAYOUT (§1): list ~40% / pane ~60% at ≥1280px. Below 1100px the pane becomes a
// full-width takeover with a back affordance. Mobile is not a v1 target, but this
// is deliberately not a layout that CAN NEVER collapse — the breakpoint switches
// which of the two panes is mounted rather than trying to shrink both.
//
// STORE READS ARE GATED BEHIND useMounted (standing Next-16 rule): these failures
// produce zero console errors, so the gate is the only thing between a persisted
// scenario id and a hydration mismatch.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useMounted } from "@/lib/use-mounted";
/* `RespondStrip` LEFT WITH THE ESCALATIONS — see the note at its old mount.
   `elapsedLabel` is domain-neutral and still formats the list's ages. */
import { elapsedLabel } from "@/components/tasks/strips";
import { Worklist, type ListState } from "@/components/tasks/worklist";
import {
  ALL_KINDS,
  KindFilter,
  filterByKind,
} from "@/components/tasks/kind-filter";
import { TaskPane, type PaneActions } from "@/components/tasks/task-pane";
import { TabComplete } from "@/components/tasks/completion";
import { PageHeader } from "@/components/ia/page-header";
/* RETIRED BY §5.4 — unmounted on both list surfaces, kept for the reason
   every retired piece here is. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ShiftTrack } from "@/components/ia/shift-progress";
import { useResolveUndo } from "@/components/tasks/resolve-undo";
import { ShortcutSheet, useTaskShortcuts } from "@/components/tasks/shortcuts";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { ListToolbar } from "@/components/ia/list-toolbar";
import { CareSortNotice } from "@/components/tasks/review-row";
import {
  applyCareSort,
  nextSort,
  type CareSort,
  type CareSortColumn,
} from "@/lib/ui/care-sort";
import { shiftDateLabel } from "@/lib/home/shift-date";
import {
  VIEW_OPTIONS_DEFAULT,
  type ViewPreset,
} from "@/lib/ui/view-options";
import {
  applyFilters,
  EMPTY_FILTERS,
  isFiltering,
  timeDimension,
  type Filterable,
  type FilterDimension,
  type FilterState,
} from "@/lib/ui/filters";
import {
  hasSavedReviewDraft,
  reviewDraftsVersion,
  reviewDraftsVersionServer,
  subscribeReviewDrafts,
} from "@/lib/record/review-draft";
import { proposalKindFor, PROPOSAL_LABEL } from "@/lib/record/proposal-kind";
import { closedEntries, listEntriesForDomains, itemsOf, paneItemFor, type ListEntry } from "@/lib/tasks/list";
import {
  headerCounts,
  preselectedFor,
} from "@/lib/tasks/sort";
import { LOAD_STAGES, loadPlanFor } from "@/lib/tasks/load-plan";
import { tasksClosedHistory, tasksScenario } from "@/lib/tasks/seed";
import { buildClosedReview, withClosures, type ClosedCareReview } from "@/lib/tasks/closed-review";
import { billingReviewFor } from "@/lib/tasks/billing-presentation";
import { assignedSupervisor } from "@/lib/tasks/assignment";
import { staffActorFor } from "@/lib/record/permission-map";
import {
  asTaskType,  DOMAIN_LABEL,
  TASK_DOMAINS,
  isActiveEscalation,
  type BillingPayload,
  type TaskDomain,
  type TaskItem,
} from "@/lib/tasks/types";
import type { BillingCommitDetail } from "@/components/tasks/billing-review";
import { cn } from "@/lib/utils";
import { oldestAgeLabel } from "@/lib/ia/age";
import { CARE_TAB_EMPTY, type CareTab } from "@/lib/ui/care-tab";

/** ═══ WHAT TASKS HOSTS (arch-G, G2) ═══
 *  The two domains whose work CLEARS: billing reviews and the two escalation
 *  tasks. Declared once so the list, the chips, the counts and the surface
 *  filter cannot disagree about what this page contains. Risk flags are
 *  deliberately absent — they are coverage work and they live on Monitoring. */
const TASKS_DOMAINS: readonly TaskDomain[] = ["escalation", "billing"];

/** ═══ AND WHAT `Care Reviews` HOSTS (supervisor IA restructure, Phase 2) ═══
 *
 *  BILLING ONLY. `escalation` was here because both domains CLEAR, and a shared
 *  success model was the right dividing line when the alternative was Monitoring
 *  — flags never reach zero. It is the wrong line now: escalations have their own
 *  destination, their own lifecycle and their own clocks, and `destinations.ts`
 *  already says `escalations` owns `activeEscalation` and `escalationDocumentation`.
 *
 *  ═══ NOTHING IS LOST, AND HERE IS THE CHECK ═══
 *  Every escalation obligation this page held is one of the RECORDS the
 *  `/app/escalations` region already renders, with its acknowledgement clock and
 *  its close-out count — verified against this scenario: Simone B., Imani C. and
 *  Caleb O. appear in both, the region additionally showing Riley T.
 *
 *  WHAT DOES CHANGE is the presentation: the obligations sat in this page's
 *  deadline buckets (`Needs response now`, `Overdue`) and the region groups by
 *  lifecycle state instead. Phase 6 owns that lifecycle and is where the two
 *  representations become one. Stated because a presentation change that nobody
 *  writes down is indistinguishable from a regression.
 *
 *  ═══ A SCOPE, FOR THE SAME REASON MONITORING HAS ONE ═══
 *  A `domains` narrowing rather than a second page. Everything downstream — the
 *  chips, the counts, the buckets, the pane, the keyboard layer — is derived from
 *  `surfaceItems`, so one filter at the top is the whole change and the escalation
 *  machinery simply receives no items. The unscoped default is unchanged, which
 *  is what makes this parameterisation provably not the thing that moved. */
export type TasksScope = "care-reviews";

const SCOPE_DOMAINS: Record<TasksScope, readonly TaskDomain[]> = {
  "care-reviews": ["billing"],
};

/** THE HEADING IS THE DESTINATION'S OWN NAME — the rail's label, the same string
 *  deliberately. A rail item reading `Care Reviews` over an h1 reading `Tasks` is
 *  the header-disagreement defect the production audit recorded; one name per
 *  destination reaches the reader. TODO-COPY stays on the unscoped `Tasks`. */
const SCOPE_TITLE: Record<TasksScope, string> = {
  "care-reviews": "Care Reviews",
};

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/* `TabCardsSkeleton` WENT WITH THE TAB ROW (arch-A) — it was the four-card
   loading state, and there are no cards to skeleton. */

function PaneSkeleton() {
  return (
    <div aria-hidden className="space-y-4 p-5">
      <div className="h-5 w-2/5 rounded bg-[var(--surface-s1)]" />
      <div className="h-4 w-1/4 rounded bg-[var(--surface-s1)]" />
      {/* The excerpt's own 320px box, so the pane resolving does not resize the
          column a moment before the excerpt fills it. */}
      <div className="h-[320px] rounded-[var(--radius-surface)] bg-[var(--surface-s1)]" />
      <div className="h-9 w-32 rounded-full bg-[var(--surface-s1)]" />
    </div>
  );
}

/** The pane's own inline error. Names the domain, because under partial failure
 *  the reader's next move is to switch to one that is healthy — and a message
 *  that does not say which half is broken does not tell them that. */
function PaneError({ domain }: { domain: TaskDomain }) {
  return (
    <div className="flex min-h-[12rem] flex-col items-start justify-center gap-2 p-6">
      <p className="text-[14px] leading-[20px] text-[var(--text-primary)]">
        {/* TODO-COPY */}
        Couldn&apos;t load this {DOMAIN_LABEL[domain].toLowerCase()} item.
      </p>
      {/* THE SECOND LINE IS GONE, not rewritten. It read "Other domains may
          still be available" — it pointed at the working half of a four-domain
          board, and arch-A left one domain, so it pointed at nothing. There is
          no honest replacement to make: the list below carries the only retry
          this prototype can honour, and once that retry has run the list is
          ready while the pane is still erroring, so a line sending the reader
          back to it would go stale the moment they followed it. A sentence that
          names the failure and stops is better than one that invents a
          recovery. */}
    </div>
  );
}

/* `closedLabel` LIVED HERE and is gone with the top-right unit (Part 3). It
   inflected the domain noun per count ("1 escalation" / "2 escalations",
   "billing" uninflected because it is a mass noun). The tab-card's closed
   segment does not need it: the card already NAMES its domain on line 1, so the
   segment reads "· 2 closed" and repeating "flags" under a card labelled Flags
   would be the redundancy the relocation was meant to remove. */

/* `closedTodayHref` WENT WITH THE CARDS — it deep-linked a card's closed-today
   count into the Activity ledger, filtered to that domain. */

/* `listForDomainCount` WENT WITH THE TAB BADGES — it counted one domain's open
   items for a card. The page's own `counts` covers the subtitle. */

export function TasksPage({
  /** arch-C's stage link — a band to land on. Validated here rather than at the
   *  route, so a stale bookmark falls back to the default view. */
  focusBand = null,
  /** ═══ AN ITEM TO LAND ON (Today Phase I.5.2) ═══
   *  Today's start-here preview deep-links to a specific review. Validated the
   *  same way `focusBand` is — against the list actually present — so a stale
   *  link falls back to the default selection rather than showing an empty
   *  pane. It seeds SELECTION, which is what clicking a row already does; the
   *  detail pane's output is not involved. */
  focusReview = null,
  /** Which destination is mounting this. `null` is the old whole-surface
   *  behaviour, which `/app/tasks` is a redirect away from reaching. */
  scope = null,
}: {
  focusBand?: string | null;
  focusReview?: string | null;
  scope?: TasksScope | null;
} = {}) {
  const domains = scope ? SCOPE_DOMAINS[scope] : TASKS_DOMAINS;
  const mounted = useMounted();
  /** ═══ THE SCENARIO LIVES IN THE STORE (v42, gap row 311) ═══
   *  It was `useState` here, driven by a panel pinned bottom-right — which sat
   *  under the fixed mobile bottom nav and could not be tapped below `md`, and
   *  reset on every navigation because it was page-local. Both are properties of
   *  where the state lived, so the state moved: the dev bar's Scenario select owns
   *  it, under a "Tasks" group, beside Activity's. */
  const scenarioId = useOnboardingStore((st) => st.tasksScenarioId);
  /** Fixed at mount. `Date.now()` in render scope is impure — react-hooks/purity
   *  rejects it — and every elapsed figure and breach state on the page would move
   *  on an unrelated re-render. */
  const [now] = useState(() => Date.now());

  /* ═══ `monitoringEvents` IS GONE (Phase 6) ═══
     It derived the flag events this page passed to `TaskPane` for the escalation
     timeline's join, and the comment it carried was worth keeping: `monitoringData`
     is a pure builder over (id, tasksScenarioId, now), and passing `null` means
     "derive from the task scenario" — so the escalations in this list and the
     flags on the same teens came from ONE scenario rather than two answers to
     the same question. That property is why `event-pane.tsx` can do the same
     join on `/app/escalations` without inventing a second fixture source. This
     page has no timeline to feed. */

  /** RESOLVED IDS + PAYLOAD OVERRIDES. Resolving marks the id; the override map
   *  carries what the pane decided (`flaggedCorrectly`, the confirmed code) onto
   *  the item, which is where §5 says the open feedback question is parked until
   *  it is answered (§8.3). */
  /** ═══ THE FOOTER'S "RESET REVIEWED STATES" (Part 4) ═══
   *  An ephemeral store counter is the seam: the control lives in the dev footer,
   *  the state lives here, and a nonce means neither has to reach into the other.
   *  Paired with the value it was last seen at, so the reset is a DERIVATION and
   *  nothing calls setState synchronously in an effect. */
  const resetNonce = useOnboardingStore((st) => st.tasksResetNonce);
  const [reviewed, setReviewed] = useState<{
    forNonce: number;
    ids: Set<string>;
    details: Record<string, Record<string, unknown>>;
  }>({ forNonce: resetNonce, ids: new Set(), details: {} });
  const fresh = reviewed.forNonce === resetNonce;
  /** MEMOISED, because the stale branch allocates. Without this the empty Set and
   *  object were new identities on every render, so the `items` memo below —
   *  which depends on both — re-derived the whole worklist every time anything on
   *  the page changed. The lint caught it; the cost would have been invisible. */
  const resolvedIds = useMemo(
    () => (fresh ? reviewed.ids : new Set<string>()),
    [fresh, reviewed.ids]
  );
  const detailById = useMemo(
    () => (fresh ? reviewed.details : {}),
    [fresh, reviewed.details]
  );
  const setResolvedIds = (fn: (prev: Set<string>) => Set<string>) =>
    setReviewed((r) => {
      const ok = r.forNonce === resetNonce;
      return {
        forNonce: resetNonce,
        ids: fn(ok ? r.ids : new Set()),
        details: ok ? r.details : {},
      };
    });
  /** ═══ THE SIX SECONDS BETWEEN A PRESS AND A RECORD (arch-F, F4) ═══
   *  A resolved row used to leave the list on the press, so the undo toast
   *  offered to restore a row the reader could no longer see, and the item
   *  reached "resolved" before the ledger did. It now holds its place, dimmed and
   *  labelled, until the window closes — at which point it becomes a completion
   *  entry and leaves. An undone item clears from here and never becomes one. */
  const [resolvingIds, setResolvingIds] = useState<ReadonlySet<string>>(new Set());
  /* `completed` AND `completedSelectedId` ARE GONE WITH `Completed today`
     (Closed-tab pack §4). A closed review is a row on the Closed tab now, and
     selecting it is an ordinary selection. */

  const setDetailById = (
    fn: (
      prev: Record<string, Record<string, unknown>>
    ) => Record<string, Record<string, unknown>>
  ) =>
    setReviewed((r) => {
      const ok = r.forNonce === resetNonce;
      return {
        forNonce: resetNonce,
        ids: ok ? r.ids : new Set(),
        details: fn(ok ? r.details : {}),
      };
    });


  /* ═══ THE CLOSED RECORDS (Closed-tab pack §0.1) ═══
     Read before `allItems` because they decide what is still open: the page
     knew only the reviews closed during THIS mount (`resolvedIds`), so across a
     reload a submitted review came back onto Open. `withClosures` is the same
     rule the rail badge and Today run. */
  const closedRecords = useOnboardingStore((st) => st.closedCareReviews);
  const recordClosedCareReview = useOnboardingStore((st) => st.recordClosedCareReview);
  const allItems = useMemo(() => {
    if (!mounted) return [];
    return withClosures(tasksScenario(scenarioId, now), closedRecords).map((i) => {
      const detail = detailById[i.id];
      const base = detail
        ? { ...i, payload: { ...i.payload, ...detail } as typeof i.payload }
        : i;
      return resolvedIds.has(i.id)
        ? { ...base, status: "resolved" as const, resolvedAt: now }
        : base;
    });
  }, [mounted, scenarioId, now, resolvedIds, detailById, closedRecords]);

  /** ═══ ONE DOMAIN, FILTERED AT THE SOURCE (arch-A) ═══
   *
   *  Tasks is a COMPLETION surface now: billing reviews, which clear to zero.
   *  Escalations and risk flags are clinical VIGILANCE — coverage work that never
   *  reaches zero — and they move to Monitoring in Phase B. Three of the four
   *  domains never shared this page's success model; the split is by work mode,
   *  not by task type.
   *
   *  FILTERED HERE RATHER THAN AT EACH READER. Every derivation below — counts,
   *  closed-today, the list entries, `nextUp`, auto-advance, the completion
   *  state — reads `items`, so narrowing the source narrows all of them at once
   *  and none of their logic changes. The alternative was a domain argument
   *  threaded through six call sites, each of which could be missed.
   *
   *  THE SEED IS UNTOUCHED and still produces all four domains: Phase B needs the
   *  same fixtures to build Monitoring from. `allItems` is what the scenario
   *  returns; `items` is this surface's share of it. */
  /** ═══ THE SURFACE'S OWN SET, BEFORE THE READER NARROWS IT ═══
   *
   *  Billing-only from arch-A to arch-F. arch-G admits ESCALATIONS as the second
   *  task type, which is the capability E3 built the hidden chip row for.
   *
   *  ═══ WHY THESE TWO AND NOT THE FLAGS ═══
   *  Tasks is a COMPLETION surface: work that clears to zero. Billing reviews do,
   *  and so do both escalation tasks — a response is done when a disposition is
   *  recorded, a note is done when it is submitted. Risk flags are clinical
   *  VIGILANCE, which never reaches zero and is measured by coverage; they stay
   *  on Monitoring. The dividing line is the success model, not the urgency.
   *
   *  The kind filter narrows THIS, and the chips are derived from it rather than
   *  from the filtered result — otherwise using a chip would remove the others
   *  and a reader could not get back. */
  const surfaceItems = useMemo(
    () => allItems.filter((i) => domains.includes(i.domain)),
    [allItems, domains]
  );

  /** ═══ THE KIND FILTER — NOW WITH SOMETHING TO FILTER (arch-G, G2) ═══
   *  Built and hidden in arch-E against the day a second task type landed. It is
   *  live from here: two groups ("Escalations", "Billing"), counts on the chips,
   *  and still hidden whenever a scenario happens to hold only one. */
  const [kindFilter, setKindFilter] = useState<string>(ALL_KINDS);
  const items = useMemo(
    () => filterByKind(surfaceItems, kindFilter),
    [surfaceItems, kindFilter]
  );

  const counts = useMemo(() => headerCounts(items, now), [items, now]);
  /* `closed` (closed-today per domain) WENT WITH THE CARDS that displayed it. */

  /** ═══ THE ONLY DOMAIN ═══
   *  It was `pickedDomain ?? defaultActiveDomain(items, now)` — a reader's tab
   *  choice over a derived default. With one domain there is no choice to hold
   *  and no default to derive, so it is a constant and `defaultActiveDomain`
   *  loses its only caller on this surface. Kept in `sort.ts` for Phase B, which
   *  has tiers to default between. */
  /** ═══ THE DOMAIN IS NO LONGER SINGULAR (arch-G, G2) ═══
   *  It was the constant `"billing"` — one domain, no choice to hold. Tasks now
   *  spans two, so the list is built from the SET and this survives only as a
   *  FALLBACK for the per-domain machinery that still needs one: the load plan's
   *  partial-failure rule and the pane's error copy. Both of those read
   *  `selected?.domain ?? activeDomain`, so neither can claim "billing" over an
   *  escalation; the fallback applies when nothing is selected, where the
   *  question does not arise.
   *  IT IS NOT THE COMPLETION CARD'S ANY MORE — see `surfaceComplete`: a card
   *  reading "Billing — all reviewed." over a cleared escalation queue would
   *  name the wrong work. Declared before `selected` exists, which is why it is
   *  a constant rather than a derivation of it. */
  const activeDomain: TaskDomain = "billing";

  /** THE TAB'S ENTRIES — the sorted domain list with flags coalesced (§4). */
  /** ═══ §5.1 — OPEN OR SUBMITTED ═══
   *  SESSION-SCOPED, NOT PERSISTED. §3 gives the reasoning for sort and it
   *  applies identically here: a supervisor returning to a list showing
   *  something they switched to days ago, without remembering, misreads it —
   *  and on this tab the misreading is the dangerous direction, because an
   *  empty Submitted tab and an empty Open tab mean opposite things. The
   *  default is always Open, which is where the work is. */
  const [careTab, setCareTab] = useState<CareTab>("open");

  /** ═══ §3 — THE USER'S SORT, OR NONE ═══
   *  `null` IS THE DEFAULT AND IS NOT A SORT KEY. It means the list renders in
   *  `compareTasks`' order, which is what the surface chose; see the module
   *  note in `care-sort.ts` on why the default is the absence of a key rather
   *  than a key named "default".
   *  SESSION-SCOPED, LIKE `careTab` ABOVE, and for the same reason it gives:
   *  a supervisor returning to a queue ordered by something they set days ago,
   *  without remembering, misreads it — and here the dangerous direction is a
   *  list that looks like it is in urgency order and is in alphabetical order. */
  const [careSort, setCareSort] = useState<CareSort | null>(null);

  const markCareReviewViewed = useOnboardingStore((st) => st.markCareReviewViewed);
  const persona = useOnboardingStore((st) => st.persona);
  const staffFirst = useOnboardingStore((st) => st.draft.firstName);
  const staffLast = useOnboardingStore((st) => st.draft.lastName);

  /** ═══ EVERY CLOSED REVIEW (Closed-tab pack §1) ═══
   *  The fixture's history plus what this browser has submitted. The store's
   *  records come FIRST so `closedEntries`' first-wins de-duplication favours
   *  the review a person actually submitted. */
  const closedHistory = useMemo(
    () => (mounted ? tasksClosedHistory(scenarioId, now) : []),
    [mounted, scenarioId, now]
  );
  const allClosed = useMemo(
    () => [...closedRecords, ...closedHistory],
    [closedRecords, closedHistory]
  );
  const closedById = useMemo(
    () => new Map<string, ClosedCareReview>(allClosed.map((r) => [r.id, r] as const).reverse()),
    [allClosed]
  );

  const openEntries = useMemo(
    () => listEntriesForDomains(items, domains, now),
    [items, domains, now]
  );
  const submitted = useMemo(
    () => closedEntries(allClosed, domains),
    [allClosed, domains]
  );
  /* ONE `entries`, SO EVERYTHING DOWNSTREAM IS TAB-AGNOSTIC. The search
     adapter, the virtualizer, the selection model and the pane all read this —
     switching the source here rather than branching at each of them is what
     keeps the Submitted tab from becoming a second list component, which is
     the defect K.1 spent a whole pass removing one surface along. */
  const entries = careTab === "closed" ? submitted : openEntries;

  /** THE TAB'S ITEMS, OPEN AND RESOLVED. `entries` is the open set; band
   *  retirement needs to report how many of a cleared tier closed today, which is
   *  a fact about the resolved ones. Filtered here rather than handing the list
   *  every domain's items, so a retiring Billing band cannot count a risk flag. */
  const domainItems = useMemo(
    () => items.filter((i) => domains.includes(i.domain)),
    [items, domains]
  );

  const storedView = useOnboardingStore((st) => st.viewOptions["care-reviews"]);
  const setViewOptions = useOnboardingStore((st) => st.setViewOptions);
  const preset: ViewPreset = storedView?.preset ?? VIEW_OPTIONS_DEFAULT.preset;
  /** Filters are session state by rule, not by preference — §6.4, and the note
   *  on Monitoring's own `filters` says why it is `useState` rather than a
   *  store field. */
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  /** ═══ DRAFT STATE, THROUGH A SUBSCRIPTION ═══
   *  `sessionStorage` cannot be read during render — impure, and the server has
   *  none, so it would hydrate wrong. This is the version counter
   *  `review-draft.ts` exposes for exactly this; the dimension below re-derives
   *  when it moves. */
  const draftVersion = useSyncExternalStore(
    subscribeReviewDrafts,
    reviewDraftsVersion,
    reviewDraftsVersionServer
  );

  /** ═══ THE FILTER ADAPTER (§6) ═══
   *  Decorated rather than widening `ListEntry`, for the same reason Monitoring
   *  decorates its groups: `lib/ui/filters.ts` asks for a haystack and an
   *  instant, and the list's own model should not grow fields for a control.
   *  THE HAYSTACK IS BOTH NAMES (§6.1). The mentor is NOT drawn on these rows —
   *  arch-E removed it, because a mentor does not perform a billing review —
   *  but the item still carries it, and one search field matching either name
   *  is what §6.1 asks for. STATED because it means a search can match on a
   *  string the row does not show: the chip says what was typed, and the row
   *  that survives shows the teen it matched on. */
  type E = ListEntry & Filterable;
  const decorated = useMemo<E[]>(
    () =>
      entries.map((e) => {
        const head = e.kind === "group" ? e.head : e.item;
        return {
          ...e,
          searchText: `${head.teenDisplayName} ${head.mentorName}`,
          at: head.openedAt,
        };
      }),
    [entries]
  );

  /** ═══ FOUR DIMENSIONS, AND ONE DUPLICATE DROPPED (§6.3) ═══
   *
   *  §6.3 lists `Billing code` as the always-visible primary AND `Code` behind
   *  the Filters button. Those are one dimension, so it renders once — as the
   *  primary — and the panel holds the other three. Reported rather than
   *  silently reconciled.
   *
   *  `Draft saved / not started` reads the version counter above, not
   *  `sessionStorage` directly: see that field's note. */
  const dimensions = useMemo<FilterDimension<E>[]>(
    () => {
      const headOf = (e: E) => (e.kind === "group" ? e.head : e.item);
      const billing = (e: E) => {
        const h = headOf(e);
        return h.payload.kind === "billing" ? h.payload : null;
      };
      return [
        {
          id: "code",
          /* NEEDS-COPY-NICOLE */
          label: "Billing code",
          /* ═══ NO LONGER THE PRIMARY (§4.2) ═══
             The toolbar simplifies to search + Filters; this moves inside the
             popover with the other three. It stays FIRST in the array, so it
             is the first dimension a reader meets when they open Filters. */
          options: (items) => {
            const seen = new Set<string>();
            for (const e of items) {
              const p = billing(e);
              if (p) seen.add(p.recommended.code);
            }
            return [...seen].sort().map((value) => ({ value, label: value }));
          },
          match: (e, v) => billing(e)?.recommended.code === v,
        },
        {
          id: "proposal",
          /* NEEDS-COPY-NICOLE. §6.3's "Change proposed vs presentation
             proposed" — and the values come from `PROPOSAL_LABEL`, the same
             table the lozenges and the accessible name read, so the filter
             cannot drift from what the row says. */
          label: "Proposal",
          options: (items) => {
            const seen = new Set<string>();
            for (const e of items) {
              const p = billing(e);
              if (p) {
                seen.add(proposalKindFor(p.current?.code ?? null, p.recommended.code));
              }
            }
            return [...seen].map((value) => ({
              value,
              label: PROPOSAL_LABEL[value as keyof typeof PROPOSAL_LABEL],
            }));
          },
          match: (e, v) => {
            const p = billing(e);
            return (
              p != null &&
              proposalKindFor(p.current?.code ?? null, p.recommended.code) === v
            );
          },
        },
        timeDimension<E>(now),
        {
          id: "draft",
          /* NEEDS-COPY-NICOLE */
          label: "Draft",
          options: (items) => {
            /* READS THROUGH THE VERSION, so this recomputes when a draft is
               written or cleared. `draftVersion` is referenced here rather than
               only in the dep array because a value the callback ignores is a
               dependency the next reader will delete. */
            void draftVersion;
            let some = false;
            let none = false;
            for (const e of items) {
              const h = headOf(e);
              /* THE SAME TEST AS THE ROW MARKER (§1.1). This dimension's own
                 label is "Draft saved", so it has to mean what the marker
                 means — a filter reading the keystroke buffer under that label
                 would be the same defect wearing a different name. */
              if (hasSavedReviewDraft(h.teenId, h.id)) some = true;
              else none = true;
              if (some && none) break;
            }
            return [
              /* NEEDS-COPY-NICOLE */
              ...(some ? [{ value: "saved", label: "Draft saved" }] : []),
              ...(none ? [{ value: "none", label: "Not started" }] : []),
            ];
          },
          match: (e, v) => {
            const h = headOf(e);
            const has = hasSavedReviewDraft(h.teenId, h.id);
            return v === "saved" ? has : !has;
          },
        },
      ];
    },
    [now, draftVersion]
  );

  /** SUBSET, NEVER A RE-SORT — see `applyFilters`. */
  const shown = useMemo(
    () => applyFilters(decorated, dimensions, filters),
    [decorated, dimensions, filters]
  );
  const filtering = isFiltering(filters);

  /** NEEDS-COPY-NICOLE. The oldest visible review's age — §3.1's second metric,
   *  and the same figure Risk Flags carries. Null when the list is empty, which
   *  the header renders as an em dash rather than "0d": there is no oldest
   *  review, which is different from one that is zero days old. */
  /* ═══ §5.2, §5.3 — THE VIEWED TRACE AND THE TWO FIGURES IT FEEDS ═══
     `viewedCareReviews` is a private per-supervisor reading trace (store v52).
     A Set because membership is tested once per row in a list that can be 123
     long. */
  const viewedIds = useOnboardingStore((st) => st.viewedCareReviews);
  const viewed = useMemo(() => new Set(viewedIds), [viewedIds]);
  /* OVER THE SHOWN SET, so the figures describe the list a reader is looking
     at — the same rule `open` already follows. With §4's filters gone `shown`
     is the open set, but that is a fact about today's toolbar rather than a
     reason to count something else. */
  /* ═══ UNMOUNTED BY §4.4 (strangler rule) ═══
     "Dropped with the metric line, by Brandon's decision — the per-row dots
     carry it. No unviewed count in the header." The EXPRESSION stays because it
     is the only place "how many of the shown set has this supervisor not
     opened" is computed, and §5.2's threshold note depends on it being one
     expression rather than two. The rule it served is also worth keeping
     attached to code: a header count of things you have not looked at is an
     inbox framing, which is what §4.4 removed. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const unviewedCount = useMemo(
    () => shown.filter((e) => !viewed.has(e.id)).length,
    [shown, viewed]
  );
  /** ═══ §8 — WHICH ROWS HAVE A SAVED DRAFT ═══
   *  Resolved ONCE for the shown list rather than per row: `readReviewDraft`
   *  touches `sessionStorage`, and 123 rows each reading it on every render is
   *  a synchronous storage call per row per paint.
   *  `draftVersion` IS READ INSIDE, not only in the dep array — a value the
   *  body ignores is a dependency the next reader deletes, which is the note
   *  the retired filter dimension left behind. It is what makes this recompute
   *  when the pane saves or clears a draft.
   *  KEYED BY ENTRY ID so the row can test membership directly; for a group the
   *  head's draft is the group's, which matches what selecting the group opens. */
  const drafted = useMemo(() => {
    void draftVersion;
    const out = new Set<string>();
    for (const e of shown) {
      const h = paneItemFor(e);
      /* ═══ `hasSavedReviewDraft`, NOT `readReviewDraft` (§1.1) ═══
         §1.1 answered: a draft exists only on an explicit `Save draft`. This
         tested for ANY stored draft, and the store is written on every
         keystroke — so a supervisor who typed one character and clicked away
         marked the row. Those are the two visibly different lists §1.1 named,
         and this is the line that chose between them. */
      if (hasSavedReviewDraft(h.teenId, h.id)) out.add(e.id);
    }
    return out;
  }, [shown, draftVersion]);

  /** ═══ THE OVERDUE FILTER IS GONE (product, 2026-10-05) ═══
   *  It was §5's toolbar chip: a count of overdue (Open) or late (Closed)
   *  items that, pressed, subset the active tab. Removed because the list's
   *  default order already puts them first — overdue is `openedAt` older than
   *  48h, and the comparator falls through to `openedAt` ascending, so every
   *  overdue row on `Open` precedes every row that is not, by construction.
   *  A filter that isolates what is already at the top is a second control
   *  for one fact.
   *  WHAT IT TOOK WITH IT: the armed-tab state, the reset on tab change, and
   *  the re-arm-on-zero-crossing limit it reported — none of which has a
   *  subject now. The row's own `OverdueChip` stays. */

  /** The only way the tab changes. */
  const changeCareTab = useCallback((next: CareTab) => {
    setCareTab(next);
    /* THE TRAILING COLUMN IS PER TAB — `Review age` on Open, `Closed` on
       Closed — so a sort on it has nothing to sort on the other tab. Mentee
       and Cycle exist on both and survive the switch. */
    setCareSort((s) => (s && (s.column === "age" || s.column === "closed") ? null : s));
  }, []);

  /** ═══ §3 — THE ORDER THE LIST RENDERS IN ═══
   *  THE ONE ORDER-DEPENDENT SET. `shown` feeds four counts above and none of
   *  them care about sequence, so the sort is applied once, here, rather than
   *  threaded through the derivations — `unviewedCount`, `drafted`, `overdue`
   *  and the metrics would all be identical either way and reading them off a
   *  re-sorted array would invite someone to believe otherwise.
   *  IDENTICAL REFERENCE WHEN NO SORT IS SET, so the default path allocates
   *  nothing and cannot reorder — `applyCareSort` returns its input. */
  /** ═══ `Assigned to` — ADMINS ONLY (2026-10-06) ═══
   *  The teen's mentor's supervisor, by the caseload chain in `assignment.ts`.
   *  ON CLOSED IT IS THE RECORD'S, frozen at submission (answered: "at time of
   *  review"), so a later reassignment cannot rewrite history. Undefined for
   *  everyone else, which is what keeps the column — header and cells — off. */
  const isAdmin = persona === "admin";
  const assigneeFor = useMemo(
    () =>
      isAdmin
        ? (item: TaskItem): string | null => {
            const rec = careTab === "closed" ? closedById.get(item.id) : undefined;
            if (rec) return rec.assignedTo?.name ?? null;
            return assignedSupervisor(item)?.name ?? null;
          }
        : undefined,
    [isAdmin, careTab, closedById]
  );
  /* A sort on a column this viewer cannot see sorts nothing. */
  const effectiveSort =
    careSort?.column === "assigned" && !isAdmin ? null : careSort;
  const ordered = useMemo(
    () =>
      applyCareSort(
        shown,
        effectiveSort,
        paneItemFor,
        assigneeFor ? (e) => assigneeFor(paneItemFor(e)) : undefined
      ),
    [shown, effectiveSort, assigneeFor]
  );

/* ═══ RETIRED BY §5.3 ═══
     `3d oldest` left the metric line: age is on every row in its own column,
     where a reader compares it against the rows around it rather than against
     one aggregate. The expression stays because it is the only place "the
     oldest thing in the shown set" is computed, and §3 sorting by review age
     is the next thing that would want it. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const oldestReviewAge = useMemo(() => {
    /* ═══ THE SHARED EXPRESSION (Phase K.2) ═══
       It was `elapsedLabel(Math.min(...))` inline here while Today derived its
       own — two expressions for one figure. `oldestAgeLabel` is the one, and it
       also carries the empty case: null rather than a label, which the header
       renders as an em dash.
       THE SET STAYS FILTER-AWARE and that is deliberate — this metric's own
       label says "open · filtered", so its oldest is over `shown`. One label
       expression, two sets, each named at its call site. */
    return oldestAgeLabel(shown, now);
  }, [shown, now]);

  /** PER-DOMAIN LIST STATE (§4). Keyed by domain so an error in one tab leaves
   *  the other three alone — that is the requirement, and a single page-level
   *  state could not express it. */
  const [listStates, setListStates] = useState<Partial<Record<TaskDomain, ListState>>>({});

  /** ═══ THE DEV BAR'S LOAD STATE, AS A PLAN (Part 4) ═══
   *
   *  One value in, four surface states out — see `loadPlanFor`. The page holds
   *  only the STAGE; every surface reads its own state off the plan, so the
   *  hierarchy is one ordering in one place rather than four conditionals that
   *  drift apart.
   *
   *  THE STAGE ADVANCES ON A TIMER because "loading" has to be watchable — a
   *  sequence that resolves in the same frame is not a sequence anybody can see.
   *  240ms per step is slow enough to read and short enough not to become the
   *  demo. It resets whenever the load state changes, so re-selecting "Loading"
   *  replays it. */
  const devLoadState = useOnboardingStore((st) => st.devLoadState);
  /** §5's two axes, persisted under this destination's own key — see the store
   *  field's note on why the map is sparse. */
  /** ═══ THE STAGE CARRIES THE STATE IT BELONGS TO ═══
   *
   *  The first version reset with `setLoadStage(0)` in the effect body, which the
   *  hooks lint rejects — and it is right to: a synchronous setState in an effect
   *  is a second render pass every time, and here it also meant the surfaces
   *  painted one frame at the OLD stage before resetting.
   *
   *  Pairing the stage with the load state it was counted for makes the reset a
   *  DERIVATION instead: if the state has moved on, the stage is 0 by definition,
   *  no write required. The effect then only schedules. */
  const [progress, setProgress] = useState<{
    /** The load state this stage was counted for, or null once that run has been
     *  torn down — see the effect's cleanup. */
    forState: string | null;
    stage: number;
  }>({ forState: devLoadState, stage: LOAD_STAGES });
  const loadStage =
    progress.forState === devLoadState
      ? progress.stage
      : devLoadState === "loading"
        ? 0
        : LOAD_STAGES;

  /** THE STAGE ADVANCES ON A TIMER because "loading" has to be watchable — a
   *  sequence that resolves in the same frame is not a sequence anybody can see.
   *  240ms per step is slow enough to read and short enough not to become the
   *  demo. Re-selecting "Loading" replays it — see the effect body for what that
   *  actually takes, and for the run where it did not. */
  useEffect(() => {
    if (!mounted) return;
    if (devLoadState !== "loading") return;
    const timers = Array.from({ length: LOAD_STAGES }, (_, i) =>
      setTimeout(
        () => setProgress({ forState: devLoadState, stage: i + 1 }),
        (i + 1) * 240
      )
    );
    /* ═══ THE RESET LIVES IN THE CLEANUP, AND IT IS NOT DECORATION ═══
     *
     *  The claim above used to be that re-selecting "Loading" replays the
     *  sequence "because the state change moves `forState`". MEASURED while
     *  re-verifying the dev footer (arch-A, A2): it replays exactly once. A
     *  finished run leaves `progress` at `{forState: "loading", stage: 4}`, so
     *  Loading → Ready → Loading finds `forState` ALREADY equal to "loading",
     *  reads its stage as 4, and resolves in the same frame. The second
     *  selection did nothing, and every one after it.
     *
     *  Clearing the stamp on the way OUT is what makes the next entry a change
     *  again. IN THE CLEANUP RATHER THAN THE EFFECT BODY because a synchronous
     *  setState in the body is what the compiler's lint rejects — correctly, and
     *  it rejected the first version of this fix. The cleanup runs on the way to
     *  the next state, which is exactly when this belongs.
     *
     *  IT MOVES NO PIXEL. The derivation already reports `LOAD_STAGES` for every
     *  non-loading state, so the only thing this write changes is what the NEXT
     *  entry into loading sees.
     *
     *  PRE-EXISTING, not introduced by scoping Tasks. */
    return () => {
      timers.forEach(clearTimeout);
      setProgress({ forState: null, stage: LOAD_STAGES });
    };
  }, [mounted, devLoadState]);

  /** SELECTION. `selectedEntryId` is the ENTRY id — a group id for a collapsed
   *  group — while `selected` is the ITEM the pane shows. Two ids because
   *  selecting a group selects its highest-priority child in the pane (§4), so
   *  the row that is highlighted and the item being reviewed are not the same
   *  object. */
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  /* ═══ THE DEEP LINK IS A FALLBACK, NOT AN OVERRIDE (Phase I.5.2) ═══
     It resolves only while the reader has selected nothing — so arriving from
     Today lands on the named review, and the first click afterwards behaves
     exactly as it always did. Written as a lookup rather than an effect
     because a `useState` seeded from a prop would go stale on navigation and
     a `useEffect` that sets state is what the React Compiler rejects. */
  const focusedEntry: ListEntry | null =
    focusReview != null ? (entries.find((e) => e.id === focusReview) ?? null) : null;

  /* ═══ THE FALLBACK IS THE FIRST VISIBLE ROW, NOT THE FIRST ENTRY (§3) ═══
     It read `entries[0]`, which was the same object while nothing reordered
     the list. A sort makes them different, and `entries[0]` would select a row
     somewhere down the list while the pane claimed to be showing the top of
     it — and §5.2 marks the pane's active entry VIEWED, so the mismatch would
     also put a read marker on the wrong row.
     THE LOOKUP STAYS ON `entries`: a selected id has to resolve whatever the
     order is, and `ordered` is a permutation of `shown`, which is a
     subsequence of `entries` — the wider set is the correct one to resolve
     against. */
  const activeEntry: ListEntry | null =
    entries.find((e) => e.id === selectedEntryId) ?? focusedEntry ?? ordered[0] ?? null;

  /** ═══ §5.2 — "VIEWED" MEANS THE RECORD OPENED IN THE PANE ═══
   *  THE THRESHOLD, STATED: an item counts as viewed when it is the pane's
   *  active entry — which is what happens on a click, on a keyboard move, and
   *  on the default selection of the first row.
   *  THE DEFAULT SELECTION IS DELIBERATELY INCLUDED. `activeEntry` falls back
   *  to `entries[0]`, so landing on the list marks its first row viewed without
   *  a click. That is correct rather than convenient: the pane renders that
   *  record in full beside the list, so the supervisor HAS seen it — and a
   *  marker claiming otherwise on a row whose content is on screen would be
   *  the list contradicting the pane.
   *  AN EFFECT AND NOT A RENDER-TIME WRITE. The React Compiler rejects state
   *  writes during render, and a store write in a `useMemo` would fire twice
   *  under StrictMode. */
  useEffect(() => {
    if (!mounted || careTab !== "open" || !activeEntry) return;
    markCareReviewViewed(activeEntry.id);
  }, [mounted, careTab, activeEntry, markCareReviewViewed]);
  const selected: TaskItem | null =
    // An explicitly picked child wins; otherwise the entry's pane item, which for
    // a group is its head.
    (pickedId
      ? entries.flatMap((e) => (e.kind === "group" ? e.members : [e.item])).find((i) => i.id === pickedId)
      : null) ??
    (activeEntry ? paneItemFor(activeEntry) : null) ??
    preselectedFor(items, activeDomain, now);

  /** Below 1100px the pane is a takeover, so it needs a way back to the list. */
  const [paneTakeover, setPaneTakeover] = useState(false);
  /* `fullWidth` IS GONE WITH THE LAYOUT AXIS (Refinement §4) — the pane is the
     point of the workflow on this surface, so a mode that hid it never earned
     itself. */
  /** Enter focuses the pane — it needs a target, and tabIndex={-1} makes the
   *  scroll container focusable without adding a tab stop. */
  const paneRef = useRef<HTMLDivElement | null>(null);
  /** What the pane's keyboard shortcuts press. Published by TaskPane — see
   *  PaneActions there for why the actions come down rather than the state going
   *  up. */
  const paneActions = useRef<PaneActions>({});

  /** THE LIVE UNDO. One at a time — a second resolve flushes the first, because
   *  two open windows would mean two toasts and an ambiguous `u` key. */
  /** Set when a tab's last item was just resolved, so the pane can show the
   *  completion state instead of an empty frame. */
  /** ═══ THE SURFACE CLEARED TO ZERO — AND IT IS THE SURFACE, NOT A DOMAIN ═══
   *  It was `completedDomain: TaskDomain | null`, which said WHICH of four tabs
   *  had emptied; then `billingComplete`, when there was one domain and the
   *  question was only whether.
   *  arch-G BROKE THAT SILENTLY and this is the fix: the flag was set when the
   *  RESOLVED ITEM'S DOMAIN emptied, so completing the last escalation raised
   *  "Billing — all reviewed." over a list still holding billing rows. A
   *  completion card is a claim about what is left, and per-domain it had no way
   *  to be true on a two-domain surface. */
  const [surfaceComplete, setSurfaceComplete] = useState(false);

  /** ═══ THE SHIFT-START DIGEST BELONGS TO HOME NOW (arch-C, C2) ═══
   *
   *  "Since you were last here —" sat above the tabs and summarised what had
   *  moved during the gap. It was removed at the product owner's request on
   *  2026-08-31, leaving only its gate: `tasksLastVisitAt`, stamped here on every
   *  mount and read by nothing.
   *
   *  arch-C rebuilds the digest on Home, and THIS WRITE HAD TO GO WITH IT. The
   *  stamp answers "has it been a shift since you were last here", and a
   *  supervisor who opened Tasks before Home would have answered it on the wrong
   *  page — killing Home's digest by looking somewhere else first. The surface
   *  that shows the digest is the surface that stamps it, so Home owns
   *  `shiftLastSeenAt` and this page owns nothing about the shift.
   *
   *  `tasksLastVisitAt` IS LEFT IN THE STORE, unwritten. Deleting a persisted
   *  field costs a migration to remove a number, which this codebase already
   *  declined once for this exact field; v44 migrates FROM it so an existing
   *  session keeps its place in the shift.
   *
   *  C2 asked to "delete the digest from Tasks now that Home owns it". There was
   *  no digest left to delete — only this write. */

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  /** THE PANE'S LIVE ANNOUNCEMENT (§7): "Next: Marcus, red flag, 22 hours open".
   *  Polite, and set only on AUTO-ADVANCE — announcing on every click would talk
   *  over a reader who is navigating deliberately. */
  const [announcement, setAnnouncement] = useState("");

  /* `selectDomain` IS GONE with the tab row. It set the picked domain and
     dropped both selection ids so the derived head applied rather than stranding
     a selection from another domain — a cross-domain concern with one domain
     left. Its only callers were the tab cards, the 1–4 shortcuts and the
     completion CTA, and all three go with it. */

  /** ═══ `openItem` WENT WITH THE DIGEST ═══
   *  It set the domain, the picked id and pane takeover in one go, so a CTA
   *  elsewhere on the page could jump the reader into an item on another tab. The
   *  digest's CTA was its only caller — the Respond strip navigates by link and
   *  takes no callback — so it is removed rather than left as an unused seam. Any
   *  future cross-tab jump wants exactly this shape; it is in git history. */

  /** THE PLAN, derived where both `selected` and the stage are in scope. Under
   *  partial failure the pane's state depends on the SELECTED item's domain — a
   *  pane erroring beside a healthy Billing item would claim an outage that did
   *  not touch it. */
  const plan = loadPlanFor(devLoadState, loadStage, selected?.domain ?? activeDomain);
  /** The per-domain manual override still wins where one was set — the list's own
   *  state, from before the dev bar owned this axis. `plan.list` is the default. */
  const listState: ListState = listStates[activeDomain] ?? plan.list;

  /** ═══ THE WHOLE-PAGE EMPTY, AND WHY CARE REVIEWS IS OUT OF IT (§9) ═══
   *
   *  FOUND BY §9's `care-open-empty` FIXTURE, which is what the fixture was for.
   *  With no open review, `WholePageEmpty` replaced the entire panel — and it
   *  takes the TOOLBAR with it, so §5.1's Open/Submitted control disappeared
   *  along with both of its empty states. Three consequences, measured on that
   *  fixture:
   *
   *   · `CARE_TAB_EMPTY` WAS DEAD CODE on this path. §5.1's whole argument is
   *     that "no open reviews is an achievement; no submitted reviews is a blank
   *     history" must read differently, and neither line could render.
   *   · SUBMITTED BECAME UNREACHABLE exactly when it is most wanted — a
   *     supervisor who just cleared the queue by working it cannot get to the
   *     list of what they submitted.
   *   · AND THE COPY OVERCLAIMS. "Every queue is clear" is a statement about
   *     every queue from a page that only counts its own: the fixture has three
   *     open risk flags while this rendered. Reported rather than rewritten —
   *     the strings are Nicole's, and "No open tasks" additionally uses the
   *     noun the addendum retired.
   *
   *  SO IT IS RISK FLAGS' BRANCH ONLY. Risk Flags has no submitted set and no
   *  tab axis, so nothing is hidden behind its whole-page empty; Care Reviews
   *  keeps its toolbar and answers with the one of two lines that fits. */
  const nothingOpen = mounted && counts.open === 0 && scope !== "care-reviews";

  /* THE FOCUS PAUSE AND THE BOUNDARY FLUSH MOVED TO `useResolveUndo` (arch-B).
     Sixty-five lines of sonner-presence translation and a `pagehide` listener,
     both of which are about WHEN an event reaches the ledger and neither of
     which is about this page. Monitoring resolves flags on the same timing rule,
     and two copies of a rule whose failures are invisible on screen — a lost
     write looks like a successful resolve; an unpaused window looks like an Undo
     button that stopped working — is two behaviours waiting to diverge. */

  /** `Enter` focuses the pane, `u` undoes, `?` opens the sheet. The list's own
   *  ↑/↓/j/k live in the tree (T3).
   *
   *  `1`–`4` ARE GONE WITH THE TABS. They selected a domain, and there is one.
   *  The binding is dropped rather than left pointing at a constant, and the
   *  shortcut sheet drops the row with it — a help sheet listing a key that does
   *  nothing is worse than a shorter sheet. */
  useTaskShortcuts({
    /* `y` / `n` — the footer's two buttons, without the aim. A no-op on a
       billing or escalation item, because `answer` is only published for a flag:
       a key that resolved the wrong kind of task would be much worse than a key
       that did nothing. */
    onAnswer: (correct) => paneActions.current.answer?.(correct),
    /* Enter confirms when there is a code to confirm, and reports whether it
       did — the hook falls through to focusing the pane when it did not. */
    /* ═══ BARE ENTER NO LONGER COMMITS ═══
       It used to press the pane's `confirm`, which for billing wrote a code with
       no documentation — the fastest route through the gap this build closes. A
       billing review is submitted from the pane, with `⌘/Ctrl+Enter` or the
       footer, so Enter on a list row falls through to focusing the pane for
       every domain. The overload is gone and the hook's own note on it stands:
       false means "I did not consume this".
       THE OTHER DOMAINS NEVER USED IT — `confirm` is billing-only, so this
       returns false for all four now and the branch is kept only to keep the
       hook's contract explicit rather than silently always-false. */
    onEnter: () => false,
    onSubmit: () => paneActions.current.confirm?.(),
    onFocusPane: () => {
      // BELOW `xl` THE PANE IS `display:none` UNTIL IT TAKES OVER, and the
      // browser refuses `focus()` on a zero-size element outright — silently, so
      // the shortcut looked wired and did nothing. The takeover has to be
      // requested first, and the focus has to wait for the paint that gives the
      // pane a box. One frame is enough: React has flushed by then.
      setPaneTakeover(true);
      requestAnimationFrame(() => paneRef.current?.focus());
    },
    onUndo: () => undoPending(),
    onHelp: () => setShortcutsOpen(true),
  });

  /* `nextDomainAfter` WENT WITH THE COMPLETION CTA — it answered "which tab
     next", per the global sort. */

  /** RESOLVE (§5 + §6).
   *
   *  Order matters and it is the order below: mark resolved → advance selection →
   *  start the undo window → toast. The event is NOT written here; `resolveWithUndo`
   *  owns that and writes it when the window closes (§6). Nothing in this component
   *  appends to the ledger. */
  const { resolve: onResolve, undo: undoPending } = useResolveUndo({
    /* TODO-COPY. "Flag closed — Undo", 6s (§5). The verb matches the domain so a
       reader who resolves several in a row can tell which one the toast is
       about. Only billing reaches this surface now; the other verb is kept
       because the function is the domain's, not the page's. */
    toastLabel: (item) => {
      if (item.domain === "billing") return "Billing review completed";
      /* NEEDS-COPY-NICOLE, both. THE VERB MATCHES WHAT WAS RECORDED, not what
         happened to the escalation — neither of these closes it (locked decision
         3). "Escalation closed" would be the surface claiming a lifecycle change
         it did not make. */
      if (item.taskType === "activeEscalation") return "Response recorded";
      if (item.taskType === "escalationDocumentation") return "Escalation note saved";
      return "Flag closed";
    },

    onResolved: (item, detail) => {
      // WHERE SELECTION GOES: the next entry in sort order, computed BEFORE the
      // item leaves the list.
      const remaining = entries.filter(
        (e) => !itemsOf(e).every((i) => i.id === item.id)
      );
      const idx = entries.findIndex((e) =>
        itemsOf(e).some((i) => i.id === item.id)
      );
      const nextEntry = remaining[Math.min(idx, remaining.length - 1)] ?? null;

      const afterResolve = items.map((i) =>
        i.id === item.id ? { ...i, status: "resolved" as const } : i
      );
      /* EVERY OPEN ITEM ON THE SURFACE, not every open item in this item's
         domain. `afterResolve` is already the surface's set (`items`). */
      const surfaceEmptied =
        afterResolve.filter((i) => i.status !== "resolved").length === 0;

      setDetailById((prev) => ({ ...prev, [item.id]: detail }));
      /* RESOLVING, NOT RESOLVED. `resolvedIds` — which is what removes the row
         and feeds the closed-today counters — is set at the window's CLOSE, in
         `onCommitted` below, so the row stays where it is for six seconds. */
      setResolvingIds((prev) => new Set(prev).add(item.id));

      if (surfaceEmptied) {
        setSurfaceComplete(true);
        setSelectedEntryId(null);
        setPickedId(null);
      } else if (isActiveEscalation(item)) {
        /* ═══ ESCALATION RESPONSE NEVER AUTO-ADVANCES ═══
           Every other task type loads the next one the moment this one closes,
           and that is right for a queue a supervisor is working through: the
           advance is the loop, and forty reviews a shift is what it is for.
           IT IS WRONG HERE. Recording a response is the end of a live crisis,
           not a step in a queue — the supervisor has just decided whether
           somebody is safe, and the next thing they do is a decision of their
           own: call the mentor back, open the record, write the note, or stop.
           Silently loading an unrelated teen's billing review into the pane at
           that moment answers a question nobody asked, and it takes the thing
           they were looking at away while they may still need it.
           So the selection STAYS. The row is still in the list — `resolvingIds`
           holds it there for the undo window — and the pane keeps showing the
           escalation whose response was just recorded.
           DOCUMENTATION IS NOT EXEMPT: an escalation note is paperwork, filed
           after the fact, in a run of other paperwork. `isActiveEscalation` is
           the live-phase test, which is exactly the distinction that matters. */
        setAnnouncement(
          /* NEEDS-COPY-NICOLE. It has to say that nothing moved, or a reader who
             cannot see the pane will assume it did. */
          "Response recorded. Nothing else was loaded — choose what happens next."
        );
      } else if (nextEntry) {
        setSelectedEntryId(nextEntry.id);
        const nextItem = paneItemFor(nextEntry);
        setPickedId(nextItem.id);
        // TODO-COPY. §7's example shape: "Next: Marcus, red flag, 22 hours open".
        // The first name only — the row already carries the initial, and a spoken
        // "Marcus L." reads the punctuation aloud.
        setAnnouncement(
          `Next: ${nextItem.teenDisplayName.split(" ")[0]}, ${DOMAIN_LABEL[
            nextItem.domain
          ].toLowerCase()}, ${elapsedLabel(nextItem.openedAt, now)} open`
        );
      }
    },

    /** ═══ THE WINDOW CLOSED — THE SAME INSTANT THE LEDGER IS WRITTEN ═══
     *  §6's rule, and the rule F4 asks this group to match exactly: an item
     *  enters the Closed tab when its close becomes a record, not when the
     *  button was pressed. */
    onCommitted: (item, detail) => {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setResolvedIds((prev) => new Set(prev).add(item.id));
      /* ═══ THE SUBMISSION PERSISTS — ALL OF IT (Closed-tab pack §0.1) ═══
         This wrote `markCareReviewSubmitted(item.id, Date.now())` — "an id and
         an instant, nothing else" — and the assessment, both prose fields and
         their provenance, which arrive in `detail`, were dropped on the floor.
         The draft holding the same text was cleared by the form on the same
         commit, so nothing anywhere kept what the supervisor attested.
         THE RECORD NOW CARRIES THE COMMIT AND A SNAPSHOT of what was on screen
         when it was made — see `buildClosedReview`. Only billing reviews close
         onto the Closed tab; anything else keeps the old behaviour. */
      if (item.payload.kind === "billing" && detail.documentation) {
        const d = detail as unknown as BillingCommitDetail;
        /* THE PAYLOAD AS THE FIXTURE GAVE IT. `allItems` folds a commit's
           detail INTO the payload for the undo window, so the item reaching
           here may carry `documentation`/`provenance` keys; the snapshot takes
           the payload's own fields and nothing else. */
        const p = item.payload;
        const payload: BillingPayload = {
          kind: "billing",
          isReReview: p.isReReview,
          current: p.current,
          survey: p.survey,
          mentorStats: p.mentorStats,
          aiSummary: p.aiSummary,
          recommended: p.recommended,
        };
        const clean: TaskItem = { ...item, status: "open", payload };
        recordClosedCareReview(
          buildClosedReview({
            item: clean,
            review: billingReviewFor(clean, payload),
            committedCode: d.code ?? payload.recommended.code,
            committedStatement: d.statement ?? payload.recommended.statement,
            body: d.documentation,
            provenance: {
              clinical: d.provenance.clinical.state,
              diagnostic: d.provenance.diagnostic.state,
            },
            submittedAt: Date.now(),
            /* THE SAME ATTRIBUTION THE CARE PAGE WRITES — the signed-in name,
               falling back to the role — so one supervisor is one byline on
               both hosts. */
            submittedBy: {
              name: [staffFirst, staffLast].filter(Boolean).join(" ") || staffActorFor(persona),
              role: staffActorFor(persona),
            },
          })
        );
      }
    },

    onRestore: (item) => {
      /* AN UNDONE ITEM WAS NEVER COMPLETED. It clears from `resolvingIds` and
         never reaches `completed` — the group is built only in `onCommitted`, so
         there is no path from here into it. */
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setResolvedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setSurfaceComplete(false);
      /* NO DOMAIN TO RESTORE. Undo used to re-point the tab at the undone item's
         domain; there are no tabs, and the list holds both of this surface's
         domains at once — so restoring the SELECTION is the whole job. */
      setSelectedEntryId(null);
      setPickedId(item.id);
    },
  });

  return (
    /* ═══ A FIXED FRAME, NOT A DOCUMENT (Part 1.2) ═══
     *
     *  The page used to flow: header, tabs, then two columns, all inside the
     *  shell's scrolling `<main>`. That works while the content is short and
     *  fails the moment it is not — at 40–60 open flags the list runs past the
     *  viewport, the whole page scrolls, and the resolve footer goes with it.
     *  The one control a supervisor presses fifty times a shift ends up below the
     *  fold, reachable only by scrolling past the evidence they just read.
     *
     *  `h-full min-h-0 flex-col` makes this page exactly the height of the shell's
     *  content box, and the two columns the only things that scroll. `min-h-0` is
     *  the load-bearing half: a flex child's automatic minimum size is its
     *  content, so without it the columns refuse to shrink, the frame grows past
     *  its parent, and the page scrolls again — the same trap the care-update
     *  modal and the dialog primitive both documented. */
    <div
      /* 1800px — the derivation is on Monitoring's container, and both
         destinations take the same number because §2's problem is the page
         rather than the surface. */
      className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col px-6 py-6 lg:px-8"
    >
      {/* ── HEADER (§1) — PINNED. Never scrolls away. ─────────────────── */}
      {/* ANNO REGION. The worklist scroller and the task pane were already
          tagged; this top strip and the tab cards below were not, so a comment
          on either fell back to `app-main`. */}
      {/* ═══ THE SHARED HEADER (addendum §2.10) ═══
          It was an h1 at 24px and a three-segment sentence — "19 open · 2
          overdue · 3 completed today" — written here and nowhere else, while
          Monitoring wrote its own two inches away. One component now, and the
          sentence splits into the two things it was conflating: a PURPOSE that
          does not change with the data, and METRICS that do. */}
      <PageHeader
        /* Parity with Monitoring (Monitoring v4, §3): no hairline under the
           subtitle; the toolbar's spacing separates. */
        rule={false}
        title={scope ? SCOPE_TITLE[scope] : /* TODO-COPY */ "Tasks"}
        purpose={
          /* ═══ THE DATE, NOT A PURPOSE SENTENCE (§4.1) ═══
             It read "Presentation reviews waiting on a supervisor's decision."
             The destination's name says that. What a supervisor cannot read
             off the page is which day they are on, and the schedule module
             below shares this date's timezone. Applied to Risk Flags too —
             §4.1's own rule, so the two list surfaces keep one grammar. */
          shiftDateLabel(now)
        }
        /* ═══ §4.2 — THE METRIC LINE IS GONE, AND ITS JOB MOVED ═══
           A PLAIN BLOCK COMMENT, not `{/* … *\/}`: this position is a prop
           list, which takes attributes — a JSX comment is only valid in
           children position and putting one here is a parse error. The same
           trap `review-body.tsx` records at its own evidence block.
            IT WAS `16 open · 4 unviewed · 2 overdue`, and every one of the three
            is now somewhere better:
              · the two COUNTS are in the tabs, where the thing they count is
                the thing you click — §4.2's resolution of the duplication
                Brandon flagged, since the tabs already had them in small type;
              · OVERDUE is a chip beside the tabs (§4.3), because overdue items
                are a SUBSET of open ones and a peer metric read as a sibling;
              · UNVIEWED is dropped, by §4.4 — the per-row dots carry it, and a
                header count of things you have not looked at is an inbox
                framing this surface is specifically not.
            SO THE HEADER CARRIES NO FIGURES AT ALL. `PageHeader`'s `metrics`
            prop is untouched and still used by other destinations; this one
            just stops passing it. §5.4 already noted the band would be
            left-weighted with the track gone — it is more so now, and measured
            in the report rather than filled with something invented. */
        /* ═══ §5.4 — THE SHIFT TRACK COMES OFF CARE REVIEWS ═══
           `0 of 16 reviews completed this shift` and its rail are gone.
           CONFIRMED SCOPE: Risk Flags loses it too ("no" to "does Risk Flags
           keep its track"), so the element is unmounted on both surfaces and
           `ShiftTrack` itself is retired rather than deleted — see
           `shift-progress.tsx`.
           THIS ALSO SUPERSEDES THE §5.2 PROPOSAL from the previous pack — the
           progress fill as the header band's bottom rule. That shipped, was
           judged to read as a browser loading bar, and fell back to a
           contained track; now the track is gone entirely and the band's
           hairline is what terminates it. The hairline stays: it is gated on
           `progress` in `PageHeader`, so with no track there is no rule —
           which is why the gate moves to a literal below.
           THE HEADER'S RIGHT SIDE IS NOW EMPTY and §5.4 says that is
           acceptable because the metric line carries more. Reported with a
           measurement rather than asserted. */
      />

      {/* ═══ THE RESPOND STRIP AND THE TAB-CARD ROW ARE BOTH GONE (arch-A) ═══
          THE RESPOND STRIP was escalations only — a persistent "respond within
          five minutes" band above the tabs, visible from every tab because an
          active escalation outranks whatever you were doing. It goes to
          Monitoring with the escalations it is about. Nothing on a billing
          surface is answerable in five minutes, so a strip here would be a
          permanent empty slot.

          THE TAB-CARD ROW had one job — moving between four domains — and there
          is one. Removing it reclaims 208px above the list (176px of cards plus
          their 32px margin), measured before the change.

          `DomainTabs` IS NOT DELETED, per the strangler rule: the file stays for
          Phase B to judge. Two things inside it needed handling first, and both
          are done rather than left dangling — `BreachChip` was exported from it
          and imported by the pane, so it moved to `chips.tsx`; `ClosedCount`'s
          pulse animation and the row's roving-tabindex keyboard nav had no other
          consumer and go dark with the row. */}

      <KindFilter
        items={surfaceItems}
        value={kindFilter}
        onChange={setKindFilter}
      />

      {/* ── MASTER-DETAIL ───────────────────────────────────────────────── */}
      <div
        id="tasks-panel"
        role="tabpanel"
        aria-labelledby={`tasks-tab-${activeDomain}`}
        tabIndex={-1}
        // THE FLEXIBLE ROW. Everything above is `shrink-0`; this is what absorbs
        // the remaining height and hands it to the two columns.
        // 40px under the header — §2, and the same value Monitoring takes.
        className="mt-10 min-h-0 flex-1"
      >
        {nothingOpen ? (
          /* THE DESTINATION'S OWN NAME WHEN THERE IS ONE, and nothing when
             there is not — never `SCOPE_TITLE`'s "Tasks" fallback. */
          <WholePageEmpty label={scope ? SCOPE_TITLE[scope] : undefined} />
        ) : (
          <div
            className={cn(
              // 50 / 50 at >=1280px. Below 1100px only ONE of the two mounts —
              // switching rather than shrinking, so neither pane is ever squeezed
              // into a width it cannot use.
              // ═══ AN EXPLICIT ROW, OR THE GRID GROWS PAST ITS OWN HEIGHT ═══
              // `h-full` alone was not enough: the grid's implicit row is
              // `auto`, and an auto track sizes to its content — so the columns
              // pushed the row taller than the frame and the SHELL scrolled
              // instead, carrying the pinned header off the top of the viewport.
              // MEASURED: the page was exactly 728px, the shell's panel reported
              // scrollHeight 1062, and the title sat at y = -237.
              // `minmax(0,1fr)` caps the row at the space available and lets it
              // shrink below its content, which is what makes the columns scroll
              // rather than the page. Same fix, same reason, as the dialog's
              // body row.
              "grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-5",
              /* ═══ AN EXPLICIT COLUMN TOO, FOR THE SAME REASON AS THE ROW ═══
                 Below the split the grid declared no columns, so its one track
                 was the implicit `auto` — and an auto track's floor is its
                 content's min-content width. A `truncate` line's min-content is
                 its WHOLE string, so the rows' captions set the list's width
                 rather than the canvas. MEASURED, supervisor at 360 with Support
                 closed: the list column rendered 412px in a 312px content box
                 and the canvas scrolled sideways by 76; Support open at 1024
                 (a 336 canvas) gave 108. `minmax(0,1fr)` hands the column the
                 canvas's width, and the rows' narrow tier (`ROW_NARROW_CANVAS` in
                 `review-row.tsx`) is what makes that width enough. */
              "grid-cols-[minmax(0,1fr)]",
              /* ═══ 50 / 50, AND IT WAS 40 / 60 — ANSWERED ═══
                 THE DEFECT IT FIXES, MEASURED. Four columns do not fit the list
                 card the 40% track left: at 1280 the card was 367px, the row
                 needed 428, and §3's shrink ladder paid the 61px out of the
                 mentee caption — 66 of the 130px "Presentation Change" needs.
                 The four widths on the table were measured before this changed
                 (list-card width → outcome): 40/60 → 367, caption truncated;
                 45/55 → 413, the cadence column at 0px; 48/52 → 440, "9…";
                 50/50 → 459, and the cadence label 38 of the 43px it wants.
                 MEASURED AFTER, at 1280: 459px of card, nothing clipped and
                 nothing truncated on the row. The deficit is gone rather than
                 moved — §3's ratios are still what would pay it, and there is
                 nothing left for them to pay.

                 ═══ AND THE PIN MOVES WITH IT, FROM 1645 TO 1943 (§0) ═══
                 §0's hard constraint is that the pane's rendered width is
                 unchanged at every viewport: the breakpoint has to be the width
                 at which the FRACTION already measures 790, or the pane jumps
                 across it. 1645 was that width for a 60% track. For a 50% track
                 it is not — MEASURED at 1645: the grid is 1302, so half of it
                 less the 20px gap is 641, and pinning 790 there would have
                 GROWN the pane by 149px on crossing, which is precisely the §0
                 violation the variant-ordering note below exists to prevent.
                 1943 IS THE CROSSOVER, AND IT WAS MEASURED RATHER THAN DERIVED:
                 at 1943 the grid is exactly 1600, so the two halves are 790 and
                 790 — the old pinned rule and the new fraction agree there to
                 the pixel. So the pane holds 790 from 1943 up, it is continuous
                 across the breakpoint, and every pixel above it still goes to
                 the list.
                 THE COST, STATED: between 1645 and 1943 the pane is narrower
                 than it used to be — at 1645, 641 rather than 790. That is the
                 trade the answer chose, and it is the same trade at every width
                 in the range: the list gets what the pane gives up. MEASURED at
                 the pane's new narrowest (459px, at 1280): no horizontal
                 overflow and nothing truncated inside it, and axe on this
                 destination came back one `target-size` BETTER than before,
                 because the wider card gave a control room.

                 ═══ AND MONITORING KEEPS 40/60 — A DIVERGENCE, STATED ═══
                 The cross-reference above sends a reader to Monitoring's grid
                 for the derivation, and that grid is now a different split with
                 its own pin at 1645. The reason the two can differ is the reason
                 they were the same: this split is a consequence of THIS
                 surface's list holding a four-column table, which Monitoring's
                 does not — its rows are conversations. So the two grids share
                 §0's rule (the pane never renders wider than it has, every new
                 pixel goes to the list) and no longer share its instance. If
                 Monitoring's list ever grows columns, this is the precedent and
                 1645 is the number to re-derive. */
              /* BOTH VARIANTS ARE ARBITRARY, AND THAT IS NOT A STYLE CHOICE.
                   MEASURED: written as `xl:` + `min-[1645px]:`, Tailwind emitted
                   the named breakpoint AFTER the arbitrary one, so at 2560 the
                   40/60 rule won and the columns came out 686/1030 — the pane
                   1030px WIDER than it had ever rendered, which is the §0
                   violation this rule exists to prevent. Still true of 1280 and
                   1943: two arbitrary variants sort by value, and 1280 < 1943. Two arbitrary `min-[]`
                   variants sort against each other by value, so the order is
                   the arithmetic rather than the emitter's category ranking.
                   1280 is `xl` spelled out; nothing below this line changed. */
                /* ═══ AND THE CANVAS (SUP-2) ═══ Each split is its viewport
                   breakpoint AND a canvas floor, because Support pushes: 1280
                   and 1943 leave a staff canvas of 1016 and 1679 (measured,
                   every staff persona is viewport − 264), and the floors sit
                   16px under that so a classic scrollbar cannot tip a closed
                   page into the takeover. Closed, nothing changes; open, the
                   split waits for the canvas it was derived against. */
                "min-[1280px]:@min-[1000px]/canvas:grid-cols-[minmax(0,50fr)_minmax(0,50fr)] min-[1943px]:@min-[1660px]/canvas:grid-cols-[minmax(0,1fr)_790px]"
            )}
          >
            {/* ── THE LIST SCROLLS ON ITS OWN, INSIDE ITSELF ──
                The scroll USED to live here, on the column. It moved into the
                Worklist's own card in Part 3, because the band headers are sticky
                and a sticky element sticks to its scrolling ancestor: with the
                scroll out here, "Imminent — 23" stuck to a box the reader could
                not see the top of, and scrolled away like an ordinary row.
                What stays here is `min-h-0` — without it this grid child refuses
                to shrink below its content and the card never gets a bounded
                height to scroll inside. */}
            <div
              className={cn(
                "flex min-h-0 flex-col gap-3",
                paneTakeover && "hidden xl:@min-[1000px]/canvas:block"
              )}
            >
              {/* THE TOOLBAR SPANS THE LIST COLUMN (§5) — filters left, View
                  right-aligned to this column's own edge. */}
              <ListToolbar
                items={decorated}
                dimensions={dimensions}
                filters={filters}
                onFilters={setFilters}
                preset={preset}
                onPreset={(p) => setViewOptions("care-reviews", { preset: p })}
                /* §4.2, confirmed: two controls on this surface. */
                showView={false}
                /* ═══ §4 — FILTERS COME OFF CARE REVIEWS ═══
                   Confirmed scope: "just care reviews for now". Risk Flags
                   keeps them, which is why this is a prop and not a deletion —
                   Risk Flags has no table and no sorting, so removing them
                   there would leave search and comparator order as the only
                   way through 123 items.
                   CARE REVIEWS LOSES NOTHING because §3 gives it column
                   sorting as its organising mechanism. */
                showFilters={false}
                /* ═══ §5.1 — ONLY ON CARE REVIEWS ═══
                   The axis is this destination's; Risk Flags has no submitted
                   set and no such distinction. */
                tabs={
                  scope === "care-reviews"
                    ? {
                        value: careTab,
                        onChange: changeCareTab,
                        count: { open: openEntries.length, closed: submitted.length },
                      }
                    : undefined
                }
                /* NEEDS-COPY-NICOLE. §6.1: one field for both names — and see
                   the adapter's note on the mentor not being drawn. */
                searchHint="Search teen or mentor"
              />
              {/* ═══ §3 — THE OVERRIDE SAYS IT IS ON, AND OFFERS THE WAY BACK ═══
                  ABOVE THE LIST RATHER THAN IN THE HEADER ROW. The three
                  columns are fixed-width and full at 1280 (§6.5 measured the
                  mentee cell down to 11px before `COL_MENTEE_MIN`), so there is
                  no room in the header for a fourth thing — and a reset inside
                  the row of sort controls would be a fourth control a reader
                  has to distinguish from the three that sort.
                  RENDERED EVEN WITH NO SORT, and it draws nothing: it is the
                  live region, and a region that appears with its own first
                  message announces nothing. See the component. */}
              {scope === "care-reviews" && (
                <CareSortNotice value={effectiveSort} onReset={() => setCareSort(null)} />
              )}
              {shown.length === 0 && filtering ? (
                /* ═══ RETIRED WITH FILTERS (§4) ═══
                   This branch was the filtered-empty state, and its rule —
                   "a supervisor must never be able to mistake 'filtered to
                   nothing' for 'nothing to review'" — is the reasoning §5.1's
                   two empty states inherit. §4 removed filters from this
                   surface, so `filtering` is permanently false and this is
                   unreachable. Kept because the rule applies again the day
                   filters return, which §4 asked to have recorded. */
                null
              ) : shown.length === 0 && scope === "care-reviews" ? (
                /* ═══ §5.1 — THE TWO EMPTIES READ DIFFERENTLY ═══
                   "No open reviews is an achievement; no submitted reviews is
                   a blank history." One shared "Nothing here" would flatten
                   those into the same sentence and teach a supervisor that an
                   empty safety queue is unremarkable.
                   `role="status"` so a switch to a tab that turns out to be
                   empty is announced rather than leaving a reader looking at a
                   blank column wondering whether it loaded. */
                <div
                  role="status"
                  data-anno-ref={`care-empty:${careTab}`}
                  className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-6 py-6"
                >
                  <p className="text-[14px] leading-[20px] text-[var(--text-primary)]">
                    {CARE_TAB_EMPTY[careTab].line}
                  </p>
                  {CARE_TAB_EMPTY[careTab].detail && (
                    <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
                      {CARE_TAB_EMPTY[careTab].detail}
                    </p>
                  )}
                </div>
              ) : (
              <Worklist
                preset={preset}
                hasGroups={entries.some((e) => e.kind === "group")}
                /* THE FILTERED SET. `applyFilters` is a `filter`, so this is a
                   subsequence of `entries` and the comparator's order is intact
                   — §6.4's "filters subset; they never reorder". */
                /* §3's ORDER. `shown` for every count, `ordered` for the
                   list — see the memo. */
                entries={ordered}
                /* ═══ §3 — THE COLUMN HEADERS BECOME CONTROLS ═══
                   Care Reviews only. Risk Flags' rows are conversations with
                   no cycle and no mentee column, and its five-step comparator
                   is the ordering a supervisor is meant to read — handing it a
                   sort would let a reader silently turn that off. */
                sort={
                  scope === "care-reviews"
                    ? {
                        value: effectiveSort,
                        onToggle: (c: CareSortColumn) =>
                          setCareSort((cur) => nextSort(cur, c)),
                      }
                    : undefined
                }
                /* ═══ §5.2 — ONLY WHERE THE STATE EXISTS ═══
                   Care Reviews tracks viewing; Risk Flags does not, and passing
                   the set there would mark 123 rows unviewed against a trace
                   nothing writes to. Undefined on the Submitted tab too: a
                   submitted review has been read by definition, and a marker
                   saying otherwise on a decision already made would be the list
                   contradicting itself. */
                viewed={
                  scope === "care-reviews" && careTab === "open" ? viewed : undefined
                }
                /* ═══ §8 — OPEN TAB ONLY ═══
                   A submitted review's draft was consumed by the submission;
                   `clearReviewDraft` runs on commit, so the set would be empty
                   there anyway — passing it would be asserting a state that
                   cannot exist rather than one that happens to be absent. */
                drafted={
                  scope === "care-reviews" && careTab === "open" ? drafted : undefined
                }
                items={domainItems}
                domain={activeDomain}
                now={now}
                selectedId={selectedEntryId ?? activeEntry?.id ?? null}
                state={listState}
                onSelect={(entry, item) => {
                  setSelectedEntryId(entry.id);
                  setPickedId(item.id);
                  // AND HAND THE PANE THE SCREEN. Below `xl` the grid collapses
                  // into a takeover — the list and the pane are mutually
                  // exclusive — so a select that only moved the selection left a
                  // narrow-viewport reader tapping rows and watching nothing
                  // happen: the row highlighted, and the pane it selected was
                  // `display:none`. At `xl` and up both are visible and this is
                  // a no-op, which is why it went unnoticed on a desktop.
                  setPaneTakeover(true);
                }}
                /* ═══ GROUPED BY WHEN, NOT BY WHAT (arch-E) ═══
                 The type groups — "Monthly re-review — 7" then "Intake — 8" —
                 took the verb off the row AND restarted the countdown at every
                 header, so scanning for what was about to breach meant merging
                 two sorted lists by eye on the surface whose whole job is
                 deadline awareness. Monitoring keeps its tier bands: there the
                 tier IS the kind of work, and its rows are person-forward.
                 ═══ AND NOW IT GROUPS BY NOTHING (addendum §2.9) ═══
                 The deadline buckets went with the deadline concept. What is
                 left is one task type with no clock, which is nothing to group
                 by — so the list is flat, in the comparator's order, which
                 without an SLA is oldest-first. `AGENTS.md`'s "Tasks groups by
                 when" section is rewritten to say so. */
                /* ═══ FLAT ON BOTH TABS ═══
                   Closed briefly grouped by day (`Today — 2`, …); that was an
                   addition the pack withdrew. It is one list, most recently
                   closed first, and each row's `Review date` carries the day. */
                grouping="none"
                /* THE LIST'S OWN NAME, for the unlabelled band's accessible
                   name — `DOMAIN_LABEL` would say "Billing", which is the word
                   this destination was renamed away from. */
                subject={scope ? SCOPE_TITLE[scope] : undefined}
                rowVariant="task"
                /* ═══ THE CLOSED TAB'S RECORDS (Closed-tab pack §1/§3) ═══
                   Present only on Closed: the rows switch to the outcome line
                   and the Closed column, and the header with them. */
                closed={careTab === "closed" ? { byId: closedById } : undefined}
                assigneeFor={scope === "care-reviews" ? assigneeFor : undefined}
                resolvingIds={resolvingIds}
                focusBand={asTaskType(focusBand)}
              onRetry={() =>
                  setListStates((prev) => ({ ...prev, [activeDomain]: "ready" }))
                }
              />
              )}
            </div>
            {/* ── THE PANE SCROLLS ON ITS OWN ──
                Its footer is sticky at the pane's own bottom edge — see
                `TaskPane`. The takeover below `xl` keeps the same behaviour,
                because the pane is the same component either way. */}
            <div
              className={cn(
                /* ═══ TWO SITUATIONS, TWO LAYOUTS ═══
                   Below `xl` the takeover puts a "Back to list" button ABOVE the
                   pane, so this is a FLEX COLUMN and the pane takes the remaining
                   height. At `xl` that button is `xl:hidden` and nothing sits
                   above the pane, so this is a plain BLOCK and the pane is simply
                   `h-full`.
                   One layout for both was tried twice and does not exist:
                   `h-full` everywhere overflowed below `xl` by exactly the
                   button's height (measured 20px at 1024×800 — small enough to
                   read as rounding, and not), and `flex-1` everywhere overflowed
                   at DESKTOP by 234px. The cases genuinely differ. */
                "flex min-h-0 flex-col xl:@min-[1000px]/canvas:block",
                !paneTakeover && "hidden xl:@min-[1000px]/canvas:block"
                // `Full width`: no pane at all until a row is picked.
              )}
            >
              {paneTakeover && (
                <button
                  type="button"
                  onClick={() => setPaneTakeover(false)}
                  className={cn(
                    // `shrink-0 self-start`: a control, not a row — in a flex
                    // column a stretched button would span the width.
                    "mb-2 inline-flex min-h-9 shrink-0 self-start items-center gap-1 rounded-full px-2 text-[13px] font-semibold",
                    "xl:@min-[1000px]/canvas:hidden",
                    "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                    RING
                  )}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  {/* TODO-COPY */}
                  Back to list
                </button>
              )}
              {surfaceComplete ? (
                /* ═══ COMPLETION, WITHOUT A NEXT DOMAIN ═══
                   `TabComplete` offered "you cleared Billing — go to Risk
                   flags", which was the surface's whole reward loop when it held
                   four queues. There is no next tab now, so it renders the
                   cleared state alone and `nextDomainAfter` loses its only
                   caller here. Phase C's Home is where a supervisor is sent
                   next; sending them there from this card would be a cross-
                   surface CTA built before the surface exists. */
                /* NO DOMAIN — the claim is about the surface. See
                   `surfaceComplete`. */
                <TabComplete />
              ) : (
                <div
                  ref={paneRef}
                  tabIndex={-1}
                  // POLITE, and on the pane itself so an auto-advance announces
                  // the item that arrived rather than the whole page re-reading.
                  aria-live="polite"
                  // ═══ THE HEIGHT CHAIN RUNS THROUGH HERE (Part 1.2) ═══
                  // This wrapper exists for the focus ring and the live region,
                  // and it was the break in the chain: content-sized at 854px in
                  // a 728px frame, so the pane's own `h-full` resolved against
                  // IT and inherited the overflow. Measured — the shallowest
                  // element past the frame's bottom edge, by 334px, which is
                  // exactly what the shell was scrolling.
                  // A wrapper that only decorates still has to pass the height
                  // through.
                  // `flex-1` below `xl` (the height left beside the back button);
                  // `h-full` at `xl` (the whole column). See the column's note.
                  className="min-h-0 flex-1 rounded-[var(--radius-elevated)] xl:@min-[1000px]/canvas:h-full xl:@min-[1000px]/canvas:flex-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
                >
                  {/* PANE AND EXCERPT ARE SEPARATE AXES (Part 4). Under partial
                      failure the excerpt errors while the pane stays healthy, so
                      an excerpt failure is demonstrably not a pane failure and
                      never blocks the resolve actions. */}
                  {plan.pane === "error" ? (
                    <PaneError domain={selected?.domain ?? activeDomain} />
                  ) : plan.pane === "loading" ? (
                    <PaneSkeleton />
                  ) : (
                    <TaskPane
                      item={selected}
                      now={now}
                      onResolve={onResolve}
                      actionsRef={paneActions}
                      excerptState={plan.excerpt}
                      /* ═══ READ-ONLY WHEN THE SELECTION IS A CLOSED REVIEW ═══
                         (Closed-tab pack §0.2.) It was gated on `Completed
                         today` alone, so a row picked on the Closed tab got the
                         live form — `Save draft`, `Submit`, `3 fields needed` —
                         over a review already on the record. The record is
                         looked up by the selection's id on that tab only. */
                      closed={
                        careTab === "closed" && selected
                          ? (closedById.get(selected.id) ?? null)
                          : null
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* The announcement text lives OUTSIDE the pane's own markup so a
          re-render of the pane cannot swallow it. */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <ShortcutSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* ═══ THE PINNED SCENARIO PANEL WAS HERE ═══
          Both of its axes moved into the dev bar (gap row 311): the scenario to
          the Scenario select's "Tasks" group, backed by store v42, and the
          per-domain list state to the Load control, applied to the active tab by
          the effect above. Nothing is lost and the control is now reachable on a
          phone, where the fixed bottom nav used to intercept every tap on it. */}
    </div>
  );
}

// ── Placeholders (T3 / T4 replace these) ────────────────────────────────────

/** WHOLE-PAGE EMPTY (§4). Meg's pattern kept: the line, the reassurance, and a
 *  redirect to ongoing chats — the useful next thing when there is no work. */
/* ═══ UNREACHABLE TODAY, AND THE COPY IS FIXED ANYWAY ═══
   `nothingOpen` gained `&& scope !== "care-reviews"` when §9 gave Care Reviews
   its own two empty states — and `TasksScope` has exactly ONE member, so that
   guard is never satisfied and this never renders.
   I DESCRIBED THIS AS "Risk Flags' branch only" IN THE §11 REPORT AND THAT WAS
   WRONG: Risk Flags is `MonitoringPage` under `scope="risk-flags"` and does not
   mount `TasksPage` at all. Its own zero states live in `monitoring-page.tsx`,
   are already `NEEDS-COPY-NICOLE`, and say "conversations".
   SO WHY FIX THE WORDS OF DEAD CODE. Because all three defects below are
   RULE violations rather than taste, and an unmounted component holding them is
   a landmine: the day a second scope exists this ships as-is. The strangler rule
   keeps the component; it does not license keeping banned vocabulary in it. */
function WholePageEmpty({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="font-display text-[20px] font-bold leading-[28px] text-[var(--text-primary)]">
        {/* NEEDS-COPY-NICOLE: Nothing is waiting in {label}
            IT WAS "No open tasks". "Tasks" is the destination name the addendum
            RETIRED — `/app/tasks` is a dead hop and the surface is Care Reviews —
            so the heading named a place that no longer exists.
            IT NAMES THE DESTINATION IT IS ON, which is what the `label` prop is
            for: a whole-page empty that cannot say which page it is on is the
            same imprecision, one level up.
            AND THE PROP IS OPTIONAL FOR A MEASURED REASON. `nothingOpen` can
            only be true when `scope` is ABSENT — see the note on the function —
            and the unscoped branch of `SCOPE_TITLE` falls back to the string
            "Tasks", the very noun this heading had to stop using. Taking the
            label unconditionally would have piped the retired name straight
            back in. With no scope there is no destination to name, so it says
            neither. */}
        {label ? `Nothing is waiting in ${label}` : "Nothing is waiting"}
      </h2>
      <p className="max-w-sm text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {/* NEEDS-COPY-NICOLE. Calm, not congratulatory — that part of the old
            note was right and is kept: an empty queue is the resting state of
            this work rather than an achievement, which is the same rule
            `CARE_TAB_EMPTY` and Today's all-clear subtitle both follow.
            ═══ IT WAS "Every queue is clear." AND THAT WAS FALSE ═══
            MEASURED on §9's `care-open-empty` fixture: it rendered while three
            risk flags were open. The gate is `counts.open === 0` over THIS
            surface's domains only, so the sentence asserted something about
            every queue from a page that counts one of them. A reader who
            believed it would have stopped looking.
            SO IT SPEAKS ONLY FOR THE LIST IT IS IN, which is all this component
            can honestly know. */}
        This list is empty right now. New items appear here as they arrive.
      </p>
      <Link
        href="/app/chat"
        className={cn(
          "mt-1 inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 text-[13px] font-semibold text-[var(--text-primary)]",
          "transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {/* NEEDS-COPY-NICOLE: Open Chat
            ═══ IT WAS "Go to ongoing chats" — PROHIBITED VOCABULARY ═══
            A third defect in this component, and one I had not flagged. The
            banned list covers "all messaging/conversation synonyms including
            'chat'/'chats'", and "ongoing chats" is exactly that: a plural noun
            standing in for conversations.
            THE DESTINATION'S NAME IS NOT THE BAN. §2.2 renamed Coverage to
            Chat, so `Chat` as a proper noun naming where the link goes is
            correct — the same construction the schedule rail uses
            (`Open {LABEL[destination]}`). What the rule forbids is using it
            for the THINGS, which the old string did.
            THE NAV SAYS "Chats" (plural) against the approved singular, which
            is already an open item for Nicole and is not resolved here. */}
        Open Chat
      </Link>
    </div>
  );
}

export { TASK_DOMAINS };
