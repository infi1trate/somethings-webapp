"use client";

// ═══ COMPLETED TODAY — THE BUCKET BEHIND YOU (arch-F, F4) ═══
//
// ═══ WHY NOT UPCOMING / COMPLETED TABS ═══
//
// Tabs reintroduce the chrome arch-A removed and arch-E superseded, and
// "Completed" is a LOG: the Activity ledger is already the immutable record of
// closed work, filterable by domain and scope. A second completed list on Tasks
// would be two sources of truth for the same events, and the one that is not the
// ledger would be the one people read.
//
// ═══ WHY A GROUP IS THE RIGHT SHAPE ═══
//
// The buckets are time-based — Overdue, Due today, Due tomorrow, Later — and this
// is the same grammar pointed backwards. It sits after Later, collapsed, with its
// count in the header: a resting place a supervisor can see without a second
// surface, and one they have to ask for.
//
// TODAY ONLY. Anything older lives in Activity, which is where a date range
// belongs and where one exists.

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { WorklistGroupHeader } from "@/components/tasks/group-header";
import { TASK_KIND_LABEL } from "@/lib/tasks/task-kind";
import type { TaskType } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** One closed review, as the group needs it. Built at commit time — the moment
 *  the undo window closes and the ledger event is written — so this list and the
 *  ledger cannot disagree about what happened. */
export interface CompletedEntry {
  id: string;
  teenName: string;
  taskType: TaskType;
  /** The code that was submitted. The outcome, not the recommendation. */
  code: string;
  /** Whether that code was a change or a confirmation of what was on record. */
  outcome: "confirmed" | "unchanged";
  at: number;
}

/** NEEDS-COPY-NICOLE. Both strings. "Confirmed" for a renewal, "Changed to" for
 *  a change: the row states what the supervisor did, not what the model
 *  suggested. */
function outcomeLine(e: CompletedEntry): string {
  return e.outcome === "unchanged" ? `${e.code} confirmed` : `Changed to ${e.code}`;
}

function timeOf(at: number): string {
  /* THE SAME CLOCK FORMAT AS THE ROWS' DEADLINES — `deadlineFactFor` and
     `childTimeLabel` both use this, so the surface has one time of day. */
  return new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function CompletedGroup({
  entries,
  selectedId,
  onSelect,
  activityHref,
}: {
  entries: CompletedEntry[];
  selectedId: string | null;
  onSelect: (entry: CompletedEntry) => void;
  activityHref: string;
}) {
  const [open, setOpen] = useState(false);
  /* ONLY WHEN THERE IS SOMETHING IN IT. An empty "Completed today — 0" at the
     bottom of a queue is furniture, and on a surface whose goal state is an empty
     list it would be the only thing left on screen. */
  if (entries.length === 0) return null;

  return (
    <div data-slot="completed-group">
      {/* THE WHOLE HEADER IS THE TARGET, not a caret beside it — the same
          arrangement the score strip and the record-context accordion use. The
          shared group header renders inside it, so this band is visually one of
          the four above rather than a new kind of thing. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-slot="completed-toggle"
        className={cn("flex w-full items-stretch text-left", RING)}
      >
        <span className="min-w-0 flex-1">
          <WorklistGroupHeader
            /* NEEDS-COPY-NICOLE */
            label="Completed today"
            count={entries.length}
          />
        </span>
        <span className="flex shrink-0 items-center border-t border-[color:var(--border-subtle)] bg-[var(--surface-card)] pr-3">
          <ChevronRight
            aria-hidden
            className={cn(
              "size-4 text-[var(--text-muted)] transition-transform motion-reduce:transition-none",
              open && "rotate-90"
            )}
          />
        </span>
      </button>

      {open && (
        <>
          <ul role="list" aria-label="Completed today">
            {entries.map((e) => (
              <li
                key={e.id}
                /* ═══ READ-ONLY, AND SELECTABLE ═══
                   Selecting one opens the pane with the review in its read-only
                   state. There is nothing to decide — the decision is on the
                   record — and the row says what was submitted rather than
                   offering to change it. */
                data-anno-ref={`completed-row:${e.id}`}
                className={cn(
                  "flex h-14 items-center gap-3 border-t border-[color:var(--border-subtle)] px-3",
                  selectedId === e.id ? "bg-[var(--surface-s2)]" : "hover:bg-[var(--tint-hover)]"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(e)}
                  aria-current={selectedId === e.id ? "true" : undefined}
                  aria-label={[
                    /* NEEDS-COPY-NICOLE. The group, the teen, the task, the
                       outcome, the time — the same order the row draws them. */
                    "Completed today",
                    e.teenName,
                    TASK_KIND_LABEL[e.taskType],
                    outcomeLine(e),
                    timeOf(e.at),
                  ].join(", ")}
                  className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-control)] py-1 text-left", RING)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      {/* THE SAME ANATOMY AS AN OPEN ROW, QUIETER: the teen
                          leads, the task type is a chip. A completed row that
                          looked different would read as a different kind of
                          object. */}
                      <span className="truncate text-[14px] leading-[20px] text-[var(--text-secondary)]">
                        {e.teenName}
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--surface-s1)] px-1.5 py-px text-[11px] leading-[15px] text-[var(--text-secondary)]">
                        {TASK_KIND_LABEL[e.taskType]}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] leading-[16px] text-[var(--text-secondary)]">
                      {outcomeLine(e)}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-[12px] tabular-nums text-[var(--text-secondary)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {timeOf(e.at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* ═══ THE WAY TO THE ACTUAL RECORD ═══
              The ledger is the log; this group is a resting place for the shift.
              The link carries the domain and the scope; it cannot carry the DAY,
              because Activity has no date axis (gap row 371) — so it lands on
              this domain's full history rather than on today, which is stated
              rather than implied by the label. */}
          <div className="flex items-center justify-end border-t border-[color:var(--border-subtle)] px-3 py-2">
            <Link
              href={activityHref}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[12.5px] font-semibold",
                "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                RING
              )}
            >
              <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              {/* NEEDS-COPY-NICOLE */}
              View in Activity
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
