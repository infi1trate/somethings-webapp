"use client";

// READING A NOTE BACK.
//
// ═══ IN THE RAIL, NOT IN A DIALOG ═══
//
// The same reasoning as the composer, one step further on: the reason to open a note
// weeks later is almost always to check it against the conversation. A dialog covers
// the transcript at the exact moment a reader wants both.
//
// ═══ READ-ONLY, AND THAT IS DELIBERATE ═══
//
// A note is a record of what somebody observed at a time. Editing it would let the
// observation be rewritten after the fact, which is precisely what a safeguarding
// record must not permit — and on this surface it would let a mentor soften
// something a lead has already read.
//
// There is no delete either, for the same reason. What is missing is an amendment
// path — a second note that references the first — and that is a real gap rather
// than an omission, logged as design-system-gaps.md row 356.

import { ArrowLeft, Bell } from "lucide-react";
import { ContextReference } from "@/components/chat/documentation/context-reference";
import { PanelSection } from "@/components/chat/rail/rail-panel";
import type { ContextRef, Note } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayOnly(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function NoteDetail({
  note,
  onBack,
  onOpenReference,
}: {
  note: Note;
  onBack: () => void;
  onOpenReference: (ref: ContextRef) => void;
}) {
  return (
    <div data-slot="note-detail" className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className={cn(
          "-ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[var(--text-secondary)]",
          "transition-colors hover:text-[var(--text-primary)]",
          RING
        )}
        style={{ font: "var(--type-body)" }}
      >
        <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
        {/* TODO-COPY. Names where it goes, since History is where notes live. */}
        {/* The tab's name since support-beside-hub renamed it. TODO-COPY */}
        History
      </button>

      <div>
        <h3
          className="text-[var(--text-primary)]"
          style={{ font: "var(--type-card-title)" }}
        >
          {note.title}
        </h3>
        <p
          className="mt-1 text-[var(--text-muted)]"
          style={{ font: "var(--type-field-label)" }}
        >
          {/* TODO-COPY. Written when. `updatedAt` is not shown, because nothing can
              edit a note — if an amendment path lands (row 356) this line is where
              "amended" belongs. */}
          Written {when(note.createdAt)}
        </p>
      </div>

      {note.body && (
        <p
          className="whitespace-pre-wrap text-[var(--text-primary)]"
          style={{ font: "var(--type-body)" }}
        >
          {note.body}
        </p>
      )}

      {note.references.length > 0 && (
        /* ═══ THE PROVENANCE, AND IT IS TRAVERSABLE ═══
           The reason references exist is that a note stored away from what it
           describes becomes an assertion nobody can check — so every one of these
           goes back to the message in the thread. */
        <PanelSection
          label={note.references.length === 1 ? "About this message" : "About these messages"}
          divided
        >
          <div className="space-y-1.5">
            {note.references.map((r) => (
              <ContextReference
                key={r.messageId}
                reference={r}
                variant="chip"
                onOpen={() => onOpenReference(r)}
              />
            ))}
          </div>
        </PanelSection>
      )}

      {note.reminderAt && (
        <PanelSection divided>
          <p
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--band-sand-bg)] px-2.5 py-1 text-[var(--band-sand-fg)]"
            style={{ font: "var(--type-field-label)" }}
          >
            <Bell className="size-3 shrink-0" aria-hidden />
            {/* TODO-COPY */}
            Come back to this on {dayOnly(note.reminderAt)}
          </p>
        </PanelSection>
      )}
    </div>
  );
}
