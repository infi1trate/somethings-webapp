"use client";

// The internal Somethings SUPERVISOR console chrome ("Admin" renamed
// Supervisor — Phase 10, decision #12). The left rail is the SAME shared
// SettingsSidebar the mentor/lead shells use — identical styling across every
// role; only the item set (and its accessible label) changes per role. A
// representative subset of the real console's nav; this prototype only wires
// up Users. Content sits in the same floating surface-s1 panel as the mentor
// shell (radius 24, soft shadow, 16px gutter top/right/bottom).

import { useRouter } from "next/navigation";
import {
  Home,
  MessageCircle,
  Sparkles,
  Bell,
  CalendarClock,
  Users,
  Flag,
  GraduationCap,
} from "lucide-react";
import {
  SettingsSidebar,
  type SidebarItemDef,
} from "@/components/settings/sidebar";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

// Supervisor nav — keep ALL destinations + order. Only "users" is wired in the
// prototype; the rest are present for parity and navigate nowhere.
const NAV: SidebarItemDef[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "ava", label: "AVA", icon: Sparkles },
  { id: "todos", label: "Todos", icon: Bell },
  { id: "upcoming", label: "Upcoming", icon: CalendarClock },
  { id: "users", label: "Users", icon: Users },
  { id: "risk", label: "Risk", icon: Flag },
  { id: "onboarding", label: "Onboarding", icon: GraduationCap },
];

const HREFS: Record<string, string> = {
  users: "/admin/users",
};

export function AdminShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const mounted = useMounted();
  // §5 Phase 10: the Supervisor's own photo (Account › Photo row asset) —
  // the single sidebar avatar, deep-links to that row's editor (record-04b:
  // the staff photo lives on the Mentor Record now).
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const avatarInitial = mounted
    ? (firstName?.trim()?.[0] || "S").toUpperCase()
    : "S";
  const avatarSrc = mounted ? staffPhoto : null;

  return (
    <div className="flex h-dvh bg-[var(--surface-s2)] text-foreground">
      <SettingsSidebar
        activeId={active}
        items={NAV}
        navLabel="Supervisor sections"
        avatarInitial={avatarInitial}
        avatarSrc={avatarSrc}
        onAvatarClick={() => router.push("/admin/mentor?focus=account")}
        badges={{ todos: 4, risk: 71 }}
        onSelect={(id) => {
          const href = HREFS[id];
          if (href) router.push(href);
        }}
        className="shrink-0 overflow-y-auto"
      />
      {/* Floating content card — identical to the mentor shell's panel. */}
      <main className="min-w-0 flex-1 py-4 pr-4">
        <div className="h-full overflow-y-auto rounded-[var(--radius-panel)] bg-[var(--surface-s1)] shadow-[var(--shadow-panel)]">
          {children}
        </div>
      </main>
    </div>
  );
}
