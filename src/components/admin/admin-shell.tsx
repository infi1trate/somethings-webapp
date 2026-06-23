"use client";

// The internal Somethings admin console chrome: a slim left icon rail + a main
// content area. A representative subset of the real console's nav (the full tool
// has ~20 sections) — this prototype only wires up Users → mentor review.

import Link from "next/link";
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

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: number;
}

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
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <nav
        aria-label="Admin sections"
        className="sticky top-0 flex h-dvh w-20 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r bg-card py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-brand font-display text-lg font-bold text-brand-foreground">
          S
        </div>
        {NAV.map((item) => {
          const isActive = item.key === active;
          const Icon = item.icon;
          const inner = (
            <span
              className={cn(
                "relative flex w-14 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="text-[11px] leading-tight">{item.label}</span>
              {item.badge ? (
                <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
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
              className="rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {inner}
            </Link>
          ) : (
            <span key={item.key} aria-disabled className="cursor-default">
              {inner}
            </span>
          );
        })}
        <div className="mt-auto pt-3 text-muted-foreground">
          <Settings className="size-5" aria-hidden />
        </div>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
