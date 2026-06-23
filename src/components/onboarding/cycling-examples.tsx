"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CyclingExamplesProps {
  items: string[];
  label?: string;
  intervalMs?: number;
}

// A compact card that rotates through example strings one at a time, so the
// suggested scripts don't take up a long static list. Auto-advances gently,
// pauses on hover/focus, and lets people tap a dot to browse. Honors
// prefers-reduced-motion (no auto-advance; dots still work).
export function CyclingExamples({
  items,
  label = "Something to go off",
  intervalMs = 6500,
}: CyclingExamplesProps) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (paused || reduced || items.length < 2) return;
    const id = setInterval(
      () => setI((n) => (n + 1) % items.length),
      intervalMs
    );
    return () => clearInterval(id);
  }, [paused, reduced, items.length, intervalMs]);

  if (items.length === 0) return null;
  const current = items[Math.min(i, items.length - 1)];

  return (
    <div
      className="rounded-xl border bg-muted/40 px-3.5 py-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-brand" />
        {label}
      </div>
      <p
        key={i}
        className="min-h-[1.5rem] text-[13.5px] leading-relaxed text-foreground/80 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
      >
        {current}
      </p>
      {items.length > 1 && (
        <div className="mt-2 flex gap-1.5">
          {items.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Example ${n + 1}`}
              aria-current={n === i}
              onClick={() => setI(n)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                n === i ? "w-4 bg-foreground/40" : "w-1.5 bg-foreground/15"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

// useSyncExternalStore avoids the set-state-in-effect lint rule this project
// enforces, and gives a correct SSR snapshot (false).
function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );
}
