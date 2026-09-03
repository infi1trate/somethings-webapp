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

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EyeOff, RotateCcw } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { toast } from "sonner";
import { useMounted } from "@/lib/use-mounted";
import type { Persona } from "@/lib/types";
import {
  SCENARIO_PARAM,
  STAFF_SCENARIOS,
  TEEN_SCENARIOS,
  scenarioById,
  scenarioHref,
} from "@/lib/dev/record-scenarios";
import { ACTIVITY_SCENARIOS } from "@/lib/activity/seed";
import { TASK_SCENARIOS } from "@/lib/tasks/seed";
import { CHAT_SCENARIOS } from "@/lib/chat/seed";
import { EdgeFades, useEdgeOverflow } from "@/components/ui/scroll-affordance";
import {
  LOAD_STATES,
  LOAD_STATE_LABEL,
  LOAD_STATE_SCREENS,
  type LoadState,
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
/** And the same again for chat, which is the fifth screen level. Four prefixed
 *  families now share one select, and the prefix is the only reason `onChange` can
 *  be a switch rather than a guess. */
const CHAT_PREFIX = "chat:";
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
import { useWordTruncate } from "@/lib/dev/use-word-truncate";
import { cn } from "@/lib/utils";

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

/** Where each persona lands when there is no record to hold. Unchanged from the
 *  pill this replaces. */
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
  /** Whether the status line is showing its full text. Collapsed by default —
   *  the bar's job at rest is to be readable at a glance, not complete. */
  const [statusOpen, setStatusOpen] = useState(false);

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
  const {
    containerRef: statusContainerRef,
    measureRef: statusMeasureRef,
    display: statusDisplay,
  } = useWordTruncate(scenario?.exercises ?? "", !statusOpen);
  const activityScenarioId = useOnboardingStore((s) => s.activityScenarioId);
  const setActivityScenario = useOnboardingStore(
    (s) => s.setActivityScenarioId
  );
  const tasksScenarioId = useOnboardingStore((s) => s.tasksScenarioId);
  const setTasksScenario = useOnboardingStore((s) => s.setTasksScenarioId);
  const chatScenarioId = useOnboardingStore((s) => s.chatScenarioId);
  const setChatScenario = useOnboardingStore((s) => s.setChatScenarioId);
  const loadState = useOnboardingStore((s) => s.devLoadState);
  const resetTasksReviewed = useOnboardingStore((s) => s.resetTasksReviewed);
  /** This bar is the widest horizontal scroller in the app at phone widths —
   *  measured 992px of controls in a 320px viewport. */
  const barRef = useRef<HTMLDivElement>(null);
  const edges = useEdgeOverflow(barRef);
  const setDevLoadState = useOnboardingStore((s) => s.setDevLoadState);

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
      <div
        style={{ height: DEV_BAR_H }}
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
        <span className="shrink-0 font-semibold tracking-[0.08em] text-[var(--text-muted)]">
          DEV
        </span>

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
        <div className="flex min-w-0 flex-1 items-center gap-2">

        {/* ── AXIS 2 · SCENARIO ─────────────────────────────────────────────
            A native select: twenty entries in a 40px strip, grouped, keyboard
            and screen-reader native for free, and it collapses to its label
            instead of eating the bar. */}
        <label className="flex shrink-0 items-center gap-1.5">
          {/* TODO-COPY */}
          {/* LABEL GOES, CONTROL STAYS — see the group note. */}
          <span className="hidden text-[var(--text-muted)] lg:inline">Scenario</span>
          <select
            /* ═══ THE VALUE FOLLOWS THE SCREEN, NOT THE LAST CLICK ═══
               One select, two independent axes: the record scenario is derived
               from the URL, the activity scenario is a store field. Showing
               whichever was chosen most recently meant an activity selection
               vanished from the control on reload while still being in effect —
               a dev control that lies about its own state is worse than none.
               So on Activity it shows the activity axis, and everywhere else the
               record axis. Selecting a record scenario does NOT clear the
               activity one, and it should not: they apply to different screens
               and both remain true. */
            /* ═══ `mounted` WRAPS THE WHOLE EXPRESSION, NOT JUST THE URL ARM ═══
               The record arm reads the URL and the other three read the store,
               and BOTH are client-only sources — zustand rehydrates from
               localStorage during module evaluation with no `skipHydration`, so
               a stored activity/chat/tasks scenario differs from the server's
               default just as surely as a `?scenario=` param does. That one has
               not bitten yet only because those defaults happen to equal their
               initial values. Gating the whole expression closes both. */
            value={
              !mounted
                ? ""
                : pathname.startsWith("/app/activity")
                  ? `${ACTIVITY_PREFIX}${activityScenarioId}`
                  : onChat
                    ? `${CHAT_PREFIX}${chatScenarioId}`
                    : pathname.startsWith("/app/tasks")
                      ? `${TASKS_PREFIX}${tasksScenarioId}`
                      : scenarioId
            }
            onChange={(e) => {
              const value = e.target.value;
              setScenarioId(value);
              // ── ACTIVITY: set the axis, and go to the screen it applies to.
              if (value.startsWith(ACTIVITY_PREFIX)) {
                setActivityScenario(value.slice(ACTIVITY_PREFIX.length));
                // NAVIGATE ONLY IF WE ARE NOT ALREADY THERE. Pushing
                // `/app/activity` while on it would reset the page's own local
                // state — view, filters, scroll — which a scenario switch has no
                // business doing.
                if (!pathname.startsWith("/app/activity")) {
                  router.push("/app/activity", { scroll: false });
                }
                return;
              }
              // ── TASKS: identical shape to Activity above (gap row 311).
              if (value.startsWith(TASKS_PREFIX)) {
                setTasksScenario(value.slice(TASKS_PREFIX.length));
                if (!pathname.startsWith("/app/tasks")) {
                  router.push("/app/tasks", { scroll: false });
                }
                return;
              }
              // ── CHAT: same shape again. Note that switching the chat scenario
              //    also CLEARS the chat writes (see `setChatScenarioId`), because
              //    an escalation or a sent activity is keyed to fixtures the new
              //    scenario has just replaced.
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
            }}
            className={cn(
              "min-w-[13rem] rounded-md border border-[color:var(--border-contour)] bg-[var(--surface-s1)] px-2 py-1",
              "text-[var(--text-primary)]",
              RING
            )}
          >
            <option value="">— none —</option>
            {/* TODO-COPY on both group labels. */}
            <optgroup label="Teen record">
              {TEEN_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Staff record">
              {STAFF_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
            {/* ═══ ACTIVITY, THE THIRD SCREEN LEVEL ═══
                It had its own collapsible panel pinned to the feed's corner —
                a second pattern for a job this select already did, page-local so
                it reset on navigation, and under the fixed bottom nav below `md`
                where it could not be tapped at all.
                THE IDS ARE PREFIXED because the two families are different
                kinds of thing: a record scenario NAVIGATES (it names a subject
                and a tab), an activity scenario only SETS STATE. Without a
                prefix the branch in `onChange` would have to guess, and an id
                collision between the two lists would silently navigate instead
                of switching the feed. */}
            <optgroup label="Activity">
              {ACTIVITY_SCENARIOS.map((s) => (
                <option key={s.id} value={`${ACTIVITY_PREFIX}${s.id}`}>
                  {s.label}
                </option>
              ))}
            </optgroup>
            {/* ═══ TASKS, THE FOURTH SCREEN LEVEL (gap row 311) ═══
                Its panel had Activity's two faults — page-local, so it reset on
                navigation — plus a worse one: pinned bottom-right at z-40 under a
                fixed bottom nav that is ALSO z-40 and `md:hidden`, so below `md`
                every tap at its coordinates was taken by the nav's subtree and the
                control could not be operated at all. Found by Playwright naming
                the intercepting element, not by looking at it. */}
            <optgroup label="Tasks">
              {TASK_SCENARIOS.map((s) => (
                <option key={s.id} value={`${TASKS_PREFIX}${s.id}`}>
                  {s.label}
                </option>
              ))}
            </optgroup>
            {/* ═══ CHAT, THE FIFTH SCREEN LEVEL ═══
                Five relationship states, each pinned to a teen already on the live
                mentor's roster — so the scenario and the conversation list cannot
                disagree about who these people are. Prefixed for the same reason
                the two above are. */}
            <optgroup label="Mentor chat">
              {CHAT_SCENARIOS.map((s) => (
                <option key={s.id} value={`${CHAT_PREFIX}${s.id}`}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        {/* ── AXIS 3 · LOAD STATE ───────────────────────────────────────────
            Lifted out of the Activity page's panel, where it was `useState` and
            reset on every navigation.

            THE LABEL NAMES ITS SCOPE, and that is deliberate rather than
            apologetic: Activity is the only screen that implements these states,
            so "Load (Activity)" tells a reader why nothing changes on the Tasks
            page. The alternative — an unqualified "Load" that silently does
            nothing on four screens out of five — is the version that wastes
            somebody's afternoon. design-system-gaps row 317. */}
        <label className="flex shrink-0 items-center gap-1.5">
          {/* TODO-COPY */}
          <span className="hidden text-[var(--text-muted)] lg:inline">
            Load
            <span className="text-[var(--text-muted)]">
              {` (${LOAD_STATE_SCREENS.join(", ")})`}
            </span>
          </span>
          <select
            value={loadState}
            onChange={(e) => setDevLoadState(e.target.value as LoadState)}
            className={cn(
              "rounded-md border border-[color:var(--border-contour)] bg-[var(--surface-s1)] px-2 py-1",
              "text-[var(--text-primary)]",
              RING
            )}
          >
            {LOAD_STATES.map((st) => (
              <option key={st} value={st}>
                {LOAD_STATE_LABEL[st]}
              </option>
            ))}
          </select>
        </label>

        {/* ══ THE ACTIVE SCENARIO, NAMED ══════════════════════════════════
            A screenshot of this bar says which scenario produced it.

            ═══ CUT AT A WORD, AND THE REST IS REACHABLE BY CLICKING ═══

            It used to be `truncate`, which cuts at the CHARACTER — measured in
            anno-00 rendering "…an open esc" — and the remainder was reachable by
            nothing at all. Now `useWordTruncate` measures and cuts at the last
            whole word, and the text is a BUTTON that expands to the full string.

            EXPAND-ON-CLICK RATHER THAN A TOOLTIP, and the reason is that a
            tooltip fails three of the four ways in. `title` never appears for a
            keyboard user, never appears on touch, and is not reliably announced
            by screen readers — leaving it readable only by a mouse user who
            hovers and waits. Expansion works for all four, and it needs no new
            visual language: the expanded text simply stops clipping and the
            bar's own `overflow-x-auto` reveals it, which is chrome that already
            exists. `title` is set as well, so a hovering mouse user gets the
            text without a click, but it is the bonus rather than the mechanism.

            THE FULL STRING IS ALSO THE ACCESSIBLE NAME, so a screen reader reads
            the whole thing regardless of what is painted. */}
        {scenario && (
          <span
            ref={statusContainerRef}
            className={cn(
              // Hidden below 1280 — the first thing to go, per Appendix B.
              "hidden xl:block",
              // Expanded, it takes its natural width and the bar scrolls.
              statusOpen ? "shrink-0" : "min-w-0 flex-1"
            )}
          >
            <button
              type="button"
              onClick={() => setStatusOpen((o) => !o)}
              aria-expanded={statusOpen}
              aria-label={scenario.exercises}
              title={scenario.exercises}
              className={cn(
                "block max-w-full rounded-sm text-left text-[var(--text-secondary)]",
                RING
              )}
            >
              <span ref={statusMeasureRef} className="block whitespace-nowrap">
                {statusOpen ? scenario.exercises : statusDisplay}
              </span>
            </button>
          </span>
        )}
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
