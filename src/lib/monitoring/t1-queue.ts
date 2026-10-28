// ═══════════════════════════════════════════════════════════════════════════
// THE TIER 1 QUEUE (Monitoring v4) — pure: stage, response, holder, action
//
// The Tier 1 section is an escalation queue, not a run-on of chips. Every
// cell is derived from the escalation record and the tier log — the same
// store the chat and the record read — so the queue cannot disagree with the
// conversation it opens.
//
// ═══ THE STEPPER'S ORDER IS THE PRODUCT'S (answered 2026-10-28) ═══ The brief
// read Requested → Confirmed → Assessment → Note. This product's sequence
// is the mentor's assessment FIRST and the supervisor's confirmation after
// it arrives (pack v3.0: Confirm waits on the assessment), so the stepper is
// Requested → Assessment → Confirmed → Note.
//
// ═══ A RESPONSE IS A STATE, NEVER A COUNTDOWN PAST ZERO ═══ Inside the 60s
// window: "0:42 to confirm". Past it: "Overdue 14m" — "0:00 left" cannot be
// produced (tested). Confirmed: "Confirmed by Sarah · 0:48".
//
// ═══ SUPERSEDES pack v2.0's "time-to-confirm is never shown" — IN THIS ONE
// PLACE ═══ The brief specifies "Confirmed by Sarah · 0:48" on the queue: a
// supervisor reading the shift's queue sees how long each confirmation took.
// It stays off the chat and the record. Recorded in AGENTS.md.

import type { EscalationState } from "@/lib/chat/types";
import { assessmentOf, supervisorStage } from "@/lib/tiering/escalation";
import { deckProgress } from "@/lib/tiering/deck";
import { T1_RESPONSE_SECONDS } from "@/lib/tiering/tiers";

export type T1Step = "requested" | "assessment" | "confirmed" | "note";
export const T1_STEPS: readonly T1Step[] = ["requested", "assessment", "confirmed", "note"];
/** TODO-COPY. The stepper's step names (its current step is labelled). */
export const T1_STEP_LABEL: Record<T1Step, string> = {
  requested: "Requested",
  assessment: "Assessment",
  confirmed: "Confirmed",
  note: "Note",
};

export interface T1Stage {
  /** The step being worked; every step before it is done. */
  step: T1Step;
  /** The line under the stepper. TODO-COPY. */
  label: string;
}

/** Where a Tier 1 escalation stands, read off the record. */
export function t1Stage(e: EscalationState): T1Stage {
  const s = supervisorStage(e);
  if (s === "S0") {
    const p = deckProgress(assessmentOf(e).answers);
    return { step: "assessment", label: p.done === 0 ? "Assessment not started" : `Assessment in · ${p.done} of ${p.needed}` };
  }
  if (e.confirmedTier === undefined) return { step: "confirmed", label: "Awaiting confirmation" };
  return { step: "note", label: "Note in progress" };
}

export type T1Response =
  | { kind: "window"; secondsLeft: number }
  | { kind: "overdue"; seconds: number }
  | { kind: "confirmed"; by: string; ttcMs: number | null };

/** The response, as a state. `confirmedBy` is the confirmer's name as the
 *  viewer reads it ("you" for themselves). */
export function t1Response(e: EscalationState, now: number, confirmedBy: string | null): T1Response {
  if (e.confirmedTier !== undefined) return { kind: "confirmed", by: confirmedBy ?? "a supervisor", ttcMs: e.meta?.timeToConfirmMs ?? (e.confirmedAt ? e.confirmedAt - e.openedAt : null) };
  const elapsed = Math.max(0, Math.floor((now - e.openedAt) / 1000));
  return elapsed < T1_RESPONSE_SECONDS ? { kind: "window", secondsLeft: T1_RESPONSE_SECONDS - elapsed } : { kind: "overdue", seconds: elapsed - T1_RESPONSE_SECONDS };
}

/** m:ss, tabular. */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** "14m", "2h 14m" — an overdue duration, never a countdown. Under a minute
 *  past the window it is "Overdue <1m". TODO-COPY. */
export function overdueText(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 1) return "Overdue <1m";
  if (m < 60) return `Overdue ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Overdue ${h}h ${m % 60}m`;
  return `Overdue ${Math.floor(h / 24)}d ${h % 24}h`;
}

/** The Response cell's words. TODO-COPY. */
export function responseText(r: T1Response): string {
  if (r.kind === "window") return `${clock(r.secondsLeft)} to confirm`;
  if (r.kind === "overdue") return overdueText(r.seconds);
  const by = r.by === "you" ? "you" : r.by;
  return r.ttcMs !== null ? `Confirmed by ${by} · ${clock(Math.max(0, Math.round(r.ttcMs / 1000)))}` : `Confirmed by ${by}`;
}

/** Who has it: "you", another supervisor's name, or nobody. */
export type T1Holder = { kind: "you" } | { kind: "other"; name: string } | { kind: "none" };

export function t1Holder(input: { joinedByYou: boolean; heldBy: string | null; confirmedBy: string | null }): T1Holder {
  if (input.heldBy) return { kind: "other", name: input.heldBy };
  if (input.joinedByYou || input.confirmedBy === "you") return { kind: "you" };
  if (input.confirmedBy) return { kind: "other", name: input.confirmedBy };
  return { kind: "none" };
}

/** One action per row. Join when it is nobody's or yours; Observe when
 *  another supervisor holds it; Resume when you joined and stepped out. */
export type T1Action = "join" | "observe" | "resume";
export function t1Action(holder: T1Holder, joinedByYou: boolean): T1Action {
  if (holder.kind === "other") return "observe";
  if (joinedByYou) return "resume";
  return "join";
}

/** ═══ THE SORT: BY RESPONSE STATE ═══ Overdue first, the longest overdue
 *  at the top; then awaiting, the least time left first; then confirmed and
 *  in progress, the oldest first. A total order (the escalation id last). */
export function compareT1(a: { response: T1Response; openedAt: number; id: string }, b: { response: T1Response; openedAt: number; id: string }): number {
  const rank = (r: T1Response) => (r.kind === "overdue" ? 0 : r.kind === "window" ? 1 : 2);
  const ra = rank(a.response), rb = rank(b.response);
  if (ra !== rb) return ra - rb;
  if (a.response.kind === "overdue" && b.response.kind === "overdue") return b.response.seconds - a.response.seconds;
  if (a.response.kind === "window" && b.response.kind === "window") return a.response.secondsLeft - b.response.secondsLeft;
  if (a.openedAt !== b.openedAt) return a.openedAt - b.openedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The hero's In-crisis detail: "6 awaiting · oldest 14m overdue". */
export function queueSummary(responses: readonly T1Response[]): string | null {
  if (responses.length === 0) return null;
  const awaiting = responses.filter((r) => r.kind !== "confirmed").length;
  const overdue = responses.filter((r): r is Extract<T1Response, { kind: "overdue" }> => r.kind === "overdue");
  const worst = overdue.length ? Math.max(...overdue.map((r) => r.seconds)) : null;
  const head = awaiting ? `${awaiting} awaiting` : `${responses.length} confirmed`;
  return worst !== null ? `${head} · oldest ${overdueText(worst).replace(/^Overdue /, "")} overdue` : head;
}
