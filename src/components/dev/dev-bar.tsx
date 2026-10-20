"use client";

// THE DEV BAR — one slim strip, fixed along the bottom, full width.
//
// ═══════════════════════════════════════════════════════════════════════════
// IT REPLACES THE FLOATING DOCKS. There were three pieces of dev chrome floating
// over the product at different corners and z-indexes — the persona pill, the
// Activity simulator, the Tasks scenario switcher — and each new one had to dodge
// the last (`bottom-20 rather than bottom-4` is a real comment in the Tasks
// switcher). This is one bar instead, and it does NOT overlay: the body carries
// bottom padding equal to the bar's height, so no product pixel sits underneath
// it. That is the difference between a dev tool and an obstruction.
//
// ═══ TWO ORTHOGONAL AXES, AND CROSSING THEM IS THE POINT ═══
//
//   AXIS 1 · ROLE      who is viewing. Store-backed, as it already was.
//   AXIS 2 · SCENARIO  which record, and what state it is in. URL-backed.
//
// They are separate controls, never a combined list, because the permutations are
// the thing worth inspecting: "review overdue with an open escalation" × "mentor
// viewing" must show the same record with the action affordances ABSENT rather
// than disabled, and that is only checkable if the two can be set independently.
//
// ═══ SWITCHING ROLE ON A RECORD DOES NOT NAVIGATE AWAY ═══
//
// The old pill hard-navigated every persona to a fixed destination (`/app/team`
// for three of the four) — correct for entering a persona cold, and useless for
// the crossing above: it threw away the record you were inspecting. So on a
// record route the role change is a STORE WRITE ONLY. Persona is reactive state,
// every surface reads it through the store, and React re-renders the same record
// through the new lens with no reload. Off a record route the old destinations
// still apply, because there is no record to hold.
//
// Scenario changes are `router.push`, so they are client-side too. Nothing in
// this bar reloads the page except the destructive reset, which must.
//
// ═══ GATING ═══
//
// NOT gated by environment, deliberately and per instruction: the established
// convention in this codebase is that dev chrome renders in every environment
// (see the note this file replaces — "Mounted from the root layout in ALL
// environments so reviewers can switch personas"). There is no NODE_ENV check
// anywhere in src, and adding one only here would make this the single surface
// reviewers could not reach on the deployed demo.
//
// WHAT IT IS GATED BY IS THE ROLE ITSELF. The bar sets the viewer; it does not
// grant anything. Every capability behind it is still decided by the same
// permission map the product uses — `isSupervisorTier`, `canActOnCare` — so
// selecting Supervisor here is exactly equivalent to being one, and selecting
// Mentor genuinely loses the supervisor affordances rather than hiding them.
// A real deployment gates this by not shipping mock data, which is the honest
// boundary for a prototype whose entire dataset is fixtures.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EyeOff, RotateCcw } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
/* bar-01: scope comes from ONE declaration now — see `axes.ts` on why it can no
   longer live in the controls' label text. */
import {
  AXES,
  isLoadState,
  type AxisId,
} from "@/lib/dev/axes";
/* bar-02: the panel, its open state, and the shared scenario catalogue. */
import { DevPanel } from "@/components/dev/dev-panel";
import {
  closeDevPanel,
  inTextField,
  isPanelShortcut,
  openDevPanel,
  toggleDevPanel,
  useDevPanel,
} from "@/lib/dev/panel";
import { scenarioLabel } from "@/lib/dev/scenario-catalogue";

import { toast } from "sonner";
import { useMounted } from "@/lib/use-mounted";
import type { Persona } from "@/lib/types";
import {
  SCENARIO_PARAM,
  scenarioById,
  scenarioHref,
} from "@/lib/dev/record-scenarios";
import { EdgeFades, useEdgeOverflow } from "@/components/ui/scroll-affordance";
import {
  LOAD_STATES,
  LOAD_STATE_LABEL,
} from "@/lib/dev/load-state";

/** ═══ WHY THE ACTIVITY IDS ARE PREFIXED IN THIS SELECT ═══
 *
 *  Two families share one control and they are different kinds of thing: a
 *  record scenario NAVIGATES — it names a subject and a tab — while an activity
 *  scenario only sets a store field. `onChange` has to tell them apart, and an id
 *  that existed in both lists would otherwise navigate when it should have
 *  switched the feed. Both lists happen to contain "typical-shift" today, which
 *  is exactly the collision this prevents. */
const ACTIVITY_PREFIX = "activity:";
/** Same reasoning as `ACTIVITY_PREFIX`: a Tasks scenario SETS STATE and does not
 *  name a record, so `onChange` must be able to tell the families apart without
 *  guessing from the id. */
const TASKS_PREFIX = "tasks:";
/** ═══ THE TODAY AXIS (Phase J.2) ═══
 *  Prefixed like the other four, for the same reason: one select carries five
 *  independent axes and an unprefixed id could collide with a record scenario's. */
const TODAY_PREFIX = "today:";
/** And the same again for chat, which is the fifth screen level. Four prefixed
 *  families now share one select, and the prefix is the only reason `onChange` can
 *  be a switch rather than a guess. */
