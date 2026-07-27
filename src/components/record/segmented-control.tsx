"use client";

// SegmentedControl (elevated pass, resolves design-system-gaps.md #78) — a real
// iOS-style segmented control: an inset track with a single sliding "thumb"
// (a raised card pill) that animates under the active segment, instead of the
// four ad-hoc filled-chip toggles that existed before. Two sizes (sm/md).

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  ariaLabel,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  ariaLabel: string;
  className?: string;
}) {
  const count = options.length;
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const sizeCls = size === "md" ? "min-h-9 text-sm" : "min-h-7 text-[11px]";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex rounded-full bg-[var(--surface-s1)] p-0.5",
        className
      )}
    >
      {/* Sliding thumb — a raised card pill under the active segment. Segments
          are equal-width, so the thumb is one segment wide and translates by
          whole segment-widths. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-full bg-[var(--surface-card)] shadow-[var(--shadow-tile)] transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 4px) / ${count})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex-1 whitespace-nowrap rounded-full px-3 font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
              sizeCls,
              active
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
