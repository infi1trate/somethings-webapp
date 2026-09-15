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

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useMounted } from "@/lib/use-mounted";
/* `RespondStrip` LEFT WITH THE ESCALATIONS — see the note at its old mount.
   `elapsedLabel` is domain-neutral and still formats the list's ages. */
import { elapsedLabel } from "@/components/tasks/strips";
import { Worklist, type ListState } from "@/components/tasks/worklist";
import { TaskPane, type PaneActions } from "@/components/tasks/task-pane";
import { TabComplete } from "@/components/tasks/completion";
import { useResolveUndo } from "@/components/tasks/resolve-undo";
import { ShortcutSheet, useTaskShortcuts } from "@/components/tasks/shortcuts";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { listEntriesFor, itemsOf, paneItemFor, type ListEntry } from "@/lib/tasks/list";
import {
  headerCounts,
  preselectedFor,
} from "@/lib/tasks/sort";
import { LOAD_STAGES, loadPlanFor } from "@/lib/tasks/load-plan";
import { tasksScenario } from "@/lib/tasks/seed";
import {
  asTaskType,  DOMAIN_LABEL,
  TASK_DOMAINS,
  type TaskDomain,
  type TaskItem,
} from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

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
}: {
  focusBand?: string | null;
} = {}) {
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


  const allItems = useMemo(() => {
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
  const items = useMemo(
    () => allItems.filter((i) => i.domain === "billing"),
    [allItems]
  );

  const counts = useMemo(() => headerCounts(items, now), [items, now]);
  /* `closed` (closed-today per domain) WENT WITH THE CARDS that displayed it. */

  /** ═══ THE ONLY DOMAIN ═══
   *  It was `pickedDomain ?? defaultActiveDomain(items, now)` — a reader's tab
   *  choice over a derived default. With one domain there is no choice to hold
   *  and no default to derive, so it is a constant and `defaultActiveDomain`
   *  loses its only caller on this surface. Kept in `sort.ts` for Phase B, which
   *  has tiers to default between. */
  const activeDomain: TaskDomain = "billing";

  /** THE TAB'S ENTRIES — the sorted domain list with flags coalesced (§4). */
  const entries = useMemo(
    () => listEntriesFor(items, activeDomain, now),
    [items, activeDomain, now]
  );

  /** THE TAB'S ITEMS, OPEN AND RESOLVED. `entries` is the open set; band
   *  retirement needs to report how many of a cleared tier closed today, which is
   *  a fact about the resolved ones. Filtered here rather than handing the list
   *  every domain's items, so a retiring Billing band cannot count a risk flag. */
  const domainItems = useMemo(
    () => items.filter((i) => i.domain === activeDomain),
    [items, activeDomain]
  );

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
  /** Billing cleared to zero — the completion state. It was
   *  `completedDomain: TaskDomain | null`, which existed to say WHICH of four
   *  tabs had emptied; with one domain the question is only whether. */
  const [billingComplete, setBillingComplete] = useState(false);

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

  const nothingOpen = mounted && counts.open === 0;

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
    toastLabel: (item) =>
      item.domain === "billing" ? "Billing review completed" : "Flag closed",

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
      const tabEmptied =
        afterResolve.filter(
          (i) => i.domain === item.domain && i.status !== "resolved"
        ).length === 0;

      setDetailById((prev) => ({ ...prev, [item.id]: detail }));
      setResolvedIds((prev) => new Set(prev).add(item.id));

      if (tabEmptied) {
        setBillingComplete(true);
        setSelectedEntryId(null);
        setPickedId(null);
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

    onRestore: (item) => {
      setResolvedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setBillingComplete(false);
      /* NO DOMAIN TO RESTORE. Undo used to re-point the tab at the undone item's
         domain; every item on this surface is billing. */
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col px-6 py-6 lg:px-8">
      {/* ── HEADER (§1) — PINNED. Never scrolls away. ─────────────────── */}
      {/* ANNO REGION. The worklist scroller and the task pane were already
          tagged; this top strip and the tab cards below were not, so a comment
          on either fell back to `app-main`. */}
      <div data-anno-ref="tasks-header" className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
            {/* TODO-COPY */}
            Tasks
          </h1>
          {/* 4px under the display title — the spacing scale's first step, and
              the only value between these two lines (Part 2). */}
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
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

        {/* ═══ THE TOP-RIGHT "CLOSED TODAY" UNIT WAS HERE (Part 3) ═══
            Its data moved into the tab-cards, where the work happened: a card
            reads "4 open · 2 closed", and an empty one "All clear · 5 closed
            today". The Activity deep link travelled with it unchanged.
            The unit was a second place to look for a number that belongs to a
            domain, and it stated the domain's name a second time to say so. */}
      </div>

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

      {/* ── MASTER-DETAIL ───────────────────────────────────────────────── */}
      <div
        id="tasks-panel"
        role="tabpanel"
        aria-labelledby={`tasks-tab-${activeDomain}`}
        tabIndex={-1}
        // THE FLEXIBLE ROW. Everything above is `shrink-0`; this is what absorbs
        // the remaining height and hands it to the two columns.
        className="mt-6 min-h-0 flex-1"
      >
        {nothingOpen ? (
          <WholePageEmpty />
        ) : (
          <div
            className={cn(
              // 40 / 60 at >=1280px. Below 1100px only ONE of the two mounts —
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
              "xl:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]"
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
                "min-h-0",
                paneTakeover && "hidden xl:block"
              )}
            >
              <Worklist
                entries={entries}
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
                 tier IS the kind of work, and its rows are person-forward. */
                grouping="deadline"
                rowVariant="task"
                focusBand={asTaskType(focusBand)}
              onRetry={() =>
                  setListStates((prev) => ({ ...prev, [activeDomain]: "ready" }))
                }
              />
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
                "flex min-h-0 flex-col xl:block",
                !paneTakeover && "hidden xl:block"
              )}
            >
              {paneTakeover && (
                <button
                  type="button"
                  onClick={() => setPaneTakeover(false)}
                  className={cn(
                    // `shrink-0 self-start`: a control, not a row — in a flex
                    // column a stretched button would span the width.
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
              {billingComplete ? (
                /* ═══ COMPLETION, WITHOUT A NEXT DOMAIN ═══
                   `TabComplete` offered "you cleared Billing — go to Risk
                   flags", which was the surface's whole reward loop when it held
                   four queues. There is no next tab now, so it renders the
                   cleared state alone and `nextDomainAfter` loses its only
                   caller here. Phase C's Home is where a supervisor is sent
                   next; sending them there from this card would be a cross-
                   surface CTA built before the surface exists. */
                <TabComplete domain={activeDomain} />
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
                  className="min-h-0 flex-1 rounded-[var(--radius-elevated)] xl:h-full xl:flex-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
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
