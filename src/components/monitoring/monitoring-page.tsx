"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — the clinical vigilance surface. Supervisor tier only.
//
// ═══ IT IS COVERAGE-MEASURED, AND EVERY DECISION HERE FOLLOWS FROM THAT ═══
//
// Tasks empties. This does not, and must not be built as though it might. Flags
// arrive continuously, the routine tier has a seven-day SLA, and "finished
// Monitoring" would only ever mean finished for the minute. Measured on the
// shipped fixtures: 43 open flags on a typical shift, 123 on a heavy one.
//
// Three things follow, and they are the three ways this page differs from Tasks
// rather than three preferences:
//
//   · THE SUBTITLE LEADS WITH WHAT IS OWED, not with what is open. An open count
//     on a surface that never empties is a number a reader learns to skip.
//   · THE BADGE COUNTS THE SAME DEBT — see `monitoringObligations` for why an
//     open count would be ignored inside a week.
//   · THERE IS NO COMPLETION STATE. No "you cleared it" card, no next-surface
//     CTA. Clearing the list here means the flags happen to be worked right now,
//     which is a fact and not an achievement — the same reasoning the routine
//     tier's empty line already carries in `worklist.tsx`.
//
// ═══ NO TAB-CARD ROW, AND THAT IS STRUCTURAL ═══
//
// Monitoring is ONE conceptual surface. Its tiers are groups inside one list,
// not four destinations — so a reader moves through them by scrolling a sorted
// list rather than by choosing which queue to be in. That is the difference from
// the old four-tab Tasks page, and it is deliberate: a tab row asks "which kind
// of risk do you want to look at", and the answer on a vigilance surface is
// always "the most urgent one", which the comparator already knows.
//
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { ShortcutSheet, useTaskShortcuts } from "@/components/tasks/shortcuts";
import { TaskPane, type PaneActions } from "@/components/tasks/task-pane";
import { Worklist, type ListState } from "@/components/tasks/worklist";
import { useResolveUndo } from "@/components/tasks/resolve-undo";
import { elapsedLabel } from "@/components/tasks/strips";
import { EscalationRegion } from "@/components/monitoring/escalation-region";
import { itemsOf, paneItemFor } from "@/lib/tasks/list";
import { isEscalationTask } from "@/lib/tasks/escalation-state";
import { sortedOpen } from "@/lib/tasks/sort";
import { monitoringEntriesFor } from "@/lib/tasks/monitoring-list";
import { monitoringObligations } from "@/lib/tasks/obligations";
import {
  MONITORING_LOAD_STAGES,
  monitoringLoadPlanFor,
} from "@/lib/tasks/load-plan";
import { tasksScenario } from "@/lib/tasks/seed";
import { tierLabel } from "@/lib/tasks/bands";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { asTaskType } from "@/lib/tasks/types";
import type { RiskFlagPayload, TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY. The subtitle.
 *
 *  ═══ OBLIGATION FIRST, COVERAGE SECOND, AND NEVER A BARE OPEN COUNT ═══
 *
 *  "43 open" is the number this surface can always produce and the one it should
 *  never lead with: on a queue that never empties it describes the weather, not
 *  the work. What a supervisor needs from a glance is whether anything has gone
 *  past its deadline — so the debt clause comes first and is dropped entirely at
 *  zero rather than reading "0 overdue", which is a number nobody needs to see.
 *
 *  The coverage clause stays because it is the honest denominator: "2 overdue"
 *  alone would imply the rest is finished. */
export function monitoringSubtitle(
  openFlags: number,
  imminentBreached: number,
  documentationOpen: number
): string {
  const owed: string[] = [];
  if (imminentBreached > 0) owed.push(`${imminentBreached} past 24h`);
  if (documentationOpen > 0) {
    owed.push(
      `${documentationOpen} write-up${documentationOpen === 1 ? "" : "s"} due`
    );
  }
  const coverage = `${openFlags} flag${openFlags === 1 ? "" : "s"} in review`;
  return owed.length ? `${owed.join(" · ")} · ${coverage}` : coverage;
}

/** ═══ THE PANE'S OWN TWO STATES ═══
 *  Separate from the list's, because the two fail separately: the pane can be
 *  erroring over a perfectly healthy list. Sized to the pane's real proportions
 *  so the swap from skeleton to content moves nothing. */
function PaneSkeleton() {
  return (
    <div
      aria-hidden
      className="flex h-full flex-col gap-4 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-5"
    >
      <div className="h-6 w-40 rounded bg-[var(--surface-s2)] motion-safe:animate-pulse" />
      <div className="h-4 w-56 rounded bg-[var(--surface-s2)] motion-safe:animate-pulse" />
      <div className="h-[340px] rounded-[var(--radius-surface)] bg-[var(--surface-s1)] motion-safe:animate-pulse" />
    </div>
  );
}

function PaneError() {
  return (
    <div className="flex h-full min-h-[12rem] flex-col items-start justify-center gap-2 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-6">
      <p className="text-[14px] leading-[20px] text-[var(--text-primary)]">
        {/* TODO-COPY */}
        Couldn&apos;t load this flag.
      </p>
      {/* NO SECOND LINE POINTING SOMEWHERE. The list below carries the only retry
          this prototype can honour, and once that retry has run the list is ready
          while the pane is still erroring — so a line sending the reader back to
          it would go stale the moment they followed it. Same reasoning as the
          Tasks pane's, which had its second line removed in arch-A for exactly
          this. */}
    </div>
  );
}

/** A selection that means "whichever is first, once there is a first". Not a
 *  real id, and never compared against one — see `selectedEscalation`. */
const PENDING_ESCALATION = "__first__";

export function MonitoringPage({
  /** arch-C's stage links — a tier to land on, or the escalation region.
   *  Validated here rather than at the route, so a stale bookmark falls back to
   *  the default view. */
  focusBand = null,
  focusRegion = null,
}: {
  focusBand?: string | null;
  focusRegion?: string | null;
} = {}) {
  const mounted = useMounted();
  const tasksScenarioId = useOnboardingStore((s) => s.tasksScenarioId);

  /** THE CLOCK IS FIXED AT MOUNT, matching Tasks exactly. `Date.now()` in render
   *  scope is impure and the React Compiler's purity rule rejects it — caught by
   *  lint, not by reasoning. Every elapsed figure and breach state on this page
   *  would otherwise move mid-render. */
  const [now] = useState(() => Date.now());

  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const allItems = useMemo(
    () => (mounted ? tasksScenario(tasksScenarioId, now) : []),
    [mounted, tasksScenarioId, now]
  );

  /** RESOLVED IS LOCAL, exactly as on Tasks: the fixture is immutable and the
   *  page owns what a supervisor has done to it this session. */
  const items = useMemo(
    () =>
      allItems.map((i) =>
        resolvedIds.has(i.id) ? { ...i, status: "resolved" as const } : i
      ),
    [allItems, resolvedIds]
  );

  /** THE HYBRID UNIT OF REVIEW (B2). Imminent as individual rows, the two lower
   *  tiers coalesced by teen — see `monitoring-list.ts` for why the unit follows
   *  the obligation rather than being uniform. */
  const entries = useMemo(() => monitoringEntriesFor(items, now), [items, now]);

  /** ═══ THE ESCALATION SET — THE WHOLE LIFECYCLE ═══
   *  Active AND documentation-pending, in the one comparator's order, which puts
   *  active first because `TIER_RANK` does. Sorted rather than filtered-then-
   *  sorted so its order is the same order everything else on this surface uses. */
  const escalations = useMemo(
    () => sortedOpen(items, now).filter(isEscalationTask),
    [items, now]
  );
  const obligations = useMemo(
    () => monitoringObligations(items, now),
    [items, now]
  );
  const openFlags = useMemo(
    () => entries.reduce((n, e) => n + itemsOf(e).length, 0),
    [entries]
  );

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  /** ═══ TWO LISTS, ONE PANE, AND ONE SELECTION BETWEEN THEM ═══
   *
   *  The escalation region and the flags view are separate listboxes and the pane
   *  can only show one thing. Holding the escalation's id SEPARATELY, and
   *  treating it as the winner while it is set, is what keeps the two lists from
   *  both claiming to be selected — which would be two `aria-selected` rows on
   *  one screen and a reader with no way to tell which one the footer acts on.
   *
   *  Selecting in either list clears the other. */
  const [selectedEscalationId, setSelectedEscalationId] = useState<string | null>(
    () => (focusRegion === "escalations" ? PENDING_ESCALATION : null)
  );

  /** ═══ THE SELECTED ROW, AND THE ITEM THE PANE SHOWS — TWO IDS ═══
   *
   *  Selecting a coalesced group puts its highest-priority child in the pane, so
   *  the highlighted ROW and the reviewed ITEM are not the same object.
   *
   *  ═══ A CHILD ROW'S ID IS NOT AN ENTRY ID, AND THAT COST A DEFECT ═══
   *
   *  The worklist renders an expanded group's children from a SYNTHETIC entry —
   *  `{kind: "item", id: member.id, item: member}` — built at render time and
   *  never present in `entries`. So `entries.find(e => e.id === selectedEntryId)`
   *  returns undefined for every child row, the `?? entries[0]` fallback fired,
   *  and clicking a child put a DIFFERENT TEEN in the pane while the row lost its
   *  selection outline entirely.
   *
   *  MEASURED, because it is worth saying how this was caught: a probe expanded a
   *  group of five, clicked each child in turn and pressed `y`, and the count on
   *  the row never moved. It was resolving the first row of the list, five times.
   *  Nothing errored and nothing looked broken — the pane showed a real flag with
   *  real evidence, just not the one that had been clicked.
   *
   *  THE SECOND LOOKUP IS THE FIX: a row id that is not an entry id belongs to a
   *  member of one. Ordered so the common case — a top-level row — still costs
   *  one scan.
   *
   *  LATENT ON TASKS TOO, and unreachable there: billing objectIds are unique per
   *  review, so nothing on that surface coalesces and no child row exists to
   *  click. Reported rather than changed — Tasks is out of this phase's scope. */
  const selectedEntry =
    entries.find((e) => e.id === selectedEntryId) ??
    entries.find((e) => itemsOf(e).some((i) => i.id === selectedEntryId)) ??
    entries[0] ??
    null;
  const selected: TaskItem | null = selectedEntry
    ? (itemsOf(selectedEntry).find((i) => i.id === pickedId) ??
      paneItemFor(selectedEntry))
    : null;
  /** WHAT THE LIST HIGHLIGHTS. The row the reader clicked — which for a child is
   *  the child, not its parent — falling back to the head so the pane and the
   *  outline agree on an untouched page. */
  const selectedRowId = selectedEscalationId
    ? null
    : (selectedEntryId ?? selectedEntry?.id ?? null);

  /** WHAT THE PANE SHOWS. An escalation wins while one is selected; otherwise the
   *  flags view's pick. */
  /** `PENDING_ESCALATION` resolves to the head once the list exists — the store
   *  is not read until `mounted`, so a deep link cannot name an id at
   *  construction time. */
  const selectedEscalation =
    selectedEscalationId === PENDING_ESCALATION
      ? (escalations[0] ?? null)
      : (escalations.find((e) => e.id === selectedEscalationId) ?? null);
  const paneItem = selectedEscalation ?? selected;

  const paneRef = useRef<HTMLDivElement | null>(null);
  const paneActions = useRef<PaneActions>({});
  const [takeoverWanted, setPaneTakeover] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  /** The list's own retry, which wins over the plan once a reader has used it —
   *  the same arrangement Tasks has, and the reason the plan is a DEFAULT rather
   *  than the value. */
  const [listOverride, setListOverride] = useState<ListState | null>(null);

  const devLoadState = useOnboardingStore((st) => st.devLoadState);

  /** ═══ THE STAGE CARRIES THE STATE IT BELONGS TO ═══
   *
   *  Pairing the stage with the load state it was counted for makes the reset a
   *  DERIVATION rather than a write: if the state has moved on, the stage is 0 by
   *  definition. The effect then only schedules.
   *
   *  AND THE CLEANUP CLEARS THE STAMP, which is not decoration — without it a
   *  finished run leaves `forState: "loading"` behind, so Loading → Ready →
   *  Loading finds the stamp already matching, reads its stage as complete, and
   *  the second selection does nothing. That exact defect shipped on Tasks and
   *  was found in arch-A's A2 pass; this surface is built with the fix rather
   *  than inheriting the bug. */
  const [progress, setProgress] = useState<{
    forState: string | null;
    stage: number;
  }>({ forState: devLoadState, stage: MONITORING_LOAD_STAGES });
  const loadStage =
    progress.forState === devLoadState
      ? progress.stage
      : devLoadState === "loading"
        ? 0
        : MONITORING_LOAD_STAGES;

  useEffect(() => {
    if (!mounted) return;
    if (devLoadState !== "loading") return;
    /* 240ms PER STEP — slow enough to read, short enough not to become the demo.
       Five steps here rather than Tasks' four; see `monitoringLoadPlanFor`. */
    const timers = Array.from({ length: MONITORING_LOAD_STAGES }, (_, i) =>
      setTimeout(() => setProgress({ forState: devLoadState, stage: i + 1 }), (i + 1) * 240)
    );
    return () => {
      timers.forEach(clearTimeout);
      setProgress({ forState: null, stage: MONITORING_LOAD_STAGES });
    };
  }, [mounted, devLoadState]);

  const plan = useMemo(
    () => monitoringLoadPlanFor(devLoadState, loadStage),
    [devLoadState, loadStage]
  );
  const listState: ListState = listOverride ?? plan.list;
  /** THE RETRY TAKES THE HEADERS WITH IT. They are the same fetch as the rows —
   *  a retry that restored the list and left the counts saying nothing would be
   *  a retry that half worked, which is worse than one that visibly did not. */
  const headersState = listOverride ?? plan.headers;

  /** ═══ THE TAKEOVER IS DERIVED, NOT SYNCED ═══
   *
   *  Below `xl` the two columns switch rather than shrink, so selecting a row
   *  hands the whole width to the pane and a "Back to list" button appears. When
   *  the list empties there is no list to go back to, and a stuck `true` would
   *  leave that button pointing at nothing.
   *
   *  WRITTEN AS A DERIVATION RATHER THAN AN EFFECT THAT RESETS IT. The first
   *  version was `useEffect(() => { if (!entries.length) setPaneTakeover(false) })`,
   *  which the compiler's lint rejects — correctly: a synchronous setState in an
   *  effect is a second render pass, and here it also meant one frame painted
   *  with a back button over an empty list. The intent was never to REMEMBER a
   *  release; it was that the takeover is only meaningful while there is
   *  something behind it. */
  const paneTakeover = takeoverWanted && entries.length > 0;

  const { resolve, undo } = useResolveUndo({
    /* TODO-COPY. Every item on this surface is a flag; escalations are not
       resolved here (locked decision 3) and the utility refuses one. */
    toastLabel: () => "Flag closed",

    onResolved: (item) => {
      // WHERE SELECTION GOES: the next entry in sort order, computed BEFORE the
      // item leaves the list.
      const remaining = entries.filter(
        (e) => !itemsOf(e).every((i) => i.id === item.id)
      );
      const idx = entries.findIndex((e) =>
        itemsOf(e).some((i) => i.id === item.id)
      );
      const nextEntry = remaining[Math.min(idx, remaining.length - 1)] ?? null;

      setResolvedIds((prev) => new Set(prev).add(item.id));

      if (nextEntry) {
        setSelectedEntryId(nextEntry.id);
        const nextItem = paneItemFor(nextEntry);
        setPickedId(nextItem.id);
        /* TODO-COPY. THE TIER, NOT THE DOMAIN — "Next: Marcus, imminent, 22h
           open". Tasks announces the domain because its rows differ by domain;
           here every row is a flag and the tier is the only thing that
           distinguishes one from the next. */
        const p = nextItem.payload;
        const tier =
          p.kind === "riskFlag"
            ? tierLabel((p as RiskFlagPayload).tier).toLowerCase()
            : "flag";
        setAnnouncement(
          `Next: ${nextItem.teenDisplayName.split(" ")[0]}, ${tier}, ${elapsedLabel(
            nextItem.openedAt,
            now
          )} open`
        );
      } else {
        setSelectedEntryId(null);
        setPickedId(null);
      }
    },

    onRestore: (item) => {
      setResolvedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setSelectedEntryId(null);
      setPickedId(item.id);
    },
  });

  useTaskShortcuts({
    onAnswer: (correct) => paneActions.current.answer?.(correct),
    /* `Enter` AND `⌘/Ctrl+Enter` HAVE NOTHING TO PRESS HERE, and are wired to
       `false` rather than left out so the hook falls through to focusing the
       pane. Both belong to the billing review's documentation gate, which is a
       Tasks control: a flag resolves from `y`/`n` or the footer's two buttons,
       and there is no draft on this surface to submit. */
    onEnter: () => false,
    onSubmit: () => false,
    onFocusPane: () => paneRef.current?.focus(),
    onUndo: () => undo(),
    onHelp: () => setShortcutsOpen(true),
  });

  return (
    /* THE SAME FIXED FRAME AS TASKS, for the same reason: at 40–120 rows a
       flowing page puts the resolve footer below the fold, reachable only by
       scrolling past the evidence it acts on. `min-h-0` is the load-bearing
       half — without it the columns refuse to shrink and the shell scrolls. */
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col px-6 py-6 lg:px-8">
      <div
        data-anno-ref="monitoring-header"
        className="flex shrink-0 flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
            {/* TODO-COPY */}
            Monitoring
          </h1>
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {mounted
              ? monitoringSubtitle(
                  openFlags,
                  obligations.imminentBreached,
                  obligations.documentationOpen
                )
              : ""}
          </p>
        </div>
      </div>

      {/* ABOVE THE FLAGS VIEW, AND ONLY WHEN NON-EMPTY — the flags view is this
          surface's resting state, and a permanently empty band above it would be
          furniture a reader learns to skip, which is the worst habit to build
          above the one region that matters. */}
      {/* ═══ `?region=escalations` SELECTS THE FIRST ONE ═══
          Home's escalation stage links here, and landing at the top of the page
          with nothing chosen would leave a supervisor to pick again from a region
          they were just sent to. The FIRST is the comparator's head — active
          before documentation, because `TIER_RANK` says so — so the pane opens on
          the same escalation the region lists first.
          ONCE, on arrival: `useState`'s initialiser rather than an effect, so
          there is no frame with the wrong selection and no reset when the reader
          moves on. */}
      <EscalationRegion
        items={escalations}
        now={now}
        state={plan.escalations}
        selectedId={selectedEscalationId}
        onSelect={(item) => {
          setSelectedEscalationId(item.id);
          setPaneTakeover(true);
        }}
      />

      <div className="mt-6 min-h-0 flex-1">
        <div
          className={cn(
            // 40 / 60 at >=1280px, and below 1100px only ONE of the two mounts —
            // switching rather than shrinking, so neither column is ever squeezed
            // into a width it cannot use. `minmax(0,1fr)` on the row caps it at
            // the space available: an auto track would size to its content and
            // push the frame past its own height, which scrolls the shell and
            // carries the pinned header off the top.
            "grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-5",
            "xl:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]"
          )}
        >
          <div className={cn("min-h-0", paneTakeover && "hidden xl:block")}>
            <Worklist
              entries={entries}
              items={items}
              /* NO SINGLE DOMAIN. Three tiers across two of them — see the prop's
                 own note in `worklist.tsx`. */
              domain={null}
              /* TODO-COPY */
              subject="Monitoring"
              emptyLine="No flags in review right now."
              now={now}
              selectedId={selectedRowId}
              state={listState}
              headersState={headersState}
              onSelect={(entry, item) => {
                setSelectedEntryId(entry.id);
                setPickedId(item.id);
                // THE OTHER LIST LETS GO. See `selectedEscalationId`.
                setSelectedEscalationId(null);
                setPaneTakeover(true);
              }}
              focusBand={asTaskType(focusBand)}
              onRetry={() => setListOverride("ready")}
            />
          </div>

          <div
            className={cn(
              "flex min-h-0 flex-col xl:block",
              !paneTakeover && "hidden xl:block"
            )}
          >
            {paneTakeover && (
              <button
                type="button"
                onClick={() => setPaneTakeover(false)}
                className={cn(
                  "mb-2 inline-flex min-h-9 shrink-0 self-start items-center gap-1 rounded-full px-2 text-[13px] font-semibold xl:hidden",
                  "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                <ChevronLeft className="size-4" aria-hidden />
                {/* TODO-COPY */}
                Back to list
              </button>
            )}
            <div
              ref={paneRef}
              tabIndex={-1}
              // POLITE, and on the pane itself so an auto-advance announces the
              // item that arrived rather than the whole page re-reading.
              aria-live="polite"
              className="min-h-0 flex-1 rounded-[var(--radius-elevated)] xl:h-full xl:flex-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              {/* PANE AND EXCERPT ARE SEPARATE AXES. Under partial failure the
                  transcript errors while the pane stays healthy — which is the
                  whole point of the excerpt having its own state: a supervisor
                  who cannot see what was said can still act on the flag. */}
              {plan.pane === "error" ? (
                <PaneError />
              ) : plan.pane === "loading" ? (
                <PaneSkeleton />
              ) : (
                <TaskPane
                  item={paneItem}
                  now={now}
                  onResolve={resolve}
                  actionsRef={paneActions}
                  excerptState={plan.excerpt}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* OUTSIDE the pane's own markup so a re-render of the pane cannot swallow
          it. */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <ShortcutSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
