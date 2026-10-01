"use client";

// RECORD BUTTON — the record's SECONDARY button, extracted so the Care page's
// two CTAs stop being bare underlined text links.
//
// WHY A NEW COMPONENT RATHER THAN ui/button.tsx: that file is shadcn's, on
// shadcn's token system (`--background`, `--foreground`, `--muted`, `--border`).
// Every record surface is on the Bloom tokens (`--surface-card`,
// `--border-contour`, `--text-primary`), and mixing the two is how a button ends
// up almost matching the card it sits on. It is also unused on this page today.
//
// THE PATTERN IS NOT INVENTED. `DeactivateAction` on the Account tab already
// hand-rolls exactly this shape — pill radius, 1px contour, 13px semibold,
// min-h-9, tint-hover — for its Deactivate/Lock pair. This is that, named. The
// deactivate band is NOT retrofitted in this pass: it is a different tab with
// its own consumers, and a shared-component change there would shift a screen
// this brief did not ask about. Converging it is a follow-up.
//
// SECONDARY, NEVER FILLED. The filled button is scarce by house rule — one per
// region — and on the Care page it is Approve inside the task region. A CTA that
// opens a modal to change a minor's diagnosis should read as deliberate, not
// inviting, so it gets a contour and not a fill.

import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ A THIRD WEIGHT, AND THE SYSTEM HAS NO NAME FOR IT (arch-H, H8) ═══
 *
 *  H8's flag footer needs three buttons at three weights: classifier feedback
 *  (contour), a clinical alternative (tonal), the clinical primary (filled). The
 *  product has the outer two — this component and `PillButton` — and nothing in
 *  between. AUDITED: `bloom-design-system_1.md` defines no tonal, secondary-fill
 *  or "filled tonal" button variant, so this is an interim and it is logged.
 *
 *  THE INTERIM IS THE TOKEN PAIRING THIS CODEBASE ALREADY USES for a filled,
 *  recessive surface: `--surface-s2` under `--text-primary`, which is exactly
 *  `PaneChip`, on the same pane, two lines above. So the button matches something
 *  already on screen rather than introducing a fourth surface colour.
 *
 *  `tone` RATHER THAN A `className` AT THE CALL SITE. Both work — `cn` merges —
 *  but a treatment defined at the call site is a treatment the second tonal
 *  button will define slightly differently.
 *
 *  DEFAULTS TO `outline`, so every existing caller renders exactly what it did. */
/** ═══ THREE TONES, AND ONE OF THEM IS ON ITS WAY OUT (arch-H, H12) ═══
 *
 *  · `tonal` — SECONDARY. A tinted fill, no contour.
 *  · `text`  — TERTIARY. Plain text, an icon when one states the action better
 *    than the words do, no box until it is hovered.
 *  · `outline` — THE LEGACY DEFAULT, and H12's verdict on it is that outlined
 *    pills read as developer tooling.
 *
 *  SO WHY IS IT STILL THE DEFAULT. Every remaining caller is on the CARE PAGE,
 *  which this phase's own scope line puts out of bounds — and flipping the
 *  default would restyle two CTAs on a screen nobody reviewed. The merged
 *  surfaces pass `tonal` or `text` explicitly and no longer render an outline.
 *  DEBT, stated: when Care has its craft pass, `outline` goes and the default
 *  becomes `tonal`. Until then the product has one outlined button family, on
 *  one screen, deliberately.
 *
 *  ═══ PRESS AND HOVER (H12) ═══
 *
 *  Scale to 0.97 over 150ms with the shadow stepping down, and a 1px hover lift.
 *  Both behind `motion-reduce`, which is not a nicety on a surface somebody
 *  presses fifty times a shift — a vestibular trigger fifty times is the
 *  difference between a usable console and an unusable one.
 *
 *  44px MINIMUM (H12), up from 36. Above WCAG 2.5.8's 24px floor and at Apple's
 *  HIG target, and it applies to Care's two CTAs as well: a shared control's
 *  hit area is not a per-surface decision. */
/** ═══ THE SHELL, EXTRACTED SO A LINK CAN WEAR IT (band §4) ═══
 *
 *  `View care journey` NAVIGATES, so it has to be an anchor: a `<button>` that
 *  routes loses cmd-click, loses the status-bar URL, and announces as "button"
 *  when the thing it does is go somewhere. §4 asks for "the same component...
 *  and no new button style", and those two pull apart here — the component
 *  renders a `<button>`.
 *
 *  SO THE STYLE IS THE SHARED THING, NOT THE ELEMENT. One class expression, two
 *  callers: `RecordButton` below and the band's `Link`. That is the half of §4
 *  that matters — a second hand-written pill is what "no new button style"
 *  rules out — and it keeps the element correct for each job.
 *  THE ALTERNATIVE WAS AN `asChild` PROP, which would make a shared control
 *  polymorphic to serve one call site. */
export function recordButtonClass(
  tone: "outline" | "tonal" | "text" = "outline",
  className?: string
): string {
  return cn(
    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border",
    /* THE TEXT TONE LOSES ITS SIDE PADDING TOO — a tertiary button that
       keeps a pill's inset reads as a pill with an invisible edge, and the
       label stops aligning with the text above it. */
    tone === "text" ? "-mx-2 px-2" : "px-4",
    tone === "tonal" &&
      /* NO CONTOUR. A tinted fill AND a border is two treatments competing;
         the fill is what separates it from its neighbours, and
         `border-transparent` keeps the box metrics identical so the buttons
         in a row share a baseline. */
      "border-transparent bg-[var(--surface-s2)]",
    tone === "text" && "border-transparent bg-transparent",
    tone === "outline" &&
      "border-[color:var(--border-contour)] bg-[var(--surface-card)]",
    /* 14/20 — the ramp's body stop (arch-H, H10). It was 13px, which is not
       a Bloom size, and it was the last off-ramp type rendering on the
       merged surfaces once the pass was done: a shared component's size is
       inherited by every host, so the surface could not be clean while this
       was 13. */
    "text-[14px] font-semibold leading-[20px] text-[var(--text-primary)]",
    "transition-[background-color,transform,box-shadow] duration-150 ease-out",
    "hover:bg-[var(--tint-hover)]",
    tone !== "text" && "hover:-translate-y-px hover:shadow-[var(--shadow-tile)]",
    "active:translate-y-0 active:scale-[0.97] active:shadow-none",
    "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
    RING,
    className
  );
}

export function RecordButton({
  onClick,
  className,
  children,
  tone = "outline",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "outline" | "tonal" | "text";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      /* ONE SOURCE FOR THE STYLE — see `recordButtonClass`. */
      className={recordButtonClass(tone, className)}
      {...props}
    >
      {children}
    </button>
  );
}
