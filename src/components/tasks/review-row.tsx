"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ONE REVIEW ROW ANATOMY (Today rebuild, Phase K.1)
//
// ═══ WHAT THIS CLOSES ═══
//
// K.1 calls it the headline fix: the Today preview and the Care Reviews list
// were different components rendering the same object two ways. The preview
// showed name + status + age on one line; the destination showed avatar + name
// + status caption + presentation chips + review age under a column header.
// Nielsen #4 — the same object must be identified the same way everywhere.
//
// ═══ WHAT IS SHARED AND WHAT IS NOT, AND WHY THAT SPLIT ═══
//
// THE ANATOMY IS SHARED. Every field, its order, its type treatment, and the
// two column widths live here and nowhere else, so "identical on both surfaces"
// is true by construction rather than by two files agreeing.
//
// THE SHELL IS NOT, and K.1.5 is what says so: "the shared row navigates on
// both surfaces. Selection highlight is permitted on Care Reviews, where it
// drives the detail pane; on Today the row only navigates." Those are different
// interaction models and different elements — Care Reviews' row is a
// `role="treeitem"` inside a virtualized tree with roving tabindex, group
// expansion and a selection that drives a pane; Today's is a `Link` in a list.
// Hoisting the treeitem shell onto Today would drag the virtualizer contract
// and keyboard model onto a surface that has neither, to make two rows that
// already look identical share a wrapper nobody reads.
//
// So each surface supplies the shell and both render these cells inside it.
//
// ═══ THE COLUMN WIDTHS ARE CONSTANTS BECAUSE THEY HAVE TO MATCH A HEADER ═══
//
// A column that sized to its content would shift every time a row held one code
// instead of two, and the header would line up with none of them. Both widths
// were tuned against their widest ACTUAL content and the tuning is recorded
// where they are declared.

import { ProposalCodes } from "@/components/record/proposal-codes";
import { discFor } from "@/lib/tasks/avatar";
import { elapsedLabel } from "@/lib/ia/age";
import { proposalKindFor } from "@/lib/record/proposal-kind";
import { cycleLabelFor } from "@/lib/tasks/review-cycle";
import type { TaskType } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

/** ═══ THE TWO COLUMN WIDTHS (§4.3) ═══
 *  MEASURED, not chosen: `Presentation` is sized by its widest CELL — a change
 *  pair `F33.0 → F33.1` is 130px — and `Review age` by its widest thing, which
 *  on a short-value column is the HEADER: "Review age" is 68px where the cells
 *  are 30px. At 56 the header wrapped to two lines and stopped reading as a
 *  header.
 *  FIRST TUNING WAS 168/96 AND IT COST THE MENTEE COLUMN: at a 499px list the
 *  type line truncated to "Renewal propo…" on every row. */
/** ═══ RETIRED BY §6.1 — THE PRESENTATION COLUMN IS GONE ═══
 *  Codes leave the list entirely and live only in the detail pane (§6.3,
 *  answered). Kept because `ReviewPresentationCell` below is retired rather
 *  than deleted, and a width with no column is still the record of what that
 *  column measured. */
export const COL_PRESENTATION = 144;

/** ═══ THE REVIEW-CYCLE COLUMN (§6.1) ═══
 *  MEASURED against its widest content the way every other column here was:
 *  the header "Review" is 48px and the widest cell "90-day" is 46px, so 72
 *  leaves room for a sort indicator (§3) without the header wrapping — which
 *  is the defect `COL_AGE` hit at 56.
 *  MUCH NARROWER THAN THE 144 IT REPLACES, and that is what fixes §6.5: the
 *  mentee column takes the remainder, and 72px of fixed width leaves it 72
 *  more than the codes column did. */
export const COL_REVIEW = 72;
export const COL_AGE = 72;

/** The age cell's own box includes its left separation, so the header and the
 *  cell can share one number. */
export const COL_AGE_BOX = COL_AGE + 24;

/** ═══ THE MENTEE COLUMN CANNOT COLLAPSE (§6.5) ═══
 *  MEASURED at 1280 before this: the flexible mentee cell was **11px** wide and
 *  the NAME truncated — "Theo L." at 50px of content in an 11px box. §6.5
 *  describes the second line truncating "while the cell has room"; the cell had
 *  no room at all, because three fixed columns plus the detail pane had taken
 *  everything.
 *  A `min-width` MAKES THE ROW SCROLL-PROOF RATHER THAN COLLAPSE-PROOF: at a
 *  width where even this does not fit, the trailing columns shrink first
 *  because they are `shrink-0` on a flex line that has already run out — so the
 *  name survives and the cadence label is what gives. That is the right
 *  priority: a row without a name identifies nobody. */
