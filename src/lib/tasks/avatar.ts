// ═══ THE IDENTITY DISC — a hue that means WHO, and never WHAT ═══
//
// ═══ THE RULE THIS EXISTS UNDER, STATED FIRST BECAUSE IT IS THE POINT ═══
//
// COLOUR HERE CARRIES IDENTITY AND NOTHING ELSE. It does not encode tier, breach,
// status, or how many flags the teen is carrying. That is not a stylistic
// preference — this surface's whole alarm budget depends on it. A worklist where
// the discs vary by hue AND the tier varies by hue has two colour languages in one
// row, and a reader learns neither. Every state on this row is carried by a word:
// "Overdue", "2 flags", "3 clinical · 2 routine", the band header above it.
//
// If you are about to make this function take a tier, a breach flag, or a count —
// that is the change this comment exists to stop.
//
// ═══ WHY LITERALS AND NOT TOKENS ═══
//
// Bloom has no per-identity palette, and every high-visibility hue in it already
// carries meaning: amber is the risk-flag band, clay is escalation, sage is
// committed-and-confirmed, rose is the alarm. Reusing any of them for identity
// would make a disc look like a status.
//
// `lib/anno/identity.ts` hit this exact wall and settled it — "the Bloom token set
// has no per-identity palette… these are therefore INTERIM literals, deliberately
// not `--anno-*` variables, so nothing downstream can mistake them for a
// sanctioned ramp". This follows that precedent rather than inventing a second
// answer, and it is logged for the same reason.
//
// ═══ WHY THESE PARTICULAR VALUES ═══
//
// PALE GROUNDS, DARK SAME-HUE INK. The anno chips are high-chroma because they are
// a 8px dot beside a name. A 28px disc on a list row is far more area, and at that
// size a saturated fill competes with the breach chip two inches to its right.
// These sit at roughly the lightness of the existing `--band-*-bg` tints, so the
// discs read as a quiet column of identity and the only saturated thing on the
// surface stays the escalation treatment.
//
// THE INITIAL IS THE REAL CARRIER. Hue is a redundant second channel — two teens
// whose discs collide are still told apart by the letter, the name beside it, and
// the mentor line under that (SC 1.4.1).

/** ═══ ONE HUE PER IDENTITY, COMPOSED WITH WHATEVER SURFACE IT LANDS ON ═══
 *
 *  Eight hues, and the disc is a 22% mix of one of them into the card. Not a
 *  fixed pair of colours — that is the version this replaced, and it failed in
 *  dark mode in a way that mattered.
 *
 *  MEASURED, the fixed-pair version: grounds at 1.14–1.18:1 against the LIGHT
 *  card (quiet, as intended) and 11.30–11.71:1 against the DARK one. The discs
 *  are inline styles from literals, so they do not theme — on a dark row eight
 *  pale circles became the brightest thing on the surface, competing for
 *  attention with the one saturated treatment this page reserves for an active
 *  escalation. On a safeguarding surface that is the more serious of the two
 *  failures available.
 *
 *  `color-mix` with `--surface-card` themes for free and lands quiet in both:
 *  1.43–1.48:1 in light, 1.05–1.10:1 in dark. The INK is `--text-primary`
 *  rather than a hue, which makes the initial 11.3–11.7:1 in both modes with no
 *  per-hue tuning to get wrong.
 *
 *  ═══ WHAT THIS COSTS, MEASURED AND NOT PAPERED OVER ═══
 *
 *  In dark mode the hue is close to imperceptible — 1.05:1 against the card is a
 *  tint you have to look for. Identity falls back to the initial, which was
 *  always the primary carrier (SC 1.4.1: two teens whose discs collide are still
 *  told apart by the letter, the name beside it and the mentor line under that).
 *  A border at a deeper mix was tried and does not rescue it: these eight values
 *  are DARK inks chosen for light grounds, so any mix of them into a dark card is
 *  still dark — 1.16–1.31:1 against the card at 55%.
 *
 *  The real fix is a ramp with its own light and dark steps, which is gap row
 *  364 and which `lib/anno/identity.ts` needs too. Until that exists, quiet in
 *  both modes beats loud in one.
 *
 *  ═══ THE RULE THIS EXISTS UNDER, RESTATED BECAUSE IT IS THE POINT ═══
 *
 *  COLOUR HERE CARRIES IDENTITY AND NOTHING ELSE. Not tier, not breach, not
 *  status, not how many flags the teen is carrying. A worklist where the discs
 *  vary by hue AND the tier varies by hue has two colour languages in one row and
 *  a reader learns neither. Every state on this row is carried by a word:
 *  "Overdue", "2 flags", "3 clinical · 2 routine", the band header above it.
 *
 *  If you are about to make this function take a tier, a breach flag or a count —
 *  that is the change this comment exists to stop. */
const HUES = [
  "#4a3585", // violet
  "#2b3d80", // indigo
  "#1f5450", // teal
  "#7a4318", // ochre
  "#6d2a67", // mulberry
  "#26522c", // moss
  "#7d3327", // brick
  "#2f4a66", // slate
] as const;

/** How much hue reaches the ground. 22% is where the tint is legible in light
 *  without the disc becoming an object in its own right; see the note above for
 *  what it costs in dark. */
const GROUND_MIX = "22%";

export interface AvatarDisc {
  /** A `color-mix()` expression, not a colour — it resolves against whatever
   *  `--surface-card` is in the active theme. */
  bg: string;
  fg: string;
}

/** A tiny deterministic hash — the same shape `conversation.ts` and
 *  `care-demo.ts` already use, so a fixture is stable per id and different ids
 *  land in different places. Not cryptographic and does not need to be. */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** STABLE FOR THE LIFE OF THE ID. A teen's disc must not change when their flag
 *  count does, when one is resolved, or between renders — a colour that moves is
 *  a colour that looks like it means something. */
export function discFor(id: string): AvatarDisc {
  const hue = HUES[hash(id) % HUES.length];
  return {
    bg: `color-mix(in oklab, ${hue} ${GROUND_MIX}, var(--surface-card))`,
    fg: "var(--text-primary)",
  };
}

export const DISC_COUNT = HUES.length;
export { HUES as IDENTITY_HUES };
