"use client";

// THE TIMELINE — what has happened, and where notes live.
//
// ═══ DOCUMENTATION IS HOMED HERE, NOT UNDER THE AI SUMMARY ═══
//
// The surface this replaces put Documentation inside the Assist panel, below an
// AI-generated summary of the mentorship. That is a real architectural claim and it
// is the wrong one: it makes a mentor's own written observations look like
// supporting material for a machine's paragraph, and it puts the most durable
// record on this surface — the thing a lead reads weeks later, the thing that
// matters in a safeguarding review — inside a panel whose other contents are a
// suggestion the mentor can dismiss.
//
// Notes belong with the rest of the record of what happened: beside the activities
// sent and the escalations raised, in time order, because that is how anyone reading
// back will actually need them. Assist suggests; Timeline records. Nothing a mentor
// wrote is a child of anything a model produced.
//
// ═══ ONE CHRONOLOGY, TWO KINDS OF ENTRY ═══
//
// Notes and events, merged by time, newest first — the opposite of the transcript,
// because a timeline is scanned for "what has been going on lately" rather than
// read forward. Events render through the same `EventChip` the thread uses (see its
// note on why one component), and notes render as rows that open.

import { Bell, FileText } from "lucide-react";
import { EventChip } from "@/components/chat/thread/event-chip";
import { PanelEmpty, PanelSection } from "@/components/chat/rail/rail-panel";
import type { ChatEvent, Note } from "@/lib/chat/types";
import { LIVE_ID } from "@/lib/record/subject";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY. Day granularity, because a timeline is scanned by day — the clock
 *  time is on each entry. */
function dayLabel(at: number, now: number): string {
  const a = new Date(at);
  const n = new Date(now);
  const days = Math.round(
    (new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() -
      new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) /
      86_400_000
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return a.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(a.getFullYear() === n.getFullYear() ? {} : { year: "numeric" }),
  });
}

function NoteRow({
  note,
  onOpen,
}: {
  note: Note;
  onOpen: (note: Note) => void;
}) {
  return (
    <button
      type="button"
      data-slot="timeline-note"
      onClick={() => onOpen(note)}
      /* TODO-COPY. Named as a note, so it is distinguishable from an event row by
         something other than its glyph. */
      aria-label={`Note: ${note.title}`}
      className={cn(
        "flex w-full items-start gap-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-2.5 py-2 text-left",
        "transition-colors hover:bg-[var(--tint-hover)]",
        RING
      )}
    >
      <FileText
        className="mt-0.5 size-3.5 shrink-0 text-[var(--text-muted)]"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className="block text-[var(--text-primary)]"
          style={{ font: "var(--type-body)" }}
        >
          {note.title}
        </span>
        <span
          className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[var(--text-muted)]"
          style={{ font: "var(--type-field-label)" }}
        >
          {/* THE PROVENANCE, AS A COUNT. A note pointing at two messages is a
              different kind of claim from one pointing at none, and that is worth
              knowing before opening it. */}
          {note.references.length > 0 && (
            <span>
              {note.references.length === 1
                ? "1 message"
                : `${note.references.length} messages`}
            </span>
          )}
          {note.reminderAt && (
            <span className="inline-flex items-center gap-1">
              <Bell className="size-3 shrink-0" aria-hidden />
              {/* TODO-COPY */}
              Reminder set
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export function TimelinePanel({
  events,
  notes,
  now,
  theirName,
  /** Null on a support thread — a colleague's conversation has no teen to document.
   *  Absent rather than disabled, so the button is not there to be pressed. */
  onNewNote,
  onOpenNote,
  onOpenEvent,
  nameActor,
  /** So the retracted-send treatment matches the thread's. */
  rescindedArtifactIds,
}: {
  events: ChatEvent[];
  notes: Note[];
  now: number;
  theirName: string;
  onNewNote?: () => void;
  onOpenNote: (note: Note) => void;
  onOpenEvent?: (event: ChatEvent) => void;
  /** Who did it, by actor id (pack v3.0, E1). */
  nameActor?: (actorId: string) => string;
  rescindedArtifactIds: Set<string>;
}) {
  /** ═══ NEWEST FIRST, AND THAT IS THE OPPOSITE OF THE TRANSCRIPT ═══
   *  A transcript is read forward; a timeline is scanned for what has been going on
   *  lately. Grouped by day, because that is the granularity somebody reading back
   *  actually asks in. */
  type Entry =
    | { kind: "event"; at: number; event: ChatEvent }
    | { kind: "note"; at: number; note: Note };
  const merged: Entry[] = [
    ...events.map((e) => ({ kind: "event" as const, at: e.at, event: e })),
    ...notes.map((n) => ({ kind: "note" as const, at: n.createdAt, note: n })),
  ].sort((a, b) => b.at - a.at);

  const groups: Array<{ day: string; entries: Entry[] }> = [];
  for (const entry of merged) {
    const day = dayLabel(entry.at, now);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }

  return (
    <div className="space-y-4">
      {/* ═══ WRITING A NOTE STARTS HERE TOO ═══
          Tagging a message is the PRIMARY entry — it is how a note gets its
          provenance — but not every observation is about one message, so the panel
          that owns notes offers one directly. Second, not first: the label says
          which path attaches evidence. */}
      {onNewNote && (
        <button
          type="button"
          data-slot="new-note"
          onClick={onNewNote}
          className={cn(
            "inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border border-[color:var(--border-contour)] text-[var(--text-primary)]",
            "transition-colors hover:bg-[var(--tint-hover)]",
            RING
          )}
          style={{ font: "var(--type-body)" }}
        >
          <FileText className="size-3.5 shrink-0" aria-hidden />
          {/* TODO-COPY */}
          Write a note
        </button>
      )}

      {merged.length === 0 ? (
        <PanelEmpty title="What has happened">
          {/* TODO-COPY. Names what lands here, including the path that attaches
              evidence — which is the thing a mentor would otherwise never find. */}
          Activities sent, notes written and escalations raised will appear here. To
          write a note about something {theirName} said, tag the message in the
          conversation.
        </PanelEmpty>
      ) : (
        groups.map((group, i) => (
          <PanelSection key={group.day} label={group.day} divided={i > 0}>
            <div className="space-y-1.5">
              {group.entries.map((entry) =>
                entry.kind === "note" ? (
                  <NoteRow
                    key={entry.note.id}
                    note={entry.note}
                    onOpen={onOpenNote}
                  />
                ) : (
                  <EventChip
                    key={entry.event.id}
                    event={entry.event}
                    variant="row"
                    actorName={nameActor ? nameActor(entry.event.actorId) : entry.event.actorId === LIVE_ID ? "You" : theirName}
                    retracted={
                      entry.event.kind === "activity-sent" &&
                      rescindedArtifactIds.has(entry.event.artifactId)
                    }
                    onOpen={onOpenEvent}
                  />
                )
              )}
            </div>
          </PanelSection>
        ))
      )}
    </div>
  );
}
