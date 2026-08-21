// TODO-DATA — the teen record's CARE TIMELINE (MO-9.1).
//
// DELIBERATE DEPARTURE from the PRD's "Primary Presentation History" table: one
// append-only timeline where a billing-code event is ONE EVENT CLASS among
// several. The PRD's four columns survive (date · type · description · result);
// the vocabulary widens so crisis history, goals and treatment plans arrive later
// as new event TYPES rather than new sections.
//
// APPEND-ONLY. Entries are never edited or deleted. A correction appends a new
// entry whose `amends` points at the original; both render, the original marked
// superseded. Nothing in this module offers a mutation — there is no update or
// delete, by construction.
//
// Nothing clinical exists anywhere else in this prototype: no PHQ-9/GAD-7/WHO-5
// instruments, no responses, no presentation codes, no diagnosis field. Every
// value here is invented and must be replaced when the real clinical layer lands.
//
// Vocabulary law: no churn or risk-prediction language. A flag names the
// OBSERVABLE CAUSE ("said they'd stopped sleeping"), never a forecast. Events
// record that something happened, never the content of a teen's messages.

import { DEMO_TEENS } from "@/lib/record/people-demo";
import { statementForCode } from "@/lib/record/dsm5";

/** Event classes, v1. Ordered roughly by how often a reader is looking for them.
 *  Adding a class is a data change, not a refactor — the timeline renders any
 *  member of this union. */
export type CareEventType =
  | "assessment"
  | "presentation_assigned"
  | "presentation_reviewed"
  | "presentation_changed"
  | "care_update"
  | "escalation"
  | "risk_flag"
  | "pause"
  | "return";

/** WHO wrote this. Provenance is REQUIRED and always rendered: a reader must
 *  never have to infer whether a rationale was written by a clinician,
 *  templated by the intake mapping, or AI-generated. */
export type CareAuthor =
  | { kind: "person"; name: string; role: string }
  | { kind: "system" }
  | { kind: "ai"; model?: string };

/** v1: every entry is readable by mentor, lead mentor and supervisor tiers. The
 *  field exists NOW so a future clinical-only class is a data change rather than
 *  a refactor of every consumer. */
export type CareVisibility = "all_staff";

/** One question's answer inside an assessment (the PRD's expanded breakdown). */
export interface AssessmentItem {
  question: string;
  answer: string;
  points: number;
}

export interface CareEvent {
  id: string;
  /** Epoch ms. Rendered as a date in the row; elapsed time never appears in a
   *  primary date column — the elapsed-time standard is for secondary lines. */
  occurredAt: number;
  type: CareEventType;
  description: string;
  /** The outcome column — a score, a code, an action taken. */
  result: string;
  author: CareAuthor;
  /** presentation_* rows only — the presentation code this entry LEAVES IN
   *  FORCE, machine-readable. Separate from `result` on purpose: `result` is
   *  prose for the reader ("F41.1 → F33.0", "F41.1 — unchanged") and parsing it
   *  back out is how a header ends up disagreeing with its own history. */
  code?: string;
  /** Id of the entry this one corrects. Both stay; see the module note. */
  amends?: string;
  visibility: CareVisibility;
  /** assessment rows only — the question-by-question breakdown. */
  items?: AssessmentItem[];
  /** presentation rows only — the provider's note. */
  providerNote?: string;
}

const DAY = 86_400_000;
/** Fixtures are relative to a fixed reference so they never drift; the caller
 *  passes `now` and these resolve against it. */
const ago = (now: number, days: number) => now - days * DAY;

/** Which filter chip a class belongs under. Chips group classes so the bar stays
 *  five items while the union grows. */
export const CARE_FILTERS = [
  { id: "all", label: "All" },
  { id: "assessments", label: "Assessments" },
  { id: "presentation", label: "Presentation" },
  { id: "care", label: "Care updates" },
  { id: "flags", label: "Flags" },
] as const;
export type CareFilterId = (typeof CARE_FILTERS)[number]["id"];

const FILTER_OF: Record<CareEventType, Exclude<CareFilterId, "all">> = {
  assessment: "assessments",
  presentation_assigned: "presentation",
  presentation_reviewed: "presentation",
  presentation_changed: "presentation",
  care_update: "care",
  escalation: "flags",
  risk_flag: "flags",
  pause: "care",
  return: "care",
};

export function matchesFilter(t: CareEventType, f: CareFilterId): boolean {
  return f === "all" || FILTER_OF[t] === f;
}

/** Row pill copy per class (TODO-COPY). `presentation_changed` reads distinctly
 *  from `presentation_reviewed` — a change is a different event than a review
 *  that kept the code, and the two must never look alike. */
export const TYPE_LABEL: Record<CareEventType, string> = {
  assessment: "Assessment",
  presentation_assigned: "Presentation assigned",
  presentation_reviewed: "Presentation reviewed",
  presentation_changed: "Presentation changed",
  care_update: "Care update",
  escalation: "Escalation",
  risk_flag: "Flag",
  pause: "Paused",
  return: "Returned",
};

/** Pill tone per class, from the semantic families — no raw hex, and NOT the
 *  PRD's purple. `presentation_changed` takes the warm accent so it separates
 *  from a review at a glance; escalation is the critical family, reserved. */
export const TYPE_TONE: Record<CareEventType, "neutral" | "warm" | "warning" | "critical"> = {
  assessment: "neutral",
  presentation_assigned: "neutral",
  presentation_reviewed: "neutral",
  presentation_changed: "warm",
  care_update: "neutral",
  escalation: "critical",
  risk_flag: "warning",
  pause: "warning",
  return: "neutral",
};

