// ═══ ONE EVENT PRIMITIVE FOR THE WHOLE SURFACE ═══
//
// A teen risk flag and a mentor practice breach are the same SHAPE of thing: an
// event surfaced for supervisor judgment, reviewed in its conversation, resolved
// with a recorded disposition. So they are one type, one queue and one
// comparator, filterable by review subject — not two tab structures with two
// orderings that drift.
//
// ═══ WHAT THIS TYPE DELIBERATELY DOES NOT CARRY ═══
//
// No tier. No severity. No deadline. No breach. The page removed the severity
// taxonomy because it was asserting clinical severity it could not compute, and
// a field for it here would be the same assertion one layer down. Flags carry
// AGE. `TaskItem.slaDeadline` is still populated upstream for every task type
// including the three flag types — see `FLAG_REVIEW_SLA` — and this module never
// reads it. That is the one read whose absence is the point.

import { flagCategoryRank, FLAG_PATTERN_MIN } from "@/lib/monitoring/constants";
import type { RiskFlagPayload, TaskItem } from "@/lib/tasks/types";

export type ReviewSubject = "teenSafety" | "mentorPractice";

/** The five computable practice rules plus the stubbed judgment producer. Each
 *  practice kind is a TIMING FACT — see `practice.ts` for why the list stops
 *  where it does. */
export type PracticeKind =
  | "offlineDuringHours"
  | "outreachMissed"
  | "teenResponseSlow"
  | "leadershipUnanswered"
  | "noteOverdue"
  | "conductStub";

export type EventKind = "riskFlag" | PracticeKind;

/** NEEDS-COPY-NICOLE, all seven. The row's secondary line names the kind, and
 *  the group header names the subject — so neither repeats the other. */
export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  riskFlag: "Flag",
  offlineDuringHours: "Offline during scheduled hours",
  outreachMissed: "Outreach not sent by cutoff",
  teenResponseSlow: "Teen response time exceeded",
  leadershipUnanswered: "Leadership outreach unanswered",
  noteOverdue: "Video progress note overdue",
  conductStub: "Conduct review",
};

/** NEEDS-COPY-NICOLE. The group headers, which is where the noun phrase lives
 *  that the rows no longer repeat. */
export const SUBJECT_LABEL: Record<ReviewSubject, string> = {
  teenSafety: "Teen safety",
  mentorPractice: "Mentor practice",
};

export function subjectOf(kind: EventKind): ReviewSubject {
  return kind === "riskFlag" ? "teenSafety" : "mentorPractice";
}

export interface MonitoringEvent {
  id: string;
  kind: EventKind;
  subject: ReviewSubject;
  /** ROLES ARE NAMED, NOT ORDERED. "Naomi R. to Maria Lopez" left a reader to
   *  work out which name was the teen, in the one state where identifying the
   *  teen instantly matters most. Both halves are labelled wherever they render.
   *  Null teen is legitimate: a mentor who missed their outreach window has no
   *  single teen subject. */
  teenId: string | null;
  teenName: string | null;
  mentorId: string;
  mentorName: string;
  conversationId: string | null;
  /** ═══ THE EVENT'S OWN MOMENT — AGE IS MEASURED FROM HERE ═══
   *  For a flag this is the flagged message's timestamp. The conversation
   *  fixture places the flagged message at `openedAt` (`conversation.ts`), so the
   *  two are the same instant by construction rather than by coincidence — and
   *  there is no separate flagged-message timestamp on the payload to prefer.
   *  For a practice event it is the moment the rule was breached. */
  at: number;
  /** The classifier's category for a flag; the rule's own name for practice.
   *  Free text upstream — see `RiskFlagPayload.categories`. */
  category: string | null;
  /** Comparator inputs, computed once at build time so the sort stays O(n log n)
   *  and so every step is inspectable in a test without a DOM. */
  escalationOpen: boolean;
  patternCount: number;
  mentorReplied: boolean;
  /** The originating task item, for flags — the pane reads its payload for the
   *  rationale, the categories and the excerpt. Null for practice events. */
  flag: TaskItem | null;
  /** Practice facts, for the five computable rules. Null for flags. */
  practice: PracticeFacts | null;
}

