"use client";

// TASK SECTIONS — the two attention regions, and the compact rows that are not
// cards.
//
// EXTRACTED FROM care-task-region.tsx, which had the "Action required" heading
// inline and welded to Care's own task union (`careTasksFor`, the review card, a
// `reviewProps` bag). Overview needs the same heading with a different payload,
// and the audit's conclusion was that copying it would produce two headings that
// drift within a release. So the heading, the count and the reserved slot live
// here and both tabs consume them.
//
// ONE PHRASE, SCOPED PER TAB. "Action required" on Care means "things to do
// here" — after this pass, only the presentation review. On Overview it means
// the same thing about the whole record. Deliberately not disambiguated into
// "Care actions" / "Record actions": a reader who has learned the phrase once
// should not have to learn a dialect of it per tab.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY A ROLL-UP ROW IS NOT A SMALL CARD.
//
// A supervisor scanning this page has to know, without thinking, where the work
// happens. A full card IS the work: it carries the concern, the evidence and the
// buttons that resolve it. A roll-up row is a POINTER to work that lives on
// another tab — it must never look like a card with its buttons missing, because
// that reads as a broken card.
//
// So they differ on every axis at once, not by one degree of emphasis:
//
//   full card   own bordered surface · tinted label band · body · provenance
//               footer · live action buttons in the band
//   roll-up row no surface of its own (rows share ONE container) · no band fill
//               · one line · no live action, only a route affordance
//
// The rows share a single container rather than each getting a border, which is
// also what keeps rule 3 satisfied: a row is not a card, so a container of rows
// is not a card containing cards.
// ─────────────────────────────────────────────────────────────────────────────

import { ChevronRight } from "lucide-react";
import { TaskLabel, type TaskSeverity } from "@/components/record/task-label";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";

/** The container the compact rows sit in. Same contour and radius as a card,
 *  because it IS one surface — what makes it not-a-card is that its contents are
 *  rows, with no band, no footer and no live actions. */
const ROW_GROUP =
  "overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]";

// ── Action required ─────────────────────────────────────────────────────────

/** ACTION-SIGNAL ITEMS ONLY, so the count means something. An attention item in
 *  here would inflate a number a supervisor triages by. */