// ── Fixtures ────────────────────────────────────────────────────────────────
// t15 (Riley Moss) carries a full history INCLUDING an amendment chain, so the
// superseded treatment is exercised. t13 has a short history. Every other teen
// has none, which is the pre-first-survey "snooze" state the PRD describes — the
// empty state is the common case, not an edge case.

const PHQ9_ITEMS: AssessmentItem[] = [
  { question: "Little interest or pleasure in doing things", answer: "Several days", points: 1 },
  { question: "Feeling down, hopeless", answer: "More than half the days", points: 2 },
  { question: "Trouble falling or staying asleep", answer: "Nearly every day", points: 3 },
  { question: "Feeling tired or having little energy", answer: "More than half the days", points: 2 },
  { question: "Poor appetite or overeating", answer: "Several days", points: 1 },
  { question: "Feeling bad about yourself", answer: "Several days", points: 1 },
  { question: "Trouble concentrating", answer: "More than half the days", points: 2 },
  { question: "Moving or speaking slowly, or being restless", answer: "Not at all", points: 0 },
  { question: "Thoughts of self-harm", answer: "Not at all", points: 0 },
];

/** Three PHQ-9 response sets whose points sum to their stated scores. The
 *  expanded breakdown has to reconcile with the row above it or the record
 *  contradicts itself. */
const PHQ9_SCORE_8: AssessmentItem[] = [
  { question: "Little interest or pleasure in doing things", answer: "Several days", points: 1 },
  { question: "Feeling down, hopeless", answer: "Several days", points: 1 },
  { question: "Trouble falling or staying asleep", answer: "More than half the days", points: 2 },
  { question: "Feeling tired or having little energy", answer: "Several days", points: 1 },
  { question: "Poor appetite or overeating", answer: "Not at all", points: 0 },
  { question: "Feeling bad about yourself", answer: "Several days", points: 1 },
  { question: "Trouble concentrating", answer: "More than half the days", points: 2 },
  { question: "Moving or speaking slowly, or being restless", answer: "Not at all", points: 0 },
  { question: "Thoughts of self-harm", answer: "Not at all", points: 0 },
];
const PHQ9_SCORE_13: AssessmentItem[] = [
  { question: "Little interest or pleasure in doing things", answer: "More than half the days", points: 2 },
  { question: "Feeling down, hopeless", answer: "Nearly every day", points: 3 },
  { question: "Trouble falling or staying asleep", answer: "More than half the days", points: 2 },
  { question: "Feeling tired or having little energy", answer: "More than half the days", points: 2 },
  { question: "Poor appetite or overeating", answer: "Several days", points: 1 },
  { question: "Feeling bad about yourself", answer: "More than half the days", points: 2 },
  { question: "Trouble concentrating", answer: "Several days", points: 1 },
  { question: "Moving or speaking slowly, or being restless", answer: "Not at all", points: 0 },
  { question: "Thoughts of self-harm", answer: "Not at all", points: 0 },
];
const GAD7_SCORE_12: AssessmentItem[] = [
  { question: "Feeling nervous, anxious or on edge", answer: "Nearly every day", points: 3 },
  { question: "Not being able to stop or control worrying", answer: "More than half the days", points: 2 },
  { question: "Worrying too much about different things", answer: "More than half the days", points: 2 },
  { question: "Trouble relaxing", answer: "Several days", points: 1 },
  { question: "Being so restless it's hard to sit still", answer: "Several days", points: 1 },
  { question: "Becoming easily annoyed", answer: "More than half the days", points: 2 },
  { question: "Feeling afraid something awful might happen", answer: "Several days", points: 1 },
];
const PHQ9_SCORE_11: AssessmentItem[] = [
  { question: "Little interest or pleasure in doing things", answer: "More than half the days", points: 2 },
  { question: "Feeling down, hopeless", answer: "More than half the days", points: 2 },
  { question: "Trouble falling or staying asleep", answer: "More than half the days", points: 2 },
  { question: "Feeling tired or having little energy", answer: "Several days", points: 1 },
  { question: "Poor appetite or overeating", answer: "Several days", points: 1 },
  { question: "Feeling bad about yourself", answer: "Several days", points: 1 },
  { question: "Trouble concentrating", answer: "More than half the days", points: 2 },
  { question: "Moving or speaking slowly, or being restless", answer: "Not at all", points: 0 },
  { question: "Thoughts of self-harm", answer: "Not at all", points: 0 },
];