const CHAT_PREFIX = "chat:";
/** MONITORING, the sixth screen level. Prefixed for the same reason the three
 *  above are: a record scenario NAVIGATES, this one only SETS STATE, and an id
 *  collision between the families would navigate instead of switching. */
const MONITORING_PREFIX = "monitoring:";

/** ═══ WHICH ROUTES EACH SCENARIO AXIS DRIVES (Phase 2) ═══
 *
 *  These were single `pathname.startsWith` checks against `/app/tasks` and
 *  `/app/monitoring`. Both are retired routes now and the surfaces they held
 *  live at five destinations, so a single prefix cannot answer either question.
 *
 *  THE RETIRED ROUTE STAYS IN EACH LIST. It is a live hop, and a reader who
 *  lands on one should still see the right scenario selected for the frame they
 *  are on it rather than the select falling back to the record axis.
 *
 *  `/app/escalations` IS SPELLED IN FULL, deliberately — `startsWith`ing
 *  `/app/escalation` would also match `/app/escalation/{id}`, the record hop,
 *  which belongs to no scenario axis. */
const TASKS_ROUTES = ["/app/care-reviews", "/app/tasks"] as const;
const TODAY_ROUTES = ["/app/today"] as const;
const MONITORING_ROUTES = [
  /* FIRST since the Monitoring page is a destination again (proto/monitoring-
     merge): picking a Monitoring scenario off-axis lands here, not on a
     route that now redirects to it. */
  "/app/monitoring",
  "/app/escalations",
  "/app/risk-flags",
  "/app/mentor-practice",
  "/app/coverage",
] as const;

/** WHERE THE SELECT NAVIGATES when the reader is not already on the axis. The
 *  first entry of each list: Care Reviews for tasks, and Risk Flags for
 *  monitoring — the volume, which is the same honest guess `retiredRouteTarget`
 *  makes for a bare `/app/monitoring` and for the same stated reason. */
const onAxis = (pathname: string, routes: readonly string[]) =>
  routes.some((r) => pathname.startsWith(r));
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnnoModeControl } from "@/components/anno/mode-control";
import { cn } from "@/lib/utils";
import { DEV_CLOCK_POSITIONS } from "@/lib/home/dev-clock";

/** The bar's height, exported so the body's padding cannot drift from it. */
export const DEV_BAR_H = 40;

/** ═══ THE ANNOTATION CLUSTER'S RESERVED WIDTH ═══
 *
 *  Declaring the width here — rather than letting the cluster size itself — is
 *  what keeps the other three groups from moving as the cluster's contents change.
 *
 *  ═══ THESE NUMBERS WERE MEASURED IN anno-04, NOT ESTIMATED IN anno-03 ═══
 *
 *  anno-03 reserved 132/60 from a guess: "two 28px controls, a count badge and
 *  the gaps". The real cluster is a THREE-option radiogroup (Off · View · Place)
 *  plus the badge, and it measured 155px expanded and 106px collapsed — so the
 *  guess was 23px and 46px short, and at 900px the badge visibly overlapped
 *  group 4's divider.
 *
 *  168/120 is the measured content plus headroom for a three-digit count. Changed
 *  deliberately and recorded, which is the conversation the exports existed to
 *  force — `devBarSlotWidthsAgree()` is what stops the constants and the literal
 *  class drifting apart again. */
export const ANNO_SLOT_W = 168;
export const ANNO_SLOT_W_ICON = 120;

/** ═══ THE CONSTANTS AND THE CLASS STRING CANNOT BE THE SAME EXPRESSION ═══
 *
 *  Tailwind needs a literal, so the slot's width is written as
 *  `w-[60px] md:w-[132px]` and these numbers are a second copy. Two copies drift.
 *  This asserts they do not: anno-04's test calls it, and it fails loudly rather
 *  than the slot quietly resizing under a cluster built to the exported figure. */
export function devBarSlotWidthsAgree(className: string): boolean {
  return (
    className.includes(`w-[${ANNO_SLOT_W_ICON}px]`) &&
    className.includes(`md:w-[${ANNO_SLOT_W}px]`)
  );
}

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ ONE AXIS SHELL, AND THE SCOPE COMES FROM `axes.ts` (bar-01) ═══
 *
 *  WHAT IT REPLACES: each axis rendered its own `<label>` with its scope spelled
 *  into the text — `Load (Activity, Tasks, Monitoring, Home)`. bar-01 deletes
 *  those parentheticals, because scope is now declared once and ENFORCED, and a
 *  label that cannot be enforced is a label that drifts. Two of Load's four
 *  names were already wrong when bar-00 measured them.
 *
 *  THE THREE STATES RENDER DIFFERENTLY, and `recorded` is the one worth reading
 *  the header of `axes.ts` about:
 *    · `live`     — plain control, no annotation.
 *    · `recorded` — OPERABLE, dimmed label, reason on hover/focus. It changes
 *                    nothing on screen here but is captured onto any comment
 *                    placed here, so disabling it would break annotation
 *                    context capture on the routes where reviewers annotate.
 *    · `n/a`      — `disabled`, with the reason on the wrapper so it is
 *                    reachable by hover AND by focus on the label text.
 *
 *  `title` CARRIES IT FOR THE POINTER and `aria-describedby` for the reader. A
 *  `title` alone is invisible to the keyboard, which is the failure mode of most
 *  "explain on hover" affordances. */
