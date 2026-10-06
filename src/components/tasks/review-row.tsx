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
import { ChevronUp, Repeat2 } from "lucide-react";
import {
  SORT_LABEL,
  SORT_MEANING,
  nextSort,
  type CareSort,
  type CareSortColumn,
} from "@/lib/ui/care-sort";

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

/** ═══ AND IT MAY NOT SHRINK PAST ITS OWN LABEL ═══
 *  The cadence cell yields before the mentee cell does (§6.5's priority), and
 *  with nothing stopping it, MEASURED at 1280 it yielded to **0px** — header
 *  label and value both gone, and the §3 sort control still in the tab order as
 *  a 0×44 target. That is an SC 2.5.8 failure and a control a reader cannot
 *  see, which is worse than the truncation the floor costs.
 *  48 WAS MEASURED AGAINST 12px TYPE, AND §1 MOVED THE TYPE. At the time:
 *  "90-day" was 43.3px in the mono stack at 12px and "Cycle" 32px, so 48
 *  rendered either whole on the 4px step that is this product's only real
 *  spacing scale.
 *  AT 14px "90-day" MEASURES 50.6px, so the old floor is 2.6px narrower than
 *  the label it exists to protect — the cadence cell would have hit its floor
 *  and truncated its own value, which is the failure this constant prevents
 *  rather than one it may cause. 56 is the next 4px step and leaves 5.4px,
 *  matching the 4.7px of headroom 48 gave at 12px.
 *  RE-DERIVED, NOT NUDGED: the whole point of the note above is that the number
 *  is a consequence of the type, so a type change has to come back here. It is
 *  the second constant in this file that had to — see `COL_MENTEE_MIN`.
 *  THE COST IS STATED: at 1280 with the pane open the deficit that used to land
 *  here now lands on the mentee caption, which truncates at 107px against the
 *  110px "Presentation Review" needs. §6.5 objected to that truncation — its
 *  objection was to a caption truncating "while the cell has room", and at this
 *  width the row has none: four columns do not fit a 367px card. The list/pane
 *  split is the only thing that fixes it and that is not this section's call. */
export const COL_REVIEW_MIN = 56;
export const COL_AGE = 72;

/** The age cell's own box includes its left separation, so the header and the
 *  cell can share one number. */
export const COL_AGE_BOX = COL_AGE + 24;

/** ═══ THE REVIEW DATE COLUMN IS SIZED TO ITS LONGEST VALUE ═══
 *  The value is the DATE ONLY now — `Oct 6`, or `Sep 29, 2025` outside the
 *  current year. The year-bearing form is the widest: 12 characters of 14px
 *  mono, MEASURED at 101.2px in the cell's own font (every 12-character variant
 *  the same, which is what tabular mono is for). 104 is the next 4px step.
 *  ═══ AND THE TWO WORKAROUNDS THE WIDE COLUMN NEEDED ARE GONE ═══
 *  With the time in the value the column was 196px, which at 1280 left the
 *  mentee column 48px — so Cycle was hidden on Closed below 1440 and the
 *  gutter cut to 16. Without the time the column is 92px narrower, Cycle shows
 *  at every width again, and the gutter is the age column's 24. */
export const COL_CLOSED = 104;
export const COL_CLOSED_BOX = COL_CLOSED + 24;

