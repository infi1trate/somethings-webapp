"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE PERSISTENT CONSOLE SHELL (SUP-1, prerequisite for SUP-2)
//
// This is `AppChrome`'s former body, unchanged in what it renders. It moved
// because the shell has to OUTLIVE a navigation: it is mounted once by
// `src/app/(console)/layout.tsx` and the route pages render inside it. The
// pages still call `<AppChrome active="…">`, which now reports to the shell
// (`lib/app-shell/shell-config.ts`) instead of rendering it — see that file
// for why a store rather than context state.
//
// THREE THINGS THE REMOUNT USED TO DO FOR FREE, now done on purpose:
//   1. THE BADGE CLOCK refreshed on every route. It is bumped on each pathname
//      change (`bumpNavClock`), so counts are as fresh as they were.
//   2. THE CANVAS SCROLL started at the top of every route. A persistent
//      scroller would carry the last page's offset into the next, so it is
//      reset on pathname change in `AppShell`.
//   3. MOUNT-GATED STATE (`useMounted`) now resolves once per session instead
//      of once per route, which only removes a per-navigation flash.
//
// The original note on why there is ONE shell for every persona follows.
//
// ═══ THE FORK THIS REPLACES, MEASURED (addendum §2.3) ═══
//
// There were two shells — `MentorShell` and `AdminShell` — and both already
// delegated their markup to `AppShell`, so the fork was not in the chrome. It
// was in WHO CHOSE. Every route picked a shell for itself, and seven of them
// hardcoded the mentor's for every persona: `/app`, `/app/[section]`,
// `/app/chat`, `/app/chat/[personId]`, `/app/mentees`, `/app/profile`,
// `/app/settings`. `/app/mentees` was the explicit one — it tested
// `isSupervisorTier(persona)` and then returned `MentorShell` anyway.
//
// MEASURED at 1280×900 on the supervisor persona: `/app/escalations` rendered
// the grouped rail (Today · Escalations · Risk Flags · Care Reviews · Mentees ·
// Team) and `/app/chat` rendered the old flat one (Home · Chats · Activity ·
// Tasks · Monitoring · Mentees · Team) — two different navigations for one
// reader, one click apart.
//
// A SECOND FORK sat underneath it: `AdminShell` passed `railGroups` only for
// `persona === "supervisor"`, so a Lead Mentor and an Admin got the old icon
// rail on every route including the ones that chose the right shell.
//
// ═══ WHAT THIS COMPONENT IS, AND WHAT IT IS NOT ═══
//
// It is the ONLY thing a route renders. It is not a new rail: the markup is
// still `AppShell`, which is unchanged. What moved here is the choosing — the
// per-persona item set, badge set, avatar and accessible label that the two
// shells each held half of.
//
// ROLE DIFFERENCES ARE ITEMS, NEVER STRUCTURE. Every persona gets the same
// component, the same groups mechanism and the same styling; what varies is
// which items appear and what their badges count. `railGroups` already returned
// one unlabelled group for every non-supervisor persona, which renders exactly
// as the flat rail did — so passing it unconditionally is what makes the
// structure identical rather than what changes it.

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { RailFooterItem, RailThemeToggle } from "@/components/app-shell/grouped-rail";
import {
  NAV,
  barItems,
  hrefFor as navHrefFor,
  isStaff,
  railGroups,
  railItems,
} from "@/components/settings/nav-items";
import { roleForPersona } from "@/components/settings/tabs-config";
import { openCounts } from "@/lib/ia/open-counts";
import { homeObligations } from "@/lib/home/obligations";
import { isMentorVisibleActivity } from "@/lib/onboarding/profile-update";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
/* `escalationObligations`, `isSettled` and `openTasks` moved BEHIND
   `openCounts` — the rail no longer derives any destination count itself, which
   is the point of Phase A. They are gone from here rather than left imported,
   because an unused count helper in the file that used to compute counts is an
   invitation to compute one again. */
