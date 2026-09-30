// ═══════════════════════════════════════════════════════════════════════════
// THE DEV BAR'S AXES, DECLARED ONCE (bar-01)
//
// ═══ WHAT THIS REPLACES ═══
//
// Scope lived in LABEL TEXT. The Load control read
// `Load (Activity, Tasks, Monitoring, Home)` and the Clock read
// `Clock (Today, Monitoring)` — ~38 characters of bar width each, spent telling
// a reader where a four-option control applies.
//
// THAT IS THE WRONG PLACE FOR APPLICABILITY AND IT DRIFTED, exactly as bar-00
// predicted: two of Load's four names were already wrong. "Tasks" is the
// destination the addendum RETIRED (the surface is Care Reviews), and "Home" is
// the LOADER's domain name for a route called Today everywhere a reader can see.
// A label cannot be enforced, so nothing caught either.
//
// ═══ THE MEASURED PROBLEM THIS SOLVES ═══
//
// bar-00 operated every route × axis cell: **26 were enabled but inert**, and
// `dev-bar.tsx` contained **zero** `disabled` attributes. Nielsen #1 — a control
// that presents as operable and does nothing is worse than a disabled one.
//
// ═══ THREE STATES, NOT TWO, AND THE THIRD IS THE INTERESTING ONE ═══
//
// bar-01 as written says "disable inert controls". Applied to Load that would be
// WRONG, and bar-00 found why: `anno-layer.tsx` reads `devLoadState` to capture
// it into every comment's `context`, and `deeplink.ts` writes it to the URL and
// compares it in `restoreCommentContext`. Measured, a stored comment's context is
// `{ route, role, scenario, loadState, viewportWidth }`.
//
// So a cell can be RENDER-INERT BUT CONTEXT-LIVE. Disabling Load on those routes
// would make a capturable axis unsettable precisely where a reviewer is
// annotating — it would fix a small lie by building a bigger one.
//
//   · `live`     — changes what renders here.
//   · `recorded` — changes nothing on screen, but is captured onto any comment
//                  placed here. Operable, and says so.
//   · `n/a`      — changes nothing and is not recorded. Disabled, with a reason.
//
// ═══ THE ROUTE LISTS ARE THE EXISTING ONES ═══
//
// `TASKS_ROUTES` / `TODAY_ROUTES` / `MONITORING_ROUTES` already existed in
// `dev-bar.tsx` for the scenario select's own navigation, and the `startsWith`
// matcher with them. They move here rather than being rewritten, so the scenario
// axis keeps behaving exactly as it did and this file is the only place any axis
// states where it applies.

import { LOAD_STATES, type LoadState } from "@/lib/dev/load-state";

/** How an axis relates to the route a reader is on. See the header. */
export type AxisApplicability = "live" | "recorded" | "n/a";

/** ═══ THE ROUTE LISTS, MOVED NOT REWRITTEN ═══
 *  Lifted verbatim from `dev-bar.tsx`, including the `/app/tasks` retired hop —
 *  which stays because a reader already sitting on it counts as on-axis, and
 *  dropping it would change the scenario select's behaviour in a phase that is
 *  only supposed to stop the bar misrepresenting itself. */
export const TASKS_ROUTES = ["/app/care-reviews", "/app/tasks"] as const;
export const TODAY_ROUTES = ["/app/today"] as const;
export const MONITORING_ROUTES = [
  "/app/escalations",
  "/app/risk-flags",
  "/app/mentor-practice",
  "/app/coverage",
  "/app/monitoring",
] as const;
export const ACTIVITY_ROUTES = ["/app/activity"] as const;
export const CHAT_ROUTES = ["/app/chat"] as const;
export const RECORD_ROUTES = ["/admin/person"] as const;

/** `startsWith`, the matcher the bar already used — see its note on why
 *  `/app/escalation` must not match `/app/escalation/{id}`. */
export const onAxis = (pathname: string, routes: readonly string[]) =>
  routes.some((r) => pathname.startsWith(r));

/** ═══ WHERE LOAD STATES ACTUALLY RENDER ═══
 *  Established by operation in bar-00, not by reading a label. Each of these
 *  four renders an error region with a retry under `Load = error`; the measured
 *  copy is in `docs/devbar/RECON.md`.
 *  THE RECORD ROUTE IS DELIBERATELY ABSENT even though it is a real surface:
 *  it has no load states, which bar-00 names as one of seven genuine coverage
 *  holes. Listing it here would assert coverage that does not exist. */
export const LOAD_LIVE_ROUTES = [
  ...ACTIVITY_ROUTES,
  ...TASKS_ROUTES,
  ...MONITORING_ROUTES,
  ...TODAY_ROUTES,
] as const;

/** ═══ WHERE A PINNED CLOCK CHANGES ANYTHING ═══
 *  `devClockKey`'s only consumers are `today-page.tsx` and
 *  `monitoring-page.tsx` — confirmed by import, and by operation: pinning
 *  `mon-overlap` on Today moved the greeting to "Good evening" and the
 *  now-marker to 5:00–5:30 PM. */
