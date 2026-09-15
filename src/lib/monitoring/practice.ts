// ═══ MENTOR PRACTICE — FIVE TIMING FACTS, AND A STUB WHERE THE REST WOULD GO ═══
//
// These five are deterministic comparisons between a timestamp and a published
// constant. They are safe to compute and safe to assert, which is exactly what
// the removed severity taxonomy was not.
//
// ═══ WHAT IS DELIBERATELY NOT HERE ═══
//
// Tone, presence, personalization, boundary and conduct adherence, meeting and
// training attendance. Every one of those needs a classifier that does not
// exist. `conductStub` builds the EVENT so the queue, the pane and the
// disposition control are exercised end to end, and its producer returns
// nothing — because shipping tone-adherence events with a rules engine behind
// them would repeat, on mentors, the exact mistake Phase 1 removed from teens.
//
// The inputs are fixtures (there is no message-level data for supervised
// conversations on this surface — see the report's blockers). The RULES are real:
// every one reads its constant and compares.

import {
  MENTOR_LEADERSHIP_RESPONSE_SLA,
  MENTOR_NOTE_SLA,
  MENTOR_ONLINE_HOURS,
  MENTOR_OUTREACH_CUTOFF,
  MENTOR_TEEN_RESPONSE_SLA,
} from "@/lib/monitoring/constants";
import { EVENT_KIND_LABEL, type MonitoringEvent, type PracticeKind } from "@/lib/monitoring/event";

/** One mentor's shift, as the facts the five rules need. Every field is a
 *  timestamp or a count — nothing here is a judgment. */
export interface MentorShiftFacts {
  mentorId: string;
  mentorName: string;
  /** The shift window's own start, so "during scheduled hours" is answerable
   *  without assuming today's date. */
  shiftStart: number;
  /** When they were last seen online, and whether they are online now. */
  offlineSince: number | null;
  /** Conversations left waiting when they went offline. */
  waitingWhenOffline: number;
  /** When the day's outreach went out; null = not sent. */
  outreachSentAt: number | null;
  teensNeedingOutreach: number;
  /** The longest a teen has been waiting for a reply, and who. */
  longestWait: { teenId: string; teenName: string; since: number } | null;
  /** A lead mentor's message and whether it has been answered. */
  leadership: { at: number; answeredAt: number | null } | null;
  /** Video progress notes owed, with the call they belong to. */
  notesDue: { teenId: string; teenName: string; callEndedAt: number }[];
}

export function isWithinOnlineHours(now: number): boolean {
  const h = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  return h >= MENTOR_ONLINE_HOURS.startHour && h < MENTOR_ONLINE_HOURS.endHour;
}

/** Minutes, as the rows say them. NEEDS-COPY-NICOLE on every `measure` string
 *  below — they are the sentences a mentor's supervisor will read about them,
 *  which makes them the highest-stakes copy in this phase. */