export const COL_MENTEE_MIN = 168;

/** ═══ THE TASKS TABLE'S EQUAL COLUMNS (Phase L.4) ═══
 *  L.4 measures Today's table as three EQUAL 285px cells against the
 *  destination's wide-mentee / narrow-trailing layout, and L overrides K where
 *  they disagree.
 *  THIS IS A DIVERGENCE K.1 HAD JUST REMOVED, and it is reported rather than
 *  quietly absorbed: the FIELDS stay identical — same components, same order,
 *  same treatment — and the column WIDTHS now differ by instruction. One
 *  component, two geometries, both named here. */
export const COL_EQUAL = 285;

/** ═══ THE ROW'S TYPE TREATMENT ═══
 *  K.1.2 specifies `Label/Large-Bold/Web` — TWK Lausanne 700 16/20 — for the
 *  name, and `Label-Alt/Medium/Web` — Geist Mono Medium 12/16 — for the codes.
 *  NEITHER FACE SHIPS IN THIS BUILD. Only `TWKLausanne-400` and `Avantt-Bold`
 *  are loaded, and `--font-mono` is a system stack; K.3 reports both as
 *  blockers and this file does not paper over them. What it DOES guarantee is
 *  the thing K.1 is actually for — that both surfaces render the same
 *  treatment, whatever that treatment resolves to. When the faces land, they
 *  land here once. */
/* ═══ `font-display` — AVANTT, AND IT IS A MEASURED DECISION ═══
   K.1.2 asks for `Label/Large-Bold/Web` (TWK Lausanne 700). That face does not
   ship, and weight is therefore INERT on Lausanne — measured, it renders
   identically at 400, 500, 600 and 700, so `font-bold` on this line would be a
   declaration with no rendering behind it. arch-F settled the same question the
   same way: the two emphasis channels that actually work are Avantt and the
   mono stack at 700.
   SO THE NAME IS AVANTT, which is what the destination already rendered. Before
   this line Today rendered `lausanne` and Care Reviews rendered `avantt` — the
   one field of seven that differed between the two surfaces. */
const NAME_CLASS =
  "block truncate font-display text-[16px] leading-[20px] text-[var(--text-primary)]";
const CAPTION_CLASS = "block truncate text-[12px] leading-[16px]";

/** ═══ THE COLUMN HEADER (§4.3, K.1.3) ═══
 *
 *  `aria-hidden`, AND THAT IS NOT A SHORTCUT. Every row already states its own
 *  fields in its accessible name — a screen-reader user hears "Theo L., change
 *  proposed, 3d open" rather than being asked to hold three column headers in
 *  mind and map them onto cells. Announcing the header as well would be the
 *  same three nouns twice. This is a legend for the sighted reader, not a
 *  `columnheader` in a grid the keyboard navigates.
 *
 *  `sticky` IS THE CALLER'S CHOICE. On a scrolling forty-row list it is a
 *  header a reader forty rows down still needs; over a four-row preview there
 *  is nothing to scroll past, so Today renders it unstuck.
 */
