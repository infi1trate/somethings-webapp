"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ADD TO ESCALATION (pack v3.0, Workstream C)
//
// The mentor attaches one message from the thread to the open escalation's
// timeline, with an optional note. It lands as a completed event both lenses
// see, quote-framed with sender and time — APPEND-ONLY, once per message.

import { useId, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function AddMomentDialog({
  message,
  senderName,
  onOpenChange,
  onAdd,
}: {
  /** The message being added; null closes the dialog. */
  message: ChatMessage | null;
  senderName: string;
  onOpenChange: (open: boolean) => void;
  onAdd: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const id = useId();
  return (
    <Dialog
      open={!!message}
      onOpenChange={(o) => {
        if (!o) setNote("");
        onOpenChange(o);
      }}
    >
      <DialogContent data-slot="add-moment-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{/* TODO-COPY */}Add to escalation</DialogTitle>
          <DialogDescription>
            {/* TODO-COPY */}
            It goes on the escalation&rsquo;s timeline, where your supervisor sees it too.
          </DialogDescription>
        </DialogHeader>
        {message && (
          <div className="space-y-4">
            <figure className="rounded-[var(--radius-inset)] border-l-2 border-[color:var(--border-default)] bg-[var(--surface-s1)] py-2 pr-3 pl-3">
              <blockquote className="text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
                &ldquo;{message.text}&rdquo;
              </blockquote>
              <figcaption className="mt-1 tabular-nums text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
                {senderName}, {TIME.format(message.at)}
              </figcaption>
            </figure>
            <div>
              <label htmlFor={id} className="mb-1.5 block text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
                {/* TODO-COPY */}
                Note (optional)
              </label>
              <textarea
                id={id}
                data-moment-note
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={cn("block w-full resize-none rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]", RING)}
                style={{ font: "var(--type-body)" }}
              />
            </div>
            <button
              type="button"
              data-moment-add
              onClick={() => {
                onAdd(note);
                setNote("");
                onOpenChange(false);
              }}
              className={cn("flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--text-primary)] px-4 text-[var(--text-inverse)] hover:opacity-90", RING)}
              style={{ font: "var(--type-button)" }}
            >
              {/* TODO-COPY */}
              Add to escalation
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
