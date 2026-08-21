"use client";

import {
  Bell,
  HelpCircle,
  Home,
  ListChecks,
  MessageCircle,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { AccountPopover } from "@/components/settings/account-popover";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export interface SidebarItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

// Mentor app nav (base, shared by Mentor + Lead Mentor). Home, Chat,
// Activity, Tasks, Teens. Training removed and Upcoming renamed Tasks per the
// role-nav pass; Lead Mentor appends a Mentors roster (see mentor-shell).
export const SIDEBAR_ITEMS: SidebarItemDef[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "activity", label: "Activity", icon: Bell },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "mentees", label: "Mentees", icon: Users },
  // Team = the staff directory (leads + supervisors, plus a lead's own
  // mentors). It absorbed the old separate "Mentors" roster.
  { id: "team", label: "Team", icon: UsersRound },
];

// Bottom utility cluster (settings-04): Settings gear (all personas →
// /app/settings) + Help. The old announcements icon is gone; the theme toggle
// moved into the avatar's account popover (shared useAppearance state).

interface SettingsSidebarProps {
  activeId: string;
  onSelect?: (id: string) => void;
  items?: SidebarItemDef[];
  /** Initial-letter fallback when the persona has no photo yet. */
  avatarInitial?: string;
  /** The CURRENT persona's own photo (§5 Phase 10) — approved chat avatar for
   *  mentor personas, the Photo-row asset for lead/supervisor. Feeds the
   *  account popover the avatar opens (settings-04). */
  avatarSrc?: string | null;
  /** Unread counts by item id (e.g. { activity: 2 }) — red dot badge on the
   *  icon tile, mirroring the Supervisor console's treatment. */
  badges?: Record<string, number>;
  /** Accessible name for the nav landmark — the styling is identical across
   *  roles; only the item set and this label change (e.g. supervisor passes
   *  "Supervisor sections"). */
  navLabel?: string;
  className?: string;
}

// App-shell sidebar on surface/s2 — build-spec §5. Active item = 48px white
// tile with tile shadow + bold black label; inactive = bare icon + medium
// #58534b label (Lausanne 500 renders synthetic — gaps.md #12). Labels are
// Title-case per Figma (gaps.md #17). Hover tint is an interim (gaps.md #5).
export function SettingsSidebar({
  activeId,
  onSelect,
  items = SIDEBAR_ITEMS,
  avatarInitial = "S",
  avatarSrc = null,
  badges,
  navLabel = "Mentor navigation",
  className,
}: SettingsSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-[92px] flex-col items-center bg-[var(--surface-s2)] px-3 py-5",
        className
      )}
    >
      {/* The avatar opens the account popover (settings-04) — click/keyboard
          only; hover shows a plain "Account" tooltip. */}
      <AccountPopover avatarSrc={avatarSrc} avatarInitial={avatarInitial} />

      <nav
        aria-label={navLabel}
        className="mt-8 flex flex-1 flex-col items-center gap-5"
      >
        {items.map((item) => {
          const active = item.id === activeId;
          const badge = badges?.[item.id] ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect?.(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn("group flex flex-col items-center gap-1.5 rounded-2xl", RING)}
            >
              <span
                className={cn(
                  "relative flex size-[var(--sidebar-tile)] items-center justify-center rounded-2xl transition-colors",
                  active
                    ? "bg-[var(--surface-card)] shadow-[var(--shadow-tile)]"
                    : "group-hover:bg-white/60"
                )}
              >
                <item.icon
                  aria-hidden
                  className={cn(
                    "size-5",
                    active
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)]"
                  )}
                />
                {badge > 0 && (
                  <span
                    aria-label={`${badge} unread`}
                    className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--state-error)] px-1 text-[10px] font-semibold leading-none text-[var(--text-inverse)]"
                  >
                    {badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[12px] leading-[16px] tracking-[0.3px]",
                  active
                    ? "font-bold text-[var(--text-primary)]"
                    : "font-medium text-[var(--text-secondary)]"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-6 flex flex-col items-center gap-1">
        {/* Settings — every persona (settings-04). 44px hit area wrapping the
            specced 40px visual circle (Phase 8); lit when the settings surface
            is active. */}
        <Link
          href="/app/settings"
          aria-label="Settings"
          aria-current={activeId === "settings" ? "page" : undefined}
          className={cn("flex size-11 items-center justify-center rounded-full", RING)}
        >
          <span
            className={cn(
              "flex size-[var(--sidebar-utility)] items-center justify-center rounded-full bg-[var(--surface-card)] shadow-[var(--shadow-tile)] transition-colors",
              activeId === "settings"
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <Settings className="size-4" aria-hidden />
          </span>
        </Link>
        {/* Help — placeholder destination (no content yet). */}
        <button
          type="button"
          aria-label="Help"
          className={cn("flex size-11 items-center justify-center rounded-full", RING)}
        >
          <span className="flex size-[var(--sidebar-utility)] items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-[var(--shadow-tile)] transition-colors hover:text-[var(--text-primary)]">
            <HelpCircle className="size-4" aria-hidden />
          </span>
        </button>
      </div>
    </aside>
  );
}