function fixtureTimelineFor(teenId: string, now: number): CareEvent[] {
  if (teenId === "t15") {
    return [
      {
        id: "ce-8",
        occurredAt: ago(now, 3),
        type: "care_update",
        description: "Checked in with Riley's mentor about sleep routine",
        result: "Mentor briefed",
        author: { kind: "person", name: "Dr. Amara Patel", role: "Supervisor" },
        visibility: "all_staff",
      },
      {
        // The correction. Renders "Amends [date] entry" and its target renders
        // superseded — neither is hidden or overwritten.
        id: "ce-7",
        occurredAt: ago(now, 28),
        type: "presentation_changed",
        description: "Presentation corrected after review of the full intake",
        result: "F41.1 → F33.0",
        code: "F33.0",
        author: { kind: "person", name: "Dr. Amara Patel", role: "Supervisor" },
        amends: "ce-5",
        visibility: "all_staff",
        providerNote:
          "The intake mapping keyed on the anxiety items alone. Re-reading the full response set, the persistent low mood is the better fit.",
      },
      {
        id: "ce-5",
        occurredAt: ago(now, 40),
        type: "presentation_assigned",
        description: "Presentation set from intake assessment",
        result: "F41.1",
        code: "F41.1",
        author: { kind: "ai", model: "intake mapping" },
        visibility: "all_staff",
        providerNote:
          "Generated from the PHQ-9 and GAD-7 response set. Not reviewed by a clinician at the time of assignment.",
      },
      {
        id: "ce-4",
        occurredAt: ago(now, 40),
        type: "assessment",
        description: "PHQ-9",
        result: "12 — moderate",
        author: { kind: "system" },
        visibility: "all_staff",
        items: PHQ9_ITEMS,
      },
      {
        id: "ce-3",
        occurredAt: ago(now, 40),
        type: "assessment",
        description: "GAD-7",
        result: "9 — mild",
        author: { kind: "system" },
        visibility: "all_staff",
        items: [
          { question: "Feeling nervous, anxious or on edge", answer: "More than half the days", points: 2 },
          { question: "Not being able to stop or control worrying", answer: "Several days", points: 1 },
          { question: "Worrying too much about different things", answer: "More than half the days", points: 2 },
          { question: "Trouble relaxing", answer: "Several days", points: 1 },
          { question: "Being so restless it's hard to sit still", answer: "Not at all", points: 0 },
          { question: "Becoming easily annoyed", answer: "Several days", points: 1 },
          { question: "Feeling afraid something awful might happen", answer: "Several days", points: 2 },
        ],
      },
      {
        id: "ce-2",
        occurredAt: ago(now, 42),
        type: "return",
        description: "Came back after a paused match",
        result: "Matched with Brandon",
        author: { kind: "system" },
        visibility: "all_staff",
      },
      {
        id: "ce-1",
        occurredAt: ago(now, 68),
        type: "pause",
        description: "Match paused at the family's request",
        result: "Paused 4 weeks",
        author: { kind: "person", name: "Omar Haddad", role: "Lead mentor" },
        visibility: "all_staff",
      },
    ];
  }
  if (teenId === "t13") {
    // The QUARTERLY REVIEW subject. Three PHQ-9s on the LOCKED instrument (a
    // recency-weighted aggregate is only meaningful across comparable scores),
    // a presentation assigned at intake and kept at the day-30 look — whose
    // 90-day clock therefore ran out five days ago, which is what puts a review
    // in the action slot and the cadence card in its overdue state.
    return [
      {
        id: "ct-4",
        occurredAt: ago(now, 12),
        type: "assessment",
        description: "PHQ-9",
        result: "11 — moderate",
        author: { kind: "system" },
        visibility: "all_staff",
        items: PHQ9_SCORE_11,
      },
      {
        id: "ct-3",
        occurredAt: ago(now, 74),
        type: "assessment",
        description: "PHQ-9",
        result: "13 — moderate",
        author: { kind: "system" },
        visibility: "all_staff",
        items: PHQ9_SCORE_13,
      },
      {
        id: "ct-2",
        occurredAt: ago(now, 95),
        type: "presentation_reviewed",
        description: "Presentation reviewed at the 30-day mark",
        result: "F41.1 — unchanged",
        code: "F41.1",
        author: { kind: "person", name: "Dr. Amara Patel", role: "Supervisor" },
        visibility: "all_staff",
        providerNote: "Steady since intake. No change indicated.",
      },
      {
        id: "ct-1b",
        occurredAt: ago(now, 121),
        type: "presentation_assigned",
        description: "Presentation set from intake assessment",
        result: "F41.1",
        code: "F41.1",
        author: { kind: "ai", model: "intake mapping" },
        visibility: "all_staff",
        providerNote:
          "Generated from the PHQ-9 response set. Not reviewed by a clinician at the time of assignment.",
      },
      {
        id: "ct-1",
        // 121 days in — past the day-120 boundary, so cadence is QUARTERLY and
        // the clock runs from the last review rather than from intake. That
        // review was 95 days ago, which puts this record 5 days OVERDUE.
        occurredAt: ago(now, 121),
        type: "assessment",
        description: "PHQ-9",
        result: "8 — mild",
        author: { kind: "system" },
        visibility: "all_staff",
        // Its own nine items, not a slice of Riley's: a truncated instrument
        // isn't a PHQ-9, and the points have to add up to the stated score or
        // the expanded breakdown contradicts the row above it.
        items: PHQ9_SCORE_8,
      },
    ];
  }
  if (teenId === "t9") {
    // The INTAKE REVIEW subject. The survey is DONE — that is a completed event
    // and belongs in the record — while the presentation decision is what sits
    // in the action slot. Nothing else on file, so this is also the "one
    // assessment, no presentation" shape.
    return [
      {
        id: "ci-1",
        // 16 days into an 18-day tenure: the day-30 review lands in 14 days,
        // which is the DUE-SOON edge of the warning window.
        occurredAt: ago(now, 16),
        type: "assessment",
        description: "GAD-7",
        result: "9 — mild",
        author: { kind: "system" },
        visibility: "all_staff",
        items: GAD7_ITEMS,
      },
    ];
  }
  return [];
}


