// ═══════════════════════════════════════════════════════════════════════════
// THE SCENARIO CATALOGUE — ONE LIST, GROUPED, WITH ROUTES (bar-02)
//
// ═══ WHY THIS EXISTS ═══
//
// The bar built its `<optgroup>`s inline from five registries plus the record
// scenarios, and bar-02 needs the same set in a panel — page-scoped, searchable,
// with a recents row. Building that list twice is how the two controls come to
// disagree about what exists, which is the defect class `proposalCaption` and
// the shared review row were both extracted to end.
//
// AND SCOPING NEEDS SOMETHING THE OPTGROUPS DID NOT CARRY. bar-02 wants the
// panel "page-scoped by default", so every group has to know WHICH ROUTES it
// belongs to. That fact existed only as the shape of the bar's `onChange`
// branches; here it is data.
//
// ═══ THE PREFIXES ARE THE FAMILY, AND THEY STAY ═══
//
// `tasks:` / `today:` / `activity:` / `chat:` / `monitoring:` — one select
// carries five independent axes and an unprefixed id could collide with a record
// scenario's. bar-04 will migrate ids; the prefixes are not ids and are not part
// of that.
//
// RECORD SCENARIOS CARRY NO PREFIX, which is not an oversight: they NAVIGATE
// (`scenarioHref`) rather than setting an axis, so their value is the bare id
// the record route reads from the URL. The bar's `onChange` has always branched
// on that difference and still does.

import { ACTIVITY_SCENARIOS } from "@/lib/activity/seed";
import { CHAT_SCENARIOS } from "@/lib/chat/seed";
import { TODAY_SCENARIOS } from "@/lib/home/scenarios";
import { MONITORING_SCENARIO_GROUPS } from "@/lib/monitoring/scenarios";
import { MONITORING_MOCKS } from "@/lib/monitoring/monitoring.mock";
import { TASK_SCENARIOS } from "@/lib/tasks/seed";
import { STAFF_SCENARIOS, TEEN_SCENARIOS } from "@/lib/dev/record-scenarios";
import {
  ACTIVITY_ROUTES,
  CHAT_ROUTES,
  MONITORING_ROUTES,
  RECORD_ROUTES,
  TASKS_ROUTES,
  TODAY_ROUTES,
  onAxis,
} from "@/lib/dev/axes";

export const ACTIVITY_PREFIX = "activity:";
export const TASKS_PREFIX = "tasks:";
export const TODAY_PREFIX = "today:";
export const CHAT_PREFIX = "chat:";
export const MONITORING_PREFIX = "monitoring:";

export interface ScenarioItem {
  /** The value the select carries — prefixed, except for record scenarios. */
  value: string;
  /** TODO-COPY — dev chrome. The label as the registry states it. */
  label: string;
  /** For search. Lower-cased once here rather than per keystroke. */
  haystack: string;
}

export interface ScenarioGroup {
  /** TODO-COPY. The group heading, matching the bar's `<optgroup>` labels. */
  label: string;
  /** Which routes this group's scenarios apply to. Empty means "everywhere",
   *  which nothing uses today and is here so a future family cannot be forced
   *  to lie about its scope. */
  routes: readonly string[];
  items: ScenarioItem[];
}

const item = (value: string, label: string): ScenarioItem => ({
  value,
  label,
  haystack: `${label} ${value}`.toLowerCase(),
});

/** ═══ THE GROUPS, IN THE ORDER THE BAR ALREADY SHOWED THEM ═══
 *  Order is preserved deliberately: a reviewer's muscle memory for this list is
 *  worth more than any re-sort, and bar-02 changes the container rather than the
 *  contents. `scen-01`/`scen-02` own consolidation.
 *
 *  THE `Tasks` GROUP IS `Care Reviews` NOW — renamed in the Care Reviews rework
 *  §9, because the group navigated to `/app/care-reviews` while calling itself by
 *  the destination name the addendum retired. */
