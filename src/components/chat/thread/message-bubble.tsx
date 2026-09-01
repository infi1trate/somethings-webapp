"use client";

// A MESSAGE. Text, photo, voice note or GIF — one component, because a thread
// where each kind is its own component is a thread where each kind drifts on
// spacing, alignment and timestamp placement.
//
// ═══ SIDE AND TINT CARRY THE SENDER; THE TIME CARRIES THE FACT ═══
//
// The mentor's messages sit right in a tinted fill; the teen's sit left on the
// card. That is enough for a sighted reader and NOT enough on its own — so the
// accessible name states who sent it. Alignment is not information a screen reader
// has.
//
// ═══ MESSAGE TEXT IS `--type-message` (16/24) ═══
//
// Every other body role in this codebase is 14/20 or 12/16, and both are right for
// what they do — record rows and panel meta are scanned. A thread is the one place
// in this product where somebody reads continuously, and 14/20 is a data size
// being asked to do prose. `--type-message` is Bloom's Body/Large-Regular, which
// existed on the ramp and had no token; see the token's own comment.
//
// NO BOLD INSIDE A BUBBLE. Bloom's Body/Large-Bold is Lausanne 700 and that file
// is not shipped, so it would be a browser-synthesised fake (gap row 330). Nothing
// in the thread design needs it.

import { Mic } from "lucide-react";
import { MediaFrame } from "@/components/chat/thread/media-frame";
import { MessageActions } from "@/components/chat/thread/message-actions";
import type { ChatMessage, MessageReaction } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