// ── Approved reviews → timeline entries ─────────────────────────────────────
// A supervisor's approval APPENDS; it never edits the recommendation it came
// from. The decision is store-backed (store v29 `careReviews`) and threaded into
// this module as a PARAMETER rather than imported, so care-demo stays a pure
// data module that the store, the components and a test can all read.

export interface CareReviewDecision {
  /** Which review this decided — also the store key. */
  reviewId: string;
  teenId: string;
  decidedAt: number;
  /** Guaranteed non-whitespace: Approve is gated on it before it can be saved. */
  note: string;
  outcome: "presentation_assigned" | "presentation_reviewed" | "presentation_changed";
  code: string;
  statement: string;
  /** The deciding supervisor's NAME — the entry's author. */
  actor: string;
  /** Their tier, rendered beside the name. Separate from `actor` because
   *  "Supervisor · Supervisor" is what one field produced. */
  actorRole: string;
  /** The code this replaced, when it replaced one — drives the "→" result. */
  previousCode?: string;
}

/** TODO-COPY */
const OUTCOME_DESCRIPTION: Record<CareReviewDecision["outcome"], string> = {
  presentation_assigned: "Presentation set after review",
  presentation_reviewed: "Presentation reviewed and kept",
  presentation_changed: "Presentation changed after review",
};

function decisionToEvent(d: CareReviewDecision): CareEvent {
  return {
    id: `ce-dec-${d.reviewId}`,
    occurredAt: d.decidedAt,
    type: d.outcome,
    description: OUTCOME_DESCRIPTION[d.outcome],
    result:
      d.outcome === "presentation_changed" && d.previousCode
        ? `${d.previousCode} → ${d.code}`
        : d.outcome === "presentation_reviewed"
          ? `${d.code} — unchanged`
          : d.code,
    code: d.code,
    // The supervisor who approved is the author — never the model that drafted
    // the recommendation. Their provider note travels with the entry.
    author: { kind: "person", name: d.actor, role: d.actorRole },
    visibility: "all_staff",
    providerNote: d.note,
  };
}

/** ESCALATIONS ARE NOT INVENTED HERE. `DemoTeen.escalation` already IS the
 *  escalation record — it drives the mentee row's critical flag — so the Care
 *  timeline derives its escalation entry from that one field rather than keeping
 *  a second list. Two sources for one fact is how a record ends up claiming an
 *  escalation the mentee row doesn't show. Only t9 carries one today.
 *
 *  TODO-COPY / REPORTED CONFLICT: the existing field's reason reads "Asked about
 *  changing schools mid-year", which is a paraphrase of message content — the
 *  vocabulary law says an event records THAT something happened, never what the
 *  teen wrote. Kept verbatim rather than rewritten: it is pre-existing copy that
 *  already renders on the mentee row, and diverging here would put two different
 *  sentences on one event. The rewrite is a copy decision, not a code one. */
function escalationEventFor(teenId: string, now: number): CareEvent[] {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  if (!teen?.escalation) return [];
  return [
    {
      id: `ce-esc-${teenId}`,
      occurredAt: ago(now, teen.escalation.daysAgo),
      type: "escalation",
      description: teen.escalation.reason,
      result: "Supervisor looped in",
      author: { kind: "system" },
      visibility: "all_staff",
    },
  ];
}

/** Everything the store contributes to a teen's record. One options object
 *  rather than a growing positional tail — every reader below takes the same
 *  shape, so adding a future store-backed event class is one field here instead
 *  of a signature change in five places. */
export interface CareStoreSlice {
  decisions?: CareReviewDecision[];
  updates?: CareUpdateRecord[];
}

/** The full append-only timeline for a teen: the hand-written clinical fixtures,
 *  whatever the person universe already records, and everything staff have
 *  appended. Newest-first ordering is the renderer's job — this returns the
 *  union. */

export function careTimelineFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): CareEvent[] {
  return [
    ...fixtureTimelineFor(teenId, now),
    ...pendingDemoTimeline(teenId, now),
    ...escalationEventFor(teenId, now),
    ...(store.decisions ?? [])
      .filter((d) => d.teenId === teenId)
      .map(decisionToEvent),
    ...(store.updates ?? [])
      .filter((u) => u.teenId === teenId)
      .map(careUpdateToEvent),
  ];
}

// ─── PRESENTATION SPINE + CADENCE (MO-9.1 Prompt B) ─────────────────────────
//
// CLINICAL DATES ARE EXPLICIT DATES, NOT ELAPSED TIME. The elapsed-time standard
// ("3d", "2 weeks") governs secondary lines everywhere else in this product, and
// it is deliberately SUSPENDED here: "assigned 4 months ago" is unusable to
// someone reconciling a record against an outside provider's notes, and a
// diagnosis date is a fact of record, not a recency signal. Cadence DISTANCE
// ("due in 12 days") keeps the elapsed framing, because that one is a countdown
// rather than a date of record — so the cadence card carries both.

export type CadenceStage = "intake" | "day30" | "quarterly";

/** TODO-COPY */
export const STAGE_LABEL: Record<CadenceStage, string> = {
  intake: "Intake",
  day30: "Day 30",
  quarterly: "90-day review",
};

export interface PresentationRef {
  /** The plain-language statement — read first, at display weight. */
  statement: string;
  code: string;
}

export interface CarePresentation extends PresentationRef {
  assignedAt: number;
  assignedBy: string;
  /** Last time a supervisor looked and kept it. */
  reviewedAt?: number;
}

