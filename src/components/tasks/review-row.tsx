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
import { PROPOSAL_LABEL, proposalKindFor } from "@/lib/record/proposal-kind";
import { cn } from "@/lib/utils";

/** ═══ THE TWO COLUMN WIDTHS (§4.3) ═══
 *  MEASURED, not chosen: `Presentation` is sized by its widest CELL — a change
 *  pair `F33.0 → F33.1` is 130px — and `Review age` by its widest thing, which
 *  on a short-value column is the HEADER: "Review age" is 68px where the cells
 *  are 30px. At 56 the header wrapped to two lines and stopped reading as a
 *  header.
 *  FIRST TUNING WAS 168/96 AND IT COST THE MENTEE COLUMN: at a 499px list the
 *  type line truncated to "Renewal propo…" on every row. */
export const COL_PRESENTATION = 144;
export const COL_AGE = 72;

/** The age cell's own box includes its left separation, so the header and the
 *  cell can share one number. */
export const COL_AGE_BOX = COL_AGE + 24;

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
}: {
  /** The avatar's width, so "Mentee" starts where a mentee's NAME starts
   *  rather than where their disc does. Passed rather than assumed, because the
   *  disc is preset-sized on Care Reviews and fixed on Today. */
  disc: number;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      data-anno-ref="worklist-table-header"
      className={cn(
        "flex items-center gap-3 border-b border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-6 py-2",
        sticky && "sticky top-0 z-10",
        className
      )}
    >
      <span aria-hidden style={{ width: disc }} className="shrink-0" />
      <span className="min-w-0 flex-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
        {/* NEEDS-COPY-NICOLE */}
        Mentee
      </span>
      <span
        className="shrink-0 whitespace-nowrap text-[12px] leading-[16px] text-[var(--text-secondary)]"
        style={{ width: COL_PRESENTATION }}
      >
        {/* NEEDS-COPY-NICOLE */}
        Presentation
      </span>
      <span
        /* `whitespace-nowrap`: a column header that wraps makes the header row
           taller than its own type and stops looking like a header. */
        className="shrink-0 whitespace-nowrap pl-6 text-right text-[12px] leading-[16px] text-[var(--text-secondary)]"
        style={{ width: COL_AGE_BOX }}
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
export function ReviewPresentationCell({
  currentCode,
  recommendedCode,
}: {
  currentCode: string | null;
  recommendedCode: string;
}) {
  return (
    <span className="flex shrink-0 items-center" style={{ width: COL_PRESENTATION }}>
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
}: {
  at: number;
  now: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-end pl-6 text-right",
        className
      )}
      style={{ width: COL_AGE_BOX }}
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
}: {
  name: string;
  caption: string;
  captionClassName?: string;
  nameClassName?: string;
}) {
  return (
    <span className="min-w-0 flex-1">
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
export function proposalCaption(
  currentCode: string | null,
  recommendedCode: string
): string {
  return PROPOSAL_LABEL[proposalKindFor(currentCode, recommendedCode)];
}