export function ReviewRowHeader({
  disc,
  sticky = false,
  className,
  /** Per-surface column geometry — see `COL_EQUAL`. Defaults to the
   *  destination's measured widths so existing callers are unchanged. */
  presentationWidth = COL_PRESENTATION,
  ageWidth = COL_AGE_BOX,
  /** L.4's equal-thirds layout: the mentee cell is a fixed width too, rather
   *  than taking the remainder. */
  equalWidth,
}: {
  /** The avatar's width, so "Mentee" starts where a mentee's NAME starts
   *  rather than where their disc does. Passed rather than assumed, because the
   *  disc is preset-sized on Care Reviews and fixed on Today. */
  disc: number;
  sticky?: boolean;
  className?: string;
  presentationWidth?: number;
  ageWidth?: number;
  equalWidth?: number;
}) {
  return (
    <div
      aria-hidden
      data-anno-ref="worklist-table-header"
      className={cn(
        "flex items-center border-b border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-6 py-2",
        /* A caller passing `px-0` takes the inset into its cells instead — see
           L.4, where three equal columns have to fill the container exactly. */
        equalWidth == null && "gap-3",
        sticky && "sticky top-0 z-10",
        className
      )}
    >
      {/* ═══ IN EQUAL MODE THE AVATAR SPACER LIVES INSIDE THE COLUMN ═══
          Three 285s plus three `gap-3`s is 891, not 855 — measured, the age
          column ran past the container's right edge and its header rendered as
          "Review ag". So the equal layout carries no inter-column gap and each
          column owns its own inset; the default layout is unchanged. */}
      <span
        className="flex min-w-0 items-center gap-3 text-[12px] leading-[16px] text-[var(--text-secondary)]"
        style={equalWidth ? { width: equalWidth, flex: "none" } : { flex: "1 1 0%" }}
      >
        <span aria-hidden style={{ width: disc }} className="shrink-0" />
        {/* NEEDS-COPY-NICOLE */}
        <span className="min-w-0 truncate">Mentee</span>
      </span>
      <span
        className="shrink-0 whitespace-nowrap text-[12px] leading-[16px] text-[var(--text-secondary)]"
        style={{ width: presentationWidth }}
      >
        {/* ═══ `Cycle`, AND `Review` WAS THE FIRST TRY (§6.2) ═══
            §6.2 offered "`Review` or `Cycle`" and was confirmed without
            picking. `Review` shipped first and MEASURED BADLY: the header row
            read "Mentee · Review · Review age", two adjacent columns both
            starting with the same word, and the sort control (§3) would have
            offered "Review" and "Review age" as separate options.
            `Cycle` is the other confirmed option and collides with nothing.
            §6.2's naming split holds either way: this header is the taxonomy's
            name, the cell is a position in it ("30-day"), and the row's SECOND
            LINE carries the request nature — three different things that were
            all heading for the word "type". */}
        {/* NEEDS-COPY-NICOLE */}
        Cycle
      </span>
      <span
        /* `whitespace-nowrap`: a column header that wraps makes the header row
           taller than its own type and stops looking like a header. */
        className="shrink-0 whitespace-nowrap pl-6 text-right text-[12px] leading-[16px] text-[var(--text-secondary)]"
        style={{ width: ageWidth }}
      >
        {/* ═══ "Review age", NOT "Due date" (§2, answered) ═══
            The Figma's column reads `Due date` over a value of `15 days` — a
            date header over a duration. Deadlines were removed from this
            destination and `CARE_REVIEW_SLA` is retired, so the column is named
            for what the value actually is. */}
        {/* NEEDS-COPY-NICOLE */}
        Review age
      </span>
    </div>
  );
}

/** The identity disc. One implementation, so the initial and the colour
 *  derivation cannot differ between a preview row and a queue row.
 *
 *  `discFor` RETURNS CSS COLOURS, NOT CLASSES — a `color-mix()` ground against
 *  `--surface-card` — so they go through `style` rather than `className`. The
 *  initial is taken from the display name here rather than inside `discFor`,
 *  which is a colour derivation and does not know about names. */
export function ReviewDisc({
  teenId,
  name,
  size,
}: {
  teenId: string;
  name: string;
  size: number;
}) {
  const disc = discFor(teenId);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
      style={{
        backgroundColor: disc.bg,
        color: disc.fg,
        width: size,
        height: size,
      }}
    >
      {name.charAt(0)}
    </span>
  );
}

/** ═══ THE PRESENTATION CELL (§4.3, §4.4) ═══
 *  Codes and nothing else. The review's KIND is the caption under the name —
 *  §4.4's decision, because a lozenge PAIR used to mean "a change was proposed"
 *  and a single lozenge meant it did not, which made the count a second carrier
 *  of a fact the text already stated.
 *
 *  I.4 REVERSED ITS OWN PROHIBITION AND THIS IS WHERE THAT LANDS. An earlier
 *  revision removed codes from the Today preview on privacy grounds; K.1
 *  overrules it on consistency grounds — the same object identified the same
 *  way everywhere, and the codes are one click away regardless. Because both
 *  surfaces render this cell, the reversal was a one-line change at the call
 *  site rather than a second code renderer.
 */
/** ═══ THE REVIEW-CYCLE CELL (§6.1) ═══
 *  The cadence position — "30-day" or "90-day" — derived from the task type
 *  rather than stored. See `review-cycle.ts` on why these two values and not
 *  §6.1's even series.
 *  MONO AND TABULAR, matching the age column: both are figures, and a column of
 *  figures that does not share a face reads as two columns. */
