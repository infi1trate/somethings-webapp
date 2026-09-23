"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — the clinical vigilance surface. Supervisor tier only.
//
// ═══ WHAT THIS PAGE STOPPED ASSERTING ═══
//
// It grouped flags into Imminent / Clinical review / Routine review and counted
// each tier's SLA down to a breach. None of that was computable: the classifier
// emits categories, not severity, and nothing published states a review deadline
// for a flag. So the page was asserting clinical severity and manufacturing
// breach states from it — and a supervisor reading "overdue by 2h" on a flag was
// reading a number this system invented.
//
// Tiers are gone. Flags carry AGE. Breach treatment now belongs to exactly one
// thing: escalation-linked obligations against their real 5-minute and 24-hour
// clocks.
//
// ═══ THE PAGE HAS TWO VIEWS AND ONE COMPARATOR ═══
//
//   · THE QUEUE — events for judgment: teen safety flags and mentor practice
//     breaches, one list, one five-step comparator, filterable by subject.
//   · COVERAGE — every supervised conversation, as progress against the shift.
//     The floor under the queue, because a surface that can only show what a
//     model noticed cannot answer "have I looked at my teens".
//
// Two scroll regions total (locked decision 4): the left column's, and the
// pane's. The transcript renders unscrolled inside the pane.
//
// ═══════════════════════════════════════════════════════════════════════════

import { riskCategoryLabel } from "@/lib/record/risk-taxonomy";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { ShortcutSheet, useTaskShortcuts } from "@/components/tasks/shortcuts";
import { useResolveUndo } from "@/components/tasks/resolve-undo";
import { EscalationRegion } from "@/components/monitoring/escalation-region";
import { EventList, ageLabel } from "@/components/monitoring/event-list";
import { EventPane, type PaneHandle } from "@/components/monitoring/event-pane";
import { NowBand } from "@/components/monitoring/now-band";
import {
  MONITORING_LOAD_STAGES,
  monitoringLoadPlanFor,
} from "@/lib/tasks/load-plan";
import { LIVE_LAYER_ENABLED } from "@/lib/monitoring/constants";
import { sortEvents } from "@/lib/monitoring/event";
import {
  groupByConversation,
  sortGroups,
  type FlagGroup,
} from "@/lib/monitoring/flag-group";
import {
  compareEscalations,
  escalationObligations,
  isSettled,
  type EscalationRecord,
} from "@/lib/monitoring/escalation";
import { bandStateFor } from "@/lib/monitoring/live";
import { monitoringData } from "@/lib/monitoring/scenarios";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ THE SUBTITLE — EVERY NUMBER STATES ITS UNIT ═══
 *
 *  It read "2 past 24h · 3 write-ups due · 43 flags in review": three
 *  incompatible units, one of them ("2") with no stated referent at all, and a
 *  flag count on a queue that never empties standing in for progress.
 *
 *  Now every clause is one of exactly two things — COVERAGE PROGRESS, or a count
 *  of a REAL obligation with a real clock. A flag count is neither, so it is
 *  gone: it described the weather.
 *
 *  NEEDS-COPY-NICOLE, every clause. */
/** ═══ AND IT STATES ONLY WHAT THIS DESTINATION OWNS (Phase 7) ═══
 *
 *  Gap row 406: one subtitle rendered on all four destinations, so
 *  `/app/risk-flags` led with "2 escalations awaiting acknowledgement · 3
 *  close-out items overdue" — another destination's clocks, above the flag
 *  queue. It was left for "the brief of the destination that owns it", and the
 *  owning phases have run, so it is finished here rather than carried further.
 *
 *  WHICH CLAUSE BELONGS WHERE:
 *   · THE ESCALATION CLOCKS are Escalations'. They are the only published
 *     response SLAs in the product and the only thing on any of these surfaces
 *     that may carry breach treatment.
 *   · THE PIPELINE'S HEALTH is Risk Flags'. It outranks everything there for a
 *     stated reason — zero flags is otherwise ambiguous between a quiet shift
 *     and a broken safety pipe — and it says nothing a reader of the escalation
 *     region needs.
 *   · COVERAGE STATES ITS DENOMINATOR and takes no clause from here at all; the
 *     meter beside it already carries the fraction.
 *   · MENTOR PRACTICE TAKES NEITHER, and that is an absence worth naming: it has
 *     no published clock (gap row 421's territory) and no pipeline. Its subtitle
 *     is Phase 8's to write, and an inherited one would be a placeholder nobody
 *     reads as temporary.
 *
 *  THE UNSCOPED PAGE KEEPS EVERY CLAUSE — it is the surface they were written
 *  for, and nothing routes to it. */
