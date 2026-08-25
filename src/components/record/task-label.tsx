"use client";

// TASK LABEL — the CANONICAL label for a task, wherever a task is shown.
//
// ONE COMPONENT, BY DESIGN, and today it has one consumer because the global
// Tasks page does not exist yet: `/app/tasks` falls through the unbuilt-section
// placeholder, and no task-row or label component exists anywhere else in the
// codebase (audited). It is built standalone and page-agnostic so Tasks adopts it
// unchanged rather than growing a second label that drifts.
//
// ANATOMY — a CONTAINED CHIP, then a qualifier OUTSIDE it:
//
//     ● Review due  ·  90-day review
//     └─ chip ────┘     └─ qualifier ┘
//
// The chip is the label; the qualifier is context. They are deliberately NOT one
// pill: merged, "Escalation · Open" reads as a single compound status, and a
// reader scanning a stack cannot pick out the type without also parsing the
// state. Separated, the eye lands on the chip and the qualifier answers a second
// question.
//
// SEVERITY LIVES HERE AND NOWHERE ELSE. Not on the card, not on a border, not on
// a button. The chip carries a tonal background and a 6px dot; the band behind it
// carries a matching wash. Colour never travels further than these two.
//
// COLOUR IS NEVER ALONE. Every family pairs with the type name in words, so a
// monochrome print and a screen reader get the same information.



export type TaskSeverity = "routine" | "warning" | "critical";

/** Chip fill + ink per family.
 *
 *  The chip sits ON the band, which is itself a wash of the same family, so the
 *  chip has to be a step stronger than the band or it disappears into it. These
 *  are the `--alert-*-bg` tokens — a real tint rather than a mix — with the
 *  family's `-fg` for text. Both invert correctly in dark mode, which a
 *  hardcoded alpha would not. */
const CHIP: Record<TaskSeverity, { bg: string; fg: string; dot: string }> = {
  // Routine is NEUTRAL, not warm. A scheduled review is ordinary work; giving it
  // the warm family was the thing that made routine work look urgent.
  routine: {
    bg: "var(--surface-s1)",
    fg: "var(--text-secondary)",
    dot: "var(--text-muted)",
  },
  warning: {
    bg: "var(--alert-warning-bg)",
    fg: "var(--alert-warning-fg)",
    dot: "var(--alert-warning-accent)",
  },
  critical: {
    bg: "var(--alert-critical-bg)",
    fg: "var(--alert-critical-fg)",
    dot: "var(--alert-critical-accent)",
  },
};

/** The band's wash per family — a step LIGHTER than the chip, so the chip reads
 *  as sitting on it.
 *
 *  RAISED FROM WHAT WAS THERE. Measured before this pass: routine 0% (no fill at
 *  all), warning 6.7%, critical 6.3% — all effectively invisible, which is what
 *  the brief reported. Now mixed from each family's accent into the card surface
 *  at the brief's targets: routine 5.5%, warning and critical 10%. Mixed rather
 *  than hardcoded because the alert families invert in dark mode. */
const BAND: Record<TaskSeverity, string> = {
  routine:
    "color-mix(in oklab, var(--text-primary) 5.5%, var(--surface-card))",
  warning:
    "color-mix(in oklab, var(--alert-warning-accent) 10%, var(--surface-card))",
  critical:
    "color-mix(in oklab, var(--alert-critical-accent) 10%, var(--surface-card))",
};

export function taskBandFill(severity: TaskSeverity): string {
  return BAND[severity];
}

export function TaskLabel({
  severity,
  /** The type name, in the chip: "Review due", "Escalation", "Risk flag". */
  type,
  /** Context, outside the chip after a middot: "Intake", "90-day review",
   *  "Open", "Resolved · 48h". */
  qualifier,
}: {
  severity: TaskSeverity;
  type: string;
  qualifier?: string;
}) {
  const c = CHIP[severity];
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
        style={{ backgroundColor: c.bg, color: c.fg }}
      >
        {/* 6px dot. Decorative — the type name beside it carries the meaning. */}
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: c.dot }}
        />
        <span className="text-[12.5px] font-medium leading-[16px]">{type}</span>
      </span>
      {qualifier && (
        <span className="flex items-center gap-2 text-[12.5px] leading-[16px] text-[var(--text-muted)]">
          <span aria-hidden className="opacity-50">
            ·
          </span>
          {qualifier}
        </span>
      )}
    </span>
  );
}

/** THE BAND. Fixed height across every task type so a stack reads as one system
 *  — the previous version let the routine band grow to 88px against the flags'
 *  65px because it carried helper text, and the labels sat 10–21px above centre
 *  because the row used `items-start`. Both are gone: no helper text lives here
 *  any more (the note gate moved to the field, Phase 3), and everything is
 *  centred on one axis.
 *
 *  Rounded top corners come from the card's own `overflow-hidden`, so the wash
 *  terminates exactly at the closing hairline. */
export function TaskBand({
  severity,
  children,
  actions,
}: {
  severity: TaskSeverity;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-14 items-center justify-between gap-x-4 gap-y-2 border-b border-[color:var(--border-subtle)] px-[var(--surface-pad-x)] py-2"
      style={{ backgroundColor: taskBandFill(severity) }}
    >
      {children}
      {actions && (
        <span className="flex shrink-0 items-center gap-2">{actions}</span>
      )}
    </div>
  );
}
