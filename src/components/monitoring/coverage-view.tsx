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

/* `RING` WENT WITH THE ROW'S CONTROL (Phase 7). Coverage is read-only, so it has
   no focusable element of its own — see the row's note. The moment it gains one,
   the ring comes back with it rather than being remembered. */

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
}: {
  conversations: SupervisedConversation[];
  credited: ReadonlySet<string>;
  /** Conversations the live layer says are active right now. */
  liveIds: ReadonlySet<string>;
  now: number;
}) {
  const rows = [...conversations].sort((a, b) => compareConversations(a, b, credited));
  /* ═══ NO CONVERSATIONS IS NOT THE SAME AS NONE REVIEWED (Phase 7) ═══
     An empty `<ul>` rendered a blank column on the destination — and on a
     surface whose claim is "this is the denominator", a blank space is
     indistinguishable from a load that produced nothing. It says which it is.
     AND IT DOES NOT CONGRATULATE: an empty caseload is a fact about the roster,
     not an achievement, and "all caught up" here would be praise for having no
     teens. NEEDS-COPY-NICOLE. */
  if (rows.length === 0) {
    return (
      <div
        data-anno-ref="coverage-empty"
        className="px-4 py-6"
      >
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          No supervised conversations in this period.
        </p>
      </div>
    );
  }
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
              {/* ═══ THE ROW HAS NO ACTION, AND THAT IS THE HONEST STATE ═══
                  IT WAS A BUTTON THAT LIED. Accessible name "Open the
                  conversation between teen X and mentor Y", wired to a handler
                  that called `credit(c.id, "conversation-open")` and navigated
                  nowhere — so it RECORDED "LOOKED" WITHOUT LOOKING. On the one
                  surface whose job is answering "have I looked at my teens",
                  that is a fabricated measurement of the number a supervisor
                  would defend themselves with.
                  MAKING IT A REAL LINK WAS TRIED AND IS NOT AVAILABLE, for two
                  measured reasons:
                   · `chatThreadHref` is a MENTOR route. Followed as a
                     supervisor it renders `MentorShell` — "Mentor navigation",
                     and a rail still offering `Tasks` and `Monitoring`, both
                     retired. Fourteen supervisor call sites already have this
                     defect; mentor navigation is out of this restructure's
                     stated scope.
                   · THE TEEN DOES NOT EXIST ON EITHER TARGET. These rows carry
                     `tk-*` ids from the tasks roster; the record and chat
                     surfaces know `t*` ids from the demo people. Measured:
                     `/app/chat/tk-omari` lands on a mentor's thread list, and
                     `/admin/person/tk-omari?tab=care` says "We couldn't find
                     that person." Two namespaces, no overlap.
                  SO COVERAGE IS READ-ONLY, which is what it is: the floor, the
                  denominator, a measure rather than a queue. Credit comes from
                  reviewing a flag on Risk Flags, where the reader stays on the
                  page and it is observable. The row still states everything the
                  question needs — reviewed or not, how long since activity, and
                  how many events it is carrying. Gap rows 431 and 432. */}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
