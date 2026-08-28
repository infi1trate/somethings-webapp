// INFO CALLOUT — a tonal block that asks the reader to look at something.
//
// ═══ WHY THIS FILE EXISTS ═══
//
// The spec called for "the existing info-callout component". There wasn't one:
// nothing in `ui/` or `record/` rendered a tonal advisory block, and the nearest
// precedents were inline status CHIPS (`user-record-shell.tsx`,
// `relationship-table.tsx`) — a chip labels a thing, it does not carry a
// sentence. Reported at the Phase 0 gate and built here.
//
// ═══ WHAT IT DELIBERATELY IS NOT ═══
//
// NO LEFT-EDGE ACCENT BAR. A house rule, and the reason is that an accent bar is
// a second signal for the thing the tone already says, so it reads as urgency
// rather than as information. Tone alone.
//
// NOT A CARD. No border, no shadow, no elevation — the house rules forbid nested
// cards, and this always renders INSIDE something (a modal, a section). A bordered
// block inside a bordered card is the nesting the rules exist to prevent.
//
// NOT A WHOLE-CARD TINT either, which is the rule this comes closest to. The tint
// is scoped to the callout itself, never to the card that contains it: tinting a
// whole card grades everything on it, which is exactly what the rule prevents.
//
// ═══ TONE, AND WHY THIS ONE ═══
//
// `--status-info-bg` / `--status-info-fg` — the design system's own paired
// couple, measured rather than assumed: 6.19:1 in light, 8.32:1 in dark. Using
// the pair matters more than it looks. Muted ink on a tinted surface is the
// defect that ran through this whole codebase (gap rows 276, 286, 294), and every
// instance came from reaching for a generic text token instead of the fill's own
// foreground.
//
// NOT `--status-attention-*`, which is the amber "something needs you" tone. This
// callout is advisory: it asks a supervisor to read carefully before signing. It
// is not an exception speaking, so it does not get the exception's colour.

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoCallout({
  children,
  className,
  /** Set when the callout names a field, so the field's own label is not
   *  duplicated by an icon nobody needs. */
  hideIcon = false,
}: {
  children: ReactNode;
  className?: string;
  hideIcon?: boolean;
}) {
  return (
    <div
      // `role="note"` rather than `role="status"` or an aria-live region: this
      // text is present from the moment the form opens and never changes, so
      // announcing it as a live update would interrupt a reader for no event.
      // A note is reachable in the reading order, where it belongs.
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-[var(--radius-surface)] bg-[var(--status-info-bg)] px-3 py-2.5",
        "text-[13px] leading-[18px] text-[var(--status-info-fg)]",
        className
      )}
    >
      {!hideIcon && (
        <Info className="mt-px size-4 shrink-0" aria-hidden strokeWidth={2} />
      )}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