export function ActionRequiredSection({
  count,
  headingRef,
  children,
}: {
  count: number;
  /** WHERE FOCUS LANDS AFTER A TASK IS CLOSED. Closing a task unmounts the card
   *  its trigger lived in, so the browser drops focus to <body> and a keyboard
   *  reader is silently teleported to the top of the page. The heading is given a
   *  ref and `tabIndex={-1}` so the closer can hand focus here instead — it is
   *  the nearest thing that still exists and it says what just changed. */
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  children: React.ReactNode;
}) {
  // NOTHING OPEN RENDERS NOTHING — heading included. A section header over an
  // empty stack is the "all caught up" card by another name, and absence is the
  // reward state.
  if (count === 0) return null;

  return (
    <section aria-label="Action required" data-record-section="action-required">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        {/* TODO-COPY. The count is part of the heading because "three things
            need you" is the first thing worth knowing. */}
        <h2 ref={headingRef} tabIndex={-1} className={H2}>{`Action required · ${count}`}</h2>
        {/* RESERVED SLOT — "View all in Tasks". Deliberately EMPTY and wired to
            nothing: the Tasks page does not exist (its route falls through the
            unbuilt-section placeholder), and a link to a placeholder reads as a
            broken promise. The slot exists so adding the link later is one line
            and does not re-flow the header. */}
        <span data-slot="view-all-in-tasks" />
      </div>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

// ── Worth a look ────────────────────────────────────────────────────────────

/** ATTENTION-SIGNAL ITEMS. Structurally lighter than Action required at every
 *  level — compact rows in one container, no band tint anywhere, no filled
 *  button, one quiet route affordance each.
 *
 *  IT MUST NOT COMPETE. The heading is the same size as Action required's on
 *  purpose (two heading scales in one column is noise), and everything below it
 *  is different: rows not cards, no colour, no button. The hierarchy comes from
 *  the content's weight, not from shrinking the label. */
export function WorthALookSection({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section aria-label="Worth a look" data-record-section="worth-a-look">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        {/* TODO-COPY */}
        <h2 className={H2}>{`Worth a look · ${count}`}</h2>
        <span />
      </div>
      <div className={cn("mt-3", ROW_GROUP)}>{children}</div>
    </section>
  );
}

// ── The rows ────────────────────────────────────────────────────────────────

/** The shared row shell: fixed minimum height, hairline above every row but the
 *  first, one grid so the route affordance lines up down the column. */
function Row({
  children,
  route,
}: {
  children: React.ReactNode;
  route?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1.5",
        "px-[var(--surface-pad-x)] py-3",
        // BETWEEN rows only — no top rule on the first, no bottom on the last.
        "border-t border-[color:var(--border-subtle)] first:border-t-0"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        {children}
      </div>
      {route && <div className="shrink-0">{route}</div>}
    </div>
  );
}

/** The QUIET ROUTE AFFORDANCE. A text button with a chevron — never filled,
 *  never tinted. It is the only interactive thing in a row, so it does not have
 *  to shout to be found. */
export function RouteAffordance({
  label,
  onClick,
}: {
  /** TODO-COPY at every call site — the destination, e.g. "Care". */
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mr-2 inline-flex min-h-9 items-center gap-1 rounded-full px-2",
        "text-[13px] font-semibold text-[var(--text-secondary)]",
        "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
        RING
      )}
    >
      {label}
      <ChevronRight className="size-3.5 shrink-0" aria-hidden />
    </button>
  );
}

/** A COMPACT ROLL-UP ROW — an Action item whose full card lives on another tab.
 *
 *  It carries the canonical label chip, so the alert wears the same identity here
 *  as it does at home, and then ONE line of description. No live action controls:
 *  the whole point is that a supervisor is never in doubt about where to act. */
export function RollupRow({
  severity,
  label,
  qualifier,
  description,
  routeLabel,
  onRoute,
}: {
  severity: TaskSeverity;
  label: string;
  qualifier?: string;
  description: string;
  routeLabel: string;
  onRoute: () => void;
}) {
  return (
    <Row route={<RouteAffordance label={routeLabel} onClick={onRoute} />}>
      {/* THE CANONICAL CHIP, unchanged from the card. The BAND is what a roll-up
          drops — the chip is the alert's identity and travels with it. */}
      <TaskLabel severity={severity} type={label} qualifier={qualifier} />
      <p className="min-w-0 text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {description}
      </p>
    </Row>
  );
}

/** A WORTH-A-LOOK ROW. No label chip at all — an attention item has no severity
 *  to state, and a chip would borrow the vocabulary of the section above it.
 *  Statement first, muted detail after. */
export function AttentionRow({
  statement,
  detail,
  routeLabel,
  onRoute,
}: {
  statement: string;
  detail?: string;
  /** BOTH OMITTED = NO AFFORDANCE. Some attention items are facts with no
   *  destination ("finished an activity"), and a row that links to the tab the
   *  reader is already on reads as broken rather than as absent. */
  routeLabel?: string;
  onRoute?: () => void;
}) {
  return (
    <Row
      route={
        routeLabel && onRoute ? (
          <RouteAffordance label={routeLabel} onClick={onRoute} />
        ) : undefined
      }
    >
      <p className="min-w-0 text-[15px] leading-[22px] text-[var(--text-primary)]">
        {statement}
      </p>
      {detail && (
        <p
          className="min-w-0 text-[var(--text-muted)]"
          style={{ font: "var(--type-helper)" }}
        >
          {detail}
        </p>
      )}
    </Row>
  );
}
