"use client";

// THE MENTOR CHAT — list · thread · rail.
//
// ═══ THREE COLUMNS, AND WHICH ONES MOUNT ═══
//
//   ≥ 1280px   list (320) · thread (flexible) · rail (320)
//   ≥ 900px    list (300) · thread (flexible)              — rail behind a toggle
//   < 900px    one of them, whichever the reader chose      — a takeover
//
// SWITCHING, NOT SHRINKING. A 220px conversation list is a list of truncated
// names, and a 240px thread is a column of two-word lines — so below each
// breakpoint a column is REMOVED rather than compressed. The same decision the
// Tasks page makes at `xl`, and for the same reason: a pane squeezed into a width
// it cannot use is worse than a pane you navigated away from.
//
// The takeover is why `view` exists. Below 900px the list and the thread are
// mutually exclusive, so selecting a row has to hand the screen over — a select
// that only moved the selection left a reader tapping names and watching nothing
// happen, which is a bug the Tasks page shipped once and had to be measured to
// find (its pane was `display:none` at the time).
//
// ═══ STORE READS ARE MOUNT-GATED ═══
//
// `chatScenarioId` is persisted, so reading it during SSR or the first client
// paint disagrees with what hydration produces. Standing Next-16 rule, and the
// reason `useMounted` gates the seed rather than the render: the shell and the
// three columns paint immediately; only the DATA waits a frame.

