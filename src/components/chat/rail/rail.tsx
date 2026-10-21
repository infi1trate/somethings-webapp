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
// ═══ SUPERSEDED (support-beside-hub, answered 2026-10-19): GLYPHS NOW ═══
// "Add a profile icon, but follow the Figma design paradigm" — the hub header
// is 40px round icon tabs: Now first and on its own at the left, the rest at
// the right; the selected one filled, the others outlined. What the words
// argument protected is kept rather than lost: every tab carries its word as
// its accessible name and its tooltip, so a reader still hears "Tools, tab,
// 3 of 4", and `RailTabs` below re-implements the roving tabindex, ←/→/Home/
// End and selected-only `aria-controls` the segmented control gave. The cost
// stated: a sighted reader now learns four glyphs.
//
// ═══ THE PANEL SET DEPENDS ON `kind`, NOT ON A SECOND RAIL ═══
//
// A support thread has no teen profile to read and no activities to send. It gets
// two tabs, from the same component, because the alternative is a second rail
// that starts identical and drifts.

import { useId, useRef } from "react";
import { Clock, Grid2x2Plus, LifeBuoy, Sparkles, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PanelShell } from "@/components/chat/rail/rail-panel";
import { ToolkitPanel } from "@/components/chat/rail/toolkit";
import { TimelinePanel } from "@/components/chat/rail/timeline";
import { AssistPanel } from "@/components/chat/rail/assist";
import { ProfilePanel } from "@/components/chat/rail/profile";
import type { AssistInput } from "@/lib/chat/assist";
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

/* ═══ SUPERSEDED (Tiering & Escalation pack, answered 2026-10-20): "Care
   replaces Now". `escalation` → `care`: a persistent tab for every teen,
   not one that appears with an escalation. */
export type RailTab = "care" | "assist" | "profile" | "toolkit" | "timeline";

/** TODO-COPY. Short enough that four fit a 320px column at 11px without
 *  truncating — measured, not assumed. */
export const RAIL_TAB_LABEL: Record<RailTab, string> = {
  /* TODO-COPY. "Care", the pack's label — it supersedes FCP-2's "Clinical
     resources" to match the care language, and it supersedes "Now", whose
     argument (a short word that says what the tab is FOR) Care also passes. */
  care: "Care",
  /* Renamed with the glyph header (support-beside-hub): the pack's Context,
     Tools and History. The ids are unchanged, so nothing that stores or links
     a tab moves. */
  assist: "Context",
  profile: "Profile",
  toolkit: "Tools",
  timeline: "History",
};

/** The hub's glyphs, from the Figma header (6011:1540): the sparkle for
 *  Context, a grid-plus for Tools, a clock for History; Profile joins them as
 *  a person (answered); Care is the pack's lifesaver. */
export const RAIL_TAB_ICON: Record<RailTab, LucideIcon> = {
  care: LifeBuoy,
  assist: Sparkles,
  profile: UserRound,
  toolkit: Grid2x2Plus,
  timeline: Clock,
};

const TAB_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ THE HUB'S TABS ═══ A tablist of 40px round icon buttons. Now, when it
 *  exists, stands alone at the left; the rest sit at the right. Selected is
 *  filled `surface-sunken-strong`, the rest outlined `border-subtle` — the
 *  Figma's filled house against its three outlined glyphs. */
function RailTabs({
  tabs,
  active,
  onChange,
  controls,
  careDot,
}: {
  tabs: RailTab[];
  active: RailTab;
  onChange: (t: RailTab) => void;
  controls: string;
  /** An open escalation: red for Tier 1–2, neutral otherwise (the canon's
   *  colour rule), and said in words to a screen reader. */
  careDot: "alert" | "neutral" | null;
}) {
  const refs = useRef<Partial<Record<RailTab, HTMLButtonElement | null>>>({});
  const move = (to: RailTab) => {
    onChange(to);
    refs.current[to]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, t: RailTab) => {
    const i = tabs.indexOf(t);
    const to =
      e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length]
      : e.key === "ArrowLeft" ? tabs[(i - 1 + tabs.length) % tabs.length]
      : e.key === "Home" ? tabs[0]
      : e.key === "End" ? tabs[tabs.length - 1]
      : null;
    if (!to) return;
    e.preventDefault();
    move(to);
  };
  const tab = (t: RailTab) => {
    const Icon = RAIL_TAB_ICON[t];
    const selected = t === active;
    return (
      <button
        key={t}
        ref={(el) => {
          refs.current[t] = el;
        }}
        type="button"
        role="tab"
        data-rail-tab={t}
        aria-selected={selected}
        aria-controls={selected ? controls : undefined}
        title={RAIL_TAB_LABEL[t]}
        tabIndex={selected ? 0 : -1}
        onClick={() => onChange(t)}
        onKeyDown={(e) => onKey(e, t)}
        className={cn(
          "relative flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-transparent bg-[var(--surface-sunken-strong)] text-[var(--text-primary)]"
            : "border-[color:var(--border-subtle)] text-[var(--icon-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
          TAB_RING
        )}
      >
        <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        {/* The word, as text rather than `aria-label`: the same accessible
            name, and anything reading the tab's text still finds it. */}
        <span className="sr-only">
          {RAIL_TAB_LABEL[t]}
          {/* TODO-COPY */}
          {t === "care" && careDot ? ", escalation open" : ""}
        </span>
        {t === "care" && careDot && (
          <span
            aria-hidden
            data-care-dot={careDot}
            className={cn(
              "absolute right-0.5 top-0.5 size-2.5 rounded-full ring-2 ring-[var(--surface-card)]",
              careDot === "alert" ? "bg-[var(--alert-critical-accent)]" : "bg-[var(--text-primary)]"
            )}
          />
        )}
      </button>
    );
  };
  /* ═══ ONE ROW, FIXED ORDER ═══ Now stood alone at the left because it came
     and went; Care is always there, so the tabs are one group and never
     reorder. */
  return (
    /* TODO-COPY. Names the region, not the widget. */
    <div role="tablist" aria-label="Conversation tools" className="flex w-full items-center justify-end gap-2">
      {tabs.map(tab)}
    </div>
  );
}

