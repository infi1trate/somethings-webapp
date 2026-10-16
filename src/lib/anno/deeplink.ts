"use client";

// DEEPLINKS — R7. `/{route}?role=…&scenario=…&load=…&comment={id}`
//
// ═══ THE HARD REQUIREMENT IS THE ORDER, NOT THE PARSING ═══
//
// "Set dev bar state before the route renders." The role is not decoration — a
// supervisor and a mentor see different screens on the same URL — so applying it
// after mount means the reviewer watches the wrong screen turn into the right
// one, and the first thing a deeplink does is look broken.
//
// So this module APPLIES ON IMPORT, not in an effect and not in a hook. Module
// side effects run while the bundle is evaluating, before React renders anything,
// and after the zustand store's own module has rehydrated from `localStorage`
// (its storage adapter is synchronous). The first client render therefore already
// has the deeplinked role, scenario and load state.
//
// ═══ WHAT THIS CANNOT FIX, AND WHY IT IS REPORTED RATHER THAN HIDDEN ═══
//
// The SERVER render cannot know any of it. The store is `localStorage`-backed, so
// SSR has no access, and the app already guards every read behind `useMounted()`
// for exactly that reason — `console-shell.tsx` renders `mounted ? persona :
// "mentor"`. That mount-gate flash predates deeplinks and applies to any
// persisted persona. What this module removes is a SECOND correction: without it
// the params would land in an effect, one commit after hydration, and the
// reviewer would see two transitions instead of one. Measured in the anno-06
// verification rather than asserted.
//
// ═══ AND WHAT IS DELIBERATELY NOT VALIDATED HERE ═══
//
// Nothing is silently coerced. An unrecognised role, scenario or load value is
// dropped, the default stands, and the parameter name is recorded so the UI can
// say which one it ignored. A deeplink that quietly renders a different state
// than it names is worse than one that admits it.

import { useOnboardingStore } from "@/lib/onboarding/store";
import { DEFAULT_LOAD_STATE, LOAD_STATES, type LoadState } from "@/lib/dev/load-state";
import { scenarioById as recordScenarioById } from "@/lib/dev/record-scenarios";
import { ACTIVITY_SCENARIOS, DEFAULT_SCENARIO_ID } from "@/lib/activity/seed";
import { DEFAULT_TASK_SCENARIO_ID, TASK_SCENARIOS } from "@/lib/tasks/seed";
import { CHAT_SCENARIOS, DEFAULT_CHAT_SCENARIO_ID } from "@/lib/chat/seed";
import type { Comment } from "@/lib/anno/types";
import type { Persona } from "@/lib/types";

export const PARAM = {
  role: "role",
  scenario: "scenario",
  load: "load",
  comment: "comment",
} as const;

/** The five personas. Written out rather than derived, because this list is
 *  consulted before anything else is trusted. */
const ROLES: Persona[] = ["new-mentor", "mentor", "lead-mentor", "supervisor", "admin"];

/** ═══ AN INVALID VALUE FALLS BACK TO THE DEFAULT, NOT TO WHATEVER WAS THERE ═══
 *
 *  The first implementation simply skipped an unrecognised value, leaving the
 *  axis as the store had it. The anno-06 verification caught the cost: a link
 *  carrying `load=sideways` landed showing `error`, because a previous session
 *  had persisted `error` — so the SAME LINK produced different screens for
 *  different people, which is the one thing a deeplink exists to prevent.
 *
 *  Resetting to the default makes the link deterministic: everything it names is
 *  applied, and everything it names badly is a known state rather than a
 *  leftover. The parameter is still reported as ignored either way. */
const DEFAULT_PERSONA: Persona = "mentor";

/** Appendix A stores `lead_mentor`; the app spells it `lead-mentor`. The two
 *  conversions live together so they cannot drift — see `types.ts`. */
function personaFromAnnoRole(role: Comment["context"]["role"]): Persona {
  return role === "lead_mentor" ? "lead-mentor" : role;
}

export type IgnoredParam = { param: string; value: string; reason: string };

export type Arrival = {
  /** The comment the link is pointing at, if any. */
  commentId: string | null;
  /** Params that were present, unrecognised, and therefore not applied. */
  ignored: IgnoredParam[];
  /** True when this page load came from a deeplink at all. */
  isDeeplink: boolean;
};

