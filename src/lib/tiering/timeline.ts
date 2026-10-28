// ═══════════════════════════════════════════════════════════════════════════
// THE ESCALATION TIMELINE — node derivation (pack v3.0, Workstream C)
//
// ═══ ONE LIST OF NODES PER LENS, DERIVED FROM THE RECORD ═══ Like the stages
// it replaces in presentation (`mentorStage` / `supervisorStage`), nothing here
// is stored: every node's state is read off fields the exchange already
// writes. That is what makes the invariant checkable — EXACTLY ONE current node
// per lens, in every state the record can be in (`__tests__/timeline.test.ts`).
//
// Three node states:
//   completed  a check, collapsed to one line with its time
//   current    the pulse; the step's action card expands inside it
//   upcoming   ghosted, locked, one line naming what comes next and when
//
// ═══ ONLY TWO UPCOMING NODES ═══ The next step and the exit; the exit is
// always shown because it is what makes the escalation feel resolvable.
//
// ═══ ONE CRISIS NOTE NODE (pack v6.1, Supersession 2) ═══ v3.0's "the note
// assembles as timeline events" — a node per section, then Outcome, then
// Debrief — is REVERSED: one Crisis note node holds the accordion
// (`CrisisNoteDeck` since pack v11.0 — the accordion is deleted — rows from `note-rows.ts`) and completes when every
// row is done. Traded for random access and a quieter timeline. Close &
// follow-up stays its own node: the action, not documentation.
//
// ═══ THE BATON SURVIVES AS A MODEL ═══ The "Your move" banner is retired
// (Supersession 1); whose move it is becomes the current node's position.
// `batonHolder` is unchanged and still answers the question for anything that
// asks it.

import type { EscalationState } from "@/lib/chat/types";
import type { TierState } from "@/lib/tiering/events";
import { assessmentOf, escalationTarget, needsAssessment, workingTier } from "@/lib/tiering/escalation";
import { noteComplete, noteDoneAt, noteProgress } from "@/lib/tiering/note-rows";
import { PLATFORM, isAlertTier } from "@/lib/tiering/tiers";

export type NodeState = "completed" | "current" | "upcoming";
export type Lens = "mentor" | "supervisor";

export type NodeKind =
  | "raised"
  | "moment"
  | "assessment"
  | "waiting"
  | "review"
  | "confirm"
  | "note"
  | "close"
  | "closed";

export interface TimelineNode {
  id: string;
  kind: NodeKind;
  state: NodeState;
  /** When it happened (completed) — null for current and upcoming. */
  at: number | null;
  /** For a moment node. */
  momentId?: string;
  /** Upcoming only: WHEN it comes, as an "after …" clause. The step's NAME
   *  is the view's, from one label set (pack v5.0, A3): the path row and the
   *  locked rows used to name the same step twice ("Brandy takes over" /
   *  "Your supervisor takes it from here"). TODO-COPY. */
  condition?: string;
}

/** ═══ ORIENTATION — one constant, flip-able (the pack's instruction) ═══
 *  "live-first": upcoming at top, then current, then completed newest-first,
 *  so the live action sits where attention lands. "chronological": oldest at
 *  top. */
export const TIMELINE_ORDER: "live-first" | "chronological" = "live-first";

/** The record's tier work, for the lens that is doing it. */
function noteTier(e: EscalationState) {
  return e.confirmedTier !== undefined && isAlertTier(e.confirmedTier) ? e.confirmedTier : null;
}

