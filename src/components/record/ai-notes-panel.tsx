"use client";

// THE AI NOTES CONTAINER — 3–5 bullets, each separately copyable.
//
// ═══ WHAT CHANGED FROM THE DRAFT PANEL, AND WHY ═══
//
// This was `AiDraftPanel`: one paragraph, one copy-everything button, and a
// footer that took the whole thing into the field. It is notes now, and the
// difference is not cosmetic. A paragraph is shaped like the sentence the
// supervisor was about to write, so the cheapest action is to accept it. A
// bullet list is shaped like evidence, so the cheapest action is to read it and
// write your own sentence — which is the behaviour a clinical determination
// should make cheap.
//
// SO THE COPY BUTTON MOVED TO THE BULLET. The unit a supervisor reasons about
// is the observation, and a copy-all button quietly asserts that the unit is the
// whole set. Per-bullet copy also removes the reason the old panel needed its
// body to be selectable-but-not-focusable: taking one observation is now a
// click rather than a careful drag.
//
// ═══ IT MUST NOT LOOK LIKE AN INPUT ═══
//
// Unchanged from the draft panel, and still the constraint that shapes it: a
// bordered, filled container under a textarea reads as a second textarea, and a
// reader who types into it would be typing into nothing. No focusable text
// surface, no caret, no placeholder.
//
// THE BULLETS ARE STILL SELECTABLE, deliberately. Per-bullet copy covers the
// common case; a reader who wants half a bullet can still drag it. Text carried
// across by hand registers as `authored` either way — the known limitation
// stated on `field-provenance.ts`.

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Info, Sparkles } from "lucide-react";
import { HoverNote } from "@/components/record/hover-note";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ ONE BULLET, AND ITS OWN COPY CONTROL ═══
 *
 *  THE CONTROL IS REVEALED ON HOVER AND FOCUS, NOT ON HOVER ALONE. Hover-only
 *  affordances are unreachable by keyboard and by touch, so the button is always
 *  in the DOM and always focusable — `opacity` carries the reveal, and
 *  `focus-visible:opacity-100` plus `group-focus-within` bring it back for a
 *  keyboard user. A `hidden` button would take it out of the tab order, which is
 *  the version of this pattern that fails WCAG 2.1.1.
 *
 *  IT KEEPS ITS SPACE AT ALL TIMES. The row reserves the button's width whether
 *  or not it is visible, so hovering a bullet does not reflow the text under the
 *  cursor — the defect that makes hover-revealed controls feel like they are
 *  dodging the pointer. */
function NoteBullet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* A denied clipboard is not an error worth a dialog — the bullet is
         selectable, which is the fallback. */
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <li className="group relative flex items-start gap-2">
      {/* THE MARKER IS DRAWN, NOT A LIST STYLE. `list-disc` puts the marker
          outside the content box, where it either clips at the container's
          padding or forces indentation that misaligns the text from the
          header above it. A span is positionable. */}
      <span
        aria-hidden
        className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--text-muted)]"
      />
      {/* ═══ NOT `flex-1` ═══
          It was, and that pushed the copy control to the panel's far right
          edge — measured at ~700px from the end of a short bullet in the
          main-column width. A hover-revealed control that far from the thing it
          acts on is hard to associate with it and a long journey to reach.
          Sized to its content instead, so the button follows the text and lands
          beside the observation it copies. Long bullets still wrap: `min-w-0`
          lets the span shrink below its intrinsic width. */}
      <span className="min-w-0 text-[13px] leading-[19px] text-[var(--text-primary)]">
        {text}
      </span>
      <button
        type="button"
        onClick={copy}
        /* THE ACCESSIBLE NAME NAMES THE BULLET, not just "Copy". Five identical
           "Copy" buttons in a list are five controls a screen-reader user cannot
           tell apart. Truncated, because the name is a label and not the
           content. TODO-COPY. */
        aria-label={`Copy note: ${text.slice(0, 60)}`}
        className={cn(
          "-my-1 shrink-0 rounded-sm p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-[var(--text-primary)]",
          "group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
          RING
        )}
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
      {/* ═══ THE ANNOUNCE IS ITS OWN NODE, per bullet ═══
          A screen reader that hears the button rename itself from "Copy" to
          "Copied" has been told the control changed, not that the copy
          happened. `sr-only` and `aria-live`, so the icon can swap silently. */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </li>
  );
}

