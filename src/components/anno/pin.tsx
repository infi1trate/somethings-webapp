"use client";

// THE PIN — R5, PRD Appendix B.
//
// ═══ THE EDGE IS THE LOAD-BEARING PART ═══
//
// A pin sits on arbitrary prototype content: a white card, a near-black panel, a
// photograph, a dense table. No single fill can clear 3:1 (SC 1.4.11) against all
// of that, so the boundary is built from two strokes that fail on opposite
// backgrounds:
//
//   LIGHT STROKE (2px, white)      — the visible edge on dark content
//   OUTER EDGE  (1px, #6e6b67)     — the visible edge on light content
//
// ═══ WHY THE OUTER EDGE IS A MID-TONE AND NOT "DARK" ═══
//
// Appendix B says "thin dark outer edge", and a dark edge does clear 3:1 against
// white — but measured against pure black it is 1.28:1, which fails the brief's
// own requirement that the outer edge clear 3:1 against BOTH. A mid-tone clears
// both, and the arithmetic says which tones can: relative luminance must sit
// between 0.10 and 0.30. `--text-muted` (#6e6b67) has luminance 0.148, giving
// 5.30:1 on white and 3.96:1 on black.
//
// So the outer edge is an EXISTING BLOOM TOKEN rather than an invented dark, it
// satisfies the requirement literally instead of by argument, and the light
// stroke still carries the dark-background case with a much larger margin.
//
// ═══ RESOLVED IS A SHAPE CHANGE, NOT A COLOUR CHANGE (SC 1.4.1) ═══
//
// Unresolved: filled disc, number inside.
// Resolved:   ring only, check glyph, reduced opacity.
//
// Fill-versus-ring survives greyscale, colour-blindness and a black-and-white
// printout, which "violet means open, grey means done" does not. The number is
// dropped on a resolved pin deliberately: its job was to be said out loud in a
// live review, and a resolved comment is not being discussed.

import { cn } from "@/lib/utils";

/** The repo's focus treatment. The pin shipped in anno-04 WITHOUT one — measured
 *  `outlineStyle: "none"`, no ring class — so a keyboard reviewer focusing a pin
 *  saw nothing at all (SC 2.4.7). Caught in anno-06, because the reduced-motion
 *  requirement asks for "a static focus ring" and there was no ring to fall back
 *  to. */
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ THE ANNOTATION HUE ═══
 *
 *  Violet. anno-00 established that no high-visibility hue in Bloom is unclaimed
 *  and that saturated red is RESERVED for the alarm budget (the Respond strip and
 *  the interrupt banner). Violet is the least conflicted: its only claims are
 *  `--doodle-purple`, which appears in illustrations, and `--preview-accent`,
 *  which appears inside the teen phone-preview frame. Neither is ever adjacent to
 *  staff console chrome.
 *
 *  NOT TOKENS, deliberately — minting `--anno-pin-*` is a design decision, and it
 *  is logged in GAPS.md rather than taken here. */
export const PIN_FILL = "#7b5bd6";
export const PIN_FILL_TEXT = "#ffffff";
export const PIN_STROKE = "#ffffff";
/** `--text-muted`. See the note above on why this is a mid-tone. */
export const PIN_EDGE = "#6e6b67";

/** ═══ GEOMETRY ═══
 *
 *  The hit area is what the element's box measures; the dot is centred inside it,
 *  so a hover scale can never change what is clickable.
 *
 *  Appendix B specified 20/24 — 24 being the SC 2.5.8 floor exactly, with no
 *  margin. Enlarged to 26/30 because a pin has to be findable on top of a dense
 *  console at a glance, and because three-digit numbers were cramped at 20px
 *  (the prototype's counter is past 100). 30 also gives the criterion some room
 *  rather than sitting on its edge. */
export const PIN_DOT = 26;
export const PIN_HIT = 30;

/** ═══ THE CLUSTER BADGE IS DELIBERATELY BIGGER THAN A PIN ═══
 *
 *  A cluster shows a COUNT and a pin shows a comment NUMBER, and both are small
 *  integers — so "3" is ambiguous between "comment 3" and "three comments" unless
 *  the two are told apart by something other than the digit. Three things do it,
 *  and none of them is colour (SC 1.4.1): the badge is larger, it carries a second
 *  disc behind it so the silhouette is a stack, and its accessible name says
 *  "3 comments here" in words. */
export const CLUSTER_DOT = 32;
export const CLUSTER_HIT = 36;

/** ═══ THE MINIMUM CENTRE-TO-CENTRE GAP FOR EXPANDED CLUSTER MEMBERS ═══
 *
 *  SC 2.5.8's floor is 24. `PIN_HIT` is 30, so 24 would still let two discs
 *  visually overlap by 6px — conformant and confusing. 34 clears the criterion
 *  AND leaves a 4px gap between the discs, so "these are two separate comments"
 *  is legible rather than inferred. Passed to `fanOut`, which proves it. */
