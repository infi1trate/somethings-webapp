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

import { useRouter } from "next/navigation";
import {
  SettingsSidebar,
  SIDEBAR_ITEMS,
  type SidebarItemDef,
} from "@/components/settings/sidebar";
import { roleForPersona } from "@/components/settings/tabs-config";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isMentorVisibleActivity } from "@/lib/onboarding/profile-update";
import { useMounted } from "@/lib/use-mounted";

// Lead Mentor rail = the base MINUS Teens. Leads supervise mentors, not teens
// (teens reach them through the mentor who holds the match), so a Teens
// destination would be a list they don't own. The mentors they DO lead live in
// Team, which absorbed the old separate "Mentors" roster.
const LEAD_ITEMS: SidebarItemDef[] = SIDEBAR_ITEMS.filter(
  (i) => i.id !== "mentees"
);

export function MentorShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
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
  const items = isLead ? LEAD_ITEMS : SIDEBAR_ITEMS;
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
    <div className="flex h-dvh bg-[var(--surface-s2)]">
      <SettingsSidebar
        activeId={active}
        items={items}
        avatarInitial={avatarInitial}
        avatarSrc={avatarSrc}
        badges={Object.keys(badges).length > 0 ? badges : undefined}
        onSelect={(id) => router.push(id === "home" ? "/app" : `/app/${id}`)}
        className="shrink-0 overflow-y-auto"
      />
      <main className="min-w-0 flex-1 py-4 pr-4">
        <div className="h-full overflow-y-auto rounded-[var(--radius-panel)] bg-[var(--surface-s1)] shadow-[var(--shadow-panel)]">
          {children}
        </div>
      </main>
    </div>
  );
}
