"use client";

// A DOCUMENT, RENDERED AS AN ARTIFACT.
//
// ═══ THE DIFFERENCE THIS IS MAKING ═══
//
// The review document used to render as `<p>` prose under a label — the same
// treatment as every other value in the pane. So the one thing on screen that a
// human WROTE, that an auditor may one day read back, looked exactly like a
// timestamp.
//
// A document reads as a document because of its edges: a bordered surface, a
// title line, a date, and body text with real paragraph structure. None of that
// is decoration — each one is a cue that this content came from somewhere else
// and has its own boundaries.
//
// ═══ COLLAPSED, BECAUSE THE PANE IS NOT THE DOCUMENT ═══
//
// Four lines and an expand control. A full review is three or four paragraphs;
// dropping all of it into a pane whose job is orientation buries the metadata
// underneath it. The reader who wants the whole thing has two ways to get it —
// expand in place, or the footer link to the document proper.

import { useId, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function DocumentPreview({
  title,
  date,
  paragraphs,
  /** The full document. Absent while there is no route to one — the footer link
   *  is then omitted rather than rendered inert. */
  href,
  className,
}: {
  title: string;
  date?: string;
  paragraphs: string[];
  href?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <div
      className={cn(
        // ═══ A SURFACE STEP, NOT A SHADOW ═══
        // The brief allows either. A step reads as "a different kind of thing"
        // at any zoom and in both themes; an inner shadow at this size is one or
        // two pixels of gradient that disappears in dark mode and prints as
        // nothing. `--surface-s1` against the pane's card is the step this
        // product already uses for a recessed artifact.
        "overflow-hidden rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-s1)]",
        className
      )}
    >
      <div className="flex items-baseline gap-2 border-b border-[color:var(--border-subtle)] px-3.5 py-2.5">
        <FileText
          className="size-3.5 shrink-0 translate-y-px text-[var(--text-muted)]"
          aria-hidden
        />
        <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold leading-[19px] text-[var(--text-primary)]">
          {title}
        </p>
        {date && (
          <p className="shrink-0 text-[12px] leading-[16px] tabular-nums text-[var(--text-muted)]">
            {date}
          </p>
        )}
      </div>

      <div className="px-3.5 py-3">
        {/* ═══ CLAMPED, NOT TRUNCATED ═══
            `line-clamp-4` keeps every paragraph in the DOM, so expanding is a
            class change rather than a re-render with different content — and a
            screen reader gets the whole document either way, which a `slice`
            would have quietly prevented. */}
        <div
          id={bodyId}
          className={cn(
            "space-y-2.5 text-[13.5px] leading-[20px] text-[var(--text-secondary)]",
            // `max-w-prose` — measured elsewhere in this codebase: an unbounded
            // paragraph in a wide pane runs to ~100 characters against the 45–75
            // convention (gap row 334).
            "max-w-prose",
            !open && "line-clamp-4"
          )}
        >
          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* THE CONTROL IS ABSENT WHEN THERE IS NOTHING TO EXPAND. A single short
            paragraph does not clamp, and an "Expand" that changes nothing is
            worse than no control. */}
        {(paragraphs.length > 1 || (paragraphs[0]?.length ?? 0) > 220) && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={bodyId}
            className={cn(
              // 32px via padding rather than `touchTarget()`: this sits directly
              // under the body with content below it, and an upward bleed would
              // reach the paragraph (gap row 290).
              "mt-2 inline-flex items-center gap-1 rounded-sm py-1.5 text-[13px] font-semibold text-[var(--text-primary)]",
              RING
            )}
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
              aria-hidden
            />
            {/* TODO-COPY */}
            {open ? "Show less" : "Read the full document"}
          </button>
        )}
      </div>

      {href && (
        <div className="border-t border-[color:var(--border-subtle)] px-3.5 py-2.5">
          <a
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm py-1 text-[13px] font-semibold text-[var(--text-primary)]",
              "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
              RING
            )}
          >
            {/* TODO-COPY */}
            Open the document
            <span aria-hidden>→</span>
          </a>
        </div>
      )}
    </div>
  );
}
