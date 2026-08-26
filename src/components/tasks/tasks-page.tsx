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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { useMounted } from "@/lib/use-mounted";
import { DomainCards } from "@/components/tasks/domain-cards";
import { NextUpStrip, RespondStrip } from "@/components/tasks/strips";
import { TaskScenarioSwitcher } from "@/components/tasks/scenario-switcher";
import { Worklist, type ListState } from "@/components/tasks/worklist";
import { TaskPane } from "@/components/tasks/task-pane";
import { TabComplete } from "@/components/tasks/completion";
import { UNDO_WINDOW_MS, resolveWithUndo, type ResolveHandle } from "@/lib/tasks/resolve";
import { listEntriesFor, itemsOf, paneItemFor, type ListEntry } from "@/lib/tasks/list";
import {
  closedToday,
  defaultActiveDomain,
  domainSummaries,
  headerCounts,
  nextUp,
  openEscalations,
  preselectedFor,
} from "@/lib/tasks/sort";
import { DEFAULT_TASK_SCENARIO_ID, tasksScenario } from "@/lib/tasks/seed";
import {
  ACTIVITY_DOMAIN_OF,
  DOMAIN_LABEL,
  TASK_DOMAINS,
  type TaskDomain,
  type TaskItem,
} from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY. Header counters' domain labels — shorter than the tab labels
 *  because they sit in a dense row, and COUNT-AWARE: the first pass rendered
 *  "1 escalations", which is the kind of thing that makes a careful surface look
 *  careless. "billing" is a mass noun and does not inflect. */
function closedLabel(domain: TaskDomain, n: number): string {
  if (domain === "billing") return "billing";
  const singular = domain === "escalation" ? "escalation" : "flag";
  return n === 1 ? singular : `${singular}s`;
}

/** THE ACTIVITY DEEP LINK for a "Closed today" counter (§1): Activity filtered to
 *  scope=mine, matching domain, today.
 *
 *  ROUTES THROUGH `ACTIVITY_DOMAIN_OF` because the two surfaces' domain names are
 *  not the same set — see design-system-gaps.md row 208. Passing a Tasks domain
 *  string straight through would silently match nothing.
 *
 *  The Activity route DOES exist (built in the A-series), so this is a real link
 *  rather than the stub §1 allows for. */
function closedTodayHref(domain: TaskDomain): string {
  return `/app/activity?scope=mine&domain=${ACTIVITY_DOMAIN_OF[domain]}&range=today`;
}

/** Open count for a domain, for the completion CTA's "(6)". Counts ITEMS, matching
 *  the summary cards — see the T3 note on why the card counts tasks rather than
 *  rows. */
function listForDomainCount(items: TaskItem[], domain: TaskDomain, now: number): number {
  void now;
  return items.filter((i) => i.domain === domain && i.status !== "resolved").length;
}