export function monitoringSubtitle(input: {
  ackOutstanding: number;
  closeOutOverdue: number;
  classifierDegraded: boolean;
  /** Which clauses this destination owns. */
  scope: MonitoringScope;
}): string {
  /* NOT A FILTER OVER A BUILT STRING — the clauses are gated before they are
     written, so a destination that owns none produces the empty answer rather
     than a sentence with its middle removed. */
  const ownsEscalationClocks = input.scope === "escalations";
  const ownsPipeline = input.scope === "risk-flags";
  const owed: string[] = [];
  if (ownsEscalationClocks && input.ackOutstanding > 0) {
    owed.push(
      `${input.ackOutstanding} escalation${input.ackOutstanding === 1 ? "" : "s"} awaiting acknowledgement`
    );
  }
  if (ownsEscalationClocks && input.closeOutOverdue > 0) {
    owed.push(
      `${input.closeOutOverdue} close-out item${input.closeOutOverdue === 1 ? "" : "s"} overdue`
    );
  }
  /* ═══ COVERAGE IS NOT REPEATED HERE ═══
     The first build put the coverage clause in this subtitle AND in the meter
     beside it, so the header said "9 of 24 conversations reviewed this shift"
     twice, three centimetres apart. The METER owns coverage — it is the half
     with the bar and the percentage — and the subtitle owns obligations.
     WITH NOTHING OWED IT SAYS SO, rather than falling back to a flag count: a
     zero obligation count is a real fact about real clocks, and "43 open" was
     the weather. */
  const line = owed.length
    ? owed.join(" · ")
    : ownsEscalationClocks
      ? /* NEEDS-COPY-NICOLE. A zero obligation count is a real fact about real
           clocks, which is why it is stated rather than left blank — but only on
           the destination those clocks belong to. */
        "No escalation clocks outstanding"
      : "";
  /* THE CLASSIFIER'S HEALTH OUTRANKS EVERY OTHER CLAUSE. Zero flags is otherwise
     ambiguous between a quiet shift and a broken safety pipe. */
  if (ownsPipeline && input.classifierDegraded) {
    /* THE PIPELINE OUTRANKS EVERY OTHER CLAUSE, and on Risk Flags there is no
       other clause to outrank — so it is the whole subtitle rather than a
       prefix to one. */
    return line
      ? `Flag pipeline is down — no flags are arriving · ${line}`
      : "Flag pipeline is down — no flags are arriving";
  }
  return line;
}

function PaneSkeleton() {
  return (
    <div
      aria-hidden
      className="flex h-full flex-col gap-4 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-5"
    >
      <div className="h-6 w-40 rounded bg-[var(--surface-s2)] motion-safe:animate-pulse" />
      <div className="h-4 w-56 rounded bg-[var(--surface-s2)] motion-safe:animate-pulse" />
      <div className="h-[220px] rounded-[var(--radius-surface)] bg-[var(--surface-s1)] motion-safe:animate-pulse" />
    </div>
  );
}

function PaneError() {
  return (
    <div className="flex h-full min-h-[12rem] flex-col items-start justify-center gap-2 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-6">
      <p className="text-[14px] leading-[20px] text-[var(--text-primary)]">
        {/* NEEDS-COPY-NICOLE */}
        Couldn&apos;t load this event.
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden className="space-y-0">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 border-t border-[color:var(--border-subtle)] px-3 first:border-t-0">
          <span className="size-7 shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-3 w-44 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
            <span className="block h-2.5 w-28 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          </span>
        </div>
      ))}
    </div>
  );
}

const PENDING_ESCALATION = "__first__";

/** NEEDS-COPY-NICOLE. `y`/`n` DO NOT RESOLVE HERE — see the sheet's own note. */
/** ═══ THE SHEET'S ROWS ARE PER SCOPE, NOT PER PAGE (Phase 5) ═══
 *
 *  `ShortcutSheet` already took its rows per SURFACE — arch-mon's note: "a sheet
 *  that described the Tasks binding on Monitoring would be teaching a shortcut
 *  that does not exist". Phase 2 turned one surface into four destinations and
 *  left one list behind them, so the rule needed applying one level deeper.
 *
 *  WHAT WAS WRONG WITH ONE LIST. On `/app/coverage` there is no queue and no
 *  review pane, so five of the seven rows named keys that do nothing. On
 *  `/app/mentor-practice` the `y`/`n` rows advertised a classifier judgment on
 *  events no classifier produced — the same defect the accuracy axis itself had,
 *  in the one place a reader goes to LEARN the bindings.
 *
 *  THE ROWS ARE COMPOSED FROM PIECES rather than written out four times, so a
 *  new binding cannot land in three lists and be forgotten in the fourth. */
const K_QUEUE = [
  { keys: ["↑", "↓"], what: "Move through the queue" },
  { keys: ["j", "k"], what: "Move through the queue" },
];
const K_ACCURACY = [
  { keys: ["y"], what: "Classifier was right (records accuracy only)" },
  { keys: ["n"], what: "Classifier was wrong (records accuracy only)" },
];
const K_PANE = [{ keys: ["↵"], what: "Move focus to the review pane" }];
const K_UNDO = [{ keys: ["u"], what: "Undo the last close" }];
const K_HELP = [{ keys: ["?"], what: "This list" }];

