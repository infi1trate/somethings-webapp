// ═══ THE SHIFT — what a supervisor's day is shaped like ═══
//
// ═══ OBLIGATION COMES FROM PROGRESSION, NOT FROM A COUNT REACHING ZERO ═══
//
// This is the whole reason Home exists. Tasks empties and Monitoring never does
// — 43 open flags on a typical shift, 123 on a heavy one, against a routine tier
// with a seven-day SLA. A surface that measured either by "is it zero yet" would
// be asking for something unreachable on one of them, and inbox-zero pressure
// applied to ambient clinical work is how flags become a thing somebody stops
// looking at.
//
// So the shift is a SEQUENCE. Four stages in fixed order, each with a state and
// one way in. A supervisor is somewhere in it, and being somewhere in it is the
// obligation — not a number going down.
//
// ═══ IT SUGGESTS, IT NEVER ENFORCES ═══
//
// No gating, no locked stages, no order a reader is held to. What the sequence
// does is make deviation VISIBLE: a stage untouched past its expected cadence
// says so plainly. The distinction that keeps it non-punitive is that an actual
// SLA breach gets the breach treatment and a stale stage gets neutral emphasis —
// "not reviewed in 2 days" is a fact about the shift, not a failure notice.
//
// ═══ WHAT THIS DELIBERATELY DOES NOT COMPUTE ═══
//
// No trend, no streak, no coverage-over-time, nothing comparative across
// supervisors. A chart of whether somebody kept pace is a performance surface,
// and the punitive dimension of this role is a known sensitivity. Today's
// position and recency only. If a function here ever takes a date RANGE, that is
// the line being crossed.

import { closedToday, headerCounts, openTasks, sortedOpen } from "@/lib/tasks/sort";
import { monitoringObligations } from "@/lib/tasks/obligations";
import { isEscalationTask, lifecycleOf } from "@/lib/tasks/escalation-state";
import { isBreached, type TaskItem, type TaskType } from "@/lib/tasks/types";

export type ShiftStageId = "escalations" | "billing" | "flags" | "chatReview";

/** THE ORDER IS THE PROTOCOL'S, and it never changes. Stages do not reorder and
 *  do not hide — a stage missing from the page is a stage a supervisor stops
 *  expecting to do. */
export const SHIFT_STAGES: ShiftStageId[] = [
  "escalations",
  "billing",
  "flags",
  "chatReview",
];

/** TODO-COPY */
export const STAGE_LABEL: Record<ShiftStageId, string> = {
  escalations: "Escalations",
  billing: "Billing",
  flags: "Risk flags",
  chatReview: "Chat review",
};

/** ═══ HOW A STAGE'S LINE IS TONED ═══
 *
 *  `breach` IS RESERVED FOR AN ACTUAL SLA BREACH and nothing else. A stage that
 *  has simply not been touched lately is `stale`, which reads plainly and carries
 *  no alarm treatment — that separation is what stops the sequence becoming a
 *  performance notice. `clear` is the resting state and says so without
 *  celebrating. */
export type StageTone = "breach" | "attention" | "stale" | "clear" | "unavailable";

export interface ShiftStage {
  id: ShiftStageId;
  label: string;
  /** TODO-COPY. The state, as a sentence a reader can act on. */
  state: string;
  tone: StageTone;
  /** Where the stage's one link goes. Null only when the destination does not
   *  exist — see `chatReview`. */
  href: string | null;
}

