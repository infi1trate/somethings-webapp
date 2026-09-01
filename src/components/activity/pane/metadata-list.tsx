"use client";

// THE LABEL/VALUE ROWS — the one primitive that already existed.
//
// ═══ KEPT, BUT NO LONGER THE WHOLE VOCABULARY ═══
//
// Every section of the pane used to be this shape: a label over a value, in
// identical rhythm, four or five times. That is why the pane read as a form
// readout — not because it was short, but because it had one content primitive
// and used it for everything, so a document, a decision and a timestamp all
// arrived looking the same.
//
// So this stays, tightened, for the things that ARE label/value pairs — a date,
// an actor, a status. Everything with more structure than that now has a
// primitive of its own, and the change in this file is mostly that it stopped
// being asked to carry them.
//
// TIGHTENED: the label drops to the smallest step in tertiary ink and the value
// sits at body size, so the pair reads as one unit with a caption rather than as
// two lines of equal weight. Before, an 11.5px label and a 14px value in
// secondary and primary were close enough that the eye gave them similar
// attention — which is exactly the flatness the brief is describing.

import { cn } from "@/lib/utils";

export interface MetadataItem {
  label: string;
  /** A node rather than a string, so a value can carry a code in mono or a name
   *  with an avatar without this component learning about either. */
  value: React.ReactNode;
}

export function MetadataList({
  items,
  /** Two columns where the values are short (dates, names, codes); one where
   *  they are not. The caller knows which — this cannot tell from a ReactNode. */
  columns = 2,
  className,
}: {
  items: MetadataItem[];
  columns?: 1 | 2;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3",
        columns === 2 ? "sm:grid-cols-2" : "grid-cols-1",
        className
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
            {it.label}
          </dt>
          <dd className="mt-0.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
