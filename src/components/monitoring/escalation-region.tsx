"use client";

// ═══ THE ESCALATION REGION — A LIFECYCLE, NOT A BANNER ═══
//
// It rendered two unrelated row types from two TaskItems: an active escalation,
// and separately the paperwork for a different one, with nothing saying they
// were the same kind of object at different points in its life. This renders one
// record per escalation, with the two clocks that actually exist and the
// close-out set attached to it.
//
// A RESOLVED RECORD STAYS. Calm, low-contrast, aging, carrying what is still
// owed — until the close-out set is complete. That is deliberate and it cuts
// against inbox instinct: the obligation outlives the emergency.
//
// ═══ THE ALARM BUDGET ═══
// One saturated fill on the page, and two states earn it: an active escalation,
// and an acknowledgement past its five minutes. Everything else — an overdue
// note, an overdue debrief — gets the breach chip every other overdue obligation
// on the surface gets.

import Link from "next/link";
import { AlertTriangle, FileText, Phone } from "lucide-react";
import { BreachChip } from "@/components/tasks/chips";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
import { discFor } from "@/lib/tasks/avatar";
import { clockFor } from "@/lib/tasks/escalation-state";
import type { SurfaceState } from "@/lib/tasks/load-plan";
import type { TaskItem } from "@/lib/tasks/types";
import {
  ackDeadline,
  ackStateFor,
  closeOutOpen,
  isActive,
  isAlarming,
  type EscalationRecord,
  RECORD_LIFECYCLE_LABEL,
  recordLifecycleOf,
} from "@/lib/monitoring/escalation";
import { RolePair } from "@/components/monitoring/event-pane";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ KEPT FOR TASKS, WHICH IMPORTS IT ═══
 *  `task-pane.tsx` renders escalation rows on the Tasks surface and takes this
 *  helper for their clock. It works on a `TaskItem`, not on a record, and it
 *  stays here unchanged so that rewriting this region costs Tasks nothing. It is
 *  not used by anything below. */
export function clockLabel(item: TaskItem, now: number): string {
  const clock = clockFor(item, now);
  if (clock.kind === "elapsed") return `${elapsedLabel(clock.at, now)} elapsed`;
  if (clock.kind === "remaining") return `due in ${elapsedLabel(now, clock.at)}`;
  return `${elapsedLabel(clock.at, now)} overdue`;
}

