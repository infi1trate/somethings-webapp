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
 *  rather than a class copied per block.
 *
 *  ═══ SENTENCE CASE, NOT ALL CAPS ═══
 *
 *  These were `uppercase` with 0.04em tracking. Three problems, in order of how
 *  much they cost:
 *
 *   · A pane with five all-caps eyebrows reads as five SHOUTS between the
 *     paragraphs a supervisor is actually there to read. Emphasis applied to
 *     every label is emphasis applied to none of them, and the labels are the
 *     least important text on the pane.
 *   · Some screen readers spell out short all-caps strings letter by letter.
 *     "TYPE" becoming "T-Y-P-E" is a small thing fifty times a shift.
 *   · All caps removes ascenders and descenders, which is most of what makes a
 *     word recognisable at a glance — the exact scanning this label supports.
 *
 *  ═══ AND IT USES THE TOKEN THAT ALREADY EXISTED ═══
 *
 *  CORRECTED. The first version of this change hardcoded
 *  `text-[12px] font-semibold leading-[16px]` and logged a gap row claiming the
 *  design system had no semantic field-label token. Both halves were wrong:
 *  `--type-field-label` has been in settings-tokens.css all along at exactly
 *  this stop, five files already use it, and the WEIGHT was an active mistake —
 *  only TWKLausanne-400 is shipped, so `font-semibold` on Lausanne is a
 *  browser-SYNTHESISED faux bold. The token's own comment says so, and says why
 *  it resolves to 400. See design-system-gaps.md rows 330 and 354.
 *
 *  So the label is the token, paired with `--text-muted` — which is the pattern
 *  the record's own field labels and the care timeline's table headers already
 *  use. Label and value are separated by COLOUR and SIZE, not by a weight that
 *  does not exist. */
export const PANE_LABEL =
  "[font:var(--type-field-label)] [letter-spacing:var(--type-field-label-tracking)] text-[var(--text-muted)]";

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
  /** ═══ BADGE, NOT HEADER (Part 4) ═══
   *
   *  An "AI SUMMARY" eyebrow announces the machinery before the sentence, and on
   *  the billing pane that is backwards: the summary is the first thing a
   *  supervisor reads and the provenance is a qualification on it, not a section
   *  they navigated to. As a badge the words come first and the attribution rides
   *  alongside them — still stated, still glyphed, no longer the headline.
   *
   *  Kept as a variant rather than a second component: it is the same block with
   *  the same tint, the same radius and the same attribution rule, and two
   *  components would drift on all three. */
  attribution = "header",
}: {
  label: string;
  children: React.ReactNode;
  link?: { href: string; label: string };
  attribution?: "header" | "badge";
}) {
  const badge = attribution === "badge";
  return (
    <div className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3.5 py-3">
      {badge ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-[12px] font-medium leading-[16px] text-[var(--text-secondary)]">
          <Sparkles className="size-3 shrink-0" aria-hidden />
          {label}
        </span>
      ) : (
        <p className={cn("flex items-center gap-1.5", PANE_LABEL)}>
          <Sparkles className="size-3 shrink-0" aria-hidden />
          {label}
        </p>
      )}
      {/* ═══ MEASURE, NOT JUST WIDTH ═══
          Measured on `/app/tasks` at 1440px: the AI rationale ran to 100
          characters per line against the 45–75 convention (66 ideal). The pane is
          60% of a wide viewport and the paragraph had nothing holding it back.
          `max-w-prose` is 65ch, which lands this at roughly 70 — inside the range
          and short of the point where a reader loses the line return. */}
      <p className="mt-1.5 max-w-prose text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {children}
      </p>
      {link && (
        <Link
          href={link.href}
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-sm text-[14px] font-semibold text-[var(--text-primary)]",
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

/** ═══ THE SQUARE SCORE LOZENGE — EXTRACTED FROM THE CARE TIMELINE ═══
 *
 *  Two cells, a hairline between them: the number, then the band it falls in.
 *  Square-cornered at 4px rather than a pill, which is what separates it from the
 *  round status chips beside it — a lozenge is a READING, a pill is a STATE.
 *
 *  Moved here rather than re-made in the Tasks pane. The billing review shows the
 *  same instrument, the same number and the same band the record's History shows,
 *  and a supervisor who reads "14 · Moderate" on one surface and a differently
 *  shaped "14 (moderate)" on the other has to work out whether they mean the same
 *  thing. They do, so they look the same.
 *
 *  THE BAND TINTS CARRY THE SAME MEANING THEY DO ON THE RECORD — sage settled,
 *  amber attention, rose acute — and moderately-severe and severe deliberately
 *  share rose, one step apart on a five-step ladder with the LABEL separating
 *  them. Which is why the label is never dropped to save space: the pale fills
 *  are within 1.25:1 of each other and are told apart by hue, so a lozenge
 *  showing only a tint and a number would be unreadable to a share of readers.
 *  Ratios measured in settings-tokens.css: sage 6.10:1, amber 7.24:1, rose
 *  5.93:1. Gap row 312. */
const BAND_TINT: Record<string, string> = {
  minimal: "bg-[var(--band-sage-bg)] text-[var(--band-sage-fg)]",
  mild: "bg-[var(--band-sage-bg)] text-[var(--band-sage-fg)]",
  moderate: "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]",
  "moderately severe": "bg-[var(--band-rose-bg)] text-[var(--band-rose-fg)]",
  severe: "bg-[var(--band-rose-bg)] text-[var(--band-rose-fg)]",
};

/** TODO-COPY — sentence case, so the lozenge reads as a label rather than a
 *  shout: "Moderately severe", not "MODERATELY SEVERE". */
export function bandLabel(band: string): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export function ScoreLozenge({
  value,
  band,
  className,
}: {
  value: number | string;
  band: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-stretch overflow-hidden rounded-[4px] text-[12px] font-medium leading-[16px]",
        BAND_TINT[band] ?? "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
        className
      )}
    >
      <span className="px-1.5 tabular-nums">{value}</span>
      {/* The divider is a border, not a character: a "|" would be read aloud by
          some screen readers and would inherit the text colour rather than the
          tint's. */}
      <span className="border-l border-current/25 px-1.5">{bandLabel(band)}</span>
    </span>
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
      <p className="text-[14px] italic leading-[20px] text-[var(--text-primary)]">
        {children}
      </p>
    </blockquote>
  );
}

/** A neutral value chip — categories, codes, statuses. */
export function PaneChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-[var(--surface-s2)] px-2.5 py-0.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
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
        "inline-flex items-center gap-1.5 rounded-sm py-1.5 text-[14px] font-semibold text-[var(--text-primary)]",
        "underline decoration-[color:var(--border-contour)] underline-offset-2 hover:decoration-[color:var(--text-primary)]",
        RING
      )}
    >
      {icon && <MessageSquare className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </Link>
  );
}
