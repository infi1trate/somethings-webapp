"use client";

// WHAT YOU CAN DO WITH ONE MESSAGE.
//
// ═══ BUILT IN PHASE 2, FILLED IN PHASES 5 AND 6 ═══
//
// This slot exists before most of what goes in it, deliberately. Two of the three
// entries a message will eventually offer — tag it for documentation, escalate
// from it — are the entry points for whole features, and if the slot arrives with
// them the thread gets redesigned twice. Its placement, its reveal behaviour and
// its keyboard path are decided now, once, against one working action.
//
// ═══ THE TRIGGER IS VISIBLE ON TOUCH AND REVEALED ON HOVER ═══
//
// "Reveal on hover" is the desktop convention and it is a trap on a phone: there
// is no hover, so `opacity-0` leaves a button that is present, focusable, and
// invisible. `@media (hover: hover)` is the distinction that matters — where a
// pointer can hover, the trigger hides until it does; where one cannot, it is
// simply there.
//
// NO LONG-PRESS. It was considered and dropped: a long-press handler on a bubble
// inside a scroll container has to disambiguate itself from a scroll gesture, gets
// that wrong on the first flick, and buys nothing over a button that is already on
// screen. The visible trigger is the touch affordance.
//
// KEYBOARD REACHES IT WITHOUT HOVERING, which is the case a hover-reveal usually
// breaks: the trigger is a real button in the tab order, and `focus-visible` shows
// it. `group-focus-within` also holds it open while the menu inside has focus.
//
// ═══ REACTIONS ARE SESSION-LOCAL, AND THAT IS A CHOICE ═══
//
// They live in the page's state rather than in the persisted store. The four things
// the chat persists are the ones that have to survive a navigation to mean anything
// — an open escalation, a sent activity, a note. A reaction on a fixture message is
// a prototype interaction; persisting it would mean a schema version and a
// migration for something whose whole job is to be immediate. Noted rather than
// hidden: if reactions become real content, they belong beside `chatNotes`.

import { useState } from "react";
import { FileText, ShieldAlert, SmilePlus } from "lucide-react";
import type { Sender } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ SIX, NOT A PICKER ═══
 *
 *  A full emoji keyboard on a staff surface is a search field, a scroll region and
 *  a decision. What a mentor is doing here is acknowledging a message in one tap,
 *  and six covers the range that acknowledgement has: warm, amused, impressed,
 *  sad, sorry, agreed.
 *
 *  Each one carries a WORD, because an emoji has no accessible name of its own that
 *  says what pressing it means — "grinning face with smiling eyes" is a description
 *  of a picture, not of an action. TODO-COPY. */
const REACTIONS: Array<{ emoji: string; label: string }> = [
  { emoji: "❤️", label: "Love this" },
  { emoji: "😂", label: "That's funny" },
  { emoji: "🙌", label: "Proud of you" },
  { emoji: "😔", label: "That's hard" },
  { emoji: "🤝", label: "Agreed" },
  { emoji: "👀", label: "Noticed this" },
];

