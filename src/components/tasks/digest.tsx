"use client";

// THE SHIFT-START DIGEST (§7). Pinned ABOVE the Respond strip, on the first
// session after a gap of more than 8 hours.
//
// WHY IT SITS ABOVE THE RESPOND STRIP AND NOT BELOW: it is the only element on the
// page that is about the PAST — "here is what happened while you were gone". The
// Respond strip is about right now. Reading order is chronological, and it is also
// dismissal order: the digest goes away first because it is the thing you finish
// reading, whereas the strip goes away when the escalation is handled.
//
// BREACH-ON-ARRIVAL (§7): any overnight breach renders as the FIRST LINE,
// breach-styled, BEFORE the counts. Arriving to find something already failed is a
// different fact from arriving to find work waiting, and burying it under a count
// row would make the reader do the arithmetic themselves.
//
// AUTO-RETIRES WHEN THE FIRST ITEM IS RESOLVED (§7). Not on a timer, not on tab
// change — on the first resolve, because that is the moment the digest has done its
// job: the reader has stopped orienting and started working.
//
// THE CTA TARGETS THE PRIORITY HEAD and its label is DYNAMIC (§7's "Start with
// red flags / dynamic when the ladder head differs") — it names the domain the
// global sort actually points at. It used to be checked against the Next-up strip
// below it; with that strip gone, the list's own order and the pane's
// pre-selection are what it must agree with, and it agrees by construction
// because all three read `nextUp`.

import { AlertTriangle, X } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import type { DomainSummary } from "@/lib/tasks/sort";
import {
  DOMAIN_LABEL,
  domainCountLabel,
  type TaskDomain,
  type TaskItem,
} from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** THE GAP THAT COUNTS AS A NEW SHIFT. 8 hours per §7 — named rather than inlined
 *  so the digest's trigger is one readable constant. */
export const SHIFT_GAP_MS = 8 * 60 * 60 * 1000;

/** Has it been a shift? `0` (never opened) counts, so a first-ever visit meets the
 *  digest rather than missing it. */
export function isNewShift(lastVisitAt: number, now: number): boolean {
  return lastVisitAt === 0 || now - lastVisitAt > SHIFT_GAP_MS;
}

/** TODO-COPY. "Since Thursday's shift —".
 *
 *  Names the WEEKDAY, not a date: a supervisor arriving at 8am thinks in shifts,
 *  and "since Thursday" is how they would say it. A never-opened state has no
 *  previous shift to name, so it says so instead of inventing one. */
function sinceLabel(lastVisitAt: number): string {
  if (lastVisitAt === 0) return "Since you were last here —";
  const weekday = new Date(lastVisitAt).toLocaleDateString("en-US", {
    weekday: "long",
  });
  return `Since ${weekday}’s shift —`;
}

/** TODO-COPY. The CTA, named from the domain the global sort points at. */
function ctaLabel(head: TaskItem | null): string {
  if (!head) return "Open the worklist";
  const domain = DOMAIN_LABEL[head.domain].toLowerCase();
  return `Start with ${domain}`;
}

export function ShiftDigest({
  lastVisitAt,
  summaries,
  head,
  breachedCount,
  onGoToDomain,
  onStart,
  onDismiss,
}: {
  lastVisitAt: number;
  summaries: DomainSummary[];
  /** The Next-up item — the CTA's target. */
  head: TaskItem | null;
  /** Overnight breaches, across every domain. */
  breachedCount: number;
  onGoToDomain: (d: TaskDomain) => void;
  onStart: (item: TaskItem) => void;
  onDismiss: () => void;
}) {
  const withWork = summaries.filter((s) => s.openCount > 0);

  return (
    <section
      /* TODO-COPY */
      aria-label="Since your last shift"
      className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]">
            {sinceLabel(lastVisitAt)}
          </p>

          {/* BREACH-ON-ARRIVAL: FIRST LINE, before the counts (§7). */}
          {breachedCount > 0 && (
            <p
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12.5px] font-semibold leading-[16px]"
              style={{
                backgroundColor: "var(--band-clay-bg)",
                color: "var(--band-clay-fg)",
              }}
            >
              <AlertTriangle className="size-3 shrink-0" aria-hidden />
              {/* TODO-COPY. Names the count and what it means, in words — never
                  colour alone. */}
              {breachedCount === 1
                ? "1 item went past its deadline overnight"
                : `${breachedCount} items went past their deadline overnight`}
            </p>
          )}

          {/* PER-DOMAIN COUNT CHIPS, TAPPABLE — they switch tabs (§7). Real
              buttons, so the keyboard reaches them. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {withWork.length === 0 ? (
              <span className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
                {/* TODO-COPY. Calm, and not a celebration. */}
                Nothing came in.
              </span>
            ) : (
              withWork.map((s) => (
                <button
                  key={s.domain}
                  type="button"
                  onClick={() => onGoToDomain(s.domain)}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-2.5",
                    "text-[12.5px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  <span className="font-semibold tabular-nums">
                    {s.openCount}
                  </span>
                  {domainCountLabel(s.domain, s.openCount)}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {head && (
            <PillButton
              onClick={() => onStart(head)}
              className="h-9 px-4 text-[13px]"
            >
              {ctaLabel(head)}
            </PillButton>
          )}
          <button
            type="button"
            onClick={onDismiss}
            /* TODO-COPY */
            aria-label="Dismiss the shift summary"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)]",
              "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