export interface CareAssessment {
  instrument: string;
  at: number;
  score: number;
  /** TODO-COPY — the instrument's own severity band, never a prediction. */
  severity: string;
  items: AssessmentItem[];
}

export interface CareCadence {
  stage: CadenceStage;
  /** LOCKED AT FIRST COMPLETION — the instrument a teen started on is the one
   *  their scores are comparable against, so this never changes afterwards.
   *  Null before the first completion, which is when it is still choosable. */
  assignedSurvey: string | null;
  surveyLockedAt: number | null;
  lastAssessment: CareAssessment | null;
  /** Null only before the first survey — cadence starts at intake. */
  nextReviewDue: number | null;
}

/** The action slot's payload. Generic slot, specific consumer — see
 *  care-action-slot.tsx for why the shell knows nothing about presentations. */
export interface PresentationReview {
  id: string;
  stage: CadenceStage;
  recommended: PresentationRef;
  /** Provenance is MANDATORY and stated above the text: at intake the rationale
   *  is templated from the assessment mapping, from day 30 on it is generated,
   *  and a code a supervisor picked themselves has no model behind it at all.
   *  Rationale never renders as unattributed — or MISattributed — prose: labelling
   *  a supervisor's own choice "templated from intake mapping" would credit a
   *  mapping that had no part in it. */
  rationale: { source: "templated" | "ai" | "supervisor"; text: string };
  /** intake + day30: the single most recent survey. */
  survey: CareAssessment | null;
  /** quarterly: a recency-weighted score over the period, expandable to the
   *  surveys behind it. Exactly one of `survey` / `aggregate` is set. */
  aggregate: {
    score: number;
    severity: string;
    surveys: CareAssessment[];
  } | null;
}

/** TODO-COPY */
export const RATIONALE_SOURCE_LABEL: Record<
  PresentationReview["rationale"]["source"],
  string
> = {
  templated: "Templated from intake mapping",
  ai: "AI-generated from survey history and mentorship signal",
  supervisor: "Selected by a supervisor",
};

const GAD7_ITEMS: AssessmentItem[] = [
  { question: "Feeling nervous, anxious or on edge", answer: "More than half the days", points: 2 },
  { question: "Not being able to stop or control worrying", answer: "Several days", points: 1 },
  { question: "Worrying too much about different things", answer: "More than half the days", points: 2 },
  { question: "Trouble relaxing", answer: "Several days", points: 1 },
  { question: "Being so restless it's hard to sit still", answer: "Not at all", points: 0 },
  { question: "Becoming easily annoyed", answer: "Several days", points: 1 },
  { question: "Feeling afraid something awful might happen", answer: "Several days", points: 2 },
];

/** The presentation in force, or null before the first one is assigned. Derived
 *  from the timeline so the spine can never disagree with the history below it —
 *  the same reason `code` exists as its own field rather than being parsed out
 *  of `result`. */
export function presentationFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): CarePresentation | null {
  const events = [...careTimelineFor(teenId, now, store)].sort(
    (a, b) => b.occurredAt - a.occurredAt
  );
  const amended = new Set(events.map((e) => e.amends).filter(Boolean));
  const isPresentation = (e: CareEvent) =>
    e.type === "presentation_assigned" ||
    e.type === "presentation_changed" ||
    e.type === "presentation_reviewed";

  const inForce = events.find((e) => !amended.has(e.id) && e.code && isPresentation(e));
  if (!inForce?.code) return null;

  // ASSIGNED is the ORIGINAL assignment, not the entry currently in force. A
  // correction supersedes the code, not the date the teen first got one — and
  // "assigned Aug 11" on a record whose first presentation landed Jul 30 would
  // quietly erase eleven days of history. Walk the amendment chain back, then
  // fall back to the earliest presentation_assigned.
  const byId = new Map(events.map((e) => [e.id, e]));
  let origin = inForce;
  const seen = new Set<string>([origin.id]);
  while (origin.amends) {
    const prev = byId.get(origin.amends);
    // Cycle guard: an append-only log shouldn't produce one, but a fixture typo
    // would otherwise hang the render.
    if (!prev || seen.has(prev.id)) break;
    seen.add(prev.id);
    origin = prev;
  }
  if (origin.type !== "presentation_assigned") {
    const assigned = [...events].reverse().find((e) => e.type === "presentation_assigned");
    if (assigned) origin = assigned;
  }

  // REVIEWED: the entry in force IS a review when it changed or kept a code —
  // that is what a supervisor did to it. Otherwise, the last time anyone looked.
  const reviewedAt =
    inForce.type === "presentation_changed" || inForce.type === "presentation_reviewed"
      ? inForce.occurredAt
      : events.find((e) => e.type === "presentation_reviewed")?.occurredAt;

  return {
    statement: STATEMENT_OF[inForce.code] ?? inForce.code,
    code: inForce.code,
    assignedAt: origin.occurredAt,
    assignedBy:
      origin.author.kind === "person" ? origin.author.name : "the intake mapping",
    reviewedAt: reviewedAt !== origin.occurredAt ? reviewedAt : undefined,
  };
}

/** Code → statement now comes from the DSM-5 module — the ONE place that knows
 *  where codes live. A local map here would drift the moment the search dialog
 *  offered a code this file had never heard of. Unknown codes fall back to the
 *  code itself rather than inventing wording. */
const STATEMENT_OF = new Proxy({} as Record<string, string>, {
  get: (_t, code: string) => statementForCode(code),
});

