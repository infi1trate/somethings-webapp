"use client";

// AN EVENT IN THE THREAD — one anatomy for all six kinds.
//
// ═══ ONE COMPONENT, TWO PLACES, ONE RECORD ═══
//
// This renders inline in the conversation AND as a row in the Timeline panel, from
// the same `ChatEvent`. Two components reading one record is how a thread and a
// timeline end up disagreeing about what happened — one of them gets a new event
// kind and the other silently renders nothing.
//
// The two placements differ only in `variant`: `inline` is centred and quiet
// because it interrupts a conversation; `row` is left-aligned and denser because
// it sits in a list of its own kind. Nothing about the CONTENT differs.
//
// ═══ IT IS NOT A MESSAGE, SO IT DOES NOT LOOK LIKE ONE ═══
//
// No side, no fill, no bubble. An event is something that HAPPENED to the
// conversation rather than something said in it, and the moment it gets a bubble a
// reader has to work out whether the teen can see it. Centred, muted, on the
// transcript's own ground.
//
// ═══ AND IT IS A BUTTON ONLY WHEN THERE IS SOMEWHERE TO GO ═══
//
// An activity that was sent opens its contents; a note opens the note. A rescind
// has nothing behind it — the thing it refers to is gone, which is the point — so
// it renders as text. A chip that looks pressable and does nothing is worse than
// one that is plainly inert.

import {
  ArrowLeftRight,
  FileText,
  Send,
  ShieldAlert,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChatEvent, ChatEventKind } from "@/lib/chat/types";
import { clockTime } from "@/components/chat/thread/message-bubble";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const GLYPH: Record<ChatEventKind, LucideIcon> = {
  "activity-sent": Send,
  "activity-rescinded": Undo2,
  "note-added": FileText,
  "swap-started": ArrowLeftRight,
  "escalation-opened": ShieldAlert,
  "escalation-resolved": ShieldCheck,
};

/** ═══ ONLY ESCALATION IS TINTED ═══
 *
 *  Five of the six kinds are ordinary things a mentor does, and they render in
 *  muted ink on the transcript's ground — the whole point of a quiet event chip is
 *  that a conversation with six of them still reads as a conversation.
 *
 *  Escalation gets `--band-clay-*`: opened and resolved both, because the record
 *  that an escalation HAPPENED is as important as the one that it is over. Clay
 *  rather than rose or `--alert-critical-*`, which belong to the live crisis
 *  states — an event chip is history, and history should not shout. */
const TONE: Partial<Record<ChatEventKind, string>> = {
  "escalation-opened": "bg-[var(--band-clay-bg)] text-[var(--band-clay-fg)]",
  /* ═══ THE CLOSE IS CALM AND FORWARD (pack v3.0, Workstream E2) ═══ Green
     family, not clay: with the raise it reads as an arc, not an alarm. */
  "escalation-resolved": "bg-[var(--band-sage-bg)] text-[var(--band-sage-fg)]",
};
/** ═══ THE RAISE, WHILE IT IS LIVE ═══ In the alert family while the
 *  escalation is open on Tier 1–2; once it closes it steps back to its
 *  historical clay tint. */
const LIVE_RAISE = "bg-[var(--alert-critical-bg)] text-[var(--alert-critical-fg)]";

/** ═══ THE SENTENCE, COMPOSED FROM THE RECORD ═══
 *
 *  Past tense, active voice, and it NAMES THE ACTOR — "You sent Hot Takes", not
 *  "Hot Takes was sent". A mentor scanning a thread needs to know whether they did
 *  this or the teen did, and a passive sentence makes them work it out from
 *  context.
 *
 *  TODO-COPY on all six. No exclamation marks and no celebration, including on
 *  `escalation-resolved` — an escalation ending well is a relief, not an
 *  achievement, and a thread is not the place to congratulate anybody. */
function sentence(e: ChatEvent, actorName: string): string {
  const who = actorName;
  switch (e.kind) {
    case "activity-sent":
      return `${who} sent ${e.artifactName}`;
    case "activity-rescinded":
      return `${who} took back ${e.artifactName}`;
    case "note-added":
      return `${who} added a note`;
    case "swap-started":
      return `${who} started ${e.artifactName}`;
    case "escalation-opened":
      return `${who} raised an escalation`;
    case "escalation-resolved":
      /* "closed", and never the teen: only a supervisor closes (pack v3.0). */
      return `${who} closed the escalation`;
  }
}

