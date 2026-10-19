// ═══════════════════════════════════════════════════════════════════════════
// ONE AXIS, THREE PRESETS (Refinement §4)
//
// ═══ WHAT THIS REPLACES, AND WHY THE MATRIX WENT ═══
//
// The prior pass shipped two axes: density (comfortable/compact) and layout
// (split/full width). §4 removes the layout axis — the pane is the point of the
// workflow on both surfaces, so a mode that hides it never earned itself — and
// explicitly forbids replacing it with a Card/List axis, because Comfortable+Card
// and Comfortable+List would differ only marginally and the product would carry a
// four-cell matrix with duplicate cells and four times the states to verify.
//
// So spacing and separation become ONE ordered dimension. Three steps, each
// distinguishable at a glance (Hick's), which is the property a two-axis matrix
// could not have.
//
// THE TRADEOFF, STATED because §4 states it: a supervisor who wants compact
// spacing AND card separation cannot have it. That combination has no clear use
// case, and the cost of the matrix is real.
//
// ═══ WHY THE GEOMETRY IS A CONSTANT AND NOT A CLASS ═══
//
// `worklist.tsx` virtualizes, and its module note is explicit about why the row
// height is a CONTRACT rather than an outcome: every offset is computed from it,
// so a row that renders one pixel taller than the constant puts the window one
// pixel out per row and forty rows down the list the keyboard selects the wrong
// thing. Making the row taller therefore cannot be a Tailwind class — the number
// has to move with it, and both surfaces have to read the same number or the two
// lists disagree about what a row is.
//
// `Cards` adds a gap BETWEEN rows, which the virtualizer cannot express as a
// margin — a margin is not in the offset arithmetic. So the gap is carried
// INSIDE the row box: `pitch` is what the virtualizer steps by, `height` is what
// the card draws, and the difference is the gutter. One number changes, the
// arithmetic does not.
//
// ═══ WHY EVERY NUMBER HERE IS A MULTIPLE OF FOUR ═══
//
// Bloom carries NO spacing scale — measured: `settings-tokens.css` defines four
// component pads (`--surface-pad-x/y`, `--panel-pad-x/y`, `--card-pad`) and
// nothing general. So the only real scale available is Tailwind's 4px step, and
// the row heights are built up from ramp type stops plus 4px multiples rather
// than chosen and then justified:
//
//   cards        16 pad + 24 (line 1) + 8 gap + 16 (line 2) + 16 pad = 80 card
//                                                          + 12 gutter = 92 pitch
//   comfortable  16 pad + 24 (line 1) + 8 gap + 16 (line 2) + 16 pad = 80
//   compact       9 pad + 20 (line 1) + 2 gap + 16 (line 2) +  9 pad = 56
//
// `Cards` keeps Comfortable's INTERNAL box and spends its extra height on the
// gutter, because a detached card that is also internally roomier would be two
// changes wearing one name — and the thing that distinguishes it is separation.

/** The single view axis. Ordered loosest → tightest, which is the order the
 *  control renders and the order a reader reasons about. */
export type ViewPreset = "cards" | "comfortable" | "compact";

export const VIEW_PRESETS: ViewPreset[] = ["cards", "comfortable", "compact"];

export interface ViewOptions {
  preset: ViewPreset;
}

/** §4 names the default. Stated once so no surface can default differently. */
export const VIEW_OPTIONS_DEFAULT: ViewOptions = { preset: "comfortable" };

/** The geometry a preset fixes. Read by the row, the skeleton AND the
 *  virtualizer — see the module note on why this cannot be a class. */
