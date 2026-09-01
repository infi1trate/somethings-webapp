"use client";

// WHAT WAS SENT, AND WHAT HAPPENED TO IT.
//
// ═══ THIS IS THE ONE PLACE A DIALOG IS RIGHT ═══
//
// The builder deliberately stays in the rail, because building a set is a decision
// about a person and the evidence is the conversation beside it. Reading back
// something already sent is the opposite: it is a lookup, it is short, and nothing
// in the thread informs it. A dialog is the correct shape for a lookup — it comes
// with a focus trap and an Escape, and dismissing it puts the mentor back exactly
// where they were.
//
// ═══ READ-ONLY, EXCEPT FOR RESCIND ═══
//
// The contents cannot be edited. A set that has reached a teen is a thing that
// happened, and an "edit" would either change what she is looking at mid-answer or
// change the record of what was asked. Rescind is the honest version of that
// intention: it takes the whole thing back, says so, and leaves the history intact.
//
// ═══ RESCIND IS ELIGIBLE ONLY BEFORE IT IS OPENED ═══
//
// Once a teen has opened a set, pulling it out from under her is worse than leaving
// it — she has read the questions, and making them disappear is the interaction
// equivalent of pretending they were never asked. So the window is "sent and not
// yet opened", the sheet says which state it is in, and when the window has closed
// it says WHY rather than hiding the control.

import { Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { activityById, metaLine } from "@/lib/chat/activities";
import { PanelRow } from "@/components/chat/rail/rail-panel";
import type { SentArtifact } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Whether a set can still be taken back. See the module note. */
export function canRescind(a: SentArtifact): boolean {
  return !a.rescindedAt && a.completion.openedAt === null;
}

/** TODO-COPY. Where a set has got to, in one phrase, from the record rather than
 *  from a stored status — a status field and a completion array would be two
 *  sources for one fact. */
export function completionLabel(a: SentArtifact): string {
  if (a.rescindedAt) return "Taken back";
  const done = a.completion.completedItemIds.length;
  if (a.completion.openedAt === null) return "Not opened yet";
  if (done === 0) return "Opened, nothing answered yet";
  if (done >= a.items.length) return "All answered";
  return `${done} of ${a.items.length} answered`;
}

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DetailSheet({
  artifact,
  /** The teen's first name, for copy that has to name who is on the other end. */
  theirName,
  open,
  onOpenChange,
  onRescind,
}: {
  artifact: SentArtifact | null;
  theirName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescind: (artifact: SentArtifact) => void;
}) {
  if (!artifact) return null;
  const def = activityById(artifact.activityId);
  const rescindable = canRescind(artifact);
  const done = new Set(artifact.completion.completedItemIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{def.name}</DialogTitle>
          <DialogDescription>
            {/* TODO-COPY. Sent when, and where it has got to — the two things a
                mentor opening this is actually asking. */}
            Sent {when(artifact.sentAt)} · {completionLabel(artifact)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ═══ THE CONTENTS, WITH WHAT HAS BEEN ANSWERED MARKED ═══
              Marked with a WORD, not a tick: on a list of three prompts where one
              is answered, a tick and no tick differ by one small glyph, and the
              difference is the whole reason a mentor opened this. */}
          <ol className="space-y-2">
            {artifact.items.map((item, i) => {
              const answered = done.has(item.id);
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-2 rounded-[var(--radius-inset)] px-3 py-2.5",
                    answered
                      ? "bg-[var(--band-sage-bg)] text-[var(--band-sage-fg)]"
                      : "bg-[var(--surface-s1)] text-[var(--text-primary)]"
                  )}
                >
                  <span
                    aria-hidden
                    className="mt-px shrink-0 tabular-nums opacity-70"
                    style={{ font: "var(--type-field-label)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1" style={{ font: "var(--type-body)" }}>
                    {item.text}
                  </span>
                  {answered && (
                    <span
                      className="shrink-0 whitespace-nowrap opacity-80"
                      style={{ font: "var(--type-field-label)" }}
                    >
                      {/* TODO-COPY */}
                      Answered
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="grid grid-cols-2 gap-4">
            <PanelRow label="Set">{metaLine(def)}</PanelRow>
            <PanelRow label="Opened">
              {artifact.completion.openedAt
                ? when(artifact.completion.openedAt)
                : /* TODO-COPY. An em dash, not "N/A" — the fact is that it has not
                     happened, and an abbreviation for "not applicable" says the
                     wrong thing about something that still might. */
                  "—"}
            </PanelRow>
          </div>

          {/* ═══ RESCIND, OR THE REASON IT IS NOT AVAILABLE ═══ */}
          <div className="border-t border-[color:var(--border-subtle)] pt-4">
            {artifact.rescindedAt ? (
              <p
                className="text-[var(--text-secondary)]"
                style={{ font: "var(--type-body)" }}
              >
                {/* TODO-COPY. Past tense and specific. The record of the taking-back
                    is itself a fact worth stating plainly. */}
                You took this back on {when(artifact.rescindedAt)}. {theirName} can no
                longer see it.
              </p>
            ) : rescindable ? (
              <div className="space-y-2.5">
                <p
                  className="text-[var(--text-secondary)]"
                  style={{ font: "var(--type-body)" }}
                >
                  {/* TODO-COPY. Says exactly what will happen, including the part a
                      mentor would otherwise have to guess: the history stays. */}
                  {theirName} hasn&apos;t opened this yet, so you can still take it
                  back. It will disappear from her side; the record that you sent it
                  stays here.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onRescind(artifact);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3.5 text-[var(--text-primary)]",
                    "transition-colors hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                  style={{ font: "var(--type-body)" }}
                >
                  <Undo2 className="size-3.5 shrink-0" aria-hidden />
                  {/* ═══ NOT A DESTRUCTIVE-STYLED BUTTON ═══
                      Nothing is destroyed: the history survives and the mentor can
                      send the set again. A red button would tell a mentor this is
                      dangerous, and then they would hesitate over the one action
                      here that exists to let them undo a mistake. TODO-COPY. */}
                  Take it back
                </button>
              </div>
            ) : (
              <p
                className="text-[var(--text-secondary)]"
                style={{ font: "var(--type-body)" }}
              >
                {/* TODO-COPY. THE REASON, not a disabled button. A greyed-out
                    control teaches a mentor that the action exists and not why they
                    cannot use it — and the why here is the part that matters, because
                    it is about the teen rather than about a rule. */}
                {theirName} has opened this, so it can&apos;t be taken back. Pulling
                questions she has already read would be worse than leaving them.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
