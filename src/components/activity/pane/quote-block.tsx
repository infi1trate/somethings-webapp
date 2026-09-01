"use client";

// A QUOTED PASSAGE WITH ITS ATTRIBUTION.
//
// ═══ WHY NOT `ui/evidence-primitives`' QuoteBlock ═══
//
// That one exists and is used by the TASKS pane. It renders a left rule and
// italic body and nothing else — it has no attribution line, because on the
// Tasks pane the thing quoted is always a teen's message and the surrounding
// block says so.
//
// Here the same shape carries three different things — reviewer notes, recorded
// discussion, and flagged messages — and WHO said it is the difference between
// them. A quote without attribution on this surface is ambiguous in a way that
// matters: an unattributed sentence could be the reviewer's judgement or the
// teen's own words, and those are not interchangeable.
//
// The Tasks one is left alone rather than extended: it is a shared primitive,
// this brief is the Activity pane, and adding an optional prop to a component
// two surfaces render is how one surface's requirement quietly becomes both.

import { cn } from "@/lib/utils";

export function QuoteBlock({
  children,
  /** Who said or wrote it, and when. Both optional — a flagged message from a
   *  teen the pane has already named needs no second attribution. */
  attribution,
  meta,
  className,
}: {
  children: React.ReactNode;
  attribution?: string;
  meta?: string;
  className?: string;
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      <blockquote className="border-l-2 border-[color:var(--border-contour)] pl-3.5">
        {/* NOT ITALIC. The Tasks pane italicises because it is always quoting a
            teen and the slant marks "someone else's words". Here the content is
            as often a clinician's own note, and italicising a paragraph of
            clinical prose costs legibility for a distinction the attribution
            line already makes. */}
        <p className="text-[14px] leading-[21px] text-[var(--text-primary)]">
          {children}
        </p>
      </blockquote>
      {(attribution || meta) && (
        <figcaption className="mt-1.5 pl-3.5 text-[12.5px] leading-[17px] text-[var(--text-muted)]">
          {attribution}
          {attribution && meta && <span aria-hidden> · </span>}
          {meta}
        </figcaption>
      )}
    </figure>
  );
}