export function cadenceFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): CareCadence {
  const events = careTimelineFor(teenId, now, store);
  // Sorted EXPLICITLY, never trusting fixture order — reading "the first
  // assessment" off the end of an unsorted array is how the locked instrument
  // ended up disagreeing with the one the cadence reports scores for.
  const assessments = events
    .filter((e) => e.type === "assessment")
    .sort((a, b) => b.occurredAt - a.occurredAt);
  const latest = assessments[0];
  const hasPresentation = presentationFor(teenId, now, store) !== null;

  if (!latest) {
    // Pre-first-survey: cadence hasn't started. Not an error state — the common
    // one, through the PRD's "snooze" period.
    return {
      stage: "intake",
      assignedSurvey: null,
      surveyLockedAt: null,
      lastAssessment: null,
      nextReviewDue: null,
    };
  }

  // The LOCKED instrument is the one being tracked forward — i.e. the one the
  // most recent assessment used. An intake battery can complete two instruments
  // on the same day; only one of them becomes the series, and it must be the
  // same one whose score this card reports.
  const instrument = latest.description;
  const sameInstrument = assessments.filter((e) => e.description === instrument);
  const lockedAt = sameInstrument[sameInstrument.length - 1].occurredAt;
  // Cadence itself starts at the FIRST completion of any instrument.
  const firstEver = assessments[assessments.length - 1];

  const score = (latest.items ?? []).reduce((a, i) => a + i.points, 0);
  const severity = latest.result.split("—").pop()!.trim();
  const daysSinceFirst = Math.round((now - firstEver.occurredAt) / DAY);
  // intake → day 30 → every 90 days thereafter.
  const stage: CadenceStage =
    daysSinceFirst < 30 ? "intake" : daysSinceFirst < 120 ? "day30" : "quarterly";
  const dueOffset = stage === "intake" ? 30 : stage === "day30" ? 120 : null;
  const nextReviewDue =
    dueOffset !== null
      ? firstEver.occurredAt + dueOffset * DAY
      : // Quarterly: 90 days from the last time anyone looked, falling back to
        // the last assessment when the presentation has never been reviewed.
        // Newest-first FIRST: store-backed decisions append to the end of the
        // array, so an unsorted `find` kept returning the 95-day-old fixture
        // review and left a just-reviewed record reading "overdue".
        ([...events]
          .sort((a, b) => b.occurredAt - a.occurredAt)
          .find(
            (e) =>
              hasPresentation &&
              (e.type === "presentation_reviewed" ||
                e.type === "presentation_changed" ||
                e.type === "presentation_assigned")
          ) ?? latest
        ).occurredAt + 90 * DAY;

  return {
    stage,
    assignedSurvey: instrument,
    surveyLockedAt: lockedAt,
    lastAssessment: {
      instrument,
      at: latest.occurredAt,
      score,
      severity,
      items: latest.items ?? [],
    },
    nextReviewDue,
  };
}

/** How a due date reads. The date itself is explicit (clinical-date rule); THIS
 *  is the countdown beside it, which keeps the elapsed framing because it is a
 *  distance, not a date of record. */
export function reviewDueState(
  dueAt: number,
  now: number
): { tone: "neutral" | "warning"; label: string } {
  const days = Math.round((dueAt - now) / DAY);
  // TODO-COPY
  if (days < 0)
    return { tone: "warning", label: `overdue by ${elapsed(-days)}` };
  if (days === 0) return { tone: "warning", label: "due today" };
  if (days <= 14) return { tone: "warning", label: `due in ${elapsed(days)}` };
  return { tone: "neutral", label: `due in ${elapsed(days)}` };
}

/** Unit rollup for the countdown — days under a fortnight, then weeks, then
 *  months, matching relJoined's steps so the two never disagree on a span. */
