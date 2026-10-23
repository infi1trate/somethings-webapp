// ═══════════════════════════════════════════════════════════════════════════
// ESCALATION NOTICES (pack v5.0, Workstream C) — derived, never stored
//
// The bell and Today never read the tiering store before this: the bell is
// the activity ledger's fixtures, Today mirrors `monitoringData()`. So the
// notification matrix is DERIVED here, from the same escalation records and
// tier log every escalation surface reads, by one function per role — the
// bell and Today call the same one, so they cannot disagree.
//
// ═══ THE MATRIX (the pack's) ═══
//   event                      supervisor                      mentor
//   escalation opened          bell + Today (urgent)           —  (they raised it)
//   assessment submitted       bell (with the risk chip)       —
//   tier confirmed / adjusted  —                               bell
//   supervisor Support message —                               bell (+ Support unread)
//   escalation closed          Today: follow-up scheduled      bell
//   follow-up due              Today                           —
// The Monitoring queue already reads the same records (its roster), and
// gains the stage line (`stageLine`).
//
// ═══ ACTOR-CORRECT, SENTENCE CASE ═══ A supervisor confirms and closes; a
// mentor raises and assesses; nobody else is ever the subject. TODO-COPY,
// every string.

import type { EscalationState } from "@/lib/chat/types";
import type { TierEvent, TierActor } from "@/lib/tiering/events";
import { ASSESSMENT_QUESTIONS, RISK_LABEL, answeredCount, assessmentOf, escalationTarget, riskLevel, supervisorStage } from "@/lib/tiering/escalation";
import { PLATFORM, type Tier } from "@/lib/tiering/tiers";

export type NoticeKind = "opened" | "assessed" | "confirmed" | "support" | "closed" | "follow-up-scheduled" | "follow-up-due";

export interface EscalationNotice {
  id: string;
  kind: NoticeKind;
  teenId: string;
  at: number;
  text: string;
  /** A second, quiet line (the risk chip's words, a date). */
  detail?: string;
  /** Opened and still awaiting a supervisor — Today's urgent row. */
  urgent?: boolean;
  /** Mentor-facing notices offer "Open Support" with this contact. */
  supportId?: string;
}

/** ═══ THE DEEP LINK ═══ The conversation, with Care on Overview in its
 *  current escalation state. `?care=overview` is read once by the chat page. */
export const escalationHref = (teenId: string) => `/app/chat/${teenId}?care=overview`;

export interface NoticeInput {
  escalations: EscalationState[];
  eventsFor: (teenId: string) => TierEvent[];
  nameOf: (a: TierActor) => string;
  /** First names. */
  teenName: (teenId: string) => string;
  mentorName: (teenId: string) => string;
  supervisorName: (supervisorId: string) => string;
  /** The supervisor's Support messages to this mentor, newest last. */
  supportFrom?: (supervisorId: string) => { at: number; text: string }[];
  now: number;
}

const DAY = 86_400_000;
const DATE = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

/** The supervisor's tier decision on this escalation, if any. */
const decision = (e: EscalationState, input: NoticeInput) =>
  /* `confirm` writes the tier event and the record at the same instant. */
  input.eventsFor(e.threadId).find((x) => x.escalationId === e.id && x.at === e.confirmedAt && (x.kind === "confirmed" || x.kind === "placed" || x.kind === "stepped-down"));
/** Where the close left the teen. */
const closedTo = (e: EscalationState, input: NoticeInput): Tier | null => {
  const after = input.eventsFor(e.threadId).filter((x) => x.escalationId === e.id && (x.kind === "stepped-down" || x.kind === "placed" || x.kind === "confirmed"));
  return after.at(-1)?.tier ?? e.confirmedTier ?? null;
};

/** ═══ THE SUPERVISOR'S BELL ═══ Opened and assessed, newest first. */
export function supervisorNotices(input: NoticeInput): EscalationNotice[] {
  const out: EscalationNotice[] = [];
  for (const e of input.escalations) {
    const teen = input.teenName(e.threadId);
    const mentor = input.mentorName(e.threadId);
    const target = escalationTarget(e);
    out.push({
      id: `${e.id}:opened`,
      kind: "opened",
      teenId: e.threadId,
      at: e.openedAt,
      text: target === PLATFORM ? `${mentor} reported a platform concern about ${teen}` : `${mentor} raised Tier ${target} for ${teen}`,
      urgent: e.resolvedAt === null && e.confirmedTier === undefined,
    });
    const a = assessmentOf(e);
    if (a.submittedAt !== null) {
      const risk = riskLevel(a.answers);
      out.push({ id: `${e.id}:assessed`, kind: "assessed", teenId: e.threadId, at: a.submittedAt, text: `${mentor} sent ${teen}’s assessment`, detail: risk ? `Assessment suggests: ${RISK_LABEL[risk]}` : undefined });
    }
  }
  return out.sort((x, y) => y.at - x.at);
}

