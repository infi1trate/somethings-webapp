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

import { ClipboardList, ListPlus, Mic } from "lucide-react";
import { MediaFrame } from "@/components/chat/thread/media-frame";
import { MessageActions } from "@/components/chat/thread/message-actions";
import type { ChatMessage, MessageReaction } from "@/lib/chat/types";
import { startsCluster } from "@/lib/chat/clustering";
import { ASSESSMENT_QUESTIONS } from "@/lib/tiering/escalation";
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
  selfName,
  /** False when this message continues the one above it — see `needsMeta`. */
  showMeta = true,
  /** Reactions added in this session, merged over the fixture's own. Session-local
   *  by decision — see `MessageActions`. */
  added,
  /** ═══ INSIDE THE ESCALATION WINDOW ═══
   *  True for a message sent after an escalation opened and before it resolved. A
   *  clay rule down the side, so a supervisor reading back can see at a glance
   *  which part of the conversation happened while this was live — which is the
   *  part they will actually read. */
  inEscalation,
  /** The message the escalation was raised FROM. One per escalation, and it gets a
   *  stronger marker than the window does: it is the sentence that caused this. */
  isAnchor,
  onReact,
  onTag,
  onEscalate,
  onAddToEscalation,
  addedToEscalation,
  onOpenAssessment,
}: {
  message: ChatMessage;
  theirName: string;
  /** Overrides "You" on the mentor's own lines (an observer is reading). */
  selfName?: string;
  showMeta?: boolean;
  added?: string[];
  inEscalation?: boolean;
  isAnchor?: boolean;
  onReact?: (emoji: string) => void;
  onTag?: () => void;
  onEscalate?: () => void;
  onAddToEscalation?: () => void;
  /** This message is on the escalation's timeline — its note, if any (pack
   *  v3.0, make it magical 3: the thread and the record acknowledge each
   *  other). `undefined` when it is not. */
  addedToEscalation?: string;
  /** Opens the assessment this line was asked from (F2). */
  onOpenAssessment?: () => void;
}) {
  const mine = message.sender === "mentor";
  /* TODO-COPY. "Question 3" — a follow-up names its parent. */
  const asked = message.origin?.kind === "assessment" ? message.origin.questionId : null;
  const askedN = asked ? ASSESSMENT_QUESTIONS.findIndex((q) => q.id === asked.replace(/b$/, "")) + 1 : 0;
  const askedLabel = asked ? `Assessment question ${askedN}${asked.endsWith("b") ? ", follow-up" : ""}` : "";
  /* `selfName` when a supervisor is watching: the mentor's lines are the
     mentor's, not "You" (support-beside-hub). */
  const who = mine ? (selfName ?? "You") : theirName; // TODO-COPY

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
      /* ADDRESSABLE. A note's `ContextReference` scrolls the transcript to the
         message it points at, and the only stable handle for that is the message's
         own id on its list item. */
      id={`msg-${message.id}`}
      className={cn(
        // `group` is what the actions trigger reads for its hover reveal — see
        // `MessageActions`. On the LIST ITEM rather than the bubble, so the
        // trigger sitting beside the bubble is inside the same group.
        "group flex flex-col",
        mine ? "items-end" : "items-start",
        // A continuation sits tighter to what it continues than to the next turn.
        // The spacing is what makes a burst read as one utterance.
        showMeta ? "mt-3" : "mt-1",
        /* ═══ THE ESCALATION CONTAINER ═══
           A rule down the left of the whole transcript for the duration of the
           escalation, rather than a treatment on each bubble — which would have
           made a run of messages read as a run of separate alarms. The rule is
           continuous because the state is continuous.
           `--band-clay-*`, the history tone, NOT `--alert-critical-*`: the banner
           above is the loud one, and a transcript with a red rule down forty
           messages would spend the whole alarm budget on marking a region. */
        inEscalation && "border-l-2 border-[color:var(--band-clay-fg)]/35 pl-3 -ml-3",
        isAnchor && "border-l-2 border-[color:var(--band-clay-fg)] pl-3 -ml-3"
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
        {onReact && (
          <MessageActions
            side={message.sender}
            onReact={onReact}
            onTag={onTag}
            onEscalate={onEscalate}
            onAddToEscalation={addedToEscalation === undefined ? onAddToEscalation : undefined}
          />
        )}
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
        {asked && (
          /* ═══ ASKED FROM THE ASSESSMENT (pack v4.0, F2) ═══ The same quiet
             corner as an added moment, one step left when both apply; it
             opens the assessment. Named in words, never an icon alone. */
          <button
            type="button"
            data-asked-from-assessment={asked}
            onClick={onOpenAssessment}
            disabled={!onOpenAssessment}
            title={`${askedLabel} — open the assessment`}
            className={cn(
              "absolute -top-2 flex size-5 items-center justify-center rounded-full border border-[color:var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
              "before:absolute before:-inset-2.5 before:content-['']",
              addedToEscalation !== undefined ? "right-8" : "right-2"
            )}
          >
            <ClipboardList aria-hidden className="size-3" />
            <span className="sr-only">{askedLabel} — open the assessment</span>
          </button>
        )}
        {addedToEscalation !== undefined && (
          /* ═══ ON THE ESCALATION'S TIMELINE ═══ A quiet corner glyph; hover
             previews the mentor's note (make it magical 3). The words are in
             the accessible name too, so it is never an icon alone. */
          <span
            data-added-to-escalation
            title={addedToEscalation ? `Added to the escalation: ${addedToEscalation}` : "Added to the escalation"}
            className="absolute -top-2 right-2 flex size-5 items-center justify-center rounded-full border border-[color:var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]"
          >
            <ListPlus aria-hidden className="size-3" />
            <span className="sr-only">Added to the escalation{addedToEscalation ? `: ${addedToEscalation}` : ""}</span>
          </span>
        )}
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
 *  ═══ THE RULE MOVED OUT (Phase 6) ═══
 *  This held its own `CLUSTER_MS = 5 * 60_000` and its own three branches, with
 *  a comment pointing at the supervisor excerpt's identical copy — "the same
 *  rule and the same constant as the Tasks pane's conversation excerpt". A fork
 *  that documents itself is still a fork, and five minutes is a judgment about
 *  how a teen's messages are grouped when somebody reads them for risk: if it is
 *  revised it must be revised once. `lib/chat/clustering.ts` has the reasoning.
 *
 *  THE BEHAVIOUR IS UNCHANGED, which was the constraint on the de-fork: same
 *  three branches in the same order, and the thread's DOM was captured before
 *  and after and compared rather than reasoned about.
 *
 *  `CLUSTER_MS` IS RE-EXPORTED because this module's consumers import it from
 *  here. A re-export rather than a second declaration: one definition, one
 *  value, and the import site does not have to change to prove it. */
export { CLUSTER_MS } from "@/lib/chat/clustering";

export function needsMeta(m: ChatMessage, prev: ChatMessage | undefined): boolean {
  return startsCluster(m, prev);
}
