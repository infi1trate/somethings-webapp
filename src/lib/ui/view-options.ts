// ═══════════════════════════════════════════════════════════════════════════
// TWO AXES, ONE CONTROL (Layout Pass §5)
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
// So density is a GEOMETRY, declared here, and every consumer derives from it:
// the row's inline height, the skeleton's, the virtualizer's window arithmetic,
// and the min-height the list reserves when it is nearly empty.
//
// ═══ COMPACT IS TODAY'S ROW, EXACTLY ═══
//
// §5 asks for "approximately today's row". It is today's row to the pixel — 56px,
// 14/20 over 12/16, a 28px disc — because that is what makes the density switch
// reversible: a supervisor who tries Comfortable and dislikes it gets back the
// surface they already know rather than a third thing. It also means the
// virtualizer's measured invariants still hold at one of the two settings, which
// is the setting to fall back to if the taller row ever misbehaves.
//
// ═══ WHY EVERY NUMBER HERE IS A MULTIPLE OF FOUR ═══
//
// Bloom carries NO spacing scale — measured: `settings-tokens.css` defines four
// component pads (`--surface-pad-x/y`, `--panel-pad-x/y`, `--card-pad`) and
// nothing general. So the only real scale available is Tailwind's 4px step, and
// the row heights are built up from ramp type stops plus 4px multiples rather
// than chosen and then justified:
//
//   comfortable  16 pad + 24 (line 1) + 8 gap + 16 (line 2) + 16 pad = 80
//   compact       9 pad + 20 (line 1) + 2 gap + 16 (line 2) +  9 pad = 56
//
// The comfortable row lands inside §3's 72–80 target at its top, and it is the
// only value in that range that is reachable from two ramp stops and 4px
// multiples without an off-scale pad.

/** Row scale. `comfortable` is §3's row; `compact` is the row as it shipped. */
export type Density = "comfortable" | "compact";

/** Whether the detail pane is on screen. `full` drops it (§5). */
export type LayoutMode = "split" | "full";

export interface ViewOptions {
  density: Density;
  layout: LayoutMode;
}

/** §5 names both defaults. Stated once so no surface can default differently. */
export const VIEW_OPTIONS_DEFAULT: ViewOptions = {
  density: "comfortable",
  layout: "split",
};

/** The geometry a density fixes. Read by the row, the skeleton AND the
 *  virtualizer — see the module note on why this cannot be a class. */
export interface RowGeometry {
  /** EXACT row height in px. The virtualizer's invariant. */
  height: number;
  /** The identity disc's edge, px. */
  disc: number;
  /** Line 1 and line 2, as ramp pairs. Every value is a Bloom type step: the
   *  ramp is 32/40 · 24/32 · 16/24 · 14/20 · 12/16 and these are four of them. */
  primary: { size: number; leading: number };
  secondary: { size: number; leading: number };
  /** Space between the two lines. §3 asks the secondary line to read as
   *  metadata rather than a second title, and asks for "more line-height" to do
   *  it. This spends that space on the GAP instead of on the leading, because
   *  12/16 is the bottom of Bloom's ramp and 12/18 would be an invented pair —
   *  the separation is what §3 is after and a gap delivers it on-scale. */
  lineGap: number;
}

export const ROW_GEOMETRY: Record<Density, RowGeometry> = {
  comfortable: {
    height: 80,
    disc: 36,
    primary: { size: 16, leading: 24 },
    secondary: { size: 12, leading: 16 },
    lineGap: 8,
  },
  compact: {
    height: 56,
    disc: 28,
    primary: { size: 14, leading: 20 },
    secondary: { size: 12, leading: 16 },
    lineGap: 2,
  },
};

/** ═══ THE LIST'S FLOOR, IN ROWS RATHER THAN PIXELS ═══
 *
 *  §2: "The list container sizes to content with a min-height, not a fixed tall
 *  box. Two rows in a 1000px panel reads as a rendering fault." Three rows is
 *  the floor because it is the smallest number that still reads as a LIST —
 *  at one or two a reader cannot tell a short queue from a clipped one — and
 *  expressing it in rows rather than pixels keeps the floor honest when the
 *  density changes. */
export const LIST_MIN_ROWS = 3;

export function listMinHeight(density: Density): number {
  return ROW_GEOMETRY[density].height * LIST_MIN_ROWS;
}

/** The destinations that carry the control. A KEY PER DESTINATION, because §5
 *  asks for the preference to be per-destination: the two surfaces hold
 *  different work at different volumes and a supervisor who wants 123 flags
 *  dense does not necessarily want sixteen billing reviews dense. */
export type ViewOptionsScope = "risk-flags" | "care-reviews";