export interface PracticeFacts {
  /** What the rule measured, in the rule's own units — "42m past cutoff",
   *  "3 teens unmessaged". NEEDS-COPY-NICOLE per producer. */
  measure: string;
  /** The constant the rule was measured against, named so the row can say it. */
  againstLabel: string;
  /** True when the producer is the stub rather than a real computation. A stub
   *  event never claims a measurement. */
  stubbed: boolean;
}

/** ═══ FLAG → EVENT ═══
 *  `escalationOpen` is supplied by the caller rather than derived here: it is a
 *  fact about the teen's OTHER items, which only the page's full set knows. */
export function flagEvent(
  item: TaskItem,
  opts: { escalationOpen: boolean; mentorReplied: boolean }
): MonitoringEvent {
  const p = item.payload as RiskFlagPayload;
  return {
    id: item.id,
    kind: "riskFlag",
    subject: "teenSafety",
    teenId: item.teenId,
    teenName: item.teenDisplayName,
    mentorId: item.mentorId,
    mentorName: item.mentorName,
    conversationId: item.objectId,
    at: item.openedAt,
    category: p.kind === "riskFlag" ? (p.categories[0] ?? null) : null,
    escalationOpen: opts.escalationOpen,
    patternCount: p.kind === "riskFlag" ? p.conversationFlagCount : 1,
    mentorReplied: opts.mentorReplied,
    flag: item,
    practice: null,
  };
}

/** ═══ THE COMPARATOR · ONE, FOR BOTH SUBJECTS (locked decision 1) ═══
 *
 *   1 open escalation (any)
 *   2 flag category rank            — no-op while FLAG_CATEGORY_RANK is empty
 *   3 conversation has >= 2 flags   — see FLAG_PATTERN_WINDOW for the widening
 *   4 flagged message has no mentor reply
 *   5 age, oldest first
 *
 *  THERE IS NO SECONDARY ORDERING ANYWHERE ELSE on this surface. Not in the
 *  list, not in the groups, not in the coverage view, and nothing AI-ordered.
 *  Step 5 ends in an id comparison so the order is total — two events at the
 *  same millisecond would otherwise sort differently between renders. */
export function compareEvents(a: MonitoringEvent, b: MonitoringEvent): number {
  if (a.escalationOpen !== b.escalationOpen) return a.escalationOpen ? -1 : 1;

  const rank = flagCategoryRank(a.category) - flagCategoryRank(b.category);
  if (rank !== 0) return rank;

  const aPattern = a.patternCount >= FLAG_PATTERN_MIN;
  const bPattern = b.patternCount >= FLAG_PATTERN_MIN;
  if (aPattern !== bPattern) return aPattern ? -1 : 1;

  if (a.mentorReplied !== b.mentorReplied) return a.mentorReplied ? 1 : -1;

  if (a.at !== b.at) return a.at - b.at;
  return a.id.localeCompare(b.id);
}

export function sortEvents(events: MonitoringEvent[]): MonitoringEvent[] {
  return [...events].sort(compareEvents);
}

/** Group into the two subjects, in a FIXED order — teen safety above mentor
 *  practice, because a teen's safety outranks a mentor's timekeeping and a
 *  first-appearance order would let the data say otherwise. Empty groups do not
 *  render; the header is the only place the noun phrase appears. */
export interface EventGroup {
  subject: ReviewSubject;
  label: string;
  events: MonitoringEvent[];
}

export function groupEvents(events: MonitoringEvent[]): EventGroup[] {
  const order: ReviewSubject[] = ["teenSafety", "mentorPractice"];
  return order
    .map((subject) => ({
      subject,
      label: SUBJECT_LABEL[subject],
      events: events.filter((e) => e.subject === subject),
    }))
    .filter((g) => g.events.length > 0);
}
