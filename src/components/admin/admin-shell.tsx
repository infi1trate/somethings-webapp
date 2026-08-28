"use client";

// The internal Somethings SUPERVISOR console chrome ("Admin" renamed
// Supervisor — Phase 10, decision #12). The left rail is the SAME shared
// SettingsSidebar the mentor/lead shells use — identical styling across every
// role; only the item set (and its accessible label) changes per role. A
// representative subset of the real console's nav; this prototype only wires
// up Users. Content sits in the same floating surface-s1 panel as the mentor
// shell (radius 24, soft shadow, 16px gutter top/right/bottom).

import { AppShell } from "@/components/app-shell/app-shell";
import {
  barItems,
  hrefFor as navHrefFor,
  railItems,
} from "@/components/settings/nav-items";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

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
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const avatarInitial = mounted
    ? (firstName?.trim()?.[0] || "S").toUpperCase()
    : "S";
  const avatarSrc = mounted ? staffPhoto : null;

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
      badges={{ activity: 4 }}
      hrefFor={(id) => navHrefFor(persona, id)}
      activityHref={navHrefFor(persona, "activity")}
      activityUnread={4}
      className="text-foreground"
    >
      {children}
    </AppShell>
  );
}
