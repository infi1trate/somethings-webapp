"use client";

// THE RAIL'S LAYOUT SYSTEM — one shell, one section, one row, one gap.
//
// ═══ WHY THIS IS A PRIMITIVE AND NOT FOUR HAND-BUILT PANELS ═══
//
// Four panels live in this rail — Assist, Profile, Toolkit, Timeline — and they
// hold genuinely different content: a suggestion with two buttons, a teen's own
// expressive canvas, a shelf of five activity covers, a chronological log. Built
// separately they would end up with four different paddings, four different
// section rhythms and four different ideas of how a heading relates to what is
// under it, and a reader tabbing between them would feel the surface change
// underneath them each time.
//
// So the vertical rhythm is a shared constant and the section grammar is a shared
// component. A panel cannot invent its own gap because there is nowhere to put
// one. Same discipline as `activity/pane/pane-shell.tsx`, which exists for the
// same reason on the Activity ledger — and the same reason it is written down
// here: the next person to add a fifth panel will not read this file first.
//
// ═══ THE SCROLL IS THE MIDDLE ROW, NOT THE PANEL ═══
//
// `grid-rows-[auto_minmax(0,1fr)_auto]`: a panel gets a fixed head, one scrolling
// body and an optional pinned foot. `minmax(0,…)` is the part that matters — a
// plain `1fr` refuses to shrink below its content, so the panel would grow and
// the RAIL would scroll, carrying the tab bar off the top. That is the same trap
// the Tasks pane and the care-update modal both hit, and it is written down here
// because a panel is exactly the shape that hits it again.

import { cn } from "@/lib/utils";

/** ONE VERTICAL RHYTHM for every panel. Exported so a section cannot pick its
 *  own — the point of a shared constant is that there is no second option. */
export const PANEL_GAP = "space-y-5";

/** The horizontal padding every band in the rail shares, so a panel's heading,
 *  its content and its footer sit on one left edge. */
export const PANEL_PAD = "px-4";

export function PanelShell({
  /** Rendered above the scroll region. Optional: Profile has no header, because
   *  the teen's own canvas IS the top of that panel. */
  header,
  footer,
  children,
  className,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]",
        className
      )}
    >
      {header ? (
        <div className={cn("border-b border-[color:var(--border-subtle)] py-3.5", PANEL_PAD)}>
          {header}
        </div>
      ) : (
        // An empty grid cell, so the three-row template still resolves and the
        // scroll region is still the middle one.
        <div />
      )}

      {/* THE ONE SCROLLING REGION. `overscroll-contain` so reaching the end does
          not hand the gesture to the thread behind it — a mentor reading the
          Timeline must not lose their place in the conversation. */}
      <div className={cn("min-h-0 overflow-y-auto overscroll-contain py-4", PANEL_PAD)}>
        <div className={PANEL_GAP}>{children}</div>
      </div>

      {footer ? (
        <div className={cn("border-t border-[color:var(--border-subtle)] py-3", PANEL_PAD)}>
          {footer}
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}

/** ═══ A SECTION, WITH ITS OWN RULE ═══
 *
 *  `label` omitted → no heading, and the section is just its content. That is the
 *  single-item case: a heading over one card that already has a title line is the
 *  same word twice.
 *
 *  The rule is drawn ABOVE, so the first section never carries one — a rule at the
 *  very top of a scroll region reads as a second header border. */
export function PanelSection({
  label,
  /** Sits opposite the label — a count, a search affordance, an add control. */
  action,
  children,
  divided = false,
  className,
}: {
  label?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  divided?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        divided && "border-t border-[color:var(--border-subtle)] pt-5",
        className
      )}
    >
      {(label || action) && (
        <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
          {/* SENTENCE CASE AND THE TOKEN, not all caps. `--type-field-label` is
              Bloom's Label/Small at the weight that actually renders — see the
              token's own comment, and gap row 354 for the version of this that
              hardcoded a synthesised bold. */}
          {label && (
            <h3
              className="min-w-0 truncate text-[var(--text-muted)]"
              style={{
                font: "var(--type-field-label)",
                letterSpacing: "var(--type-field-label-tracking)",
              }}
            >
              {label}
            </h3>
          )}
          {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A contained block inside a panel. The rail's own card — one step inside the
 *  panel's radius, tinted rather than bordered, so it reads as recessed into the
 *  panel instead of as a second card floating on it. */
export function PanelCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3.5 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

/** A label / value pair. The rail is full of these — age, grade, relationship
 *  length, who raised what — and every one of them is this component, so the
 *  label column cannot drift between panels. */
export function PanelRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p
        className="text-[var(--text-muted)]"
        style={{
          font: "var(--type-field-label)",
          letterSpacing: "var(--type-field-label-tracking)",
        }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 min-w-0 text-[var(--text-primary)]"
        style={{ font: "var(--type-body)" }}
      >
        {children}
      </p>
    </div>
  );
}

/** ═══ AN EMPTY PANEL SAYS WHAT LANDS HERE ═══
 *
 *  Not "Nothing yet". A mentor who opens Timeline on a week-old mentorship and
 *  reads "Nothing yet" has learned nothing about what Timeline is for; one who
 *  reads that activities, notes and escalations will appear here has learned the
 *  whole panel. The empty state is the only guaranteed reading of a panel, so it
 *  is the one place its purpose is certain to be stated.
 *
 *  No illustration and no icon. This is a 320px column beside a conversation —
 *  a graphic here competes with the thread for a reader who is mid-sentence. */
export function PanelEmpty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-1 py-2">
      <p
        className="text-[var(--text-primary)]"
        style={{ font: "var(--type-card-title)" }}
      >
        {title}
      </p>
      {children && (
        <p
          className="mt-1.5 max-w-[34ch] text-[var(--text-secondary)]"
          style={{ font: "var(--type-body)" }}
        >
          {children}
        </p>
      )}
    </div>
  );
}
