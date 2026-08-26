"use client";

// THE TASKS WORKLIST — shell. Phase T2.
//
// SINGLE SURFACE, MASTER-DETAIL (locked decision 2). Summary cards act as tabs;
// list left, persistent detail pane right. NO DRAWER. The pane is always populated
// when the active tab has items — which is why the pre-selected item is derived
// from the sort rather than left null until someone clicks.
//
// T3 SCOPE: the list is real (rows, coalesced groups, keyboard selection, states).
// The PANE is still a placeholder — T4 owns §5's frame, the mitigation bodies and
// resolveWithUndo.
//
// LAYOUT (§1): list ~40% / pane ~60% at ≥1280px. Below 1100px the pane becomes a
// full-width takeover with a back affordance. Mobile is not a v1 target, but this
// is deliberately not a layout that CAN NEVER collapse — the breakpoint switches
// which of the two panes is mounted rather than trying to shrink both.
//
// STORE READS ARE GATED BEHIND useMounted (standing Next-16 rule): these failures
// produce zero console errors, so the gate is the only thing between a persisted
// scenario id and a hydration mismatch.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useMounted } from "@/lib/use-mounted";
import { DomainCards } from "@/components/tasks/domain-cards";
import { NextUpStrip, RespondStrip } from "@/components/tasks/strips";
import { TaskScenarioSwitcher } from "@/components/tasks/scenario-switcher";
import { Worklist, type ListState } from "@/components/tasks/worklist";
import { listEntriesFor, paneItemFor, type ListEntry } from "@/lib/tasks/list";
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

export function TasksPage() {
  const mounted = useMounted();
  const [scenarioId, setScenarioId] = useState(DEFAULT_TASK_SCENARIO_ID);
  /** Fixed at mount. `Date.now()` in render scope is impure — react-hooks/purity
   *  rejects it — and every elapsed figure and breach state on the page would move
   *  on an unrelated re-render. */
  const [now] = useState(() => Date.now());

  const items = useMemo(
    () => (mounted ? tasksScenario(scenarioId, now) : []),
    [mounted, scenarioId, now]
  );

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
              <PanePlaceholder item={selected} />
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

/** T3 PLACEHOLDER for the pane. §5's frame arrives in T4. */
function PanePlaceholder({ item }: { item: TaskItem | null }) {
  return (
    <div className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-5">
      {item ? (
        <>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            {DOMAIN_LABEL[item.domain]}
          </p>
          <h2 className="mt-1 font-display text-[18px] font-bold leading-[26px] text-[var(--text-primary)]">
            {item.teenDisplayName}
          </h2>
          <p className="mt-2 text-[13px] leading-[18px] text-[var(--text-secondary)]">
            {/* TODO-COPY. Honest about being unbuilt rather than mocking up a
                pane that T4 will replace — a fake pane reviews as a real one. */}
            The review panel for this task arrives in the next phase.
          </p>
        </>
      ) : (
        <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
          {/* TODO-COPY */}
          Select a task to review it.
        </p>
      )}
    </div>
  );
}

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
