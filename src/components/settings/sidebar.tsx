"use client";

import {
  Bell,
  Calendar,
  GraduationCap,
  HelpCircle,
  Home,
  Megaphone,
  MessageCircle,
  Moon,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export interface SidebarItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

// Build-spec §5 final nav set: Figma 388:1586's five (Home, Chat, Activity,
// Upcoming, Teens) + Training carried over from the prototype (graduation-cap
// icon per spec). Todos / Community / Guidebook are dropped — do not re-add.
export const SIDEBAR_ITEMS: SidebarItemDef[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "activity", label: "Activity", icon: Bell },
  { id: "upcoming", label: "Upcoming", icon: Calendar },
  { id: "teens", label: "Teens", icon: Users },
  { id: "training", label: "Training", icon: GraduationCap },
];

// Bottom utility cluster — 40px white circular icon buttons (§2 spacing spec).
const UTILITIES = [
  { id: "theme", label: "Toggle dark mode", icon: Moon },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "help", label: "Help", icon: HelpCircle },
] as const;

interface SettingsSidebarProps {
  activeId: string;
  onSelect?: (id: string) => void;
  items?: SidebarItemDef[];
  /** Avatar asset unspecified (gaps.md #15) — interim neutral initial tile. */
  avatarInitial?: string;
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
  className,
}: SettingsSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-[92px] flex-col items-center bg-[var(--surface-s2)] px-3 py-5",
        className
      )}
    >
      <span
        aria-hidden
        className="flex size-[var(--sidebar-avatar)] shrink-0 items-center justify-center rounded-full bg-white font-display text-xl font-bold text-[var(--text-primary)] shadow-[var(--shadow-tile)]"
      >
        {avatarInitial}
      </span>

      <nav
        aria-label="Mentor navigation"
        className="mt-8 flex flex-1 flex-col items-center gap-5"
      >
        {items.map((item) => {
          const active = item.id === activeId;
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
                  "flex size-[var(--sidebar-tile)] items-center justify-center rounded-2xl transition-colors",
                  active
                    ? "bg-white shadow-[var(--shadow-tile)]"
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
        {UTILITIES.map((u) => (
          // 44px hit area wrapping the specced 40px visual circle (Phase 8).
          <button
            key={u.id}
            type="button"
            aria-label={u.label}
            className={cn(
              "flex size-11 items-center justify-center rounded-full",
              RING
            )}
          >
            <span className="flex size-[var(--sidebar-utility)] items-center justify-center rounded-full bg-white text-[var(--text-secondary)] shadow-[var(--shadow-tile)] transition-colors hover:text-[var(--text-primary)]">
              <u.icon className="size-4" aria-hidden />
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