/** ═══ THE LADDER — WHICH STAGE THE SUPERVISOR SHOULD BE ON ═══
 *
 *  Deterministic, in this fixed order, and it is a STAGE ordering rather than an
 *  item one. That distinction matters and is why this is written out rather than
 *  delegated:
 *
 *    1 an open escalation
 *    2 a breached Imminent flag
 *    3 billing past its SLA
 *    4 Imminent
 *    5 billing
 *    6 Clinical review
 *    7 Routine review
 *    8 chat review
 *
 *  ═══ IT IS NOT `compareTasks`, AND SAYING SO IS THE POINT ═══
 *
 *  `compareTasks` orders ITEMS: active escalation → breached → tier → deadline.
 *  Run over these stages it would disagree in one specific place — a BREACHED
 *  CLINICAL flag (tierRank 3) outranks on-track billing (rank 4) by the
 *  comparator, while this ladder puts billing at 5 and Clinical at 6 regardless
 *  of breach. That is a deliberate product ordering: billing has a hard external
 *  deadline and a clinical review at 48h is the normal rhythm of a worked queue.
 *
 *  So this does NOT claim to reuse the comparator, because it does not. What it
 *  does reuse is every PREDICATE the surfaces already use — `isBreached`,
 *  `monitoringObligations`, `headerCounts`, `lifecycleOf` — so no second
 *  definition of "breached" or "owed" exists anywhere. And once the ladder has
 *  chosen a stage, WHICH ITEM inside it is the comparator's answer and nothing
 *  else's: see `ladderTargetFor`. */
const LADDER: Array<{
  stage: ShiftStageId;
  reached: (s: ShiftFacts) => boolean;
  /** Which task types the CTA may target once this rung is chosen. */
  types: TaskType[] | null;
}> = [
  { stage: "escalations", reached: (s) => s.activeEscalations > 0, types: ["activeEscalation"] },
  { stage: "flags", reached: (s) => s.imminentBreached > 0, types: ["imminentFlagReview"] },
  { stage: "billing", reached: (s) => s.billing.overdue > 0, types: ["intakeBillingReview", "monthlyReReview"] },
  { stage: "flags", reached: (s) => s.imminentOpen > 0, types: ["imminentFlagReview"] },
  { stage: "billing", reached: (s) => s.billing.open > 0, types: ["intakeBillingReview", "monthlyReReview"] },
  { stage: "flags", reached: (s) => s.clinicalOpen > 0, types: ["clinicalFlagReview"] },
  { stage: "flags", reached: (s) => s.routineOpen > 0, types: ["routineFlagReview"] },
  /* THE LAST RUNG IS ALWAYS REACHED, so the ladder is total and Home always has
     exactly one directive stage — including when everything else is clear. */
  { stage: "chatReview", reached: () => true, types: null },
];

export interface ShiftFacts {
  activeEscalations: number;
  documentationOpen: number;
  documentationOverdue: number;
  billing: { open: number; overdue: number };
  imminentOpen: number;
  imminentBreached: number;
  clinicalOpen: number;
  clinicalBreached: number;
  routineOpen: number;
  closedToday: Partial<Record<string, number>>;
}

/** EVERY NUMBER HOME SHOWS, FROM THE SURFACES' OWN FUNCTIONS. Nothing here
 *  counts anything a surface does not already count the same way — a Home that
 *  disagreed with Tasks about how many billing reviews are open would be worse
 *  than a Home with no counts. */
export function shiftFactsFor(items: TaskItem[], now: number): ShiftFacts {
  const open = openTasks(items);
  const byType = (t: TaskType) => open.filter((i) => i.taskType === t);
  const obligations = monitoringObligations(items, now);
  const imminent = byType("imminentFlagReview");
  const clinical = byType("clinicalFlagReview");

  return {
    activeEscalations: open.filter(
      (i) => isEscalationTask(i) && lifecycleOf(i, now) === "active"
    ).length,
    documentationOpen: obligations.documentationOpen,
    documentationOverdue: obligations.documentationOverdue,
    billing: headerCounts(
      open.filter((i) => i.domain === "billing"),
      now
    ),
    imminentOpen: imminent.length,
    imminentBreached: obligations.imminentBreached,
    clinicalOpen: clinical.length,
    clinicalBreached: clinical.filter((i) => isBreached(i, now)).length,
    routineOpen: byType("routineFlagReview").length,
    closedToday: closedToday(items, now),
  };
}