/** The unscoped page keeps every row — it is the surface these were written for
 *  and nothing routes to it. */
const MONITORING_SHORTCUTS = [
  ...K_QUEUE,
  ...K_ACCURACY,
  ...K_UNDO,
  ...K_PANE,
  ...K_HELP,
];

const SCOPE_SHORTCUTS: Record<
  MonitoringScope,
  Array<{ keys: string[]; what: string }>
> = {
  /* THE REGION IS NOT A `role="tree"`, so the queue keys and Enter-to-pane do
     not reach it. Undo stays: a resolved escalation can be undone. */
  escalations: [...K_UNDO, ...K_HELP],
  "risk-flags": [...K_QUEUE, ...K_ACCURACY, ...K_UNDO, ...K_PANE, ...K_HELP],
};

/** ═══ TWO SCOPES, AND WHAT A SCOPE STILL PINS (addendum §2.1, §2.2) ═══
 *
 *  These ids are the route segments from `lib/ia/destinations.ts` — deliberately
 *  the same strings, so a route file passes its own segment and a typo is a type
 *  error rather than a page silently rendering the wrong destination.
 *
 *  IT WAS FOUR, AND A SCOPE PINNED TWO PIECES OF STATE: the view toggle
 *  (queue / coverage) and the subject filter (teen safety / mentor practice).
 *  Both pieces of state are gone rather than pinned — Coverage became Chat and
 *  Mentor Practice was removed — so a scope now selects a title, a shortcut set
 *  and a layout, and the two hidden controls it used to override are deleted
 *  along with the values they could have taken.
 *
 *  THE PAGE IS STILL ONE COMPONENT for the same reason it was: its 600 lines are
 *  page STATE — the resolve-and-undo ledger window, the keyboard layer, the load
 *  states per region — and two copies would be two places for a timing rule to
 *  drift invisibly. */
export type MonitoringScope = "escalations" | "risk-flags";

const SCOPE_TITLE: Record<MonitoringScope, string> = {
  escalations: "Escalations",
  "risk-flags": "Risk Flags",
};

