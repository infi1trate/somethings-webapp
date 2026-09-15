// ═══ AN ESCALATION IS ONE OBJECT WITH A LIFECYCLE ═══
//
// It was a banner plus some stray to-dos: an `activeEscalation` TaskItem and,
// separately, an `escalationDocumentation` TaskItem that appeared in the same
// list as unrelated work. Two rows for one event, with no way to see that the
// paperwork belonged to the crisis above it.
//
// Here it is one record with two clocks and a close-out set. It does not vanish
// when the crisis ends: a resolved escalation persists, calm and low-contrast,
// carrying its open close-out items and aging visibly until the set is complete.
// That cuts against inbox instinct on purpose — the obligation outlives the
// emergency, and a surface that hides the record the moment the phone call ends
// is a surface that loses the follow-through.
//
// ═══ TWO FIELDS DO NOT EXIST UPSTREAM AND ARE INTRODUCED HERE ═══
//
// `acknowledgedAt` and `caregiverInvolved` are not on `EscalationPayload` (nor
// anywhere in `lib/tasks`). The 5-minute acknowledgement SLA cannot be enforced
// without the first, and the conditional teen follow-up cannot be conditional
// without the second. Both are therefore MONITORING-SIDE fields, populated by
// this surface's own fixtures, and both are reported as blockers rather than
// back-derived from something unrelated. Where the second is unknown (`null`)
// the teen follow-up renders UNCONDITIONALLY — the safer default, since the
// condition removes an obligation rather than adding one.

import {
  ESCALATION_ACK_SLA,
  ESCALATION_DEBRIEF_SLA,
  ESCALATION_NOTE_CLOCK_START_UNRESOLVED,
  ESCALATION_NOTE_SLA,
  ESCALATION_SAFETY_PLAN_SLA,
  ESCALATION_TEEN_FOLLOWUP_SLA,
} from "@/lib/monitoring/constants";

export type CloseOutId = "note" | "debrief" | "teenFollowUp" | "safetyPlan";

/** NEEDS-COPY-NICOLE, all four.
 *
 *  ═══ "WRITE-UP" IS GONE ═══
 *  It read as disciplinary action, and this surface will host mentor practice
 *  review — so the one word that must not mean "you are in trouble" was the word
 *  on the crisis paperwork. "Escalation note" everywhere: labels, aria, component
 *  names, fixture keys, test names. */
export const CLOSE_OUT_LABEL: Record<CloseOutId, string> = {
  note: "Escalation note",
  debrief: "Mentor debrief",
  teenFollowUp: "Teen follow-up",
  safetyPlan: "Family safety plan filed",
};

export interface CloseOutItem {
  id: CloseOutId;
  label: string;
  /** Null when nothing published states a deadline — the safety plan. A null
   *  due date renders as an open obligation with no clock, never as "no rush". */
  dueAt: number | null;
  done: boolean;
  overdue: boolean;
  /** Present only on a conditional item, and it states the condition's state so
   *  the row can say why it is or is not being asked for. */
  condition: { applies: boolean; note: string } | null;
}

export type AckState = "pending" | "breached" | "acknowledged";

export interface EscalationRecord {
  id: string;
  teenId: string;
  teenName: string;
  mentorId: string;
  mentorName: string;
  conversationId: string | null;
  triggeredAt: number;
  /** MONITORING-SIDE FIELD — see the module note. Null = not yet acknowledged. */
  acknowledgedAt: number | null;
  resolvedAt: number | null;
  is911: boolean;
  /** MONITORING-SIDE FIELD — see the module note. Null = unknown, which makes
   *  the teen follow-up unconditional. */
  caregiverInvolved: boolean | null;
  /** Which close-out items have been completed. Page-local in this prototype:
   *  nothing persists a completion, exactly as flag resolutions do not. */
  closeOutDone: readonly CloseOutId[];
}

/** ═══ THE ACKNOWLEDGEMENT CLOCK — THE ONLY PUBLISHED RESPONSE SLA ═══
 *  Five minutes from trigger. Pending inside the window, BREACHED past it, and
 *  acknowledged once somebody has. This is the clock the page did not enforce. */
export function ackStateFor(rec: EscalationRecord, now: number): AckState {
  if (rec.acknowledgedAt != null) return "acknowledged";
  return now - rec.triggeredAt > ESCALATION_ACK_SLA ? "breached" : "pending";
}

export function ackDeadline(rec: EscalationRecord): number {
  return rec.triggeredAt + ESCALATION_ACK_SLA;
}