/** The rung the supervisor is on. Total by construction — the last rung is
 *  always reached — so Home always has exactly one directive stage. */
export function ladderStageFor(facts: ShiftFacts): ShiftStageId {
  return LADDER.find((rung) => rung.reached(facts))!.stage;
}

/** ═══ WHICH ITEM THE DIGEST'S ONE CTA TARGETS ═══
 *
 *  THE LADDER CHOOSES THE STAGE; THE COMPARATOR CHOOSES THE ITEM. Once a rung is
 *  reached, the item is `sortedOpen`'s head among that rung's task types — the
 *  same priority sort both surfaces render by, so the CTA cannot point at
 *  something the list it lands on would not have put first.
 *
 *  Null on the chat-review rung, which has no items and no destination. */
export function ladderTargetFor(
  items: TaskItem[],
  now: number
): TaskItem | null {
  const facts = shiftFactsFor(items, now);
  const rung = LADDER.find((r) => r.reached(facts))!;
  if (!rung.types) return null;
  const allowed = new Set<TaskType>(rung.types);
  return sortedOpen(items, now).find((i) => allowed.has(i.taskType)) ?? null;
}

// ── The stages, as lines a reader can act on ────────────────────────────────

/** ═══ DEEP LINKS — THE ONE WAY INTO EACH STAGE ═══
 *
 *  Both destination routes read `?band=` and Monitoring also reads `?region=`;
 *  see their own notes. Built here rather than at the call site so a stage's
 *  link and the surface it lands on cannot drift apart. */
export const STAGE_HREF = {
  escalations: "/app/monitoring?region=escalations",
  billing: "/app/tasks",
  imminent: "/app/monitoring?band=imminentFlagReview",
  clinical: "/app/monitoring?band=clinicalFlagReview",
  flags: "/app/monitoring",
} as const;

/** TODO-COPY on every string below. Nicole has the whole set.
 *
 *  ═══ EACH LINE SAYS THE STATE, NOT THE COUNT ALONE ═══
 *  A bare number is a fact a reader has to interpret; "2 past 24h" is one they
 *  can act on. Where there is genuinely nothing to report, the line says so
 *  plainly and does not congratulate anybody — an empty queue is the resting
 *  state of this work, not an achievement. */
