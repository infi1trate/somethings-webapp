"use client";

// ═══ COVERAGE — THE FLOOR UNDER THE QUEUE ═══
//
// Every supervised conversation, not only the ones a classifier noticed. The
// queue is the priority entry point; this is the denominator, and it is expressed
// as PROGRESS AGAINST A PERIOD. Never a count of what is left: "26 unreviewed" is
// the inbox reading of the same number and it is the reading this view exists to
// avoid.
//
// LIVE STATE CHANGES ROW TREATMENT, NEVER POSITION (locked decisions 5, 6, 14).
// A row that moves because a teen typed is a row a reader loses.

import { Check, Circle, Dot } from "lucide-react";
import { elapsedLabel } from "@/components/tasks/strips";
import { discFor } from "@/lib/tasks/avatar";
import {
  compareConversations,
  coverageLine,
  coverageProgress,
  type SupervisedConversation,
} from "@/lib/monitoring/coverage";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function CoverageMeter({
  conversations,
  credited,
}: {
  conversations: SupervisedConversation[];
  credited: ReadonlySet<string>;
}) {
  const p = coverageProgress(conversations, credited);
  const pct = Math.round(p.fraction * 100);
  return (
    <div className="min-w-0">
      <p className="text-[13px] leading-[18px] text-[var(--text-primary)]">
        {coverageLine(p)}
      </p>
      {/* A BAR, WITH ITS NUMBER IN TEXT BESIDE IT — never colour or length
          alone, and `role="img"` with a name rather than a progressbar because
          nothing here is loading. */}
      <div
        role="img"
        aria-label={`${pct}% of supervised conversations reviewed this ${p.period}`}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-s2)]"
      >
        <div
          className="h-full rounded-full bg-[var(--text-primary)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CoverageList({
  conversations,
  credited,
  liveIds,
  now,
  onOpen,
}: {
  conversations: SupervisedConversation[];
  credited: ReadonlySet<string>;
  /** Conversations the live layer says are active right now. */
  liveIds: ReadonlySet<string>;
  now: number;
  onOpen: (c: SupervisedConversation) => void;
}) {
  const rows = [...conversations].sort((a, b) => compareConversations(a, b, credited));
  return (
    <ul role="list" /* NEEDS-COPY-NICOLE */ aria-label="Supervised conversations" className="min-w-0">
      {rows.map((c) => {
        const reviewed = c.reviewedAt != null || credited.has(c.id);
        const live = liveIds.has(c.id);
        const disc = discFor(c.teenId);
        return (
          <li
            key={c.id}
            data-anno-ref={`coverage-row:${c.id}`}
            data-reviewed={reviewed ? "true" : "false"}
            data-live={live ? "true" : "false"}
            className={cn(
              "flex h-14 items-center gap-3 border-t border-[color:var(--border-subtle)] px-3 first:border-t-0",
              /* THE LIVE TREATMENT: a left edge and a dot. Not a reorder, not a
                 colour on its own, and not motion. */
              live && "border-l-2 border-l-[color:var(--text-primary)] bg-[var(--surface-s1)]"
            )}
          >
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
              style={{ backgroundColor: disc.bg, color: disc.fg }}
            >
              {c.teenName.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5">
                <span className="truncate font-display text-[14px] leading-[20px] text-[var(--text-primary)]">
                  {c.teenName}
                </span>
                <span aria-hidden className="shrink-0 text-[12px] text-[var(--text-muted)]">↔</span>
                <span className="truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
                  {c.mentorName}
                </span>
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-[16px] text-[var(--text-secondary)]">
                {live && (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--text-primary)]">
                    <Dot className="size-3.5 shrink-0" aria-hidden />
                    {/* NEEDS-COPY-NICOLE */}
                    live
                  </span>
                )}
                <span className="shrink-0 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                  {elapsedLabel(c.lastActivityAt, now)} ago
                </span>
                {c.eventCount > 0 && (
                  <>
                    <span aria-hidden className="opacity-40">·</span>
                    {/* NEEDS-COPY-NICOLE. The count is context, not a badge: the
                        queue is where events are worked. */}
                    <span>{c.eventCount} in the queue</span>
                  </>
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11.5px]",
                  reviewed ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"
                )}
              >
                {reviewed ? (
                  <>
                    <Check className="size-3.5 shrink-0" aria-hidden />
                    {/* NEEDS-COPY-NICOLE */}
                    reviewed
                  </>
                ) : (
                  <>
                    <Circle className="size-3 shrink-0" aria-hidden />
                    not yet
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => onOpen(c)}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-contour)] px-3 text-[12.5px] font-semibold text-[var(--text-primary)]",
                  "hover:bg-[var(--tint-hover)]",
                  RING
                )}
                /* NEEDS-COPY-NICOLE */
                aria-label={`Open the conversation between teen ${c.teenName} and mentor ${c.mentorName}`}
              >
                Open
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
