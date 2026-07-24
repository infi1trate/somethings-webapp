"use client";

// The mentor app shell — build-spec §5 (Figma 426:4228): full-bleed surface/s2
// with the shared sidebar rail (SettingsSidebar) and a single floating
// surface/s1 content panel — radius 24, soft shadow, inset 16px from the top/
// right/bottom edges. Content scrolls INSIDE the panel.
//
// Role-aware nav (identical styling, only the item set changes): a Mentor sees
// the base rail (Home, Chat, Activity, Tasks, Teens); a Lead Mentor gets the
// same plus a Mentors roster (rendered here in the mentor app, not the
// console).
//
// Panel padding: §2 specs ~47×35, but hosted pages currently carry their own
// 24–40px insets — the panel adds none to avoid double-padding (gaps.md #21).

import { GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  SettingsSidebar,
  SIDEBAR_ITEMS,
  type SidebarItemDef,
} from "@/components/settings/sidebar";
import { roleForPersona } from "@/components/settings/tabs-config";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

// Lead Mentor rail = the base + a Mentors roster (GraduationCap mirrors the
// Supervisor console's Mentors icon).
const LEAD_ITEMS: SidebarItemDef[] = [
  ...SIDEBAR_ITEMS,
  { id: "mentors", label: "Mentors", icon: GraduationCap },
];

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
  // the proposed one); lead/supervisor show their Photo-row asset. Click
  // deep-links to that photo's editor.
  const approvedAvatar = useOnboardingStore(
    (s) => s.publishedSnapshot?.accountPhoto ?? null
  );
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  const mentorish = persona === "mentor" || persona === "new-mentor";
  // Mount-gated so SSR and first client paint agree (localStorage-backed store).
  const avatarInitial = mounted
    ? (firstName?.trim()?.[0] || "S").toUpperCase()
    : "S";
  const avatarSrc = mounted ? (mentorish ? approvedAvatar : staffPhoto) : null;
  // record-04b retarget: STAFF avatars now manage their photo on the Mentor
  // Record's Account section (settings no longer hosts staff-purpose org UI).
  const avatarTarget = mentorish
    ? "/app/profile?tab=profile&open=chat-avatar"
    : "/admin/mentor?focus=account";
  const unread = mounted ? activity.filter((a) => !a.read).length : 0;
  // Mount-gated so SSR / first paint use the default set (persona is
  // client-only, localStorage-backed) — then the Lead swap applies.
  const items =
    mounted && roleForPersona(persona) === "lead" ? LEAD_ITEMS : SIDEBAR_ITEMS;

  return (
    <div className="flex h-dvh bg-[var(--surface-s2)]">
      <SettingsSidebar
        activeId={active}
        items={items}
        avatarInitial={avatarInitial}
        avatarSrc={avatarSrc}
        onAvatarClick={() => router.push(avatarTarget)}
        badges={unread > 0 ? { activity: unread } : undefined}
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