/** ═══ THE MENTOR'S BELL ═══ Confirmed, Support, closed, newest first. */
export function mentorNotices(input: NoticeInput): EscalationNotice[] {
  const out: EscalationNotice[] = [];
  for (const e of input.escalations) {
    const teen = input.teenName(e.threadId);
    const sup = input.supervisorName(e.supervisorId);
    if (e.confirmedTier !== undefined && e.confirmedAt !== undefined) {
      const d = decision(e, input);
      const who = d ? input.nameOf(d.actor) : sup;
      const asked = escalationTarget(e);
      out.push({
        id: `${e.id}:confirmed`,
        kind: "confirmed",
        teenId: e.threadId,
        at: e.confirmedAt,
        text: asked === e.confirmedTier ? `${who} confirmed Tier ${e.confirmedTier} for ${teen}` : `${who} set ${teen} to Tier ${e.confirmedTier}`,
        supportId: e.supervisorId,
      });
    }
    /* ═══ ONLY WHILE IT IS OPEN ═══ A Support thread is about no one teen: the
       same message would otherwise be attributed to every past escalation
       whose window it fell in (measured: Jordan's coaching filed under Imani's
       closed one). Coaching is a live escalation's. */
    const msgs = e.resolvedAt === null ? (input.supportFrom?.(e.supervisorId) ?? []).filter((m) => m.at >= e.openedAt) : [];
    const last = msgs.at(-1);
    if (last) out.push({ id: `${e.id}:support:${last.at}`, kind: "support", teenId: e.threadId, at: last.at, text: `${sup} messaged you in Support`, detail: last.text, supportId: e.supervisorId });
    if (e.resolvedAt !== null) {
      const to = closedTo(e, input);
      out.push({
        id: `${e.id}:closed`,
        kind: "closed",
        teenId: e.threadId,
        at: e.resolvedAt,
        text: escalationTarget(e) === PLATFORM ? `${sup} reviewed the platform concern about ${teen}` : `${sup} closed the escalation · ${teen} moves to Tier ${to ?? "—"}`,
        supportId: e.supervisorId,
      });
    }
  }
  return out.sort((x, y) => y.at - x.at);
}

/** ═══ TODAY'S ESCALATION ITEMS (supervisor) ═══ What needs the supervisor
 *  now (urgent: awaiting confirmation), then follow-ups — due first. */
export function supervisorAgenda(input: NoticeInput): EscalationNotice[] {
  const urgent: EscalationNotice[] = [];
  const due: EscalationNotice[] = [];
  const scheduled: EscalationNotice[] = [];
  for (const e of input.escalations) {
    const teen = input.teenName(e.threadId);
    const target = escalationTarget(e);
    if (e.resolvedAt === null && e.confirmedTier === undefined)
      urgent.push({ id: `${e.id}:agenda`, kind: "opened", teenId: e.threadId, at: e.openedAt, urgent: true, text: target === PLATFORM ? `${teen} · Platform concern` : `${teen} · Tier ${target} requested`, detail: stageLine(e) ?? undefined });
    const f = e.followUp;
    if (e.resolvedAt !== null && f && f.status === null) {
      if (f.dueAt <= input.now + DAY) due.push({ id: `${e.id}:due`, kind: "follow-up-due", teenId: e.threadId, at: f.dueAt, text: `Follow-up due · ${teen}`, detail: DATE.format(f.dueAt) });
      else scheduled.push({ id: `${e.id}:scheduled`, kind: "follow-up-scheduled", teenId: e.threadId, at: f.dueAt, text: `Follow-up with ${teen}`, detail: DATE.format(f.dueAt) });
    }
  }
  return [...urgent.sort((x, y) => x.at - y.at), ...due.sort((x, y) => x.at - y.at), ...scheduled.sort((x, y) => x.at - y.at)];
}

/** ═══ THE MONITORING STAGE LINE (Workstream C4) ═══ One quiet line for a
 *  teen with an open escalation; null otherwise. */
export function stageLine(e: EscalationState | undefined): string | null {
  if (!e || e.resolvedAt !== null) return null;
  if (escalationTarget(e) === PLATFORM) return "Platform concern · in review";
  switch (supervisorStage(e)) {
    case "S0":
      return `Assessment in · ${answeredCount(assessmentOf(e).answers)} of ${ASSESSMENT_QUESTIONS.length}`;
    case "S1":
      return "Awaiting confirmation";
    case "S2":
      return "Note in progress";
    case "S3":
      return "Outcome and debrief";
    case "S4":
      return "Ready to close";
    default:
      return null;
  }
}

/** Unread against a reader's last look. */
export const unreadNotices = (notices: EscalationNotice[], seenAt: number) => notices.filter((n) => n.at > seenAt).length;
