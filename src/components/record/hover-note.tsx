"use client";

// HOVER NOTE — the record's one hover-and-focus disclosure, and the only place
// WCAG 1.4.13 is implemented.
//
// ═══ WHY THIS IS ITS OWN FILE ═══
//
// It was all inside `Provenance`, welded to the AI note that component exists to
// show. The flag-priority chip now needs the same behaviour with different
// content, and there are exactly two ways to get it: copy ninety lines of
// pointer-timing and dismissal handling, or lift them out. A duplicated 1.4.13
// implementation is how one of the two copies quietly stops being conformant —
// the bug would be a panel that closes while the pointer is crossing the gap to
// it, which nobody notices in review.
//
// So the mechanics live here and the callers supply the trigger and the body.
//
// ═══ 1.4.13, AND WHY THIS IS NOT A `title` ═══
//
// Content that appears on hover must be DISMISSIBLE (Escape), HOVERABLE (the
// pointer can move onto it without it vanishing), and PERSISTENT until
// dismissed. A `title` attribute fails all three, and a hover-only div fails the
// second and third. So this opens on hover, on focus AND on click, stays while
// the pointer is inside it, and closes on Escape or an outside click.
//
// KEYBOARD AND TOUCH COME THROUGH THE SAME DOORS: the trigger is a real button,
// so focus opens it and Enter/Space toggles it; a tap is a click.

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function HoverNote({
  /** What the trigger announces. It has to say what the button reveals. */
  triggerLabel,
  /** The trigger's own markup — an icon, a chip, whatever the caller shows. */
  trigger,
  /** Classes for the trigger button. The caller owns its shape entirely. */
  triggerClassName,
  /** ═══ WHICH EDGE THE PANEL HANGS FROM ═══
   *  `right` for a trigger at the right edge of a header row, which is where
   *  every provenance mark sits — a left-anchored panel there runs off the card.
   *  `left` for a trigger in the body or the left of a grid, where the opposite
   *  is true. */
  align = "right",
  className,
  children,
}: {
  triggerLabel: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  /** ═══ CLICK PINS; IT DOES NOT TOGGLE ═══
   *
   *  Toggling made the trigger look broken to a mouse user: the pointer arriving
   *  fires `mouseenter`, which OPENS the panel, so the click a moment later
   *  closed the thing they were clicking to see, and it stayed closed until they
   *  moved away and came back. Found by driving it rather than reading it — a
   *  real click is a hover and then a press, and only the second half was being
   *  modelled.
   *
   *  So a click PINS: the panel survives the pointer leaving, which is what
   *  clicking a disclosure means, and a second click unpins and closes it. */
  const pinned = useRef(false);
  /** The "hoverable" half of 1.4.13: a short close delay so the pointer can
   *  cross the gap between trigger and panel without the panel vanishing under
   *  it. A pinned panel ignores it entirely. */
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
      if (!pinned.current) setOpen(false);
    }, 140);
  };

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // DISMISSIBLE. Stops propagation so Escape closes this without also
      // closing a dialog it may be sitting inside.
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
        aria-label={triggerLabel}
        onClick={() => {
          pinned.current = !pinned.current;
          setOpen(pinned.current);
        }}
        onFocus={() => {
          cancelClose();
          setOpen(true);
        }}
        onBlur={scheduleClose}
        className={cn("inline-flex items-center", RING, triggerClassName)}
      >
        {trigger}
      </button>

      {open && (
        <span
          id={panelId}
          role="note"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className={cn(
            "absolute top-full z-30 mt-1.5 w-[min(19rem,calc(100vw-2rem))] rounded-[var(--radius-control)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-card)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
