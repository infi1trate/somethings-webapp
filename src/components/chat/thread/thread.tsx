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
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { ThreadMenu } from "@/components/chat/thread/thread-menu";
import {
  BannerButton,
  StatusBanner,
} from "@/components/chat/thread/status-banner";
import { RecordAvatar } from "@/components/record/record-avatar";
import { Composer } from "@/components/chat/thread/composer";
import {
  MessageBubble,
  clockTime,
  needsMeta,
} from "@/components/chat/thread/message-bubble";
import { EventChip } from "@/components/chat/thread/event-chip";
import type {
  ChatEvent,
  ChatMessage,
  ChatThread,
  EscalationState,
  SentArtifact,
  ThreadBadge,
} from "@/lib/chat/types";
import { LIVE_ID } from "@/lib/record/subject";
import { cn } from "@/lib/utils";

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
  artifacts = {},
  /** The live escalation, if there is one. Drives the banner, the transcript's
   *  container marking, and whether the message menu still offers Escalate. */
  escalation,
  now,
  reactions,
  onReact,
  onTagMessage,
  onEscalateFrom,
  onOpenEvent,
  onBackToChats,
  observer,
  insert,
  onSend,
  /** For the kebab's dialer link. Null on a thread with no number on file. */
  phone,
  className,
}: {
  thread: ChatThread;
  messages: ChatMessage[];
  /** Interleaved into the transcript by time — see `entries`. */
  events?: ChatEvent[];
  /** Keyed by artifact id. The chip needs it only to know whether a send has since
   *  been taken back — the sheet is what reads the rest. */
  artifacts?: Record<string, SentArtifact>;
  escalation?: EscalationState;
  now: number;
  /** Session-local reactions, keyed by message id. See `MessageActions`. */
  reactions?: Record<string, string[]>;
  onReact?: (messageId: string, emoji: string) => void;
  /** Starts a note pointed at this message. Absent on a support thread. */
  onTagMessage?: (message: ChatMessage) => void;
  /** `null` when raised from the kebab rather than from a message — see the menu's
   *  note on why both paths exist. */
  onEscalateFrom?: (message: ChatMessage | null) => void;
  onOpenEvent?: (event: ChatEvent) => void;
  /* The banner's actions moved with it to `EscalationBanner`. */
  /** While Support is open the list collapses, and this is the way back to it
   *  (support-beside-hub): a 40px round chevron at the header's start. */
  onBackToChats?: () => void;
  /** ═══ A SUPERVISOR WATCHING (support-beside-hub) ═══ Read-only: the
   *  mentor's lines are attributed to them rather than to "You", the message
   *  and thread menus are gone, and the composer is the observer's footer. */
  observer?: { mentorName: string };
  /** Text to drop into the composer, unsent. See `Composer`'s own note on why this
   *  is a nonce rather than a plain string. */
  insert?: { text: string; nonce: number } | null;
  /** Sends a message on this thread. Absent for an observer, who has no
   *  composer. Before pack v3.0 nothing passed it, so Send cleared the box and
   *  went nowhere. */
  onSend?: (text: string) => void;
  phone?: string | null;
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

  /* ═══ A SENT MESSAGE IS SEEN ═══ When the newest message is the mentor's
     own, they just sent it: bring it into view. Keyed on that message's id, so
     a teen's reply arriving while the mentor reads back does not yank them. */
  const last = messages.at(-1);
  const lastSentId = last?.sender === "mentor" ? last.id : null;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !lastSentId) return;
    el.scrollTop = el.scrollHeight;
  }, [lastSentId]);

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
        /* FOUR ROWS WHEN A BANNER IS UP. `auto` for the header and the banner, so
           the banner is PINNED by the template rather than by a sticky position —
           see `StatusBanner` on why an escalation a mentor can scroll away from is
           an escalation they forget. */
        "grid h-full min-h-0 bg-[var(--surface-card)]",
        /* Three rows: the banner moved to the page (support-beside-hub). */
        "grid-rows-[auto_minmax(0,1fr)_auto]",
        className
      )}
    >
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3">
        {onBackToChats && (
          <button
            type="button"
            data-slot="chat-back-to-chats"
            onClick={onBackToChats}
            /* TODO-COPY */
            aria-label="Back to chats"
            title="Back to chats"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)] text-[var(--icon-secondary)] transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          >
            <ChevronLeft aria-hidden className="size-5" strokeWidth={1.75} />
          </button>
        )}
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
        {!observer && <ThreadMenu
          threadId={thread.id}
          theirName={theirName}
          phone={phone ?? null}
          /* THE SECOND ENTRY POINT. Gone while one is open, like the message menu's
             — a second escalation on the same thread is the same crisis. */
          onEscalate={
            onEscalateFrom && !escalation ? () => onEscalateFrom(null) : undefined
          }
        />}
      </div>

      {/* ── THE ESCALATION BANNER MOVED UP (support-beside-hub) ─────────
          It is `EscalationBanner` below, rendered by the page above the
          conversation AND the hub, so it spans both: the pack's Action Bar
          slot belongs to the card, not to one pane of it. */}

      {/* ── TRANSCRIPT ────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        // `overscroll-contain` so reaching the top of the conversation does not
        // start scrolling the page behind it.
        data-anno-ref="chat-thread-scroller"
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
                      selfName={observer?.mentorName}
                      // A new day always re-states who is speaking, whatever the
                      // clustering rule says — a reader arriving at "Tuesday"
                      // needs the next line attributed.
                      showMeta={entry.showMeta}
                      added={reactions?.[entry.message.id]}
                      inEscalation={
                        !!escalation &&
                        entry.message.at >= escalation.openedAt &&
                        (escalation.resolvedAt === null ||
                          entry.message.at <= escalation.resolvedAt)
                      }
                      isAnchor={escalation?.anchorMessageId === entry.message.id}
                      onReact={
                        onReact
                          ? (emoji) => onReact(entry.message.id, emoji)
                          : undefined
                      }
                      onTag={
                        onTagMessage
                          ? () => onTagMessage(entry.message)
                          : undefined
                      }
                      /* ABSENT WHILE ONE IS OPEN. A second escalation on the same
                         conversation is the same crisis, and the store keys them by
                         thread — so offering it would be offering an action that
                         silently overwrites the first one's assessment. */
                      onEscalate={
                        onEscalateFrom && !escalation
                          ? () => onEscalateFrom(entry.message)
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
                        entry.event.actorId === LIVE_ID ? (observer?.mentorName ?? "You") : theirName
                      }
                      retracted={
                        entry.event.kind === "activity-sent" &&
                        !!artifacts[entry.event.artifactId]?.rescindedAt
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
      {observer ? (
        /* ═══ THE OBSERVER'S FOOTER (Figma 6011:1450) ═══ Where the composer
           was: who is watching, that they are invisible, and Take over —
           drawn, and DISABLED until what taking over does is specified
           (standing rule 3, flagged). */
        <div
          data-slot="chat-observer"
          className="flex shrink-0 items-center gap-4 bg-[var(--surface-sunken-strong)] px-4 py-5"
        >
          <div className="min-w-0 flex-1">
            {/* TODO-COPY, both lines */}
            <p className="text-[14px] leading-[20px] font-semibold text-[var(--text-primary)]">Viewing as a supervisor</p>
            <p className="text-[12px] leading-[16px] text-[var(--text-secondary)]">You are invisible to this chat.</p>
          </div>
          <button
            type="button"
            data-slot="chat-take-over"
            aria-disabled
            tabIndex={-1}
            title="Coming soon."
            onClick={(e) => e.preventDefault()}
            aria-label="Take over (coming soon)"
            className="h-10 shrink-0 cursor-default rounded-full border border-[color:var(--border-default)] px-5 text-[14px] leading-[16px] font-semibold text-[var(--text-primary)]"
          >
            Take over
          </button>
        </div>
      ) : (
        <Composer theirName={theirName} insert={insert} onSend={onSend} />
      )}
    </div>
  );
}

