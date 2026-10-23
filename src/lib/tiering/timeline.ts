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
// ═══ ONLY TWO UPCOMING NODES ═══ The next step and the exit. A ghost for every
// remaining crisis-note section would bury the live node; the exit is always
// shown because it is what makes the escalation feel resolvable.
//
// ═══ THE BATON SURVIVES AS A MODEL ═══ The "Your move" banner is retired
// (Supersession 1); whose move it is becomes the current node's position.
// `batonHolder` is unchanged and still answers the question for anything that
// asks it.

import type { EscalationState } from "@/lib/chat/types";
import type { TierState } from "@/lib/tiering/events";
import {
  ASSESSMENT_QUESTIONS,
  CRISIS_SECTION_LABEL,
  activeSection,
  answeredCount,
  assessmentOf,
  crisisSections,
  escalationTarget,
  needsAssessment,
  sectionDone,
  workingTier,
  type CrisisSectionId,
} from "@/lib/tiering/escalation";
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
  | "outcome"
  | "debrief"
  | "close"
  | "closed";

export interface TimelineNode {
  id: string;
  kind: NodeKind;
  state: NodeState;
  /** When it happened (completed) — null for current and upcoming. */
  at: number | null;
  /** For a crisis-note section node. */
  section?: CrisisSectionId;
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
      if (needsAssessment(target)) {
        push({ id: "assessment", kind: "assessment" }, a.submittedAt !== null, a.submittedAt);
      }
      push({ id: "confirm", kind: "confirm", condition: "after the assessment arrives" }, e.confirmedTier !== undefined, e.confirmedAt ?? null);
      const t = noteTier(e);
      /* Before a Tier 1–2 confirmation the note's length is not known — the
         requested tier stands in for it, so the exit line is honest either way. */
      const sections = crisisSections(t ?? (isAlertTier(target) ? target : 2));
      sections.forEach((id, i) => {
        /* The condition names the step before it, so it stays true as the
           note fills in. TODO-COPY. */
        const after = i === 0 ? "the tier is confirmed" : CRISIS_SECTION_LABEL[sections[i - 1]].toLowerCase();
        push({ id: `note:${id}`, kind: "note", section: id, condition: `after ${after}` }, sectionDone(e.crisisNote, id), e.crisisNote?.sectionAt?.[id] ?? e.crisisNote?.updatedAt ?? null);
      });
      push({ id: "outcome", kind: "outcome", condition: "after the note is complete" }, !!e.outcome, e.outcome?.chosenAt ?? e.outcome?.savedAt ?? null);
      push({ id: "debrief", kind: "debrief", condition: "after the outcome" }, !!e.outcome?.savedAt, e.outcome?.savedAt ?? null);
      push({ id: "close", kind: "close", condition: "after the debrief" }, closed, e.resolvedAt);
    }
  }

  /* A CLOSED RECORD on the supervisor lens has no current node — the panel
     shows the steady state there, not a timeline. The mentor's closed node is
     the summary card, current until they read it. */
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

/** The assessment's one-line state on the supervisor lens — progress only,
 *  never the live questions (Workstream D). TODO-COPY. */
export function assessmentProgress(e: EscalationState): string {
  return `${answeredCount(assessmentOf(e).answers)} of ${ASSESSMENT_QUESTIONS.length} answered`;
}

/** Which crisis-note section is live, for the supervisor's current node. */
export const liveSection = (e: EscalationState) => (noteTier(e) ? activeSection(e.crisisNote, noteTier(e)!) : null);