export const PIN_SEP = PIN_HIT + 4;

/** Pins whose centres are closer than this are clustered. Set to the pin's own
 *  size: closer than one pin's width and the discs overlap, which is the
 *  condition that makes the covered comment unreachable. */
export const CLUSTER_RADIUS = PIN_HIT;

/** ═══ THE DROP SHADOW IS SEPARATE FROM THE CONTRAST EDGE ═══
 *
 *  The hard `0 0 0 1px` ring is the SC 1.4.11 guarantee and a blurred shadow
 *  cannot replace it — a blur has no measurable boundary, so it cannot be said to
 *  clear 3:1 against anything. The shadow is therefore ADDITIVE: it lifts the pin
 *  off the content so it reads as an overlay rather than as part of the
 *  prototype, and the ring underneath still does the contrast work.
 *
 *  Two layers, the same structure as Bloom's `--shadow-card` (a tight contact
 *  shadow plus a soft ambient one) but scaled for a 26px object rather than a
 *  card. Deliberately NOT `var(--shadow-card)`: at `0 10px 28px` that shadow is
 *  wider than the pin itself and reads as a smudge under it.
 *
 *  THEME-AGNOSTIC ON PURPOSE. A neutral black-based shadow is correct on a light
 *  surface and simply does less on a dark one, where the 2px light stroke is
 *  already carrying the separation. Minting an `--anno-pin-shadow` token pair is
 *  a design decision, and it is logged in GAPS.md with the hue rather than taken
 *  here. */
export const PIN_SHADOW =
  "0 1px 2px rgb(31 30 29 / 0.24), 0 4px 10px -2px rgb(31 30 29 / 0.30)";

export type PinState =
  | "unresolved"
  | "resolved"
  /** Placed but not yet committed — no number, because none is allocated until
   *  the server sees it. */
  | "ghost"
  /** The anchor could not be resolved; rendered at last known coordinates. */
  | "lost";

export function Pin({
  id,
  number,
  state,
  selected = false,
  onSelect,
  style,
}: {
  /** The comment id — the deeplink's scroll/focus target. Absent on a ghost,
   *  which has no comment yet. */
  id?: string;
  /** `null` for a ghost, which has no number yet. */
  number: number | null;
  state: PinState;
  selected?: boolean;
  onSelect?: () => void;
  style?: React.CSSProperties;
}) {
  const filled = state === "unresolved" || state === "ghost";
  const label =
    state === "ghost"
      ? "New comment, not saved yet"
      : state === "lost"
        ? `Comment ${number} — anchor lost`
        : state === "resolved"
          ? `Comment ${number}, resolved`
          : `Comment ${number}`;

  return (
    <button
      type="button"
      data-anno-pin={number ?? "ghost"}
      data-anno-pin-id={id}
      data-anno-state={state}
      aria-label={label}
      title={label}
      onClick={(e) => {
        /* STOP HERE. Without this the click continues to whatever is underneath
           the pin — which on a 24px target sitting on top of a button means one
           press doing two things. The pin is the only part of the layer that
           accepts pointer events, so it is also the only place this is needed. */
        e.stopPropagation();
        e.preventDefault();
        onSelect?.();
      }}
      /* The hit area IS the element. 24×24 regardless of state, so the ghost, the
         resolved ring and the hovered pin are all the same size to a pointer. */
      className={cn(
        "absolute flex items-center justify-center rounded-full p-0",
        // `pointer-events: auto` against the layer root's `none` — R11.
        "pointer-events-auto",
        "transition-transform duration-150 motion-reduce:transition-none",
        // HOVER SCALES THE DOT, NOT THE BUTTON — see below.
        "group/pin",
        RING
      )}
      style={{
        width: PIN_HIT,
        height: PIN_HIT,
        // Centre the hit area on the anchor point.
        transform: "translate(-50%, -50%)",
        ...style,
      }}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-full",
          "transition-transform duration-150 group-hover/pin:scale-110 motion-reduce:transition-none",
          state === "ghost" && "opacity-60",
          state === "resolved" && "opacity-70"
        )}
        style={{
          width: PIN_DOT,
          height: PIN_DOT,
          background: filled ? PIN_FILL : "transparent",
          /* THE TWO STROKES. `border` is the light one; `box-shadow` spread is the
             outer edge — a second real ring rather than a blur, so it has a hard
             boundary to measure. A `selected` pin adds a THIRD ring outside both,
             offset so it reads as separate from the edge rather than thickening
             it. */
          border:
            state === "lost"
              ? `2px dashed ${PIN_FILL}`
              : `2px solid ${filled ? PIN_STROKE : PIN_FILL}`,
          /* RINGS FIRST, THEN THE BLUR. `box-shadow` paints the first layer on
             top, so the hard contrast edge stays crisp above the soft one
             instead of being washed out by it. */
          boxShadow: selected
            ? `0 0 0 1px ${PIN_EDGE}, 0 0 0 3px ${PIN_FILL_TEXT}, 0 0 0 5px ${PIN_FILL}, ${PIN_SHADOW}`
            : `0 0 0 1px ${PIN_EDGE}, ${PIN_SHADOW}`,
          color: filled ? PIN_FILL_TEXT : PIN_FILL,
          // 12px in a 26px disc leaves room for three digits without clipping.
          font: "700 12px/1 ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {state === "resolved" ? (
          /* A CHECK, drawn rather than a font glyph so it cannot be affected by
             the page's font loading. `currentColor` so it follows the ring. */
          <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M2.5 6.5l2.5 2.5 4.5-5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : state === "ghost" ? null : (
          number
        )}
      </span>
    </button>
  );
}

