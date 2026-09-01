"use client";

// WRITING A NOTE — the rail, given over to it.
//
// ═══ A TAKEOVER, DESIGNED AS ONE ═══
//
// Writing a note is not a glance. It is the one thing on this surface a mentor does
// with both hands, and it is the thing a lead or a supervisor will read weeks later
// — so it gets the whole rail, with its own header and its own way out, rather than
// being squeezed into a section under three other sections.
//
// The alternative was a modal, and it fails here for the reason the activity
// builder's modal failed: the evidence is the conversation immediately to the left.
// A mentor writing "seemed low about the schedule change" is looking back at the
// messages while they write it. A dialog covers them and traps the focus, so
// checking a detail means losing the draft.
//
// THE TAKEOVER IS EXPLICIT, not implied by an empty panel. A header that says what
// is being written and a Cancel that says what leaving does — because a rail whose
// contents silently changed is a rail a mentor does not know how to get out of.
//
// ═══ REFERENCES ARE THE POINT, NOT AN ATTACHMENT ═══
//
// The primary way to start a note is tagging a message (see `MessageActions`), so a
// composer usually opens with one already attached. They sit ABOVE the body, not
// below it: what a mentor is writing about should be readable while they write.
//
// A note with no references is allowed — some observations are not about one
// message — but the empty state says so rather than looking broken.

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ContextReference } from "@/components/chat/documentation/context-reference";
import { PanelSection } from "@/components/chat/rail/rail-panel";
import type { ContextRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ REMINDERS ARE THREE CHOICES, NOT A DATE PICKER ═══
 *
 *  What a mentor wants from a reminder on a note is "come back to this" at one of a
 *  few human distances. A calendar makes them pick a date, which means deciding
 *  what date, which is a question they do not have an answer to — and a date picker
 *  in a 320px rail is a component the size of the panel.
 *
 *  TODO-COPY. Relative labels rather than dates, because the choice is about
 *  distance and a rendered date would go stale in the draft. */
const REMINDERS: Array<{ id: string; label: string; days: number | null }> = [
  { id: "none", label: "No reminder", days: null },
  { id: "tomorrow", label: "Tomorrow", days: 1 },
  { id: "week", label: "In a week", days: 7 },
];

export function NoteComposer({
  /** Whose conversation this is, for copy that names them. */
  theirName,
  /** Pre-attached from the message that started this. */
  initialReferences,
  onCancel,
  onSave,
}: {
  theirName: string;
  initialReferences: ContextRef[];
  onCancel: () => void;
  onSave: (note: {
    title: string;
    body: string;
    references: ContextRef[];
    reminderAt: number | null;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [refs, setRefs] = useState<ContextRef[]>(initialReferences);
  const [reminder, setReminder] = useState("none");

  /* ═══ A TITLE IS REQUIRED, A BODY IS NOT ═══
     The title is what a lead sees in a list of forty notes, so a note without one
     is a note nobody will ever find again. The body can be empty: sometimes the
     whole observation is the title plus the message it points at, and forcing prose
     produces filler. */
  const canSave = title.trim().length > 0;

  const field =
    "block w-full rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]";

  return (
    <div data-slot="note-composer" className="space-y-4">
      {/* ═══ THE TAKEOVER SAYS SO ═══ */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            className="text-[var(--text-primary)]"
            style={{ font: "var(--type-card-title)" }}
          >
            {/* TODO-COPY */}
            New note
          </h3>
          <p
            className="mt-0.5 text-[var(--text-secondary)]"
            style={{ font: "var(--type-field-label)" }}
          >
            {/* TODO-COPY. Names who will read it, which is the thing that changes
                how a mentor writes. */}
            On {theirName}. Visible to your lead.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "-mt-1 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-[var(--text-secondary)]",
            "transition-colors hover:text-[var(--text-primary)]",
            RING
          )}
          style={{ font: "var(--type-body)" }}
        >
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
          {/* TODO-COPY. "Cancel", not "Back" — leaving discards the draft, and the
              word should say that rather than implying navigation. */}
          Cancel
        </button>
      </div>

      {/* ═══ REFERENCES FIRST ═══ */}
      <PanelSection
        label={refs.length === 1 ? "About this message" : "About these messages"}
      >
        {refs.length === 0 ? (
          <p
            className="text-[var(--text-muted)]"
            style={{ font: "var(--type-body)" }}
          >
            {/* TODO-COPY. Allowed, and it says how to attach one rather than
                leaving a mentor with an empty box. */}
            Nothing attached. You can tag a message from the conversation to point
            this note at it.
          </p>
        ) : (
          <div className="space-y-2">
            {refs.map((r) => (
              <ContextReference
                key={r.messageId}
                reference={r}
                onRemove={() => setRefs((x) => x.filter((y) => y.messageId !== r.messageId))}
              />
            ))}
          </div>
        )}
      </PanelSection>

      <label className="block">
        <span
          className="mb-1 block text-[var(--text-muted)]"
          style={{
            font: "var(--type-field-label)",
            letterSpacing: "var(--type-field-label-tracking)",
          }}
        >
          {/* TODO-COPY */}
          What happened
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          /* TODO-COPY. A PLAIN-LANGUAGE EXAMPLE, not "Enter a title". It shows the
             register the field wants — an observation, not a diagnosis — which is
             the thing a placeholder can teach and a label cannot. */
          placeholder="Sleep has come up three times this month"
          className={cn(field, RING)}
          style={{ font: "var(--type-body)" }}
        />
      </label>

      <label className="block">
        <span
          className="mb-1 block text-[var(--text-muted)]"
          style={{
            font: "var(--type-field-label)",
            letterSpacing: "var(--type-field-label-tracking)",
          }}
        >
          {/* TODO-COPY. "Optional" IN THE LABEL, so a mentor knows before they
              start reading the field rather than after they have tried to fill it. */}
          Anything else (optional)
        </span>
        <textarea
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          /* TODO-COPY */
          placeholder="Context, or what you plan to do next."
          className={cn(field, "resize-none", RING)}
          style={{ font: "var(--type-body)" }}
        />
      </label>

      <fieldset>
        <legend
          className="mb-1.5 text-[var(--text-muted)]"
          style={{
            font: "var(--type-field-label)",
            letterSpacing: "var(--type-field-label-tracking)",
          }}
        >
          {/* TODO-COPY */}
          Come back to this
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {REMINDERS.map((r) => {
            const on = reminder === r.id;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => setReminder(r.id)}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-full px-3 transition-colors",
                  on
                    ? "bg-[var(--surface-s2)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                  RING
                )}
                style={{ font: "var(--type-body)" }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <button
        type="button"
        disabled={!canSave}
        onClick={() => {
          const chosen = REMINDERS.find((r) => r.id === reminder)!;
          onSave({
            title: title.trim(),
            body: body.trim(),
            references: refs,
            reminderAt:
              chosen.days === null ? null : Date.now() + chosen.days * 86_400_000,
          });
        }}
        className={cn(
          "inline-flex min-h-10 w-full items-center justify-center rounded-full transition-colors",
          canSave
            ? "bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
            : "bg-[var(--surface-s2)] text-[var(--text-muted)]",
          RING
        )}
        style={{ font: "var(--type-button)" }}
      >
        {/* TODO-COPY. "Save note", not "Submit" — nothing is being submitted to
            anybody, and the note is the object. */}
        Save note
      </button>
    </div>
  );
}
