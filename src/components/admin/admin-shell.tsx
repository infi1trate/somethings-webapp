"use client";

// The internal Somethings SUPERVISOR console chrome ("Admin" renamed
// Supervisor — Phase 10, decision #12). The left rail is the SAME shared
// SettingsSidebar the mentor/lead shells use — identical styling across every
// role; only the item set (and its accessible label) changes per role. A
// representative subset of the real console's nav; this prototype only wires
// up Users. Content sits in the same floating surface-s1 panel as the mentor
// shell (radius 24, soft shadow, 16px gutter top/right/bottom).

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import {
  barItems,
  hrefFor as navHrefFor,
  railItems,
} from "@/components/settings/nav-items";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { tasksScenario } from "@/lib/tasks/seed";
import { openTasks } from "@/lib/tasks/sort";
import { monitoringObligations } from "@/lib/tasks/obligations";

// Supervisor nav. Users split into Teens + Mentors (each a role-filtered
// roster); AVA/Risk/Onboarding dropped; Upcoming renamed Tasks, Todos renamed
// ═══ THE NAV MOVED OUT (Phase 2A) ═══
//
// This file held its own `NAV` array and an `HREFS` ALLOWLIST. Both are gone:
// `nav-items.ts` is the single source, and the allowlist's premise no longer
// holds. It existed because sending a supervisor to the unbuilt-section
// placeholder was judged worse than an inert icon — a fair call for a 92px rail,
// and the wrong call for a four-item tab bar where Home and Chats would have been
// half the bar doing nothing. Every item now has a real URL; the unbuilt ones
// land on the placeholder, which says so plainly.
//
// The old comment warned "ANY NEW SUPERVISOR ROUTE MUST BE ADDED HERE" after a
// missing entry made Activity silently inert. That failure mode is now
// structurally impossible: there is no list to forget to update.