export function TasksPage() {
  const mounted = useMounted();
  const [scenarioId, setScenarioId] = useState(DEFAULT_TASK_SCENARIO_ID);
  /** Fixed at mount. `Date.now()` in render scope is impure — react-hooks/purity
   *  rejects it — and every elapsed figure and breach state on the page would move
   *  on an unrelated re-render. */
  const [now] = useState(() => Date.now());

  /** RESOLVED IDS + PAYLOAD OVERRIDES. Resolving marks the id; the override map
   *  carries what the pane decided (`flaggedCorrectly`, the confirmed code) onto
   *  the item, which is where §5 says the open feedback question is parked until
   *  it is answered (§8.3). */
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [detailById, setDetailById] = useState<Record<string, Record<string, unknown>>>({});

  const items = useMemo(() => {
    if (!mounted) return [];
    return tasksScenario(scenarioId, now).map((i) => {
      const detail = detailById[i.id];
      const base = detail
        ? { ...i, payload: { ...i.payload, ...detail } as typeof i.payload }
        : i;
      return resolvedIds.has(i.id)
        ? { ...base, status: "resolved" as const, resolvedAt: now }
        : base;
    });
  }, [mounted, scenarioId, now, resolvedIds, detailById]);

  const summaries = useMemo(() => domainSummaries(items, now), [items, now]);
  const head = useMemo(() => nextUp(items, now), [items, now]);
  const escalations = useMemo(() => openEscalations(items, now), [items, now]);
  const counts = useMemo(() => headerCounts(items, now), [items, now]);
  const closed = useMemo(() => closedToday(items, now), [items, now]);

  /** DEFAULT ACTIVE TAB = the Next-up item's domain (§3). Null means "not chosen
   *  yet", so the derived default applies; once the reader picks a tab their
   *  choice wins and does not get overwritten when the data changes. */
  const [pickedDomain, setPickedDomain] = useState<TaskDomain | null>(null);
  const activeDomain = pickedDomain ?? defaultActiveDomain(items, now);

  /** THE TAB'S ENTRIES — the sorted domain list with flags coalesced (§4). */
  const entries = useMemo(
    () => listEntriesFor(items, activeDomain, now),
    [items, activeDomain, now]
  );

  /** PER-DOMAIN LIST STATE (§4). Keyed by domain so an error in one tab leaves
   *  the other three alone — that is the requirement, and a single page-level
   *  state could not express it. */
  const [listStates, setListStates] = useState<Partial<Record<TaskDomain, ListState>>>({});
  const listState: ListState = listStates[activeDomain] ?? "ready";

  /** SELECTION. `selectedEntryId` is the ENTRY id — a group id for a collapsed
   *  group — while `selected` is the ITEM the pane shows. Two ids because
   *  selecting a group selects its highest-priority child in the pane (§4), so
   *  the row that is highlighted and the item being reviewed are not the same
   *  object. */
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const activeEntry: ListEntry | null =
    entries.find((e) => e.id === selectedEntryId) ?? entries[0] ?? null;
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

  /** THE LIVE UNDO. One at a time — a second resolve flushes the first, because
   *  two open windows would mean two toasts and an ambiguous `u` key. */
  const pending = useRef<ResolveHandle | null>(null);
  /** Set when a tab's last item was just resolved, so the pane can show the
   *  completion state instead of an empty frame. */
  const [completedDomain, setCompletedDomain] = useState<TaskDomain | null>(null);

  /** BOUNDARY EMIT (§6). Unmount and page-hide both count as "the session ended
   *  before the window closed", so the pending event is written rather than lost.
   *  This is the other half of the timing rule and it is easy to forget — without
   *  it, closing the tab five seconds after a resolve silently discards it. */
  useEffect(() => {
    const flush = () => pending.current?.flush();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const selectDomain = (d: TaskDomain) => {
    setPickedDomain(d);
    // A new tab means a new pre-selection — dropping both ids lets the derived
    // head apply rather than stranding a selection from another domain.
    setPickedId(null);
    setSelectedEntryId(null);
  };

  const openItem = (item: TaskItem) => {
    setPickedDomain(item.domain);
    setPickedId(item.id);
    // The Next-up CTA jumps across tabs, so the entry that owns the item may not
    // be in the current entry list yet. Clearing the entry id lets the derived
    // head apply on the new tab and the picked id then narrows to the item.
    setSelectedEntryId(null);
    setPaneTakeover(true);
  };

  const nothingOpen = mounted && counts.open === 0;

  /** THE NEXT DOMAIN PER THE GLOBAL SORT, for the completion CTA (§5). Reads
   *  `nextUp` over the whole remaining open set rather than picking the biggest
   *  queue — same comparator as everything else (locked decision 8). */
  const nextDomainAfter = useCallback(
    (excluding: TaskDomain, current: TaskItem[]): { domain: TaskDomain; count: number } | null => {
      const head = nextUp(
        current.filter((i) => i.domain !== excluding),
        now
      );
      if (!head) return null;
      return {
        domain: head.domain,
        count: listForDomainCount(current, head.domain, now),
      };
    },
    [now]
  );

  /** RESOLVE (§5 + §6).
   *
   *  Order matters and it is the order below: mark resolved → advance selection →
   *  start the undo window → toast. The event is NOT written here; `resolveWithUndo`
   *  owns that and writes it when the window closes (§6). Nothing in this component
   *  appends to the ledger. */
  const onResolve = (item: TaskItem, detail: Record<string, unknown>) => {
    // ONE PENDING RESOLVE AT A TIME. A second resolve flushes the first, because
    // two live windows means two toasts and an ambiguous undo.
    pending.current?.flush();

    // WHERE SELECTION GOES: the next entry in sort order within this tab, computed
    // BEFORE the item leaves the list.
    const remaining = entries.filter((e) => !itemsOf(e).every((i) => i.id === item.id));
    const idx = entries.findIndex((e) => itemsOf(e).some((i) => i.id === item.id));
    const nextEntry = remaining[Math.min(idx, remaining.length - 1)] ?? null;

    const afterResolve = items.map((i) =>
      i.id === item.id ? { ...i, status: "resolved" as const } : i
    );
    const tabEmptied =
      afterResolve.filter((i) => i.domain === item.domain && i.status !== "resolved")
        .length === 0;

    setDetailById((prev) => ({ ...prev, [item.id]: detail }));
    setResolvedIds((prev) => new Set(prev).add(item.id));

    if (tabEmptied) {
      setCompletedDomain(item.domain);
      setSelectedEntryId(null);
      setPickedId(null);
    } else if (nextEntry) {
      setSelectedEntryId(nextEntry.id);
      setPickedId(paneItemFor(nextEntry).id);
    }

    const handle = resolveWithUndo({
      item,
      decidedAt: Date.now(),
      detail,
      onCommitted: () => {
        if (pending.current === handle) pending.current = null;
      },
      onUndone: ({ alreadyCommitted }) => {
        if (pending.current === handle) pending.current = null;
        setResolvedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        setCompletedDomain(null);
        setPickedDomain(item.domain);
        setSelectedEntryId(null);
        setPickedId(item.id);
        if (alreadyCommitted) {
          // HONEST ABOUT THE LEDGER. §6: an event, once written, is never
          // retracted. The row comes back; the record already shows the close.
          /* TODO-COPY */
          toast("Restored. The activity record still shows the close.");
        }
      },
    });
    pending.current = handle;

    /* TODO-COPY. "Flag closed — Undo", 6s (§5). The verb matches the domain so a
       reader who resolves several in a row can tell which one the toast is
       about. */
    const noun =
      item.domain === "billing" ? "Billing review completed" : "Flag closed";
    toast(noun, {
      duration: UNDO_WINDOW_MS,
      action: { label: "Undo", onClick: () => handle.undo() },
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-6 lg:px-8">
      {/* ── HEADER (§1) ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
            {/* TODO-COPY */}
            Tasks
          </h1>
          <p className="mt-0.5 text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {/* TODO-COPY. "20 open · 4 overdue" — and the overdue clause is
                omitted entirely at zero rather than reading "0 overdue", which is
                a number nobody needs to see. */}
            {counts.open === 0
              ? "Nothing open"
              : counts.overdue > 0
                ? `${counts.open} open · ${counts.overdue} overdue`
                : `${counts.open} open`}
          </p>
        </div>

        {/* CLOSED TODAY, per domain, deep-linking into Activity. Renders nothing
            when nothing closed — a row of zeroes is chrome. */}
        {Object.keys(closed).length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {/* TODO-COPY */}
              Closed today
            </span>
            {(Object.entries(closed) as Array<[TaskDomain, number]>).map(
              ([domain, n]) => (
                <Link
                  key={domain}
                  href={closedTodayHref(domain)}
                  className={cn(
                    "rounded-sm text-[13px] leading-[18px] text-[var(--text-secondary)]",
                    "underline decoration-transparent underline-offset-2 transition-colors",
                    "hover:text-[var(--text-primary)] hover:decoration-[color:var(--text-primary)]",
                    RING
                  )}
                >
                  <span className="tabular-nums">{n}</span>{" "}
                  {closedLabel(domain, n)}
                </Link>
              )
            )}
          </div>
        )}
      </div>

      {/* ── RESPOND STRIP (§3.2). Above the tabs, visible from every tab. ── */}
      {escalations.length > 0 && (
        <div className="mt-4">
          <RespondStrip escalations={escalations} now={now} />
        </div>
      )}

      {/* ── NEXT-UP STRIP (§3.1). Below the header, above the tabs. ─────── */}
      {head && (
        <div className="mt-3">
          <NextUpStrip
            item={head}
            now={now}
            isCurrent={selected?.id === head.id}
            onOpen={openItem}
          />
        </div>
      )}

      {/* ── TABS / SUMMARY CARDS (§3.3) ─────────────────────────────────── */}
      <div className="mt-4">
        <DomainCards
          summaries={summaries}
          active={activeDomain}
          onSelect={selectDomain}
        />
      </div>

      {/* ── MASTER-DETAIL ───────────────────────────────────────────────── */}
      <div
        id="tasks-panel"
        role="tabpanel"
        aria-labelledby={`tasks-tab-${activeDomain}`}
        tabIndex={-1}
        className="mt-5"
      >
        {nothingOpen ? (
          <WholePageEmpty />
        ) : (
          <div
            className={cn(
              // 40 / 60 at >=1280px. Below 1100px only ONE of the two mounts —
              // switching rather than shrinking, so neither pane is ever squeezed
              // into a width it cannot use.
              "grid gap-5",
              "xl:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]"
            )}
          >
            <div className={cn(paneTakeover && "hidden xl:block")}>
              <Worklist
                entries={entries}
                domain={activeDomain}
                now={now}
                selectedId={selectedEntryId ?? activeEntry?.id ?? null}
                state={listState}
                onSelect={(entry, item) => {
                  setSelectedEntryId(entry.id);
                  setPickedId(item.id);
                }}
                onRetry={() =>
                  setListStates((prev) => ({ ...prev, [activeDomain]: "ready" }))
                }
              />
            </div>
            <div className={cn(!paneTakeover && "hidden xl:block")}>
              {paneTakeover && (
                <button
                  type="button"
                  onClick={() => setPaneTakeover(false)}
                  className={cn(
                    "mb-2 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[13px] font-semibold xl:hidden",
                    "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                    RING
                  )}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  {/* TODO-COPY */}
                  Back to list
                </button>
              )}
              {completedDomain === activeDomain ? (
                <TabComplete
                  domain={activeDomain}
                  next={nextDomainAfter(activeDomain, items)}
                  onGoNext={(d) => {
                    setCompletedDomain(null);
                    selectDomain(d);
                  }}
                />
              ) : (
                <TaskPane item={selected} now={now} onResolve={onResolve} />
              )}
            </div>
          </div>
        )}
      </div>

      <TaskScenarioSwitcher
        activeId={scenarioId}
        onSelect={(id) => {
          setScenarioId(id);
          setPickedDomain(null);
          setSelectedEntryId(null);
          setPickedId(null);
          setListStates({});
        }}
        listState={listState}
        onListState={(st) =>
          // APPLIED TO THE ACTIVE DOMAIN ONLY, which is how "other tabs
          // unaffected" becomes demonstrable rather than merely claimed.
          setListStates((prev) => ({ ...prev, [activeDomain]: st }))
        }
        activeDomainLabel={DOMAIN_LABEL[activeDomain]}
      />
    </div>
  );
}

// ── Placeholders (T3 / T4 replace these) ────────────────────────────────────

/** WHOLE-PAGE EMPTY (§4). Meg's pattern kept: the line, the reassurance, and a
 *  redirect to ongoing chats — the useful next thing when there is no work. */
function WholePageEmpty() {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="font-display text-[20px] font-bold leading-[28px] text-[var(--text-primary)]">
        {/* TODO-COPY */}
        No open tasks
      </h2>
      <p className="max-w-sm text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {/* TODO-COPY. Calm, not congratulatory. */}
        Every queue is clear.
      </p>
      <Link
        href="/app/chat"
        className={cn(
          "mt-1 inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 text-[13px] font-semibold text-[var(--text-primary)]",
          "transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {/* TODO-COPY */}
        Go to ongoing chats
      </Link>
    </div>
  );
}

export { TASK_DOMAINS };