export const CLOCK_LIVE_ROUTES = [...TODAY_ROUTES, ...MONITORING_ROUTES] as const;

/** The five axes the bar carries. `annotation` is deliberately absent: it is not
 *  a fixture axis and it applies everywhere, which is why bar-02 puts it in a
 *  different REGION of the bar rather than a different scope. */
export type AxisId = "role" | "scenario" | "load" | "clock";

export interface AxisDecl {
  id: AxisId;
  /** TODO-COPY. The control's own label — and it no longer carries a scope
   *  parenthetical, because scope is `appliesTo` now. */
  label: string;
  /** How many options the control offers, for the bar-02 panel's decision about
   *  whether a list needs a search field. Scenario is the only large one. */
  optionCount: number | null;
  appliesTo: (pathname: string) => AxisApplicability;
  /** TODO-COPY. Shown when the axis is not `live`. States what the axis does
   *  NOT do here — and, for `recorded`, what it still does. */
  reason: (pathname: string) => string | null;
}

/** The destination name a reader would recognise, for the reason strings. Route
 *  → label, from the route itself rather than from a second list, so a renamed
 *  destination cannot leave a stale name in a tooltip the way it just did in a
 *  control label. */
export function routeLabel(pathname: string): string {
  const seg = pathname.replace(/^\/(app|admin)\//, "").split("/")[0] ?? "";
  if (!seg) return "this page";
  if (seg === "person") return "the record";
  /* EVERY WORD, NOT JUST THE FIRST. The first version produced "Care reviews"
     for a destination every other surface calls "Care Reviews" — a wrong name in
     a reason string, which is the exact defect class the deleted label
     parentheticals were. Title-casing each word matches the nav's own labels
     for all ten live routes. */
  return seg
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const AXES: readonly AxisDecl[] = [
  {
    id: "role",
    label: "Role",
    optionCount: 4,
    /* THE ONE AXIS THAT IS LIVE EVERYWHERE. Every surface branches on persona —
       the shell, the rail, and several pages' whole contents — so there is no
       route on which changing it does nothing. */
    appliesTo: () => "live",
    reason: () => null,
  },
  {
    id: "scenario",
    label: "Scenario",
    /* 83 across 12 groups, measured. The figure is here because bar-02's panel
       gates its search field on it (`> 9`), and a number that lives beside the
       axis cannot drift from the axis the way a hard-coded threshold would. */
    optionCount: 83,
    appliesTo: (p) =>
      onAxis(p, TASKS_ROUTES) ||
      onAxis(p, TODAY_ROUTES) ||
      onAxis(p, MONITORING_ROUTES) ||
      onAxis(p, ACTIVITY_ROUTES) ||
      onAxis(p, CHAT_ROUTES) ||
      onAxis(p, RECORD_ROUTES)
        ? "live"
        : "n/a",
    reason: (p) =>
      `No scenarios for ${routeLabel(p)}. Pick one on a destination that has them.`,
  },
  {
    id: "load",
    label: "Load",
    optionCount: LOAD_STATES.length,
    /* ═══ THE THREE-STATE AXIS ═══
       Live on the four surfaces that render load states; `recorded` everywhere
       else, because the annotation layer captures it onto any comment placed
       there. Never `n/a` — see the header. */
    appliesTo: (p) => (onAxis(p, LOAD_LIVE_ROUTES) ? "live" : "recorded"),
    reason: (p) =>
      onAxis(p, LOAD_LIVE_ROUTES)
        ? null
        : `${routeLabel(p)} has no loading or error state. Still recorded on any comment you place here.`,
  },
  {
    id: "clock",
    label: "Clock",
    /* 10 positions plus the live-clock default. */
    optionCount: 11,
    appliesTo: (p) => (onAxis(p, CLOCK_LIVE_ROUTES) ? "live" : "n/a"),
    reason: (p) => `A pinned clock changes nothing on ${routeLabel(p)}.`,
  },
] as const;

export function axis(id: AxisId): AxisDecl {
  const a = AXES.find((x) => x.id === id);
  /* Throwing rather than defaulting: an unknown axis id is a typo at a call
     site, and a silent fallback would render a control scoped to the wrong
     thing — which is the class of defect this whole file exists to end. */
  if (!a) throw new Error(`Unknown dev axis: ${id}`);
  return a;
}

/** Whether a control should be operable. `recorded` IS operable — that is the
 *  whole point of the third state. */
export function axisEnabled(id: AxisId, pathname: string): boolean {
  return axis(id).appliesTo(pathname) !== "n/a";
}

/** Guards against `LoadState` drifting from the options the bar renders. */
export function isLoadState(v: string): v is LoadState {
  return (LOAD_STATES as readonly string[]).includes(v);
}