/** TODO-COPY. Clock time, which is what a reader wants INSIDE a conversation —
 *  the coarse "3d" belongs to the list, where rows are compared to each other. */
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function durationLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MessageBubble({
  message,
  /** Who "them" is, for the accessible name. */
  theirName,
  /** False when this message continues the one above it — see `needsMeta`. */
  showMeta = true,
  /** Reactions added in this session, merged over the fixture's own. Session-local
   *  by decision — see `MessageActions`. */
  added,
  onReact,
}: {
  message: ChatMessage;
  theirName: string;
  showMeta?: boolean;
  added?: string[];
  onReact?: (emoji: string) => void;
}) {
  const mine = message.sender === "mentor";
  const who = mine ? "You" : theirName; // TODO-COPY

  /* ═══ FIXTURE REACTIONS AND ADDED ONES ARE ONE LIST, DEDUPED ═══
     A mentor pressing 😂 on a message a teen already reacted to with 😂 should not
     produce two of them. Merged here rather than at the call site so every
     consumer of this component gets the same behaviour. */
  const reactions: MessageReaction[] = (() => {
    const base = message.reactions ?? [];
    if (!added?.length) return base;
    const seen = new Set(base.map((r) => r.emoji));
    return [
      ...base,
      ...added
        .filter((e) => !seen.has(e))
        .map((emoji) => ({ emoji, by: "mentor" as const })),
    ];
  })();

  /** The bubble, spoken. Sender, then content, then time — the order a reader
   *  would ask for them in. Non-text kinds name themselves, because "photo" is
   *  the content when there is no text. */
  const spokenKind =
    message.kind === "image"
      ? `photo: ${message.media?.alt ?? ""}`
      : message.kind === "gif"
        ? `animation: ${message.media?.alt ?? ""}`
        : message.kind === "voice"
          ? `voice note, ${durationLabel(message.durationSec ?? 0)}`
          : (message.text ?? "");

  return (
    <li
      className={cn(
        // `group` is what the actions trigger reads for its hover reveal — see
        // `MessageActions`. On the LIST ITEM rather than the bubble, so the
        // trigger sitting beside the bubble is inside the same group.
        "group flex flex-col",
        mine ? "items-end" : "items-start",
        // A continuation sits tighter to what it continues than to the next turn.
        // The spacing is what makes a burst read as one utterance.
        showMeta ? "mt-3" : "mt-1"
      )}
    >
      {showMeta && (
        <p
          className="mb-1 flex items-center gap-1.5 px-1 text-[var(--text-muted)]"
          style={{ font: "var(--type-field-label)" }}
        >
          <span className="text-[var(--text-secondary)]">{who}</span>
          {/* `tabular-nums`: the times sit in a ragged column down one edge of a
              long transcript, and proportional figures make it worse. */}
          <time className="tabular-nums" dateTime={new Date(message.at).toISOString()}>
            {clockTime(message.at)}
          </time>
        </p>
      )}

      {/* THE ROW HOLDS THE BUBBLE AND ITS ACTIONS SIDE BY SIDE, in the order the
          side dictates: the trigger always sits on the OUTSIDE of the bubble, away
          from the column's centre, so it never lands between two messages.
          `max-w-full` on the row and the cap on the bubble, so the trigger's 28px
          does not eat into the message's measure. */}
      <span
        className={cn(
          /* ═══ `w-full`, NOT `max-w-full` ═══
             MEASURED FROM A SCREENSHOT: bubbles wrapped ~80px earlier than their
             cap. The bubble's `max-w-[min(78%,420px)]` resolves against THIS row,
             and a content-sized row makes that circular — the row was as wide as
             the bubble, so 78% of it was always narrower than the bubble wanted.
             A full-width row gives the percentage something real to measure
             against, and `justify-*` is then what puts the pair on its side. */
          "flex w-full items-center gap-1",
          mine ? "flex-row justify-end" : "flex-row-reverse justify-end"
        )}
      >
        {onReact && <MessageActions side={message.sender} onReact={onReact} />}
      <div
        // The accessible name is on the CONTENT, not the list item, so a screen
        // reader reads one coherent string per message.
        aria-label={`${who}, ${spokenKind}, ${clockTime(message.at)}`}
        className={cn(
          "relative max-w-[min(78%,420px)]",
          // A media bubble has no padding and no fill — the image IS the bubble.
          // Padding around a photo reads as a frame nobody asked for.
          message.kind === "image" || message.kind === "gif"
            ? ""
            : cn(
                "rounded-[var(--radius-inset)] px-3.5 py-2.5 text-[var(--text-primary)]",
                /* ═══ THE TEEN'S BUBBLE NEEDS AN EDGE, NOT A LOUDER FILL ═══
                   MEASURED: `--surface-s1` (#f6f4ef) on `--surface-card`
                   (#ffffff) is 1.06:1. The text read fine and the BUBBLE did
                   not exist — a screenshot showed the teen's words floating with
                   no shape around them, which removes the one cue that says
                   where one message ends and the next begins.
                   A hairline rather than a stronger tint, because the alternative
                   was to darken the teen's ground toward the mentor's and lose
                   the side-and-tint distinction that carries who is speaking.
                   The mentor's fill is `--surface-s2` at 1.13:1 — also weak as a
                   fill, and it does not need help: it is the only tinted thing on
                   a white column, so its shape reads by being different rather
                   than by being dark. */
                mine
                  ? "bg-[var(--surface-s2)]"
                  : "border border-[color:var(--border-subtle)] bg-[var(--surface-s1)]"
              )
        )}
      >
        {message.kind === "text" && (
          <p
            className="whitespace-pre-wrap break-words"
            style={{
              font: "var(--type-message)",
              letterSpacing: "var(--type-message-tracking)",
            }}
          >
            {message.text}
          </p>
        )}

        {(message.kind === "image" || message.kind === "gif") && message.media && (
          <MediaFrame media={message.media} />
        )}

        {message.kind === "voice" && (
          /* ═══ A DURATION, NOT A SCRUBBER ═══
             There is no audio in this prototype, so a waveform with a playhead
             would be a control that cannot be operated — worse than none, because
             it invites a press. What a reader actually needs from a voice note in
             a transcript is that one exists and how long it is. */
          <span className="flex items-center gap-2">
            <Mic className="size-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
            <span
              className="tabular-nums text-[var(--text-secondary)]"
              style={{ font: "var(--type-body)" }}
            >
              {durationLabel(message.durationSec ?? 0)}
            </span>
          </span>
        )}
      </div>
      </span>

      {reactions.length > 0 && (
        /* ═══ REACTIONS SIT ON THE BUBBLE'S EDGE, NOT OVER IT ═══
           Overlapping the corner is the convention elsewhere and it costs a line
           of text to the overlap on a two-line message. Below and inset keeps
           every character of the message readable, which on this surface — where
           the message may be a disclosure — is the trade to make.
           The count is spoken; the emoji is not, because a screen reader reading
           "grinning face with smiling eyes" mid-transcript is noise. */
        <span
          className={cn(
            "-mt-1 flex items-center gap-0.5 rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-1.5 py-0.5",
            mine ? "mr-2" : "ml-2"
          )}
        >
          <span aria-hidden className="text-[11px] leading-[14px]">
            {reactions.map((r) => r.emoji).join("")}
          </span>
          <span className="sr-only">
            {/* TODO-COPY */}
            {reactions.length === 1 ? "1 reaction" : `${reactions.length} reactions`}
          </span>
        </span>
      )}
    </li>
  );
}

/** ═══ WHEN A MESSAGE NEEDS ITS OWN NAME AND TIME ═══
 *
 *  When the speaker changed, or when enough time passed that the gap is itself
 *  information. Five minutes is the threshold — short enough that a real pause in
 *  a conversation shows, long enough that a burst of consecutive messages stays
 *  one block.
 *
 *  The same rule and the same constant as the Tasks pane's conversation excerpt,
 *  which learned it the hard way: a transcript that heads every bubble reads as
 *  twice as many events as it contains, and a hesitant sentence sent in two parts
 *  looks like two separate disclosures. */
export const CLUSTER_MS = 5 * 60_000;

export function needsMeta(m: ChatMessage, prev: ChatMessage | undefined): boolean {
  if (!prev) return true;
  if (m.sender !== prev.sender) return true;
  return m.at - prev.at > CLUSTER_MS;
}