import { monitoringData } from "@/lib/monitoring/scenarios";
import { tasksScenario } from "@/lib/tasks/seed";
import { withClosures } from "@/lib/tasks/closed-review";
import { useAppearance } from "@/lib/use-appearance";
import { useMounted } from "@/lib/use-mounted";
import { bumpNavClock, useNavClock, useShellConfig } from "@/lib/app-shell/shell-config";
import { ConsoleTopBar } from "@/components/app-shell/console-top-bar";
import { SupportPanel } from "@/components/support/support-panel";
import { useSupportUnread } from "@/lib/support/use-support";
import { teensNeedingReview, tierAlertLive, tierRoster } from "@/lib/monitoring/tier-roster";
import { useSupportOpen } from "@/lib/support/panel";

/** Who gets the desktop top bar and the support CTA (answered 2026-10-16). */
const TOP_BAR_PERSONAS = new Set(["mentor", "lead-mentor", "supervisor", "admin"]);

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const reported = useShellConfig();
  const active = reported?.active ?? "";
  const bottomInset = reported?.bottomInset;
  const pathname = usePathname();
  /* THE CLOCK REFRESHES ON NAVIGATION — an external store write, so it is not
     a setState in an effect. The first run is skipped: the store's clock was
     already read at module load, and bumping on mount would re-render the
     shell for nothing. */
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    bumpNavClock();
  }, [pathname]);
  return <ConsoleShellBody active={active} bottomInset={bottomInset}>{children}</ConsoleShellBody>;
}