/** ═══ THE ESCALATION BANNER (moved out of `Thread`, support-beside-hub) ═══
 *  The same banner, the same three actions and the same "Supervisor
 *  notified" door — rendered by the page across the conversation and the hub
 *  rather than inside the conversation pane. */
export function EscalationBanner({
  escalation,
  tone = "critical",
  onOpenAssessment,
  onOpenSupervisor,
  onOpenCrisis,
}: {
  escalation: EscalationState;
  /** ═══ RED ONLY FOR TIER 1–2 (Tiering & Escalation pack) ═══ A Tier 3 or
   *  Platform safety escalation is still announced, as the one banner, but in
   *  the neutral tone — alert colour is spent on Tiers 1–2 alone. */
  tone?: "critical" | "neutral";
  onOpenAssessment?: () => void;
  onOpenSupervisor?: () => void;
  onOpenCrisis?: () => void;
}) {
  return (
    <StatusBanner
      tone={tone}
      glyph={ShieldAlert}
      /* TODO-COPY. Present tense, because the state is present. */
      title="Escalation open"
      /* ═══ THE TIMESTAMPED FACT ═══
          Not a toast. The mentor who raised this needs to be able to check — an
          hour later, mid-phone-call, after a navigation — that somebody knows.
          See `StatusBanner`. */
      meta={
        onOpenSupervisor ? (
          <>
            {/* ═══ THE FACT IS THE DOOR (SUP-5) ═══ "Supervisor notified"
                opens that supervisor's thread in the Support panel — the
                moment a mentor needs them is the moment they are told. An
                inline link in a sentence, so 2.5.8's inline exception holds
                for its target height. */}
            <button
              type="button"
              data-slot="banner-supervisor"
              onClick={onOpenSupervisor}
              /* TODO-COPY */
              aria-label={`Supervisor notified ${clockTime(escalation.supervisorNotifiedAt)}. Message them in Support`}
              className="rounded-sm underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              Supervisor notified {clockTime(escalation.supervisorNotifiedAt)}
            </button>
            {` · opened ${clockTime(escalation.openedAt)}`}
          </>
        ) : (
          `Supervisor notified ${clockTime(escalation.supervisorNotifiedAt)} · opened ${clockTime(escalation.openedAt)}`
        )
      }
    >
      {/* ═══ CRISIS INFO IS THE PRIMARY, NOT THE ASSESSMENT ═══
          A mentor pressing something on this banner in a hurry is reaching for
          the phone numbers. The checklist is the considered path and sits
          second. */}
      <BannerButton tone={tone} primary onClick={onOpenCrisis} data-slot="banner-crisis">
        {/* TODO-COPY */}
        Emergency info
      </BannerButton>
      {/* ═══ "CHECKLIST" → "CARE", AND NO RESOLVE (pack v2.0) ═══ The checklist
          is gone into the sequential assessment, which lives in Care; and the
          mentor no longer resolves — the supervisor closes, so the banner has
          no Resolve. */}
      <BannerButton tone={tone} onClick={onOpenAssessment} data-slot="banner-assessment">
        {/* TODO-COPY */}
        Open Care
      </BannerButton>
    </StatusBanner>
  );
}