function mins(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function event(
  kind: PracticeKind,
  f: MentorShiftFacts,
  at: number,
  measure: string,
  againstLabel: string,
  teen: { teenId: string; teenName: string } | null,
  stubbed = false
): MonitoringEvent {
  return {
    id: `mp-${kind}-${f.mentorId}`,
    kind,
    subject: "mentorPractice",
    teenId: teen?.teenId ?? null,
    teenName: teen?.teenName ?? null,
    mentorId: f.mentorId,
    mentorName: f.mentorName,
    conversationId: teen?.teenId ?? null,
    at,
    category: EVENT_KIND_LABEL[kind],
    /* PRACTICE EVENTS NEVER CLAIM THE ESCALATION STEP, and the pattern and reply
       steps are about a flagged message they do not have. So they sort by age
       against flags, which is the honest position for them: a mentor's late note
       does not outrank a teen's flag, and the comparator says so without a
       second ordering. */
    escalationOpen: false,
    patternCount: 1,
    mentorReplied: true,
    flag: null,
    practice: { measure, againstLabel, stubbed },
  };
}

/** ═══ THE FIVE COMPUTABLE PRODUCERS ═══ */
export function practiceEventsFor(
  facts: MentorShiftFacts[],
  now: number
): MonitoringEvent[] {
  const out: MonitoringEvent[] = [];
  for (const f of facts) {
    // 1 · NOT ONLINE DURING SCHEDULED HOURS.
    if (f.offlineSince != null && isWithinOnlineHours(now)) {
      out.push(
        event(
          "offlineDuringHours",
          f,
          f.offlineSince,
          `offline ${mins(now - f.offlineSince)}${f.waitingWhenOffline > 0 ? `, ${f.waitingWhenOffline} waiting` : ""}`,
          "scheduled hours",
          null
        )
      );
    }

    // 2 · OUTREACH NOT SENT BY CUTOFF.
    const cutoff = f.shiftStart + MENTOR_OUTREACH_CUTOFF;
    if (f.teensNeedingOutreach > 0 && now > cutoff && f.outreachSentAt == null) {
      out.push(
        event(
          "outreachMissed",
          f,
          cutoff,
          `${f.teensNeedingOutreach} unmessaged, ${mins(now - cutoff)} past cutoff`,
          "outreach cutoff",
          null
        )
      );
    }

    // 3 · TEEN RESPONSE TIME EXCEEDED.
    if (f.longestWait && now - f.longestWait.since > MENTOR_TEEN_RESPONSE_SLA) {
      out.push(
        event(
          "teenResponseSlow",
          f,
          f.longestWait.since,
          `waiting ${mins(now - f.longestWait.since)}`,
          "teen response SLA",
          f.longestWait
        )
      );
    }

    // 4 · LEADERSHIP OUTREACH UNANSWERED.
    if (
      f.leadership &&
      f.leadership.answeredAt == null &&
      now - f.leadership.at > MENTOR_LEADERSHIP_RESPONSE_SLA
    ) {
      out.push(
        event(
          "leadershipUnanswered",
          f,
          f.leadership.at,
          `unanswered ${mins(now - f.leadership.at)}`,
          "leadership response SLA",
          null
        )
      );
    }

    // 5 · VIDEO PROGRESS NOTE OVERDUE.
    for (const n of f.notesDue) {
      if (now - n.callEndedAt > MENTOR_NOTE_SLA) {
        out.push({
          ...event(
            "noteOverdue",
            f,
            n.callEndedAt,
            `${mins(now - n.callEndedAt - MENTOR_NOTE_SLA)} overdue`,
            "note SLA",
            n
          ),
          id: `mp-noteOverdue-${f.mentorId}-${n.teenId}`,
        });
      }
    }
  }
  return out;
}

/** ═══ THE STUB ═══
 *  Tone, presence, personalization, boundary and conduct adherence, attendance.
 *  The EVENT PRIMITIVE is built — a fixture can hand one in and it will queue,
 *  open in the pane and take a disposition like any other event — and there is
 *  no producer, because there is no classifier. Returns nothing, always. */
export function conductEventsFor(_facts: MentorShiftFacts[]): MonitoringEvent[] {
  return [];
}

/** Used by the `mentor-conduct-flag` fixture to hand in one stubbed event
 *  WITHOUT pretending a rules engine produced it: the event says on its face
 *  that its producer does not exist. */
export function stubbedConductEvent(
  f: Pick<MentorShiftFacts, "mentorId" | "mentorName">,
  at: number
): MonitoringEvent {
  return event(
    "conductStub",
    { ...f, shiftStart: at, offlineSince: null, waitingWhenOffline: 0, outreachSentAt: null, teensNeedingOutreach: 0, longestWait: null, leadership: null, notesDue: [] },
    at,
    /* NEEDS-COPY-NICOLE. It states its own provenance rather than a measurement,
       because there is no measurement. */
    "flagged for review — no automated measure exists",
    "human review",
    null,
    true
  );
}