export function MessageActions({
  /** Which side the bubble is on, so the trigger and the menu open away from it. */
  side,
  onReact,
  /** ═══ THE PRIMARY WAY A NOTE STARTS (Phase 5) ═══
   *  Tagging a message is what gives a note its provenance — see
   *  `ContextReference` on why a note without traceable evidence is an assertion
   *  nobody can check. Absent on a support thread, where there is no teen to
   *  document; the menu then holds reactions alone rather than a disabled row. */
  onTag,
  /** ═══ RAISING AN ESCALATION FROM A SPECIFIC MESSAGE (Phase 6) ═══
   *  Which is how it almost always happens: a mentor reads one sentence and knows.
   *  Anchoring the escalation to that message is what lets the thread show which
   *  one it was about, and what gives a supervisor reading back the sentence rather
   *  than a timestamp. Absent when one is already open, and on support threads. */
  onEscalate,
  className,
}: {
  side: Sender;
  onReact: (emoji: string) => void;
  onTag?: () => void;
  onEscalate?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const mine = side === "mentor";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center self-center",
        className
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        /* TODO-COPY. Names the action, not the glyph. */
        aria-label="React to this message"
        title="React"
        onClick={() => setOpen((o) => !o)}
        onBlur={(e) => {
          // Close when focus leaves the whole control, not on every blur — a blur
          // onto one of the emoji buttons inside must not dismiss it.
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        className={cn(
          "flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-opacity",
          "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
          // VISIBLE WHERE THERE IS NO HOVER — see the module note. Only a pointer
          // that can hover gets the hidden-until-hovered treatment.
          "[@media(hover:hover)]:opacity-0",
          "[@media(hover:hover)]:group-hover:opacity-100",
          "[@media(hover:hover)]:group-focus-within:opacity-100",
          open && "[@media(hover:hover)]:opacity-100",
          RING
        )}
      >
        <SmilePlus className="size-4" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          /* TODO-COPY */
          aria-label="Reactions"
          className={cn(
            "absolute bottom-full z-10 mb-1 flex items-center gap-0.5 rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-card)] p-1 shadow-[var(--shadow-card)]",
            // OPENS AWAY FROM THE BUBBLE, so it never covers the message it is
            // about — which on this surface may be the sentence a mentor is
            // deciding about.
            mine ? "right-0" : "left-0"
          )}
        >
          {REACTIONS.map((r) => (
            <button
              key={r.emoji}
              type="button"
              role="menuitem"
              aria-label={r.label}
              title={r.label}
              onClick={() => {
                onReact(r.emoji);
                setOpen(false);
              }}
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-[15px] leading-none transition-colors",
                "hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              <span aria-hidden>{r.emoji}</span>
            </button>
          ))}

          {(onTag || onEscalate) && (
            <>
              {/* A RULE, NOT A GAP. The six reactions are one gesture; tagging is a
                  different kind of act — it starts a written record — and a
                  separator is what stops a hurried press from landing on the wrong
                  side of that line. */}
              <span
                aria-hidden
                className="mx-0.5 h-5 w-px shrink-0 bg-[var(--border-subtle)]"
              />
              {onTag && (
                <button
                  type="button"
                  role="menuitem"
                  /* TODO-COPY. Names the OUTCOME — a note — rather than the mechanic.
                     "Tag" alone means nothing to somebody who has not used this
                     before, which is everybody the first time. */
                  aria-label="Write a note about this message"
                  title="Write a note about this"
                  onClick={() => {
                    onTag();
                    setOpen(false);
                  }}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors",
                    "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                    RING
                  )}
                >
                  <FileText className="size-4" aria-hidden />
                </button>
              )}
              {onEscalate && (
                /* ═══ LAST IN THE MENU ═══ Last because a menu whose most
                   consequential item sits beside six one-tap reactions is a menu
                   somebody mis-presses.
                   ═══ AND THE ONLY TINTED ITEM — A NAMED EXCEPTION ═══ At the
                   moment a mentor needs it they are not reading; they are looking
                   for the red one. The Tiering & Escalation pack's colour rule
                   (red on Tier 1–2 contexts and the 911 call alone) would make it
                   neutral, since no tier is chosen yet; that was tried and
                   reversed (Brandon, 2026-10-21: "keep the red on raise an
                   escalation"). */
                <button
                  type="button"
                  role="menuitem"
                  /* TODO-COPY. Names what it DOES — a supervisor is told — rather
                     than the word "escalate", which a new mentor may not connect to
                     "get a grown-up involved right now". */
                  aria-label="Raise an escalation about this message"
                  title="Raise an escalation — tells your supervisor now"
                  onClick={() => {
                    onEscalate();
                    setOpen(false);
                  }}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full transition-colors",
                    "text-[var(--alert-critical-accent)] hover:bg-[var(--alert-critical-bg)]",
                    RING
                  )}
                >
                  <ShieldAlert className="size-4" aria-hidden />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
