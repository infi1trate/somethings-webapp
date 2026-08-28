"use client";

// Appearance — the one fully-built Settings section in settings-01. A
// canonical Light / Dark / System control wired to the existing `.dark`
// theme system via useAppearance (self-contained; the sidebar moon joins
// this same state in settings-04). Mount-gated so the active state only
// paints client-side (theme is a localStorage read) — no hydration flip.

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useAppearance, type ThemeChoice } from "@/lib/use-appearance";
import { touchTarget } from "@/lib/touch-target";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function AppearanceSection() {
  const { theme, setTheme, mounted } = useAppearance();

  return (
    <div>
      <div
        role="group"
        aria-label="Theme"
        className="inline-flex gap-1 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-1"
      >
        {OPTIONS.map((o) => {
          const active = mounted && theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(o.value)}
              className={cn(
                // 36px of visual, 44px of target. FIXED AT THE CALL SITE, not in
                // a primitive: these three are a segmented pill group whose
                // 36px height is the group's own visual language (they sit
                // inside a `p-1` track, so growing the ink would grow the track
                // and change the control's proportions). The `::after` leaves
                // the track alone. Vertical-only extension, so the three
                // targets cannot overlap each other horizontally.
                touchTarget(36),
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
                active
                  ? "bg-foreground text-background"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <o.icon className="size-4" aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
      <p
        className="mt-3 text-[var(--text-muted)]"
        style={{ font: "var(--type-helper)" }}
      >
        System follows your device&apos;s light or dark setting.
      </p>
    </div>
  );
}