export interface RowGeometry {
  /** EXACT step between one row's top and the next. The virtualizer's
   *  invariant, and the only number its arithmetic uses. */
  pitch: number;
  /** What the row's own box draws. Equal to `pitch` unless the preset puts a
   *  gutter between rows, in which case it is shorter by exactly that gutter. */
  height: number;
  /** Detached panel per row — own border and fill — rather than grouped rows
   *  inside one container. Only `cards` sets it. */
  detached: boolean;
  /** The identity disc's edge, px. */
  disc: number;
  /** Line 1 and line 2, as ramp pairs. Every value is a Bloom type step: the
   *  ramp is 32/40 · 24/32 · 16/24 · 14/20 · 12/16 and these are three of them. */
  primary: { size: number; leading: number };
  secondary: { size: number; leading: number };
  /** ═══ SPACE BETWEEN THE TWO LINES — AND THE ROW LAYOUT PASS REVERSED IT ═══
   *
   *  IT WAS 8, AND THE REASON IS WORTH KEEPING because it is what makes the
   *  reversal a decision rather than a drift: §3 of an earlier pack asked the
   *  secondary line to read as metadata rather than a second title, and asked
   *  for "more line-height" to do it. 12/16 is the bottom of Bloom's ramp and
   *  12/18 would be an invented pair, so the space was spent on the GAP
   *  instead. That was the right way to spend it; there was just too much of it.
   *
   *  THE ROW LAYOUT PASS ASKS FOR THE OPPOSITE OUTCOME: "the two lines should
   *  read as one lockup, not as two stacked items". Both cannot be true, and
   *  the newer reading wins because the OPTICAL gap is bigger than the declared
   *  one and the old number was set against the declared one.
   *
   *  MEASURED, the ink-to-ink distance is the margin PLUS both half-leadings:
   *  the 16/24 name leaves (24−16)/2 = 4px under its glyphs and the 12/16
   *  caption leaves (16−12)/2 = 2px over its own, so an 8px margin renders as
   *  **14px** of apparent space — wider than the caption's whole line box, and
   *  two line boxes that far apart are two items.
   *
   *  AT 2 IT IS 8px OPTICAL, which is under the caption's 16px box and reads as
   *  one lockup. 2 IS ALSO ALREADY IN THIS TABLE — `compact` has shipped it
   *  since the presets landed — so this is the two-line presets adopting a
   *  value the third preset already proved, not a new number.
   *
   *  STILL A FIELD, THOUGH ALL THREE PRESETS NOW AGREE ON IT. Hoisting it to a
   *  constant would save one line and cost the ability to tune one preset's
   *  lockup, which is exactly what a density preset is for. */
  lineGap: number;
  /** The row's horizontal padding, inside the pill/card track. */
  padX: number;
}

const TWO_LINE = {
  primary: { size: 16, leading: 24 },
  secondary: { size: 12, leading: 16 },
  /* 8 -> 2. See `lineGap` on the interface for the arithmetic and for the
     earlier decision this reverses. SHARED WITH RISK FLAGS, deliberately:
     `event-list.tsx` reads the same geometry, its rows are the same
     name-over-caption lockup, and a per-surface gap is how one product comes
     to stack two lines two ways. */
  lineGap: 2,
} as const;

export const ROW_GEOMETRY: Record<ViewPreset, RowGeometry> = {
  cards: {
    pitch: 92,
    height: 80,
    detached: true,
    disc: 36,
    padX: 16,
    ...TWO_LINE,
  },
  comfortable: {
    pitch: 80,
    height: 80,
    detached: false,
    disc: 36,
    padX: 16,
    ...TWO_LINE,
  },
  compact: {
    pitch: 56,
    height: 56,
    detached: false,
    disc: 28,
    padX: 16,
    primary: { size: 14, leading: 20 },
    secondary: { size: 12, leading: 16 },
    lineGap: 2,
  },
};

/** ═══ THE LIST'S FLOOR, IN ROWS RATHER THAN PIXELS ═══
 *
 *  The prior pack: "The list container sizes to content with a min-height, not
 *  a fixed tall box. Two rows in a 1000px panel reads as a rendering fault."
 *  Three rows is the floor because it is the smallest number that still reads
 *  as a LIST — at one or two a reader cannot tell a short queue from a clipped
 *  one — and expressing it in rows rather than pixels keeps the floor honest
 *  when the preset changes. */
export const LIST_MIN_ROWS = 3;

export function listMinHeight(preset: ViewPreset): number {
  return ROW_GEOMETRY[preset].pitch * LIST_MIN_ROWS;
}

/** The destinations that carry the control. A KEY PER DESTINATION, because §4
 *  asks for the preference to be per-destination: the two surfaces hold
 *  different work at different volumes and a supervisor who wants 123 flags
 *  compact does not necessarily want nineteen billing reviews compact. */
export type ViewOptionsScope = "risk-flags" | "care-reviews";