/** Which kinds have something behind them. See the module note. */
export function eventOpens(kind: ChatEventKind): boolean {
  return (
    kind === "activity-sent" ||
    kind === "note-added" ||
    kind === "swap-started" ||
    kind === "escalation-opened"
  );
}

export function EventChip({
  event,
  /** "You" for the mentor, the teen's or colleague's first name otherwise.
   *  Resolved by the caller, which is the only place that knows who is who. */
  actorName,
  variant = "inline",
  /** ═══ THE SEND SURVIVES ITS OWN RETRACTION, QUIETLY ═══
   *  When the artifact behind an `activity-sent` has been taken back, the chip is
   *  still there and still says what it said — the history is that this WAS sent —
   *  but it steps back, because the live fact is now the `activity-rescinded` chip
   *  below it. Deleting the original would be rewriting the record; leaving it at
   *  full strength would leave two chips claiming to be current. */
  retracted,
  live = false,
  onOpen,
}: {
  event: ChatEvent;
  actorName: string;
  variant?: "inline" | "row";
  retracted?: boolean;
  /** This is the raise of the escalation still open at Tier 1–2. */
  live?: boolean;
  onOpen?: (event: ChatEvent) => void;
}) {
  const Glyph = GLYPH[event.kind];
  const text = sentence(event, actorName);
  const tone = live && event.kind === "escalation-opened" ? LIVE_RAISE : TONE[event.kind];
  const opens = eventOpens(event.kind) && !!onOpen;

  const body = (
    <>
      <Glyph className="size-3.5 shrink-0" aria-hidden />
      <span className={cn(variant === "row" ? "min-w-0 flex-1" : "min-w-0")}>{text}</span>
      {/* ═══ NO `opacity-70` ON ALREADY-MUTED INK ═══
          MEASURED BY AXE at 2.74:1. An untinted chip's text is `--text-muted`
          (#6e6b67), which clears AA on `--surface-s1` at 5.30:1 — and 70% of it
          resolves to #979490, which does not clear anything. The opacity was
          reaching for "quieter than the sentence" on ink that was already the
          quietest step available.
          Dropped rather than reduced: the time and the sentence are the same
          weight of information on a chip this small, and the tinted variants have
          the same problem with less headroom. */}
      <time
        className="shrink-0 tabular-nums"
        dateTime={new Date(event.at).toISOString()}
      >
        {clockTime(event.at)}
      </time>
    </>
  );

  const shape = cn(
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
    tone ?? "text-[var(--text-muted)]",
    /* A LINE THROUGH THE SENTENCE, not a colour change. Reduced contrast alone
       would be indistinguishable from the muted ink every untinted chip already
       carries — and `line-through` is a treatment a screen reader can also expose,
       which a tint is not. */
    retracted && "line-through decoration-1 opacity-60",
    // An untinted chip needs SOMETHING when it is pressable, or hover is the only
    // affordance and touch has none.
    opens && !tone && "bg-[var(--surface-s1)]",
    opens && "transition-colors hover:brightness-[0.97]",
    RING
  );

  if (variant === "row") {
    // In the Timeline the chip fills its row and the label is the row's own.
    const rowShape = cn(
      "flex w-full items-center gap-2 rounded-[var(--radius-inset)] px-2.5 py-2 text-left",
      tone ?? "text-[var(--text-secondary)]",
      retracted && "line-through decoration-1 opacity-60",
      opens && "transition-colors hover:bg-[var(--tint-hover)]",
      RING
    );
    return opens ? (
      <button
        type="button"
        onClick={() => onOpen?.(event)}
        className={rowShape}
        style={{ font: "var(--type-body)" }}
      >
        {body}
      </button>
    ) : (
      <div className={rowShape} style={{ font: "var(--type-body)" }}>
        {body}
      </div>
    );
  }

  return (
    // A LIST ITEM, because the transcript is a list and an event is one of its
    // entries — a bare div here would break the list's structure for a screen
    // reader walking it.
    <li data-slot="event-chip" data-kind={event.kind} className="mt-3 flex justify-center">
      {opens ? (
        <button
          type="button"
          onClick={() => onOpen?.(event)}
          className={shape}
          style={{ font: "var(--type-field-label)" }}
        >
          {body}
        </button>
      ) : (
        <span className={shape} style={{ font: "var(--type-field-label)" }}>
          {body}
        </span>
      )}
    </li>
  );
}
