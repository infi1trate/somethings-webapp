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

/** Appendix B geometry. The visual dot is 20px; the hit area is 24×24 (SC 2.5.8)
 *  and is what the element's box measures — the dot is centred inside it, so a
 *  hover scale can never change what is clickable. */
export const PIN_DOT = 20;
export const PIN_HIT = 24;

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
          boxShadow: selected
            ? `0 0 0 1px ${PIN_EDGE}, 0 0 0 3px ${PIN_FILL_TEXT}, 0 0 0 5px ${PIN_FILL}`
            : `0 0 0 1px ${PIN_EDGE}`,
          color: filled ? PIN_FILL_TEXT : PIN_FILL,
          font: "700 11px/1 ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {state === "resolved" ? (
          /* A CHECK, drawn rather than a font glyph so it cannot be affected by
             the page's font loading. `currentColor` so it follows the ring. */
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
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
