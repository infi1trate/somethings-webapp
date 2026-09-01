"use client";

// THE COMPOSER.
//
// ═══ EVERY CONTROL IS LABELLED, AND SEND IS A WORD ═══
//
// The surface this replaces put four unlabelled glyphs on the left — mic, camera,
// GIF, lightbulb — and a paper-plane on the right. Five icon-only controls in one
// strip, none of them named, one of which was the primary action of the entire
// screen. The lightbulb was the worst of them: no icon means "suggest something to
// say", so its function was undiscoverable by inspection.
//
// So the attachment controls keep their glyphs and gain accessible names plus
// visible tooltips, and SEND SAYS "SEND". It is the primary action on the surface;
// it can afford four characters.
//
// ═══ THE TEXTAREA GROWS, TO A CEILING ═══
//
// A single-line input silently hides what a mentor has written the moment it wraps,
// on a surface where the thing being written may be carefully worded. It grows to
// six lines and then scrolls inside itself — the ceiling exists so a long message
// cannot push the thread it is replying to off the screen.
//
// ═══ PHASE 1 SCOPE ═══
//
// The attachment controls are present, labelled and inert; Phase 3 gives the
// prompt-idea control its content and Phase 5 makes the composer the documentation
// takeover. Present-and-inert rather than absent, because their placement is part
// of what this phase is deciding.

import { useEffect, useRef, useState } from "react";
import { Camera, Lightbulb, Mic, Sticker } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Six lines, then it scrolls. `--type-message` is 16/24, so six lines of text
 *  plus the field's own padding. */
const MAX_ROWS = 6;

function AttachButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      // NAMED, always. `title` gives a pointer reader the same word `aria-label`
      // gives a screen reader — one string, so they cannot disagree.
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors",
        "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
        RING
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}

export function Composer({
  /** Whose thread this is, for the placeholder. */
  theirName,
  /** ═══ TEXT DROPPED IN FROM ELSEWHERE, UNSENT ═══
   *
   *  The escalation checklist offers suggested wording and one press puts it here.
   *  UNSENT, always: the mentor still says it in their own voice if they want to,
   *  and nothing reaches a teen that a mentor did not press Send on.
   *
   *  A NONCE rather than a plain string, because the same sentence may be inserted
   *  twice — a mentor who typed over it and wants it back. Keyed on the value alone,
   *  the second insert would be a no-op and the button would look broken. */
  insert,
  onSend,
  className,
}: {
  theirName: string;
  insert?: { text: string; nonce: number } | null;
  onSend?: (text: string) => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const canSend = value.trim().length > 0;

  /* REPLACES rather than appends, and then focuses with the caret at the end. A
     mentor pressing "put this in the message box" wants that sentence, not that
     sentence bolted onto a half-typed one — and the caret at the end is what lets
     them add to it immediately. */
  const lastInsert = useRef(insert?.nonce ?? 0);
  useEffect(() => {
    if (!insert || insert.nonce === lastInsert.current) return;
    lastInsert.current = insert.nonce;
    setValue(insert.text);
    const el = ref.current;
    if (!el) return;
    el.focus();
    // After the value has been committed, or the caret lands in the old text.
    requestAnimationFrame(() => {
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 24 * MAX_ROWS)}px`;
    });
  }, [insert]);

  const grow = (el: HTMLTextAreaElement) => {
    // Reset before measuring, or the height only ever ratchets up.
    el.style.height = "auto";
    const line = 24; // --type-message line-height
    const max = line * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  };

  const send = () => {
    if (!canSend) return;
    onSend?.(value.trim());
    setValue("");
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.focus();
    }
  };

  return (
    <div
      data-slot="composer"
      className={cn(
        "shrink-0 border-t border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3",
        className
      )}
    >
      <div className="flex items-end gap-1.5">
        <div className="flex shrink-0 items-center gap-0.5 pb-0.5">
          {/* TODO-COPY on all four. Each names the ACTION, not the object: "Record
              a voice note", not "Microphone" — a mentor deciding whether to press
              it is asking what will happen. */}
          <AttachButton icon={Camera} label="Add a photo" />
          <AttachButton icon={Mic} label="Record a voice note" />
          <AttachButton icon={Sticker} label="Add a GIF" />
          {/* The lightbulb, named. Phase 3 fills it. */}
          <AttachButton icon={Lightbulb} label="Suggest something to say" />
        </div>

        <label className="min-w-0 flex-1">
          <span className="sr-only">
            {/* TODO-COPY */}
            Message {theirName}
          </span>
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              grow(e.currentTarget);
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line. The convention every
              // messaging surface uses, and the one a mentor will have muscle
              // memory for from every other app they have open.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            /* TODO-COPY. Names the person, so the field is visibly about this
               conversation rather than being a generic box. */
            placeholder={`Message ${theirName}`}
            className={cn(
              "block max-h-[144px] w-full resize-none rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-3 py-2",
              "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              RING
            )}
            style={{
              font: "var(--type-message)",
              letterSpacing: "var(--type-message-tracking)",
            }}
          />
        </label>

        {/* ═══ SEND IS A WORD ═══
            The primary action of the surface, so it reads as one: a filled pill
            with a label, not a glyph a mentor has to recognise. Disabled until
            there is something to send, which is also what stops an empty message
            from being the easiest thing to do by accident. */}
        <button
          type="button"
          disabled={!canSend}
          onClick={send}
          className={cn(
            "flex h-9 shrink-0 items-center rounded-full px-4 transition-colors",
            canSend
              ? "bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
              : "bg-[var(--surface-s2)] text-[var(--text-muted)]",
            RING
          )}
          style={{ font: "var(--type-button)" }}
        >
          {/* TODO-COPY */}
          Send
        </button>
      </div>
    </div>
  );
}
