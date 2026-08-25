"use client";

// TONAL CHIP — the record's one small-label surface, and the parent of every
// chip on the Care page: score bands, presentation codes, review countdowns.
//
// WHY ONE PRIMITIVE. Before this there was `ScoreChip` (neutral, hand-rolled),
// History rendering its own scores as plain prose, and `ui/badge.tsx` sitting
// unused on a different token system (shadcn `--background`/`--foreground`
// rather than the record's Bloom surfaces). Three idioms for one shape. Chips
// now come from here, and `ScoreChip` is a thin wrapper over it.
//
// A CHIP IS NOT A CARD. Rule 3 bans full-card tinted fills and left-edge accent
// bars; a chip is a label-sized surface and tinting one is how a tonal chip
// works at all. What it must NOT do is carry severity by colour alone — every
// tone below pairs with words that say the same thing.
//
// TONES ARE DELIBERATELY FEW. `neutral` for identifiers and ordinary values;
// `warning` for a countdown that has entered its window or passed it. There is
// no `critical` tone here on purpose: nothing on the Care page except an open
// escalation is critical, and that is a task-region concern.
//
// SEVERITY BANDS STAY NEUTRAL FOR NOW. The obvious next step is colouring a
// score chip by its band, and it is deliberately NOT taken: rule 3 says
// severity is expressed only through the label-band pattern defined in Prompt B,
// which is not yet specified. The band NAME carries the severity in the
// meantime, which is also the only version a screen reader or a monochrome print
// can use. Reported.

import { cn } from "@/lib/utils";

export type ChipTone = "neutral" | "warning";

// A HAIRLINE, NOT A HEAVIER FILL. Measured, `--surface-s1` sits at 1.10:1
// against `--surface-card` — a tonal chip whose fill you cannot see reads as
// plain text with odd padding, which is exactly what these chips replaced. The
// fix is an EDGE rather than a stronger tint: going to `--status-neutral-bg`
// (#dcdcdc, ~1.42:1) would have worked but drops a cold grey onto a warm canvas,
// and the house idiom is structure from hairlines and tone. The warning tone
// keeps its tint unbordered — it has a visible fill already and an edge on top
// would read as a second severity signal.
const TONE: Record<ChipTone, string> = {
  neutral:
    "bg-[var(--surface-s1)] text-[var(--text-primary)] ring-1 ring-inset ring-[color:var(--border-subtle)]",
  warning: "bg-[var(--status-warn-bg)] text-[var(--status-warn-fg)]",
};

export function TonalChip({
  tone = "neutral",
  mono = false,
  className,
  children,
}: {
  tone?: ChipTone;
  /** Tabular figures. On for anything whose digits a reader compares down a
   *  column — scores, codes. */
  mono?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5",
        "text-[13px] leading-[18px]",
        mono && "tabular-nums",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
