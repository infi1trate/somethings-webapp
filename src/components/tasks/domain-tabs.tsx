"use client";

// THE FOUR DOMAIN TABS — one compact row, not four cards.
//
// ═══ WHY THE CARDS WENT ═══
//
// They were tabs wearing dashboard clothing: a 22px display numeral, a status
// sentence, an outline-plus-elevation selected state, stacked two-up then
// four-up. That is a summary board, and a summary board at the top of a worklist
// is a thing a supervisor reads before they can start working. The row is the
// same four tabs with the same order, counts and breach treatment, in ~46px of
// height instead of ~110.
//
// WHAT WENT, PRECISELY: the big numeral (the count is still there, at body
// size), the status sentence ("On track" / "Needs attention" / "All clear" — a
// sentence restating a chip and a number), and the outline selected state
// (replaced by a tonal fill, which reads as "you are here" rather than as a
// selected object).
//
// SQUINT TEST, which is the actual acceptance bar: at a glance only two things
// survive — which tab is selected, and any breach chip. Nothing else in the row
// competes.
//
// FIXED ORDER, NEVER REORDERED, NEVER HIDDEN (locked decision 7). Escalations ·
// Risk flags · Billing · Monitoring, straight from TASK_DOMAINS. Breach is
// expressed by TREATMENT, never by position — a breached domain does not jump to
// the front, because a board whose cards move is a board a supervisor has to
// re-read every time they look at it. Zero-count cards render de-emphasized rather
// than disappearing, for the same reason: the shape of the board is a thing you
// learn once.
//
// NO "PRIORITY N" LABELS (§3.3). Order carries rank. A number that restates the
// position is a number that can disagree with it.
//
// ALARM BUDGET (§3.3):
//   · No filled saturated red here — that is the Respond strip and the interrupt
//     banner only. These are pale tint wells with deep same-hue ink.
//   · Breach uses ONE compact chip pattern, shared with the row and the pane
//     header (see BreachChip, which lives in `chips.tsx` for that reason).
//
// REAL TAB SEMANTICS. These are `role="tab"` in a `role="tablist"` with arrow-key
// navigation, one tab stop for the set — the same APG pattern the Activity rail
// uses. They swap a panel in place; they are not links.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardCheck, Receipt, ShieldAlert } from "lucide-react";
import type { DomainSummary } from "@/lib/tasks/sort";
import { DOMAIN_LABEL, TASK_DOMAINS, type TaskDomain } from "@/lib/tasks/types";
import Link from "next/link";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Icon + tint well per domain. Tints are an INTERIM — design-system-gaps.md
 *  row 212: Bloom has no four-value domain palette, and its tint slots are all
 *  severity-shaped. */
const DOMAIN_VISUAL: Record<
  TaskDomain,
  { icon: typeof AlertTriangle; bg: string; fg: string }
> = {
  escalation: {
    icon: AlertTriangle,
    bg: "var(--task-tint-escalation-bg)",
    fg: "var(--task-tint-escalation-fg)",
  },
  riskFlag: {
    icon: ShieldAlert,
    bg: "var(--task-tint-risk-bg)",
    fg: "var(--task-tint-risk-fg)",
  },
  billing: {
    icon: Receipt,
    bg: "var(--task-tint-billing-bg)",
    fg: "var(--task-tint-billing-fg)",
  },
  monitoring: {
    icon: ClipboardCheck,
    bg: "var(--task-tint-monitoring-bg)",
    fg: "var(--task-tint-monitoring-fg)",
  },
};

/* `BreachChip` MOVED TO `chips.tsx` (arch-A). It is required to be one pattern
   system-wide and could not stay inside the four-domain navigator that scoping
   Tasks to billing retires; the card below still draws it, from there.

   THE RE-EXPORT THAT SAT HERE IS GONE. It was a compatibility shim for callers
   importing `BreachChip` from this file, and A2 found there are none left —
   `task-pane.tsx`, the only other consumer, reads it from `chips.tsx` directly.
   A re-export nobody imports is surface to keep in sync for no reader. */
import { BreachChip } from "@/components/tasks/chips";


/** TODO-COPY, AND THE COPY IS GENUINELY AMBIGUOUS — see gap row 221.
 *
 *  §3.3 gives the shape as "1 past 24h" without saying which reading it means:
 *  "1 item past its 24h deadline" (names the SLA) or "1 item overdue by 24h"
 *  (names the overage). This computes the OVERAGE, because that is the fact the
 *  supervisor cannot get anywhere else — the SLA is implied by the domain, and a
 *  Risk flags tab holding both red (24h) and orange (48h) flags could not name one
 *  SLA truthfully anyway.
 *
 *  The wording stays the spec's until a copywriter settles it. "1 past 2h" does
 *  read as though 2h were the deadline, which is the argument for "overdue by". */
function breachLabel(summary: DomainSummary): string {
  const hours = Math.floor((summary.worstBreachMs ?? 0) / 3_600_000);
  const past = hours >= 24 ? `${Math.floor(hours / 24)}d` : `${Math.max(1, hours)}h`;
  return `${summary.breachedCount} past ${past}`;
}