export function MonitoringPage({
  /** ═══ `?band=` IS ACCEPTED AND IGNORED (arch-mon Phase 1) ═══
   *  Home's shift sequence links here with a TIER — the taxonomy this phase
   *  removed. The param is still received so an existing link does not 404 or
   *  land on an error, and it does nothing: there are no tier bands to scroll to.
   *  Home is a separate workstream and its links are not this phase's to change.
   *  `?region=escalations` still works and still selects the first escalation. */
  focusBand = null,
  focusRegion = null,
  /** ═══ `?escalation=<id>` — THE RECORD'S OWN DEEP LINK (arch-G, G6) ═══
   *  Every "Open the escalation record" on every surface used to land on a
   *  placeholder route. They land here now, with that record selected. A region
   *  link is a link to a WORKLIST ROW; this is a link to an OBJECT, which is why
   *  it resolves against the whole set rather than the region's contents. */
  focusEscalation = null,
  /** ═══ ONE PAGE, FOUR DESTINATIONS (supervisor IA restructure, Phase 2) ═══
   *
   *  Monitoring stops being a destination and becomes a GROUP LABEL, and the
   *  four things it held become four routes: Escalations, Risk Flags, Mentor
   *  Practice, Coverage.
   *
   *  THIS IS A SCOPE, NOT FOUR NEW PAGES, and that is the phase's whole
   *  instruction — "almost entirely moves". Every child component is mounted
   *  unchanged: `EscalationRegion`, `EventList`, `EventPane`, `CoverageList`,
   *  `CoverageMeter`, `NowBand`. What the scope does is PIN the two pieces of
   *  page state that used to be controls — the view toggle and the subject
   *  filter — and hide the controls that set them, because a route boundary now
   *  says what a chip used to say.
   *
   *  WHY NOT SPLIT THE FILE. Its 697 lines are page STATE: selection,
   *  resolve-and-undo with the six-second ledger window, the live layer, the
   *  coverage credit rule, the keyboard layer, four load states per region.
   *  Four copies of that is four places for the timing rule to drift, and §6's
   *  rule is one whose failures are invisible on screen. Phases 6-8 rebuild each
   *  destination on its own terms; this phase makes the destinations REAL
   *  without rewriting the state that makes them work.
   *
   *  ═══ REQUIRED, AND IT USED TO DEFAULT TO `null` ═══
   *  The default was the unscoped page, kept during the restructure so that
   *  parameterising the component could not itself be the thing that changed
   *  it. `/app/monitoring` has been a redirect since then and the unscoped
   *  branches — a view toggle over a view that no longer exists, a subject
   *  filter over one subject — are gone, so a nullable scope would only mean
   *  "render a page with no title". */
  scope,
}: {
  focusBand?: string | null;
  focusRegion?: string | null;
  focusEscalation?: string | null;
  scope: MonitoringScope;
}) {
  void focusBand;
  const mounted = useMounted();
  const tasksScenarioId = useOnboardingStore((s) => s.tasksScenarioId);
  const monitoringScenarioId = useOnboardingStore((s) => s.monitoringScenarioId);
  const devLoadState = useOnboardingStore((st) => st.devLoadState);

  /** THE CLOCK IS FIXED AT MOUNT. `Date.now()` in render scope is impure and the
   *  React Compiler rejects it. Every age and every clock on this page is
   *  measured from this one instant — and with the live layer off, nothing here
   *  needs to tick. */
  const [mountedAt] = useState(() => Date.now());

  const data = useMemo(
    () =>
      mounted
        ? monitoringData(monitoringScenarioId, tasksScenarioId, mountedAt)
        : null,
    [mounted, monitoringScenarioId, tasksScenarioId, mountedAt]
  );
  /** A fixture may pin the hour — the dormant band and the after-hours
   *  escalation are states about the time of day. */
  const now = data?.clockOverride ?? mountedAt;

  // ── Page-local decisions ──────────────────────────────────────────────────
  /** Resolved events. Local, exactly as Tasks' resolutions are: the fixture is
   *  immutable and nothing persists a decision in this prototype. */
  const [resolvedIds, setResolvedIds] = useState<ReadonlySet<string>>(new Set());
  /** Escalations opened from a flag's disposition — the path the old control did
   *  not have. */
  const [raised, setRaised] = useState<EscalationRecord[]>([]);
  /* THE VIEW TOGGLE AND THE SUBJECT FILTER ARE GONE, not pinned — see the
     scope note above. Both were two-valued controls whose second value has been
     removed from the product. */
  const [paused, setPaused] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [listOverride, setListOverride] = useState<"ready" | null>(null);

  const events = useMemo(() => {
    const live = (data?.events ?? []).filter((e) => !resolvedIds.has(e.id));
    return sortEvents(live);
  }, [data, resolvedIds]);

  /* `filtered` WAS THE SUBJECT-FILTERED VIEW OF `events`. With one subject the
     two are the same set, and the alias stays only because it names what the
     pane and the keyboard read: the list as the reader sees it. */
  const filtered = events;

  /** ═══ THE LIST'S UNIT IS A CONVERSATION (addendum §3.1) ═══
   *  Built from the already-filtered, already-resolve-filtered events, so a
   *  row disappears when its last member is closed and shrinks when one is. */
  const groups = useMemo(
    () => sortGroups(groupByConversation(filtered)),
    [filtered]
  );

  /** ═══ A SETTLED ESCALATION FINALLY LEAVES ═══
   *  Resolved AND every owed close-out item done. Anything less stays on screen
   *  and keeps aging. */
  /** EVERY RECORD THIS PAGE KNOWS ABOUT, settled or not. The region shows a
   *  subset; a deep link addresses an object, and an object does not stop
   *  existing because its paperwork is finished. */
  const allEscalations = useMemo(
    () => [...(data?.escalations ?? []), ...raised],
    [data, raised]
  );
  const escalations = useMemo(
    () =>
      allEscalations
        .filter((r) => !isSettled(r, now))
        .sort((a, b) => compareEscalations(a, b, now)),
    [allEscalations, now]
  );


  /** ═══ THE SHARED COUNT, NOT A LOCAL ONE (Phase 3) ═══
   *  This was eight lines inlined here, which meant Today could not call it and
   *  counted the same obligations a different way — and the two disagreed on
   *  screen. `escalationObligations` has the finding. */
  const obligations = useMemo(
    () => escalationObligations(escalations, now),
    [escalations, now]
  );

  // ── Selection ─────────────────────────────────────────────────────────────
  /** THE SELECTED CONVERSATION, not the selected flag. The pane steps between
   *  a conversation's flags on its own; the list's selection is the row. */
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEscalationId, setSelectedEscalationId] = useState<string | null>(
    () =>
      /* AN ID BEATS A REGION. `?escalation=` names one record; `?region=` says
         "whichever is most urgent". A link carrying both means the specific
         one. */
      focusEscalation ??
      (focusRegion === "escalations"
        ? PENDING_ESCALATION
        : /* ═══ THE DESTINATION IMPLIES THE REGION (Phase 2) ═══
             `?region=escalations` said "open whichever is most urgent". Standing
             on `/app/escalations` says the same thing without a param, so the
             route gets the same sentinel.
             WITHOUT IT THE PANE IS DEAD UNTIL A CLICK: on this destination the
             pane is always on screen — there is no list column to come back
             from — so an unselected pane is half the page reading "Choose an
             event to review it." while four records sit above it. The flag
             queue has always defaulted to `filtered[0]`; this is the region
             getting the same courtesy, through the sentinel that already
             means it. */
          scope === "escalations"
            ? PENDING_ESCALATION
            : null)
  );
  const selectedEscalation =
    selectedEscalationId === PENDING_ESCALATION
      ? (escalations[0] ?? null)
      : /* THE WHOLE SET, NOT THE REGION'S. A documented record is filtered out of
           the region — that is the region's job — and is still openable by its
           own link. Reading the region here is how a link to a finished record
           would silently land on somebody else's flag. */
        (allEscalations.find((e) => e.id === selectedEscalationId) ?? null);
  /** ═══ A LINK TO A RECORD THIS DATA SET DOES NOT HOLD ═══
   *  The prototype's escalations are built per scenario, so an id from another
   *  scenario — or from yesterday — resolves to nothing. Falling through to the
   *  first flag would show a reader somebody else's teen under a link they
   *  followed for a named escalation. Stated instead. */
  const missedLink =
    focusEscalation != null &&
    !allEscalations.some((e) => e.id === focusEscalation)
      ? focusEscalation
      : null;
  const selectedGroup: FlagGroup | null = selectedEscalation
    ? null
    : (groups.find((g) => g.id === selectedEventId) ?? groups[0] ?? null);
  /** ═══ WHICH FLAG WITHIN THE CONVERSATION (addendum §3.1) ═══
   *  Held as an ID rather than an index, and READ THROUGH THE GROUP rather
   *  than reset when the row changes: an index would point at a different
   *  flag after a resolve shortened the list, and a reset in an effect runs
   *  one render late — the same reasoning the scope derivation uses.
   *  The fallback is the group's first member, which is the one the queue's
   *  own ordering would have put first. */
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const selectedEvent =
    selectedGroup?.events.find((e) => e.id === selectedFlagId) ??
    selectedGroup?.events[0] ??
    null;
  const flagIdx = selectedGroup
    ? selectedGroup.events.findIndex((e) => e.id === selectedEvent?.id)
    : -1;

  const [takeoverWanted, setPaneTakeover] = useState(false);
  /** ═══ `Escalations` HAS NO LEFT COLUMN, AND THAT IS NOT AN EMPTY ONE ═══
   *
   *  Every other scope's content is the left column — a queue or a roster — with
   *  the pane as its detail. On `Escalations` the LIST IS THE REGION, which
   *  renders full-width above the grid and carries its own selection. So the
   *  grid's left column has nothing to hold, and rendering it anyway would print
   *  the queue's empty state — "Nothing waiting for judgment" — on a route
   *  looking at three live escalations. A false negative on a safety surface.
   *
   *  The column is therefore GONE rather than empty, the grid collapses to one
   *  column, and the pane is always present because there is no list to come
   *  back from. */
  const paneOnly = scope === "escalations";
  /* `listOnly` IS GONE WITH COVERAGE. It existed because that destination's
     unit — a conversation — opens as a route rather than in a pane, so the
     detail column had nothing to hold. Both remaining destinations review their
     unit in the pane. */
  const paneTakeover =
    paneOnly || (takeoverWanted && (groups.length > 0 || escalations.length > 0));
  const paneRef = useRef<HTMLDivElement | null>(null);
  const paneHandle = useRef<PaneHandle>({});

  // ── Load states ──────────────────────────────────────────────────────────
  const [progress, setProgress] = useState<{ forState: string | null; stage: number }>({
    forState: devLoadState,
    stage: MONITORING_LOAD_STAGES,
  });
  const loadStage =
    progress.forState === devLoadState
      ? progress.stage
      : devLoadState === "loading"
        ? 0
        : MONITORING_LOAD_STAGES;

  useEffect(() => {
    if (!mounted) return;
    if (devLoadState !== "loading") return;
    const timers = Array.from({ length: MONITORING_LOAD_STAGES }, (_, i) =>
      setTimeout(() => setProgress({ forState: devLoadState, stage: i + 1 }), (i + 1) * 240)
    );
    return () => {
      timers.forEach(clearTimeout);
      setProgress({ forState: null, stage: MONITORING_LOAD_STAGES });
    };
  }, [mounted, devLoadState]);

  /** The `loading-partial` fixture and the dev bar's own load axis are the same
   *  question asked two ways; the fixture wins while it is set. */
  const effectiveLoad = data?.load === "partial" ? "partial" : devLoadState;
  const plan = useMemo(
    () => monitoringLoadPlanFor(effectiveLoad, loadStage),
    [effectiveLoad, loadStage]
  );
  const listState = listOverride ?? plan.list;

  // ── Resolve / undo ───────────────────────────────────────────────────────
  /** ═══ THE LEDGER TIMING IS UNCHANGED (locked decision 2) ═══
   *  Flags still resolve through the shared `useResolveUndo`, which owns the
   *  6-second window and the write at the end of it. What changed above it is
   *  WHAT MAY CALL IT: only a disposition whose effect is `resolve`. */
  const { resolve, undo } = useResolveUndo({
    /* NEEDS-COPY-NICOLE */
    toastLabel: () => "Event closed",
    onResolved: (item) => {
      setResolvedIds((prev) => new Set(prev).add(item.id));
      /* ═══ ADVANCING IS PER CONVERSATION NOW (addendum §3.1) ═══
         Closing one flag of three does not leave the conversation: the row
         stays, one member lighter, and the pane shows the next one. Only when
         the LAST member closes does the row go, and only then does the
         selection move — which is also when an announcement is warranted,
         because before that nothing changed about where the reader is. */
      const g = groups.find((x) => x.events.some((e) => e.id === item.id));
      if (g && g.events.length > 1) return;
      const idx = groups.findIndex((x) => x.id === g?.id);
      const next =
        groups.filter((x) => x.id !== g?.id)[
          Math.max(0, Math.min(idx, groups.length - 2))
        ] ?? null;
      setSelectedEventId(next?.id ?? null);
      if (next) {
        /* NEEDS-COPY-NICOLE. THE ANNOUNCEMENT NAMES THE SUBJECT AND THE AGE —
           never a tier, which no longer exists, and never a deadline. */
        setAnnouncement(
          `Next: ${next.teenName}, ${next.worstCategory ? riskCategoryLabel(next.worstCategory) : ""}, ${ageLabel(next.oldestAt, now)}`
        );
      }
    },
    onRestore: (item) => {
      setResolvedIds((prev) => {
        const s = new Set(prev);
        s.delete(item.id);
        return s;
      });
      setSelectedEventId(item.id);
    },
  });

  /* ═══ COVERAGE CREDIT IS GONE WITH THE DESTINATION (addendum §2.2) ═══
     `credit(teenId, source)` marked a teen's conversation as looked-at when a
     flag on it was reviewed, feeding the coverage meter. Coverage is Chat now
     and no surface reads the credit, so the write went with the reader. The
     blocked rule it implemented — which interactions count as having looked —
     is still stated at `creditsCoverage` in `lib/monitoring/coverage.ts`, which
     is dormant rather than deleted. */

  useTaskShortcuts({
    /* `y`/`n` RECORD CLASSIFIER ACCURACY AND RESOLVE NOTHING. The old binding
       resolved the event from a key, which is the one-tap closure Phase 2
       removed — a clinical disposition cannot come from a keystroke. */
    onAnswer: (accurate) => {
      paneHandle.current.accuracy?.(accurate);
      return;
    },
    onEnter: () => false,
    onSubmit: () => false,
    onFocusPane: () => paneRef.current?.focus(),
    onUndo: () => undo(),
    onHelp: () => setShortcutsOpen(true),
  });

  /* `liveIds` IS GONE WITH THE COVERAGE LIST (addendum §2.2). It marked the
     conversations the live layer said were active right now, and the roster
     was the only surface that showed them. */
