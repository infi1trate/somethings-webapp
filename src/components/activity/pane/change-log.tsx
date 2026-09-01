"use client";

// PRIOR CHANGES TO THE SAME OBJECT.
//
// ═══ THIS HISTORY IS FREE, AND THAT IS THE POINT ═══
//
// The ledger is append-only, so a mentee's prior `BILLING_REVIEW_COMPLETE` events
// ARE their code history. There is no second model to build, no back-fill, and —
// more importantly — no way for the history to disagree with the feed, because it
// IS the feed, filtered. A separate history table would be a second source of
// truth about the same fact, and the two would drift the first time one of them
// was written to and the other was not.
//
// The query lives in `pane-fixtures.ts` (`codeHistoryFor`) beside the other
// derivations; this file only draws it.
//
// ═══ IT SHOWS THE MOVE, NOT THE STATE ═══
//
// Each row is "F41.9 → F33.0", because a code history a supervisor reads is a
// history of DECISIONS. A column of end-states makes the reader diff consecutive
// lines to recover what actually happened at each one.

import { codeLabel, type CodeChange } from "@/lib/activity/pane-fixtures";
import { cn } from "@/lib/utils";

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ChangeLog({
  changes,
  /** Resolves an actor id to a display name. Passed in rather than imported so
   *  this component does not reach into the seed — the pane already holds the
   *  resolver the rest of the surface uses. */
  actorName,
  className,
}: {
  changes: CodeChange[];
  actorName: (id: string) => string;
  className?: string;
}) {
  if (changes.length === 0) {
    return (
      <p className={cn("text-[13.5px] leading-[19px] text-[var(--text-muted)]", className)}>
        {/* TODO-COPY. An ABSENCE, stated — not an empty list. "No prior changes"
            is a fact about the record; a blank space is a question about the
            component. */}
        No earlier changes on this record.
      </p>
    );
  }

  return (
    <ol className={cn("min-w-0", className)}>
      {changes.map((c, i) => (
        <li
          key={`${c.at}-${i}`}
          className={cn(
            "flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 py-2",
            // A hairline BETWEEN rows only — a rule under the last one would
            // close a list that the section's own spacing already ends.
            i > 0 && "border-t border-[color:var(--border-subtle)]"
          )}
        >
          <time
            dateTime={c.at}
            // A FIXED COLUMN with tabular figures, so the dates form one edge the
            // eye can run down — the same reasoning as the record's History
            // gutter.
            className="w-[92px] shrink-0 text-[12.5px] leading-[18px] tabular-nums text-[var(--text-muted)]"
          >
            {longDate(c.at)}
          </time>

          <p className="min-w-0 flex-1 text-[13.5px] leading-[19px] text-[var(--text-primary)]">
            {c.from && (
              <>
                <span className="font-mono text-[13px] text-[var(--text-secondary)]">
                  {c.from}
                </span>
                <span aria-hidden className="px-1.5 text-[var(--text-muted)]">
                  →
                </span>
                {/* THE ARROW IS DECORATION; the accessible name says the word. */}
                <span className="sr-only">changed to</span>
              </>
            )}
            <span className="font-mono text-[13px] font-medium">{c.to}</span>
            {/* THE DESCRIPTOR, because a code is not a sentence. Rendered after
                the codes rather than instead of them: the code is what the
                ledger records, the label is what makes it readable. */}
            {codeLabel(c.to) && (
              <span className="block text-[12.5px] leading-[17px] text-[var(--text-muted)]">
                {codeLabel(c.to)}
              </span>
            )}
          </p>

          <span className="shrink-0 text-[12.5px] leading-[18px] text-[var(--text-muted)]">
            {actorName(c.actorId)}
          </span>
        </li>
      ))}
    </ol>
  );
}
