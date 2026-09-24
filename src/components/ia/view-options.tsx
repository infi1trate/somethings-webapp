"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ONE BUTTON, TWO AXES (Layout Pass §5)
//
// ═══ WHY IT IS ONE CONTROL AND NOT TWO TOGGLES ═══
//
// §5 is explicit, and the reasoning is worth keeping in place: the header
// already carries a title, a purpose line, two metric figures and a progress
// track. Two more segmented controls up there would be six things competing
// above a list — Hick's Law working against the surface it is meant to help.
// A single trigger costs one click to reach either axis and nothing at all
// when a reader does not want them.
//
// ═══ AND WHY THERE IS NO GRID OPTION ═══
//
// §5 forbids it and states the reason, recorded here so it is not re-proposed:
// a grid implies choosing among items by appearance, and these are records
// opened one at a time and judged from a transcript. Twelve cards is twelve
// things a supervisor cannot decide anything from.
//
// ═══ WHAT `Full width` DOES WITH A SELECTION ═══
//
// It drops back to `Split` with that row selected, rather than routing to a
// detail view. Stated here because §5 asked for the reasoning before it ships:
//
//  · THERE IS NO DETAIL ROUTE TO SEND ANYONE TO. Both panes are components
//    inside their page, reading page state — `event-pane.tsx` takes the
//    selected group, the flag within it, and the disposition commit handle.
//    Routing would mean inventing a URL, a fetch path and a back affordance for
//    a surface whose whole job is a queue you stay inside.
//  · THE MODE IS FOR SCANNING, AND SELECTING IS THE END OF SCANNING. §5 names
//    Full width as "for scanning and triage rather than sequential review". The
//    moment a reader picks a row they have stopped scanning, so the mode has
//    done its job and the surface should show them the thing they picked.
//  · IT IS REVERSIBLE AND IT SAYS SO. The drop-back is not sticky: the stored
//    preference stays `full`, the pane is a takeover for this one record, and
//    closing it returns to the full-width list. A preference the product
//    silently rewrites because you used the page is worse than no preference.

import { Check, SlidersHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type Density,
  type LayoutMode,
  type ViewOptions,
} from "@/lib/ui/view-options";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** NEEDS-COPY-NICOLE on every label and every hint. */
const DENSITY_ROWS: { value: Density; label: string; hint: string }[] = [
  { value: "comfortable", label: "Comfortable", hint: "Two clear lines a row" },
  { value: "compact", label: "Compact", hint: "More rows on screen" },
];

const LAYOUT_ROWS: { value: LayoutMode; label: string; hint: string }[] = [
  { value: "split", label: "Split", hint: "List beside the record" },
  { value: "full", label: "Full width", hint: "List only, for scanning" },
];

/** ═══ A RADIO PER AXIS, AND THE STATE IS NOT COLOUR ═══
 *  Each row carries a check glyph when it is the current value, so the setting
 *  is legible without the fill (SC 1.4.1) and to a screen reader through
 *  `aria-checked` rather than through the styling. */
function Axis<T extends string>({
  label,
  rows,
  value,
  onPick,
}: {
  label: string;
  rows: { value: T; label: string; hint: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div>
      <p className="px-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
        {label}
      </p>
      <div role="radiogroup" aria-label={label} className="mt-1">
        {rows.map((r) => {
          const on = r.value === value;
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={on}
              data-anno-ref={`view-option:${r.value}`}
              onClick={() => onPick(r.value)}
              /* 44px MINIMUM (HIG) — this is a pointer target in a popover, not
                 a row in a dense list, so there is no reason to spend less. */
              className={cn(
                "flex w-full min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-1.5 text-left transition-colors",
                on
                  ? "bg-[var(--surface-s2)]"
                  : "hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
                {on && <Check className="size-4 text-[var(--text-primary)]" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-[14px] leading-[20px] text-[var(--text-primary)]">
                  {r.label}
                </span>
                <span className="block truncate text-[12px] leading-[16px] text-[var(--text-secondary)]">
                  {r.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ViewOptionsButton({
  options,
  onChange,
}: {
  options: ViewOptions;
  onChange: (next: Partial<ViewOptions>) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-anno-ref="view-options"
          /* THE CURRENT VALUES ARE IN THE NAME. A bare "View options" makes a
             screen-reader user open the popover to find out what the list is
             doing, which a sighted reader can see from the rows themselves. */
          aria-label={`View options: ${options.density}, ${options.layout}`}
          className={cn(
            /* ═══ 44px, NOT THE HOUSE min-h-9 ═══
               MEASURED at 75×36 on the first build. 36 clears SC 2.5.8's 24×24
               but not Apple HIG's 44×44, and this codebase's other pill
               buttons are `min-h-9` — so the choice was consistency with an
               existing shortfall against the standard. The standard wins for a
               control being added now: matching a pattern is not a reason to
               ship a target under the bar, and nothing above the list is tight
               enough for 8px to cost anything. The existing `min-h-9` buttons
               are a separate finding, not this pass's to change. */
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
      <PopoverContent align="end" className="w-60 gap-3 p-3">
        <Axis
          /* NEEDS-COPY-NICOLE */
          label="Density"
          rows={DENSITY_ROWS}
          value={options.density}
          onPick={(density) => onChange({ density })}
        />
        <Axis
          /* NEEDS-COPY-NICOLE */
          label="Layout"
          rows={LAYOUT_ROWS}
          value={options.layout}
          onPick={(layout) => onChange({ layout })}
        />
      </PopoverContent>
    </Popover>
  );
}