/** WHERE THE NOTE'S 24h STARTS — the contested half of `ESCALATION_NOTE_SLA`.
 *  An unresolved escalation has no note deadline under the "resolved" reading,
 *  which is why this returns null rather than a date in the past. */
export function noteDeadline(rec: EscalationRecord): number | null {
  if (ESCALATION_NOTE_CLOCK_START_UNRESOLVED === "triggered") {
    return rec.triggeredAt + ESCALATION_NOTE_SLA;
  }
  return rec.resolvedAt == null ? null : rec.resolvedAt + ESCALATION_NOTE_SLA;
}

/** ═══ THE CLOSE-OUT SET — FOUR ITEMS, ATTACHED TO THE RECORD ═══
 *  Built in a fixed order: the note, the mentor debrief, the teen follow-up,
 *  the safety plan. Every item is returned whether done or not, because the set
 *  IS the obligation and a completed item disappearing would leave a reader
 *  unable to tell "done" from "never asked for". */
export function closeOutOf(rec: EscalationRecord, now: number): CloseOutItem[] {
  const from = rec.resolvedAt ?? rec.triggeredAt;
  const done = (id: CloseOutId) => rec.closeOutDone.includes(id);
  const item = (
    id: CloseOutId,
    dueAt: number | null,
    condition: CloseOutItem["condition"] = null
  ): CloseOutItem => ({
    id,
    label: CLOSE_OUT_LABEL[id],
    dueAt,
    done: done(id),
    overdue: dueAt != null && !done(id) && now > dueAt,
    condition,
  });

  return [
    item("note", noteDeadline(rec)),
    item("debrief", from + ESCALATION_DEBRIEF_SLA),
    /* ═══ THE CONDITIONAL ONE, RENDERED UNCONDITIONALLY WHEN UNKNOWN ═══
       Required only when no caregiver is involved in treatment. The field does
       not exist upstream (see the module note), so `null` means the condition
       cannot be evaluated and the obligation stands — asking for a follow-up
       that was not needed costs a conversation; skipping one that was needed
       costs the follow-up. */
    item(
      "teenFollowUp",
      from + ESCALATION_TEEN_FOLLOWUP_SLA,
      rec.caregiverInvolved == null
        ? { applies: true, note: "caregiver involvement unknown" }
        : { applies: !rec.caregiverInvolved, note: rec.caregiverInvolved ? "caregiver involved in treatment" : "no caregiver involved" }
    ),
    item("safetyPlan", ESCALATION_SAFETY_PLAN_SLA == null ? null : from + ESCALATION_SAFETY_PLAN_SLA),
  ];
}

/** The items still owed — a conditional item that does not apply is not owed. */
export function closeOutOpen(rec: EscalationRecord, now: number): CloseOutItem[] {
  return closeOutOf(rec, now).filter(
    (i) => !i.done && (i.condition == null || i.condition.applies)
  );
}

/** ═══ WHEN A RECORD MAY FINALLY LEAVE THE SURFACE ═══
 *  Resolved AND every owed close-out item complete. Anything less keeps the
 *  record on screen, which is the whole point of this phase. */
export function isSettled(rec: EscalationRecord, now: number): boolean {
  return rec.resolvedAt != null && closeOutOpen(rec, now).length === 0;
}

export function isActive(rec: EscalationRecord): boolean {
  return rec.resolvedAt == null;
}

/** ═══ THE ONE SATURATED TREATMENT ON THE PAGE, AND WHAT EARNS IT ═══
 *  An active escalation, and an acknowledgement past its five minutes. Both are
 *  "somebody may be in danger right now and nobody has responded". A resolved
 *  record with overdue paperwork is a compliance failure about something that is
 *  already over: it gets the breach chip every other overdue obligation gets,
 *  never the fill. */
export function isAlarming(rec: EscalationRecord, now: number): boolean {
  return isActive(rec) || ackStateFor(rec, now) === "breached";
}

/** Sort: active first, then unacknowledged, then oldest trigger. The escalation
 *  region's order — NOT a second comparator for the queue, which has its own
 *  five steps; these are different objects in a different region. */
export function compareEscalations(
  a: EscalationRecord,
  b: EscalationRecord,
  now: number
): number {
  if (isActive(a) !== isActive(b)) return isActive(a) ? -1 : 1;
  const aAck = ackStateFor(a, now) !== "acknowledged";
  const bAck = ackStateFor(b, now) !== "acknowledged";
  if (aAck !== bAck) return aAck ? -1 : 1;
  if (a.triggeredAt !== b.triggeredAt) return a.triggeredAt - b.triggeredAt;
  return a.id.localeCompare(b.id);
}
