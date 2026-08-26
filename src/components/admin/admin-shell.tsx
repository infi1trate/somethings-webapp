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
  Bell,
  ListChecks,
  Users,
  UsersRound,
} from "lucide-react";
import {
  SettingsSidebar,
  type SidebarItemDef,
} from "@/components/settings/sidebar";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

// Supervisor nav. Users split into Teens + Mentors (each a role-filtered
// roster); AVA/Risk/Onboarding dropped; Upcoming renamed Tasks, Todos renamed
// Activity. Home/Chats/Activity/Tasks are parity placeholders and navigate
// nowhere; only Teens + Mentors are wired via HREFS.
const NAV: SidebarItemDef[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "activity", label: "Activity", icon: Bell },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "mentees", label: "Mentees", icon: Users },
  // Mentors merged into Team — one staff directory instead of a roster plus
  // a peer list describing the same people.
  { id: "team", label: "Team", icon: UsersRound },
];

// AN ALLOWLIST, NOT A PATTERN — and that is the bug this comment exists to stop
// recurring. The mentor shell routes generically (`/app/${id}` for every item), so
// a nav item there works the moment its route exists. THIS shell only navigates
// for ids present below, and an id that is missing hits `if (href)` and silently
// does nothing: the item highlights, the page does not change, and there is no
// error anywhere.
//
// That is precisely what happened to Activity. The item had been in the supervisor
// NAV since the Tasks-era nav pass, the route was built, and clicking it did
// nothing — while the same click worked for a mentor. "Sometimes it doesn't open"
// is what a silent allowlist miss looks like from the outside.
//
// ANY NEW SUPERVISOR ROUTE MUST BE ADDED HERE. The remaining unlisted ids (home,
// chats, tasks) are unlisted because they have no real destination yet — their
// routes fall through to the /app/[section] unbuilt-section placeholder, and
// sending a supervisor to a placeholder is worse than the current inertness. They
// get wired when they get pages.
const HREFS: Record<string, string> = {
  // The supervisor's Mentees list is the shared /app/mentees route (already
  // supervisor-aware: it renders the full roster for this persona). The old
  // /admin/users?segment=teens surface is retired.
  mentees: "/app/mentees",
  // Team is the shared staff directory (it replaced the Mentors roster) and
  // lives on the app route for every persona — the supervisor just sees it
  // inside this console's chrome.
  team: "/app/team",
  // The Activity ledger. One route, persona-branched inside the page: supervisors
  // get the ledger, mentors and leads keep the profile-update feed.
  activity: "/app/activity",
  // The Tasks worklist. Same arrangement — supervisors get the worklist, everyone
  // else keeps the unbuilt-section placeholder. Added here rather than left to the
  // allowlist gap that made the Activity item silently inert.
  tasks: "/app/tasks",
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
  // §5 Phase 10: the Supervisor's own photo (Account › Photo row asset) — the
  // single sidebar avatar. It opens the account popover (settings-04); it no
  // longer navigates.
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
        badges={{ activity: 4 }}
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