export function AdminShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const mounted = useMounted();
  // §5 Phase 10: the Supervisor's own photo (Account › Photo row asset) — the
  // single sidebar avatar. It opens the account popover (settings-04); it no
  // longer navigates.
  // Mount-gated like the mentor shell's: `persona` is client-only, so SSR uses
  // the supervisor set (this console is only ever rendered for staff, so that is
  // the correct default rather than a guess).
  const storePersona = useOnboardingStore((s) => s.persona);
  const persona = mounted ? storePersona : "supervisor";
  /** ═══ THE TASKS BADGE — OPEN BILLING REVIEWS (arch-A) ═══
   *
   *  NEW IN THIS PHASE, not scoped down from something. Recon found no Tasks
   *  badge existed at all: this shell passed `{ activity: 4 }` and nothing
   *  computed a task count anywhere.
   *
   *  IT COUNTS WHAT THE SURFACE HOLDS, which is now billing alone. Filtered here
   *  rather than counting every domain, because a badge reading 85 over a page
   *  showing 15 is a badge that lies — and after Phase B the other 70 belong to
   *  a different destination.
   *
   *  `Date.now()` RATHER THAN THE PAGE'S CLOCK. The count is open-vs-resolved,
   *  which no clock affects; only breach does, and the badge does not show
   *  breach. Mount-gated like every other store read on this shell, so SSR and
   *  the first paint agree.
   *
   *  ZERO HIDES THE BADGE, AND THAT IS NOT WHAT THE PHASE ASKED FOR — see
   *  design-system-gaps.md row 359. The brief wants zero to stay visible, because
   *  on a completion surface zero is the goal state rather than an absence. The
   *  shared sidebar gates every badge on `> 0`, and un-gating it there would put
   *  a permanent `0` on Activity's bell — and a red one, since the badge is
   *  `--state-error`. That needs a neutral count treatment first, so it is logged
   *  rather than made inside a phase whose job is scoping one surface.
   *
   *  THE LABEL WAS NOT LOGGED, IT WAS FIXED. Every badge announced "{n} unread",
   *  so this one said "Tasks, 15 unread" — Activity's word, about work rather
   *  than mail. `badgeNounFor` gives each item its own noun and defaults to the
   *  old one, so Activity's label did not move. */
  const tasksScenarioId = useOnboardingStore((s) => s.tasksScenarioId);
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const avatarInitial = mounted
    ? (firstName?.trim()?.[0] || "S").toUpperCase()
    : "S";
  const avatarSrc = mounted ? staffPhoto : null;

  /* `activity: 4` IS UNCHANGED and still a literal — Activity's own unread count
     is not this phase's business.

     THE CLOCK IS FIXED AT MOUNT, matching `tasks-page.tsx:120` exactly.
     `Date.now()` in render scope is impure and the compiler's purity rule
     rejects it — caught by lint, not by reasoning. It costs nothing here: the
     scenario always yields the same set, and open-vs-resolved is a status, so
     the COUNT does not depend on the clock at all. Only breach does, and this
     badge does not show breach. */
  const [badgeNow] = useState(() => Date.now());
  const scenarioItems = useMemo(
    () => (mounted ? tasksScenario(tasksScenarioId, badgeNow) : []),
    [mounted, tasksScenarioId, badgeNow]
  );
  const billingOpen = useMemo(
    () => openTasks(scenarioItems).filter((i) => i.domain === "billing").length,
    [scenarioItems]
  );

  /** ═══ MONITORING'S BADGE COUNTS DEBT, NOT VOLUME (arch-B) ═══
   *
   *  The reasoning lives at `monitoringObligations` and is the load-bearing part
   *  of this line: an open count on this surface would never be zero — 43 flags
   *  on a typical shift, 123 on a heavy one, against a routine tier with a
   *  seven-day SLA — and a badge that is never zero stops being read within a
   *  week. This counts the two things a named person has already failed to do by
   *  a time that has already passed: an Imminent flag past 24h, and an escalation
   *  closed without a escalation note.
   *
   *  IT IS THE ONLY GLOBAL SURFACING OF EITHER, and that is why it ships with B
   *  rather than waiting for Home in Phase C. Between these phases Monitoring
   *  exists with no shift surface above it, so without this line an Imminent
   *  breach is visible only to someone already looking at the page it is on.
   *
   *  THE CLOCK IS FIXED AT MOUNT, like the Tasks count beside it — but unlike
   *  that one this badge DOES depend on the clock, because breach is `now >
   *  slaDeadline`. A session left open overnight will under-report until it is
   *  reloaded. Accepted for a prototype and recorded rather than papered over
   *  with an interval; the fix is a shared ticking clock, which is a change to
   *  every surface's re-render budget and not this phase's to make. */
  const obligations = useMemo(
    () => monitoringObligations(scenarioItems, badgeNow),
    [scenarioItems, badgeNow]
  );

  const badges = {
    activity: 4,
    ...(billingOpen > 0 ? { tasks: billingOpen } : {}),
    // ZERO HIDES IT, and here that is right rather than a compromise: nothing
    // owed is the resting state of a vigilance surface, and the shared rail's
    // `badge > 0` gate says so for free. Contrast the Tasks badge, where zero is
    // the goal state and hiding it loses the win — gap row 359.
    ...(obligations.total > 0 ? { monitoring: obligations.total } : {}),
  };

  return (
    // DELEGATED TO `AppShell` (Phase 3, on the Phase 2 pattern). This was the
    // flex/rail/panel markup inline, duplicated almost exactly in
    // `MentorShell` — which is how a nav pattern drifts, and RC-1 has to be
    // fixed once rather than twice. The shared-sidebar principle this file
    // established (identical styling across roles; only the item set and the
    // navLabel change) is now structural rather than a convention two files
    // happen to follow.
    //
    // WHAT STAYS HERE is the genuinely supervisor-specific part: the item set,
    // the badge count, and the id → href allowlist.
    <AppShell
      activeId={active}
      railItems={railItems(persona)}
      barItems={barItems(persona)}
      navLabel="Supervisor sections"
      avatarInitial={avatarInitial}
      avatarSrc={avatarSrc}
      badges={badges}
      hrefFor={(id) => navHrefFor(persona, id)}
      activityHref={navHrefFor(persona, "activity")}
      activityUnread={4}
      className="text-foreground"
    >
      {children}
    </AppShell>
  );
}
