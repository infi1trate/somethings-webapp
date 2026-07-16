"use client";

// The mentor app shell — build-spec §5 (Figma 426:4228): full-bleed surface/s2
// with the shared six-item sidebar rail (Phase 0 SettingsSidebar: Home, Chat,
// Activity, Upcoming, Teens, Training) and a single floating surface/s1 content
// panel — radius 24, soft shadow, inset 16px from the top/right/bottom edges.
// Content scrolls INSIDE the panel. This supersedes the previous rail treatment
// entirely (orange brand tile, Todos/Community/Guidebook — removed per §5).
//
// Panel padding: §2 specs ~47×35, but hosted pages currently carry their own
// 24–40px insets — the panel adds none to avoid double-padding (gaps.md #21).

import { useRouter } from "next/navigation";
import { SettingsSidebar } from "@/components/settings/sidebar";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

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
  // Mount-gated so SSR and first client paint agree (localStorage-backed store).
  const avatarInitial = mounted
    ? (firstName?.trim()?.[0] || "S").toUpperCase()
    : "S";

  return (
    <div className="flex h-dvh bg-[var(--surface-s2)]">
      <SettingsSidebar
        activeId={active}
        avatarInitial={avatarInitial}
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
