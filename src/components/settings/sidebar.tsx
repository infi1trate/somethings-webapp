"use client";

import {
  Bell,
  HelpCircle,
  Home,
  ListChecks,
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

// Mentor app nav (base, shared by Mentor + Lead Mentor). Home, Chat,
// Activity, Tasks, Teens. Training removed and Upcoming renamed Tasks per the
// role-nav pass; Lead Mentor appends a Mentors roster (see mentor-shell).
export const SIDEBAR_ITEMS: SidebarItemDef[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "activity", label: "Activity", icon: Bell },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "teens", label: "Teens", icon: Users },
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
  /** Initial-letter fallback when the persona has no photo yet. */
  avatarInitial?: string;
  /** The CURRENT persona's own photo (§5 Phase 10) — approved chat avatar for
   *  mentor personas, the Photo-row asset for lead/supervisor. */
  avatarSrc?: string | null;
  /** Makes the avatar interactive ("Change photo"): ring on hover/focus,
   *  tooltip, ≥44px target, keyboard reachable. Omit for a passive tile. */
  onAvatarClick?: () => void;
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
  onAvatarClick,
  badges,
  navLabel = "Mentor navigation",
  className,
}: SettingsSidebarProps) {
  const avatarFace = avatarSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSrc}
      alt=""
      className="size-[var(--sidebar-avatar)] rounded-full object-cover shadow-[var(--shadow-tile)]"
    />
  ) : (
    <span className="flex size-[var(--sidebar-avatar)] items-center justify-center rounded-full bg-white font-display text-xl font-bold text-[var(--text-primary)] shadow-[var(--shadow-tile)]">
      {avatarInitial}
    </span>
  );

  return (
    <aside
      className={cn(
        "flex h-full w-[92px] flex-col items-center bg-[var(--surface-s2)] px-3 py-5",
        className
      )}
    >
      {onAvatarClick ? (
        // §5 Phase 10: the avatar is the persona's own photo and a real
        // control — 56px (≥44 target), ring on hover/focus, tooltip echo of
        // the accessible name. Tooltip is an interim treatment (gaps.md #60).
        <button
          type="button"
          onClick={onAvatarClick}
          aria-label="Change photo"
          className={cn(
            "group relative shrink-0 rounded-full transition-shadow hover:ring-2 hover:ring-[var(--focus-ring)] hover:ring-offset-2 hover:ring-offset-[var(--surface-s2)]",
            RING
          )}
        >
          {avatarFace}
          <span
            role="presentation"
            className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[var(--text-primary)] px-2 py-1 text-[11px] font-medium leading-[14px] text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            Change photo
          </span>
        </button>
      ) : (
        <span aria-hidden className="shrink-0">
          {avatarFace}
        </span>
      )}

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
                {badge > 0 && (
                  <span
                    aria-label={`${badge} unread`}
                    className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--state-error)] px-1 text-[10px] font-semibold leading-none text-white"
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