/* ══════════════════════════ THE CLUSTER BADGE ══════════════════════════ */

/** One control standing for several pins at the same place — R17.
 *
 *  ═══ WHY THIS IS NOT DECORATION ═══
 *
 *  anno-07 measured two comments on one anchor resolving to a 0px gap: the pin
 *  painted second covers the first completely, so one comment has no reachable
 *  area at all and nothing on screen says it exists. This badge is what makes
 *  that case operable, which is why it is an SC 2.5.8 item rather than polish.
 *
 *  ═══ TOLD APART FROM A PIN BY SHAPE AND BY WORDS, NEVER BY COLOUR ═══
 *
 *  A larger disc, a second disc behind it, and an accessible name that says
 *  "3 comments here" rather than a bare digit. All three survive greyscale, a
 *  monochrome printout, and every form of colour blindness (SC 1.4.1).
 *
 *  ═══ COLLAPSED AND EXPANDED ARE THE SAME CONTROL ═══
 *
 *  `aria-expanded` on one button, rather than a badge that is replaced by a
 *  different close control — so focus is never lost on expand, and a keyboard
 *  reviewer who opens a cluster is still standing on the thing that opens it. */
export function ClusterPin({
  count,
  expanded,
  onToggle,
  style,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
}) {
  const label = expanded
    ? `Collapse ${count} comments`
    : `${count} comments here — expand to see each one`;

  return (
    <button
      type="button"
      data-anno-cluster={count}
      data-anno-cluster-expanded={expanded ? "true" : "false"}
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      onClick={(e) => {
        // Same reason as the pin: one press must not also hit the product.
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      className={cn(
        "absolute flex items-center justify-center rounded-full p-0",
        "pointer-events-auto",
        "transition-transform duration-150 motion-reduce:transition-none",
        "group/cluster",
        RING
      )}
      style={{
        width: CLUSTER_HIT,
        height: CLUSTER_HIT,
        transform: "translate(-50%, -50%)",
        ...style,
      }}
    >
      {/* ── THE DISC BEHIND, which is what makes the silhouette a STACK ──
          Decorative and `aria-hidden`: the count and the label carry the meaning.
          Offset down-right so it reads as a card underneath rather than as a
          second pin beside. It sits outside the hit box by 4px, which is fine —
          it is not a target, and the button's own box is what a pointer gets. */}
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: CLUSTER_DOT,
          height: CLUSTER_DOT,
          transform: "translate(4px, 4px)",
          background: PIN_FILL,
          opacity: 0.45,
          border: `2px solid ${PIN_STROKE}`,
          boxShadow: `0 0 0 1px ${PIN_EDGE}, ${PIN_SHADOW}`,
        }}
      />
      <span
        aria-hidden
        className={cn(
          "relative flex items-center justify-center rounded-full",
          "transition-transform duration-150 group-hover/cluster:scale-110 motion-reduce:transition-none"
        )}
        style={{
          width: CLUSTER_DOT,
          height: CLUSTER_DOT,
          background: PIN_FILL,
          border: `2px solid ${PIN_STROKE}`,
          boxShadow: `0 0 0 1px ${PIN_EDGE}, ${PIN_SHADOW}`,
          color: PIN_FILL_TEXT,
          font: "700 13px/1 ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {expanded ? (
          /* AN INWARD CHEVRON PAIR — "bring these back together". Drawn, not a
             font glyph, for the same reason as the pin's check. */
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M2 2l4 4M6 6H3M6 6V3M12 12l-4-4M8 8h3M8 8v3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          count
        )}
      </span>
    </button>
  );
}