function elapsed(days: number): string {
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

// ── Pending reviews ─────────────────────────────────────────────────────────
// FIXTURES. A pending review is the action slot's only consumer today, and only
// two teens carry one so the resting mode is what most records show — a healthy
// record renders NO slot, and absence is the reward state.

// ── Additional demo subjects with a pending review ──────────────────────────
// GENERATED, not hand-written, so each one gets a coherent record: an intake
// assessment whose points add up to its stated score, and a review that cites
// that same assessment. A pending review above an empty timeline is the shape
// that made the summary card contradict its own history last time.
//
// TODO-DATA: every value invented. `daysAgo` is the teen's intake, which must sit
// inside their tenure — see PENDING_DEMO for the per-teen numbers.

interface PendingDemo {
  /** Days since the intake assessment. Must be < the teen's joinedDaysAgo. */
  daysAgo: number;
  instrument: "PHQ-9" | "GAD-7";
  score: number;
  severity: string;
  items: AssessmentItem[];
  /** The code the mapping proposes. */
  code: string;
}

const PENDING_DEMO: Record<string, PendingDemo> = {
  // Sofia Ramos — joined 25d, paused. Anxiety presentation proposed at intake.
  t6: { daysAgo: 20, instrument: "GAD-7", score: 12, severity: "moderate", items: GAD7_SCORE_12, code: "F41.1" },
  // Mia Chen — joined 70d. Adjustment presentation proposed.
  t12: { daysAgo: 61, instrument: "GAD-7", score: 9, severity: "mild", items: GAD7_ITEMS, code: "F43.22" },
  // Zoe Bennett — joined 55d. Depression presentation proposed.
  t8: { daysAgo: 48, instrument: "PHQ-9", score: 11, severity: "moderate", items: PHQ9_SCORE_11, code: "F33.0" },
};

/** A STATED SCORE MUST EQUAL ITS ITEM SUM. `cadenceFor` derives the score from
 *  `items` while the row renders `result`, so a mismatch puts two different
 *  numbers for one assessment on one screen — which has now happened twice
 *  (t13's PHQ-9, then t6's GAD-7). Dev-only, and it throws rather than warns:
 *  a fixture that contradicts itself should not survive a page load. */
function assertScoreMatchesItems(teenId: string, d: PendingDemo) {
  if (process.env.NODE_ENV === "production") return;
  const sum = d.items.reduce((a, i) => a + i.points, 0);
  if (sum !== d.score) {
    throw new Error(
      `care fixture ${teenId}: ${d.instrument} states ${d.score} but its items sum to ${sum}`
    );
  }
}

function pendingDemoTimeline(teenId: string, now: number): CareEvent[] {
  const d = PENDING_DEMO[teenId];
  if (!d) return [];
  assertScoreMatchesItems(teenId, d);
  return [
    {
      id: `cd-${teenId}-1`,
      occurredAt: ago(now, d.daysAgo),
      type: "assessment",
      description: d.instrument,
      result: `${d.score} — ${d.severity}`,
      author: { kind: "system" },
      visibility: "all_staff",
      items: d.items,
    },
  ];
}

function pendingDemoReview(teenId: string, now: number): PresentationReview | null {
  const d = PENDING_DEMO[teenId];
  if (!d) return null;
  return {
    id: `pr-${teenId}-intake`,
    // Stage is overwritten by the caller from cadence — kept honest there.
    stage: "intake",
    recommended: { statement: STATEMENT_OF[d.code] ?? d.code, code: d.code },
    rationale: {
      source: "templated",
      text: `The intake ${d.instrument} scored ${d.score} in the ${d.severity} band. The mapping returns ${STATEMENT_OF[d.code] ?? d.code} for that profile.`,
    },
    survey: {
      instrument: d.instrument,
      at: ago(now, d.daysAgo),
      score: d.score,
      severity: d.severity,
      items: d.items,
    },
    aggregate: null,
  };
}

export function pendingReviewFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): PresentationReview | null {
  // Decided reviews are GONE from the slot — that is the whole reward: the slot
  // renders nothing when nothing is pending. The decision itself survives, in
  // the timeline, where it can be read but not unmade.
  const decided = new Set((store.decisions ?? []).map((d) => d.reviewId));
  // STAGE IS DERIVED from cadence, never carried on the fixture. A review that
  // labels itself "90-day review" beside a cadence card reading "Day 30" is the
  // same drift that put the wrong instrument in the locked-survey row.
  const stage = cadenceFor(teenId, now, store).stage;
  const live = (r: (Omit<PresentationReview, "stage"> & { stage?: CadenceStage }) | null) =>
    r && !decided.has(r.id) ? ({ ...r, stage } as PresentationReview) : null;
  if (teenId === "t9") {
    // INTAKE: no presentation yet, rationale TEMPLATED from the mapping.
    return live({
      id: `pr-${teenId}-intake`,
      recommended: {
        statement: STATEMENT_OF["F43.22"],
        code: "F43.22",
      },
      rationale: {
        source: "templated",
        text: "The intake responses scored in the moderate band on the anxiety items with a recent change in living or schooling circumstances recorded at sign-up. The mapping returns adjustment disorder with anxiety for that combination.",
      },
      survey: {
        instrument: "GAD-7",
        at: ago(now, 16),
        score: 9,
        severity: "mild",
        items: GAD7_ITEMS,
      },
      aggregate: null,
    });
  }
  if (teenId === "t13") {
    // QUARTERLY: the rationale is GENERATED, and the label says so. No churn or
    // risk-prediction language — it names what the scores DID, never what the
    // teen is forecast to do, and it describes message CADENCE (an event
    // property) rather than anything a teen wrote.
    return live({
      id: `pr-${teenId}-q90`,
      recommended: {
        statement: STATEMENT_OF["F33.0"],
        code: "F33.0",
      },
      rationale: {
        source: "ai",
        text: "Across the last three assessments the mood items have risen from the mild band into the moderate band, while the items that carried the anxiety presentation have not moved. Mentorship contact has stayed weekly through the period with no gap over nine days. The recurrent-depression presentation fits the current scores more closely than the one on record.",
      },
      survey: null,
      aggregate: {
        // Recency-weighted across the period, so the newest survey carries most
        // of the score — 11 rather than the flat mean of 10.7.
        score: 11,
        severity: "moderate",
        surveys: [
          { instrument: "PHQ-9", at: ago(now, 12), score: 11, severity: "moderate", items: PHQ9_SCORE_11 },
          { instrument: "PHQ-9", at: ago(now, 74), score: 13, severity: "moderate", items: PHQ9_SCORE_13 },
          { instrument: "PHQ-9", at: ago(now, 121), score: 8, severity: "mild", items: PHQ9_SCORE_8 },
        ],
      },
    });
  }
  // Generated demo subjects — coherent by construction (see PENDING_DEMO).
  const generated = pendingDemoReview(teenId, now);
  if (generated) return live(generated);
  return null;
}