/* ═══ `scenarioLabelFor` IS SUPERSEDED BY THE CATALOGUE (bar-02) ═══
   bar-01 added it for M4's tooltip, flattening five registries inline on every
   render. `lib/dev/scenario-catalogue.ts` owns that list now — grouped,
   route-scoped, indexed — so `scenarioLabel` reads one Map, and the panel's
   search reads the same source. */
/* ═══ `Axis` IS SUPERSEDED BY THE PANEL'S `Row` (bar-02) ═══
   bar-01 added a shell that rendered each axis's label and carried its
   applicability — three states, reason on hover and in an `sr-only` span. It has
   no controls left to wrap: bar-02 moves scenario, load and clock into the
   panel, and `dev-panel.tsx`'s `Row` does the same job from the same `axes.ts`
   declaration.
   THE HONESTY bar-01 BOUGHT IS NOT LOST, it moved and split:
     · the readout OMITS inapplicable axes rather than showing them dead;
     · the panel's `Row` carries the label and the `recorded` note;
     · the `Not used on this page` group names the `n/a` ones and why.
   Enabled-but-inert stays 0 — now because the controls are not in the bar at
   all, which is stronger than a `disabled` attribute. */

/** Where each persona lands when there is no record to hold. Unchanged from the
 *  pill this replaces. */
/* `CLOCK_SCREENS` IS GONE (bar-01) — same reason as `LOAD_STATE_SCREENS`, which
   `lib/dev/load-state.ts` records. Its two names happened to be CORRECT, which
   is exactly why it is not worth keeping: a hand-maintained list that is right
   today and unenforceable tomorrow. `CLOCK_LIVE_ROUTES` in `axes.ts` is derived
   from the routes themselves. */

const PERSONAS: { key: Persona; label: string; dest: string }[] = [
  { key: "mentor", label: "Mentor", dest: "__mentor__" },
  { key: "lead-mentor", label: "Lead mentor", dest: "/app/team" },
  { key: "supervisor", label: "Supervisor", dest: "/app/team" },
  { key: "admin", label: "Admin", dest: "/app/team" },
];

/** Mentor's landing screen, computed from the mentor's CURRENT state so the lens
 *  mirrors where they would actually be. Lifted verbatim from the old pill. */
function mentorDest(): string {
  const s = useOnboardingStore.getState();
  if (s.publishedSnapshot === null) {
    if (s.status === "in_review" || s.status === "rejected") {
      return "/onboarding/submitted";
    }
    return "/hub";
  }
  if (s.profileUpdate !== null) return "/app/profile";
  if (!s.enteredHome) return "/onboarding/submitted";
  return "/app";
}

function resetToNewMentor() {
  const s = useOnboardingStore.getState();
  s.reset();
  s.setPersona("new-mentor");
  // THE ONE HARD NAVIGATION. A wiped store must rehydrate from scratch.
  window.location.assign("/invite/demo-invite-token");
}

