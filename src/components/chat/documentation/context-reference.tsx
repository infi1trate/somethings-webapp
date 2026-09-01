"use client";

// A POINTER BACK INTO THE CONVERSATION.
//
// ═══ WHY A NOTE CARRIES REFERENCES AT ALL ═══
//
// A note written about a conversation and stored away from it becomes an assertion
// nobody can check. "Seemed low about the schedule change" is a summary; three
// weeks later the mentor who wrote it, the lead who reads it, and the supervisor
// who has to act on it all need to know WHAT WAS ACTUALLY SAID — and the difference
// between a note that can be traced and one that cannot is the difference between
// documentation and hearsay.
//
// So tagging a message is the primary way to start a note (see `MessageActions`),
// and the reference travels with it: sender, time, and the message's first line.
//
// ═══ FIRST LINE, NOT THE WHOLE MESSAGE ═══
//
// Enough to recognise it, short enough to sit inside a composer beside two others.
// The full message is one press away in the thread, which is where it belongs —
// copying it into the note would make the note a second, diverging copy of the
// transcript.
//
// ═══ TWO SIZES, ONE COMPONENT ═══
//
// `card` inside the composer, where a mentor is deciding whether the right message
// is attached. `chip` inside a note's detail and a Timeline row, where the note is
// the subject and the references are its provenance. Same fields, same order.

import { CornerDownRight, X } from "lucide-react";
import { clockTime } from "@/components/chat/thread/message-bubble";
import type { ContextRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY. Trimmed to something that fits a 320px rail on one or two lines. A
 *  hard truncation with an ellipsis rather than a wrap, because a reference that
 *  grows to four lines stops being a reference and starts being a quote. */
export function firstLineOf(text: string, limit = 72): string {
  const line = text.split("\n")[0].trim();
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
}

export function ContextReference({
  /* ═══ `reference`, NOT `ref` ═══
     The first version named this prop `ref`, which is RESERVED: React does not pass
     it through to a function component as an ordinary prop, it treats it as a ref
     forward. So the value would have arrived undefined and the component would have
     rendered a reference to nobody. `react-hooks/refs` caught it as five errors
     about accessing refs during render, which is exactly what it looked like from
     the outside. */
  reference,
  variant = "card",
  /** Present in the composer, absent in a note's detail — a reference on a saved
   *  note is part of the record and is not editable from a reading view. */
  onRemove,
  /** Jump to the message in the thread. The whole point of the reference. */
  onOpen,
}: {
  reference: ContextRef;
  variant?: "card" | "chip";
  onRemove?: () => void;
  onOpen?: () => void;
}) {
  const meta = `${reference.senderName} · ${clockTime(reference.at)}`;

  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={onOpen}
        /* TODO-COPY. The whole reference spoken, because the visual layout — meta
           above, quote below — is not an order a screen reader infers. */
        aria-label={`Go to ${reference.senderName}'s message at ${clockTime(reference.at)}: ${reference.firstLine}`}
        className={cn(
          "flex w-full items-start gap-1.5 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-2.5 py-1.5 text-left",
          "transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        <CornerDownRight
          className="mt-0.5 size-3 shrink-0 text-[var(--text-muted)]"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span
            className="block text-[var(--text-muted)]"
            style={{ font: "var(--type-field-label)" }}
          >
            {meta}
          </span>
          <span
            className="block truncate text-[var(--text-secondary)]"
            style={{ font: "var(--type-body)" }}
          >
            {reference.firstLine}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span
          className="block text-[var(--text-muted)]"
          style={{ font: "var(--type-field-label)" }}
        >
          {meta}
        </span>
        {/* ═══ SET AS SOMEONE ELSE'S WORDS ═══
            Italic on a left rule, the same treatment the Tasks pane's quote block
            uses — and for the same reason: this is the one place in a note where a
            teen's own words appear, and it must never be mistakable for the
            mentor's summary of them. */}
        <span className="mt-1 block border-l-2 border-[color:var(--border-contour)] pl-2.5">
          <span
            className="block italic text-[var(--text-primary)]"
            style={{ font: "var(--type-body)" }}
          >
            {reference.firstLine}
          </span>
        </span>
      </span>
      {onRemove && (
        <button
          type="button"
          /* TODO-COPY */
          aria-label={`Remove the reference to ${reference.senderName}'s message`}
          title="Remove"
          onClick={onRemove}
          className={cn(
            "-my-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)]",
            "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
