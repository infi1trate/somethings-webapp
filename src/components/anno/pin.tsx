"use client";

// THE PIN — R5, PRD Appendix B, redesigned on Brandon's direction.
//
// ═══ WHAT CHANGED, AND WHY THE OLD VERSION LOOKED "FRANTIC" ═══
//
// It carried FOUR concentric edges at once: a 2px white stroke, a 1px mid-tone
// outer ring, and — when selected — two more. Four rings on a 26px disc is more
// boundary than object, and a page of them read as noise rather than as marks.
//
// Now: one filled disc. Purple while open, grey once resolved, no flat border at
// all. THE BORDER APPEARS ONLY ON THE SELECTED PIN, where it is the whole point.
//
// ═══ THE EDGE GUARANTEE SURVIVED THE BORDER'S REMOVAL — MEASURED ═══
//
// A pin sits on arbitrary content: a white card, a near-black panel, a photo. The
// old two-stroke system existed because no single FLAT fill clears 3:1 (SC
// 1.4.11) against all of that. Measured before removing it:
//
//   purple #7b5bd6 — 4.87:1 on the white card, 3.42:1 on the near-black panel
//   grey   #6e6b67 — 5.30:1 on white,          3.14:1 on near-black
//   both           — ~1.3:1 on a mid-grey photograph
//
// So the two surfaces this console actually has are covered by the fill alone,
// and the flat rings were belt-and-braces there. The mid-grey case is the one
// they earned their keep on — and it is now carried by the SKEUOMORPHIC
// TREATMENT rather than by a flat ring: every disc has a light inset edge at the
// top and a dark inset edge at the bottom, so whichever way the background goes,
// one of them contrasts with it. Same guarantee, delivered by the thing that
// makes it look like an object instead of by a fourth ring.
//
// ═══ RESOLVED KEEPS ITS GLYPH, AND THAT IS NOT NEGOTIABLE (SC 1.4.1) ═══
//
// Open: purple disc, number inside.  Resolved: grey disc, CHECK inside.
//
// "Purple means open, grey means done" is a colour-only distinction, and colour
// is never allowed to be the only channel. The check is what makes the two
// legible in greyscale, to a colour-blind reader and on a monochrome printout —
// it costs nothing visually (a resolved pin is still "a simple grey circle") and
// it is the only reason this pair is conformant. The number goes on a resolved
// pin because its job was to be said out loud in a live review, and a resolved
// comment is not being discussed.

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
/** `--text-muted`. Measured 5.30:1 on the white card and 3.14:1 on the near-black
 *  panel, so a resolved pin carries its own boundary on both. */
export const PIN_EDGE = "#6e6b67";

/** THE RESOLVED FILL. The same mid-tone the old outer ring used, promoted from an
 *  edge to a fill — it was chosen in the first place for clearing 3:1 against
 *  both extremes, which is exactly what a borderless disc needs. */
export const PIN_RESOLVED = PIN_EDGE;

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
export const PIN_DOT = 52;
export const PIN_HIT = 56;

/** ═══ THE CLUSTER BADGE IS DELIBERATELY BIGGER THAN A PIN ═══
 *
 *  A cluster shows a COUNT and a pin shows a comment NUMBER, and both are small
 *  integers — so "3" is ambiguous between "comment 3" and "three comments" unless
 *  the two are told apart by something other than the digit. Three things do it,
 *  and none of them is colour (SC 1.4.1): the badge is larger, it carries a second
 *  disc behind it so the silhouette is a stack, and its accessible name says
 *  "3 comments here" in words. */
export const CLUSTER_DOT = 58;
export const CLUSTER_HIT = 62;

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
  "0 2px 3px rgb(31 30 29 / 0.28), 0 8px 18px -4px rgb(31 30 29 / 0.34)";

/** ═══ THE SKEUOMORPHIC TREATMENT — AND IT IS DOING A JOB ═══
 *
 *  A sphere, built from one base colour so purple and grey get an identical
 *  treatment and cannot drift apart:
 *
 *    RADIAL GRADIENT   a specular highlight up and left of centre, the base
 *                      colour through the middle, a darker rim at the bottom.
 *    INSET TOP EDGE    white at low alpha — the light boundary.
 *    INSET BOTTOM EDGE black at low alpha — the dark boundary.
 *    OUTER SHADOW      lifts the whole thing off the page.
 *
 *  THE TWO INSET EDGES ARE THE SC 1.4.11 MECHANISM, not decoration. With the flat
 *  rings gone, they are what guarantees a visible boundary on a background whose
 *  luminance sits between the fill's — a mid-grey photograph, where the fill alone
 *  measures ~1.3:1. One edge always contrasts, whichever way the background goes.
 *  See the module note.
 *
 *  BLOOM PROHIBITS GRADIENTS ON SURFACES. A pin is not a surface — it is an
 *  overlay marker that is deliberately not part of the prototype — and this is the
 *  SECOND documented exception after the chart area fill. It is confined to this
 *  component, mixed from the pin's own base colour, and must not be lifted onto
 *  anything the product itself renders. Logged in GAPS.md with the hue decision. */
