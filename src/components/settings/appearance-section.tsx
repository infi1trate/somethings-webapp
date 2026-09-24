"use client";

// ═══════════════════════════════════════════════════════════════════════════
// APPEARANCE — THE THEME IS BACK, AND THE CONTROL IS NOT HERE
//
// This was a Light / Dark / System segmented control. It became a sentence
// saying light was the only theme. Both themes are available again
// (addendum §2.5) and this section still holds no control, which is the
// deliberate part: §2.5 asks for ONE toggle, and one toggle means one place.
//
// ═══ WHY THE RAIL AND NOT HERE ═══
//
// The rail is on screen on every route; Settings is four clicks away and a
// place a reader goes on purpose. A preference that is flipped and immediately
// judged — which is what a theme is — belongs where the judging happens.
//
// ═══ AND WHY THE SECTION SURVIVES ANYWAY ═══
//
// Two ways to remove a control: take the tab with it, or leave the tab and say
// where the control went. Deleting it is the silent version — somebody who used
// the toggle goes looking, finds the section missing, and learns nothing. This
// is where they look, so this is where the pointer goes.
//
// SYSTEM IS GONE AND STAYS GONE, and the sentence says so rather than leaving
// its absence to be discovered: a supervisor whose OS flips to dark at sunset
// must not have a clinical surface change underneath them mid-shift.
// ═══════════════════════════════════════════════════════════════════════════

import { PanelLeft } from "lucide-react";

export function AppearanceSection() {
  return (
    <div className="max-w-prose">
      <p
        className="flex items-center gap-2 text-[var(--text-primary)]"
        style={{ font: "var(--type-row-value)" }}
      >
        <PanelLeft
          className="size-4 shrink-0 text-[var(--text-secondary)]"
          aria-hidden
        />
        {/* NEEDS-COPY-NICOLE */}
        The theme toggle is at the bottom of the sidebar.
      </p>
      <p
        className="mt-1.5 text-[var(--text-secondary)]"
        style={{ font: "var(--type-row-label)" }}
      >
        {/* NEEDS-COPY-NICOLE. It states the one real constraint rather than
            only the location, because the missing third option is the thing a
            returning reader will notice. */}
        Light and dark, and your choice is remembered. There is no “match my
        system” option: a clinical surface should not change underneath you
        because the sun went down.
      </p>
    </div>
  );
}