const EMPTY: Arrival = { commentId: null, ignored: [], isDeeplink: false };

/** Which scenario axis a route uses. The record axis is a URL param the dev bar
 *  already reads, so it needs no store write — only validating and reporting. */
function scenarioAxis(path: string): "activity" | "tasks" | "chat" | "record" {
  if (path.startsWith("/app/activity")) return "activity";
  /* `/app/care-reviews` IS THE TASKS AXIS. The surface moved routes in Phase 2;
     the scenario driving it did not. `/app/tasks` stays listed because it is a
     live hop and a deeplink may still carry it.
     STILL OPEN, AND PRE-EXISTING: there is no `monitoring` axis here, so the
     four Monitoring destinations fall through to `record` exactly as
     `/app/monitoring` always did. Reported rather than widened, because adding
     an axis means adding its param validation too. */
  if (path.startsWith("/app/care-reviews") || path.startsWith("/app/tasks")) {
    return "tasks";
  }
  if (path.startsWith("/app/chat")) return "chat";
  return "record";
}

function applyFromLocation(): Arrival {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return EMPTY;
  }

  const ignored: IgnoredParam[] = [];
  const commentId = params.get(PARAM.comment);
  const rawRole = params.get(PARAM.role);
  const rawLoad = params.get(PARAM.load);
  const rawScenario = params.get(PARAM.scenario);

  const isDeeplink = Boolean(commentId || rawRole || rawLoad);
  if (!isDeeplink && !rawScenario) return EMPTY;

  /* ═══ ONE `setState`, NOT THREE ═══
     Each `set` on a persisted store writes `localStorage` and notifies every
     subscriber. Batching means one write and one notification, which also means
     no intermediate state in which the role has changed but the load state has
     not — a reviewer could otherwise observe a combination the link never
     described. */
  const patch: Partial<{
    persona: Persona;
    devLoadState: LoadState;
    activityScenarioId: string;
    tasksScenarioId: string;
    chatScenarioId: string;
  }> = {};

  if (rawRole !== null) {
    if ((ROLES as string[]).includes(rawRole)) {
      patch.persona = rawRole as Persona;
    } else {
      patch.persona = DEFAULT_PERSONA;
      ignored.push({
        param: PARAM.role,
        value: rawRole,
        reason: "not a role this prototype has",
      });
    }
  }

  if (rawLoad !== null) {
    if ((LOAD_STATES as readonly string[]).includes(rawLoad)) {
      patch.devLoadState = rawLoad as LoadState;
    } else {
      patch.devLoadState = DEFAULT_LOAD_STATE;
      ignored.push({
        param: PARAM.load,
        value: rawLoad,
        reason: "not a load state this prototype has",
      });
    }
  }

  if (rawScenario !== null) {
    const axis = scenarioAxis(window.location.pathname);
    const known =
      axis === "activity"
        ? ACTIVITY_SCENARIOS.some((s) => s.id === rawScenario)
        : axis === "tasks"
          ? TASK_SCENARIOS.some((s) => s.id === rawScenario)
          : axis === "chat"
            ? CHAT_SCENARIOS.some((s) => s.id === rawScenario)
            : recordScenarioById(rawScenario) !== null;

    if (!known) {
      ignored.push({
        param: PARAM.scenario,
        value: rawScenario,
        reason: `not a scenario this screen has`,
      });
      /* Same determinism rule. The record axis is the exception: it lives in the
         URL, which cannot be rewritten without a navigation — and the dev bar
         already renders an unrecognised value as "— none —", which IS that
         axis's default. */
      if (axis === "activity") patch.activityScenarioId = DEFAULT_SCENARIO_ID;
      else if (axis === "tasks") patch.tasksScenarioId = DEFAULT_TASK_SCENARIO_ID;
      else if (axis === "chat") patch.chatScenarioId = DEFAULT_CHAT_SCENARIO_ID;
    } else if (axis === "activity") patch.activityScenarioId = rawScenario;
    else if (axis === "tasks") patch.tasksScenarioId = rawScenario;
    else if (axis === "chat") patch.chatScenarioId = rawScenario;
    /* axis === "record" needs no write: `dev-bar.tsx` reads `?scenario=` from the
       URL directly, so the param IS the state. Validated here only so an
       unrecognised value is reported rather than silently landing on nothing. */
  }

  if (Object.keys(patch).length > 0) {
    try {
      useOnboardingStore.setState(patch);
    } catch {
      /* A store that refuses a write is not a reason to lose the arrival — the
         drawer half of the deeplink still works. */
    }
  }

  return { commentId, ignored, isDeeplink };
}

