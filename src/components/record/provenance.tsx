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
// ═══ THE BADGE IS NOT OPTIONAL ═══
//
// There is no prop to hide it. A generated block on a clinical record carries
// visible attribution, full stop — the popover carries the reasoning, never the
// fact. If a caller wants the fact without the badge, the answer is that the
// block should not be generated.
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
  "AI-generated from assessment history, risk flag log, presentation history, and theme extraction. Context for a coding decision — not itself a clinical determination.";

export function Provenance({
  /** Shown beside the glyph. Defaults to the bare mark. TODO-COPY. */
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
  /** Hover uses a short close delay so the pointer can cross the gap between
   *  trigger and panel without the panel disappearing under it — the "hoverable"
   *  half of 1.4.13. Focus and click ignore it entirely. */
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
    closeTimer.current = setTimeout(() => setOpen(false), 140);
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
        setOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
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
      {/* THE VISIBLE BADGE. Quiet tint, not a status colour — this is
          attribution, and a generated block is not a warning. */}
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-s2)] px-1.5 py-0.5 text-[11px] font-semibold leading-[14px] text-[var(--text-secondary)]"
      >
        <Sparkles className="size-3 shrink-0" aria-hidden />
        {label}
      </span>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        // The accessible name has to say what the button reveals; "Info" beside
        // an AI badge does not. TODO-COPY.
        aria-label="About this generated text"
        onClick={() => setOpen((v) => !v)}
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
          className="absolute right-0 top-full z-30 mt-1.5 w-[min(19rem,calc(100vw-2rem))] rounded-[var(--radius-control)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-3 text-[12px] leading-[17px] text-[var(--text-secondary)] shadow-[var(--shadow-card)]"
        >
          {note}
        </span>
      )}
    </span>
  );
}