/** ═══ THE CLOSED COUNT ACKNOWLEDGES ITSELF (Part 5) ═══
 *
 *  A resolve makes the open count drop by one and the closed count rise by one,
 *  and only the drop is visible: the eye is on the list, which just lost a row.
 *  The closed figure — the only place the work a supervisor has DONE is recorded
 *  on this page — changes silently in the corner of a card.
 *
 *  So it pulses: a brief lift to full opacity and back. Not a bounce, not a
 *  colour change, not a flourish — the Somethings rule is that clearing work is a
 *  fact, not an achievement, and a celebratory animation on a page about teen risk
 *  flags would be the wrong register entirely. What this does is make a number
 *  that moved LOOK like it moved, which is the minimum a changing figure owes a
 *  reader.
 *
 *  Fires on the value CHANGING, never on mount — arriving on a page with eleven
 *  already closed is not an event. Suppressed under `prefers-reduced-motion`,
 *  where the number simply reads correctly. */
function ClosedCount({ count, label }: { count: number; label: string }) {
  const [pulsing, setPulsing] = useState(false);
  const prev = useRef(count);
  useEffect(() => {
    if (prev.current === count) return;
    prev.current = count;
    setPulsing(true);
    const t = window.setTimeout(() => setPulsing(false), 520);
    return () => window.clearTimeout(t);
  }, [count]);
  /* ═══ THE PULSE IS AN OVERLAY, NOT A CHANGE TO THE RESTING STATE ═══
     The obvious implementation animates this element's own opacity — and it
     cannot, because at rest it is already at 1: an "opacity pulse" from full
     opacity has nowhere to go but DOWN, and a dip reads as a flicker or a
     rendering fault. Lowering the resting opacity instead would trade a moment of
     motion for a permanent contrast loss on muted ink that is already near the
     floor.
     So the resting text is untouched and a duplicate in primary ink fades in over
     it and back out. `aria-hidden`, or a screen reader announces the count twice. */
  return (
    <span className="relative inline-block">
      {label}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 text-[var(--text-primary)]",
          "transition-opacity duration-[260ms] ease-out motion-reduce:hidden",
          pulsing ? "opacity-100" : "opacity-0"
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function DomainTabs({
  summaries,
  active,
  onSelect,
  /** Closed-today per domain, and where each one goes. Passed in rather than
   *  computed here: the page already derives it, and a second derivation is how
   *  a card and a link end up disagreeing about the same number. */
  closed,
  closedHref,
}: {
  summaries: DomainSummary[];
  active: TaskDomain;
  onSelect: (d: TaskDomain) => void;
  closed: Partial<Record<TaskDomain, number>>;
  closedHref: (d: TaskDomain) => string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = TASK_DOMAINS.length - 1;
    let next = index;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    refs.current[next]?.focus();
    onSelect(TASK_DOMAINS[next]);
  };

  return (
    <div
      role="tablist"
      /* TODO-COPY */
      aria-label="Task domains"
      // ═══ EQUAL-WIDTH SEGMENTS IN ONE ROW (Part 2) ═══
      //
      // The compact pill row was content-sized and scrolled at narrow widths.
      // Tab-cards are a WORKLOAD SUMMARY as well as a control, and a summary only
      // works if all four are readable at once — so the segments are equal-width
      // and the row never scrolls horizontally.
      //
      // `min-w-0` ON EVERY CHILD, or a flex item's automatic minimum size is its
      // content and the four refuse to share the row — the same trap the pill
      // version documented, arrived at from the other direction. The label
      // truncates inside its own card rather than the row overflowing.
      /* ═══ A CONTAINED GROUP, LEFT-PACKED (Part 2) ═══
         The four cards were a `grid-cols-4` across the full content width, so at
         1440 they sat far apart with unbounded space between them and read as
         four separate things — or, unselected and unfilled, as floating text.
         They are one control: a group of segments, packed together at the left,
         sized to their content rather than to the page.
         `w-fit` is what stops the grid stretching; `minmax(0,168px)` gives each
         card the same width without letting a long label push one wider.
         8px gaps, per the spec. */
      className="grid w-fit grid-cols-2 gap-2 sm:grid-cols-[repeat(4,minmax(0,168px))]"
    >
      {summaries.map((s, i) => {
        const visual = DOMAIN_VISUAL[s.domain];
        const Icon = visual.icon;
        const selected = s.domain === active;
        const empty = s.openCount === 0;
        const closedCount = closed[s.domain] ?? 0;
        return (
          <div key={s.domain} className="relative min-w-0">
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tasks-tab-${s.domain}`}
              aria-selected={selected}
              aria-controls="tasks-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(s.domain)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                // ~72px, two lines. The height is the anatomy, not a value to
                // tune: line 1 identifies the domain, line 2 is the workload.
                /* `h-full`, NOT JUST `min-h-[72px]` — MEASURED FROM THE
                   SCREENSHOT. Risk flags carries a breach chip AND a closed
                   segment, they wrap to a second line, and that card alone grew
                   past 72px while the other three sat at 72. A row of four cards
                   where one is taller does not read as "this one has more news",
                   it reads as broken. The grid stretches its items by default, so
                   `h-full` makes every card the height of the tallest and the
                   minimum becomes the floor rather than the answer. */
                "flex h-full min-h-[72px] w-full flex-col justify-between gap-1 rounded-[var(--radius-surface)] px-3 py-2.5 text-left transition-colors",
                /* ═══ EVERY CARD IS VISIBLY CONTAINED ═══
                   Unselected cards were `--surface-s1` on a `--surface-s1` page —
                   the same value, so they had no edge at all and read as text
                   floating in the region. A white fill, a hairline and the soft
                   shadow make them cards whether or not they are the current one;
                   SELECTION is then a tonal fill and a stronger hairline, which is
                   a difference between two contained things rather than the
                   difference between a card and nothing.
                   The COUNT stays full strength either way — the workload has to
                   be readable across all four without selecting them. */
                "border shadow-[var(--shadow-card)]",
                selected
                  ? "border-[color:var(--border-contour)] bg-[var(--surface-s2)]"
                  : "border-[color:var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {/* ── LINE 1 · identity ── */}
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-[8px]"
                  style={{ backgroundColor: visual.bg, color: visual.fg }}
                >
                  <Icon className="size-3.5" />
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate text-[13px] leading-[18px]",
                    selected
                      ? "font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  {DOMAIN_LABEL[s.domain]}
                </span>
              </span>

              {/* ── LINE 2 · the workload ── */}
              {/* ═══ ONE BASELINE FOR THE COUNT LINE, ON ALL FOUR CARDS ═══
                  `items-baseline` aligns the numeral, the word "open", the breach
                  chip and the closed segment to a single baseline — and the empty
                  state renders "All clear" at the COUNT'S OWN line-height so a
                  card with nothing open does not sit a few pixels off the three
                  beside it. A row of four cards where one baseline is wrong is
                  the kind of thing a reader feels without being able to name. */}
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                {empty ? (
                  // ═══ NEVER A LARGE "0" ═══
                  // A 22px zero is the loudest thing on a calm row, and it reads
                  // as a defect rather than as an achievement. "All clear" says
                  // the same fact at the emphasis it deserves — reduced emphasis,
                  // same baseline.
                  <span className="text-[13px] leading-[24px] text-[var(--text-muted)]">
                    {/* TODO-COPY */}
                    All clear
                  </span>
                ) : (
                  <>
                    {/* `tabular-nums` and a 3-digit min-width: at 80–100 open
                        flags the count reaches three digits, and proportional
                        figures would reflow the whole line as it ticks down. */}
                    <span className="min-w-[2.2ch] text-[22px] font-semibold leading-[24px] tabular-nums text-[var(--text-primary)]">
                      {s.openCount}
                    </span>
                    <span className="text-[12px] leading-[16px] text-[var(--text-muted)]">
                      {/* TODO-COPY */}
                      open
                    </span>
                  </>
                )}
                {s.breachedCount > 0 && <BreachChip label={breachLabel(s)} />}
                {/* THE CLOSED SEGMENT'S SPACE IS RESERVED HERE and the link is
                    rendered OUTSIDE the button — see below. A nested <a> inside a
                    <button> is invalid HTML and the browser hoists it out, which
                    breaks both controls. */}
                {closedCount > 0 && (
                  <span aria-hidden className="text-[12px] leading-[16px] text-transparent">
                    · {closedCount} closed
                  </span>
                )}
              </span>
            </button>

            {/* ═══ THE CLOSED SEGMENT IS A SIBLING, NOT A CHILD (Part 3) ═══
                An anchor inside a button is invalid and gets hoisted by the
                parser, so the two controls are siblings and the link is
                positioned over the space the button reserved above. Tapping the
                card body switches tabs; tapping here navigates — unambiguous
                because they do not overlap.
                `min-h-11` gives the 44px target the brief asks for, and
                `-my-2` lets it claim that height without growing the card. */}
            {closedCount > 0 && (
              <Link
                href={closedHref(s.domain)}
                className={cn(
                  "absolute bottom-2.5 right-3 -my-2 inline-flex min-h-11 items-center rounded-sm px-1 text-[12px] leading-[16px]",
                  "text-[var(--text-muted)] underline decoration-[color:var(--border-contour)] underline-offset-2",
                  "hover:text-[var(--text-primary)] hover:decoration-[color:var(--text-primary)]",
                  RING
                )}
              >
                {/* TODO-COPY. Reads "· 2 closed" beside the open count on a busy
                    card and "All clear · 5 closed today" on an empty one — the
                    accomplishment stays where the work happened. */}
                <ClosedCount
                  count={closedCount}
                  label={empty ? `· ${closedCount} closed today` : `· ${closedCount} closed`}
                />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
