"use client";

// THE COMMENT COMPOSER — R2.
//
// ═══ ONE FIELD. NOTHING ELSE. ═══
//
// A plain-text field, Save, Cancel. No formatting, no attachments, no category
// picker — the brief is explicit and it is right: every additional control is a
// decision imposed on someone whose actual intent was "this bit is wrong". A
// category picker in particular converts a five-second note into a taxonomy
// question, and the taxonomy would be guessed by the person least able to guess
// it.
//
// ═══ THE CONFIRM IS CONDITIONAL, AND THAT IS THE POINT ═══
//
// Dirty field → confirm, because unsaved words are the one thing here that cannot
// be recovered. Clean field → discard silently, because a dialog asking whether
// to discard nothing is pure noise and teaches the reader to dismiss dialogs
// without reading them.
//
// ═══ COPY ═══
//
// `Save comment`, not `Submit` — the button states what happens. And the action
// name persists into the confirmation: the discard dialog's keep-going button
// says `Keep writing`, its destructive one says `Discard comment`, so the word
// the reader chose is the word they see again.

import { useEffect, useRef, useState } from "react";
import { BODY_MAX } from "@/lib/anno/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function AnnoComposer({
  x,
  y,
  saving,
  error,
  onSave,
  onCancel,
  onDirtyChange,
}: {
  /** Viewport coordinates of the ghost pin this is anchored to. */
  x: number;
  y: number;
  saving: boolean;
  error: string | null;
  onSave: (body: string) => void;
  onCancel: () => void;
  /** Reported upward so the layer's Esc handler knows whether to confirm — the
   *  key is handled at the layer, because Esc must work "from anywhere". */
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);

  /* Focus on mount via a callback ref rather than an effect — the field exists
     for exactly one reason and a reviewer who just clicked should be typing. */
  const attachField = (el: HTMLTextAreaElement | null) => {
    fieldRef.current = el;
    el?.focus();
  };

  const canSave = value.trim().length > 0 && !saving;

  /* ═══ PLACEMENT: FLIP TOWARD THE VIEWPORT, NOT OFF IT ═══
     Anchored below-right of the pin by default, and flipped when that would put
     it past an edge. Measured against the real viewport rather than assumed,
     because a pin near the bottom of a 900px window is common and a composer
     hanging off the screen is unusable. */
  const W = 288;
  const H = 168;
  const GAP = 14;
  const flipX = typeof window !== "undefined" && x + GAP + W > window.innerWidth - 8;
  const flipY = typeof window !== "undefined" && y + GAP + H > window.innerHeight - 8;

  useEffect(() => {
    onDirtyChange(value.trim().length > 0);
  }, [value, onDirtyChange]);

  return (
    <div
      data-anno-composer
      role="dialog"
      aria-label="New comment"
      /* `pointer-events: auto` — the layer root is `none`. Clicks inside must not
         reach the product, and must not reach the capture surface either, which
         is why the stop is here rather than only on the field. */
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "pointer-events-auto absolute flex flex-col gap-2 rounded-[var(--radius-control)] p-3",
        // THE DEV BAR'S OWN CHROME — same surface, same border, same shadow. The
        // annotation UI is not product and must not look like it.
        "border border-[color:var(--border-contour)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]"
      )}
      style={{
        width: W,
        left: flipX ? x - GAP - W : x + GAP,
        top: flipY ? y - GAP - H : y + GAP,
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="sr-only">Your comment</span>
        <textarea
          ref={attachField}
          value={value}
          maxLength={BODY_MAX}
          rows={3}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            /* ⌘/Ctrl+Enter saves. Plain Enter inserts a newline — a comment is
               prose, and a stray Return that submits a half-written sentence is
               the worst possible default here. Esc is NOT handled locally; it
               belongs to the layer so it works with focus anywhere. */
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSave) {
              e.preventDefault();
              onSave(value.trim());
            }
          }}
          placeholder="What's wrong here?"
          className={cn(
            "w-full resize-none rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-2 py-1.5",
            "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            RING
          )}
          style={{ font: "var(--type-body)" }}
        />
      </label>

      {error && (
        <p className="text-[12px] leading-[16px] text-[var(--state-error)]">{error}</p>
      )}

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "rounded-full px-2.5 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)]",
            RING
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave(value.trim())}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-semibold transition-colors",
            canSave
              ? "bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
              : "bg-[var(--surface-s2)] text-[var(--text-muted)]",
            RING
          )}
        >
          {/* STATES WHAT HAPPENS. Not "Submit", and it keeps saying "comment" so
              the word survives into the discard confirmation. */}
          {saving ? "Saving…" : "Save comment"}
        </button>
      </div>
    </div>
  );
}