function ConsoleShellBody({
  active,
  bottomInset,
  children,
}: {
  active: string;
  /** Forwarded verbatim to `AppShell` — a surface passes `"surface"` when its
   *  own inner scroller should run under the bottom bar and reserve the room
   *  itself. Chat's conversation list is the one that does. */
  bottomInset?: "panel" | "surface";
  children: React.ReactNode;
}) {
  const mounted = useMounted();
  const storePersona = useOnboardingStore((s) => s.persona);
  /** ═══ MOUNT-GATED, AND THE DEFAULT IS THE MENTOR ═══
   *  `persona` is client-only (localStorage-backed), so SSR and the first paint
   *  have to pick one. Both shells gated the same way and defaulted
   *  differently — the mentor shell to `"mentor"`, the console to
   *  `"supervisor"` — which was survivable while a route chose its shell and is
   *  not now that one component serves both. The mentor set is the default
   *  because it is the smaller one: a supervisor sees their rail a frame late,
   *  where the reverse would flash destinations at a reader who has none. */
  const persona = mounted ? storePersona : "mentor";
  const staff = isStaff(persona);
  const { theme, setTheme } = useAppearance();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  // ── Identity ──────────────────────────────────────────────────────────────
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  /** The mentor personas show the APPROVED chat avatar — what teens see now,
   *  not the proposed one. Staff show their Photo-row asset. */
  const approvedAvatar = useOnboardingStore(
    (s) => s.publishedSnapshot?.accountPhoto ?? null
  );
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  const mentorish = persona === "mentor" || persona === "new-mentor";
  const avatarInitial = mounted
    ? (firstName?.trim()?.[0] || "S").toUpperCase()
    : "S";
  const avatarSrc = mounted ? (mentorish ? approvedAvatar : staffPhoto) : null;

  // ── Badges ────────────────────────────────────────────────────────────────
  const activity = useOnboardingStore((s) => s.activity);
  const status = useOnboardingStore((s) => s.status);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);
  const tasksScenarioId = useOnboardingStore((s) => s.tasksScenarioId);
  const monitoringScenarioId = useOnboardingStore((s) => s.monitoringScenarioId);

  /** THE CLOCK IS FIXED AT MOUNT. `Date.now()` in render scope is impure and
   *  the React Compiler rejects it. It costs nothing for a count: the scenario
   *  always yields the same set and open-vs-resolved is a status, not a clock
   *  reading. */
  /* Was `useState(() => Date.now())`, refreshed by the per-route remount; now
     the shell persists, so the clock is the navigation clock (see the header). */
  const badgeNow = useNavClock();
  /* ═══ CLOSED REVIEWS ARE NOT OPEN (Closed-tab pack §0.3) ═══
     The badge read 16 with 9 open: this was the fixture, unfiltered, so a
     submitted review was still counted until the page that closed it set its
     own status. `withClosures` is the one rule the page and Today also run. */
  const closedCare = useOnboardingStore((s) => s.closedCareReviews);
  const scenarioItems = useMemo(
    () =>
      mounted && staff
        ? withClosures(tasksScenario(tasksScenarioId, badgeNow), closedCare)
        : [],
    [mounted, staff, tasksScenarioId, badgeNow, closedCare]
  );

  /** Staff-curated fields do not badge the mentor — see
   *  `isMentorVisibleActivity`. */
  const unread = mounted
    ? activity.filter((a) => !a.read && isMentorVisibleActivity(a)).length
    : 0;

  /** The Lead Mentor owns mentor reviews, and the queues moved into Team with
   *  the Mentors roster it absorbed — so the badge is on Team. */
  const reviewsWaiting =
    mounted && roleForPersona(persona) === "lead"
      ? (status === "in_review" ? 1 : 0) +
        (profileUpdate && profileUpdate.status !== "changes-requested" ? 1 : 0)
      : 0;

  /** ═══ THE DESTINATION BADGES ═══
   *
   *  One per destination, each counting what THAT destination holds — a
   *  different kind of thing per badge, which is why `badgeStyleFor` gives each
   *  a shape as well as a tone:
   *
   *   · ESCALATIONS counts live escalation RECORDS — the same primitive and
   *     the same function the destination's own header calls. An obligation
   *     against a five-minute clock, so red and bare.
   *   · RISK FLAGS counts open flags. Volume with no deadline — amber, and
   *     deliberately not a breach count, because no flag deadline is published.
   *   · CARE REVIEWS counts what is OPEN. It carried a clock and the word "due"
   *     until §2.9 retired the deadline concept from that destination; it is a
   *     bare count of work now, like the flag queue's.
   *   · TODAY counts the time-critical set only, and nothing when it is empty.
   *
   *  ZERO HIDES EVERY ONE OF THEM. The shared `count > 0` gate is what makes a
   *  lit badge mean something — see `homeObligations` for the measurement that
   *  argument rests on. */
  const owed = useMemo(
    () => homeObligations(scenarioItems, badgeNow),
    [scenarioItems, badgeNow]
  );
  /** ═══ THE ESCALATION BADGE READS RECORDS, NOT TASK ITEMS (addendum §2.10) ═══
   *
   *  MEASURED before this: the rail badge read 1 while the header two inches
   *  to the right read "2 escalations awaiting acknowledgement". Both were
   *  counting honestly and neither was wrong — they were counting DIFFERENT
   *  PRIMITIVES. Phase 6 moved the Escalations destination onto
   *  `EscalationRecord` and the badge stayed on `TaskItem`, which is the kind
   *  of divergence that survives because each side looks right on its own.
   *
   *  ONE PRIMITIVE, AND IT IS THE RECORD — the thing the destination renders
   *  and the thing a supervisor opens. `escalationObligations` is the same
   *  function the header calls, so the two are now two CALLERS of one function
   *  rather than two functions, which is what `today-mirror` already enforces
   *  between Today and this destination.
   *
   *  THE COST, STATED: the rail now builds the monitoring fixture on every
   *  route. It is a pure function of two scenario ids and a frozen clock,
   *  memoised on them — the same shape as `scenarioItems` beside it. */
  /** ═══ THE WHOLE FIXTURE, NOT JUST ITS ESCALATIONS (Refinement §7) ═══
   *  Two of the three badges below are derived from this, so it is built once
   *  and destructured rather than called per badge. */
  const monitoring = useMemo(
    () =>
      mounted && staff
        ? monitoringData(monitoringScenarioId, tasksScenarioId, badgeNow)
        : null,
    [mounted, staff, monitoringScenarioId, tasksScenarioId, badgeNow]
  );
  /** ═══ THE FLAG BADGE READS THE FIXTURE, NOT THE TASK ITEMS (§7) ═══
   *
   *  MEASURED, and reported at the end of the last pass: the Risk Flags header
   *  read `9 open` while this badge read `123`. Both counted honestly and
   *  neither was wrong — they were counting DIFFERENT SETS. The header reads
   *  `monitoringData(...).events`, which a monitoring scenario TRUNCATES via
   *  `flagPool(...).slice(0, n)`; this badge read `openTasks(scenarioItems)`
   *  and never consulted `monitoringScenarioId` at all, so it reported the
   *  untruncated pool.
   *
   *  THE DIVERGENCE WAS INSIDE THIS OBJECT. `escalations` already called
   *  `monitoringData(monitoringScenarioId, …)` two lines up while its two
   *  neighbours did not — which is exactly the shape the escalation badge's own
   *  note warns about: "each side looks right on its own". Same fix, same
   *  reason, one phase later: ONE PRIMITIVE PER DESTINATION, and it is the one
   *  the destination renders.
   *
   *  `care-reviews` KEEPS READING TASK ITEMS, and that is not an inconsistency:
   *  `tasks-page.tsx` builds from `tasksScenario(tasksScenarioId)` directly and
   *  never touches the monitoring fixture, so task items ARE that destination's
   *  primitive. The rule is "read what the page reads", not "read the fixture".
   *
   *  IT IS THE UNFILTERED TOTAL, DELIBERATELY (§6.4). Session filters and
   *  in-session resolves are page state and do not reach the rail — a badge
   *  that moved when a supervisor typed in a search box would stop being a
   *  count of what is waiting. */
  /** ═══ ONE EXPRESSION PER DESTINATION, AND IT LIVES IN `lib/ia` (Phase A) ═══
   *
   *  This object used to hold three derivations written here: escalations
   *  through `escalationObligations`, risk flags through the fixture, and care
   *  reviews through a task-type filter — while `todayCards` wrote its own
   *  three, one of which (care reviews) filtered by DOMAIN instead. Those two
   *  agreed only because the type table happened to make them agree.
   *
   *  `openCounts` is now the single source and both surfaces read it. The rail
   *  and Today cannot disagree about a destination, because there is no longer a
   *  second expression to disagree with.
   *
   *  WHAT STAYS HERE: the rail's own three non-destination badges (`activity`,
   *  `team`, `today`), which count different things for different reasons and
   *  are not destinations. `today`'s is called out in the report — it is a DEBT
   *  count, not an open count, and no phase in this pack specifies what it
   *  should become, so it is left exactly as it was. */
  const openBy = useMemo(
    () =>
      openCounts({
        items: scenarioItems,
        events: monitoring?.events ?? [],
        escalations: monitoring?.escalations ?? [],
        now: badgeNow,
      }),
    [scenarioItems, monitoring, badgeNow]
  );

  /** ═══ SUPPORT'S UNREAD, FOR THE CTA ═══
   *  One source since SUP-5: the same rows the panel lists (`use-support.ts`),
   *  so the badge and the panel cannot disagree. Zero until hydrated, when the
   *  persona is the real one. */
  const supportOpen = useSupportOpen();
  const supportUnreadLive = useSupportUnread();
  const supportUnread = mounted ? supportUnreadLive : 0;

  /* `monitoringScenarioId` is already read above, for the open counts. */
  const monitoringReview = useMemo(
    () => (mounted ? teensNeedingReview(tierRoster(tierAlertLive(monitoringScenarioId))) : 0),
    [mounted, monitoringScenarioId]
  );

  const badges: Record<string, number> = {
    /* THE ACTIVITY BADGE MOVED TO THE BELL (2026-10-16), with the tab. */
    ...(reviewsWaiting > 0 ? { team: reviewsWaiting } : {}),
    ...(staff && owed.total > 0 ? { today: owed.total } : {}),
    /* ESCALATIONS AND RISK FLAGS FOLDED INTO MONITORING (proto/monitoring-
       merge): one badge, teens needing review, from the tier roster the page
       renders — so the rail and the page cannot disagree. */
    ...(staff && monitoringReview > 0 ? { monitoring: monitoringReview } : {}),
    ...(staff && openBy["care-reviews"] > 0
      ? { "care-reviews": openBy["care-reviews"] }
      : {}),
  };

  return (
    <AppShell
      activeId={active}
      bottomInset={bottomInset}
      /** ═══ STAFF GET THE LABELLED RAIL; A MENTOR KEEPS THE ICON RAIL ═══
       *
       *  §2.3's scope is explicit — Lead Mentor, Supervisor and Admin — and it
       *  is the fork BETWEEN THOSE THREE that it forbids. A mentor is not in
       *  it, and the two rails are not cosmetic variants of each other:
       *  `SettingsSidebar` is a 92px ICON rail and `GroupedRail` is 248px of
       *  labelled rows.
       *
       *  THE FIRST VERSION PASSED THIS UNCONDITIONALLY and I recorded that it
       *  "renders as the flat rail did". It does not. MEASURED: it moved every
       *  mentor and new-mentor onto the 248px rail, taking 156px off the chat
       *  thread — and the `chat-thread` probe caught it as a reaction menu that
       *  could no longer be clicked, because the narrower thread column put the
       *  menu over the conversation list.
       *
       *  A PROBE ON A SURFACE THIS PHASE DOES NOT TOUCH is what found it, which
       *  is the argument for running all of them rather than the ones a change
       *  is "about". */
      railGroups={staff ? railGroups(persona) : undefined}
      /** The icon rail's input, used when `railGroups` is absent — which is the
       *  mentor personas. */
      railItems={railItems(persona)}
      /** ═══ TWO ROWS, AND THEY ARE DIFFERENT KINDS OF THING ═══
       *  `Announcements` is in the supervisor's target nav with no brief and no
       *  route — see `NAV.announcements` — so it is supervisor-only and inert.
       *  THE THEME TOGGLE IS EVERY PERSONA'S. It is the product's one theme
       *  control (addendum §2.5) and the preference is not a supervisor's
       *  privilege; scoping it to one persona would leave the others with the
       *  theme they were given and no way out of it. */
      railFooter={
        <>
          {isSupervisorTier(persona) && <RailFooterItem item={NAV.announcements} />}
          <RailThemeToggle theme={theme} onToggle={toggleTheme} />
        </>
      }
      /** THE ICON RAIL'S COPY OF THE SAME CONTROL. Only one of the two rails
       *  renders at a time, so only one of these is ever on screen. */
      railThemeToggle={
        <RailThemeToggle theme={theme} onToggle={toggleTheme} variant="tile" />
      }
      barItems={barItems(persona)}
      navLabel={staff ? "Supervisor sections" : "Mentor navigation"}
      badges={Object.keys(badges).length > 0 ? badges : undefined}
      avatarInitial={avatarInitial}
      avatarSrc={avatarSrc}
      hrefFor={(id) => navHrefFor(persona, id)}
      activityUnread={unread}
      className={staff ? "text-foreground" : undefined}
      /* ═══ THE DESKTOP TOP BAR — mentor, lead mentor, supervisor, admin ═══
         (answered 2026-10-16). Not `new-mentor`, who is still onboarding and
         has no supervisor relationship yet. Mount-gated like the rest of the
         persona-driven chrome. */
      mobileSupport={mounted && TOP_BAR_PERSONAS.has(persona) ? { unread: supportUnread } : undefined}
      /* THE SUPPORT PANEL (SUP-2), for the same personas as its CTA. Mounted
         by the persistent shell, so it survives route changes. */
      aside={mounted && TOP_BAR_PERSONAS.has(persona) ? <SupportPanel /> : undefined}
      asideOpen={mounted && TOP_BAR_PERSONAS.has(persona) && supportOpen}
      topBar={
        mounted && TOP_BAR_PERSONAS.has(persona) ? (
          <ConsoleTopBar supportUnread={supportUnread} activityUnread={unread} />
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}
