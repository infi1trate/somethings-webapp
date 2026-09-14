"use client";

// THE TAB COMPLETION STATE (§5) — shown in the pane when a tab's last item was
// just resolved.
//
// PEAK-END, AND CALM. §5 is explicit: "calm, no celebration." So a thin check, a
// statement of fact, and a CTA that hands the reader the next real thing. No
// confetti, no "Great work", no exclamation mark, no green success badge.
//
// The distinction worth keeping: this is not an EMPTY state. An empty tab means
// there was nothing here; this means there WAS and the reader finished it. The
// difference is the CTA — an empty tab offers nothing because nothing follows,
// while a finished one knows exactly what is next, because the global sort does.
//
// ═══ THE CTA IS OPTIONAL SINCE arch-A ═══
//
// It read "Next: Billing (6)" — the next DOMAIN per the global sort, not the tab
// order and not the biggest queue. Tasks is single-domain now, so there is no
// next tab to offer and the card renders the cleared statement alone.
//
// THE PROP SURVIVES RATHER THAN BEING DELETED, for two reasons: Phase B's
// Monitoring has tiers to move between, and Phase C's Home is where a cleared
// supervisor is actually sent next. Wiring this card to Home now would be a
// cross-surface CTA built before the surface exists.

import { PillButton } from "@/components/settings/pill-button";
import { DOMAIN_LABEL, type TaskDomain } from "@/lib/tasks/types";

export function TabComplete({
  domain,
  next = null,
  onGoNext,
}: {
  domain: TaskDomain;
  /** The next domain per the global sort, with its open count. Null — or absent,
   *  which is what a single-domain surface passes — renders the statement with no
   *  CTA. When everything is clear the caller shows the whole-page empty state
   *  instead, per §5. */
  next?: { domain: TaskDomain; count: number } | null;
  onGoNext?: (domain: TaskDomain) => void;
}) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-6 text-center">
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-full bg-[var(--surface-s2)] text-[var(--text-secondary)]"
      >
        {/* A THIN CHECK, not a filled success badge — a badge is a celebration. */}
        <svg viewBox="0 0 16 16" className="size-4" fill="none">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <p
        className="text-[15px] leading-[22px] text-[var(--text-primary)]"
        role="status"
      >
        {/* TODO-COPY. "Risk flags — all reviewed." A statement, with a full stop. */}
        {`${DOMAIN_LABEL[domain]} — all reviewed.`}
      </p>

      {next && onGoNext && (
        <PillButton
          onClick={() => onGoNext(next.domain)}
          className="mt-1 h-9 px-5 text-[14px]"
        >
          {/* TODO-COPY. The next domain per the GLOBAL SORT, with its count. */}
          {`Next: ${DOMAIN_LABEL[next.domain]} (${next.count})`}
        </PillButton>
      )}
    </div>
  );
}