/** Chronological nodes for one lens. `orderNodes` arranges them. */
export function timelineNodes(e: EscalationState, state: TierState, lens: Lens): TimelineNode[] {
  const a = assessmentOf(e);
  const closed = e.resolvedAt !== null;
  const out: TimelineNode[] = [{ id: "raised", kind: "raised", state: "completed", at: e.openedAt }];

  /* ADDED CHAT MOMENTS, both lenses, as completed events in time. */
  for (const m of e.moments ?? []) out.push({ id: `moment:${m.id}`, kind: "moment", state: "completed", at: m.at, momentId: m.id });

  const done: TimelineNode[] = [];
  let current: TimelineNode | null = null;
  const upcoming: TimelineNode[] = [];
  const push = (n: Omit<TimelineNode, "state" | "at">, isDone: boolean, at: number | null) => {
    if (isDone) done.push({ ...n, state: "completed", at });
    else if (!current) current = { ...n, state: "current", at: null };
    else upcoming.push({ ...n, state: "upcoming", at: null });
  };

  if (lens === "mentor") {
    const needs = needsAssessment(workingTier(e, state));
    if (needs) push({ id: "assessment", kind: "assessment" }, a.submittedAt !== null, a.submittedAt);
    push({ id: "waiting", kind: "waiting", condition: needs ? "after you submit" : undefined }, closed, null);
    push({ id: "closed", kind: "closed", condition: "after the note is complete" }, false, null);
    // The waiting node has no completion time of its own — it ends at the close.
    for (const d of done) if (d.kind === "waiting") d.at = e.resolvedAt;
  } else {
    const target = escalationTarget(e);
    if (target === PLATFORM) {
      push({ id: "review", kind: "review" }, closed, e.resolvedAt);
    } else {
      /* ═══ A CLOSED RECORD IS HISTORY (pack v8.0) ═══ Every step that
         happened is done; a step that never did — an assessment never sent, a
         note a Tier 3 exit never needed — is not drawn at all. */
      if (needsAssessment(target) && !(closed && a.submittedAt === null)) {
        push({ id: "assessment", kind: "assessment" }, a.submittedAt !== null, a.submittedAt);
      }
      push({ id: "confirm", kind: "confirm", condition: "after the assessment arrives" }, e.confirmedTier !== undefined || closed, e.confirmedAt ?? null);
      const t = noteTier(e);
      /* Before a Tier 1–2 confirmation the note's length is not known; it is
         simply the step after the confirmation. */
      if (!(closed && t === null)) push({ id: "note", kind: "note", condition: "after the tier is confirmed" }, (t !== null && noteComplete(e, t)) || closed, t !== null ? noteDoneAt(e, t) : null);
      push({ id: "close", kind: "close", condition: "after the note is complete" }, closed, e.resolvedAt);
    }
    /* ═══ THE SUPERVISOR'S CLOSED SUMMARY (pack v8.0) ═══ The Escalation
       review tab converts to its closed summary in BOTH lenses, so a closed
       record's current node is the summary here too, until dismissed. */
    if (closed) push({ id: "closed", kind: "closed" }, false, null);
  }

  /* A CLOSED RECORD: the summary card is the current node on both lenses
     (pack v8.0 — the supervisor's used to have none), until dismissed. */
  return [...out, ...done.sort((x, y) => (x.at ?? 0) - (y.at ?? 0)), ...(current ? [current] : []), ...trimUpcoming(upcoming)];
}

/** The next step and the exit; nothing in between. */
function trimUpcoming(up: TimelineNode[]): TimelineNode[] {
  if (up.length <= 2) return up;
  return [up[0], up[up.length - 1]];
}

/** Arrange per `TIMELINE_ORDER`. */
export function orderNodes(nodes: TimelineNode[], order = TIMELINE_ORDER): TimelineNode[] {
  if (order === "chronological") return nodes;
  const up = nodes.filter((n) => n.state === "upcoming").reverse(); // exit at the very top
  const cur = nodes.filter((n) => n.state === "current");
  const past = nodes.filter((n) => n.state === "completed").sort((x, y) => (y.at ?? 0) - (x.at ?? 0));
  return [...up, ...cur, ...past];
}

export const currentNode = (nodes: TimelineNode[]) => nodes.find((n) => n.state === "current") ?? null;

/** The crisis note's live progress, for its node's title — null before a
 *  Tier 1–2 confirmation. */
export function noteProgressOf(e: EscalationState): { done: number; total: number } | null {
  const t = noteTier(e);
  return t ? noteProgress(e, t) : null;
}

/** The tier the note is written at (Tier 1 or 2), once confirmed. */
export const noteTierOf = noteTier;