function Fact({
  icon: Icon,
  children,
  alarming,
}: {
  icon: typeof AlertTriangle;
  children: React.ReactNode;
  alarming: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold leading-[16px]",
        alarming
          ? "text-[var(--task-respond-fg)]"
          : "rounded-full bg-[var(--surface-s1)] px-2 py-0.5 font-normal text-[var(--text-secondary)]"
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

/** NEEDS-COPY-NICOLE, all of them. The state, in the reader's terms. */
function stateLine(rec: EscalationRecord, now: number): string {
  if (isActive(rec)) {
    const ack = ackStateFor(rec, now);
    if (ack === "acknowledged") return "Active · acknowledged";
    return ack === "breached" ? "Active · not acknowledged" : "Active · awaiting acknowledgement";
  }
  /* ═══ THE TERMINAL STATE IS NAMED (arch-G, G6) ═══
     It read "Closed · close-out complete" for a finished record — true, and it
     described the CHECKLIST rather than the record. `closedDocumented` is the
     shared label, so this row and the pane cannot spell one state two ways. */
  if (recordLifecycleOf(rec, now) === "closedDocumented") {
    return RECORD_LIFECYCLE_LABEL.closedDocumented;
  }
  const open = closeOutOpen(rec, now).length;
  return open === 0
    ? /* CLOSED, EVERYTHING OWED DONE, AND THE NOTE IS NOT ONE OF THEM — which
         is a real state: `closeOutOpen` waives a conditional item, so "nothing
         owed" can be true while the note is still missing. Saying "documented"
         here would be the surface asserting a note nobody wrote. */
      "Closed · note not recorded"
    : `Closed · ${open} close-out item${open === 1 ? "" : "s"} open`;
}

function Row({
  rec,
  now,
  selected,
  onSelect,
}: {
  rec: EscalationRecord;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const alarming = isAlarming(rec, now);
  const ack = ackStateFor(rec, now);
  const disc = discFor(rec.teenId);
  const open = closeOutOpen(rec, now);
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2",
        alarming
          ? "text-[var(--task-respond-fg)]"
          : "bg-[var(--surface-card)] text-[var(--text-primary)]",
        selected && (alarming ? "ring-2 ring-inset ring-[var(--task-respond-fg)]" : "bg-[var(--surface-s2)]")
      )}
      style={alarming ? { backgroundColor: "var(--task-respond-bg)" } : undefined}
      data-anno-ref={`escalation-row:${rec.id}`}
      data-escalation-state={isActive(rec) ? "active" : open.length ? "closeout-open" : "settled"}
      data-ack-state={ack}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={[
          /* ROLES, SPELLED OUT. */
          `teen ${rec.teenName}`,
          `mentor ${rec.mentorName}`,
          stateLine(rec, now),
          rec.is911 ? "911 dispatched" : isActive(rec) ? "no 911" : null,
          ack === "breached" ? "acknowledgement overdue" : null,
          `triggered ${elapsedLabel(rec.triggeredAt, now)} ago`,
        ]
          .filter(Boolean)
          .join(", ")}
        aria-current={selected ? "true" : undefined}
        className={cn(
          /* 44px MINIMUM. The row's own button measured 28px high after the
             role labels replaced the two-line name block — under HIG's 44 and
             under Material's 48, on the most urgent control on the surface. */
          "flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-control)] py-1.5 text-left",
          RING
        )}
      >
        {alarming ? (
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
        ) : (
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
            style={{ backgroundColor: disc.bg, color: disc.fg }}
          >
            {rec.teenName.charAt(0)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <RolePair
            teenName={rec.teenName}
            mentorName={rec.mentorName}
            tone={alarming ? "onFill" : "default"}
          />
        </span>
        {(isActive(rec) || rec.is911) && (
          <Fact icon={Phone} alarming={alarming}>
            {/* NEEDS-COPY-NICOLE */}
            {rec.is911 ? "911 dispatched" : "No 911"}
          </Fact>
        )}
        <Fact icon={isActive(rec) ? AlertTriangle : FileText} alarming={alarming}>
          {stateLine(rec, now)}
        </Fact>
        {/* ═══ THE ACK CLOCK, WHICH THE UI DID NOT ENFORCE BEFORE ═══
            Counting down inside the window and breached past it. On a closed
            record it is gone: acknowledgement is not a question any more. */}
        {isActive(rec) &&
          (ack === "breached" ? (
            <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
              {/* NEEDS-COPY-NICOLE */}
              ack {elapsedLabel(ackDeadline(rec), now)} overdue
            </span>
          ) : ack === "pending" ? (
            <span
              className={cn("shrink-0 text-[12px] tabular-nums", alarming ? "font-semibold" : "text-[var(--text-secondary)]")}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {/* NEEDS-COPY-NICOLE */}
              ack in {elapsedLabel(now, ackDeadline(rec))}
            </span>
          ) : null)}
        {/* AGE. Always, on every state — a resolved record's whole point is that
            it ages visibly. */}
        <span
          className={cn("shrink-0 text-[13px] tabular-nums", alarming ? "font-semibold" : "text-[var(--text-secondary)]")}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {elapsedLabel(rec.triggeredAt, now)} ago
        </span>
        {/* WHAT IS OWED, as a chip rather than as the fill — see the alarm
            budget note at the top. */}
        {!isActive(rec) && open.some((i) => i.overdue) && (
          <BreachChip label={`${open.filter((i) => i.overdue).length} overdue`} />
        )}
      </button>
      <Link
        href={escalationHref(rec.id)}
        className={cn(
          /* 44px, like the row button beside it — HIG's floor, on the control a
             supervisor presses in the first five minutes of a crisis. */
          "inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold",
          alarming
            ? "bg-[var(--task-respond-fg)] text-[var(--task-respond-bg)] transition-opacity hover:opacity-90"
            : "border border-[color:var(--border-contour)] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {/* NEEDS-COPY-NICOLE. THE ACTION NAMES THE WORK. "Open documentation" is
            gone with "write-up": on a closed escalation what is waiting is the
            escalation note. */}
        {isActive(rec) ? "Open escalation" : "Open the record"}
      </Link>
    </li>
  );
}

function RegionSkeleton() {
  return (
    <section
      aria-hidden
      className="mt-4 shrink-0 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)]"
    >
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3 border-t border-[color:var(--border-subtle)] px-4 py-3 first:border-t-0">
          <span className="size-7 shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-3 w-40 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
            <span className="block h-2.5 w-24 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          </span>
          <span className="h-3 w-20 shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
        </div>
      ))}
    </section>
  );
}

function RegionError() {
  return (
    <section
      role="alert"
      className="mt-4 shrink-0 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-3"
    >
      <p className="text-[13.5px] leading-[19px] text-[var(--text-secondary)]">
        {/* NAMES WHAT IS UNKNOWN rather than what failed. */}
        Escalations couldn’t be loaded, so this page can’t say whether any are
        open.
      </p>
    </section>
  );
}

export function EscalationRegion({
  records,
  now,
  state = "ready",
  selectedId,
  onSelect,
}: {
  records: EscalationRecord[];
  now: number;
  state?: SurfaceState;
  selectedId: string | null;
  onSelect: (rec: EscalationRecord) => void;
}) {
  if (state === "loading") return <RegionSkeleton />;
  if (state === "error") return <RegionError />;
  if (records.length === 0) return null;

  const alarming = records.some((r) => isAlarming(r, now));
  return (
    <section
      data-anno-ref="escalation-region"
      /* ═══ ASSERTIVE, AND ONLY HERE ═══
         An escalation arriving is the one thing on this page that interrupts.
         Nothing else earns it — see `now-band.tsx`, which is deliberately
         `aria-live="off"`. */
      aria-live={alarming ? "assertive" : "off"}
      /* NEEDS-COPY-NICOLE */
      aria-label="Escalations"
      className="mt-4 shrink-0 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)]"
    >
      <ul className="divide-y divide-[color:var(--border-subtle)]">
        {records.map((rec) => (
          <Row
            key={rec.id}
            rec={rec}
            now={now}
            selected={selectedId === rec.id}
            onSelect={() => onSelect(rec)}
          />
        ))}
      </ul>
    </section>
  );
}
