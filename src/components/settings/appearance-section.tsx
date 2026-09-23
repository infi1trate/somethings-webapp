"use client";

// ═══════════════════════════════════════════════════════════════════════════
// APPEARANCE — THE CONTROL IS GONE, THE SECTION IS NOT
//
// This was a canonical Light / Dark / System segmented control, and it worked.
// Light is forced now; `lib/use-appearance.ts` carries the reasoning, which in
// one line is that a `"system"` default shipped an inverted, never-audited
// clinical surface to every supervisor on a dark OS.
//
// ═══ WHY THE SECTION SURVIVES THE CONTROL ═══
//
// Two ways to remove a control: take the tab with it, or leave the tab and say
// what happened. Deleting the tab is the silent version — somebody who has used
// the toggle goes looking for it, finds the section missing, and learns nothing.
// A sentence is not a control, and it is where they will look.
//
// IT IS NOT AN EMPTY STATE EITHER. "Being set up" and "Coming soon" both promise
// a thing that is arriving. This is a decision that has been made, so it reads
// as one.
// ═══════════════════════════════════════════════════════════════════════════

import { Sun } from "lucide-react";

export function AppearanceSection() {
  return (
    <div className="max-w-prose">
      <p
        className="flex items-center gap-2 text-[var(--text-primary)]"
        style={{ font: "var(--type-row-value)" }}
      >
        <Sun className="size-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
        {/* NEEDS-COPY-NICOLE */}
        Light is the only theme.
      </p>
      <p
        className="mt-1.5 text-[var(--text-secondary)]"
        style={{ font: "var(--type-row-label)" }}
      >
        {/* NEEDS-COPY-NICOLE. It says WHY rather than only what, because the
            reader of this sentence is somebody who wanted the dark theme and
            "not available" alone reads as an oversight. */}
        The supervisor surfaces are contrast-tested in light only, and a theme
        nobody has audited is not one to hand out by default.
      </p>
    </div>
  );
}
