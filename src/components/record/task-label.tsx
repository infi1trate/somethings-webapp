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
// SEVERITY LIVES HERE AND NOWHERE ELSE. Not on the card, not on a button. The
// chip carries the family's ink as its text AND as its outline; the band behind
// it carries a matching wash. Colour never travels further than these two.
//
// COLOUR IS NEVER ALONE. Every family pairs with the type name in words, so a
// monochrome print and a screen reader get the same information.
//
// ═══ R6: THE 6px DOT IS GONE, AND THE CHIP IS OUTLINED ═══
//
// Per the design lead's Figma composition, decided deliberately as a change to
// THIS canonical component rather than as a local divergence in the review card.
// Brandon chose that explicitly ("option 2") after the provenance was reported:
// `TaskLabel` reaches the record's Care tab AND the risk-flag cards on Overview,
// so this is a visual change to Overview too, and that was the accepted cost of
// keeping one label for tasks instead of forking it.
//
// SC 1.4.1 IS UNAFFECTED BY DROPPING THE DOT. The dot was documented here as
// decorative — "the type name carries it" — so the non-colour channel was always
// the words, and it still is. What the dot did carry was a second *visual* cue of
// the family, and the outline now does that job at a larger size than 6px.



export type TaskSeverity = "routine" | "warning" | "critical";

/** THE WARM TRIAD. One scale, three steps — see the token block for the ladder
 *  and its measurements.
 *
 *  THE CHIP IS THE BAND'S OWN INK ON THE CARD SURFACE, not a second tint. The
 *  previous version gave the chip an `--alert-*-bg` fill sitting on a band of the
 *  same family, which is two tints of one hue stacked — the chip either vanished
 *  into the band or fought it. A chip in card tone reads as lifted off the band
 *  at any alpha, and the ink carries the family. */
const FAMILY: Record<TaskSeverity, { band: string; ink: string }> = {
  routine: { band: "var(--band-sand-bg)", ink: "var(--band-sand-fg)" },
  warning: { band: "var(--band-amber-bg)", ink: "var(--band-amber-fg)" },
  critical: { band: "var(--band-clay-bg)", ink: "var(--band-clay-fg)" },
};

export function taskBandFill(severity: TaskSeverity): string {
  return FAMILY[severity].band;
}

export function taskBandInk(severity: TaskSeverity): string {
  return FAMILY[severity].ink;
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
  const ink = taskBandInk(severity);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {/* ═══ THE CARD FILL STAYS UNDER THE OUTLINE, ON PURPOSE ═══
          "Outlined" is the mock's word for the border, not an instruction to go
          transparent. The fill is load-bearing and its removal is a documented
          regression: this chip previously took an `--alert-*-bg` tint, sitting on
          a band of the same family, and "the chip either vanished into the band
          or fought it". A card-surface fill is what makes it read as lifted at
          any band alpha; the ink border is what makes it read as outlined. Both,
          not one. */}
      <span
        className="inline-flex shrink-0 items-center rounded-full border bg-[var(--surface-card)] px-2.5 py-1"
        style={{ color: ink, borderColor: ink }}
      >
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
      // THE HAIRLINE IS THE BAND'S OWN INK AT LOW ALPHA, not --border-subtle.
      // A neutral #dfddd8 hairline against a warm tint reads as a seam of a
      // different colour, and against sand it measured as no line at all. Mixed
      // from the band's ink so it deepens with the band.
      // `flex-wrap` ADDED. Without it the `gap-y-2` here was dead code — a
      // single-line flex row has no second line to space — and the actions
      // cluster below is `shrink-0`, so the only thing that could give at a
      // narrow width was the LABEL side: the chip and its qualifier compressed
      // and truncated while the buttons kept their full width. Wrapping moves
      // the actions to their own line instead, which is the correct thing to
      // give up first, and the `gap-y-2` becomes real.
      className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-[var(--surface-pad-x)] py-2"
      style={{
        backgroundColor: taskBandFill(severity),
        borderBottomColor: `color-mix(in oklab, ${taskBandInk(severity)} 22%, transparent)`,
      }}
    >
      {children}
      {actions && (
        <span className="flex shrink-0 items-center gap-2">{actions}</span>
      )}
    </div>
  );
}