export function ReviewCycleCell({
  taskType,
  width = COL_REVIEW,
}: {
  taskType: TaskType;
  width?: number;
}) {
  const label = cycleLabelFor(taskType);
  return (
    <span className="flex shrink-0 items-center" style={{ width }}>
      {label && (
        <span
          className="truncate text-[12px] leading-[16px] tabular-nums text-[var(--text-secondary)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

/** ═══ RETIRED BY §6.3 — CODES LEAVE BOTH LISTS ═══
 *  "Codes leave the list entirely. They are only shown in the detail now"
 *  (answered). Unmounted rather than deleted, and the reason it is worth
 *  keeping is the reversal it records: two passes ago the lozenges were moved
 *  OUT of the mentee column and INTO a column of their own, so that they lined
 *  up under a header. That work is not wrong — it is superseded by the codes
 *  not being on the list at all.
 *  IT LEAVES TODAY'S TABLE TOO, and that is a consequence of K.1 rather than a
 *  separate decision: the two surfaces share this component precisely so the
 *  same object cannot be identified two ways. A Today preview showing codes
 *  that its own destination no longer shows is that defect. Reported. */
export function ReviewPresentationCell({
  currentCode,
  recommendedCode,
  width = COL_PRESENTATION,
}: {
  currentCode: string | null;
  recommendedCode: string;
  width?: number;
}) {
  return (
    <span className="flex shrink-0 items-center" style={{ width }}>
      <ProposalCodes
        currentCode={currentCode}
        recommendedCode={recommendedCode}
        compact
      />
    </span>
  );
}

/** ═══ THE AGE CELL ═══
 *  Mono and tabular so the column reads as a column and a figure does not
 *  jitter as its digits change width. Right-aligned against the same box width
 *  the header uses.
 *  ONE AGE EXPRESSION — `elapsedLabel` from `lib/ia/age`, which is the whole of
 *  K.2: the card, the rationale, this cell and the destination's own header all
 *  read it, so the same item cannot report two ages on two surfaces.
 */
export function ReviewAgeCell({
  at,
  now,
  className,
  width = COL_AGE_BOX,
}: {
  at: number;
  now: number;
  className?: string;
  width?: number;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-end pl-6 text-right",
        className
      )}
      style={{ width }}
    >
      <span
        className="text-[13px] leading-[18px] tabular-nums text-[var(--text-secondary)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {elapsedLabel(at, now)}
      </span>
    </span>
  );
}

/** The mentee column — name on line 1, the review's kind on line 2.
 *
 *  `--text-secondary` ON THE CAPTION, NOT `--text-muted` (gap row 294, and
 *  K.5.1 one pass later). Muted measures 4.01:1 on `--surface-s2` — under the
 *  4.5 floor for 12px text — where secondary is 5.78:1 there and 7.62:1 on
 *  white. K.5 makes the same substitution system-wide on this surface.
 */
export function ReviewIdentityCell({
  name,
  caption,
  captionClassName,
  nameClassName,
  width,
}: {
  name: string;
  caption: string;
  captionClassName?: string;
  nameClassName?: string;
  /** L.4's equal-thirds geometry. Omitted, the cell takes the remainder, which
   *  is what the destination's table does. */
  width?: number;
}) {
  return (
    <span
      className="min-w-0"
      style={
        width
          ? { width, flex: "none" }
          : { flex: "1 1 0%", minWidth: COL_MENTEE_MIN }
      }
    >
      <span className={cn(NAME_CLASS, nameClassName)}>{name}</span>
      <span
        className={cn(
          CAPTION_CLASS,
          "mt-0.5 text-[var(--text-secondary)]",
          captionClassName
        )}
      >
        {caption}
      </span>
    </span>
  );
}

/** The caption a billing review shows: the KIND of proposal, in words. Shared
 *  so the preview and the queue cannot name the same proposal differently. */
/** ═══ TWO VALUES, NOT THREE (§6.4, answered) ═══
 *
 *  `proposalKindFor` derives THREE kinds — `assign` (no code yet), `change`
 *  (code differs) and `renewal` (code confirmed unchanged). Brandon named two
 *  labels: "Presentation Review" and "Presentation Change".
 *
 *  SO THE COLLAPSE IS THE ONLY ONE THAT WORKS: a change is a change, and
 *  everything else — a first assignment and a confirmation — is a review. That
 *  is also the honest reading, because what distinguishes `change` is that the
 *  code MOVES, and that is the fact a supervisor is being asked to look at.
 *  `renewal` IS NOT DROPPED, which §6.4 warned against. It keeps a label; it
 *  just stops having a private one. The kind is still derived and still
 *  distinguishable in the pane.
 *  `PROPOSAL_LABEL`'s three strings stay — the detail pane reads them, and the
 *  list's caption is not the pane's chip. */
export function proposalCaption(
  currentCode: string | null,
  recommendedCode: string
): string {
  /* NEEDS-COPY-NICOLE, both. */
  return proposalKindFor(currentCode, recommendedCode) === "change"
    ? "Presentation Change"
    : "Presentation Review";
}
