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

/** Ink and ground, per identity. Eight pairs: enough that a collision is
 *  uncommon in a twelve-row viewport, few enough that they stay distinguishable
 *  from each other.
 *
 *  ALL RATIOS MEASURED, NOT ESTIMATED — the first draft of this table carried
 *  guessed figures and every one of them was wrong by 0.1–0.4.
 *
 *    ink / ground    6.99 – 8.57   (AA needs 4.5 for the initial at 12px)
 *    ground / card   1.14 – 1.18
 *    ground / s2     1.12 – 1.16   — the SELECTED-ROW ground
 *    ink / s2        6.02 – 7.65   — the initial when the disc vanishes into it
 *
 *  THE `ground / s2` COLUMN IS WHY THESE ARE LIGHTER THAN THEY FIRST WERE. The
 *  draft sat at the lightness of the `--band-*-bg` tints, which measured 1.00:1
 *  against `--surface-s2` — so on a SELECTED row the disc's edge disappeared
 *  entirely and the initial floated in the row fill. Not an accessibility
 *  failure (the letter stayed legible, and the disc is `aria-hidden`), but a
 *  shape that exists on eleven rows and not on the twelfth reads as a rendering
 *  bug. Raising the grounds keeps the disc a disc in both states. */
const DISCS = [
  { bg: "#efeafb", fg: "#4a3585" }, // violet   — 8.34:1
  { bg: "#e8ecfd", fg: "#2b3d80" }, // indigo   — 8.57:1
  { bg: "#e2f2f0", fg: "#1f5450" }, // teal     — 7.45:1
  { bg: "#fdeee0", fg: "#7a4318" }, // ochre    — 6.99:1
  { bg: "#f9ebf7", fg: "#6d2a67" }, // mulberry — 8.38:1
  { bg: "#e7f4e7", fg: "#26522c" }, // moss     — 7.95:1
  { bg: "#feeae5", fg: "#7d3327" }, // brick    — 7.63:1
  { bg: "#e9f0f8", fg: "#2f4a66" }, // slate    — 7.98:1
] as const;

export interface AvatarDisc {
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
  return DISCS[hash(id) % DISCS.length];
}

export const DISC_COUNT = DISCS.length;
export { DISCS as IDENTITY_DISCS };
