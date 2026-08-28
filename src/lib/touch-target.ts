// ONE DEFINITION OF "EXTEND THIS CONTROL TO A 44px TOUCH TARGET".
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY A CLASS HELPER AND NOT A <TouchTarget> WRAPPER — the call was between the
// two and this is why it went this way:
//
//   1. THE ::after MUST BELONG TO THE INTERACTIVE ELEMENT. A wrapper's
//      pseudo-element enlarges the WRAPPER, so a tap in the extended area lands
//      on a div with no handler, no focus and no role. Making the wrapper the
//      button instead is a different, larger refactor of every consumer.
//   2. A WRAPPER BREAKS `asChild`. `MentorStatusMenu`'s trigger is
//      `<DropdownMenuTrigger asChild><button/></DropdownMenuTrigger>`, which
//      requires exactly one child that forwards refs and props. Inserting a node
//      there breaks Radix's contract.
//   3. BOTH EXISTING CONSUMERS ALREADY DO IT AS CLASSES. `ChatAction` and
//      `SegmentedControl` apply the pattern inline and comment on it; a helper
//      they can both call is a refactor, a wrapper would be a rewrite.
//
// ═══ WHY A KEYED MAP AND NOT A COMPUTED VALUE ═══
//
// Tailwind scans source for literal class strings. A template literal like
// `after:-inset-y-[${n}px]` produces a class that is never generated and silently
// does nothing — the exact failure mode this file exists to prevent. Every value
// below is a static literal.
//
// ═══ VERTICAL ONLY, DELIBERATELY ═══
//
// `after:inset-x-0` — the extension grows the target UP AND DOWN and never
// sideways. Adjacent controls (a ± stepper, an icon cluster) sit close together
// horizontally, and two ::after boxes that grew into each other would overlap:
// a tap in the overlap belongs to both, which is worse than a small target
// because it is also unpredictable. Horizontal room is a SPACING problem, solved
// with the gap between the controls, not with this.
//
// SC 2.5.8 (Target Size Minimum) requires 24×24. This aims at the HIG/Material
// figure of 44/48, which is the bar `03-DEFINITION-OF-DONE.md` sets.
// ═══════════════════════════════════════════════════════════════════════════

/** The target every extension aims at, in px. HIG 44pt / Material 48dp. */
export const TOUCH_TARGET_MIN = 44;

/** Base classes: a positioned host and an invisible, non-blocking overlay.
 *
 *  `content-['']` is what makes the pseudo-element exist at all; without it the
 *  insets apply to nothing. No background — the extension is felt, never seen. */
const TOUCH_BASE = "relative after:absolute after:inset-x-0 after:content-['']";

/** Vertical bleed per visual height, each one reaching exactly 44px.
 *
 *  Keyed by the control's RENDERED height so the arithmetic is checkable at the
 *  call site: 28 + (2 × 8) = 44. A key that is not here is a control whose height
 *  nobody has measured — add it with its sum rather than rounding to a neighbour. */
export const TOUCH_EXTEND = {
  /** 20 + 2×12 = 44. THE TABLE SORT HEADER, measured on `/app/mentees` at 1280:
   *  a 20px button inside a 45px `<th>` with 12px above and 13px below, and the
   *  first body row starting exactly at the cell's bottom edge. So the 12px bleed
   *  lands inside the header cell with a pixel to spare and cannot reach the
   *  row's overlay link — which matters, because a header target that grew into
   *  the first row would make its top 12px sort instead of open. */
  20: "after:-inset-y-3",
  /** 24 + 2×10 = 44 */
  24: "after:-inset-y-2.5",
  /** 28 + 2×8 = 44 */
  28: "after:-inset-y-2",
  /** 32 + 2×6 = 44 */
  32: "after:-inset-y-1.5",
  /** 36 + 2×4 = 44 */
  36: "after:-inset-y-1",
  /** 40 + 2×2 = 44 */
  40: "after:-inset-y-0.5",
} as const;

export type TouchVisualHeight = keyof typeof TOUCH_EXTEND;

/** Extend a control of `visualHeight` px to a 44px touch target without changing
 *  how it looks.
 *
 *  Returns classes to put ON THE INTERACTIVE ELEMENT — see the note above on why
 *  it cannot be a wrapper. */
export function touchTarget(visualHeight: TouchVisualHeight): string {
  return `${TOUCH_BASE} ${TOUCH_EXTEND[visualHeight]}`;
}
