"use client";

// THE THREAD — header, scrolling transcript, composer.
//
// ═══ THE TRANSCRIPT IS THE ONLY SCROLLING PART ═══
//
// `grid-rows-[auto_minmax(0,1fr)_auto]`: the header and the composer are pinned by
// the template, with no sticky positioning and no z-index to reason about.
// `minmax(0,…)` is the load-bearing half — a plain `1fr` refuses to shrink below
// its content, so a long conversation would grow the whole column and the composer
// would be pushed off the bottom of the viewport. That is the same trap the Tasks
// pane, the care-update modal and the rail's own panel shell all hit; it is
// written down at each of them because the next person to build a three-band
// column will hit it too.
//
// ═══ IT OPENS AT THE BOTTOM, WITHOUT ANIMATING THERE ═══
//
// A conversation opens on its most recent message. `scrollTop = scrollHeight` on
// mount, not `scrollIntoView` with smooth behaviour — a smooth scroll on open
// reads as the panel settling and drags the eye through six weeks of history to
// get to the thing the reader wanted.
//
// ═══ DAY DIVIDERS ARE STRUCTURE, NOT DECORATION ═══
//
// A thread that runs weeks needs them, and they are the reason a mentor can tell
// "she answered the next morning" from "she answered eight seconds later". Centred
// on a hairline so the date reads as a boundary rather than as a message from
// nobody — the same treatment the Tasks excerpt's truncation marker uses.

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { MoreHorizontal } from "lucide-react";
import { RecordAvatar } from "@/components/record/record-avatar";
import { Composer } from "@/components/chat/thread/composer";
import { MessageBubble, needsMeta } from "@/components/chat/thread/message-bubble";
import { EventChip } from "@/components/chat/thread/event-chip";
import type {
  ChatEvent,
  ChatMessage,
  ChatThread,
  ThreadBadge,
} from "@/lib/chat/types";
import { LIVE_ID } from "@/lib/record/subject";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY. A durable fact about the relationship — not a state, which is what
 *  a `StatusBanner` is for. */
const BADGE_LABEL: Record<ThreadBadge, string> = {
  "re-matched": "Re-matched",
  "new-match": "New match",
  paused: "Paused",
};

/** ═══ THE BADGE IS TONAL AND QUIET ═══
 *  It qualifies the header; it does not compete with it. `--band-sand-*` for the
 *  two neutral facts, `--status-neutral-*` for paused — no clay and no rose,
 *  because those belong to escalation on this surface and spending them here
 *  would flatten the difference between "this teen was re-matched" and "this teen
 *  is in crisis". */
const BADGE_TONE: Record<ThreadBadge, string> = {
  "re-matched": "bg-[var(--band-sand-bg)] text-[var(--band-sand-fg)]",
  "new-match": "bg-[var(--band-sage-bg)] text-[var(--band-sage-fg)]",
  paused: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
};

/** Local midnight, so a divider breaks on the day a reader experienced rather
 *  than on a UTC boundary. */
function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** TODO-COPY. Today and yesterday get words, because that is how a reader refers
 *  to them; anything older gets a date, because "6 days ago" makes a reader do
 *  arithmetic to place it against something else they remember. */
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
  if (days < 7) return a.toLocaleDateString(undefined, { weekday: "long" });
  return a.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    ...(a.getFullYear() === n.getFullYear() ? {} : { year: "numeric" }),
  });
}

function DayDivider({ label }: { label: string }) {
  return (
    <li className="mt-5 flex items-center gap-3 first:mt-0">
      <span aria-hidden className="h-px flex-1 bg-[var(--border-subtle)]" />
      <span
        className="shrink-0 text-[var(--text-muted)]"
        style={{ font: "var(--type-field-label)" }}
      >
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-[var(--border-subtle)]" />
    </li>
  );
}

