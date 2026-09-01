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
//     header (see BreachChip below, exported for exactly that reason).
//
// REAL TAB SEMANTICS. These are `role="tab"` in a `role="tablist"` with arrow-key
// navigation, one tab stop for the set — the same APG pattern the Activity rail
// uses. They swap a panel in place; they are not links.

import { useRef } from "react";
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

/** THE ONE BREACH CHIP, used on the tab, the row and the pane header (§3.3's
 *  alarm-budget rule: "one compact chip pattern everywhere"). Exported so the
 *  other two surfaces consume it rather than each growing a lookalike.
 *
 *  NEVER COLOUR ALONE — icon plus text, always. */
export function BreachChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-[16px]"
      style={{
        backgroundColor: "var(--band-clay-bg)",
        color: "var(--band-clay-fg)",
      }}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

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
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
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
                "flex min-h-[72px] w-full flex-col justify-between gap-1 rounded-[var(--radius-surface)] px-3 py-2.5 text-left transition-colors",
                // SELECTED IS A TONAL FILL PLUS A HAIRLINE. Unselected is flat and
                // recessed — but the COUNT stays full strength either way, which
                // is the whole point of re-weighting: the workload must be
                // readable across all four without selecting them.
                selected
                  ? "bg-[var(--surface-s2)] ring-1 ring-[color:var(--border-contour)]"
                  : "bg-[var(--surface-s1)] hover:bg-[var(--tint-hover)]",
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
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                {empty ? (
                  // ═══ NEVER A LARGE "0" ═══
                  // A 22px zero is the loudest thing on a calm row, and it reads
                  // as a defect rather than as an achievement. "All clear" says
                  // the same fact at the emphasis it deserves.
                  <span className="text-[13px] leading-[22px] text-[var(--text-muted)]">
                    {/* TODO-COPY */}
                    All clear
                  </span>
                ) : (
                  <>
                    <span className="text-[22px] font-semibold leading-[24px] tabular-nums text-[var(--text-primary)]">
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
                {empty ? `· ${closedCount} closed today` : `· ${closedCount} closed`}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
