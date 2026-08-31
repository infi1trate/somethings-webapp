"use client";

// THE PROVENANCE MARK — one component wherever this record shows generated text.
//
// ═══ WHAT IT REPLACES, AND WHY THAT WAS WORTH REPLACING ═══
//
// Three separate disclaimer sentences, set as body copy, each ~20 words:
//   · "AI-generated from assessment history, risk flag log, presentation
//      history, theme extraction (mocked — no pipeline). Context for a coding
//      decision — not itself a clinical determination."
//   · "Theme extraction is mocked — no pipeline exists."
//   · "AI-generated from survey history and mentorship signal."
//
// They were correct and they were the wrong shape. A reader who has seen one
// stops reading all of them, which is the failure mode that matters: by the
// third cycle the sentence is furniture, and the one thing it must convey — this
// text was generated — has stopped landing. Set at body size and full width, it
// also took more visual weight than the finding it qualified.
//
// So: a small badge that is ALWAYS VISIBLE and cannot be skimmed past, plus the
// full note one interaction away for the reader who wants it. The attribution
// becomes glanceable; the explanation stays available.
//
// ═══ THE MARK IS AN INFO ICON; THE "AI" TAG LIVES IN THE PANEL ═══
//
// It used to be an always-visible "✨ AI" pill beside the icon, on the argument
// that attribution must be unskippable. The product owner's call, 2026-08-31:
// the tag repeated on five sections of one card and read as clutter, so the icon
// carries the affordance and the tag sits inside the panel it opens, at the top,
// where it labels the note rather than the heading.
//
// WHAT THIS COSTS, STATED PLAINLY: attribution is now one interaction away
// rather than visible at rest. That is a real reduction against the earlier
// reading of guardrail 6 ("attribution visible without scrolling") — the icon is
// visible, the WORD "AI" is not. The tag is still unconditional once the panel
// is open, and there is still no prop to suppress it; a generated block cannot
// render without one. Recorded as design-system-gaps row 335.
//
// ═══ 1.4.13 IS THE HARD PART, AND IT IS WHY THIS IS NOT A `title` ═══
//
// Content that appears on hover must be dismissible (Escape), hoverable (the
// pointer can move onto it without it vanishing), and persistent until
// dismissed. A `title` attribute fails all three, and a hover-only div fails the
// second and third. So the popover opens on hover, on focus AND on click, stays
// while the pointer is inside it, and closes on Escape or on a click outside.
//
// KEYBOARD AND TOUCH GET THE SAME THING BY DIFFERENT DOORS: the trigger is a
// real button, so focus opens it and Enter/Space toggles it; a tap is a click.
// Nothing here is reachable by hover alone.

import { useEffect, useId, useRef, useState } from "react";
import { Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** THE ONE NOTE, in one place. Every surface that shows generated text on this
 *  record says the same thing, because a second wording is a second policy.
 *
 *  TODO-COPY. Kept close to the sentence it replaces — it is the reviewed
 *  wording — minus the parenthetical about the theme pipeline, which was a note
 *  about implementation state rather than about provenance and did not survive
 *  the move (see the removal note in `care-summary-doc.tsx`). */
export const PROVENANCE_NOTE =
  // "Generated", not "AI-generated": the tag directly above this sentence
  // already says AI, and the panel read "AI / AI-generated from…" — the reader
  // is told twice in eleven characters. The tag carries the attribution now, so
  // the sentence carries the sources.
  "Generated from assessment history, risk flag log, presentation history, and theme extraction. Context for a coding decision — not itself a clinical determination.";

export function Provenance({
  /** The tag shown at the top of the panel. TODO-COPY. */
  label = "AI",
  /** Overrides the note for a block drawing on something narrower. Keep these
   *  rare: divergent wordings are how one policy becomes several. */
  note = PROVENANCE_NOTE,
  className,
}: {
  label?: string;
  note?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  /** ═══ CLICK PINS; IT DOES NOT TOGGLE ═══
   *
   *  This was `setOpen(v => !v)`, and for a mouse user that made the icon look
   *  broken: the pointer arriving fires `mouseenter`, which OPENS the panel, so
   *  the click that follows a moment later closed the thing the reader was
   *  clicking to see. It then stayed closed until they moved away and came back.
   *  Found by driving it rather than by reading it — a real click is a hover and
   *  then a press, and only the second half was being modelled.
   *
   *  So a click PINS: the panel stays after the pointer leaves, which is what
   *  clicking a disclosure means, and a second click unpins and closes it. Touch
   *  gets the same thing by the same door (a tap is a click, with no hover before
   *  it); keyboard keeps focus-to-open, and Enter/Space now pins rather than
   *  fighting the focus that just opened it. */
  const pinned = useRef(false);
  /** Hover uses a short close delay so the pointer can cross the gap between
   *  trigger and panel without the panel disappearing under it — the "hoverable"
   *  half of 1.4.13. A pinned panel ignores it entirely. */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      // A PINNED PANEL SURVIVES THE POINTER LEAVING. Escape, an outside click or
      // a second click on the trigger are the ways out.
      if (!pinned.current) setOpen(false);
    }, 140);
  };

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // DISMISSIBLE. Stops propagation so Escape closes the popover without also
      // closing a dialog this may be sitting inside — the summary overlay below
      // `lg` is exactly that case.
      if (e.key === "Escape") {
        e.stopPropagation();
        pinned.current = false;
        setOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        pinned.current = false;
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <span
      ref={wrap}
      className={cn("relative inline-flex shrink-0 items-center gap-1", className)}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        // The accessible name has to say what the button reveals; "Info" beside
        // an AI badge does not. TODO-COPY.
        aria-label="About this generated text"
        onClick={() => {
          pinned.current = !pinned.current;
          setOpen(pinned.current);
        }}
        onFocus={() => {
          cancelClose();
          setOpen(true);
        }}
        onBlur={scheduleClose}
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
          // 20px BOX, 44px TARGET. The pseudo-element extends the hit area
          // without reflowing a line it shares with a heading — the same
          // technique `touch-target.ts` uses, spelled out here because this
          // component is inline in running text on one of its three call sites.
          "after:absolute after:-inset-y-3 after:-inset-x-2 after:content-['']",
          RING
        )}
      >
        <Info className="size-3.5" aria-hidden />
      </button>

      {open && (
        <span
          id={panelId}
          role="note"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          // ANCHORED RIGHT AND BELOW. `right-0` rather than `left-0` because
          // every call site sits at the right edge of a header row, where a
          // left-anchored panel would run off the card.
          className="absolute right-0 top-full z-30 mt-1.5 w-[min(19rem,calc(100vw-2rem))] rounded-[var(--radius-control)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-card)]"
        >
          {/* THE TAG, AS THE PANEL'S OWN LABEL. It comes first because it is the
              subject of the sentence under it: the note explains what "AI" means
              here, so reading them in the other order asks the reader to hold an
              explanation before knowing what it explains. */}
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-[var(--surface-s2)] px-1.5 py-0.5 text-[11px] font-semibold leading-[14px] text-[var(--text-secondary)]">
            <Sparkles className="size-3 shrink-0" aria-hidden />
            {label}
          </span>
          <span className="block text-[12px] leading-[17px] text-[var(--text-secondary)]">
            {note}
          </span>
        </span>
      )}
    </span>
  );
}
