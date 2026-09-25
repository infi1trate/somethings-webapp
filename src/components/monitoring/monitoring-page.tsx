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
import { PageHeader } from "@/components/ia/page-header";
import { ShiftTrack } from "@/components/ia/shift-progress";
import { EventPane, type PaneHandle } from "@/components/monitoring/event-pane";
import { NowBand } from "@/components/monitoring/now-band";
import {
  MONITORING_LOAD_STAGES,
  monitoringLoadPlanFor,
} from "@/lib/tasks/load-plan";
import { LIVE_LAYER_ENABLED } from "@/lib/monitoring/constants";
import { sortEvents, type MonitoringEvent } from "@/lib/monitoring/event";
import { DISPOSITION_VALUES } from "@/lib/monitoring/disposition";
import {
  autoLinkedFor,
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
import { ListToolbar } from "@/components/ia/list-toolbar";
import {
  applyFilters,
  EMPTY_FILTERS,
  isFiltering,
  timeDimension,
  type Filterable,
  type FilterDimension,
  type FilterState,
} from "@/lib/ui/filters";
import { tierOf, TIER_LABEL, TIER_ORDER } from "@/lib/record/risk-taxonomy";
import {
  listMinHeight,
  ROW_GEOMETRY,
  VIEW_OPTIONS_DEFAULT,
  type ViewPreset,
} from "@/lib/ui/view-options";
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

/** ═══ THE SKELETON TAKES THE DENSITY TOO ═══
 *  It was `h-14` and `size-7` — the compact row, hardcoded, on a list that can
 *  now render an 80px row. A skeleton that is not exactly as tall as the row
 *  replacing it produces a jump at the moment the data lands: seven rows at 56
 *  becoming seven at 80 is 168px of content sliding down under the reader's
 *  eye. `Worklist`'s skeleton already carried this contract in a comment
 *  ("sized from ROW_H so a skeleton row occupies exactly what a real row
 *  will"); this one carried the number without the reason, which is how it
 *  survived the density becoming a variable. */
function ListSkeleton({ preset }: { preset: ViewPreset }) {
  const geo = ROW_GEOMETRY[preset];
  return (
    <div aria-hidden className="space-y-0">
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          style={{ height: geo.pitch }}
          className="relative flex items-stretch gap-3 px-6"
        >
          <span className="flex shrink-0 items-center">
            <span
              style={{ width: geo.disc, height: geo.disc }}
              className="shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse"
            />
          </span>
          {/* THE SAME INSET HAIRLINE THE REAL ROW DRAWS, on the same stretched
              column — so the swap changes the content and nothing else. */}
          <span
            className={cn(
              "flex min-w-0 flex-1 flex-col justify-center gap-1.5",
              i > 0 && "border-t border-[color:var(--border-subtle)]"
            )}
          >
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
/** ═══ THE DIGITS AND `e` (addendum §2.8, §3.3) ═══
 *  THE ROWS ARE BUILT FROM `DISPOSITION_VALUES`, not written out: the array
 *  is blocked on Dr. Nissan, and a sheet that hardcoded three labels would be
 *  the one place a fourth value did not reach. It also keeps the digit and
 *  the label in the order the control renders them, which is the only reason
 *  a digit is learnable at all. */
const K_DISPOSITION = DISPOSITION_VALUES.map((d, i) => ({
  keys: [String(i + 1)],
  /* ═══ THE ROW SAYS WHAT THE KEY DOES, WHICH IS NOT THE SAME FOR ALL THREE ═══
     The first version appended "— and mark reviewed" to every value, and the
     sheet read "Watching — not resolved — and mark reviewed": a row teaching
     that the key closes an event the value explicitly keeps open. Measured in
     the sheet, not reasoned about. The effect is the discriminator, and it is
     the same one `commitDisposition` branches on. */
  what: d.effect === "resolve" ? `${d.label} — and mark reviewed` : d.label,
}));
const K_ESCALATE = [{ keys: ["e"], what: "Open an escalation from this flag" }];
const K_PANE = [{ keys: ["↵"], what: "Move focus to the review pane" }];
const K_UNDO = [{ keys: ["u"], what: "Undo the last close" }];
const K_HELP = [{ keys: ["?"], what: "This list" }];

/** The unscoped page keeps every row — it is the surface these were written for
 *  and nothing routes to it. */
const MONITORING_SHORTCUTS = [
  ...K_QUEUE,
  ...K_DISPOSITION,
  ...K_ESCALATE,
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
  "risk-flags": [
    ...K_QUEUE,
    ...K_DISPOSITION,
    ...K_ESCALATE,
    ...K_ACCURACY,
    ...K_UNDO,
    ...K_PANE,
    ...K_HELP,
  ],
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

/** ═══ WHAT THE DESTINATION IS FOR, IN ONE LINE (addendum §2.10) ═══
 *  NEEDS-COPY-NICOLE, both. A PURPOSE, not a reading: it does not change when
 *  the data does, which is the distinction the old subtitle collapsed — it
 *  stated obligations, so the header changed sentence as the shift went on and
 *  a reader arriving for the first time learned nothing about the surface.
 *  THE METRICS CARRY THE READING now, which is what they are for. */
const SCOPE_PURPOSE: Record<MonitoringScope, string> = {
  escalations:
    "Live incidents and the paperwork they owe. The only clocks in the product run here.",
  /* ═══ CUT TO ONE PURPOSE LINE (Layout Pass §6) ═══
     It read "Every conversation a flag was raised on, worst first. Each row is
     one conversation and holds all of its flags." — two sentences where the
     second was teaching the reader to interpret the list. The `n in this
     conversation` marker on the row already says the load-bearing part, at the
     row it is true of, which is where a reader needs it. */
  /* NEEDS-COPY-NICOLE */
  "risk-flags": "Every conversation a flag was raised on, worst first.",
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
  /** ═══ §5's TWO AXES, PERSISTED PER DESTINATION ═══
   *  Read with the default folded in here rather than in the store, so an
   *  absent key stays absent: a stored `{}` and a stored default are the same
   *  rendering but different facts, and only the first moves if the default
   *  ever does. */
  const storedView = useOnboardingStore((st) => st.viewOptions["risk-flags"]);
  const setViewOptions = useOnboardingStore((st) => st.setViewOptions);
  const preset: ViewPreset = storedView?.preset ?? VIEW_OPTIONS_DEFAULT.preset;
  /** ═══ FILTERS ARE `useState`, AND THAT IS THE ENFORCEMENT (§6.4) ═══
   *  "Filters do not persist across sessions. This is a safety rule, not a
   *  preference." Held here rather than in the store, so the rule is a fact
   *  about where the state lives rather than a comment asking the next person
   *  to remember it — `view-options` is the persisted axis and these are not,
   *  and the difference is visible in one line. */
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

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

  /** ═══ EVERY EVENT THE FIXTURE HOLDS, resolved or not ═══
   *  The QUEUE is the open subset below. This set is what a RECORD is joined
   *  against — its timeline, and the flags attached to it — because a record's
   *  history does not change because a supervisor closed something in this
   *  session. Before §2.8 nothing needed the difference: an escalated flag
   *  stayed open, so the queue and the join were the same list. */
  const allEvents = useMemo(() => sortEvents(data?.events ?? []), [data]);
  const events = useMemo(
    () => allEvents.filter((e) => !resolvedIds.has(e.id)),
    [allEvents, resolvedIds]
  );

  /* `filtered` WAS THE SUBJECT-FILTERED VIEW OF `events`. With one subject the
     two are the same set, and the alias stays only because it names what the
     pane and the keyboard read: the list as the reader sees it. */
  const filtered = events;

  /** ═══ THE HEADER'S TWO FIGURES, AND THE SHIFT'S SET (addendum §2.10, §2.11) ═══
   *
   *  `openFlagCount` counts FLAGS, not rows: a row is a conversation and holds
   *  several, and "60 open" on a queue of 123 flags would be the coalescing
   *  telling a reader the work is half what it is.
   *
   *  THE TRACK'S DENOMINATOR IS THE SHIFT'S SET — everything that arrived,
   *  open or already reviewed — which is the only denominator that can reach
   *  100%. Counting against what is still OPEN would give a fraction that
   *  moves both ways and never completes, and §3.4's whole argument is that
   *  the ending is the thing worth investing in.
   *
   *  MEASURED FROM `resolvedIds`, which is this session's closures. A
   *  supervisor who reloads starts the track at zero, and that is honest for a
   *  prototype that persists no decision — gap row 430. Stated rather than
   *  faked with a seeded head start. */
  const allFlagCount = useMemo(
    () => allEvents.length,
    [allEvents]
  );
  const openFlagCount = events.length;
  /** ═══ THE TRACK IS THE SHIFT'S, AND FILTERS DO NOT TOUCH IT ═══
   *  §3.4's argument is that the ending is the thing worth investing in, and
   *  the denominator is everything that arrived this shift. A filtered
   *  denominator would make the bar jump backwards when a supervisor typed in
   *  the search box — progress is a fact about the shift, not about the
   *  current view of it. So this reads `openFlagCount`, the unfiltered open
   *  count, while the header's figures read the filtered set. */
  const flagProgress = useMemo(
    () => ({ done: allFlagCount - openFlagCount, total: allFlagCount }),
    [allFlagCount, openFlagCount]
  );

  /** ═══ THE LIST'S UNIT IS A CONVERSATION (addendum §3.1) ═══
   *  Built from the already-filtered, already-resolve-filtered events, so a
   *  row disappears when its last member is closed and shrinks when one is. */
  /** THE UNFILTERED ROWS, in comparator order. */
  const allGroups = useMemo(
    () => sortGroups(groupByConversation(filtered)),
    [filtered]
  );

  /** ═══ THE FILTER ADAPTER (§6) ═══
   *  `lib/ui/filters.ts` depends on neither surface's model — it asks for a
   *  haystack and an instant, which is all any dimension here needs. Decorating
   *  rather than widening `FlagGroup` keeps the comparator's own keys the only
   *  things that file defines, and the spread is safe because a group is a
   *  plain object.
   *  THE HAYSTACK IS BOTH NAMES, which is §6.1's collapse: "`mentee` and
   *  `mentor` collapse into search. One field matching either name is more
   *  useful than two dropdowns and covers both." */
  type G = FlagGroup & Filterable;
  const decorated = useMemo<G[]>(
    () =>
      allGroups.map((g) => ({
        ...g,
        searchText: `${g.teenName} ${g.mentorName}`,
        at: g.oldestAt,
      })),
    [allGroups]
  );

  /** ═══ THREE DIMENSIONS, AND TWO THAT WERE CUT (§6.1, §6.2, §6.3) ═══
   *
   *  CUT, both reported before this was built and both cut on the answer:
   *
   *   · DIRECTION (teen- / mentor-authored). Nothing records the flagged
   *     message's author. `RiskFlagPayload` has `sourceType`, `reportedBy`,
   *     `categories`, `flaggedExcerpt`, `aiRationale`, `flaggedCorrectly` and
   *     `conversationFlagCount` — and it is not derivable either, because
   *     `conversation.ts` builds the anchor with `sender: "teen"` hardcoded.
   *     So 100% of flags are teen-authored by construction: the control would
   *     have offered one value returning everything and one returning the
   *     filtered-empty state, which on a safety queue reads as "no
   *     mentor-authored flags exist" when the system cannot represent one.
   *   · DISPOSITION STATE. A `watch`-effect disposition calls `setDisposition`
   *     in the PANE and returns without reaching this page, so the mark is
   *     gone the moment another row is selected. There is nothing to filter.
   *
   *  ═══ AND THE PLAYBOOK GROUP IS (a), NOT SEVERITY (§6.2) ═══
   *
   *  `tierOf(category)` is a pure derived read of the playbook — 21 enumerated
   *  categories behind it — which is why `risk-taxonomy.ts` kept it when
   *  arch-mon removed the per-flag assertion: "THIS one is a clinical registry
   *  […] rather than a severity guess, which is why it survives."
   *  IT MUST NEVER READ `RiskFlagPayload.tier`. That field is still populated
   *  and would "work", and reading it would silently restore exactly the
   *  assertion arch-mon removed.
   *  LABELLED FROM `TIER_LABEL`, so it says "Clinical support" — the product
   *  owner's term, and the label every other surface uses (gap rows 362/374).
   *  NO PERCENTILES: the playbook defines these bands as "Top 1%" / "Top 5%",
   *  and that file is explicit that "a percentile attached to a child IS a risk
   *  score". The band is named by its response, never by its rank. */
  const dimensions = useMemo<FilterDimension<G>[]>(
    () => [
      {
        id: "category",
        /* NEEDS-COPY-NICOLE */
        label: "Category",
        primary: true,
        options: (items) => {
          const seen = new Map<string, string>();
          for (const g of items) {
            if (g.worstCategory == null) continue;
            seen.set(g.worstCategory, riskCategoryLabel(g.worstCategory));
          }
          return [...seen]
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
        },
        match: (g, v) => g.worstCategory === v,
      },
      {
        id: "playbookGroup",
        /* NEEDS-COPY-NICOLE. Named for what it IS — the playbook's own
           grouping — and deliberately not "Risk", which would imply the
           per-flag severity this product removed. */
        label: "Playbook group",
        options: (items) => {
          const present = new Set(
            items.map((g) => tierOf(g.worstCategory ?? "")).filter(Boolean)
          );
          return TIER_ORDER.filter((t) => present.has(t)).map((t) => ({
            value: t,
            label: TIER_LABEL[t],
          }));
        },
        match: (g, v) => tierOf(g.worstCategory ?? "") === v,
      },
      timeDimension<G>(now),
    ],
    [now]
  );

  /** SUBSET, NEVER A RE-SORT — see `applyFilters`. */
  const groups = useMemo(
    () => applyFilters(decorated, dimensions, filters),
    [decorated, dimensions, filters]
  );
  const filtering = isFiltering(filters);

  /** ═══ THE HEADER'S TWO FIGURES DESCRIBE WHAT IS ON SCREEN (§6.4) ═══
   *
   *  Both are computed from `groups` — the filtered rows — because a count
   *  beside a list it does not describe is the lie §6.4 names. Unfiltered they
   *  equal what they were: `groups` is `allGroups` when nothing is narrowing.
   *
   *  THE UNIT IS STILL FLAGS, NOT ROWS (addendum §3.1). A row is a conversation
   *  and holds several, so summing members is what keeps "69 open" from
   *  becoming the coalescing telling a reader the work is half what it is.
   *
   *  `flagProgress` IS DELIBERATELY NOT FILTERED — see its own note below. */
  const shownFlagCount = useMemo(
    () => groups.reduce((n, g) => n + g.events.length, 0),
    [groups]
  );
  /** NEEDS-COPY-NICOLE. The oldest flag's age in the visible set. Null when
   *  there is none, which the header renders as an em dash rather than "0h":
   *  there is no oldest flag, which is different from one that is zero hours
   *  old. */
  const oldestFlagAge = useMemo(() => {
    if (groups.length === 0) return null;
    return ageLabel(Math.min(...groups.map((g) => g.oldestAt)), now).replace(
      / ago$/,
      ""
    );
  }, [groups, now]);

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
  /* ═══ `Full width` IS GONE (Refinement §4) ═══
     The layout axis is removed: "the pane is the point of the workflow on both
     surfaces", so a mode that hid it never earned itself. What went with it —
     recorded because each piece existed for a reason and the reasons no longer
     apply — is the `fullWidth` derivation, the one-column grid arm, the `wide`
     prop on `EventList` and its row, and the back control's `xl` exception. */
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

  /** ═══ ESCALATE — ONE PATH, TWO CALLERS ═══
   *  The pane's button and the keyboard's `e`. Defined here rather than
   *  inline in the JSX because a key binding that duplicated this would be
   *  a second place for the link-and-close semantics to drift. */
  const onEscalateEvent = (e: MonitoringEvent) => {
    /* ═══ THE FLAG BECOMES PART OF AN ESCALATION RECORD ═══
       ═══ AND IT LEAVES THE QUEUE (addendum §2.8) ═══
       Phase 6 built this so the flag STAYED — "escalating is
       the moment it stopped being handled", so resolving would
       file it as handled. §2.8 reverses that, and the reversal
       is coherent rather than a change of mind: the flag is
       LINKED to the record now and renders inside it, so it has
       not stopped being handled — it has moved to where the
       handling is. Leaving it in the queue as well would ask a
       supervisor to disposition a flag whose escalation they
       are already working. */
    setResolvedIds((prev) => new Set(prev).add(e.id));
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
        /* THE FLAG THAT RAISED IT, ATTACHED. Plus anything the
           interim auto-link rule catches on the same
           conversation — see `autoLinkedFor`. */
        linkedFlagIds: autoLinkedFor(e, groups),
      },
    ]);
    setSelectedEscalationId(`esc-from-${e.id}`);
    /* NEEDS-COPY-NICOLE. It says where the flag WENT, because
       "escalation opened" alone leaves a reader looking for a
       row that is no longer in the queue. */
    setAnnouncement(
      "Escalation opened. The flag is marked reviewed and attached to it."
    );
    }

;

  useTaskShortcuts({
    /* `y`/`n` RECORD CLASSIFIER ACCURACY AND RESOLVE NOTHING. The old binding
       resolved the event from a key, which is the one-tap closure Phase 2
       removed — a clinical disposition cannot come from a keystroke. */
    onAnswer: (accurate) => {
      paneHandle.current.accuracy?.(accurate);
      return;
    },
    /* ═══ `1`/`2`/`3` DO WHAT `y`/`n` ARE FORBIDDEN TO DO, AND THAT IS NOT A
       CONTRADICTION (addendum §3.3) ═══
       The rule Phase 2 established is that a clinical disposition cannot come
       from a keystroke that does not NAME one. `y` means "the classifier was
       right", and resolving on it closed a record on a judgment about a
       model. A digit selects a specific clinical value and commits that
       value — the sheet says which — so the record carries the statement the
       supervisor chose. */
    onDigit: (index) => paneHandle.current.commitDisposition?.(index),
    onEscalate: () => {
      if (selectedEvent) onEscalateEvent(selectedEvent);
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
    <div
      /* ═══ 1800px, AND WHY NOT 1400 AND WHY NOT UNCAPPED (Layout Pass §2) ═══
         MEASURED at 2560×1440 before this change: the container capped at 1400
         and `mx-auto` centred it, so the dead space was not pooled on the right
         as it looked — it was 448px on the left and 464px on the right, 944px
         of a 2312px main area carrying nothing. 41%.
         1800 IS DERIVED FROM THE LIST, NOT THE VIEWPORT. At 1800 the content
         column is 1736 (px-8 either side); the pane takes its fixed 790 and the
         20px gap, leaving the list 926px. That is about the widest a two-line
         row reads as one object: past it the identity block and the
         right-aligned age are far enough apart that the eye has to travel
         between them, which is the failure an uncapped list would produce
         rather than the crampedness this pass is fixing.
         WHAT IT DOES NOT DO is fill a 2560 display. 248px stays dead either
         side, deliberately — §2 asked for "a sensible max", and a list row is
         not a thing that benefits from 1736px of width. */
      className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col px-6 py-6 lg:px-8"
    >
      <PageHeader
        title={SCOPE_TITLE[scope]}
        purpose={SCOPE_PURPOSE[scope]}
        metrics={
          /* ═══ THE METRICS, AND THE DEFECT THEY FIX (addendum §2.10) ═══
             The subtitle here stated OBLIGATIONS — "2 escalations awaiting
             acknowledgement · 3 close-out items overdue" — which is a reading,
             not a purpose, and it competed with the sentence saying what the
             destination is for.
             MEASURED, the reading was also wrong: `closeOutOverdue` counts
             BREACHES, so a record with four close-out items and 22h left on
             them produced "No escalation clocks outstanding" directly above
             those clocks. `closeOutOpen` is the count §2.10 asks for.
             NEEDS-COPY-NICOLE on every label. None frames the work as an inbox:
             "open" is a state, "left" would be a remainder. */
          mounted
            ? scope === "escalations"
              ? [
                  { value: String(obligations.active), label: "active" },
                  {
                    value: String(obligations.closeOutOpen),
                    label: "close-out items open",
                  },
                ]
              : [
                  /* ═══ THE COUNT DESCRIBES THE VISIBLE LIST, AND SAYS SO (§6.4) ═══
                     "Header counts must reflect the filtered set when filters
                     are active, and say so — a count that silently describes a
                     different set than the visible list is lying."
                     THE LABEL IS WHERE IT SAYS SO. `6 of 69 open` would put the
                     unfiltered total in the figure position, which is the one
                     place a reader is entitled to read the list's own size; the
                     figure stays the list's and the label carries the
                     qualification. NEEDS-COPY-NICOLE on both forms. */
                  {
                    value: String(shownFlagCount),
                    label: filtering ? "open · filtered" : "open",
                  },
                  {
                    value: oldestFlagAge ?? "—",
                    label: "oldest",
                  },
                ]
            : []
        }
        progress={
          mounted && scope === "risk-flags" ? (
            /* NEEDS-COPY-NICOLE. THE UNIT IS FLAGS, not conversations: §2.11
               measures what a supervisor has been through, and the row is a
               conversation while the work is a flag. */
            <ShiftTrack
              progress={flagProgress}
              unit="flags reviewed this shift"
              completeLine="Every flag that arrived this shift has been reviewed"
            />
          ) : null
        }
      >
        {/* ═══ THE PIPELINE'S HEALTH IS NOT A METRIC ═══
            NEEDS-COPY-NICOLE. Zero flags is ambiguous between a quiet shift and
            a broken safety pipe, which is the highest-value distinction on this
            page — and it is a STATE rather than a figure, so it cannot be a
            metric pair. It sits beside them, and it outranks them: when the
            pipeline is down the numbers below it are not measuring anything. */}
        {/* ═══ THE VIEW CONTROL MOVED TO THE LIST'S TOOLBAR (§5) ═══
            MEASURED here: it sat at x=1374 while the list column it governs
            ended at x=842 — 532px away, in the gap between the list and the
            metric cluster, belonging to neither. It is in the toolbar below,
            right-aligned to the list column's own edge. */}
        {mounted && scope === "risk-flags" && data?.classifier === "degraded" && (
          <p
            role="status"
            data-anno-ref="pipeline-down"
            className="max-w-[18rem] text-right text-[12.5px] leading-[17px] font-semibold text-[var(--state-error)]"
          >
            Flag pipeline is down — no flags are arriving
          </p>
        )}
      </PageHeader>

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

      {/* ═══ 40px UNDER THE HEADER (§2) ═══
          MEASURED before: 36px here (24 + the scroller's own 12) on Risk Flags
          against 24px on Care Reviews — two surfaces disagreeing about the same
          gap. One value, on both, and a step up from either: §2 asks the header
          to feel like a header rather than a line of text sitting on a table. */}
      <div className="mt-10 min-h-0 flex-1">
        <div
          className={cn(
            "grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-5",
            /* ONE COLUMN WHEN THERE IS ONE COLUMN. A 40/60 grid with an absent
               first child leaves the pane in the 60% track and 40% of the width
               blank, which reads as a failed render rather than a full-width
               record. */
            paneOnly
              ? "xl:grid-cols-[minmax(0,1fr)]"
              : /* ═══ THE PANE STOPS GROWING AT 1645px (§0, §2) ═══
                   §0: "The pane is a fixed-width column in this pass. Every unit
                   of new horizontal space goes to the list." Below 1645 nothing
                   changes — the 40/60 split is what shipped. AT 1645 the 60%
                   track measures 790px, which is what the pane already rendered
                   at on a 2560 display, so the switch to a fixed track happens
                   at the width where the two are EQUAL and the pane's rendered
                   width never changes at any viewport. Above it the pane holds
                   790 and the list takes every remaining pixel.
                   The breakpoint is arithmetic, not taste: 790 / 0.6 = 1317 of
                   content, + 64 padding + 16 the shell's pr-4 + 248 rail. */
                /* BOTH VARIANTS ARE ARBITRARY, AND THAT IS NOT A STYLE CHOICE.
                   MEASURED: written as `xl:` + `min-[1645px]:`, Tailwind emitted
                   the named breakpoint AFTER the arbitrary one, so at 2560 the
                   40/60 rule won and the columns came out 686/1030 — the pane
                   1030px WIDER than it had ever rendered, which is the §0
                   violation this rule exists to prevent. Two arbitrary `min-[]`
                   variants sort against each other by value, so the order is
                   the arithmetic rather than the emitter's category ranking.
                   1280 is `xl` spelled out; nothing below this line changed. */
                "min-[1280px]:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] min-[1645px]:grid-cols-[minmax(0,1fr)_790px]"
          )}
        >
          {!paneOnly && (
          <div className={cn("flex min-h-0 flex-col gap-3", paneTakeover && "hidden xl:flex")}>
            {/* ═══ THE TOOLBAR SPANS THE LIST COLUMN (§5) ═══
                Filters left, View right-aligned to this column's own edge. It
                is inside the column rather than above the grid, so both are
                true at every width the grid reflows through. */}
            {mounted && (
              <ListToolbar
                items={decorated}
                dimensions={dimensions}
                filters={filters}
                onFilters={setFilters}
                preset={preset}
                onPreset={(p) => setViewOptions("risk-flags", { preset: p })}
                /* NEEDS-COPY-NICOLE. §6.1: one field for both names. */
                searchHint="Search teen or mentor"
              />
            )}
            {/* ═══ THE VIEW TOGGLE AND THE SUBJECT CHIPS ARE BOTH GONE ═══
                The toggle swapped this column between the queue and the
                coverage roster; the chips narrowed the queue by review subject.
                Each was hidden under a scope already, because the route said
                which view and which subject — and with Coverage and Mentor
                Practice removed, neither control has a second value to offer.
                One column, one scroller, one list. */}
            <div
              data-anno-ref="monitoring-scroller"
              /* ═══ CONTENT-SIZED WITH A FLOOR, NOT A 1200px BOX (§2) ═══
                 MEASURED before: `flex-1` on a column inside a `1fr` grid row
                 inside a full-height page, so the card absorbed the viewport —
                 1202px tall at a 1440px viewport, holding two rows. §2 is right
                 that this reads as a rendering fault rather than a short queue.
                 `flex-none` + `max-h-full` makes it size to its rows and stop at
                 the page; the floor is three rows at the current density, which
                 is the smallest count that still reads as a list. */
              /* ═══ CONTENT-SIZED, BUT IT MUST STILL SHRINK ═══
                 `flex-none max-h-full` was right when the card was the column's
                 only child: content-sized, capped at the column. §5 put a
                 toolbar above it, and then `max-h-full` meant 100% of a column
                 that ALSO holds 44px of toolbar and a 12px gap — so the column's
                 content exceeded the column by 56px and the overflow propagated
                 to the shell. MEASURED by `structure.two-scrollers`, which
                 counted three scroll regions where the locked decision allows
                 two: the PAGE had started scrolling, which carries the pinned
                 header off the top.
                 THE IDIOM IS THE DEFAULT ONE. A flex item with `basis: auto`
                 and `flex-shrink: 1` sizes to its content and shrinks when the
                 container cannot hold it — which is content-sizing AND fitting,
                 the two things this needs. `flex-none` was the mistake; the
                 floor below still holds it above three rows. */
              style={{ minHeight: listMinHeight(preset) }}
              className="min-h-0 overflow-y-auto rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
            >
              {listState === "loading" ? (
                <ListSkeleton preset={preset} />
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
                groups.length === 0 && filtering ? (
                /* ═══ FILTERED TO NOTHING IS NOT NOTHING TO REVIEW (§6.4) ═══
                   "A supervisor must never be able to mistake 'filtered to
                   nothing' for 'nothing to review.'" The queue's own empty
                   line refuses to congratulate — and on a filtered list it
                   would be worse than congratulating, because it would assert
                   a quiet shift while rows sit behind a dropdown.
                   IT STATES THE HIDDEN COUNT, which is the fact that
                   distinguishes the two states, and carries the way out. */
                <div role="status" className="px-6 py-6">
                  <p className="text-[14px] leading-[20px] text-[var(--text-primary)]">
                    {/* NEEDS-COPY-NICOLE */}
                    No flags match these filters.
                  </p>
                  <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
                    {/* NEEDS-COPY-NICOLE */}
                    {allGroups.length === 1
                      ? "1 conversation is hidden."
                      : `${allGroups.length} conversations are hidden.`}
                  </p>
                  <button
                    type="button"
                    data-anno-ref="clear-filters-empty"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className={cn(
                      "mt-3 inline-flex min-h-11 items-center rounded-full border border-[color:var(--border-contour)] px-3 text-[13px] font-semibold",
                      RING
                    )}
                  >
                    {/* NEEDS-COPY-NICOLE */}
                    Clear filters
                  </button>
                </div>
              ) : (
                <EventList
                  groups={groups}
                  now={now}
                  preset={preset}
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
              )
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
                  "mb-2 inline-flex min-h-9 shrink-0 self-start items-center gap-1 rounded-full px-2 text-[13px] font-semibold",
                  "xl:hidden",
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
                  /* THE WHOLE SET, for the record's timeline join and its
                     linked flags — not the queue, because a record's history
                     must not shrink as a supervisor works through the list. */
                  events={allEvents}
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
                  /** Attach an existing flag to the record on screen
                   *  (addendum §2.8). It marks the flag reviewed in the same
                   *  action — a linked flag has left the queue by definition,
                   *  and leaving it in both places is the double-disposition
                   *  the linkage exists to prevent. */
                  onLinkFlag={(flagId) => {
                    const rec = selectedEscalation;
                    if (!rec) return;
                    setResolvedIds((prev) => new Set(prev).add(flagId));
                    setRaised((prev) => {
                      const has = prev.some((r) => r.id === rec.id);
                      const link = (r: EscalationRecord) =>
                        r.id === rec.id
                          ? { ...r, linkedFlagIds: [...r.linkedFlagIds, flagId] }
                          : r;
                      /* A FIXTURE RECORD IS NOT IN `raised`, so linking to one
                         copies it in — the same shape as every other
                         page-local decision on this surface, which layers over
                         an immutable fixture rather than editing it. */
                      return has
                        ? prev.map(link)
                        : [...prev, link({ ...rec })];
                    });
                    /* NEEDS-COPY-NICOLE */
                    setAnnouncement("Flag attached to this escalation and marked reviewed.");
                  }}
                  onEscalate={onEscalateEvent}
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
