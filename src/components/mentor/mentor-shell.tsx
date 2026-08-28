"use client";

// The mentor app shell — build-spec §5 (Figma 426:4228): full-bleed surface/s2
// with the shared sidebar rail (SettingsSidebar) and a single floating
// surface/s1 content panel — radius 24, soft shadow, inset 16px from the top/
// right/bottom edges. Content scrolls INSIDE the panel.
//
// Role-aware nav (identical styling, only the item set changes): a Mentor sees
// the base rail (Home, Chat, Activity, Tasks, Teens, Team); a Lead Mentor sees
// the same minus Teens — they supervise mentors, not teens, and the mentors
// they lead live inside Team.
//
// Panel padding: §2 specs ~47×35, but hosted pages currently carry their own
// 24–40px insets — the panel adds none to avoid double-padding (gaps.md #21).

import { AppShell } from "@/components/app-shell/app-shell";
import {
  barItems,
  hrefFor as navHrefFor,
  railItems,
} from "@/components/settings/nav-items";
import { roleForPersona } from "@/components/settings/tabs-config";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isMentorVisibleActivity } from "@/lib/onboarding/profile-update";
import { useMounted } from "@/lib/use-mounted";

export function MentorShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const mounted = useMounted();
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const activity = useOnboardingStore((s) => s.activity);
  const persona = useOnboardingStore((s) => s.persona);
  // §5 Phase 10: the sidebar avatar is the CURRENT persona's own photo —
  // mentor personas show the APPROVED chat avatar (what teens see now, not
  // the proposed one); lead/supervisor show their Photo-row asset. The avatar
  // opens the account popover (settings-04) — it no longer navigates.
  const approvedAvatar = useOnboardingStore(
    (s) => s.publishedSnapshot?.accountPhoto ?? null
  );
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  const status = useOnboardingStore((s) => s.status);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);
  const mentorish = persona === "mentor" || persona === "new-mentor";
  // Mount-gated so SSR and first client paint agree (localStorage-backed store).
  const avatarInitial = mounted
    ? (firstName?.trim()?.[0] || "S").toUpperCase()
    : "S";
  const avatarSrc = mounted ? (mentorish ? approvedAvatar : staffPhoto) : null;
  // Staff-curated fields don't badge the mentor — see isMentorVisibleActivity.
  const unread = mounted
    ? activity.filter((a) => !a.read && isMentorVisibleActivity(a)).length
    : 0;
  // Mount-gated so SSR / first paint use the default set (persona is
  // client-only, localStorage-backed) — then the Lead swap applies.
  const isLead = mounted && roleForPersona(persona) === "lead";
  // Mount-gated: `persona` is client-only (localStorage-backed), so SSR and the
  // first paint use the mentor set and the lead swap applies after hydration.
  // `nav-items.ts` owns which items each persona gets — including why a lead has
  // no Mentees destination.
  const p = mounted ? persona : "mentor";
  // Role migration: the Lead Mentor owns mentor reviews — badge the TEAM item
  // (the queues moved there with the Mentors roster it absorbed) with what's
  // waiting: a submitted profile + an open, non-flagged changeset.
  const reviewsWaiting = isLead
    ? (status === "in_review" ? 1 : 0) +
      (profileUpdate && profileUpdate.status !== "changes-requested" ? 1 : 0)
    : 0;
  const badges = {
    ...(unread > 0 ? { activity: unread } : {}),
    ...(reviewsWaiting > 0 ? { team: reviewsWaiting } : {}),
  };

  return (
    // DELEGATED TO `AppShell` (Phase 2). This used to be the flex/rail/panel
    // markup inline, duplicated almost exactly in `AdminShell` — which is how a
    // nav pattern drifts, and RC-1 has to be fixed once rather than twice. What
    // stays here is the only genuinely mentor-specific part: the item set, the
    // badge counts, and the id → href mapping.
    <AppShell
      activeId={active}
      railItems={railItems(p)}
      barItems={barItems(p)}
      navLabel="Mentor navigation"
      badges={Object.keys(badges).length > 0 ? badges : undefined}
      avatarInitial={avatarInitial}
      avatarSrc={avatarSrc}
      // ONE MAP, in `nav-items.ts`, shared with the supervisor console.
      hrefFor={(id) => navHrefFor(p, id)}
      // Activity left the bar for the top-bar bell, so the bell carries its
      // count and needs its destination.
      activityHref={navHrefFor(p, "activity")}
      activityUnread={unread}
    >
      {children}
    </AppShell>
  );
}