/** ═══ THE MENTEE COLUMN'S SHARE OF THE ROW (§6.5, corrected in §3) ═══
 *  MEASURED at 1280 before §6.5: the flexible mentee cell was **11px** wide and
 *  the NAME truncated — "Theo L." at 50px of content in an 11px box. §6.5
 *  describes the second line truncating "while the cell has room"; the cell had
 *  no room at all, because three fixed columns plus the detail pane had taken
 *  everything.
 *
 *  ═══ IT IS A FLEX BASIS NOW, AND IT WAS A `min-width` ═══
 *
 *  §6.5's note claimed a `min-width` made the row "scroll-proof rather than
 *  collapse-proof", because "the trailing columns shrink first — they are
 *  `shrink-0` on a flex line that has already run out".
 *  THAT IS BACKWARDS AND IT SHIPPED. `shrink-0` is what stops a column
 *  shrinking, so nothing yielded: the line overflowed its `overflow-hidden`
 *  card by 102px at 1280 and the REVIEW AGE column was cut to 1 visible pixel
 *  — found while verifying §3, which had just put a sort control on it.
 *  The number is unchanged and its job is not: as a basis it is what the cell
 *  gets whenever the row has the room, and the yielding order is now carried by
 *  shrink factors (see `ReviewIdentityCell` and `ReviewCycleCell`). The stated
 *  priority is the same one — a row without a name identifies nobody — and it
 *  is arithmetic instead of an assertion.
 *
 *  ═══ 168 -> 144 (row layout §1), AND THE BASIS IS THE SMALLER HALF OF IT ═══
 *
 *  "Mentee column too wide, pushing Cycle and Review age right."
 *  MEASURED AT 1600: this basis of 168 rendered a **316px** cell, because it
 *  was the row's only growing child and took the whole remainder. So the
 *  complaint is about GROWTH, not about the basis, and moving the basis alone
 *  would have been a change nobody could see at any width where the row has
 *  spare room. `ReviewCycleCell` now takes an equal share of the remainder and
 *  that is what does the work; this number does the rest.
 *  144 IS STILL ABOVE THE CAPTION IT HAS TO HOLD — "Presentation review"
 *  measures 106.5px at 12px in the text face, leaving 37.5px, so the cell
 *  renders its widest caption whole before any of the growth arrives.
 *  AND IT IS THE CADENCE COLUMN'S OWN BASIS DOUBLED, which is not a
 *  coincidence worth relying on but is worth noticing: 144 / 72 / 96 as bases,
 *  against 168 / 72 / 96, is a more even starting relationship before a single
 *  pixel of spare width is handed out. */
