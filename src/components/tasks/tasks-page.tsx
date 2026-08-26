"use client";

// THE TASKS WORKLIST — shell. Phase T2.
//
// SINGLE SURFACE, MASTER-DETAIL (locked decision 2). Summary cards act as tabs;
// list left, persistent detail pane right. NO DRAWER. The pane is always populated
// when the active tab has items — which is why the pre-selected item is derived
// from the sort rather than left null until someone clicks.
//
// T2 SCOPE: route, header, both strips, the four cards, and PLACEHOLDERS for the
// list and pane. T3 fills the list, T4 the pane. The placeholders are here rather
// than deferred because the layout's proportions are part of what this phase is
// being reviewed for, and a shell reviewed without them reviews differently.
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
import {
  closedToday,
  defaultActiveDomain,
  domainSummaries,
  headerCounts,
  listForDomain,
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

  const list = useMemo(
    () => listForDomain(items, activeDomain, now),
    [items, activeDomain, now]
  );

  /** PRE-SELECTED PANE ITEM = head of the active tab's list (§3). Same
   *  not-chosen-yet pattern; T3 makes this keyboard-navigable. */
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selected: TaskItem | null =
    list.find((i) => i.id === pickedId) ?? preselectedFor(items, activeDomain, now);

  /** Below 1100px the pane is a takeover, so it needs a way back to the list. */
  const [paneTakeover, setPaneTakeover] = useState(false);

  const selectDomain = (d: TaskDomain) => {
    setPickedDomain(d);
    // A new tab means a new pre-selection — dropping the picked id lets the
    // derived head apply rather than stranding a selection from another domain.
    setPickedId(null);
  };

  const openItem = (item: TaskItem) => {
    setPickedDomain(item.domain);
    setPickedId(item.id);
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
              <ListPlaceholder
                domain={activeDomain}
                count={list.length}
                selectedId={selected?.id ?? null}
                items={list}
                onSelect={(item) => {
                  setPickedId(item.id);
                  setPaneTakeover(true);
                }}
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

      <TaskScenarioSwitcher activeId={scenarioId} onSelect={setScenarioId} />
    </div>
  );
}

// ── Placeholders (T3 / T4 replace these) ────────────────────────────────────

/** T2 PLACEHOLDER. Rows are the minimum that lets the shell be judged — teen,
 *  mentor, age — and deliberately NOT the full anatomy from §4: no coalescing, no
 *  differentiator chips, no keyboard navigation. T3 owns those.
 *
 *  NO MESSAGE SNIPPETS (locked decision 12), here or ever. */
function ListPlaceholder({
  domain,
  count,
  items,
  selectedId,
  onSelect,
}: {
  domain: TaskDomain;
  count: number;
  items: TaskItem[];
  selectedId: string | null;
  onSelect: (item: TaskItem) => void;
}) {
  if (count === 0) return <EmptyTab domain={domain} />;
  return (
    <ul className="overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            aria-current={item.id === selectedId ? "true" : undefined}
            className={cn(
              "flex w-full items-center gap-3 border-t border-[color:var(--border-subtle)] px-4 py-3 text-left transition-colors first:border-t-0",
              item.id === selectedId
                ? "bg-[var(--surface-s2)]"
                : "hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-s2)] text-[12px] font-semibold text-[var(--text-secondary)]"
            >
              {item.teenDisplayName.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] leading-[20px] text-[var(--text-primary)]">
                {item.teenDisplayName}
              </span>
              <span className="block truncate text-[12px] leading-[16px] text-[var(--text-muted)]">
                {/* TODO-COPY */}
                to {item.mentorName}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** T2 PLACEHOLDER for the pane. §5's frame arrives in T4. */
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

/** TODO-COPY. Per-domain empty copy (§4). THE MONITORING EMPTY STATE MUST NOT
 *  CELEBRATE — no "Nice work", no exclamation. An empty monitoring queue means
 *  nobody has written anything worth reading, which is neither good nor bad. */
function EmptyTab({ domain }: { domain: TaskDomain }) {
  const copy: Record<TaskDomain, string> = {
    escalation: "No active escalations.",
    riskFlag: "No open flags.",
    billing: "No billing reviews open.",
    monitoring: "Nothing to monitor right now.",
  };
  return (
    <div className="flex min-h-[30vh] items-center justify-center rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-6">
      <p className="text-center text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {copy[domain]}
      </p>
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
