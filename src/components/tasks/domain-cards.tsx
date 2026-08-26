"use client";

// THE FOUR SUMMARY CARDS — which are also the tabs (locked decision 2: summary
// cards act as tabs).
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

/** THE ONE BREACH CHIP, used on the card, the row and the pane header (§3.3's
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

/** TODO-COPY. Breach chip text from the worst breach in the domain: "1 past 24h".
 *  Counts the items, names the SLA they blew — the two facts a supervisor needs to
 *  decide whether to open the tab. */
function breachLabel(summary: DomainSummary): string {
  const hours = Math.floor((summary.worstBreachMs ?? 0) / 3_600_000);
  const past = hours >= 24 ? `${Math.floor(hours / 24)}d` : `${Math.max(1, hours)}h`;
  return `${summary.breachedCount} past ${past}`;
}

export function DomainCards({
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
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
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
              "flex flex-col items-start gap-2.5 rounded-[var(--radius-elevated)] border p-3.5 text-left transition-colors",
              // SELECTED gets the outline treatment. Not a fill — a filled card
              // in a row of four would read as the alarm.
              selected
                ? "border-[color:var(--text-primary)] bg-[var(--surface-card)]"
                : "border-[color:var(--border-contour)] bg-[var(--surface-card)] hover:bg-[var(--tint-hover)]",
              // ZERO-COUNT CARDS ARE DE-EMPHASIZED, not hidden.
              empty && !selected && "opacity-60",
              RING
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: visual.bg, color: visual.fg }}
              >
                <Icon className="size-4" />
              </span>
              {s.breachedCount > 0 && <BreachChip label={breachLabel(s)} />}
            </span>

            <span className="w-full">
              <span className="block text-[13px] leading-[18px] text-[var(--text-secondary)]">
                {DOMAIN_LABEL[s.domain]}
              </span>
              <span className="mt-0.5 block font-display text-[22px] font-bold leading-[28px] tabular-nums text-[var(--text-primary)]">
                {s.openCount}
              </span>
              {/* ONE STATUS LINE. Reduced emphasis on the calm cases — a card
                  that is fine should not be as loud as one that is not. */}
              <span
                className={cn(
                  "mt-0.5 block text-[12px] leading-[16px]",
                  s.breachedCount > 0
                    ? "text-[var(--text-secondary)]"
                    : "text-[var(--text-muted)]"
                )}
              >
                {/* TODO-COPY. "All clear" for an empty domain — NOT a
                    celebration, and Monitoring in particular must not congratulate
                    anyone for having no green flags to read (§4). */}
                {empty
                  ? "All clear"
                  : s.breachedCount > 0
                    ? "Needs attention"
                    : "On track"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
