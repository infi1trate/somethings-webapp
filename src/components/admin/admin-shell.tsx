"use client";

// The internal Somethings SUPERVISOR console chrome ("Admin" renamed
// Supervisor everywhere — Phase 10, decision #12), reskinned to the new design
// system (Figma 429:1905): transparent sidebar on surface-s2, floating
// surface-s1 content card (radius 24, elevation-1, 16px gutter on top/right/
// bottom — none on the sidebar side). Same destinations, order, and behavior
// as before — this is a theme sync, not a redesign. A representative subset
// of the real console's nav; this prototype only wires up Users.

import Link from "next/link";
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
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: number;
}

// Keep ALL destinations + order — do not add, remove, or rename.
const NAV: NavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "chats", label: "Chats", icon: MessageCircle },
  { key: "ava", label: "AVA", icon: Sparkles },
  { key: "todos", label: "Todos", icon: Bell, badge: 4 },
  { key: "upcoming", label: "Upcoming", icon: CalendarClock },
  { key: "users", label: "Users", icon: Users, href: "/admin/users" },
  { key: "risk", label: "Risk", icon: Flag, badge: 71 },
  { key: "onboarding", label: "Onboarding", icon: GraduationCap },
];

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
  // interactive, deep-links to that row's editor.
  const staffPhoto = useOnboardingStore((s) => s.staffPhoto);
  const firstName = useOnboardingStore((s) => s.draft.firstName);
  const initial = mounted ? (firstName?.trim()?.[0] || "S").toUpperCase() : "S";
  const avatarSrc = mounted ? staffPhoto : null;

  return (
    <div className="flex h-dvh bg-[var(--surface-s2)] text-foreground">
      <nav
        aria-label="Supervisor sections"
        className="flex h-full w-20 shrink-0 flex-col items-center overflow-y-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Brand mark — same slot/behavior, sized to the new 56px round shell */}
        <div className="mb-2 flex size-14 shrink-0 items-center justify-center rounded-full bg-brand font-display text-lg font-bold text-brand-foreground">
          S
        </div>

        {/* §5 Phase 10: the Supervisor's own avatar — interactive, tooltip,
            ≥44px target; deep-links to Account › Photo row. */}
        <button
          type="button"
          // record-04b retarget: the Supervisor's photo lives on the record.
          onClick={() => router.push("/admin/mentor?focus=account")}
          aria-label="Change photo"
          className={cn(
            "group relative mb-2 shrink-0 rounded-full transition-shadow hover:ring-2 hover:ring-[var(--focus-ring)] hover:ring-offset-2 hover:ring-offset-[var(--surface-s2)]",
            RING
          )}
        >
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt=""
              className="size-11 rounded-full object-cover shadow-[var(--shadow-tile)]"
            />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-full bg-[var(--surface-s0)] font-display text-base font-bold text-[var(--text-primary)] shadow-[var(--shadow-tile)]">
              {initial}
            </span>
          )}
          <span
            role="presentation"
            className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[var(--text-primary)] px-2 py-1 text-[11px] font-medium leading-[14px] text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            Change photo
          </span>
        </button>

        {NAV.map((item) => {
          const isActive = item.key === active;
          const Icon = item.icon;
          const inner = (
            <span className="relative flex flex-col items-center gap-1 px-1 py-4">
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-[var(--radius-nav-tile)] transition-colors",
                  isActive
                    ? "bg-[var(--surface-s0)] shadow-[var(--shadow-tile)]"
                    : "group-hover:bg-white/50"
                )}
              >
                <Icon
                  className={cn(
                    "size-6",
                    isActive
                      ? "text-[var(--icon-primary)]"
                      : "text-[var(--icon-secondary)]"
                  )}
                  aria-hidden
                />
              </span>
              <span
                className={cn(
                  "text-[12px] leading-[16px]",
                  isActive
                    ? "font-bold text-[var(--text-primary)]"
                    : "font-medium text-[var(--text-secondary)]"
                )}
              >
                {item.label}
              </span>
              {item.badge ? (
                <span className="absolute right-0 top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--state-error)] px-1 text-[10px] font-semibold leading-none text-white">
                  {item.badge}
                </span>
              ) : null}
            </span>
          );
          return item.href ? (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn("group rounded-[var(--radius-nav-item)]", RING)}
            >
              {inner}
            </Link>
          ) : (
            <span
              key={item.key}
              aria-disabled
              className="group cursor-default rounded-[var(--radius-nav-item)]"
            >
              {inner}
            </span>
          );
        })}

        {/* Utility cluster — fully round per the new shell (styling only). */}
        <div className="mt-auto pt-3">
          <button
            type="button"
            aria-label="Settings"
            className={cn("flex size-11 items-center justify-center rounded-full", RING)}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-white text-[var(--icon-secondary)] shadow-[var(--shadow-tile)] transition-colors hover:text-[var(--icon-primary)]">
              <Settings className="size-4" aria-hidden />
            </span>
          </button>
        </div>
      </nav>

      {/* Floating content card — s1, radius 24, elevation-1; 16px gutter on
          top/right/bottom, flush to the sidebar side. Scrolls inside. */}
      <main className="min-w-0 flex-1 py-4 pr-4">
        <div className="h-full overflow-y-auto rounded-[var(--radius-panel)] bg-[var(--surface-s1)] shadow-[var(--shadow-panel)]">
          {children}
        </div>
      </main>
    </div>
  );
}