export function shiftStagesFor(
  facts: ShiftFacts,
  chatRecency: string | null
): ShiftStage[] {
  const stages: ShiftStage[] = [];

  // 1 · ESCALATIONS — live count, or all clear.
  if (facts.activeEscalations > 0) {
    stages.push({
      id: "escalations",
      label: STAGE_LABEL.escalations,
      state: `${facts.activeEscalations} open now`,
      tone: "breach",
      href: STAGE_HREF.escalations,
    });
  } else if (facts.documentationOverdue > 0) {
    stages.push({
      id: "escalations",
      label: STAGE_LABEL.escalations,
      state: `${facts.documentationOverdue} write-up${facts.documentationOverdue === 1 ? "" : "s"} overdue`,
      tone: "breach",
      href: STAGE_HREF.escalations,
    });
  } else if (facts.documentationOpen > 0) {
    stages.push({
      id: "escalations",
      label: STAGE_LABEL.escalations,
      state: `${facts.documentationOpen} write-up${facts.documentationOpen === 1 ? "" : "s"} due`,
      tone: "attention",
      href: STAGE_HREF.escalations,
    });
  } else {
    stages.push({
      id: "escalations",
      label: STAGE_LABEL.escalations,
      state: "All clear",
      tone: "clear",
      href: STAGE_HREF.escalations,
    });
  }

  /* 2 · BILLING.
     ═══ THERE IS NO DENOMINATOR, AND ONE IS NOT INVENTED ═══
     The brief asks for "{n} of {n} done today". `closedToday` counts
     RESOLUTIONS; nothing in the model records how many were DUE at shift start,
     and a denominator assembled from today's open set would move every time a
     new review arrived — so "3 of 18" would mean something different at 9am and
     at noon. What is true and stable is what has been done and what is left. */
  const doneBilling = facts.closedToday.billing ?? 0;
  const billingDone = doneBilling > 0 ? `${doneBilling} done today · ` : "";
  if (facts.billing.overdue > 0) {
    stages.push({
      id: "billing",
      label: STAGE_LABEL.billing,
      state: `${billingDone}${facts.billing.overdue} past SLA`,
      tone: "breach",
      href: STAGE_HREF.billing,
    });
  } else if (facts.billing.open > 0) {
    stages.push({
      id: "billing",
      label: STAGE_LABEL.billing,
      state: `${billingDone}${facts.billing.open} open, all within SLA`,
      tone: "attention",
      href: STAGE_HREF.billing,
    });
  } else {
    stages.push({
      id: "billing",
      label: STAGE_LABEL.billing,
      state: doneBilling > 0 ? `${doneBilling} done today · nothing open` : "Nothing open",
      tone: "clear",
      href: STAGE_HREF.billing,
    });
  }

  /* 3 · RISK FLAGS — the two questions the protocol asks, in order: is Imminent
     cleared, and is Clinical inside its SLA. Routine is not asked about: its
     seven-day SLA is the normal rhythm of a worked queue, and putting it in the
     shift line would make a stage that is almost never "clear". */
  if (facts.imminentBreached > 0) {
    stages.push({
      id: "flags",
      label: STAGE_LABEL.flags,
      state: `${facts.imminentBreached} imminent past 24h`,
      tone: "breach",
      href: STAGE_HREF.imminent,
    });
  } else if (facts.imminentOpen > 0) {
    stages.push({
      id: "flags",
      label: STAGE_LABEL.flags,
      state: `${facts.imminentOpen} imminent open, all within 24h`,
      tone: "attention",
      href: STAGE_HREF.imminent,
    });
  } else if (facts.clinicalBreached > 0) {
    stages.push({
      id: "flags",
      label: STAGE_LABEL.flags,
      state: `Imminent clear · ${facts.clinicalBreached} clinical past 48h`,
      tone: "breach",
      href: STAGE_HREF.clinical,
    });
  } else if (facts.clinicalOpen > 0) {
    stages.push({
      id: "flags",
      label: STAGE_LABEL.flags,
      state: `Imminent clear · ${facts.clinicalOpen} clinical within SLA`,
      tone: "attention",
      href: STAGE_HREF.clinical,
    });
  } else {
    stages.push({
      id: "flags",
      label: STAGE_LABEL.flags,
      state: "Imminent and clinical clear",
      tone: "clear",
      href: STAGE_HREF.flags,
    });
  }

  /* 4 · CHAT REVIEW — THE RECENCY LINE AND NOTHING ELSE.
     ═══ ITS DATA DOES NOT EXIST, SO IT SAYS SO ═══
     Nothing in this codebase records a supervisor having reviewed a
     conversation. `ChatThread` carries `lastActivityAt`, `unreadCount` and
     `needsCheckIn` — all facts about the MENTOR's relationship with the teen —
     and the only `reviewedAt` anywhere belongs to a care presentation, which is
     a different object. A recency value assembled from any of those would be a
     fabricated claim about supervisory oversight, which is the one kind of claim
     this surface must never make. See design-system-gaps row 369. */
  stages.push({
    id: "chatReview",
    label: STAGE_LABEL.chatReview,
    state: chatRecency ?? "Not tracked yet",
    tone: chatRecency ? "clear" : "unavailable",
    href: null,
  });

  return stages;
}

// ── The shift-start digest ──────────────────────────────────────────────────

/** ═══ WHAT COUNTS AS A NEW SHIFT ═══
 *
 *  Eight hours. Long enough that a lunch break, a meeting or an afternoon of
 *  other work does not re-show a digest somebody has already read, short enough
 *  that a morning after a normal night is always a new shift.
 *
 *  A NAMED CONSTANT because the number used to live only in a comment. The
 *  digest was removed in full on 2026-08-31 and its threshold went with the
 *  component — what survived was a persisted stamp, a doc comment describing an
 *  8h rule, and nothing computing it. This is that rule, back as code. */
