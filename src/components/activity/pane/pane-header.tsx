"use client";

// THE PANE HEADER — what happened, how it came out, and to whom.
//
// Three facts on two lines: the event type, the outcome, and the object. The
// pane's old header was the event type alone, which meant the answer to "how did
// this come out" was somewhere in the body, or in a metadata row indistinguishable
// from four others.
//
// ═══ THE PILL CARRIES THE WORD, NEVER JUST THE COLOUR ═══
//
// Active, Monitoring, Closed, Referred, Paused. The tint is a second channel and
// the word is the signal (SC 1.4.1) — which matters more here than usual, because
// several of these outcomes differ only in degree and a reader who is
// distinguishing "monitoring" from "closed" by hue alone is guessing.

import { RecordAvatar } from "@/components/record/record-avatar";
import { cn } from "@/lib/utils";

/** ═══ TONES FROM EXISTING SEMANTIC TOKENS ═══
 *
 *  No new tokens. These are the record's own status pairs, chosen by what the
 *  outcome MEANS rather than by hue:
 *
 *   · positive — a thing that ended well or needs nothing (Closed, Active)
 *   · attention — a thing still being watched (Monitoring)
 *   · escalated — a thing handed onward (Referred)
 *   · neutral — a state that is neither (Paused)
 *
 *  `Active` reads as positive rather than neutral deliberately: on a billing
 *  review it means the code took effect, which is the successful outcome of the
 *  review, not a holding state. */
const TONE = {
  positive: "bg-[var(--status-positive-bg)] text-[var(--status-positive-fg)]",
  attention: "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]",
  escalated: "bg-[var(--band-rose-bg)] text-[var(--band-rose-fg)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
} as const;

export type OutcomeTone = keyof typeof TONE;

/** The vocabulary, and its tone. A closed set rather than a free string, so a
 *  new outcome word is a decision someone makes here — not a value that arrives
 *  from a payload and renders untinted because nobody mapped it. */
export const OUTCOME_TONE: Record<string, OutcomeTone> = {
  Active: "positive",
  Closed: "positive",
  Monitoring: "attention",
  Referred: "escalated",
  Escalated: "escalated",
  Paused: "neutral",
};

export function OutcomePill({ word }: { word: string }) {
  // An unmapped word still renders, in the neutral tone. A missing tint is a
  // smaller failure than a missing outcome.
  const tone = OUTCOME_TONE[word] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-medium leading-[18px]",
        TONE[tone]
      )}
    >
      {word}
    </span>
  );
}

export function PaneHeader({
  /** The event type, in words. TODO-COPY at the call sites. */
  eventName,
  /** The outcome word. Absent for events that have no outcome — an opened
   *  review has not come out any way yet, and "Pending" would be filler. */
  outcome,
  /** The object the event concerns. FIRST NAME ONLY: this surface never renders
   *  a surname, and the name arrives pre-formatted from the query. */
  subjectName,
}: {
  eventName: string;
  outcome?: string | null;
  subjectName?: string | null;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <h2
          className="min-w-0 text-[var(--text-primary)]"
          style={{ font: "var(--type-card-title)" }}
        >
          {eventName}
        </h2>
        {outcome && <OutcomePill word={outcome} />}
      </div>

      {/* THE OBJECT, ON ITS OWN LINE. Avatar plus first name — the same inline
          unit the feed rows use, and centred the same way: a circle is centred
          across the cap band, never sat on the baseline (gap row 350). */}
      {subjectName && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13.5px] leading-[19px] text-[var(--text-secondary)]">
          <RecordAvatar name={subjectName} size={16} />
          <span>{subjectName}</span>
        </p>
      )}
    </div>
  );
}
