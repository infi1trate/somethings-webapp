"use client";

// SegmentedControl (Bloom) — an inset track with a single raised "thumb" that
// slides under the selected segment. Originally added for gaps.md #78; extended
// here into the shared Bloom component: measured content-width segments, both
// ARIA patterns, full state set, and reduced-motion support.
//
// WHY IT EXISTS ALONGSIDE THE UNDERLINE TAB BAR: underline tabs are the GLOBAL
// scope (a page's sections, components/settings/tab-bar.tsx). A segmented control
// is the LOCAL scope — a contained switch inside one card. Using the underline
// treatment at both scopes flattens the hierarchy: two identical tab rows on one
// screen read as peers when one is subordinate to the other.
//
// SEMANTICS ARE A CHOICE, not a default:
//   "tabs"  — segments switch visible content PANELS. Full WAI-ARIA tabs
//             pattern: tablist/tab/aria-selected/aria-controls + roving
//             tabindex, and the caller marks its panel role="tabpanel".
//   "group" — segments set a MODE (the control's own output changes, no separate
//             panel). role="group" + aria-pressed. Calling a mode toggle a
//             tablist would promise panels a screen reader can't find.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { touchTarget } from "@/lib/touch-target";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** id of the element this segment reveals. Required for semantics="tabs" so
   *  aria-controls points somewhere real. */
  controls?: string;
  disabled?: boolean;
}

/** SSR-safe layout effect: measuring needs the DOM, and React warns when
 *  useLayoutEffect runs during server render. Falls back to useEffect there. */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// GEOMETRY. `seg` is the SEGMENT height; the track adds its 2px inset on each
// side, so track = seg + 4 and the thumb matches the segment.
//   md → 32px segment ⇒ 36px track, 32px thumb  (the Bloom spec)
//   sm → 28px segment ⇒ 32px track, 28px thumb  (the two pre-existing consumers)
// Radius: both are fully rounded, which satisfies "container = thumb + inset" by
// construction — for a pill, radius is half the height: 32/2 + 2 = 36/2 = 18px.
// `hit` extends each segment's touch target to 44px without moving the visual.
// FROM THE SHARED HELPER now, not spelled out here — 28px and 32px segments, and
// the helper carries the arithmetic that reaches 44 from each.
const SIZES = {
  sm: { seg: "h-7", text: "text-[11px]", pad: "px-3", hit: touchTarget(28) },
  md: { seg: "h-8", text: "text-[14px]", pad: "px-4", hit: touchTarget(32) },
} as const;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  semantics = "group",
  fullWidth = false,
  disabled = false,
  ariaLabel,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: keyof typeof SIZES;
  semantics?: "tabs" | "group";
  /** Stretch to the container instead of hugging the segments. */
  fullWidth?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const s = SIZES[size];
  const isTabs = semantics === "tabs";
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  // Segments are content-width, so the thumb can't be derived from a fraction
  // of the track — it's measured off the selected segment.
  const trackRef = useRef<HTMLDivElement>(null);
  const segRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(
    null
  );

  const measure = useCallback(() => {
    const el = segRefs.current[activeIndex];
    const track = trackRef.current;
    if (!el || !track) return;
    setThumb({
      left: el.offsetLeft - track.clientLeft,
      width: el.offsetWidth,
    });
  }, [activeIndex]);

  // Before paint, so the thumb never lands at 0,0 for a frame.
  useIsoLayoutEffect(measure, [measure, options.length]);

  // Labels carry live counts, so a segment can change width without the
  // selection changing.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    segRefs.current.forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [measure, options.length]);

  /** Roving tabindex: only the selected segment is in the Tab order, so Tab
   *  moves OUT of the control; ←/→/Home/End move selection AND focus. */
  const step = (index: number) => {
    const next = (index + options.length) % options.length;
    const o = options[next];
    if (o.disabled) return;
    segRefs.current[next]?.focus();
    onChange(o.value);
  };

  return (
    <div
      ref={trackRef}
      role={isTabs ? "tablist" : "group"}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        // No overflow clip — a focus ring with outline-offset must not be cut
        // off by the track.
        "relative isolate rounded-full bg-[var(--surface-s1)] p-0.5",
        fullWidth ? "flex w-full" : "inline-flex",
        disabled && "opacity-50",
        className
      )}
    >
      {/* The raised thumb: card surface on the recessed track. */}
      {thumb && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0.5 -z-10 rounded-full bg-[var(--surface-card)]",
            // shadow-tile is Bloom's raised-on-recessed treatment, but white on
            // --surface-s1 measures 1.10:1 — the shadow alone leaves the edge
            // implied. --border-contour reinforces it (box-sizing: border-box,
            // so the 32px thumb height is unchanged).
            "border border-[color:var(--border-contour)] shadow-[var(--shadow-tile)]",
            "transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
          )}
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
        />
      )}
      {options.map((o, i) => {
        const active = o.value === value;
        const off = disabled || o.disabled;
        return (
          <button
            key={o.value}
            ref={(el) => {
              segRefs.current[i] = el;
            }}
            type="button"
            role={isTabs ? "tab" : undefined}
            aria-selected={isTabs ? active : undefined}
            aria-pressed={isTabs ? undefined : active}
            // Only the SELECTED tab points at a panel: callers render one panel
            // at a time, so aria-controls on an unselected tab would be a
            // dangling reference to an element that isn't in the DOM.
            aria-controls={isTabs && active ? o.controls : undefined}
            tabIndex={isTabs && !active ? -1 : 0}
            disabled={off}
            onClick={() => !off && onChange(o.value)}
            onKeyDown={(e) => {
              if (!isTabs) return;
              if (e.key === "ArrowRight") {
                e.preventDefault();
                step(i + 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                step(i - 1);
              } else if (e.key === "Home") {
                e.preventDefault();
                step(0);
              } else if (e.key === "End") {
                e.preventDefault();
                step(options.length - 1);
              }
            }}
            className={cn(
              // ::after lifts the hit area to 44px without changing the
              // 32px visual (WCAG 2.5.8) — see `hit` in SIZES.
              "relative flex items-center justify-center whitespace-nowrap rounded-full",
              "tabular-nums leading-none transition-colors duration-200 motion-reduce:transition-none",
              "after:absolute after:inset-x-0 after:content-['']",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
              s.seg,
              s.text,
              s.pad,
              s.hit,
              fullWidth && "flex-1",
              off && "cursor-not-allowed",
              active
                ? "font-medium text-[var(--text-primary)]"
                : // Hover applies to UNSELECTED segments only — a tint under the
                  // thumb would read as a second, ghosted thumb.
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:text-[var(--text-primary)]"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