export const COL_MENTEE_MIN = 144;

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
  /** ═══ §3 — THE SORT CONTROLS ═══
   *  Omitted, the header is the legend it always was. Passed, each named
   *  column becomes a button and the header stops being `aria-hidden` — see
   *  the note on that below. */
  sort,
  /** Per-surface column geometry — see `COL_EQUAL`. Defaults to the
   *  destination's measured widths so existing callers are unchanged. */
  presentationWidth = COL_PRESENTATION,
  ageWidth = COL_AGE_BOX,
  /** WHICH TRAILING COLUMN — `age` on Open, `closed` on Closed. */
  trailing = "age",
  /** The row's leading marker slot, so the header's first column starts at the
   *  same x the row's does. 0 on a surface that draws no marker — Today's
   *  preview table — which is why it defaults to nothing rather than to 8. */
  markerWidth = 0,
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
  trailing?: "age" | "closed";
  markerWidth?: number;
  equalWidth?: number;
  sort?: {
    value: CareSort | null;
    onToggle: (column: CareSortColumn) => void;
  };
}) {
  return (
    <div
      /* ═══ `aria-hidden` ONLY WHILE IT IS A LEGEND (§3) ═══
         It was unconditionally hidden, for a good reason that is still true of
         the unsorted case: every row states its own fields in its accessible
         name — "Theo L., change proposed, 3d open" — so announcing three
         column headers as well is the same three nouns twice, and this is a
         legend for the sighted reader rather than a `columnheader` in a grid
         the keyboard navigates.
         THAT REASONING DOES NOT SURVIVE THE COLUMNS BECOMING CONTROLS. A
         hidden subtree cannot hold a button: the control would be unreachable
         and its state unannounceable, which is a worse failure than a
         redundant noun. So the header is hidden when it is a legend and
         exposed when it is a toolbar.
         NOT `role="columnheader"` EITHER WAY. The list is a `role="tree"`, not
         a grid, so there is no row for a columnheader to belong to and
         `aria-sort` has nothing to sit on. The buttons carry their state in
         their own accessible names instead — see `SortButton`. */
      aria-hidden={sort ? undefined : true}
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
      {/* ═══ THE DEFAULT LAYOUT MIRRORS THE ROW'S FLEX CHAIN, ITEM FOR ITEM ═══
          MEASURED at 1280: the header's mentee cell was one cell holding the
          spacers AND the label at `flex: 1 1 0%`, while the row's mentee cell
          is `flex: 1 1 168px` — two different bases sharing one deficit, so
          they landed at different widths and the header read "Men…" over
          untruncated names. Two flex lines only track each other if their
          items track each other, so the spacers are siblings here exactly as
          they are in the row, and the label cell carries the row's own basis.
          EQUAL MODE KEEPS THE OLD NESTING — Today's table is three exact
          thirds with no inter-column gap, so its spacers have to live inside
          the column; see the note below it. */}
      {equalWidth == null && markerWidth > 0 && (
        <span aria-hidden style={{ width: markerWidth }} className="shrink-0" />
      )}
      {equalWidth == null && (
        <span aria-hidden style={{ width: disc }} className="shrink-0" />
      )}
      <span
        className="flex min-w-0 items-center gap-3 text-[12px] leading-[16px] text-[var(--text-secondary)]"
        style={
          equalWidth
            ? { width: equalWidth, flex: "none" }
            : { flex: `1 1 ${COL_MENTEE_MIN}px` }
        }
      >
        {/* ═══ THE MARKER SLOT, RESERVED HERE TOO ═══ (equal mode only)
            MEASURED: "Mentee" sat 16px LEFT of the names it heads. §5.2 gave
            the row an 8px leading slot for the unviewed dot — always present,
            so a dot appearing cannot shift the row — and the header never grew
            its counterpart, so the two flex chains started one item apart.
            IT WAS SURVIVABLE WHILE THE HEADER WAS A LEGEND and it is not now:
            §3 makes this cell a CONTROL over a column, and a control that is
            visibly not above its column is pointing at the wrong thing.
            `markerWidth` RATHER THAN A HARD 8: the slot is the row's, so the
            number belongs to the caller that draws the row — a header that
            hard-coded it would drift the day the marker resizes. */}
        {equalWidth != null && markerWidth > 0 && (
          <span aria-hidden style={{ width: markerWidth }} className="shrink-0" />
        )}
        {equalWidth != null && (
          <span aria-hidden style={{ width: disc }} className="shrink-0" />
        )}
        {/* `-ml-1` CANCELS THE BUTTON'S OWN PADDING. The 44px target needs
            horizontal padding and the label needs to start exactly where a
            name starts; the negative margin buys both, which is the same trick
            the row's disclosure spacer uses. */}
        <SortButton column="mentee" sort={sort} className="-ml-1 min-w-0" />
      </span>
      <span
        /* THE SAME `grow 6 basis` THE ROW'S CADENCE CELL CARRIES, for the same
           reason the mentee cell above mirrors the row's: a header that does
           not yield on the click its column does is a header that slides off
           its column at narrow widths.
           ═══ AND THE GROW HALF MIRRORS TOO (row layout §1) ═══
           The row's cadence cell takes a share of the spare width now, so a
           header pinned at grow 0 would stop at its 72px basis while its column
           grew past it — the same mismatch this cell's own note records from
           1280, just at the other end of the range. `equalWidth == null` IS the
           list layout, which is exactly where the row passes `grow={1}`; Today's
           equal thirds keep 0 on both sides. */
        className="flex min-w-0 items-center whitespace-nowrap text-[12px] leading-[16px] text-[var(--text-secondary)]"
        style={{
          flex: `${equalWidth == null ? 1 : 0} 6 ${presentationWidth}px`,
          minWidth: COL_REVIEW_MIN,
        }}
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
        <SortButton column="cycle" sort={sort} className="-ml-1" />
      </span>
      <span
        /* `whitespace-nowrap`: a column header that wraps makes the header row
           taller than its own type and stops looking like a header.
           ═══ `justify-end` RATHER THAN `pl-6 text-right` (§3) ═══
           MEASURED: with the chevron on, the control needs 78px and the padded
           box left it 72, so it overflowed to the RIGHT — "Review age" ended
           10px past the column whose values it heads. The 24px of separation
           `COL_AGE_BOX` carries is still there; it is just slack the control
           can borrow instead of a wall it overflows. */
        className="flex shrink-0 items-center justify-end whitespace-nowrap text-[12px] leading-[16px] text-[var(--text-secondary)]"
        style={{ width: ageWidth }}
      >
        {/* ═══ "Review age", NOT "Due date" (§2, answered) ═══
            The Figma's column reads `Due date` over a value of `15 days` — a
            date header over a duration. Deadlines were removed from this
            destination and `CARE_REVIEW_SLA` is retired, so the column is named
            for what the value actually is. */}
        {/* ═══ THE INDICATOR LEADS IN A RIGHT-ALIGNED COLUMN ═══
            With the chevron after the label, activating this sort pushed
            "Review age" 16px off the column's right edge — the header moved
            away from the figures it heads, on the click that was supposed to
            organise them. Leading, the label stays flush in both states and
            the chevron hangs into the 24px gutter the cell already carries.
            NOT A SECOND IDIOM: it is the same control with its parts in
            reading order for a column that reads right-to-left. */}
        <SortButton column={trailing} sort={sort} className="-mr-1 ml-auto" indicatorFirst />
      </span>
    </div>
  );
}