export const SHIFT_GAP_MS = 8 * 60 * 60 * 1000;

/** `0` — never seen — counts as a gap, so a first-ever session meets the digest
 *  once rather than never. */
export function isNewShift(lastSeenAt: number, now: number): boolean {
  return now - lastSeenAt >= SHIFT_GAP_MS;
}

export interface DigestLine {
  id: string;
  /** TODO-COPY */
  text: string;
  tone: StageTone;
  href: string;
}

/** ═══ WHAT ACCUMULATED — BREACH LINES FIRST, ALWAYS ═══
 *
 *  Not sorted by count and not in stage order: everything that has already
 *  missed a deadline comes before anything that merely exists. A digest that
 *  opened with "26 clinical flags" and buried "2 imminent past 24h" underneath
 *  would be a summary that hid the only part of itself worth reading in the
 *  first two seconds.
 *
 *  Within each half the order is the protocol's, so a reader who has seen one
 *  digest can find the same fact in the same place in the next.
 *
 *  ═══ IT REPORTS THE PRESENT, NOT THE GAP ═══
 *  "What accumulated" is stated as what is STANDING NOW, because that is what
 *  the model can support honestly: nothing records what the board looked like
 *  eight hours ago, and a genuine delta would need a snapshot that does not
 *  exist. A line reading "3 new since you left" would be a number nothing in
 *  this codebase could produce. Logged rather than faked — gap row 370. */
export function digestLinesFor(facts: ShiftFacts): DigestLine[] {
  const breaches: DigestLine[] = [];
  const neutral: DigestLine[] = [];

  if (facts.activeEscalations > 0) {
    breaches.push({
      id: "escalations",
      text: `${facts.activeEscalations} escalation${facts.activeEscalations === 1 ? "" : "s"} open now`,
      tone: "breach",
      href: STAGE_HREF.escalations,
    });
  }
  if (facts.imminentBreached > 0) {
    breaches.push({
      id: "imminent-breached",
      text: `${facts.imminentBreached} imminent past 24h`,
      tone: "breach",
      href: STAGE_HREF.imminent,
    });
  }
  if (facts.billing.overdue > 0) {
    breaches.push({
      id: "billing-overdue",
      text: `${facts.billing.overdue} billing past SLA`,
      tone: "breach",
      href: STAGE_HREF.billing,
    });
  }
  if (facts.documentationOverdue > 0) {
    breaches.push({
      id: "documentation-overdue",
      text: `${facts.documentationOverdue} write-up${facts.documentationOverdue === 1 ? "" : "s"} overdue`,
      tone: "breach",
      href: STAGE_HREF.escalations,
    });
  }
  if (facts.clinicalBreached > 0) {
    breaches.push({
      id: "clinical-breached",
      text: `${facts.clinicalBreached} clinical past 48h`,
      tone: "breach",
      href: STAGE_HREF.clinical,
    });
  }

  if (facts.imminentOpen > 0) {
    neutral.push({
      id: "imminent",
      text: `${facts.imminentOpen} imminent`,
      tone: "attention",
      href: STAGE_HREF.imminent,
    });
  }
  if (facts.billing.open > 0) {
    neutral.push({
      id: "billing",
      text: `${facts.billing.open} billing`,
      tone: "attention",
      href: STAGE_HREF.billing,
    });
  }
  if (facts.clinicalOpen > 0) {
    neutral.push({
      id: "clinical",
      text: `${facts.clinicalOpen} clinical`,
      tone: "attention",
      href: STAGE_HREF.clinical,
    });
  }
  if (facts.routineOpen > 0) {
    neutral.push({
      id: "routine",
      text: `${facts.routineOpen} routine`,
      tone: "attention",
      href: STAGE_HREF.flags,
    });
  }

  return [...breaches, ...neutral];
}
