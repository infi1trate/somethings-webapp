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
}: {
  summaries: DomainSummary[];
  active: TaskDomain;
  onSelect: (d: TaskDomain) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = TASK_DOMAINS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onSelect(TASK_DOMAINS[next]);
  };

  return (
    <div
      role="tablist"
      /* TODO-COPY */
      aria-label="Task domains"
      // ═══ ONE LINE AT EVERY WIDTH, SCROLLING WHEN IT HAS TO ═══
      //
      // Wrapping was tried first and produced four rows at 320px: a flex item's
      // automatic minimum size is its content, so each segment refused to shrink
      // to its 50% basis and took a line of its own — 200px of tabs above the
      // list. Adding `min-w-0` would have achieved two-up by TRUNCATING the
      // labels, and "Monito…" above a worklist is worse than the height it saves.
      //
      // So the row scrolls instead: full labels, one 44px line, at any width.
      // Same pattern as the record's own tab nav. The CONTAINER scrolls, not the
      // page — verified, document overflow is 0 at 320px.
      className="flex gap-2 overflow-x-auto"
    >
      {summaries.map((s, i) => {
        const visual = DOMAIN_VISUAL[s.domain];
        const Icon = visual.icon;
        const selected = s.domain === active;
        const empty = s.openCount === 0;
        return (
          <button
            key={s.domain}
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
              // 44px MINIMUM, from the touch-target floor rather than from the
              // spec's 44–48 range — they agree, and the floor is the reason.
              "flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-left transition-colors",
              // ═══ CONTENT-SIZED, NOT STRETCHED ═══
              // Stretching the four to equal widths was tried and left a long
              // gap between each label and its count — "Escalations ······ 1" —
              // which reads as a table of figures, the exact dashboard quality
              // this row exists to remove. Content-sized pills, left-aligned,
              // read as navigation. `shrink-0` keeps labels whole and lets the
              // row scroll instead of truncating.
              "shrink-0",
              // SELECTED IS A TONAL FILL. The old outline-plus-card treatment
              // read as a selected OBJECT; a fill reads as a place you are in,
              // which is what a tab is.
              selected
                ? "bg-[var(--surface-s2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            {/* The tint well stays — it is the only per-domain identity in the
                row now that the cards' size and position are gone. Smaller than
                the cards' 32px because it shares a line with the label. */}
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-[8px]"
              style={{ backgroundColor: visual.bg, color: visual.fg }}
            >
              <Icon className="size-3.5" />
            </span>

            {/* No `truncate` and no `flex-1`: the row scrolls rather than
                clipping a label, and the segment is content-sized, so there is
                neither an ellipsis nor slack to distribute. */}
            <span className="whitespace-nowrap text-[13.5px] leading-[18px]">
              {DOMAIN_LABEL[s.domain]}
            </span>

            {/* THE COUNT, AT BODY SIZE. Reduced emphasis at zero rather than
                hidden — the shape of the row is something a reader learns once,
                and a tab that disappears when empty has to be re-learned. */}
            <span
              className={cn(
                "shrink-0 text-[13.5px] leading-[18px] tabular-nums",
                empty
                  ? "text-[var(--text-muted)]"
                  : selected
                    ? "font-semibold text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]"
              )}
            >
              {s.openCount}
            </span>

            {/* THE STATUS INDICATOR IS NOTHING WHEN ON TRACK. The old row always
                said something; silence is the correct rendering of "fine", and it
                is what makes the breach chip mean anything. */}
            {s.breachedCount > 0 && <BreachChip label={breachLabel(s)} />}
          </button>
        );
      })}
    </div>
  );
}