// ─── CARE UPDATES (MO-9.1 Prompt C, Phase 3) ────────────────────────────────
//
// Written by SUPERVISORS — clinicians and supervisors are the same role in this
// product. Below that tier a care update is read-only, with no compose
// affordance rendered at all.
//
// APPEND-ONLY, like everything else on this record. "Editing" an update appends
// an amendment that references the original; both keep rendering, and the
// timeline's existing amendment treatment picks the pair up for free because the
// appended event carries `amends`.
//
// THE PROSE SCAFFOLDING IS THE FIGMA'S, VERBATIM. "Where things stand / Direction
// of care / What I am watching" is good clinical writing structure — it makes a
// supervisor say where they are, where they are going, and what would change
// their mind. Kept as the compose template rather than replaced with a free
// textarea, and kept as the READ structure too so an update is skimmable.

/** TODO-COPY — the section prompts, verbatim from the Figma. */
export const CARE_UPDATE_SECTIONS = [
  { id: "standing", label: "Where things stand" },
  { id: "direction", label: "Direction of care" },
  { id: "watching", label: "What I am watching" },
] as const;

export type CareUpdateSectionId = (typeof CARE_UPDATE_SECTIONS)[number]["id"];
export type CareUpdateBody = Record<CareUpdateSectionId, string>;

export function emptyCareUpdateBody(): CareUpdateBody {
  return { standing: "", direction: "", watching: "" };
}

export interface CareUpdateRecord {
  id: string;
  teenId: string;
  createdAt: number;
  author: string;
  authorRole: string;
  body: CareUpdateBody;
  /** Id of the care update this one corrects. Both keep rendering. */
  amends?: string;
}

/** One care update as a timeline entry. The prose travels in `providerNote` so
 *  the timeline's existing disclosure renders it without a special case. */
function careUpdateToEvent(u: CareUpdateRecord): CareEvent {
  const filled = CARE_UPDATE_SECTIONS.filter((s) => u.body[s.id].trim());
  return {
    id: `ce-cu-${u.id}`,
    occurredAt: u.createdAt,
    type: "care_update",
    // TODO-COPY. Names the SHAPE of what was written, never its content — the
    // description column is a row label, not a summary of clinical prose.
    description: u.amends ? "Care update amended" : "Care update written",
    result: filled.map((s) => s.label).join(" · ") || "No sections filled",
    author: { kind: "person", name: u.author, role: u.authorRole },
    // Points at the amended update's EVENT id, so the chain renders both ways.
    amends: u.amends ? `ce-cu-${u.amends}` : undefined,
    visibility: "all_staff",
    providerNote: CARE_UPDATE_SECTIONS.filter((s) => u.body[s.id].trim())
      .map((s) => `${s.label}\n${u.body[s.id].trim()}`)
      .join("\n\n"),
  };
}

/** Every care update on a teen, newest first. */
export function careUpdatesFor(
  teenId: string,
  updates: CareUpdateRecord[]
): CareUpdateRecord[] {
  return updates
    .filter((u) => u.teenId === teenId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** The one shown IN FULL beneath the presentation spine: the most recent update
 *  that nothing has superseded. Older ones live in the timeline — the main
 *  column carries the current clinical read, not an archive. */
export function latestCareUpdateFor(
  teenId: string,
  updates: CareUpdateRecord[]
): CareUpdateRecord | null {
  const mine = careUpdatesFor(teenId, updates);
  const superseded = new Set(mine.map((u) => u.amends).filter(Boolean));
  return mine.find((u) => !superseded.has(u.id)) ?? null;
}

// ─── AI SUMMARY (Prompt C, Phase 2) ─────────────────────────────────────────
//
// DECISION SUPPORT, NOT RECORD. It carries an explicit AI label, a limitation
// line, and typography deliberately SUBORDINATE to human clinical text — because
// mentors read this page, and an AI paragraph set like an authored account would
// be read as one.
//
// EVENTS, NOT MESSAGE CONTENT. The summary may say contact has been weekly; it
// may never say what anyone wrote. Nothing here quotes or paraphrases a message.
//
// TODO-DATA: fixture text. Regeneration isn't wired, so a manual refresh
// re-stamps the date and leaves the text — see careSummaryRefreshedAt in the
// store, and the note on the refresh control.

export interface CareAiSummary {
  text: string;
  generatedAt: number;
}

/** TODO-COPY */
export const AI_SUMMARY_LIMITATION =
  "AI-generated from survey history and mentorship activity, for context only — not a clinical determination.";

/** Null when there isn't enough on file to say anything — the UI renders "Not
 *  enough data yet" rather than a confident sentence built on one data point. */
export function careAiSummaryFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): CareAiSummary | null {
  const events = careTimelineFor(teenId, now, store);
  const assessments = events.filter((e) => e.type === "assessment");
  // One survey is a reading, not a history. Two is the minimum for a trend, and
  // a trend is the only thing this paragraph is for.
  if (assessments.length < 2) return null;

  const generatedAt = Math.max(...events.map((e) => e.occurredAt));
  if (teenId === "t15") {
    return {
      generatedAt,
      text: "Both intake instruments scored in the mild-to-moderate range, with the sleep items the highest across them. Mentorship contact has been steady since the match resumed, with the teen initiating most of the recent exchanges.",
    };
  }
  if (teenId === "t13") {
    return {
      generatedAt,
      text: "Scores across three assessments have moved from the mild band into the moderate band, with the mood items accounting for most of the change and the anxiety items flat. Contact has stayed weekly through the period with no gap longer than nine days.",
    };
  }
  return {
    generatedAt,
    text: "Assessment scores have held in the same band across the period on file, and mentorship contact has continued without a gap longer than two weeks.",
  };
}