/** The focus ring, stated here rather than imported: `list-toolbar.tsx` has an
 *  identical private one, and a shared UI primitive importing from a sibling
 *  component to get a focus style is the wrong direction of dependency. */
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ ONE SORT CONTROL (§3) ═══
 *
 *  ═══ A BUTTON, NOT A `columnheader` WITH `aria-sort` ═══
 *
 *  `aria-sort` is a property of a `columnheader` inside a `grid` or `table`.
 *  This list is a `role="tree"` — chosen because a treeitem supports
 *  `aria-expanded` for the coalesced groups, which `option` does not — so
 *  there is no row and no columnheader for `aria-sort` to sit on. Asserting it
 *  anyway would be a lie to a screen reader about the structure it is in.
 *  SO THE STATE IS IN THE ACCESSIBLE NAME, which is always true and needs no
 *  structure: "Mentee, sorted A to Z" / "Review age, sort by oldest first".
 *  The name states the CURRENT state when active and the NEXT ACTION when not,
 *  which is what a reader needs from a control they are deciding whether to
 *  press.
 *
 *  ═══ THE INDICATOR IS NOT COLOUR ═══
 *
 *  A chevron, and it is present only on the active column — presence plus
 *  direction, neither of which is hue. The active label also takes primary ink,
 *  which is a third channel and not the carrier.
 *
 *  44px, LIKE EVERY OTHER CONTROL ON THIS SURFACE. A 16px header label is not a
 *  target; the button's box is what gets pressed, and it is padded to the bar
 *  the toolbar already holds.
 */
