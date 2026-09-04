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
// THE BAND AND ITS LABEL NOW LIVE IN task-label.tsx, as the canonical pair the
// global Tasks page will consume. This file is the card that hosts them: one
// surface, contour hairline, no shadow, no border accent, no nesting.
//
// FORBIDDEN HERE AND ANYWHERE: left-edge bars, whole-card tints, icons larger
// than 16px in the band. The severity marker is a 6px filled dot inside the
// label chip, which sidesteps the icon-size question entirely.
//
// SHADOWS WERE ON THAT LIST AND ARE NOW AN OPT-IN (`elevated`). The rule was
// written when every task card sat flush in a column; the care tab's review card
// is the one that now carries Elevation/4 from the design file. It is a PROP
// rather than a new default so the flag cards on Overview are untouched — one
// surface asked for it, and a shadow appearing on a surface nobody asked about
// is not a free change.
//
// COLOUR NEVER CARRIES SEVERITY ALONE. Every tone pairs with a type label in
// words ("Escalation", "Risk flag", "Review due") and, where it applies, a
// status word ("Open", "Crisis"). A monochrome print or a screen reader gets the
// same information.

import type React from "react";
import {
  TaskBand,
  TaskLabel,
  type TaskSeverity,
} from "@/components/record/task-label";
import { cn } from "@/lib/utils";

/** Kept as an alias so existing call sites read unchanged; the canonical names
 *  live in task-label.tsx. */
export type TaskTone = TaskSeverity;

export function TaskCard({
  tone,
  /** Elevation/4 plus the filled band chip — the design file's newer card
   *  anatomy, taken as ONE opt-in rather than two. They were drawn together and
   *  a card with the shadow but the outlined chip is a state the file does not
   *  contain. See the note at the top for why it is not the default. */
  elevated = false,
  /** The type label — "Escalation", "Risk flag", "Review due". In words, always. */
  type,
  /** The QUALIFIER, outside the chip: "Open", "90-day review", "Resolved · 48h". */
  meta,
  /** Top right of the band. The primary action, plus an overflow when there are
   *  secondary ones. Omitted entirely below supervisor tier — never disabled. */
  actions,
  /** The provenance line, below the body. */
  footer,
  ariaLabel,
  section,
  children,
}: {
  tone: TaskTone;
  type: string;
  meta?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  ariaLabel: string;
  section: string;
  elevated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={ariaLabel}
      data-record-section={section}
      data-task-tone={tone}
      // ONE card. Contour hairline, no border accent, no nesting.
      className={cn(
        "overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]",
        elevated && "shadow-[var(--shadow-elevation-4)]"
      )}
    >
      {/* ── LABEL BAND — canonical label, fixed height, one centre axis. ── */}
      <TaskBand severity={tone} actions={actions}>
        <TaskLabel
          severity={tone}
          type={type}
          qualifier={meta}
          variant={elevated ? "filled" : "outlined"}
        />
      </TaskBand>

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
