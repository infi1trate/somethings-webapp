"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ONE BUTTON, ONE AXIS (Refinement §4, §5)
//
// ═══ WHAT THE POPOVER LOST ═══
//
// It held two radiogroups: density and layout. §4 removed the layout axis (the
// pane is the point of the workflow on both surfaces) and forbade replacing it
// with a Card/List axis, because that axis and density would overlap — a
// four-cell matrix with duplicate cells. So this is one radiogroup of three
// ordered steps, and `Axis` is gone with the second axis rather than kept for a
// caller that no longer exists.
//
// ═══ AND WHERE IT MOVED (§5) ═══
//
// MEASURED before: the trigger sat at x=1374 while the list column it governs
// ended at x=842 — 532px away, in the gap between the list and the metric
// cluster, belonging to neither. It lives in the list column's own toolbar now.
// The reasoning is the same one that puts the metric cluster with the header:
// a control sits with the thing it acts on.
//
// ═══ WHY THE ROWS CARRY A SHAPE PREVIEW ═══
//
// Three spacing presets are the hardest kind of choice to name: "Cards",
// "Comfortable" and "Compact" describe a feeling rather than an outcome, and a
// reader has to pick before they can see. Each row draws its own geometry at
// miniature — detached versus grouped, and the relative row height — so the
// control shows what it does. `aria-hidden`, because the label and hint already
// say it in words and a screen-reader user gains nothing from three rectangles.

import { Check, SlidersHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ROW_GEOMETRY,
  VIEW_PRESETS,
  type ViewPreset,
} from "@/lib/ui/view-options";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** NEEDS-COPY-NICOLE on every label and hint. Each hint names the OUTCOME —
 *  what the list will look like — rather than restating the label. */
const PRESET_COPY: Record<ViewPreset, { label: string; hint: string }> = {
  cards: { label: "Cards", hint: "Each review its own panel" },
  comfortable: { label: "Comfortable", hint: "Grouped rows, two clear lines" },
  compact: { label: "Compact", hint: "Tighter rows, more on screen" },
};

/** The miniature. Three bars at the preset's own relative pitch, detached or
 *  grouped as the preset is. Deliberately crude — it is a shape cue beside a
 *  word, not an illustration. */
function Shape({ preset }: { preset: ViewPreset }) {
  const geo = ROW_GEOMETRY[preset];
  // Scale the real pitch into a 28px-tall well so the three previews are
  // comparable to each other rather than each filling the space.
  const h = Math.max(2, Math.round((geo.height / ROW_GEOMETRY.cards.pitch) * 9));
  const gap = Math.round(((geo.pitch - geo.height) / ROW_GEOMETRY.cards.pitch) * 9);
  return (
    <span
      aria-hidden
      className="flex w-6 shrink-0 flex-col justify-center"
      style={{ gap: geo.detached ? Math.max(2, gap) : 0 }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ height: h }}
          className={cn(
            "block w-full bg-[var(--text-secondary)] opacity-45",
            geo.detached
              ? "rounded-[2px]"
              : i > 0 && "border-t border-[color:var(--surface-card)]"
          )}
        />
      ))}
    </span>
  );
}

export function ViewOptionsButton({
  preset,
  onChange,
}: {
  preset: ViewPreset;
  onChange: (next: ViewPreset) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-anno-ref="view-options"
          /* THE CURRENT VALUE IS IN THE NAME. A bare "View" makes a
             screen-reader user open the popover to find out what the list is
             doing, which a sighted reader can see from the rows themselves. */
          aria-label={`View: ${PRESET_COPY[preset].label}`}
          className={cn(
            /* 44px (HIG). The house pattern for these pills is `min-h-9`, which
               clears SC 2.5.8's 24×24 but not HIG's 44×44; matching an existing
               shortfall is not a reason to ship a target under the bar. */
            "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3",
            "text-[13px] leading-[18px] text-[var(--text-secondary)] transition-colors",
            "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          <SlidersHorizontal aria-hidden className="size-3.5" />
          {/* NEEDS-COPY-NICOLE */}
          View
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 gap-1 p-2">
        {/* NEEDS-COPY-NICOLE */}
        <p className="px-1.5 pb-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
          Row size
        </p>
        <div role="radiogroup" aria-label="Row size">
          {VIEW_PRESETS.map((p) => {
            const on = p === preset;
            const copy = PRESET_COPY[p];
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                data-anno-ref={`view-option:${p}`}
                onClick={() => onChange(p)}
                className={cn(
                  "flex w-full min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] px-1.5 text-left transition-colors",
                  on ? "bg-[var(--surface-s2)]" : "hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                {/* THE STATE IS NOT COLOUR (SC 1.4.1): a check glyph when this
                    is the current value, and `aria-checked` regardless. */}
                <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
                  {on && <Check className="size-4 text-[var(--text-primary)]" />}
                </span>
                <Shape preset={p} />
                <span className="min-w-0">
                  <span className="block truncate font-display text-[14px] leading-[20px] text-[var(--text-primary)]">
                    {copy.label}
                  </span>
                  <span className="block truncate text-[12px] leading-[16px] text-[var(--text-secondary)]">
                    {copy.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