;
  const bandState = bandStateFor({
    enabled: LIVE_LAYER_ENABLED,
    transport: data?.transport === "lost" ? "lost" : "connected",
    paused: paused || !!data?.paused,
    now,
    items: data?.live ?? [],
  });

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col px-6 py-6 lg:px-8">
      <div
        data-anno-ref="monitoring-header"
        className="flex shrink-0 flex-wrap items-start justify-between gap-4"
      >
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
            {SCOPE_TITLE[scope]}
          </h1>
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {/* ═══ THE SUBTITLE IS THE OWNING DESTINATION'S (Phase 7) ═══
                `monitoringSubtitle` states escalation obligations and the flag
                pipeline's health, and it used to render on all four
                destinations — measured on `/app/coverage`: "2 escalations
                awaiting acknowledgement · 3 close-out items overdue", above a
                coverage meter, on a page about conversations. Gap row 406.
                The two destinations that did not own these clauses are gone, so
                the gating in `monitoringSubtitle` now separates the only two
                left: escalation clocks on one, pipeline health on the other. */}
            {mounted
              ? monitoringSubtitle({
                  ackOutstanding: obligations.ackOutstanding,
                  closeOutOverdue: obligations.closeOutOverdue,
                  classifierDegraded: data?.classifier === "degraded",
                  scope,
                })
              : ""}
          </p>
        </div>
        {/* ═══ THE COVERAGE METER IS GONE FROM THIS HEADER (addendum §2.2) ═══
            It rendered on all four destinations, then on three: Coverage,
            because it was the page, and Risk Flags, on arch-mon's argument that
            coverage is the floor under the queue. Coverage is Chat now and no
            longer computes a shift fraction, so the element has no subject.
            §2.11 puts a progress track back in this header region, measuring
            FLAGS REVIEWED rather than conversations covered — a different
            denominator with a different meaning, which is why this one is
            deleted rather than repointed. */}
      </div>

      {mounted && (
        <NowBand
          state={bandState}
          items={data?.live ?? []}
          now={now}
          paused={paused || !!data?.paused}
          onTogglePause={() => setPaused((p) => !p)}
        />
      )}

      {missedLink && (
        /* ═══ THE LINK THAT COULD NOT BE HONOURED (arch-G, G6) ═══
           NEEDS-COPY-NICOLE. It names the id, because an honest miss reads as
           unbuilt while a generic one reads as broken — the same reasoning the
           placeholder route was written with. */
        <p
          role="status"
          className="mt-4 shrink-0 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-2.5 text-[13px] leading-[19px] text-[var(--text-secondary)]"
        >
          {/* `{" "}` BECAUSE JSX EATS THE NEWLINE. Measured: the page read
              "Escalation esc-documentedisn’t in this data set" — the whitespace
              between an expression and the text after it is stripped when it
              spans a line break. */}
          Escalation {missedLink}{" "}
          isn&rsquo;t in this data set, so its record
          can&rsquo;t be opened here. Escalations in this prototype are built per
          scenario; anything from another scenario or an earlier day has no
          record to show.
        </p>
      )}

      {/* ═══ THE REGION IS THE `Escalations` DESTINATION NOW (Phase 2) ═══
          §3: the escalation STRIP is global and stays global — that is Phase 3's
          interrupt layer. The REGION, which is the worklist of records, is what
          moves, and it moves to one route rather than sitting above every
          queue. Above the flag queue it would be a second kind of work above
          the one the reader came for. */}
      {mounted && scope === "escalations" && (
        <EscalationRegion
          records={escalations}
          now={now}
          state={plan.escalations}
          /* IT IS THE PAGE ON ITS OWN DESTINATION — see the prop's note. */
          standalone={paneOnly}
          selectedId={selectedEscalationId === PENDING_ESCALATION ? (escalations[0]?.id ?? null) : selectedEscalationId}
          onSelect={(rec) => {
            setSelectedEscalationId(rec.id);
            setPaneTakeover(true);
          }}
        />
      )}

      <div className="mt-6 min-h-0 flex-1">
        <div
          className={cn(
            "grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-5",
            /* ONE COLUMN WHEN THERE IS ONE COLUMN. A 40/60 grid with an absent
               first child leaves the pane in the 60% track and 40% of the width
               blank, which reads as a failed render rather than a full-width
               record. */
            paneOnly
              ? "xl:grid-cols-[minmax(0,1fr)]"
              : "xl:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]"
          )}
        >
          {!paneOnly && (
          <div className={cn("flex min-h-0 flex-col", paneTakeover && "hidden xl:flex")}>
            {/* ═══ THE VIEW TOGGLE AND THE SUBJECT CHIPS ARE BOTH GONE ═══
                The toggle swapped this column between the queue and the
                coverage roster; the chips narrowed the queue by review subject.
                Each was hidden under a scope already, because the route said
                which view and which subject — and with Coverage and Mentor
                Practice removed, neither control has a second value to offer.
                One column, one scroller, one list. */}
            <div
              data-anno-ref="monitoring-scroller"
              className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
            >
              {listState === "loading" ? (
                <ListSkeleton />
              ) : listState === "error" ? (
                <div role="alert" className="px-3 py-6">
                  <p className="text-[13.5px] leading-[19px] text-[var(--text-primary)]">
                    {/* NEEDS-COPY-NICOLE */}
                    Events couldn&apos;t be loaded, so this page can&apos;t say what is waiting.
                  </p>
                  <button
                    type="button"
                    onClick={() => setListOverride("ready")}
                    className={cn(
                      "mt-2 inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-contour)] px-3 text-[13px] font-semibold",
                      RING
                    )}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <EventList
                  groups={groups}
                  now={now}
                  selectedId={selectedGroup?.id ?? null}
                  onSelect={(g) => {
                    setSelectedEventId(g.id);
                    /* A NEW ROW OPENS AT ITS FIRST FLAG. Clearing rather than
                       setting, so the fallback above stays the single
                       definition of "which one". */
                    setSelectedFlagId(null);
                    setSelectedEscalationId(null);
                    setPaneTakeover(true);
                  }}
                  /* ═══ NOT "you're done" ═══
                     NEEDS-COPY-NICOLE. It read "Nothing waiting for judgment.
                     Coverage is where the rest of the work is" — a pointer to a
                     destination that no longer exists. The half worth keeping is
                     the refusal to congratulate: an empty queue is what a
                     classifier noticed running out, not a shift completed. */
                  emptyLine={
                    data?.classifier === "degraded"
                      ? "No flags — and the flag pipeline is down, so this is not the same as a quiet shift."
                      : "Nothing waiting for judgment. This queue emptying is not the same as the shift being covered."
                  }
                />
              )}
            </div>
          </div>
          )}

          {/* ═══ ONE EMPTY STATE PER PAGE (Phase 2) ═══
              Measured on `/app/escalations` with the `classifier-degraded`
              scenario: the region said "No escalation is open or awaiting
              close-out" and the pane, directly under it, said "Choose an event
              to review it." Two empty states on one screen, disagreeing about
              both the noun and whether there is anything to choose.
              The pane is a DETAIL surface, so with no record selected and no
              list column beside it there is no detail to be empty about. It
              renders when there is something in it. */}
          {!(paneOnly && !selectedEscalation) && (
          <div className={cn("flex min-h-0 flex-col xl:block", !paneTakeover && "hidden xl:flex")}>
            {/* NO LIST, NO WAY BACK TO IT. Under `paneOnly` the region above IS
                the list and it is still on screen. */}
            {paneTakeover && !paneOnly && (
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
                {/* NEEDS-COPY-NICOLE */}
                Back to the list
              </button>
            )}
            <div
              ref={paneRef}
              tabIndex={-1}
              /* POLITE, and on the pane so an auto-advance announces the event
                 that arrived rather than the whole page. */
              aria-live="polite"
              className={cn(
                "min-h-0 flex-1 rounded-[var(--radius-elevated)] xl:h-full",
                RING
              )}
            >
              {plan.pane === "error" ? (
                <PaneError />
              ) : plan.pane === "loading" ? (
                <PaneSkeleton />
              ) : (
                <EventPane
                  /* ═══ KEYED ON THE SUBJECT, AND THIS IS A DEFECT FIX ═══
                     MEASURED before the key: pick "No clinical concern" on
                     Marcus L.'s flag, click another teen's row, and the
                     radio is STILL CHECKED — `data-disposition="no-concern"`
                     on a flag nobody had read. The pane's axis state is
                     `useState` and nothing reset it, so a clinical
                     disposition carried across teens.
                     A KEY RATHER THAN AN EFFECT: remounting is exactly the
                     semantics wanted — every piece of pane state is about the
                     subject in front of the reader — and a reset effect would
                     run one render late, leaving a frame with the previous
                     answer showing. */
                  key={selectedEscalation?.id ?? selectedEvent?.id ?? "empty"}
                  event={selectedEvent}
                  /** Where this flag sits in its conversation, for the pane's
                   *  stepper. `total: 1` hides it — see the pane. */
                  within={
                    selectedGroup
                      ? {
                          index: flagIdx,
                          total: selectedGroup.events.length,
                          onStep: (d: number) => {
                            const next =
                              selectedGroup.events[flagIdx + d] ?? null;
                            if (next) setSelectedFlagId(next.id);
                          },
                        }
                      : null
                  }
                  escalation={selectedEscalation}
                  /* THE WHOLE SET, for the record's timeline join. Not
                     `filtered` — the chips narrow what a READER is looking at,
                     and a narrowed queue must not narrow a record's history. */
                  events={events}
                  now={now}
                  compliance={data?.compliance ?? null}
                  deactivated={
                    !!data?.teenDeactivated &&
                    !!selectedEvent &&
                    selectedEvent.teenId === data.teenDeactivated
                  }
                  handleRef={paneHandle}
                  /** ═══ THE FLAG PATH — AND IT IS ONLY THE FLAG PATH NOW ═══
                   *  It had an `else` arm for practice events, which is why the
                   *  pane had to hand a CLINICAL-shaped detail for an event that
                   *  has no clinical disposition. `onResolvePractice` below took
                   *  that arm, so the two subjects no longer share a handler that
                   *  only one of them fits.
                   *  `e.flag` IS NON-NULLABLE SINCE §2.1 — every event on this
                   *  surface is a flag and the type says so, which is what
                   *  retired the guard that used to stand here. */
                  onResolve={(e, detail) => {
                    /* THE LEDGER PATH, UNCHANGED. The disposition and the
                       optional accuracy answer both travel as detail. */
                    resolve(e.flag, {
                      disposition: detail.disposition.id,
                      classifierAccuracy: detail.accuracy,
                    });
                  }}
                  onEscalate={(e) => {
                    /* ═══ THE FLAG BECOMES AN ESCALATION RECORD ═══
                       It does NOT resolve: the event stays in the queue until a
                       clinical disposition closes it, because escalating is the
                       moment it stopped being handled. */
                    setRaised((prev) => [
                      ...prev,
                      {
                        id: `esc-from-${e.id}`,
                        teenId: e.teenId,
                        teenName: e.teenName,
                        mentorId: e.mentorId,
                        mentorName: e.mentorName,
                        conversationId: e.conversationId,
                        triggeredAt: now,
                        acknowledgedAt: now,
                        resolvedAt: null,
                        is911: false,
                        caregiverInvolved: null,
                        closeOutDone: [],
                        /* ═══ NULL, BECAUSE A FLAG DOES NOT KNOW EITHER (Phase 6) ═══
                           An escalation raised from a flag's disposition has no
                           "opened by" other than the supervisor who just raised
                           it — which the pane would be telling them — and no
                           emergency contact, because nothing on the flag payload
                           carries one. The pane states both as not on file,
                           which is the true thing and also the prompt: an
                           escalation with no contact on file is a fact worth
                           seeing at the moment it is opened. */
                        flaggedBy: null,
                        emergencyContact: null,
                      },
                    ]);
                    setSelectedEscalationId(`esc-from-${e.id}`);
                    /* NEEDS-COPY-NICOLE */
                    setAnnouncement("Escalation opened. The flag stays in the queue.");
                  }}
                />
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <ShortcutSheet
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        rows={scope ? SCOPE_SHORTCUTS[scope] : MONITORING_SHORTCUTS}
      />
    </div>
  );
}