export function AiNotesPanel({
  id,
  label,
  notes,
  basis,
  /** True when the field already holds something, which changes the action from
   *  an insert to a destructive replace. */
  fieldHasText,
  onTake,
}: {
  id: string;
  label: string;
  notes: readonly string[];
  basis: string;
  fieldHasText: boolean;
  onTake: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      id={id}
      className="mt-2 rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-3 py-2.5"
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────
          THE COPY-ALL BUTTON IS GONE FROM HERE. It asserted that the set was
          the unit; the bullets carry their own now. What is left is the label,
          which says where this came from, and the ⓘ, which says what from. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold leading-[16px] text-[var(--text-secondary)]">
          <Sparkles className="size-3 shrink-0" aria-hidden />
          {label}
        </span>
        <HoverNote
          triggerLabel={`What ${label.toLowerCase()} is based on`}
          triggerClassName="size-6 justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]"
          trigger={<Info className="size-3.5" aria-hidden />}
        >
          <span className="block text-[12px] leading-[17px] text-[var(--text-secondary)]">
            {basis}
          </span>
        </HoverNote>
      </div>

      {/* ── THE BULLETS ────────────────────────────────────────────────────
          A real `<ul>`. The count is a fact about the content that a screen
          reader announces from the list, so the list has to be a list. */}
      <ul className="mt-2 space-y-1.5">
        {notes.map((n) => (
          <NoteBullet key={n} text={n} />
        ))}
      </ul>

      {/* ── TAKE THE SET ───────────────────────────────────────────────────
          KEPT, AND FLAGGED. Per-bullet copy is the path these notes are shaped
          for, and this action takes all of them into the field as lines — which
          on a prose field ("Description of current clinical presentation") means
          a reader can end up signing a bulleted list where a paragraph belongs.
          It was not part of the change that made these notes, so it is not
          removed here. See the report. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!fieldHasText ? (
          <button
            type="button"
            onClick={onTake}
            className={cn(
              "-my-1 rounded-sm py-1 text-[12px] font-semibold leading-[17px] text-[var(--text-primary)] underline underline-offset-2",
              RING
            )}
          >
            {/* TODO-COPY */}
            Insert all notes
          </button>
        ) : confirming ? (
          /* ═══ NEVER SILENTLY DESTROY TYPED TEXT ═══
             The field holds something a person wrote. The confirm is inline and
             in the same place the action was, so the answer is where the
             question was asked. */
          <>
            <span className="text-[12px] leading-[17px] text-[var(--text-secondary)]">
              {/* TODO-COPY */}
              Replace what you have written?
            </span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onTake();
              }}
              className={cn(
                "-my-1 rounded-sm py-1 text-[12px] font-semibold leading-[17px] text-[var(--text-primary)] underline underline-offset-2",
                RING
              )}
            >
              {/* TODO-COPY */}
              Replace
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={cn(
                "-my-1 rounded-sm py-1 text-[12px] leading-[17px] text-[var(--text-secondary)] underline underline-offset-2",
                RING
              )}
            >
              {/* TODO-COPY */}
              Keep mine
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={cn(
              "-my-1 rounded-sm py-1 text-[12px] font-semibold leading-[17px] text-[var(--text-primary)] underline underline-offset-2",
              RING
            )}
          >
            {/* TODO-COPY */}
            Replace field text
          </button>
        )}
      </div>
    </div>
  );
}
