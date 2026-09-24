"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ONE SHELL, EVERY AUTHENTICATED ROUTE (addendum §2.3)
//
// ═══ THE FORK THIS REPLACES, MEASURED ═══
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

import { useMemo, useState } from "react";
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
import { DESTINATION_TYPES } from "@/lib/ia/destinations";
import { homeObligations } from "@/lib/home/obligations";
import { isMentorVisibleActivity } from "@/lib/onboarding/profile-update";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  escalationObligations,
  isSettled,
} from "@/lib/monitoring/escalation";
import { monitoringData } from "@/lib/monitoring/scenarios";
import { tasksScenario } from "@/lib/tasks/seed";
import { openTasks } from "@/lib/tasks/sort";
import { useAppearance } from "@/lib/use-appearance";
import { useMounted } from "@/lib/use-mounted";

export function AppChrome({
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
  const [badgeNow] = useState(() => Date.now());
  const scenarioItems = useMemo(
    () => (mounted && staff ? tasksScenario(tasksScenarioId, badgeNow) : []),
    [mounted, staff, tasksScenarioId, badgeNow]
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
  const escalationRecords = useMemo(
    () =>
      mounted && staff
        ? monitoringData(monitoringScenarioId, tasksScenarioId, badgeNow).escalations
        : [],
    [mounted, staff, monitoringScenarioId, tasksScenarioId, badgeNow]
  );
  const openBy = useMemo(() => {
    const count = (id: keyof typeof DESTINATION_TYPES) =>
      openTasks(scenarioItems).filter((i) =>
        DESTINATION_TYPES[id].includes(i.taskType)
      ).length;
    return {
      escalations: escalationObligations(
        escalationRecords.filter((r) => !isSettled(r, badgeNow)),
        badgeNow
      ).active,
      "risk-flags": count("risk-flags"),
      "care-reviews": count("care-reviews"),
    };
  }, [scenarioItems, escalationRecords, badgeNow]);

  const badges: Record<string, number> = {
    ...(unread > 0 ? { activity: unread } : {}),
    ...(reviewsWaiting > 0 ? { team: reviewsWaiting } : {}),
    ...(staff && owed.total > 0 ? { today: owed.total } : {}),
    ...(staff && openBy.escalations > 0
      ? { escalations: openBy.escalations }
      : {}),
    ...(staff && openBy["risk-flags"] > 0
      ? { "risk-flags": openBy["risk-flags"] }
      : {}),
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
      activityHref={navHrefFor(persona, "activity")}
      activityUnread={unread}
      className={staff ? "text-foreground" : undefined}
    >
      {children}
    </AppShell>
  );
}
