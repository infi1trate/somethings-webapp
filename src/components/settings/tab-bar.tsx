"use client";

import { useRef } from "react";
import { EdgeFades, useEdgeOverflow } from "@/components/ui/scroll-affordance";
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const edges = useEdgeOverflow(scrollRef);

  const select = (index: number) => {
    const clamped = (index + list.length) % list.length;
    refs.current[clamped]?.focus();
    onChange(list[clamped].id);
  };

  return (
    // ═══ OVERFLOW AFFORDANCE (Phase 6) ═══
    //
    // This had NO overflow handling at all — `flex items-end gap-7` and nothing
    // else. Four tabs with 28px gaps do not fit a 320px column, and a flex row
    // does not wrap by default, so the tabs simply ran past the container and
    // took the PAGE into horizontal scroll with them. That is a worse failure
    // than the record tab strip's (which at least scrolled itself), and it fails
    // SC 1.4.10 Reflow rather than just Nielsen #6.
    //
    // SAME TREATMENT AS THE RECORD STRIP, for the same reasons recorded in
    // `ui/scroll-affordance.tsx`: the region scrolls itself, the scrollbar is
    // hidden (it would draw chrome across a 44px-tall nav), and position-aware
    // fades say "there is more this way".
    //
    // BOTH AXES DECLARED — `overflow-y-hidden` is not cosmetic. Per the CSS
    // overflow spec a lone `overflow-x` promotes the Y axis to `auto`, and the
    // active tab's `-mb-px` border sits 1px OUTSIDE the content box, which is
    // exactly the 1px that gave the record strip a 15px vertical scrollbar.
    //
    // THE ROVING TABINDEX IS UNTOUCHED (spec §6): ←/→/Home/End and the
    // `tabIndex={active ? 0 : -1}` pattern below are exactly as they were.
    <div className="relative">
      <div
        ref={scrollRef}
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "flex items-end gap-7 overflow-x-auto overflow-y-hidden border-b border-[var(--border-subtle)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
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
                // `shrink-0` so the row scrolls rather than compressing labels
                // into each other.
                "-mb-px flex h-[var(--tab-h)] shrink-0 items-center rounded-t-md text-[16px] leading-[20px] transition-colors",
                RING,
                active
                  ? "border-b-[1.5px] border-[var(--button-border-default)] font-bold text-[var(--text-primary)]"
                  : "border-b border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {/* Stops short of the hairline so the border-b and the active tab's
          1.5px underline stay crisp — same reason as the record strip's. */}
      <EdgeFades
        edges={edges}
        surface="var(--surface-s1)"
        className="bottom-px"
      />
    </div>
  );
}