function SortButton({
  column,
  sort,
  className,
  indicatorFirst = false,
}: {
  column: CareSortColumn;
  sort?: { value: CareSort | null; onToggle: (c: CareSortColumn) => void };
  className?: string;
  /** Put the chevron before the label — for a right-aligned column, so the
   *  label does not move when the sort turns on. */
  indicatorFirst?: boolean;
}) {
  /* NOT SORTABLE — the header is a legend and this is just its text. */
  if (!sort) {
    return (
      <span className={cn("min-w-0 truncate", className)}>{SORT_LABEL[column]}</span>
    );
  }
  const active = sort.value?.column === column ? sort.value : null;
  const next = nextSort(sort.value, column);
  const indicator = active ? (
    <ChevronUp
      aria-hidden
      className={cn(
        "size-3 shrink-0 transition-transform",
        active.dir === "desc" && "rotate-180"
      )}
    />
  ) : null;
  return (
    <button
      type="button"
      data-anno-ref={`sort:${column}`}
      data-sort-active={active ? active.dir : undefined}
      onClick={() => sort.onToggle(column)}
      /* NEEDS-COPY-NICOLE. Current state when active, next action when not. */
      aria-label={
        active
          ? `${SORT_LABEL[column]}, sorted ${SORT_MEANING[column][active.dir]}`
          : `${SORT_LABEL[column]}, sort by ${SORT_MEANING[column].asc}`
      }
      title={
        next
          ? `Sort by ${SORT_MEANING[column][next.dir]}`
          : "Back to the default order"
      }
      className={cn(
        "-my-2 inline-flex min-h-11 min-w-0 items-center gap-1 rounded-md px-1 py-2 transition-colors",
        active ? "text-[var(--text-primary)]" : "hover:text-[var(--text-primary)]",
        RING,
        className
      )}
    >
      {indicatorFirst && indicator}
      <span className="min-w-0 truncate">{SORT_LABEL[column]}</span>
      {!indicatorFirst && indicator}
    </button>
  );
}

/** ═══ THE WAY BACK TO DEFAULT ORDER (§3) ═══
 *
 *  §3 requires that a way back to the default ordering "exist and be OBVIOUS".
 *  `nextSort`'s third click is the first half and not the second: a reader who
 *  has sorted by mentee and wants the queue's own order back has no reason to
 *  guess that pressing the same header twice more will give it to them, and
 *  nothing on screen says so. So the reset is a control with a name.
 *
 *  ═══ IT IS ALSO THE VISIBLE OVERRIDE INDICATOR ═══
 *
 *  §3's other requirement — "an explicit, visible override … a state the reader
 *  turned on and can see is on". The chevron in the header says WHICH column;
 *  it does not say that the list is no longer in the order the surface chose.
 *  This sentence does, in the same words the control's accessible name uses.
 *
 *  ═══ WHY THE WRAPPER RENDERS EVEN WITH NO SORT ═══
 *
 *  An `aria-live` region has to be in the DOM BEFORE its content changes, or
 *  the first change is the region appearing and nothing is announced. So the
 *  region is permanent and its contents are conditional — the div collapses to
 *  zero height when empty, which is why the spacing is on the inner element.
 *  ONE STRING, SEEN AND HEARD. The announcement is the visible sentence rather
 *  than a parallel one composed for screen readers, which is the failure mode
 *  the page's other live region already had to be corrected for.
 */