export const SCENARIO_CATALOGUE: readonly ScenarioGroup[] = [
  {
    label: "Teen record",
    routes: RECORD_ROUTES,
    items: TEEN_SCENARIOS.map((s) => item(s.id, s.label)),
  },
  {
    label: "Staff record",
    routes: RECORD_ROUTES,
    items: STAFF_SCENARIOS.map((s) => item(s.id, s.label)),
  },
  {
    label: "Activity",
    routes: ACTIVITY_ROUTES,
    items: ACTIVITY_SCENARIOS.map((s) => item(`${ACTIVITY_PREFIX}${s.id}`, s.label)),
  },
  {
    label: "Today",
    routes: TODAY_ROUTES,
    items: TODAY_SCENARIOS.map((s) => item(`${TODAY_PREFIX}${s.id}`, s.label)),
  },
  {
    label: "Care Reviews",
    routes: TASKS_ROUTES,
    items: TASK_SCENARIOS.map((s) => item(`${TASKS_PREFIX}${s.id}`, s.label)),
  },
  /* ═══ MONITORING v3 (§6) ═══ Every Watch and Events state, one click
     each, from `monitoring.mock.ts` — first, ahead of the legacy groups; and
     a Reset back to no scenario. */
  {
    label: "Monitoring · Watch",
    routes: MONITORING_ROUTES,
    items: [item(`${MONITORING_PREFIX}`, "Reset — no scenario"), ...MONITORING_MOCKS.filter((m) => m.tab === "watch").map((m) => item(`${MONITORING_PREFIX}${m.id}`, m.label))],
  },
  {
    label: "Monitoring · Events",
    routes: MONITORING_ROUTES,
    items: MONITORING_MOCKS.filter((m) => m.tab === "events").map((m) => item(`${MONITORING_PREFIX}${m.id}`, m.label)),
  },
  ...MONITORING_SCENARIO_GROUPS.map((g) => ({
    label: `Monitoring · ${g.label}`,
    routes: MONITORING_ROUTES,
    items: g.scenarios.map((s) => item(`${MONITORING_PREFIX}${s.id}`, s.label)),
  })),
  {
    label: "Mentor chat",
    routes: CHAT_ROUTES,
    items: CHAT_SCENARIOS.map((s) => item(`${CHAT_PREFIX}${s.id}`, s.label)),
  },
] as const;

/** Every item, flat. Used by the recents row and by the label lookup. */
export const SCENARIO_INDEX: ReadonlyMap<string, { label: string; group: string }> =
  new Map(
    SCENARIO_CATALOGUE.flatMap((g) =>
      g.items.map((i) => [i.value, { label: i.label, group: g.label }] as const)
    )
  );

export function scenarioLabel(value: string): string | undefined {
  return SCENARIO_INDEX.get(value)?.label;
}

/** The group a value belongs to, for the "does not apply here" notice. */
export function scenarioGroupOf(value: string): ScenarioGroup | undefined {
  return SCENARIO_CATALOGUE.find((g) => g.items.some((i) => i.value === value));
}

/** Whether a scenario's family applies to the route being viewed. bar-02 allows
 *  selecting an out-of-scope scenario and requires the control to SAY so — this
 *  is what it says it from. */
export function scenarioAppliesHere(value: string, pathname: string): boolean {
  const g = scenarioGroupOf(value);
  if (!g) return false;
  if (g.routes.length === 0) return true;
  return onAxis(pathname, g.routes);
}

/** ═══ PAGE-SCOPED BY DEFAULT ═══
 *  The groups whose routes match, in catalogue order. Returns an EMPTY array on
 *  a route with no scenarios rather than falling back to everything — the panel
 *  renders that as its own state, and a silent fall-back to 83 options would be
 *  the control deciding the reviewer meant something else. */
export function groupsForRoute(pathname: string): ScenarioGroup[] {
  return SCENARIO_CATALOGUE.filter(
    (g) => g.routes.length === 0 || onAxis(pathname, g.routes)
  );
}

/** Filter by the search term, dropping groups left empty. Case-insensitive, and
 *  matches the id as well as the label so `tasks:quiet` finds a scenario whose
 *  label does not contain the word. */
export function filterGroups(groups: ScenarioGroup[], term: string): ScenarioGroup[] {
  const q = term.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.haystack.includes(q)) }))
    .filter((g) => g.items.length > 0);
}

export function countItems(groups: ScenarioGroup[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}

/** ═══ WHEN THE SEARCH FIELD APPEARS ═══
 *  bar-02: "only render it when the visible list exceeds ~9 items. A search box
 *  on a seven-item list is friction." The threshold lives here beside the list
 *  it measures rather than in the component. */
export const SEARCH_THRESHOLD = 9;