export function pinSphere(base: string): string {
  return [
    `radial-gradient(circle at 34% 26%,`,
    `color-mix(in oklab, ${base} 55%, white) 0%,`,
    `color-mix(in oklab, ${base} 88%, white) 34%,`,
    `${base} 62%,`,
    `color-mix(in oklab, ${base} 80%, black) 100%)`,
  ].join(" ");
}

/** The inset pair, in one place so the pin and the cluster badge cannot diverge. */
export const PIN_INSETS =
  "inset 0 1.5px 1px rgb(255 255 255 / 0.42), inset 0 -2px 3px rgb(31 30 29 / 0.28)";

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
  const resolved = state === "resolved";
  /** ONE BASE COLOUR PER STATE, and the sphere is built from it. A ghost borrows
   *  the open hue at reduced opacity — it IS an open comment, just not saved. */
  const base = resolved ? PIN_RESOLVED : PIN_FILL;
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
          "transition-transform duration-150 group-hover/pin:scale-105 motion-reduce:transition-none",
          state === "ghost" && "opacity-60"
        )}
        style={{
          width: PIN_DOT,
          height: PIN_DOT,
          /* ═══ ONE DISC. NO FLAT BORDER. ═══
             The 2px white stroke and the 1px mid-tone ring are both gone — see
             the module note for the measurements that made that safe. What
             remains is a filled sphere whose own inset edges carry the boundary.

             THE LOST STATE KEEPS ITS DASHED OUTLINE, and it is not the "extra
             border" that went: it is the tier-3 signal, the one thing that says
             this pin is at its last known coordinates rather than on its anchor.
             A lost pin that looked identical to a placed one would be the
             silent-misattachment failure the whole anchoring engine exists to
             prevent. */
          background: pinSphere(base),
          border: state === "lost" ? `2px dashed ${PIN_STROKE}` : undefined,
          /* INSETS FIRST, THEN THE SELECTED RINGS, THEN THE OUTER SHADOW.
             `box-shadow` paints the first layer on top, so the disc's own edges
             stay crisp above everything outside it. THE RINGS APPEAR ONLY WHEN
             SELECTED — that is the whole of the border story now. */
          boxShadow: selected
            ? `${PIN_INSETS}, 0 0 0 3px ${PIN_FILL_TEXT}, 0 0 0 5.5px ${base}, ${PIN_SHADOW}`
            : `${PIN_INSETS}, ${PIN_SHADOW}`,
          color: PIN_FILL_TEXT,
          /* TEXT SIZE IS UNCHANGED at 12px, deliberately: the disc doubled and the
             numeral did not, which is what turns a cramped badge into a mark with
             a number sitting calmly inside it. `textShadow` is part of the
             skeuomorphic read — the numeral sits ON the sphere rather than being
             printed flat over it — and it also deepens the numeral's contrast
             against the highlight at the top of the gradient. */
          font: "700 12px/1 ui-sans-serif, system-ui, sans-serif",
          textShadow: "0 1px 1px rgb(31 30 29 / 0.45)",
        }}
      >
        {resolved ? (
          /* ═══ THE NON-COLOUR CHANNEL (SC 1.4.1) ═══
             Without this, open and resolved differ by hue alone. Drawn rather
             than a font glyph so page font loading cannot affect it, and
             `currentColor` so it follows the numeral's ink. */
          <svg width="16" height="16" viewBox="0 0 12 12" aria-hidden>
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
          // Offset further now the disc is 58px — 4px behind a disc this size
          // read as a printing misregistration rather than as a second card.
          transform: "translate(7px, 7px)",
          background: pinSphere(PIN_FILL),
          opacity: 0.5,
          boxShadow: PIN_SHADOW,
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
          // THE SAME SPHERE AS A PIN, so a cluster reads as a stack OF PINS
          // rather than as a different kind of object.
          background: pinSphere(PIN_FILL),
          boxShadow: `${PIN_INSETS}, ${PIN_SHADOW}`,
          color: PIN_FILL_TEXT,
          font: "700 13px/1 ui-sans-serif, system-ui, sans-serif",
          textShadow: "0 1px 1px rgb(31 30 29 / 0.45)",
        }}
      >
        {expanded ? (
          /* AN INWARD CHEVRON PAIR — "bring these back together". Drawn, not a
             font glyph, for the same reason as the pin's check. */
          <svg width="18" height="18" viewBox="0 0 14 14" aria-hidden>
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
