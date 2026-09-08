"use client";

// THE REFERENCE CONTAINER — one component for the AI draft and for the
// suggested revision, because they are the same object with a different label.
//
// ═══ IT MUST NOT LOOK LIKE AN INPUT ═══
//
// The whole point of opt-in drafting is that the model's text is somewhere the
// supervisor visits rather than somewhere they have to clear. A container with
// a border and a fill sitting under a textarea reads as a second textarea, and
// a reader who types into it would be typing into nothing. So: no focusable
// text surface, no caret, no placeholder, and the only controls are the two
// that do something — copy, and take it.
//
// THE TEXT IS STILL SELECTABLE, deliberately, because partial copy is the
// honest middle path between "use all of this" and "use none of it" — and the
// provenance model says so: text carried across by hand registers as
// `authored`, which is the known limitation stated on `field-provenance.ts`.

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Info, Sparkles } from "lucide-react";
import { HoverNote } from "@/components/record/hover-note";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function AiDraftPanel({
  id,
  label,
  text,
  basis,
  /** True when the field already holds something, which changes the action from
   *  an insert to a destructive replace. */
  fieldHasText,
  onTake,
}: {
  id: string;
  label: string;
  text: string;
  basis: string;
  fieldHasText: boolean;
  onTake: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* A denied clipboard is not an error worth a dialog — the text is
         selectable, which is the fallback. */
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id={id}
      className="mt-2 rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-3 py-2.5"
    >
      {/* ── HEADER: what this is, where it came from, and how to take it ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold leading-[16px] text-[var(--text-secondary)]">
          <Sparkles className="size-3 shrink-0" aria-hidden />
          {label}
        </span>
        <HoverNote
          align="left"
          triggerLabel={`What ${label.toLowerCase()} is based on`}
          triggerClassName="size-6 justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]"
          trigger={<Info className="size-3.5" aria-hidden />}
        >
          <span className="block text-[12px] leading-[17px] text-[var(--text-secondary)]">
            {basis}
          </span>
        </HoverNote>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "-my-1 ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 text-[11.5px] leading-[16px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]",
            RING
          )}
        >
          {copied ? (
            <Check className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <Copy className="size-3.5 shrink-0" aria-hidden />
          )}
          {/* TODO-COPY */}
          {copied ? "Copied" : "Copy"}
        </button>
        {/* THE ANNOUNCE IS ITS OWN NODE, not the button's label. A screen
            reader that hears the button rename itself has been told the control
            changed, not that the copy happened. */}
        <span aria-live="polite" className="sr-only">
          {copied ? "Copied" : ""}
        </span>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <p className="mt-1.5 max-w-prose whitespace-pre-line text-[13px] leading-[19px] text-[var(--text-primary)]">
        {text}
      </p>

      {/* ── THE ACTION, AND THE CONFIRM THAT GUARDS TYPED TEXT ──────────── */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!fieldHasText ? (
          <button
            type="button"
            onClick={onTake}
            className={cn(
              /* `py-1 -my-1` — 25px of TARGET without 8px of layout. WCAG 2.2
                 §2.5.8 wants 24px; a 17px-tall text button clears it only on the
                 spacing exception, which is thin cover for the primary action in
                 this panel. The negative margin gives the padding back to the
                 row so the measured rhythm is unchanged. */
              "-my-1 rounded-sm py-1 text-[12px] font-semibold leading-[17px] text-[var(--text-primary)] underline underline-offset-2",
              RING
            )}
          >
            {/* TODO-COPY */}
            Insert into field
          </button>
        ) : confirming ? (
          /* ═══ NEVER SILENTLY DESTROY TYPED TEXT ═══
             The field holds something a person wrote. The confirm is inline and
             in the same place the action was, so the answer is where the
             question was asked — the pattern the discard-draft control uses. */
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
                /* `py-1 -my-1` — 25px of TARGET without 8px of layout. WCAG 2.2
                 §2.5.8 wants 24px; a 17px-tall text button clears it only on the
                 spacing exception, which is thin cover for the primary action in
                 this panel. The negative margin gives the padding back to the
                 row so the measured rhythm is unchanged. */
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
              /* `py-1 -my-1` — 25px of TARGET without 8px of layout. WCAG 2.2
                 §2.5.8 wants 24px; a 17px-tall text button clears it only on the
                 spacing exception, which is thin cover for the primary action in
                 this panel. The negative margin gives the padding back to the
                 row so the measured rhythm is unchanged. */
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
