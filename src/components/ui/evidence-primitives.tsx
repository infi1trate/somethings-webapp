"use client";

// THE EVIDENCE-PANE PRIMITIVES — shared by the Tasks pane and the Activity pane.
//
// ═══ EXTRACTED, NOT REWRITTEN ═══
//
// Every one of these came out of `components/tasks/task-pane.tsx` unchanged.
// They were module-private there, which was correct while one surface used them
// and wrong the moment a second surface needed the same section rhythm: the
// alternative was a second `QuoteBlock` that starts identical and drifts, and a
// teen's own message rendered two subtly different ways on two staff surfaces is
// exactly the drift that matters least to a developer and most to a reader.
//
// The rationale comments are kept verbatim, including the gap-row citations,
// because they are the record of decisions the design system could not supply.
// Nothing about the rendered output changed — the Tasks pane imports these and
// renders the same DOM it did before.
//
// ═══ WHY `ui/` ═══
//
// Neither `components/tasks` nor `components/activity` can own a thing both
// import without one feature reaching into the other. `ui/` is where this
// codebase already keeps shared primitives.

import Link from "next/link";
import { MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The section eyebrow. Every block in an evidence pane is this label followed
 *  by its content — that repetition IS the section rhythm, so it is one constant
 *  rather than a class copied per block. */
export const PANE_LABEL =
  "text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]";

/** SYSTEM-ATTRIBUTION FOR AI CONTENT (§5).
 *
 *  THE DESIGN SYSTEM HAS NO CONVENTION FOR THIS — audited: bloom-design-system_1.md
 *  has no AI/system-attribution token, component or pattern. The interim is the one
 *  this codebase already grew for the same problem on the record surface (the flag
 *  card's moment summary): an eyebrow naming the provenance, a Sparkles glyph, and
 *  a tonal inset at a step inside the card's radius — a TINT AND A RADIUS, never a
 *  border, so it reads as recessed rather than as a second card.
 *  See design-system-gaps.md row 218. */
export function SystemBlock({
  label,
  children,
  link,
}: {
  label: string;
  children: React.ReactNode;
  link?: { href: string; label: string };
}) {
  return (
    <div className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3.5 py-3">
      <p className={cn("flex items-center gap-1.5", PANE_LABEL)}>
        <Sparkles className="size-3 shrink-0" aria-hidden />
        {label}
      </p>
      <p className="mt-1.5 text-[13.5px] leading-[20px] text-[var(--text-secondary)]">
        {children}
      </p>
      {link && (
        <Link
          href={link.href}
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-[var(--text-primary)]",
            "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
            RING
          )}
        >
          <MessageSquare className="size-3.5 shrink-0" aria-hidden />
          {link.label}
        </Link>
      )}
    </div>
  );
}

/** THE QUOTE BLOCK for flagged content (§5).
 *
 *  NO DESIGN-SYSTEM CONVENTION EXISTS for a quote block either — row 219. Interim:
 *  a `<blockquote>` with a left rule and the message set in a serif-neutral
 *  italic, so it reads as SOMEONE ELSE'S WORDS rather than as product copy. That
 *  distinction is the whole job here: this is the one place a teen's own message
 *  appears on a staff surface, and it must never be mistakable for the interface
 *  talking.
 *
 *  The left rule is the one place a left-edge bar is used on this surface — the
 *  record's no-left-bars rule is about severity accents on cards, and a quotation
 *  mark is not a severity signal. */
export function QuoteBlock({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-2 border-[color:var(--border-strong,var(--border-contour))] pl-3.5">
      <p className="text-[14px] italic leading-[22px] text-[var(--text-primary)]">
        {children}
      </p>
    </blockquote>
  );
}

/** A neutral value chip — categories, codes, statuses. */
export function PaneChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-[var(--surface-s2)] px-2.5 py-0.5 text-[13px] leading-[18px] text-[var(--text-primary)]">
      {children}
    </span>
  );
}

/** One labelled block, which is the whole section rhythm: eyebrow, then content.
 *  Added in the extraction rather than lifted — the Tasks pane repeats this shape
 *  by hand in every body, and a second surface repeating it again is how two
 *  panes end up with different vertical spacing for the same thing. */
export function PaneField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className={PANE_LABEL}>{label}</p>
      <div className="mt-1.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
        {children}
      </div>
    </div>
  );
}

/** A link styled as the panes' inline text action — "View chat context", "Open
 *  the full record". Same treatment in both panes so a reader learns it once. */
export function PaneLink({
  href,
  children,
  icon = true,
}: {
  href: string;
  children: React.ReactNode;
  icon?: boolean;
}) {
  return (
    <Link
      href={href}
      // SC 2.5.8 — `py-1.5` gives a 32px box around 20px text. Padding rather
      // than `touchTarget()`, per gap row 290: these sit at the end of a block,
      // so a pseudo-element bleeding upward would reach the sibling above.
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm py-1.5 text-[13px] font-semibold text-[var(--text-primary)]",
        "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
        RING
      )}
    >
      {icon && <MessageSquare className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </Link>
  );
}