import { useMemo, useState } from "react";
import { PanelRight, PanelRightClose, ArrowLeft } from "lucide-react";
import { ConversationList } from "@/components/chat/list/conversation-list";
import { Rail } from "@/components/chat/rail/rail";
import { Thread } from "@/components/chat/thread/thread";
import { chatScenario } from "@/lib/chat/seed";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import type { ThreadId } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function ChatPage({
  /** From `?with=` — the deep link every record table's Chat action already
   *  produces. See `lib/record/chat.ts`; this is why no call site changed. */
  withId,
}: {
  withId: string | null;
}) {
  const mounted = useMounted();
  const scenarioId = useOnboardingStore((s) => s.chatScenarioId);

  /** FIXED AT MOUNT, which is the house pattern (`tasks-page.tsx` carries the
   *  same line and the same reason): `Date.now()` in render scope is impure and
   *  `react-hooks/purity` is right to reject it.
   *
   *  It also has to be fixed for a second reason here. Every thread's messages
   *  are positioned relative to this instant, so a ticking clock would rebuild
   *  fifteen threads a second and throw away the transcript's scroll position on
   *  every tick. Chat timestamps are minutes-and-hours coarse; a clock that
   *  advances while a mentor reads buys nothing. */
  const [now] = useState(() => Date.now());

  /** ═══ MOUNT-GATED, LIKE EVERY OTHER SEEDED SURFACE ═══
   *
   *  Two reasons, and both would produce a hydration mismatch on their own.
   *  `scenarioId` comes from a localStorage-backed store, so SSR sees the default
   *  and the client may see something else. And `now` is `Date.now()` in a
   *  `useState` initialiser, which RUNS ON THE SERVER TOO — so the server would
   *  render one set of timestamps and the client another, and React would replace
   *  the whole transcript on hydration.
   *
   *  Gating the DATA rather than the render is what keeps the shell, the three
   *  columns and the empty states painting immediately. Same shape as
   *  `tasks-page.tsx`'s `items` memo. */
  const data = useMemo(
    () => (mounted ? chatScenario(scenarioId, now) : null),
    [mounted, scenarioId, now]
  );

  const [picked, setPicked] = useState<ThreadId | null>(null);
  /** ═══ THE TAKEOVER'S STARTING SIDE IS DERIVED FROM THE LINK, NOT SET BY ONE ═══
   *
   *  Below 900px only one column mounts, so arriving with no conversation chosen
   *  should show the choices — and arriving from a record's Chat action should show
   *  the conversation, because that is the one thing the link carried.
   *
   *  The first version did this in an effect, and `react-hooks/set-state-in-effect`
   *  was right to reject it: an effect runs AFTER the first paint, so a mentor
   *  following a deep link on a phone would have seen the list for a frame and then
   *  been moved. A `useState` initialiser reads the prop before the first render
   *  instead, which is both correct and one fewer render. */
  const [view, setView] = useState<"list" | "thread">(withId ? "thread" : "list");
  /** ═══ CLOSED BY DEFAULT, WHICH ONLY MATTERS BELOW `xl` ═══
   *  At `xl` the rail is a grid track and this flag does nothing — the class that
   *  reads it is `!railOpen && "hidden xl:block"`, so `xl` always shows it.
   *  Below `xl` it is a 320px overlay ON the conversation, and an overlay that
   *  starts open covers the thread a mentor came here to read. */
  const [railOpen, setRailOpen] = useState(false);

  /** ═══ REACTIONS ADDED THIS SESSION, KEYED BY MESSAGE ID ═══
   *  Not persisted, and `MessageActions` carries the reasoning: the four things
   *  this surface persists are the ones that have to survive a navigation to mean
   *  anything, and a reaction on a fixture message is not one of them. Held at the
   *  PAGE rather than in the thread so switching conversations and coming back
   *  does not lose them. */
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const react = (messageId: string, emoji: string) =>
    setReactions((r) => {
      const had = r[messageId] ?? [];
      // Pressing the same one again removes it — a reaction is a toggle, and a
      // menu that can only ever add is a menu that accumulates mistakes.
      return {
        ...r,
        [messageId]: had.includes(emoji)
          ? had.filter((e) => e !== emoji)
          : [...had, emoji],
      };
    });

  const threads = data?.threads ?? [];
  /* ═══ THE DEEP LINK IS A FALLBACK, NOT AN OVERRIDE ═══
     `picked` first, so a reader who follows `?with=t18` and then chooses someone
     else is not dragged back by a prop that never changes. Then `withId`, then the
     scenario's own focus thread. Derived rather than written into state, which is
     what removes the effect. */
  const selectedId = picked ?? withId ?? data?.focusThreadId ?? null;
  const thread = threads.find((t) => t.id === selectedId) ?? threads[0];
  const messages = thread ? (data?.messages[thread.id] ?? []) : [];
  const events = thread ? (data?.events[thread.id] ?? []) : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ═══ THE GRID IS THE MECHANISM ═══
          Explicit column tracks rather than flex-basis, so the two fixed columns
          cannot be compressed by a long name in the middle one. `minmax(0,1fr)`
          on the thread is what lets it shrink below its content — without it a
          wide message would push the rail off the right edge. */}
      <div
        className={cn(
          // `relative` because the rail is ABSOLUTE below `xl` — see its note.
          "relative grid h-full min-h-0",
          // < 900: ONE column, and `view` decides which.
          "grid-cols-[minmax(0,1fr)]",
          // ≥ 900: list + thread. No third track: 300 + 320 leaves 280px for the
          // conversation at this width, which is a column of two-word lines.
          "md:grid-cols-[300px_minmax(0,1fr)]",
          // ≥ 1280: all three, always. The toggle is gone at this width.
          "xl:grid-cols-[320px_minmax(0,1fr)_320px]"
        )}
      >
        {/* ── LIST ──────────────────────────────────────────────────────── */}
        <ConversationList
          threads={threads}
          now={now}
          selectedId={thread?.id ?? null}
          onSelect={(id) => {
            setPicked(id);
            // AND HAND OVER THE SCREEN. A no-op at md and up, which is why the
            // narrow case has to be the one that is written down.
            setView("thread");
          }}
          className={cn(view === "thread" && "hidden md:flex")}
        />

        {/* ── THREAD ────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex min-h-0 flex-col",
            view === "list" && "hidden md:flex"
          )}
        >
          {/* THE WAY BACK, below `md` only. Above it the list is on screen and a
              Back button would point at something already visible. */}
          {view === "thread" && (
            <button
              type="button"
              data-slot="chat-back"
              onClick={() => setView("list")}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-1.5 border-b border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 text-[var(--text-secondary)] md:hidden",
                "hover:text-[var(--text-primary)]",
                RING
              )}
              style={{ font: "var(--type-body)" }}
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              {/* TODO-COPY */}
              All conversations
            </button>
          )}

          {thread ? (
            <div className="relative min-h-0 flex-1">
              <Thread
                thread={thread}
                messages={messages}
                events={events}
                now={now}
                reactions={reactions}
                onReact={react}
                /* PHASE 4 opens the DetailSheet from here. Left undefined for now
                   rather than wired to a no-op, because `EventChip` renders an
                   inert chip when there is nothing to open — which is honest, and
                   is what stops a pressable-looking chip from doing nothing. */
              />

              {/* ═══ THE RAIL TOGGLE LIVES ON THE THREAD, NOT IN THE RAIL ═══
                  A control that hides a panel cannot live inside the panel it
                  hides, or closing it takes the control with it. Between `md` and
                  `xl` there is no room for three columns, so the rail is a toggle;
                  at `xl` it is always open and the toggle is gone. */}
              <button
                type="button"
                onClick={() => setRailOpen((o) => !o)}
                aria-pressed={railOpen}
                /* TODO-COPY */
                aria-label={railOpen ? "Hide conversation tools" : "Show conversation tools"}
                title={railOpen ? "Hide conversation tools" : "Show conversation tools"}
                className={cn(
                  "absolute right-3 top-2.5 hidden size-9 items-center justify-center rounded-full text-[var(--text-secondary)] md:flex xl:hidden",
                  "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                  RING
                )}
              >
                {railOpen ? (
                  <PanelRightClose className="size-[18px]" aria-hidden />
                ) : (
                  <PanelRight className="size-[18px]" aria-hidden />
                )}
              </button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <p
                className="text-[var(--text-secondary)]"
                style={{ font: "var(--type-body)" }}
              >
                {/* TODO-COPY. Only reachable with an empty roster. */}
                Choose a conversation to open it.
              </p>
            </div>
          )}
        </div>

        {/* ── RAIL ──────────────────────────────────────────────────────── */}
        {/* ═══ A GRID TRACK AT `xl`, AN OVERLAY BELOW IT ═══
            At `xl` there is room for three columns and the rail is simply the
            third one — `static`, always open, no toggle.
            Between `md` and `xl` there is not: the arithmetic above shows the
            thread would get 280px. So the rail becomes a 320px overlay on the
            thread's right edge, which a mentor opens when they want it and closes
            when they want the conversation back. An OVERLAY rather than a fourth
            layout, because the alternative — hiding the list to make room — would
            mean one control silently doing two different things.
            `absolute` also keeps it out of the grid's flow below `xl`, so it
            cannot create an implicit third track at `md`. */}
        {thread && (
          <div
            className={cn(
              "absolute inset-y-0 right-0 z-20 w-[320px] border-l border-[color:var(--border-subtle)] shadow-[var(--shadow-panel)]",
              "xl:static xl:z-auto xl:w-auto xl:shadow-none",
              // Hidden below `xl` until toggled; always present at `xl`.
              !railOpen && "hidden xl:block"
            )}
          >
            <Rail thread={thread} />
          </div>
        )}
      </div>
    </div>
  );
}