export function CareSortNotice({
  value,
  onReset,
}: {
  value: CareSort | null;
  onReset: () => void;
}) {
  return (
    <div role="status" data-anno-ref="sort-notice">
      {value && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* NEEDS-COPY-NICOLE. Lower-cased column name: it is mid-sentence
              here and a capital reads as the header being quoted. */}
          <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
            {`Sorted by ${SORT_LABEL[value.column].toLowerCase()} · ${
              SORT_MEANING[value.column][value.dir]
            }`}
          </p>
          <button
            type="button"
            data-anno-ref="sort-reset"
            onClick={onReset}
            /* NEEDS-COPY-NICOLE. It names the destination state, not the
               action on the current one: "Clear sort" leaves a reader asking
               what an unsorted list looks like, and this list is never
               unsorted — it returns to the order the surface chose. */
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3 text-[13px] leading-[18px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]",
              RING
            )}
          >
            Default order
          </button>
        </div>
      )}
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
  grow = 0,
  className,
}: {
  taskType: TaskType;
  className?: string;
  width?: number;
  /** ═══ WHETHER THIS COLUMN TAKES A SHARE OF THE ROW'S SPARE WIDTH ═══
   *  0 BY DEFAULT, WHICH KEEPS TODAY'S TABLE EXACTLY AS IT WAS: that table is
   *  three exact thirds (`COL_EQUAL`), and a column that grew would absorb any
   *  remainder and stop the thirds being equal.
   *  THE LIST PASSES 1 — see the note at the `flex` below. */
  grow?: number;
}) {
  const label = cycleLabelFor(taskType);
  return (
    /* ═══ THIS IS THE COLUMN THAT GIVES (§6.5's PRIORITY, MADE REAL) ═══
       §6.5's note says the trailing columns "shrink first because they are
       `shrink-0`". MEASURED, THAT IS BACKWARDS: `shrink-0` is what stops them,
       so nothing shrank and the row overflowed its card instead — 102px at
       1280 with the pane open, inside an `overflow-hidden` list, which clipped
       the REVIEW AGE column to zero visible pixels.
       So the cell shrinks now, with `min-w-0` to let `truncate` engage, and the
       priority §6.5 states is the one that happens: the name survives and the
       cadence label is what gives.
       IT DOES NOT CLOSE THE GAP ON ITS OWN — 72px of give against a 102px
       deficit — which is why the mentee cell's hard floor became a basis in
       the same pass. Together they leave nothing clipped. */
    <span
      className={cn("flex min-w-0 items-center", className)}
      /* `shrink: 6` AGAINST THE MENTEE CELL'S 1. The deficit is shared out by
         shrink factor × basis, so 6×72 against 1×168 means this column has
         given everything it has before the caption loses its first pixel —
         which is the order §6.5 asked for, now as an arithmetic rather than an
         assertion. */
      /* ═══ AND NOW IT TAKES A SHARE OF THE SPARE WIDTH TOO (row layout §1) ═══
         "Mentee column too wide, pushing Cycle and Review age right — narrower,
         so the three columns sit in a more even relationship."
         MEASURED, NARROWING THE MENTEE BASIS ALONE DOES NOTHING AT WIDTH. That
         cell was the only `flex-grow: 1` child in the row, so it absorbed the
         ENTIRE remainder: at 1600 a 168px basis rendered **316px** while this
         column sat at its 72px basis and the age at its fixed 96. Reducing 168
         to 144 would have moved the grown width from 316 to 340 and changed
         nothing a reader can see.
         SO THE EVENNESS IS A GROW SHARE, NOT A BASIS. With 1 here the remainder
         splits equally between the two flexible columns, which is what "a more
         even relationship" means arithmetically.
         THE SHRINK LADDER IS UNTOUCHED: 6 against the mentee cell's 1, so
         6×basis still means this column gives everything before the caption
         loses a pixel. Growth and shrink are separate axes and only one moved. */
      style={{ flex: `${grow} 6 ${width}px`, minWidth: COL_REVIEW_MIN }}
    >
      {label && (
        <span
          /* ═══ 14/20, UP ONE RAMP STEP (row layout §1) ═══
             "They are column data, not metadata, and currently read as
             subordinate to the mentee name when they are peers." 12/16 is the
             BOTTOM of Bloom's ramp — the step reserved for captions — and this
             is a sorted column's value.
             THE AGE COLUMN MOVED WITH IT, to 14/20 from an off-ramp 13px. Both
             had to move together or the two figure columns would read at two
             sizes, which is the thing this cell's own note calls "two columns"
             where there is one row of figures. */
          className="truncate text-[14px] leading-[20px] tabular-nums text-[var(--text-secondary)]"
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
        /* ═══ 14/20, WITH THE CYCLE CELL (row layout §1) ═══
           §1 moves "Cycle and Review age" together, and this is Today's age
           cell — the list builds its own, in `worklist.tsx`.
           IT HAD TO MOVE OR TODAY WOULD READ AT TWO SIZES. `ReviewCycleCell` is
           shared by both surfaces, so raising it to 14/20 raised Today's cadence
           column too; leaving this at 13/18 would have put two figure columns of
           one row at two sizes, which is the "reads as two columns" failure the
           cycle cell's own note exists to prevent. Found by inventorying the
           inline sizes on these three files rather than by looking at the
           screen — 13px is invisible next to 14px and would have shipped.
           13/18 WAS NEVER A RAMP PAIR EITHER. Bloom's ramp is 32/40 · 24/32 ·
           16/24 · 14/20 · 12/16. */
        className="text-[14px] leading-[20px] tabular-nums text-[var(--text-secondary)]"
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
  captionIcon = false,
  captionClassName,
  nameClassName,
  width,
}: {
  name: string;
  caption: string;
  /** §5's renew glyph, on `Change requested` only — see `proposalCaptionIcon`. */
  captionIcon?: boolean;
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
          : /* ═══ A BASIS AND A SHRINK ORDER, NOT A HARD FLOOR ═══
               It was `flex: "1 1 0%"` with `minWidth: COL_MENTEE_MIN`, and the
               hard floor is what MEASURED as a clipped row: at 1280 with the
               pane open the list card is 367px, the row wanted 428, and a
               floor the line cannot honour makes the line OVERFLOW rather than
               yield — into an `overflow-hidden` card, which cut the review-age
               column to 1 visible pixel while §3 put a sort control on it.
               THE SAME PRIORITY, EXPRESSED AS RATIOS INSTEAD. The width is now
               a flex BASIS, so it is what this cell gets whenever the row has
               the room, and the cadence column gives six times as readily (see
               `ReviewCycleCell`) so it is still what yields first. What
               changed is the end of the ladder: when even the cadence column
               has given everything, the caption truncates instead of the
               trailing column disappearing off the card.
               MEASURED AFTER: 0px of clipping at 1280, 1440 and 1600, and the
               age value fully visible at all three.
               §6.5's DEFECT DOES NOT COME BACK — the 11px mentee cell came from
               a `0%` basis against three `shrink-0` neighbours, which gave the
               cell nothing to start from. The basis is what fixes that, and it
               is the part of §6.5 that was doing the work. */
            { flex: `1 1 ${COL_MENTEE_MIN}px` }
      }
    >
      <span className={cn(NAME_CLASS, nameClassName)}>{name}</span>
      <span
        className={cn(
          CAPTION_CLASS,
          "mt-0.5 flex items-center gap-1 text-[var(--text-secondary)]",
          captionClassName
        )}
      >
        {captionIcon && <Repeat2 aria-hidden className="size-4 shrink-0" />}
        <span className="min-w-0 truncate">{caption}</span>
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
  /* ═══ THE TWO STRINGS, CORRECTED (parity pack §5) ═══
     NEEDS-COPY-NICOLE, both.
     WAS "Presentation Change" → `Change requested`. §5: "not a spec'd value".
     It was this pack's own collapse of `PROPOSAL_LABEL.change` and it invented
     a noun phrase; `Change requested` is the spec'd one, and it also reads as
     something a person DID rather than a category the row belongs to.
     WAS "Presentation Review" → `Presentation review`. Sentence case, which is
     what the rest of this UI uses — the title-cased pair were the only two
     captions in the product shouting. */
  return proposalKindFor(currentCode, recommendedCode) === "change"
    ? "Change requested"
    : "Presentation review";
}

/** ═══ THE RENEW GLYPH RIDES WITH `Change requested` (§5) ═══
 *  §5 asks for the caption "with the renew icon", and the reference table
 *  carries exactly that: a 16×16 `repeat-2` beside the change caption in
 *  `4345:6188`. Lucide's `Repeat2` is that glyph.
 *  IT IS NOT THE CARRIER OF ANYTHING. The caption states the kind in words, so
 *  the glyph is `aria-hidden` and a reader who cannot resolve it loses nothing
 *  — which is the same split every other glyph on this row uses.
 *  RETURNS NULL RATHER THAN A BLANK SLOT: a reserved 16px on every row would
 *  indent the two captions differently for no reason, and unlike §5.2's
 *  unviewed dot nothing here appears or disappears as a reader works, so there
 *  is no twitch to prevent. */
export function proposalCaptionIcon(
  currentCode: string | null,
  recommendedCode: string
): boolean {
  return proposalKindFor(currentCode, recommendedCode) === "change";
}
