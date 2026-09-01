"use client";

// THE RAIL — four panels behind four LABELLED tabs.
//
// ═══ THE TABS CARRY WORDS. THIS IS THE WHOLE POINT OF THE COMPONENT ═══
//
// The surface this replaces put four unlabelled icons in the rail's top-right
// corner: a sparkle, a person, a grid, a clock. Nothing named them, nothing
// showed which was selected, and there is no icon in any vocabulary that means
// "documentation timeline" — so the only way to learn what the grid did was to
// press it, and the only way to remember was to have pressed it recently.
//
// Four words solve it, and cost 28 pixels of height. A mentor can see which panel
// they are in, a screen reader announces "Toolkit, tab, 3 of 4", and nobody has
// to build a mental map of glyphs.
//
// `SegmentedControl` with `semantics="tabs"` is used rather than a hand-rolled
// row, because it already carries the parts that are easy to get wrong: roving
// tabindex so Tab leaves the control instead of walking it, ←/→/Home/End moving
// selection and focus together, `aria-controls` pointing only from the selected
// tab (the others' panels are not in the DOM), and a measured thumb.
//
// ═══ THE PANEL SET DEPENDS ON `kind`, NOT ON A SECOND RAIL ═══
//
// A support thread has no teen profile to read and no activities to send. It gets
// two tabs, from the same component, because the alternative is a second rail
// that starts identical and drifts.

import { useId } from "react";
import { SegmentedControl } from "@/components/record/segmented-control";
import { PanelEmpty, PanelShell } from "@/components/chat/rail/rail-panel";
import { ToolkitPanel } from "@/components/chat/rail/toolkit";
import { TimelinePanel } from "@/components/chat/rail/timeline";
import { NoteComposer } from "@/components/chat/documentation/note-composer";
import { NoteDetail } from "@/components/chat/documentation/note-detail";
import type {
  ActivityId,
  ChatEvent,
  ChatThread,
  ContextRef,
  Note,
  SentArtifact,
  SentArtifactItem,
} from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export type RailTab = "assist" | "profile" | "toolkit" | "timeline";

/** TODO-COPY. Short enough that four fit a 320px column at 11px without
 *  truncating — measured, not assumed. */
const LABEL: Record<RailTab, string> = {
  assist: "Assist",
  profile: "Profile",
  toolkit: "Toolkit",
  timeline: "Timeline",
};

/** WHICH TABS A THREAD GETS. A support thread has no profile canvas and no
 *  activity shelf; it keeps Assist and Timeline, which are about the working
 *  relationship rather than about a teen. */
export function tabsFor(kind: ChatThread["kind"]): RailTab[] {
  return kind === "teen"
    ? ["assist", "profile", "toolkit", "timeline"]
    : ["assist", "timeline"];
}

/** ═══ WHAT THE TIMELINE PANEL IS SHOWING ═══
 *  Its own three-way mode, held by the PAGE rather than here — because tagging a
 *  message in the thread has to be able to put the rail into `composing`, and a
 *  mode that lived in this component could only be set from inside it. */
export type RailMode =
  | { kind: "list" }
  | { kind: "composing"; references: ContextRef[] }
  | { kind: "reading"; noteId: string };

