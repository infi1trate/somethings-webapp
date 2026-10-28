// ═══════════════════════════════════════════════════════════════════════════
// THE CARE HERO'S SIX METRICS (pack v11.0 §4.4)
//
// Pure numbers; the unit and the window live in the label. ZERO IS A VALUE
// and renders as 0. ABSENT IS NOT ZERO: a metric with no source is `null`
// and the hero says so ("not available yet"), never a number nobody
// measured. Nothing here is fabricated — each count reads an existing
// source, named at its field.

import { DEMO_TEENS, careFlagsFor } from "@/lib/record/people-demo";
import { daysInMentorship } from "@/lib/record/relationships";

const DAY = 86_400_000;
/** The metric window. BLOCKED CONSTANT (Meg): 30 days is the pack's default. */
export const METRIC_WINDOW_DAYS = 30;

export interface HeroMetrics {
  /** `daysInMentorship` — the relationship's own start (fixture stamps). */
  daysInMentorship: number | null;
  /** BLOCKED (Meg): "engaged days" has no definition and no per-day log
   *  exists. Always null until it does — the slot renders, the number does
   *  not. */
  engagedDays: null;
  /** The mentor's own messages in this conversation, in the window — read
   *  off the thread the chat renders (fixture script + session sends). */
  messagesSent: number | null;
  /** Risk flags on the record (`careFlagsFor`, kind `risk_flag`) raised in
   *  the window. Fixture data (TODO-DATA). */
  flags: number | null;
  /** Escalations opened in the window — the tiering store (fixture history,
   *  session writes, the open one). */
  escalations: number | null;
  /** This conversation's chat notes. "Notes" is undefined in the data
   *  layer; chat notes are the answered default (2026-10-28) — real,
   *  store-backed, the same count in both lenses. Definition: Meg. */
  notes: number | null;
}

export function heroMetrics(
  teenId: string,
  now: number,
  inputs: {
    /** The thread's messages (sender and time), as the chat renders them. */
    messages: readonly { sender: string; at: number }[] | null;
    /** Opened-at times of this teen's escalations, from `useTiering`. */
    escalationsOpenedAt: readonly number[];
    /** This thread's chat notes. */
    notes: number | null;
  }
): HeroMetrics {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  const since = now - METRIC_WINDOW_DAYS * DAY;
  return {
    daysInMentorship: teen ? daysInMentorship(teen) : null,
    engagedDays: null,
    messagesSent: inputs.messages ? inputs.messages.filter((m) => m.sender === "mentor" && m.at >= since).length : null,
    flags: teen ? careFlagsFor(teen).filter((f) => f.kind === "risk_flag" && f.daysAgo <= METRIC_WINDOW_DAYS).length : null,
    escalations: inputs.escalationsOpenedAt.filter((at) => at >= since).length,
    notes: inputs.notes,
  };
}