export function Thread({
  thread,
  messages,
  events = [],
  now,
  reactions,
  onReact,
  onOpenEvent,
  className,
}: {
  thread: ChatThread;
  messages: ChatMessage[];
  /** Interleaved into the transcript by time — see `entries`. */
  events?: ChatEvent[];
  now: number;
  /** Session-local reactions, keyed by message id. See `MessageActions`. */
  reactions?: Record<string, string[]>;
  onReact?: (messageId: string, emoji: string) => void;
  onOpenEvent?: (event: ChatEvent) => void;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const theirName = thread.displayName.split(" ")[0];

  /* ═══ OPEN AT THE BOTTOM, BEFORE THE FIRST PAINT ═══
     `useLayoutEffect` rather than `useEffect`: a passive effect runs after the
     browser has painted, so the reader sees the top of the conversation for one
     frame and then it jumps. Setting `scrollTop` in a layout effect means the
     first painted frame is already at the bottom. */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread.id]);

  /* And again once media has had a chance to lay out. The frames are sized from
     data (see `MediaFrame`) so nothing should move — this is the belt to that
     braces, and it costs one frame on thread open. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [thread.id]);

  /** ═══ ONE TIMELINE OF MESSAGES AND EVENTS ═══
   *
   *  Merged by timestamp into a single sequence, and the day boundaries and the
   *  clustering rule both run over THAT rather than over messages alone. Both
   *  details matter:
   *
   *   · An event between two of a teen's messages BREAKS THE CLUSTER. "You sent
   *     Hot Takes" sitting between them means the second one is not a continuation
   *     of the first any more, so it gets its name and time back. Clustering over
   *     messages-only would have dropped that header and made the second message
   *     look like it came straight after the first.
   *   · A day divider has to be able to land on an event. A thread whose only
   *     Tuesday entry is an activity going out would otherwise put Wednesday's
   *     first message under "Tuesday".
   *
   *  Computed before the render, not accumulated inside `.map` —
   *  `react-hooks/immutability` rejects the latter, and rightly: a render that
   *  mutates as it walks produces output that depends on how many times it ran. */
  const entries = useMemo(() => {
    type Entry =
      | { kind: "message"; at: number; message: ChatMessage }
      | { kind: "event"; at: number; event: ChatEvent };
    const merged: Entry[] = [
      ...messages.map((m) => ({ kind: "message" as const, at: m.at, message: m })),
      ...events.map((e) => ({ kind: "event" as const, at: e.at, event: e })),
    ].sort((a, b) => a.at - b.at);

    /* A `for` LOOP, NOT `.map`. `react-hooks/immutability` rejects reassigning a
       closure variable from inside a callback — correctly, since a callback can in
       principle run outside the pass that created it. A loop body is ordinary
       local scope, so the running state is just a local. */
    const out: Array<Entry & { newDay: boolean; showMeta: boolean }> = [];
    let prevDay = "";
    let prevMessage: ChatMessage | undefined;
    for (const entry of merged) {
      const key = dayKey(entry.at);
      const newDay = key !== prevDay;
      prevDay = key;
      if (entry.kind === "event") {
        // An event resets the cluster — see above.
        prevMessage = undefined;
        out.push({ ...entry, newDay, showMeta: false });
        continue;
      }
      out.push({
        ...entry,
        newDay,
        showMeta: newDay || needsMeta(entry.message, prevMessage),
      });
      prevMessage = entry.message;
    }
    return out;
  }, [messages, events]);

  return (
    <div
      data-slot="chat-thread"
      className={cn(
        "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-[var(--surface-card)]",
        className
      )}
    >
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3">
        <RecordAvatar name={thread.displayName} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2
              data-slot="chat-thread-name"
              className="min-w-0 truncate text-[var(--text-primary)]"
              style={{ font: "var(--type-card-title)" }}
            >
              {thread.displayName}
            </h2>
            {thread.badge && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5",
                  BADGE_TONE[thread.badge]
                )}
                style={{ font: "var(--type-field-label)" }}
              >
                {BADGE_LABEL[thread.badge]}
              </span>
            )}
          </div>
          {thread.subtitle && (
            <p
              className="truncate text-[var(--text-secondary)]"
              style={{ font: "var(--type-field-label)" }}
            >
              {thread.subtitle}
            </p>
          )}
        </div>
        {/* THE KEBAB IS PRESENT AND NAMED. Phase 7 fills it; an unnamed icon
            button would be the exact defect this build is correcting. */}
        <button
          type="button"
          /* TODO-COPY */
          aria-label={`More options for ${theirName}`}
          title="More options"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors",
            "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          <MoreHorizontal className="size-[18px]" aria-hidden />
        </button>
      </div>

      {/* ── TRANSCRIPT ────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        // `overscroll-contain` so reaching the top of the conversation does not
        // start scrolling the page behind it.
        className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-[34ch] text-center">
              <p
                className="text-[var(--text-primary)]"
                style={{ font: "var(--type-card-title)" }}
              >
                {/* TODO-COPY. Names the person and the situation. Not "No
                    messages" — a matched pair with nothing sent yet is the
                    beginning of every mentorship, and it is the mentor's move. */}
                You and {theirName} haven&apos;t talked yet
              </p>
              <p
                className="mt-1.5 text-[var(--text-secondary)]"
                style={{ font: "var(--type-body)" }}
              >
                {/* TODO-COPY. One sentence, no pressure, no deadline. */}
                Anything is a fine start. Saying hello is enough.
              </p>
            </div>
          </div>
        ) : (
          <ul role="list" aria-label={`Conversation with ${theirName}`}>
            {entries.map((entry) => {
              const id =
                entry.kind === "message" ? entry.message.id : entry.event.id;
              return (
                /* ═══ A FRAGMENT, NOT A `display: contents` DIV ═══
                   Each entry can render TWO list items — a day divider and then the
                   message or event — so it needs a keyed wrapper, and the first
                   version used `<div className="contents">`. That is wrong twice
                   over. A `<ul>` may only contain `<li>`, so a div child breaks the
                   list's structure for a screen reader walking it — `display:
                   contents` hides the box, not the node. And a
                   `display: contents` element reports a ZERO-SIZED rect, which
                   silently broke a probe that was measuring the gap between two
                   bubbles and reported 0px as a pass.
                   A keyed Fragment adds no DOM node at all, which is what was
                   wanted. */
                <Fragment key={id}>
                  {entry.newDay && <DayDivider label={dayLabel(entry.at, now)} />}
                  {entry.kind === "message" ? (
                    <MessageBubble
                      message={entry.message}
                      theirName={theirName}
                      // A new day always re-states who is speaking, whatever the
                      // clustering rule says — a reader arriving at "Tuesday"
                      // needs the next line attributed.
                      showMeta={entry.showMeta}
                      added={reactions?.[entry.message.id]}
                      onReact={
                        onReact
                          ? (emoji) => onReact(entry.message.id, emoji)
                          : undefined
                      }
                    />
                  ) : (
                    <EventChip
                      event={entry.event}
                      /* TODO-COPY. "You" for the mentor's own actions, the other
                         party's first name otherwise — a mentor scanning needs to
                         know which of them did this. */
                      actorName={
                        entry.event.actorId === LIVE_ID ? "You" : theirName
                      }
                      onOpen={onOpenEvent}
                    />
                  )}
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── COMPOSER ─────────────────────────────────────────────────── */}
      <Composer theirName={theirName} />
    </div>
  );
}
