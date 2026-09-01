"use client";

// A RELATED RECORD — a card that shows something, not a chip that names it.
//
// ═══ WHAT IT REPLACES, AND WHY THAT WAS WORTH REPLACING ═══
//
// "Primary presentation: F33.1" rendered as a neutral chip. It named a record and
// did nothing: not a link, not expandable, no content. A reader who wanted to
// know what F33.1 actually says had to leave the pane, and a reader who did not
// know the code learned nothing at all — the chip's entire payload was five
// characters they already had in the sentence above.
//
// A related record is a CARD: what kind of record, its title, and one line of it.
// Expanding shows more IN PLACE, because the reason to look at a related record
// from here is almost always to confirm one detail before deciding — and a
// navigation that loses the pane's context to answer that is a bad trade.
//
// ═══ IT NEVER MUTATES ANYTHING (rule 13) ═══
//
// Expanding is a disclosure. There is no control on this card that changes the
// related record or the selected event; the only way out to the record itself is
// a link.

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function RelatedRecord({
  /** What kind of thing this is — "Primary presentation", "Survey", "Escalation".
   *  TODO-COPY at the call sites. */
  kind,
  title,
  /** One line, always shown. This is the difference between a card and a chip. */
  summary,
  /** More of the same record, revealed in place. Absent → no expand control. */
  detail,
  href,
  className,
}: {
  kind: string;
  title: React.ReactNode;
  summary: string;
  detail?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <div
      className={cn(
        "rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3.5 py-3",
        className
      )}
    >
      <p className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
        {kind}
      </p>

      <div className="mt-1 flex min-w-0 items-baseline justify-between gap-3">
        <p className="min-w-0 text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
          {title}
        </p>
        {href && (
          <Link
            href={href}
            className={cn(
              "shrink-0 rounded-sm py-1 text-[13px] font-semibold text-[var(--text-primary)]",
              "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
              RING
            )}
          >
            {/* TODO-COPY */}
            Open<span aria-hidden> →</span>
          </Link>
        )}
      </div>

      <p className="mt-1 max-w-prose text-[13.5px] leading-[19px] text-[var(--text-secondary)]">
        {summary}
      </p>

      {detail && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={detailId}
            className={cn(
              "mt-2 inline-flex items-center gap-1 rounded-sm py-1.5 text-[13px] font-semibold text-[var(--text-primary)]",
              RING
            )}
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
              aria-hidden
            />
            {/* TODO-COPY */}
            {open ? "Show less" : "Show more"}
          </button>
          {/* MOUNTED ONLY WHEN OPEN. Unlike the document's clamp, this content is
              genuinely additional rather than a longer version of what is above,
              so keeping it in the DOM would put a second copy of the record into
              every screen reader's reading order. */}
          {open && (
            <div
              id={detailId}
              className="mt-2 border-t border-[color:var(--border-subtle)] pt-2.5 text-[13.5px] leading-[20px] text-[var(--text-secondary)]"
            >
              {detail}
            </div>
          )}
        </>
      )}
    </div>
  );
}
