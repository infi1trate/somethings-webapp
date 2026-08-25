"use client";

// TASK CARD + LABEL BAND — this page's attention signature, and the single
// pattern all three task types now use.
//
// WHAT IT REPLACES. The flag card was a whole-card tint plus a 3px left-edge
// accent bar; the review card was an untinted card with a coloured eyebrow line.
// Two different anatomies for two things a supervisor works the same way, and
// the flag card broke rule 3 twice over. Now: one card, one band, and the band
// is the only thing that changes temperature.
//
// WHY A BAND RATHER THAN A TINTED CARD. A whole-card tint colours the CONTENT —
// the concern, the categories, the evidence — which makes a reader read the
// facts through the severity. The band colours only the card's own label, so the
// severity is stated once, at the top, and the body stays neutral and readable.
// It also means one card can never be "half urgent": the tint has a hairline to
// stop at.
//
// ACTION PLACEMENT IS IDENTICAL ACROSS ALL THREE TYPES — top right of the band,
// always. That is the point of a shared band: a supervisor working a stack of
// mixed tasks reaches to the same place every time, whether they are approving a
// presentation or reviewing an escalation.
//
// FORBIDDEN HERE AND ANYWHERE: left-edge bars, whole-card tints, shadows, icons
// larger than 16px in the band. The severity marker is an 8px filled dot, which
// sidesteps the icon-size question entirely and is calmer at a glance.
//
// COLOUR NEVER CARRIES SEVERITY ALONE. Every tone pairs with a type label in
// words ("Escalation", "Risk flag", "Review due") and, where it applies, a
// status word ("Open", "Crisis"). A monochrome print or a screen reader gets the
// same information.

import type React from "react";
import { cn } from "@/lib/utils";

export type TaskTone = "routine" | "warning" | "critical";

/** The band's fill and ink per tone.
 *
 *  TINT VIA color-mix, NOT A HARDCODED ALPHA. The brief asked for 6–8% alpha;
 *  writing `rgb(... / 7%)` would need a literal colour, and the alert families
 *  invert in dark mode (`--alert-warning-accent` is #96590a light, #ffe94b
 *  dark). Mixing 7% of the mode's own accent into the mode's own card surface
 *  gives the same visual weight in both without a second set of tokens.
 *
 *  ROUTINE HAS NO FILL AT ALL — a scheduled review is ordinary work, and this is
 *  the rule the previous action slot broke by tinting it warm. */
const TONE: Record<
  TaskTone,
  { band: string; ink: string; dot: string }
> = {
  routine: {
    band: "transparent",
    ink: "var(--alert-warm-fg)",
    dot: "var(--alert-warm-accent)",
  },
  warning: {
    band:
      "color-mix(in oklab, var(--alert-warning-accent) 7%, var(--surface-card))",
    ink: "var(--alert-warning-fg)",
    dot: "var(--alert-warning-accent)",
  },
  critical: {
    band:
      "color-mix(in oklab, var(--alert-critical-accent) 7%, var(--surface-card))",
    ink: "var(--alert-critical-fg)",
    dot: "var(--alert-critical-accent)",
  },
};

const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

export function TaskCard({
  tone,
  /** The type label — "Escalation", "Risk flag", "Review due". In words, always. */
  type,
  /** Status or stage, muted, beside the type: "Open", "90-day review", "Crisis". */
  meta,
  /** Top right of the band. The primary action, plus an overflow when there are
   *  secondary ones. Omitted entirely below supervisor tier — never disabled. */
  actions,
  /** Sits under the actions INSIDE the band, so a requirement is read before the
   *  reach rather than found after the click. */
  actionHelp,
  /** The provenance line, below the body. */
  footer,
  ariaLabel,
  section,
  children,
}: {
  tone: TaskTone;
  type: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  actionHelp?: React.ReactNode;
  footer?: React.ReactNode;
  ariaLabel: string;
  section: string;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <section
      aria-label={ariaLabel}
      data-record-section={section}
      data-task-tone={tone}
      // ONE card. Contour hairline, no shadow, no border accent, no nesting.
      className="overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
    >
      {/* ── LABEL BAND. Full inner width, closed by a hairline. Rounded top
          corners come from the card's own overflow-hidden, so the tint stops
          exactly where the hairline is. ─────────────────────────────────── */}
      <div
        className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-[color:var(--border-subtle)] px-[var(--surface-pad-x)] py-3.5"
        style={{ backgroundColor: t.band }}
      >
        <p
          className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium"
          style={{ ...LABEL_STYLE, color: t.ink }}
        >
          {/* An 8px filled dot — a marker, not an icon, and well under the
              16px ceiling. Decorative: the words carry the severity. */}
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: t.dot }}
          />
          <span className="text-[13px] leading-[18px]">{type}</span>
          {meta && (
            <>
              <span aria-hidden className="opacity-40">
                ·
              </span>
              <span className="text-[13px] leading-[18px] text-[var(--text-muted)]">
                {meta}
              </span>
            </>
          )}
        </p>

        {actions && (
          <span className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="flex items-center gap-2">{actions}</span>
            {actionHelp && (
              <span className="text-right text-[12.5px] leading-[17px] text-[var(--text-muted)]">
                {actionHelp}
              </span>
            )}
          </span>
        )}
      </div>

      {/* ── BODY. Sectioned by hairlines and spacing only. ───────────────── */}
      <div className="px-[var(--surface-pad-x)] py-4">{children}</div>

      {/* ── FOOTER. Provenance, always. ──────────────────────────────────── */}
      {footer && (
        <div className="border-t border-[color:var(--border-subtle)] px-[var(--surface-pad-x)] py-3">
          <p
            className="text-[var(--text-muted)]"
            style={{ font: "var(--type-helper)" }}
          >
            {footer}
          </p>
        </div>
      )}
    </section>
  );
}

/** The hairline that sections a task body, matching the review card's rhythm. */
export const TASK_SECTION =
  "mt-4 border-t border-[var(--border-subtle)] pt-4";

export { LABEL_STYLE as TASK_LABEL_STYLE };

/** A category chip. Raw values NEVER reach here — callers pass through
 *  `categoryLabel`, which turns anything unknown into "Uncategorised". */
export function CategoryChip({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-0.5",
        "bg-[var(--surface-s1)] text-[13px] leading-[18px] text-[var(--text-primary)]",
        "ring-1 ring-inset ring-[color:var(--border-subtle)]"
      )}
    >
      {label}
    </span>
  );
}