export function Rail({
  thread,
  artifacts,
  events,
  notes,
  now,
  /** CONTROLLED. See `RailMode` — the thread can put the rail into a mode, so
   *  neither the tab nor the mode can live in this component. */
  tab,
  onTabChange,
  mode,
  onModeChange,
  onSendActivity,
  onSaveNote,
  onOpenEvent,
  onOpenReference,
  className,
}: {
  thread: ChatThread;
  /** Everything ever sent on this thread. The Toolkit's lock reads it; the
   *  DetailSheet reads it too. */
  artifacts: SentArtifact[];
  events: ChatEvent[];
  notes: Note[];
  now: number;
  tab: RailTab;
  onTabChange: (tab: RailTab) => void;
  mode: RailMode;
  onModeChange: (mode: RailMode) => void;
  onSendActivity: (activityId: ActivityId, items: SentArtifactItem[]) => void;
  onSaveNote: (note: {
    title: string;
    body: string;
    references: ContextRef[];
    reminderAt: number | null;
  }) => void;
  onOpenEvent?: (event: ChatEvent) => void;
  onOpenReference: (ref: ContextRef) => void;
  className?: string;
}) {
  const tabs = tabsFor(thread.kind);
  const panelId = useId();

  /* ═══ THE SELECTED TAB IS NOT PERSISTED, AND THAT IS A DECISION ═══
     It is per-thread UI that is worthless after a reload, and storing it would
     mean a localStorage write every time a mentor glances at Profile. It also
     resets to Assist when the thread changes, which is right: the panel that
     opens on a conversation should be the one that says what to do next, not
     whichever one you happened to leave open on somebody else. */
  const active = tabs.includes(tab) ? tab : tabs[0];
  const rescinded = new Set(
    artifacts.filter((a) => a.rescindedAt).map((a) => a.id)
  );
  const reading =
    mode.kind === "reading" ? notes.find((n) => n.id === mode.noteId) : undefined;
  const theirName = thread.displayName.split(" ")[0];

  return (
    <div
      data-slot="chat-rail"
      className={cn(
        "flex h-full min-h-0 flex-col bg-[var(--surface-card)]",
        className
      )}
    >
      <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-4 py-2.5">
        <SegmentedControl
          options={tabs.map((t) => ({
            value: t,
            label: LABEL[t],
            controls: `${panelId}-panel`,
          }))}
          value={active}
          onChange={onTabChange}
          semantics="tabs"
          fullWidth
          size="sm"
          /* TODO-COPY. Names the region, not the widget: a reader hearing
             "Conversation tools" knows what the four tabs are for. */
          ariaLabel="Conversation tools"
        />
      </div>

      <div
        id={`${panelId}-panel`}
        role="tabpanel"
        tabIndex={-1}
        // THE FLEXIBLE ROW. The tab bar is `shrink-0`; this absorbs the rest and
        // hands it to the panel, whose own middle row is what scrolls.
        className="min-h-0 flex-1"
      >
        <PanelShell>
          {/* ═══ PHASE 1 SCAFFOLDS ═══
              Four honest empty states. Each one NAMES WHAT LANDS THERE rather
              than saying "coming soon" — a mentor reading these learns what the
              rail is for, which is more than the built version of three of these
              panels would teach them today. Phases 3, 5 and 7 replace them. */}
          {active === "assist" && (
            <PanelEmpty title="Where to start">
              {/* TODO-COPY */}
              One suggestion at a time, based on what has happened in this
              conversation — with the option to do it or to leave it.
            </PanelEmpty>
          )}
          {active === "profile" && (
            <PanelEmpty title={`About ${theirName}`}>
              {/* TODO-COPY */}
              What this teen has chosen to share about themselves, in their own
              words.
            </PanelEmpty>
          )}
          {active === "toolkit" && (
            <ToolkitPanel
              artifacts={artifacts}
              disabled={thread.kind !== "teen"}
              onSendActivity={onSendActivity}
            />
          )}
          {/* ═══ TIMELINE OWNS NOTES, AND HAS THREE MODES ═══
              The list, writing one, and reading one. Both of the latter are FULL
              TAKEOVERS of the panel rather than sections inside it — see
              `NoteComposer` on why writing a note gets the whole rail. */}
          {active === "timeline" &&
            (mode.kind === "composing" ? (
              <NoteComposer
                theirName={theirName}
                initialReferences={mode.references}
                onCancel={() => onModeChange({ kind: "list" })}
                onSave={(note) => {
                  onSaveNote(note);
                  onModeChange({ kind: "list" });
                }}
              />
            ) : reading ? (
              <NoteDetail
                note={reading}
                onBack={() => onModeChange({ kind: "list" })}
                onOpenReference={onOpenReference}
              />
            ) : (
              <TimelinePanel
                events={events}
                notes={notes}
                now={now}
                theirName={theirName}
                /* ABSENT on a support thread — a colleague's conversation has no
                   teen to document, and an absent control is clearer than a
                   disabled one. */
                onNewNote={
                  thread.kind === "teen"
                    ? () => onModeChange({ kind: "composing", references: [] })
                    : undefined
                }
                onOpenNote={(n) => onModeChange({ kind: "reading", noteId: n.id })}
                onOpenEvent={onOpenEvent}
                rescindedArtifactIds={rescinded}
              />
            ))}
        </PanelShell>
      </div>
    </div>
  );
}
