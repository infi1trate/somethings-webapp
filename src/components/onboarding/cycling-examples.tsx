"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { GuidanceCard } from "@/components/onboarding/guidance-card";

interface CyclingExamplesProps {
  items: { text: string; why?: string }[];
  label?: string;
}

// Shows one strong exemplar at a time inside the shared guidance surface.
//
// Two distinct jobs, kept in distinct regions so they don't compete:
//  • "Show another" — an explicit, labeled cycle control (states the action in
//    words; ↺ pattern mirrors the vibe step) lives in the card HEADER.
//  • "Why it works" — a per-example teaching annotation lives in the BODY as a
//    brand-accented note (NOT a pill, so it can't be mistaken for a button).
// Rotating + specific is intentional anti-copy-paste design: these adapt, they
// aren't one canonical answer to paste.
export function CyclingExamples({
  items,
  label = "Examples from other mentors",
}: CyclingExamplesProps) {
  const [i, setI] = useState(0);
  if (items.length === 0) return null;
  const current = items[Math.min(i, items.length - 1)];

  const showAnother =
    items.length > 1 ? (
      <button
        type="button"
        onClick={() => setI((n) => (n + 1) % items.length)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <RefreshCw className="size-3.5" aria-hidden />
        Show another
      </button>
    ) : undefined;

  return (
    <GuidanceCard label={label} action={showAnother}>
      <p
        key={i}
        className="text-[13.5px] leading-relaxed text-foreground/80 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
      >
        {current.text}
      </p>

      {current.why && (
        <p
          key={`why-${i}`}
          className="mt-3 border-l-2 border-brand/40 pl-2.5 text-[12.5px] leading-snug text-foreground/75 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
        >
          <span className="font-semibold text-foreground/85">Why it works: </span>
          {current.why}
        </p>
      )}
    </GuidanceCard>
  );
}