export function DevBar() {
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  const setPersona = useOnboardingStore((s) => s.setPersona);
  const devBarHidden = useOnboardingStore((s) => s.devBarHidden);
  const setDevBarHidden = useOnboardingStore((s) => s.setDevBarHidden);
  const router = useRouter();
  const pathname = usePathname();
  const [confirmReset, setConfirmReset] = useState(false);
  /* ═══ THE STATUS LINE'S EXPAND STATE IS GONE (bar-02) ═══
     `statusOpen` and `useWordTruncate` existed because the record scenario's
     "exercises" sentence had to fit a 40px strip: collapsed by default, click to
     expand, hidden below 1280 entirely. The sentence moved into the panel, which
     has room to render it whole at every width — so the truncation machinery is
     not superseded so much as no longer needed. The FEATURE is preserved (see
     `scenarioNote` on the panel); only the squeeze is gone. */

  /** ═══ THE ACTIVE SCENARIO, WITHOUT `useSearchParams` ═══
   *
   *  Standing rule 3 forbids `useSearchParams` in this project — it wants a
   *  Suspense boundary, and a page-root Suspense silently breaks hard-load
   *  hydration here. The rule's escape hatch is the `use(searchParams)` PROP
   *  pattern, and that is unavailable to this component: it is mounted from the
   *  root layout, and layouts are not handed searchParams.
   *
   *  So the URL is read ONCE, on mount, from `window.location` — behind a lazy
   *  initialiser, so it never runs during SSR — and the selection is local state
   *  from then on.
   *
   *  ═══ AND NOT RUNNING ON THE SERVER IS NOT THE SAME AS MATCHING IT ═══
   *
   *  A lazy initialiser still runs on the client's FIRST render, which is the
   *  render React compares against the server's HTML. On any URL carrying
   *  `?scenario=…` the server rendered nothing here and the client rendered the
   *  status line, so hydration failed and React regenerated the whole tree — see
   *  `mounted` at the two consumers below, which is what actually holds the two
   *  renders together. The initialiser stays because it means the value is right
   *  the moment `mounted` flips, with no second paint.
   *
   *  Reading it here also makes it reactive for the case a param-only change
   *  would otherwise miss: two scenarios can point at the SAME record (t13 is
   *  both `escalation-crisis` and `escalation-and-review`), so `usePathname`
   *  alone would not re-render when swapping between them.
   *
   *  THE URL STAYS THE SHAREABLE ARTIFACT — every change pushes it. What this
   *  does not do is follow a back/forward step, which for dev chrome is a fair
   *  trade for obeying rule 3. Noted rather than hidden. */
  const [scenarioId, setScenarioId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get(SCENARIO_PARAM) ?? "";
  });

  const active = mounted ? persona : null;
  /** ═══ `/app/chat` AND NOT `/app/chats` ═══
   *  The nav LABEL is "Chats" (plural, from the Figma frame) and the ROUTE is
   *  singular — `hrefFor` builds it from the nav item's `id`, which is "chat".
   *  Matching on the label would have made the select show the record axis on
   *  the chat page, silently, which is the class of bug the value expression
   *  below exists to prevent. */
  const onChat = pathname.startsWith("/app/chat");
  /** A record route is one where a scenario has something to hold on to. */
  const onRecord = pathname?.startsWith("/admin/person/") ?? false;
  /* GATED ON `mounted`, like `active` above and for the same reason: this is
     read from the URL on the client only, so the first client render has to
     agree with the server's — which rendered no scenario at all. */
  const scenario = mounted ? scenarioById(scenarioId) : null;
  /* Disabled while expanded — expansion means "stop cutting", so the measurement
     would otherwise fight the thing the reader just asked for. */
  /* DESTRUCTURED at the call site rather than kept as one object. Reading a
     `.display` field off a hook result in JSX trips `react-hooks/refs` — the rule
     cannot tell a state field from a ref field on a result that returns both —
     and plain locals say what each one is anyway. */
  const activityScenarioId = useOnboardingStore((s) => s.activityScenarioId);
  const setActivityScenario = useOnboardingStore(
    (s) => s.setActivityScenarioId
  );
  const tasksScenarioId = useOnboardingStore((s) => s.tasksScenarioId);
  const setTasksScenario = useOnboardingStore((s) => s.setTasksScenarioId);
  const chatScenarioId = useOnboardingStore((s) => s.chatScenarioId);
  const setChatScenario = useOnboardingStore((s) => s.setChatScenarioId);
  const monitoringScenarioId = useOnboardingStore((s) => s.monitoringScenarioId);
  const setMonitoringScenario = useOnboardingStore((s) => s.setMonitoringScenarioId);
  const loadState = useOnboardingStore((s) => s.devLoadState);
  const resetTasksReviewed = useOnboardingStore((s) => s.resetTasksReviewed);
  /** This bar is the widest horizontal scroller in the app at phone widths —
   *  measured 992px of controls in a 320px viewport. */
  const barRef = useRef<HTMLDivElement>(null);
  const edges = useEdgeOverflow(barRef);
  const setDevLoadState = useOnboardingStore((s) => s.setDevLoadState);
  const devClockKey = useOnboardingStore((s) => s.devClockKey);
  const todayScenarioId = useOnboardingStore((s) => s.todayScenarioId);
  const setTodayScenario = useOnboardingStore((s) => s.setTodayScenarioId);
  const setDevClockKey = useOnboardingStore((s) => s.setDevClockKey);
  /* bar-02's recents. Persisted (v53) because selecting a scenario NAVIGATES,
     so a non-persisted list would be empty every time the panel opened. */
  const scenarioRecents = useOnboardingStore((s) => s.scenarioRecents);
  const noteScenarioUsed = useOnboardingStore((s) => s.noteScenarioUsed);
  /** ═══ THE SELECT'S VALUE, LIFTED TO A CONST (bar-01) ═══
   *  It was inline on the `value` prop. M4's `title` needs the same string, and
   *  computing that ternary twice is how the tooltip and the control come to
   *  disagree about which scenario is selected. One expression, two readers. */
  /* ═══ THE PANEL'S OPEN STATE, AND THE SHORTCUT ═══ */
  const panel = useDevPanel();
  const panelToggleRef = useRef<HTMLButtonElement>(null);

  /** ═══ ⌘` / Ctrl+` OPENS AND CLOSES IT ═══
   *
   *  MEASURED against what is already bound before choosing: `?`, `Enter`, `e`,
   *  `n`, `u`, `y`, `j`, `k`, `1`, `2`, `3` on the list surfaces, plus
   *  `⌘/Ctrl+Enter` in the Care Reviews pane. Every bare letter is spoken for by
   *  a list's keyboard navigation, so a plain key would collide with the
   *  prototype interactions this bar exists to observe.
   *  GUARDED IN A TEXT FIELD, using the same test `shortcuts.tsx` uses — the
   *  panel's own scenario filter is an input, and a shortcut that fires while
   *  someone is typing into the thing it opened is the worst version of this. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPanelShortcut(e)) return;
      if (inTextField(e.target)) return;
      e.preventDefault();
      toggleDevPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** ═══ SELECTING A SCENARIO, LIFTED OUT OF THE SELECT (bar-02) ═══
   *
   *  Every branch below is the select's old `onChange`, verbatim, including each
   *  "navigate only if we are not already there" guard and each comment. It is a
   *  named callback now because the PANEL sets scenarios too, and the one thing
   *  this phase must not do is grow a second copy of the navigation rules —
   *  five families, each with its own store field and its own hop, is exactly
   *  the shape that drifts.
   *
   *  AND IT RECORDS THE USE. `noteScenarioUsed` feeds the panel's recents row;
   *  it is here rather than in the panel so a selection made from the bar's own
   *  control counts too, the day one comes back. */
  const selectScenario = useCallback(
    (value: string) => {
      setScenarioId(value);
      if (value) noteScenarioUsed(value);
      // ── ACTIVITY: set the axis. It no longer navigates: Activity lives in
      //    the top bar's bell on every console route (2026-10-16), so there is
      //    no screen to go to — open the bell to see the scenario.
      if (value.startsWith(ACTIVITY_PREFIX)) {
        setActivityScenario(value.slice(ACTIVITY_PREFIX.length));
        return;
      }
      // ── TODAY: same shape, and it writes THREE axes rather than one.
      if (value.startsWith(TODAY_PREFIX)) {
        setTodayScenario(value.slice(TODAY_PREFIX.length) || null);
        if (!onAxis(pathname, TODAY_ROUTES)) {
          router.push(TODAY_ROUTES[0], { scroll: false });
        }
        return;
      }
      // ── TASKS: identical shape to Activity above (gap row 311).
      if (value.startsWith(TASKS_PREFIX)) {
        setTasksScenario(value.slice(TASKS_PREFIX.length));
        if (!onAxis(pathname, TASKS_ROUTES)) {
          router.push(TASKS_ROUTES[0], { scroll: false });
        }
        return;
      }
      // ── MONITORING: same shape as Tasks. Selecting "— none —" while on the
      //    page clears the axis back to the task-derived default.
      if (value.startsWith(MONITORING_PREFIX)) {
        setMonitoringScenario(value.slice(MONITORING_PREFIX.length));
        if (!onAxis(pathname, MONITORING_ROUTES)) {
          router.push(MONITORING_ROUTES[0], { scroll: false });
        }
        return;
      }
      if (value === "" && onAxis(pathname, MONITORING_ROUTES)) {
        setMonitoringScenario(null);
        return;
      }
      // ── CHAT: same shape again, and switching it also CLEARS the chat
      //    writes (see `setChatScenarioId`).
      if (value.startsWith(CHAT_PREFIX)) {
        setChatScenario(value.slice(CHAT_PREFIX.length));
        if (!onChat) {
          router.push("/app/chat", { scroll: false });
        }
        return;
      }
      const s = scenarioById(value);
      // CLIENT-SIDE. No reload; the record re-renders in place.
      if (s) router.push(scenarioHref(s), { scroll: false });
    },
    [
      pathname,
      router,
      onChat,
      noteScenarioUsed,
      setActivityScenario,
      setTodayScenario,
      setTasksScenario,
      setMonitoringScenario,
      setChatScenario,
    ]
  );

  const scenarioValue = !mounted
    ? ""
    : onAxis(pathname, TODAY_ROUTES)
      ? `${TODAY_PREFIX}${todayScenarioId ?? ""}`
      : pathname.startsWith("/app/activity")
        ? `${ACTIVITY_PREFIX}${activityScenarioId}`
        : onChat
          ? `${CHAT_PREFIX}${chatScenarioId}`
          : onAxis(pathname, TASKS_ROUTES)
            ? `${TASKS_PREFIX}${tasksScenarioId}`
            : onAxis(pathname, MONITORING_ROUTES)
              ? monitoringScenarioId
                ? `${MONITORING_PREFIX}${monitoringScenarioId}`
                : ""
              : scenarioId;

  /** ═══ THE READOUT (bar-02, region 1) ═══
   *
   *  APPLICABLE AXES ONLY. A chip describes the fixture IN EFFECT, so an axis
   *  that changes nothing here is omitted rather than greyed — a greyed chip
   *  costs a live chip's width to say less, which is the width problem bar-00
   *  measured. `axes.ts` decides; this only renders.
   *  `recorded` COUNTS AS APPLICABLE, because it is: the value is captured onto
   *  any comment placed here even where nothing on screen moves.
   *  ROLE IS NOT A CHIP. It is region 1's other half and already has its own
   *  segmented control in the bar, which bar-03 keeps at every width — turning
   *  it into a chip would hide behind a click the one axis a reviewer changes
   *  most and can already see. */
  const readoutChips = useMemo(() => {
    if (!mounted) return [] as { axis: AxisId; label: string; value: string }[];
    const out: { axis: AxisId; label: string; value: string }[] = [];
    for (const a of AXES) {
      if (a.id === "role") continue;
      if (a.appliesTo(pathname) === "n/a") continue;
      let value: string | null = null;
      if (a.id === "scenario") {
        value = scenarioLabel(scenarioValue) ?? null;
      } else if (a.id === "load") {
        value = LOAD_STATE_LABEL[loadState];
      } else if (a.id === "clock") {
        value =
          DEV_CLOCK_POSITIONS.find((x) => x.key === devClockKey)?.label ?? null;
      }
      /* NO CHIP FOR AN UNSET AXIS. A chip reading "Clock —" spends width on the
         absence of a choice; the panel is where a reader goes to make one. The
         one exception is Load, which is never unset — `ready` is a value. */
      if (!value) continue;
      out.push({ axis: a.id, label: a.label, value });
    }
    return out;
  }, [mounted, pathname, scenarioValue, loadState, devClockKey]);



  const pickRole = (p: (typeof PERSONAS)[number]) => {
    setPersona(p.key);
    // STAY PUT ON A RECORD — see the module note. Off a record, enter the
    // persona's own destination the way the old pill did.
    if (onRecord) return;
    window.location.assign(p.dest === "__mentor__" ? mentorDest() : p.dest);
  };

  // ═══ PUT AWAY — AND THE 40px RESERVATION GOES WITH IT ═══
  //
  // `--dev-bar-h` is not decoration: `dialog.tsx`, `bottom-nav.tsx` and
  // `onboarding-layout.tsx` all subtract it so their fixed chrome sits above
  // this bar. Returning `null` alone would leave every one of them reserving
  // 40px for a bar that is not there — a gap along the bottom of the app with no
  // visible cause, which is worse than the bar.
  //
  // So the hidden state still renders one thing: a `:root` override collapsing
  // the token. Every consumer reads `var(--dev-bar-h, 0px)`, so they all
  // recompute at once and none of them needs to know this component exists.
  //
  // GATED ON `mounted`. The flag is persisted, and zustand rehydrates after
  // mount, so the server cannot know it — the bar renders for one frame before
  // being put away. Accepted rather than fixed with a blocking inline script:
  // this is prototype chrome, and a render-blocking script on every page load
  // is a real cost paid for a cosmetic one.
  // ═══ AND NOT BEFORE THE GATE ═══
  //
  // The bar mounts from the root layout, so it rendered on `/gate` too — showing
  // the role switcher, scenario picker and reset to someone who has not entered
  // the password yet. Confirmed by `curl /gate | grep "Prototype harness"`.
  //
  // PATH-BASED, not cookie-based, and that is not a shortcut: the gate cookie is
  // `httpOnly`, so a client component cannot read it, and `/gate` is the only
  // route the middleware lets through unauthenticated. The path IS the signal.
  //
  // Shares the hidden branch so the `--dev-bar-h` reservation collapses here too
  // — the gate page would otherwise reserve 40px for a bar it never shows.
  if (pathname === "/gate" || (mounted && devBarHidden)) {
    return <style>{":root { --dev-bar-h: 0px; }"}</style>;
  }

  return (
    <>
      {/* ═══ THE BAR SCROLLS SIDEWAYS, AND NOW IT SAYS SO ═══
          Measured at 320px: 992px of controls in a 320px viewport, with the
          Scenario select 321px past the right edge. It IS reachable, which is what
          row 311 was actually about — the panel it replaced sat under the mobile
          nav and could not be reached at any scroll — but a scroller with no edge
          marking is a scroller nobody thinks to scroll.

          THE OUTER DIV TAKES THE FIXED POSITIONING, the border and the ground; the
          inner one scrolls. `EdgeFades` must be a SIBLING of the scroller, never a
          child: a child of an `overflow-x-auto` element scrolls away from the edge
          it marks and adds to that element's scrollWidth at the same time. Its own
          doc comment says so — this is the first call site outside the record's
          tab strip. */}
      {/* ═══ THE PANEL, ABOVE THE BAR (bar-02) ═══
          Rendered BEFORE the bar in the DOM and positioned at `bottom-[40px]`,
          so the bar stays the last thing in the tab order at the bottom edge
          and the panel reads before it — which matches the visual order, panel
          above bar. */}
      {mounted && panel.open && (
        <DevPanel
          pathname={pathname}
          focus={panel.focus}
          onClose={closeDevPanel}
          returnFocusTo={() => panelToggleRef.current}
          personas={PERSONAS}
          persona={persona}
          /* THE BAR'S OWN HANDLER, so the panel's role control navigates
             exactly as the segmented one does — including the mentor lens's
             computed destination. One rule, two controls. */
          onPersona={(k) => {
            const p = PERSONAS.find((x) => x.key === k);
            if (p) pickRole(p);
          }}
          scenarioValue={scenarioValue}
          onScenario={selectScenario}
          scenarioRecents={scenarioRecents}
          /* RESTORED FROM GROUP 2 (standing rule 5). Removing the bar's axis
             cluster took this line with it; it belongs to the scenario axis, so
             it moved with the axis rather than being dropped. */
          scenarioNote={scenario?.exercises ?? null}
          loadOptions={LOAD_STATES.map((v) => ({
            value: v,
            label: LOAD_STATE_LABEL[v],
          }))}
          loadValue={loadState}
          onLoad={(v) => {
            if (isLoadState(v)) setDevLoadState(v);
          }}
          clockOptions={[
            /* NEEDS-COPY-NICOLE. The unpinned default FIRST, because the real
               clock is the normal state — the same reasoning the bar's own
               control carried. */
            { value: "", label: "— live clock —" },
            ...DEV_CLOCK_POSITIONS.map((pos) => ({ value: pos.key, label: pos.label })),
          ]}
          clockValue={mounted ? (devClockKey ?? "") : ""}
          onClock={(v) => setDevClockKey(v || null)}
        />
      )}

      <div
        style={{ height: DEV_BAR_H }}
        /* THE PANEL'S CLICK-OUTSIDE EXCLUDES THE BAR BY THIS ATTRIBUTE — see
           `dev-panel.tsx`. A pointerdown on the toggle would otherwise close the
           panel here and reopen it in the toggle's own handler, which reads as a
           click that does nothing. */
        data-dev-bar-root=""
        className={cn(
          "fixed inset-x-0 bottom-0 z-50",
          // DASHED TOP EDGE — the convention this codebase already uses to mark
          // prototype chrome, so nobody reads a screenshot of it as product.
          "border-t border-dashed border-[color:var(--border-contour)] bg-[var(--surface-card)]"
        )}
      >
        <div className="relative h-full">
          <div
            ref={barRef}
            /* TODO-COPY */
            aria-label="Prototype harness"
            role="region"
            /* NO `tabIndex` — SC 2.1.1 wants a scrollable region keyboard-
               reachable, and every child here is already focusable (radios,
               selects, buttons), so tabbing scrolls it natively. A stop on the
               region itself would add a tab position that does nothing. Noted
               because `scrollable-region-focusable` is a rule this repo has
               already had to fight once. */
            className={cn(
              "flex h-full items-center gap-3 overflow-x-auto px-3",
              "text-[12px]"
            )}
          >
        {/* ══ GROUP 1 · BUILD IDENTITY ══════════════════════════════════
            What build am I looking at and as whom. Never collapses — if the bar
            is on screen at all, these two answers are the reason. */}
        <div className="flex shrink-0 items-center gap-2">
        {/* ═══ `DEV` IS THE PANEL TOGGLE (bar-02) ═══
            It was a label. Making it the toggle costs no width, puts the
            affordance where the eye already starts, and is what bar-03 collapses
            the readout INTO at 768 — "a bare `DEV` button" — so the control a
            reviewer learns at 1600 is the same one that survives at 600. */}
        <button
          ref={panelToggleRef}
          type="button"
          data-anno-ref="dev-panel-toggle"
          aria-expanded={panel.open}
          aria-haspopup="dialog"
          /* TODO-COPY. Names the ACTION and what it acts on, and states the
             shortcut so it is discoverable without a sheet. */
          aria-label={`${panel.open ? "Close" : "Open"} prototype state (Cmd or Ctrl + backtick)`}
          /* A PLAIN STRING, NOT A TEMPLATE: the shortcut IS a backtick, and a
             backtick inside a template literal closes it. Fourth time in this
             session, so it is written down here. */
          title="Prototype state — ⌘` or Ctrl+`"
          onClick={() => toggleDevPanel(null)}
          className={cn(
            "flex min-h-7 shrink-0 items-center rounded-md px-1.5",
            "font-semibold tracking-[0.08em] transition-colors",
            panel.open
              ? "bg-[var(--text-primary)] text-[var(--text-inverse)]"
              : "text-[var(--text-muted)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          DEV
        </button>

        {/* ── AXIS 1 · ROLE ─────────────────────────────────────────────── */}
        <div
          role="radiogroup"
          /* TODO-COPY */
          aria-label="Viewer role"
          className="flex shrink-0 items-center gap-0.5"
        >
          {PERSONAS.map((p) => {
            const on = active === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickRole(p)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-semibold transition-colors",
                  on
                    ? "bg-[var(--text-primary)] text-[var(--text-inverse)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        </div>

        <span aria-hidden className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" />

        {/* ══ GROUP 2 · SCENARIO STATE ══════════════════════════════════
            What data is on screen and in what condition. THE ONLY GROUP THAT
            DEGRADES: the status line goes below 1280, then the labels go below
            1024, and the controls themselves never do — a reader who cannot see
            the word "Scenario" can still work out what a select full of scenario
            names is, but a missing select is a missing capability. */}
        {/* `flex-1`, so the free space in the bar goes to the STATUS LINE rather
            than to the margin before group 3. Content-sized, this group left the
            status 240px at 1440 where the pre-restructure bar gave it 388 — a
            regression created by the grouping itself. Groups 3 and 4 are
            `shrink-0`, so growing this one cannot displace them. */}
        {/* ═══ REGION 1 · THE STATE READOUT (bar-02) ═══
            WHAT THIS REPLACES: three axis controls in the bar — scenario, load
            and clock, 278 + 303 + 408 = 989px of clusters in a row that had 931
            at 1600 and 340 at 1024. bar-00 measured it clipping 75px at the
            widest width in the pack and 666px at 1024. They live in the panel
            now, which has room for a sixth axis without touching the bar.

            IT DESCRIBES THE FIXTURE IN EFFECT, NOT THE CONTROLS THAT EXIST.
            Inapplicable axes are OMITTED rather than shown empty — on Care
            Reviews that means no clock chip at all, because a pinned clock
            changes nothing there. Chosen over greying them: a greyed chip costs
            the same width as a live one to say less, which is the problem
            bar-00 measured.

            EACH CHIP OPENS THE PANEL FOCUSED ON ITS OWN AXIS, so the
            zero-click cost bar-02 names as the panel's tradeoff is one click
            for the axis you actually want rather than one click plus a hunt. */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {readoutChips.map((c) => (
            <button
              key={c.axis}
              type="button"
              data-anno-ref={`dev-chip:${c.axis}`}
              onClick={() => openDevPanel(c.axis)}
              /* TODO-COPY. The name states the axis AND its value, so a screen
                 reader gets the fixture without opening the panel. */
              aria-label={`${c.label}: ${c.value}. Change`}
              title={`${c.label}: ${c.value}`}
              className={cn(
                "flex min-h-7 min-w-0 shrink items-center gap-1 rounded-full px-2",
                "text-[12px] text-[var(--text-secondary)]",
                "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <span className="shrink-0 text-[var(--text-muted)]">{c.label}</span>
              <span className="min-w-0 truncate text-[var(--text-primary)]">
                {c.value}
              </span>
            </button>
          ))}
        </div>

        {/* ══ GROUP 3 · ANNOTATION CLUSTER ═════════════════════════════════
            EMPTY THIS PHASE, AND RESERVED ANYWAY. anno-04 fills it. The width is
            declared here so that filling it later cannot push groups 1, 2 and 4
            sideways — a bar whose controls move when a feature lands is a bar
            whose muscle memory is worthless.

            `ml-auto` lives here rather than on group 4, so groups 3 and 4 travel
            together against the right edge. */}
        <div
          data-dev-slot="annotation"
          className={cn(
            "ml-auto flex shrink-0 items-center justify-end",
            /* Icon-only below `md` (960px in this theme) — the third degradation
               step. The count badge anno-04 puts here survives that collapse.

               LITERAL CLASS STRINGS, NOT A TEMPLATE OVER THE CONSTANTS BELOW.
               Tailwind scans source text for class names, so
               `w-[${ANNO_SLOT_W}px]` compiles, renders, and silently produces NO
               RULE — measured at 0px wide before this was caught. `touch-target.ts`
               documents the same trap for the same reason. The constants are
               exported for anno-04 to build against; the guard that keeps the two
               honest is `devBarSlotWidthsAgree()` below. */
            "w-[120px] md:w-[168px]"
          )}
        >
          {/* anno-04 fills the reservation anno-03 made. Verified not to reflow
              the other three groups — the widths are the same declaration. */}
          <AnnoModeControl />
        </div>

        <span aria-hidden className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" />

        {/* ══ GROUP 4 · UTILITIES ══════════════════════════════════════════
            NEVER COLLAPSES. Everything here is either a statement about the data
            being shown or a way out, and both have to be available at every
            width — a Reset you cannot reach on a narrow window is how a demo
            gets stuck. */}
        <div className="flex shrink-0 items-center gap-1">
        {scenario && (
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em]",
              scenario.data === "real"
                ? "bg-[var(--surface-s2)] text-[var(--text-secondary)]"
                : "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]"
            )}
          >
            {/* TODO-COPY. Mocked is the one worth flagging, so it is the one
                that gets the tint. */}
            {scenario.data}
          </span>
        )}

        {/* ── HIDE. Not destructive and reversible, so no confirm — but it does
            remove the only affordance that brings it back, which is why the
            label says where that is rather than just "Hide". */}
        <button
          type="button"
          onClick={() => setDevBarHidden(true)}
          /* TODO-COPY */
          aria-label="Hide the dev bar — bring it back from Settings › Dev"
          title="Hide — bring it back from Settings › Dev"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          <EyeOff className="size-3.5" aria-hidden />
          {/* TODO-COPY */}
          Hide
        </button>

        {/* ── RESET. Destructive, so it confirms and it is last. */}
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          /* TODO-COPY */
          aria-label="Reset as a new mentor and restart onboarding"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </button>
        </div>
          </div>
          <EdgeFades edges={edges} surface="var(--surface-card)" />
        </div>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            {/* TODO-COPY */}
            <DialogTitle>Reset as a new mentor?</DialogTitle>
            <DialogDescription>
              This wipes the mentor in the store and restarts the invitation
              flow. Teen and staff fixtures are unaffected.
            </DialogDescription>
          </DialogHeader>
          {/* ═══ TWO RESETS, AND THE SOFT ONE IS NOT DESTRUCTIVE (Part 4) ═══
              "Reset reviewed states" came from the Tasks page's own floating
              panel. It belongs beside this control because both answer "put the
              prototype back" — but they are not the same size of act, so they are
              not the same button: one clears a page's reviewed items, the other
              wipes the mentor and restarts onboarding.
              It sits on the LEFT, away from the destructive one, and closes the
              dialog rather than navigating — nothing about it needs a reload. */}
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                resetTasksReviewed();
                setConfirmReset(false);
                toast("Reviewed states cleared on the Tasks worklist.");
              }}
              className={cn(
                "mr-auto inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-medium text-[var(--text-secondary)]",
                "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              {/* TODO-COPY */}
              Reset reviewed states
            </button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button onClick={resetToNewMentor}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
