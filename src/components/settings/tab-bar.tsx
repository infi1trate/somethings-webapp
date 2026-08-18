"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  tabsForRole,
  type SettingsRole,
} from "@/components/settings/tabs-config";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The bar only ever reads id + label, so any caller with those can use it —
 *  a local two-tab control shouldn't have to fake registry fields (roles,
 *  status) it has no concept of. SettingsTabDef satisfies this structurally. */
export interface TabBarItem {
  id: string;
  label: string;
}

interface SettingsTabBarProps {
  /** Only needed when `tabs` is omitted — the registry lookup wants a role. */
  role?: SettingsRole;
  activeId: string;
  onChange: (id: string) => void;
  /** Explicit tabs. Production settings nav derives from the §3 registry
   *  instead; local controls (e.g. the first-messages Online/Offline channel)
   *  pass their own. */
  tabs?: TabBarItem[];
  /** Accessible name for the tablist. Defaults to the settings nav's. */
  ariaLabel?: string;
  className?: string;
}

// Tab bar — build-spec §2: 48px height, border-bottom pattern (active 1.5px
// #716a60 + bold; the continuous 1px #dfddd8 hairline carries the inactive
// underline). Inactive labels use text/secondary #58534b, NOT the specced
// tertiary #a0998d (2.57:1, fails AA) nor #797774 (4.06:1) — gaps.md #1/#2.
// Active bold renders synthetic on Lausanne-400 (gaps.md #12).
// Keyboard: ←/→/Home/End roving tabindex per spec §6.
export function SettingsTabBar({
  role,
  activeId,
  onChange,
  tabs,
  ariaLabel = "Settings sections",
  className,
}: SettingsTabBarProps) {
  const list: TabBarItem[] = tabs ?? (role ? tabsForRole(role) : []);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const clamped = (index + list.length) % list.length;
    refs.current[clamped]?.focus();
    onChange(list[clamped].id);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex items-end gap-7 border-b border-[var(--border-subtle)]",
        className
      )}
    >
      {list.map((t, i) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                select(i + 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                select(i - 1);
              } else if (e.key === "Home") {
                e.preventDefault();
                select(0);
              } else if (e.key === "End") {
                e.preventDefault();
                select(list.length - 1);
              }
            }}
            className={cn(
              "-mb-px flex h-[var(--tab-h)] items-center rounded-t-md text-[16px] leading-[20px] transition-colors",
              RING,
              active
                ? "border-b-[1.5px] border-[var(--button-border-default)] font-bold text-[var(--text-primary)]"
                : "border-b border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