/** ═══ APPLIED ONCE, AT IMPORT ═══
 *
 *  Read and applied while the module graph evaluates — before the first render.
 *  The result is frozen for the life of the page: a later client-side navigation
 *  is not an arrival, and re-reading the URL would make one look like it. */
export const arrival: Arrival = typeof window === "undefined" ? EMPTY : applyFromLocation();

/* ════════════════════════ BUILDING A LINK ════════════════════════ */

/** ═══ THE LINK REPRODUCES THE STATE THE COMMENT WAS WRITTEN IN ═══
 *
 *  Not the state the reader is in now. That is the entire point of R13's context
 *  capture: a comment that says "this looks wrong" is only actionable if the link
 *  puts the next person in front of the same screen.
 *
 *  ═══ WHAT IS IN IT, EXACTLY ═══
 *
 *  The route, the comment's number-free id, and the three harness axes. NOT the
 *  author's client id, NOT their display name, NOT `authorIpHint` — none of which
 *  are needed to reach the comment, and all of which would travel wherever the
 *  link is pasted. The route itself carries whatever record id it always
 *  carried; that is the page's own URL, not something added here. */
export function buildCommentLink(comment: Comment, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const p = new URLSearchParams();
  p.set(PARAM.role, personaFromAnnoRole(comment.context.role));
  if (comment.context.scenario) p.set(PARAM.scenario, comment.context.scenario);
  p.set(PARAM.load, comment.context.loadState);
  p.set(PARAM.comment, comment.id);
  return `${base}${comment.context.route}?${p.toString()}`;
}

/** Copy, and report whether it worked. `navigator.clipboard` is unavailable on
 *  insecure origins and in some embedded webviews, so the caller is told rather
 *  than left to assume — a confirmation that lies is worse than none. */
export async function copyLink(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ════════════════════ AM I ALREADY LOOKING AT THIS? ════════════════════ */

/** ═══ WHY THE DRAWER ASKS THIS BEFORE FOLLOWING ITS OWN LINK ═══
 *
 *  Clicking a comment in the drawer should take you to it. When the comment is on
 *  a page you are not on, that means a real navigation, and it has to be a FULL
 *  one — `arrival` is computed at module import (see the note at the top of this
 *  file), so a client-side push would carry the route and silently drop the role,
 *  scenario and load state the comment was written in.
 *
 *  But when you are ALREADY on that page in that exact state, reloading it to
 *  arrive where you are is a page flash that throws away scroll position and
 *  every bit of unsaved harness state for no gain. So the drawer asks this first
 *  and, if it is true, scrolls and focuses the pin in place instead.
 *
 *  ALL FOUR AXES, not just the route: a comment written as a supervisor on the
 *  `heavy-day` scenario describes a screen a mentor on `— none —` is not looking
 *  at, even on the same path. If any axis differs, the honest answer is to go
 *  through the link and let it set the state. */
export function linkMatchesCurrentState(comment: Comment): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname !== comment.context.route) return false;

  let st: ReturnType<typeof useOnboardingStore.getState>;
  try {
    st = useOnboardingStore.getState();
  } catch {
    // No store, no way to know they match — so take the link, which sets them.
    return false;
  }

  if (st.persona !== personaFromAnnoRole(comment.context.role)) return false;
  if (st.devLoadState !== comment.context.loadState) return false;

  /* The record axis lives in the URL rather than the store — `dev-bar.tsx` reads
     `?scenario=` directly, so the param IS the state. Same split as
     `applyFromLocation` above, kept in the same shape so the two cannot drift. */
  const axis = scenarioAxis(comment.context.route);
  const current =
    axis === "activity"
      ? st.activityScenarioId
      : axis === "tasks"
        ? st.tasksScenarioId
        : axis === "chat"
          ? st.chatScenarioId
          : new URLSearchParams(window.location.search).get("scenario");

  return (current ?? "") === (comment.context.scenario ?? "");
}