/** WHICH TABS A THREAD GETS. A support thread has no profile canvas and no
 *  activity shelf; it keeps Assist and Timeline, which are about the working
 *  relationship rather than about a teen. */
/** ═══ SUPERSEDED: AN OPEN ESCALATION ADDED A TAB, AT THE FRONT ═══
 *  (Kept for the reasoning.) Care replaced it: a persistent tab after
 *  Context, for every teen, whose STATE changes with the escalation rather
 *  than its existence. The argument below for a tab that comes and goes —
 *  that a permanent Escalation tab is a permanent invitation — is answered by
 *  naming it Care: it is where the care record lives, and an escalation is
 *  one of the things it holds.
 *
 *  ═══ AN OPEN ESCALATION ADDED A TAB, AT THE FRONT ═══
 *
 *  The rail's job is "what to do next", and while an escalation is open the answer
 *  is the escalation — so it takes first position rather than being appended. Five
 *  tabs at 320px is tight and it is the right trade: the alternative was putting the
 *  checklist inside Assist, where it would have been one section among three while a
 *  teenager was in crisis.
 *
 *  It APPEARS AND DISAPPEARS with the escalation, which is normally a thing to
 *  avoid — a control whose position cannot be learned. It is correct here because
 *  the state it belongs to is itself exceptional and loudly announced by the banner
 *  above; a permanently-present Escalation tab would be a permanent invitation. */
export function tabsFor(kind: ChatThread["kind"]): RailTab[] {
  return kind === "teen" ? ["assist", "care", "profile", "toolkit", "timeline"] : ["assist", "timeline"];
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
  care,
  careDot,
  assist,
  matchedFor,
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
  presence,
  className,
}: {
  thread: ChatThread;
  /** Everything ever sent on this thread. The Toolkit's lock reads it; the
   *  DetailSheet reads it too. */
  artifacts: SentArtifact[];
  events: ChatEvent[];
  notes: Note[];
  /** The Care tab's panel — built by the page, which holds the tiering and
   *  escalation state it reads. */
  care: React.ReactNode;
  careDot: "alert" | "neutral" | null;
  /** Everything the Assist ladder reads. Null on a support thread, where none of
   *  its rules apply. */
  assist: AssistInput | null;
  /** Phrased by the page — `mentees-demo` owns the arithmetic. */
  matchedFor: string | null;
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
  /** "Brandy is in this chat" — see the header. */
  presence?: string;
  className?: string;
}) {
  const tabs = tabsFor(thread.kind);
  const panelId = useId();

  /* ═══ THE SELECTED TAB IS NOT PERSISTED, AND THAT IS A DECISION ═══
     It is per-thread UI that is worthless after a reload, and storing it would
     mean a localStorage write every time a mentor glances at Profile. It also
     resets when the thread changes — to Care while an escalation is open, to
     Context otherwise (`chat-page.tsx`) — which is right: the panel that
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
      {/* ── THE HUB HEADER: 64, the tabs, a divider ─────────────────── */}
      <div data-rail-header className="flex h-16 shrink-0 items-center border-b border-[color:var(--border-subtle)] px-4">
        <RailTabs tabs={tabs} active={active} onChange={onTabChange} controls={`${panelId}-panel`} careDot={careDot} />
      </div>
      {/* ═══ WHO ELSE IS HERE (support-beside-hub) ═══ When the open support
          thread is with the other party to this escalation, one thin line
          says so, so the two panes read as linked. */}
      {presence && (
        <p
          data-rail-presence
          className="flex shrink-0 items-center gap-2 border-b border-[color:var(--border-subtle)] px-4 py-2 text-[12px] leading-[16px] text-[var(--text-secondary)]"
        >
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--status-online)]" />
          {presence}
        </p>
      )}

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
          {active === "care" && care}
          {active === "assist" && (
            <AssistPanel
              input={assist}
              disabled={thread.kind !== "teen"}
              onOpenToolkit={() => onTabChange("toolkit")}
            />
          )}
          {active === "profile" && (
            <ProfilePanel thread={thread} matchedFor={matchedFor} />
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
