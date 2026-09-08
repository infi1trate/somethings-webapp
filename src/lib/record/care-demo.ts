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

import {
  careFlagsFor,
  DEMO_TEENS,
  defaultMenteeStatus,
  type CareFlagRecord,
} from "@/lib/record/people-demo";
import { statementForCode } from "@/lib/record/dsm5";
import { tagLabel } from "@/lib/record/content-tags";

/** Event classes, v1. Ordered roughly by how often a reader is looking for them.
 *  Adding a class is a data change, not a refactor — the timeline renders any
 *  member of this union. */
export type CareEventType =
  /** A survey SENT but not returned. The teen owes us this one, and until it
   *  lands the record has an outstanding action rather than a blank page — this
   *  is the "just joined, needs to take their first survey" state. Deliberately
   *  the same shape the Cadence card's unbuilt "Assign first survey" action
   *  would append, so wiring that later is a store write, not a new concept. */
  | "survey_assigned"
  | "assessment"
  | "presentation_assigned"
  | "presentation_reviewed"
  | "presentation_changed"
  | "care_update"
  /** A CARE SUMMARY COMMITTED TO THE RECORD — the per-cycle evidence document,
   *  frozen at the moment its review was approved. Distinct from `care_update`
   *  and never merged with it: the update is the supervisor's own prose, this is
   *  the evidence they read. Phase 7 cross-references the two. */
  | "care_summary"
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
  /** THE TIMELINE'S EXPANDED DETAIL TEXT — not one feature's field.
   *
   *  Named for the presentation review's note, which it originally carried, and
   *  the name outlived that: it now carries the detail text for presentation
   *  rows, decisions, flag resolutions, closures AND care updates. The review
   *  card's "Provider note" INPUT is retired; this is the timeline's own
   *  disclosure text and every event class above depends on it. Renaming it
   *  would touch renderers that are out of scope. See design-system-gaps row 298. */
  providerNote?: string;
  /** care_update rows — the `CareEvent.id` of the presentation event this
   *  documents. The mirror of `documentedBy` below; two cross-referenced entries,
   *  never one merged row. */
  documents?: string;
  /** presentation_* rows — the `CareEvent.id` of the care update documenting it. */
  documentedBy?: string;
  /** care_update rows — whether a pre-filled diagnostic statement was revised
   *  before signing. Surfaced on the history row. */
  diagnosticPrefill?: CareUpdatePrefill;
  /** care_update rows — the structured assessment, carried on the event so the
   *  timeline can render its chip without reaching for the record. The prose
   *  travels in `providerNote`; this does not, because it is a value and not a
   *  paragraph. */
  assessment?: CareUpdateAssessment;
  /** ═══ risk_flag / escalation rows — THE SOURCE RECORD ITSELF ═══
   *
   *  The History expansion renders a field set (escalation type, suicide-risk
   *  assessment, safety plan; media type, priority, the flagged excerpt) that has
   *  no home on `CareEvent` and would need a dozen optional fields here to get
   *  one. Carrying the record it was built from is one field instead, and it
   *  cannot drift from its source because it IS its source.
   *
   *  Set only by `flagEventsFor`. A closure entry (`ce-close-*`) does NOT carry
   *  it: a closure is its own event about the flag, not the flag. */
  flagRecord?: CareFlagRecord;
}

import type { CareSummaryCommit, ConcordanceResult } from "@/lib/record/care-summary-doc";
import { TIER_LABEL, type RiskTier } from "@/lib/record/risk-taxonomy";
import type { FieldProvenance } from "@/lib/record/field-provenance";

const DAY = 86_400_000;
/** Fixtures are relative to a fixed reference so they never drift; the caller
 *  passes `now` and these resolve against it. */
const ago = (now: number, days: number) => now - days * DAY;

/** Which filter chip a class belongs under. Chips GROUP classes — the union of
 *  event types is larger than this bar and always will be.
 *
 *  SUMMARIES GET THEIR OWN CHIP rather than folding under "Care updates", which
 *  was the cheaper option. A committed summary and a care update are different
 *  artefacts by different authors: one is derived evidence, the other is a
 *  supervisor's written assessment. "Show me the summaries on this record" is a
 *  question a reader actually asks, and under a shared chip it has no answer.
 *  The bar is `flex-wrap`, so the sixth chip wraps at narrow widths rather than
 *  overflowing. TODO-COPY on the label. */
export const CARE_FILTERS = [
  { id: "all", label: "All" },
  { id: "assessments", label: "Assessments" },
  { id: "presentation", label: "Presentation" },
  { id: "summary", label: "Summaries" },
  { id: "care", label: "Care updates" },
  { id: "flags", label: "Flags" },
] as const;
export type CareFilterId = (typeof CARE_FILTERS)[number]["id"];

const FILTER_OF: Record<CareEventType, Exclude<CareFilterId, "all">> = {
  survey_assigned: "assessments",
  assessment: "assessments",
  presentation_assigned: "presentation",
  presentation_reviewed: "presentation",
  presentation_changed: "presentation",
  care_update: "care",
  care_summary: "summary",
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
  /* TODO-COPY — names the event, not the wait. "Survey overdue" would be a
     judgement, and a teen who hasn't answered in two days isn't late. */
  survey_assigned: "Survey sent",
  assessment: "Assessment",
  presentation_assigned: "Presentation assigned",
  presentation_reviewed: "Presentation reviewed",
  presentation_changed: "Presentation changed",
  care_update: "Care update",
  /* TODO-COPY — "Care summary", not "AI summary": the row is a record entry
     whose provenance is stated inside the document, not in its title. */
  care_summary: "Care summary",
  escalation: "Escalation",
  risk_flag: "Flag",
  pause: "Paused",
  return: "Returned",
};

/** Pill tone per class, from the semantic families — no raw hex, and NOT the
 *  PRD's purple. `presentation_changed` takes the warm accent so it separates
 *  from a review at a glance; escalation is the critical family, reserved. */
export const TYPE_TONE: Record<CareEventType, "neutral" | "warm" | "warning" | "critical"> = {
  // Neutral: waiting on a survey is the ordinary state of a new record, and
  // defaults whisper.
  survey_assigned: "neutral",
  assessment: "neutral",
  presentation_assigned: "neutral",
  presentation_reviewed: "neutral",
  presentation_changed: "warm",
  care_update: "neutral",
  // Neutral even when the summary DIVERGED. The divergence is a finding inside
  // the document, and tinting the History row would restate it as a property of
  // the record — the same reason there are no whole-card tints.
  care_summary: "neutral",
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
  if (teenId === "t17") {
    /* ═══ THE RICH LONGITUDINAL RECORD — DEEP ENOUGH TO PAGE ═══
     *
     *  t17 carried 14 events, UNDER the 15-row page size, so the pagination it is
     *  meant to demonstrate would never have appeared on the one scenario named
     *  to demonstrate it. Extended to ~40 per the brief.
     *
     *  ═══ WHY THESE ARE ALL care_update AND care_summary ═══
     *
     *  Deliberate. Assessments, presentation events and flags are DERIVED for
     *  this teen — `CARE_PROFILES.t17` builds the assessment series and the
     *  presentation spine, `careFlags` builds the flags. Writing an assessment
     *  through THIS path would put a score in History that `weightedNowFor` and
     *  `pendingReviewFor` never see, so the presentation card's Weighted Avg and
     *  the review card would disagree with the record underneath them. That is
     *  exactly what `record-scenarios.test.ts` asserts against; the guard would
     *  fire, and it should.
     *
     *  So the depth comes from the two classes that are pure documentation — and
     *  they are also the right ones for search, because every entry carries prose.
     *
     *  SYNTHETIC. Modelled on the tone of supervision notes; no real names, and
     *  nothing here is anyone's actual words. */
    const NOTES: [
      days: number,
      kind: "care_update" | "care_summary",
      title: string,
      result: string,
      note: string,
    ][] = [
      [9, "care_update", "Weekly supervision note", "Logged", "Mentor reports the calls have settled back into their usual rhythm after the schedule change. Two consecutive weeks kept without a reschedule."],
      [16, "care_summary", "Care summary committed", "Committed", "Mood steady across the period. Sleep is still the recurring theme in check-ins, and the teen continues to raise it themselves rather than waiting to be asked."],
      [23, "care_update", "School term change noted", "Logged", "Teen mentioned a timetable change for the new term. Mentor moved the standing call thirty minutes later to fit around it. No other adjustment needed."],
      [31, "care_update", "Mentor coaching note", "Logged", "Coached the mentor on holding silence when the teen is working up to something rather than filling the gap. They tried it on the following call and reported it went well."],
      [38, "care_summary", "Care summary committed", "Committed", "A quieter month. The teen initiated contact twice outside the scheduled calls, which is new, and both times about something ordinary."],
      [45, "care_update", "Guardian contact logged", "Logged", "Routine check-in with the guardian. No concerns raised. Confirmed the contact number on file is still current."],
      [52, "care_update", "Activity completed", "Logged", "Teen finished the goal-setting activity and shared the result with their mentor unprompted. Mentor noted it was the first thing they had volunteered in several weeks."],
      [59, "care_update", "Supervision review", "Logged", "Reviewed the last six weeks with the mentor. Nothing outstanding. Agreed to keep the current cadence rather than adding contact."],
      [66, "care_summary", "Care summary committed", "Committed", "Engagement consistent through the period. The theme running through the check-ins is workload rather than mood, and the teen frames it as manageable."],
      [74, "care_update", "Missed call followed up", "Logged", "One missed call, followed up the same day by message. Teen replied within the hour and rescheduled themselves."],
      [81, "care_update", "Mentor availability change", "Logged", "Mentor flagged a two-week absence. Cover arranged with the lead mentor and the teen was told a fortnight in advance."],
      [88, "care_update", "Cover handover note", "Logged", "Handover to the covering mentor. Briefed on the sleep theme and on the teen preferring to be asked directly rather than approached sideways."],
      [96, "care_summary", "Care summary committed", "Committed", "Two calls held with the covering mentor and both kept. The teen mentioned the change without appearing unsettled by it."],
      [104, "care_update", "Return from cover", "Logged", "Regular mentor resumed. Teen picked the conversation up where it had left off, which the covering mentor had noted as likely."],
      [112, "care_update", "Goal check-in", "Logged", "Revisited the goals set at the ninety-day mark. Two carried forward unchanged, one dropped by the teen as no longer relevant."],
      [119, "care_update", "Mentor coaching note", "Logged", "Discussed pacing. The mentor had been covering three topics a call; agreed to follow the teen's lead instead and let a call be about one thing."],
      [127, "care_summary", "Care summary committed", "Committed", "Steady. The pattern across the period is that the teen raises the difficult thing late in the call, so the mentor has begun leaving room at the end rather than closing early."],
      [134, "care_update", "Guardian contact logged", "Logged", "Second routine guardian check-in. Guardian asked how the sessions were structured and was given the standard explanation."],
      [141, "care_update", "Schedule stabilised", "Logged", "Four consecutive weeks at the same time and day. Noted because the first two months had needed a reschedule most weeks."],
      [149, "care_update", "Supervision review", "Logged", "Six-week review with the mentor. Raised that the teen had twice referred to a friendship group changing; agreed to notice rather than probe."],
      [157, "care_summary", "Care summary committed", "Committed", "The friendship theme recurs across three check-ins this period. The teen describes it as background rather than as a problem, and the mentor has not pushed."],
      [164, "care_update", "Activity completed", "Logged", "Teen completed the strengths activity. Their answers were brief but they finished it, which the mentor noted as a change from the previous one."],
      [172, "care_update", "Mentor coaching note", "Logged", "Coached on closing calls. The mentor had been ending on a summary; agreed to end on a question the teen can answer next time instead."],
      [180, "care_update", "First guardian contact", "Logged", "Introductory call with the guardian. Explained the mentorship, the cadence and what would prompt an escalation. Contact details confirmed."],
      [188, "care_summary", "Care summary committed", "Committed", "First full period since matching. Engagement established, calls kept, and the teen has begun answering at more than one word."],
      [195, "care_update", "Match introduction", "Logged", "Introduction call held. Teen quiet but engaged for the full session. Mentor briefed on the intake themes beforehand."],
    ];
    return NOTES.map(([days, type, description, result, providerNote], i) => ({
      id: `cl-t17-${i + 1}`,
      occurredAt: ago(now, days),
      type,
      description,
      result,
      author: { kind: "person", name: "Dr. Amara Patel", role: "Supervisor" } as const,
      visibility: "all_staff" as const,
      providerNote,
    }));
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



// ─── GENERATED CARE RECORDS ─────────────────────────────────────────────────
//
// WHY GENERATED. Three teens carried a hand-written timeline and everyone else
// got `[]`, which left the Care tab empty on 20 of 26 records — the designed
// pre-first-survey state, but on almost the whole roster, so the tab could not
// be judged. Hand-writing twenty more would mean hand-writing ~60 assessment
// response sets, and A STATED SCORE MUST EQUAL ITS ITEM SUM — a rule this file
// has already broken twice (t13's PHQ-9, then t6's GAD-7) with only five sets in
// play. So the response sets are DERIVED from the score instead: the invariant
// holds by construction, and `assertScoreMatchesItems` becomes a check on the
// hand-written fixtures alone.
//
// t15, t13 and t9 keep their hand-written records untouched. They exist to
// exercise the amendment chain, the quarterly-overdue boundary and the day-30
// warning edge; regenerating them would risk those cases for no gain.
//
// TODO-DATA: every value below is invented, and no clinical layer exists to
// replace it yet.

/** Points → the response label, which is the whole instrument's scale. */
const ANSWER_BY_POINTS = [
  "Not at all",
  "Several days",
  "More than half the days",
  "Nearly every day",
] as const;

/** Small deterministic hash. Two teens must not share a response shape, and the
 *  shape must not change between renders — `Math.random()` would reshuffle every
 *  expanded breakdown on every keystroke elsewhere on the page. */
function seedNum(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** THE SELF-HARM ITEM NEVER CARRIES POINTS. Every hand-written fixture keeps it
 *  at zero, and a record that reports self-harm in its expanded breakdown while
 *  showing no escalation flag contradicts itself on the one subject where that
 *  matters most. Escalations are authored (`DemoTeen.escalation`), never a side
 *  effect of a score. */
const NO_POINTS_QUESTION = "Thoughts of self-harm";

/** A response set whose points sum EXACTLY to `score`.
 *
 *  Shape: one seeded "prominent" item takes as much as it can, then the rest
 *  fill evenly from a seeded offset. That reads like a real response set — a
 *  couple of items driving the score, several mid, some at zero — where a flat
 *  round-robin reads as synthetic and a purely greedy fill maxes three items and
 *  leaves the rest empty. */
function buildItems(
  instrument: "PHQ-9" | "GAD-7",
  score: number,
  seed: string
): AssessmentItem[] {
  const questions = (instrument === "PHQ-9" ? PHQ9_ITEMS : GAD7_ITEMS).map(
    (i) => i.question
  );
  const eligible = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q !== NO_POINTS_QUESTION)
    .map(({ i }) => i);

  const points = new Array(questions.length).fill(0) as number[];
  const h = seedNum(`${instrument}:${score}:${seed}`);
  let left = Math.max(0, Math.min(score, eligible.length * 3));

  // The prominent item.
  const hot = eligible[h % eligible.length];
  const give = Math.min(3, left);
  points[hot] = give;
  left -= give;

  // Then evenly, one point per pass, from a seeded offset. Bounded by the total
  // headroom, so the loop cannot spin on an unreachable score.
  let k = (h >>> 3) % eligible.length;
  let guard = eligible.length * 3 + 1;
  while (left > 0 && guard-- > 0) {
    const i = eligible[k % eligible.length];
    if (points[i] < 3) {
      points[i]++;
      left--;
    }
    k++;
  }

  return questions.map((question, i) => ({
    question,
    answer: ANSWER_BY_POINTS[points[i]],
    points: points[i],
  }));
}

/** THE INSTRUMENT'S MAXIMUM — the denominator a bare score is meaningless
 *  without. "9" says nothing; "9 / 21" says most of the way to mild.
 *
 *  PHQ-9 is nine items scored 0–3 = 27. GAD-7 is seven items scored 0–3 = 21.
 *  Both are the real instruments' totals, not invented.
 *
 *  WHO-5 IS DELIBERATELY ABSENT. It is named in one comment at the top of this
 *  file and is not implemented anywhere: the instrument type is the literal union
 *  `"PHQ-9" | "GAD-7"`, no fixture uses it, and its scoring is a raw 0–25 that is
 *  conventionally multiplied by 4 to a percentage — a different shape from the
 *  other two, so it cannot be added here as one more number without deciding
 *  which of the two scales the card shows. Adding a wrong denominator to a
 *  minor's record is worse than not offering the instrument.
 *
 *  KEYED BY THE INSTRUMENT TYPE, so a new instrument cannot be added to the
 *  union without the compiler demanding its maximum here. That is the point of a
 *  Record over a function with a default. */
export const INSTRUMENT_MAX: Record<"PHQ-9" | "GAD-7", number> = {
  "PHQ-9": 27,
  "GAD-7": 21,
};

/** The severity band a score sits in, so the row's prose and the number can't
 *  disagree. Standard PHQ-9 / GAD-7 cut-points. */
export function severityFor(
  instrument: "PHQ-9" | "GAD-7",
  score: number
): string {
  const cuts =
    instrument === "PHQ-9"
      ? [[5, "minimal"], [10, "mild"], [15, "moderate"], [20, "moderately severe"]]
      : [[5, "minimal"], [10, "mild"], [15, "moderate"]];
  for (const [ceiling, label] of cuts as [number, string][]) {
    if (score < ceiling) return label;
  }
  return "severe";
}

/** ═══ THE RECENCY-WEIGHTED AGGREGATE ═══
 *
 *  A cadence review from day 30 on is a judgment about a PERIOD, not about the
 *  last thing a teen happened to answer. So the card reads a weighted score over
 *  the most recent surveys rather than a single number that one good week or one
 *  bad one can swing on its own.
 *
 *  THE 3:2:1 RATIO IS NOT ARBITRARY. t13's hand-written aggregate — the only one
 *  that existed before this function — states its score is "11 rather than the
 *  flat mean of 10.7", and 3:2:1 over its surveys (11, 13, 8) returns 67/6 =
 *  11.17 → 11 where the flat mean is 10.67. Any other ratio would have made that
 *  fixture contradict its own comment, so the formula was derived from the one
 *  card already shipping rather than picked.
 *
 *  ONE INSTRUMENT ONLY. A PHQ-9 and a GAD-7 are different scales with different
 *  denominators, so a mean across them is a number that means nothing — the same
 *  reason `scoreSeriesFor` filters to the locked instrument, and the reason t13's
 *  own comment says a weighted aggregate "is only meaningful across comparable
 *  scores".
 *
 *  RETURNS NULL BELOW TWO COMPARABLE SURVEYS. There is nothing to weight, and a
 *  card reading "recency-weighted across 1 surveys" would be wrong twice over.
 *  The caller falls back to the single-survey block, which is honest about being
 *  one reading. */
export const AGGREGATE_WEIGHTS = [3, 2, 1] as const;

export function weightedAggregate(
  /** NEWEST FIRST. Ordering is the caller's job because both callers already hold
   *  a sorted list, and re-sorting in here would silently paper over a third
   *  caller that passed them the other way round. */
  surveys: CareAssessment[]
): { score: number; severity: string; surveys: CareAssessment[] } | null {
  const instrument = surveys[0]?.instrument;
  if (!instrument) return null;
  const comparable = surveys
    .filter((s) => s.instrument === instrument)
    .slice(0, AGGREGATE_WEIGHTS.length);
  if (comparable.length < 2) return null;
  let total = 0;
  let divisor = 0;
  comparable.forEach((s, i) => {
    // `slice` bounds `i` to the weight list, so the fallback is unreachable — but
    // a weight of 0 is also the correct degenerate answer (it contributes to
    // neither side of the mean) rather than a number invented to satisfy a check.
    const weight = AGGREGATE_WEIGHTS[i] ?? 0;
    total += s.score * weight;
    divisor += weight;
  });
  // Math.round, matching how `reviewDueState` and `elapsed` round everywhere else
  // in this file — and the rounding t13's stated 11 already implies.
  const score = Math.round(total / divisor);
  return {
    score,
    severity: severityFor(instrument as "PHQ-9" | "GAD-7", score),
    surveys: comparable,
  };
}

// ── The profile table ───────────────────────────────────────────────────────

interface ProfileAssessment {
  /** Days before `now`. The builder asserts this sits inside the teen's tenure. */
  daysAgo: number;
  instrument: "PHQ-9" | "GAD-7";
  score: number;
}

interface ProfileUpdate {
  daysAgo: number;
  author: string;
  role: string;
  /** TODO-DATA — fixture clinical prose, matching the structured form's fields. */
  clinical: string;
  diagnostic: string;
  assessment: CareUpdateAssessment;
  /** Index into this profile's own `updates`, for an amendment chain. */
  amendsIndex?: number;
}

interface CareProfile {
  /** A survey sent that has NOT come back. Mutually exclusive with an intake
   *  assessment in practice, though the builder allows both — a re-survey that
   *  is outstanding is a legitimate later state. */
  outstandingSurvey?: { daysAgo: number; instrument: "PHQ-9" | "GAD-7" };
  assessments?: ProfileAssessment[];
  /** The presentation set from intake, by the mapping. */
  assigned?: { daysAgo: number; code: string };
  /** A supervisor looked and KEPT the code. */
  reviewed?: { daysAgo: number; code: string; by: string }[];
  /** A supervisor CHANGED it. `amendsAssigned` threads the correction onto the
   *  original assignment, which is what renders the superseded treatment. */
  changed?: { daysAgo: number; from: string; code: string; by: string; note: string };
  /** A presentation proposal awaiting approval — the billing-code notification.
   *  Built from this teen's own latest assessment, so the review cites the same
   *  survey the cadence card reports. */
  pending?: { code: string };
  updates?: ProfileUpdate[];
}

/** THE ROSTER'S CARE JOURNEYS.
 *
 *  Coverage is deliberate, not incidental:
 *    · 19 of the 20 active-or-paused teens have a record (t1 joined yesterday
 *      and has nothing — the one true empty state on the active side).
 *    · 3 of the 6 deactivated teens have a record from the mentorship that
 *      ended; t4, t25 and t26 have none, which is the "it ended before care
 *      ever started" case and is a real thing this page should be able to show.
 *    · 12 of 26 carry a pending presentation review.
 *
 *  t15 / t13 / t9 are absent from this table on purpose — they are hand-written
 *  above and must not be generated over.
 */
const CARE_PROFILES: Record<string, CareProfile> = {
  // ── Survey sent, nothing back yet (2–6 days in) ───────────────────────────
  t5: { outstandingSurvey: { daysAgo: 1, instrument: "PHQ-9" } },
  t10: { outstandingSurvey: { daysAgo: 2, instrument: "GAD-7" } },
  t2: { outstandingSurvey: { daysAgo: 3, instrument: "PHQ-9" } },
  t7: { outstandingSurvey: { daysAgo: 4, instrument: "GAD-7" } },

  // ── First survey in, presentation proposed (9–15 days in) ─────────────────
  t11: {
    assessments: [{ daysAgo: 7, instrument: "GAD-7", score: 7 }],
    pending: { code: "F41.1" },
  },
  t3: {
    assessments: [{ daysAgo: 9, instrument: "PHQ-9", score: 6 }],
    pending: { code: "F32.0" },
  },
  t14: {
    assessments: [{ daysAgo: 11, instrument: "PHQ-9", score: 14 }],
    pending: { code: "F32.1" },
  },

  // ── Presentation in force, inside the day-30 window ───────────────────────
  // (t15, t8 and t12 hold this stage already — t8/t12 through PENDING_DEMO.)

  // ── Mature records: multiple surveys, reviews, corrections ────────────────
  t24: {
    assessments: [
      { daysAgo: 12, instrument: "PHQ-9", score: 9 },
      { daysAgo: 104, instrument: "PHQ-9", score: 12 },
    ],
    assigned: { daysAgo: 112, code: "F32.1" },
    // ═══ MOVED FROM F32.0 WHEN THE CARD STARTED SHOWING A WEIGHTED SCORE ═══
    // Two readings, 9 then 12 going back, so the recency-weighted score is 10 and
    // the band the card prints is MODERATE — while F32.0 is "single episode,
    // mild". The mild code was coherent against the latest reading on its own and
    // stopped being coherent the moment the evidence block became the period.
    // F32.1 is the code already on record, so this is a review that CONFIRMS
    // rather than changes — see the confirm-unchanged rationale branch.
    pending: { code: "F32.1" },
  },
  t23: {
    assessments: [
      { daysAgo: 20, instrument: "GAD-7", score: 11 },
      { daysAgo: 112, instrument: "GAD-7", score: 8 },
    ],
    assigned: { daysAgo: 120, code: "F41.1" },
    pending: { code: "F41.1" },
  },
  t21: {
    assessments: [
      { daysAgo: 8, instrument: "PHQ-9", score: 7 },
      { daysAgo: 96, instrument: "PHQ-9", score: 10 },
      { daysAgo: 140, instrument: "PHQ-9", score: 13 },
    ],
    assigned: { daysAgo: 146, code: "F33.0" },
    reviewed: [{ daysAgo: 8, code: "F33.0", by: "Dr. Amara Patel" }],
    updates: [
      {
        daysAgo: 8,
        author: "Dr. Amara Patel",
        role: "Supervisor",
        clinical:
          "Scores have come down across three surveys, with the sleep and energy items moving first. Contact with the mentor has been steady and mostly teen-initiated. The appetite items have not moved.",
        diagnostic:
          "The presentation on record continues to fit: low mood with sleep and appetite disturbance, now reduced in intensity but still present on every survey in the period. Improvement in severity does not remove the criteria the code describes, so the code stands.",
        assessment: "improved",
      },
    ],
  },
  t19: {
    assessments: [
      { daysAgo: 16, instrument: "PHQ-9", score: 12 },
      { daysAgo: 100, instrument: "PHQ-9", score: 9 },
      { daysAgo: 168, instrument: "PHQ-9", score: 8 },
    ],
    assigned: { daysAgo: 172, code: "F41.1" },
    changed: {
      daysAgo: 100,
      from: "F41.1",
      code: "F33.0",
      by: "Omar Haddad",
      note: "The intake mapping keyed on the worry items. Across two surveys the mood items are carrying the score, and the low mood has persisted through a settled period at home.",
    },
    pending: { code: "F33.1" },
    updates: [
      {
        daysAgo: 16,
        author: "Omar Haddad",
        role: "Supervisor",
        clinical:
          "The most recent survey moved back up into the moderate band after two quieter quarters. The mood items account for the change; the somatic items held.",
        diagnostic:
          "A return of mood symptoms after two quarters at a lower severity is the pattern a recurrent framing describes, and the single-episode code on record does not account for the earlier remission. One reading is not yet a trend, so this states the evidence rather than concluding on it.",
        assessment: "escalated",
      },
    ],
  },
  t18: {
    assessments: [
      { daysAgo: 10, instrument: "GAD-7", score: 6 },
      { daysAgo: 82, instrument: "GAD-7", score: 9 },
      { daysAgo: 150, instrument: "GAD-7", score: 13 },
      { daysAgo: 180, instrument: "GAD-7", score: 15 },
    ],
    assigned: { daysAgo: 182, code: "F41.1" },
    reviewed: [
      { daysAgo: 150, code: "F41.1", by: "Brandy Forrestor" },
      { daysAgo: 10, code: "F41.1", by: "Brandy Forrestor" },
    ],
    updates: [
      {
        daysAgo: 10,
        author: "Brandy Forrestor",
        role: "Supervisor",
        clinical:
          "Four surveys, each lower than the last, from the moderate band down into the mild one. The restlessness items dropped first and the worry items followed. Contact has thinned slightly this quarter.",
        diagnostic:
          "Excessive worry with restlessness remains reported on every survey in the period, at reducing intensity. The criteria for the code on record are still met at the mild end; nothing in the readings points to a different presentation.",
        assessment: "improved",
      },
    ],
  },
  t17: {
    assessments: [
      // ═══ THE BANDS ARE LOAD-BEARING, AND THEY MUST MATCH THE PROSE BELOW ═══
      // These five readings are read three ways on one screen: the History
      // series, the generated rationale's "in the {band} band" sentence, and
      // `pending.code` — which resolves to a STATEMENT carrying its own severity
      // word. They previously ran 10–15, every one of them moderate or worse,
      // under a fixture that recommends F33.0 (recurrent, MILD) and an update
      // that says the record moves "between the mild and moderate bands".
      // Nothing here was mild, so the card asserted a downgrade to a band the
      // series never touched. Re-stepped so the narrative is true of the data:
      // mild and moderate alternate, and the newest reading is genuinely mild.
      { daysAgo: 14, instrument: "PHQ-9", score: 8 },
      { daysAgo: 88, instrument: "PHQ-9", score: 11 },
      { daysAgo: 154, instrument: "PHQ-9", score: 13 },
      { daysAgo: 190, instrument: "PHQ-9", score: 9 },
      { daysAgo: 204, instrument: "PHQ-9", score: 12 },
    ],
    assigned: { daysAgo: 206, code: "F32.1" },
    changed: {
      daysAgo: 154,
      from: "F32.1",
      code: "F33.1",
      by: "Dr. Amara Patel",
      note: "A second episode inside the period on file, with a clear interval between them. The recurrent presentation is the better fit and the single-episode code was never re-examined after intake.",
    },
    reviewed: [{ daysAgo: 88, code: "F33.1", by: "Dr. Amara Patel" }],
    // ═══ MOVED FROM F33.0 FOR THE SAME REASON AS t24 ═══
    // The last three readings are 8, 11 and 13 going back, so the weighted score
    // is 10 — the MODERATE band, not the mild one F33.0 names. The falling
    // trajectory is real, and it is recorded in the amendment below; what it does
    // not do yet is carry the weighted severity out of moderate, so the review
    // confirms F33.1 instead of downgrading. The distance between "improving" and
    // "improved enough to change the code" is the whole reason to weight.
    pending: { code: "F33.1" },
    updates: [
      {
        daysAgo: 96,
        author: "Dr. Amara Patel",
        role: "Supervisor",
        clinical:
          "Five surveys over seven months, moving between the mild and moderate bands rather than in one direction. The interval between the peaks has been shortening.",
        diagnostic:
          "Movement between bands across five readings, with return to a lower severity in between, is the recurrent course the code on record describes rather than a single episode. The shortening interval supports that reading rather than contradicting it.",
        assessment: "maintained",
      },
      {
        daysAgo: 14,
        author: "Dr. Amara Patel",
        role: "Supervisor",
        amendsIndex: 0,
        clinical:
          "Five surveys over seven months, moving between the mild and moderate bands rather than in one direction. The last three readings fall 13, 11 and 8 — a recency-weighted 10 — and the last interval broke the shortening pattern.",
        diagnostic:
          "The recurrent course still fits, and the weighted severity across the last three readings remains in the moderate band, so the code on record is confirmed rather than changed. What is new is the direction: three consecutive falls, which the earlier statement did not have.",
        assessment: "improved",
      },
    ],
  },

  // ── Closed records: history that stops when the mentorship ended ──────────
  // NO pending review and NO next-review date on any of these — see the
  // deactivated guards in `cadenceFor` and `pendingReviewFor`. A proposal to
  // update the billing code on a mentorship that ended is noise, not a task.
  t16: {
    assessments: [
      { daysAgo: 44, instrument: "GAD-7", score: 10 },
      { daysAgo: 84, instrument: "GAD-7", score: 14 },
    ],
    assigned: { daysAgo: 86, code: "F41.1" },
  },
  t20: {
    assessments: [
      { daysAgo: 72, instrument: "PHQ-9", score: 8 },
      { daysAgo: 156, instrument: "PHQ-9", score: 11 },
    ],
    assigned: { daysAgo: 158, code: "F32.0" },
  },
  t22: {
    assessments: [
      { daysAgo: 52, instrument: "PHQ-9", score: 7 },
      { daysAgo: 118, instrument: "PHQ-9", score: 12 },
      { daysAgo: 136, instrument: "PHQ-9", score: 14 },
    ],
    assigned: { daysAgo: 138, code: "F32.1" },
    reviewed: [{ daysAgo: 52, code: "F32.1", by: "Omar Haddad" }],
    updates: [
      {
        daysAgo: 50,
        author: "Omar Haddad",
        role: "Supervisor",
        clinical:
          "Three surveys, each lower than the last. The mentorship ran its course and closed while the record was in its better stretch.",
        diagnostic:
          "The code on record was supported throughout by consistently reported low mood and reduced interest, both at their lowest at the final reading. No evidence in the period supported a different presentation, and none was made on closure.",
        assessment: "improved",
      },
    ],
  },
};

/** Tenure in days, for the in-tenure assertion. */
function tenureOf(teenId: string): number | null {
  return DEMO_TEENS.find((t) => t.id === teenId)?.joinedDaysAgo ?? null;
}

/** Is this mentee's mentorship over? A closed record gets no review clock and no
 *  presentation proposal. */
function isClosedRecord(teenId: string): boolean {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  if (!teen) return false;
  return defaultMenteeStatus(teen) === "deactivated";
}

/** NOTHING MAY BE DATED BEFORE THE TEEN EXISTED. An assessment outside its
 *  teen's tenure puts a survey on a record before the sign-up that created it —
 *  the same class of self-contradiction as a score that disagrees with its
 *  items, so it gets the same dev-only throw rather than a warning. */
function assertInTenure(teenId: string, daysAgo: number, what: string) {
  if (process.env.NODE_ENV === "production") return;
  const tenure = tenureOf(teenId);
  if (tenure !== null && daysAgo > tenure) {
    throw new Error(
      `care fixture ${teenId}: ${what} is dated ${daysAgo}d ago but the teen joined ${tenure}d ago`
    );
  }
}

function profileTimelineFor(teenId: string, now: number): CareEvent[] {
  const p = CARE_PROFILES[teenId];
  if (!p) return [];
  const events: CareEvent[] = [];

  if (p.outstandingSurvey) {
    const { daysAgo, instrument } = p.outstandingSurvey;
    assertInTenure(teenId, daysAgo, `${instrument} send`);
    events.push({
      id: `cg-${teenId}-sent`,
      occurredAt: ago(now, daysAgo),
      type: "survey_assigned",
      description: instrument,
      // TODO-COPY. States the fact, not a verdict on the teen.
      result: "Sent — not returned yet",
      author: { kind: "system" },
      visibility: "all_staff",
    });
  }

  for (const [n, a] of (p.assessments ?? []).entries()) {
    assertInTenure(teenId, a.daysAgo, `${a.instrument} assessment`);
    const severity = severityFor(a.instrument, a.score);
    events.push({
      id: `cg-${teenId}-a${n}`,
      occurredAt: ago(now, a.daysAgo),
      type: "assessment",
      description: a.instrument,
      result: `${a.score} — ${severity}`,
      author: { kind: "system" },
      visibility: "all_staff",
      items: buildItems(a.instrument, a.score, `${teenId}-${n}`),
    });
  }

  if (p.assigned) {
    assertInTenure(teenId, p.assigned.daysAgo, "presentation assignment");
    events.push({
      id: `cg-${teenId}-assigned`,
      occurredAt: ago(now, p.assigned.daysAgo),
      type: "presentation_assigned",
      description: "Presentation set from intake assessment",
      result: p.assigned.code,
      code: p.assigned.code,
      author: { kind: "ai", model: "intake mapping" },
      visibility: "all_staff",
      providerNote:
        "Generated from the intake response set. Not reviewed by a clinician at the time of assignment.",
    });
  }

  if (p.changed) {
    assertInTenure(teenId, p.changed.daysAgo, "presentation change");
    events.push({
      id: `cg-${teenId}-changed`,
      occurredAt: ago(now, p.changed.daysAgo),
      type: "presentation_changed",
      description: "Presentation changed after review",
      result: `${p.changed.from} → ${p.changed.code}`,
      code: p.changed.code,
      author: { kind: "person", name: p.changed.by, role: "Supervisor" },
      // Threads onto the original assignment, which is what renders the
      // superseded treatment and keeps the original ASSIGNED date intact.
      amends: `cg-${teenId}-assigned`,
      visibility: "all_staff",
      providerNote: p.changed.note,
    });
  }

  for (const [n, r] of (p.reviewed ?? []).entries()) {
    assertInTenure(teenId, r.daysAgo, "presentation review");
    events.push({
      id: `cg-${teenId}-r${n}`,
      occurredAt: ago(now, r.daysAgo),
      type: "presentation_reviewed",
      description: "Presentation reviewed on cadence",
      result: `${r.code} — unchanged`,
      code: r.code,
      author: { kind: "person", name: r.by, role: "Supervisor" },
      visibility: "all_staff",
    });
  }

  // Care updates ride the same builder so their timeline rows and the prose in
  // the main column can never come from two different sources.
  for (const u of fixtureCareUpdatesFor(teenId, now)) {
    events.push(careUpdateToEvent(u));
  }

  return events;
}

/** Fixture care updates for a teen, in the store's own record shape so every
 *  consumer treats them identically to one a supervisor writes in-session. */
export function fixtureCareUpdatesFor(
  teenId: string,
  now: number
): CareUpdateRecord[] {
  const p = CARE_PROFILES[teenId];
  if (!p?.updates) return [];
  return p.updates.map((u, n) => {
    assertInTenure(teenId, u.daysAgo, "care update");
    return {
      id: `cgu-${teenId}-${n}`,
      teenId,
      createdAt: ago(now, u.daysAgo),
      author: u.author,
      authorRole: u.role,
      body: {
        clinical: u.clinical,
        diagnostic: u.diagnostic,
        assessment: u.assessment,
      },
      amends:
        u.amendsIndex === undefined
          ? undefined
          : `cgu-${teenId}-${u.amendsIndex}`,
    };
  });
}

/** A presentation proposal for a generated profile, built from that teen's own
 *  latest assessment so the review cites the survey the cadence card reports.
 *  Returns null on a closed record — see the note on CARE_PROFILES. */
function profileReviewFor(
  teenId: string,
  now: number,
  /** ═══ THE STAGE DECIDES WHICH EVIDENCE BLOCK THE CARD GETS ═══
   *  Passed in rather than derived here. `pendingReviewFor` already computes it
   *  from cadence, and the whole reason it does that there is so a review can
   *  never label itself a stage the cadence card disagrees with — a second
   *  derivation in here would be a second thing to drift. */
  stage: CadenceStage
): Omit<PresentationReview, "stage"> | null {
  const p = CARE_PROFILES[teenId];
  if (!p?.pending || isClosedRecord(teenId)) return null;
  // NEWEST FIRST — the order `weightedAggregate` documents as the caller's job.
  const ordered = [...(p.assessments ?? [])].sort((a, b) => a.daysAgo - b.daysAgo);
  const latest = ordered[0];
  if (!latest) return null;
  /** EVERY reading as a full `CareAssessment`, its own items included. The
   *  expanded panel reads `aggregate.surveys[i].items`, so a weighted card needs
   *  answers behind each survey and not just the newest — this used to build one
   *  survey with a fixed `${teenId}-0` seed. The index is in the seed so two
   *  readings that share an instrument and a score do not get identical items. */
  const surveys: CareAssessment[] = ordered.map((a, i) => ({
    instrument: a.instrument,
    at: ago(now, a.daysAgo),
    score: a.score,
    severity: severityFor(a.instrument, a.score),
    items: buildItems(a.instrument, a.score, `${teenId}-${i}`),
  }));
  /** INTAKE KEEPS THE SINGLE SURVEY. A first review has one reading behind it by
   *  definition, and "Weighted across this period" over one number would be a
   *  heading describing arithmetic that never happened. From day 30 on the review
   *  is about a period, so it gets the period's weighted score. */
  const aggregate = stage === "intake" ? null : weightedAggregate(surveys);
  const latestSeverity = severityFor(latest.instrument, latest.score);
  const severity = aggregate ? aggregate.severity : latestSeverity;
  const current = p.changed?.code ?? p.assigned?.code;
  /** ═══ THE PROSE CITES THE NUMBER THE CARD SHOWS ═══
   *  Every branch used to open "The most recent PHQ-9 scored 8, in the mild
   *  band". Above a weighted score of 10 in the moderate band that is two numbers
   *  and two bands for one clinical judgment — the same defect that had three
   *  fixtures recommending a mild code under a moderate reading. The opening now
   *  follows the evidence block: weighted when the card is weighted. */
  const opening = aggregate
    ? `Across the last ${aggregate.surveys.length} ${latest.instrument} results the recency-weighted score is ${aggregate.score}, in the ${severity} band.`
    : `The most recent ${latest.instrument} scored ${latest.score}, in the ${severity} band.`;
  const statement = STATEMENT_OF[p.pending.code] ?? p.pending.code;
  /** ═══ A REVIEW THAT CONFIRMS THE CODE ON RECORD IS NOT A COMPARISON ═══
   *
   *  There was one branch here and it wrote a comparative sentence: "X fits the
   *  current scores more closely than Y does". On a record where the review
   *  proposes NO CHANGE, Y is X — so t23's card read "Generalized anxiety disorder
   *  fits the current scores more closely than F41.1 does", which is the same code
   *  on both sides of a comparison.
   *
   *  Confirming is a normal outcome of a cadence review, not an edge case: the
   *  compose dialog has had a same-code path for as long as `REVIEW_NOUN` has
   *  existed. The rationale needed one too. */
  const unchanged = current === p.pending.code;
  return {
    id: `pr-${teenId}-cadence`,
    recommended: {
      statement,
      code: p.pending.code,
    },
    rationale: {
      source: current ? "ai" : "templated",
      // Names what the scores DID, never what the teen is forecast to do, and
      // describes contact CADENCE rather than anything anyone wrote.
      text: !current
        ? `The intake ${latest.instrument} scored ${latest.score} in the ${latestSeverity} band. The mapping returns ${statement} for that profile.`
        : unchanged
          ? `${opening} Across the surveys on file the movement sits in the items that carry the presentation on record, and ${statement} still fits them. No change to the code is proposed.`
          : `${opening} Across the surveys on file the movement sits in the items that carry the presentation on record, and ${statement} fits the current scores more closely than ${current} does.`,
    },
    // EXACTLY ONE OF THESE IS SET, which is the contract `PresentationReview`
    // states and the condition `care-review-card.tsx` branches its whole
    // evidence block on.
    survey: aggregate ? null : (surveys[0] ?? null),
    aggregate,
  };
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
  /** THE CARE UPDATE THAT DOCUMENTS THIS DECISION — a `CareUpdateRecord.id`.
   *
   *  This REPLACED a `note: string` field. That note was the provider note, and
   *  the provider note was the second note object the care update now subsumes:
   *  every presentation event commits through the care update form, so the
   *  reasoning lives there and this points at it. Two cross-referenced entries,
   *  never one merged row and never two unrelated ones.
   *
   *  Optional only because a decision could in principle be written by a future
   *  surface that has no update; nothing in the app does that today. */
  careUpdateId?: string;
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
    // the recommendation.
    author: { kind: "person", name: d.actor, role: d.actorRole },
    visibility: "all_staff",
    // NO `providerNote` HERE ANY MORE. The reasoning is in the care update this
    // points at, and the timeline renders that update inside this entry's
    // disclosure rather than keeping a second copy of the prose.
    documentedBy: d.careUpdateId ? `ce-cu-${d.careUpdateId}` : undefined,
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
/** Escalations AND risk flags, from the flag records. Was escalation-only, with
 *  a hardcoded `result: "Supervisor looped in"` and a `system` author — so the
 *  record never said who raised it and could not say whether it was still open.
 *  Both now come off the record itself. */
function flagEventsFor(teenId: string, now: number): CareEvent[] {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  if (!teen) return [];
  return careFlagsFor(teen).map((f) => ({
    id: `ce-flag-${f.id}`,
    occurredAt: ago(now, f.daysAgo),
    type: f.kind,
    // WHAT WAS RAISED, never the content of a message.
    description: f.reason,
    // The RESULT column carries the resolution state — see flagResultLabel.
    result: flagResultLabel(f),
    author: { kind: "person", name: f.raisedBy, role: f.raisedByRole },
    visibility: "all_staff",
    providerNote: f.resolutionNote,
    // The expansion's field set — see `CareEvent.flagRecord`.
    flagRecord: f,
  }));
}

/** "Resolved · 48h" / "Open" (Prompt C Phase 4). The duration is how long it
 *  stayed open, which is the one number a supervisor reviewing flag handling
 *  actually wants — and it is a SPAN, so it keeps the elapsed form. */
export function flagResultLabel(f: CareFlagRecord): string {
  if (f.resolvedDaysAgo === undefined) return "Open"; // TODO-COPY
  const days = f.daysAgo - f.resolvedDaysAgo;
  // TODO-COPY. Under a day reads in hours: an escalation closed the same evening
  // should not round to "0 days".
  const span =
    days <= 0 ? "same day" : days === 1 ? "24h" : days < 3 ? `${days * 24}h` : `${days} days`;
  return `Resolved · ${span}`;
}

/** Open flags only, severity descending then newest first — the task region's
 *  input. Resolved flags live in History and nowhere else: the region is the
 *  WORK, and work that is done is not work. */
export function openFlagsFor(
  teenId: string,
  store: CareStoreSlice = {}
): CareFlagRecord[] {
  const teen = DEMO_TEENS.find((t) => t.id === teenId);
  if (!teen) return [];
  // A flag closed IN SESSION leaves the region exactly as a fixture-resolved one
  // does — the region is the work, and work that is done is not work.
  const closed = new Set((store.closures ?? []).map((c) => c.flagId));
  const rank = { critical: 0, warning: 1 } as const;
  return careFlagsFor(teen)
    .filter((f) => f.resolvedDaysAgo === undefined && !closed.has(f.id))
    .sort((a, b) => rank[a.severity] - rank[b.severity] || a.daysAgo - b.daysAgo);
}

/** One closure as a history entry. Resolution state, elapsed-to-resolution, the
 *  note and the closing supervisor as author — all four, per the brief. */
function closureToEvent(c: CareFlagClosure): CareEvent {
  const span =
    c.openDays <= 0
      ? "same day"
      : c.openDays === 1
        ? "24h"
        : c.openDays < 3
          ? `${c.openDays * 24}h`
          : `${c.openDays} days`;
  const extra = [c.crisisLabel && `Crisis: ${c.crisisLabel}`, c.referralLabel && `Referral: ${c.referralLabel}`]
    .filter(Boolean)
    .join(" · ");
  return {
    id: `ce-close-${c.flagId}`,
    occurredAt: c.closedAt,
    type: c.kind,
    // TODO-COPY. Names the event, never message content.
    description: c.kind === "escalation" ? "Escalation closed" : "Risk flag closed",
    result: `Resolved · ${span}`,
    author: { kind: "person", name: c.actor, role: c.actorRole },
    visibility: "all_staff",
    providerNote: [c.outcomeLabel, extra, c.note].filter(Boolean).join("\n\n"),
  };
}

/** Everything the store contributes to a teen's record. One options object
 *  rather than a growing positional tail — every reader below takes the same
 *  shape, so adding a future store-backed event class is one field here instead
 *  of a signature change in five places. */
/** A supervisor's close of an escalation or risk flag (store v33).
 *
 *  APPEND-ONLY, like every decision on this page: closing appends a history
 *  entry, and the flag leaves the task region because the record now holds its
 *  resolution rather than because anything was removed. */
export interface CareFlagClosure {
  flagId: string;
  teenId: string;
  closedAt: number;
  /** Days the flag stayed open — computed at close, so the elapsed figure in
   *  History cannot drift as `now` moves. */
  openDays: number;
  outcome: string;
  outcomeLabel: string;
  note: string;
  actor: string;
  actorRole: string;
  kind: "escalation" | "risk_flag";
  crisisLabel?: string;
  referralLabel?: string;
}

export interface CareStoreSlice {
  decisions?: CareReviewDecision[];
  updates?: CareUpdateRecord[];
  /** Closed flags, so `flagEventsFor` can report resolution and `openFlagsFor`
   *  can drop them from the task region. */
  closures?: CareFlagClosure[];
  /** Committed care summaries. Frozen snapshots, so this is the ONLY source for
   *  a past cycle's evidence — nothing here re-derives one. */
  summaries?: CareSummaryCommit[];
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
    ...profileTimelineFor(teenId, now),
    ...pendingDemoTimeline(teenId, now),
    ...flagEventsFor(teenId, now),
    ...(store.decisions ?? [])
      .filter((d) => d.teenId === teenId)
      .map(decisionToEvent),
    ...(store.updates ?? [])
      .filter((u) => u.teenId === teenId)
      .map(careUpdateToEvent),
    ...(store.closures ?? [])
      .filter((c) => c.teenId === teenId)
      .map(closureToEvent),
    ...(store.summaries ?? [])
      .filter((c) => c.teenId === teenId)
      .map(summaryCommitToEvent),
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

/** TODO-COPY. THE STAGE, as a standalone chip. Note that `quarterly` already reads
 *  "90-day review" — which is why concatenating this with the word "review" is a
 *  trap, and why `REVIEW_NOUN` below exists. */
/** ═══ THESE NAME THE REVIEW THAT IS DUE, NOT THE STAGE YOU ARE IN ═══
 *
 *  THEY USED TO NAME THE STAGE, AND IT WAS OFF BY ONE REVIEW. `cadenceFor` sets
 *  the stage from the review that has already HAPPENED — you enter `day30` once
 *  your day-30 review is behind you — while the chip pairs that label with a
 *  countdown to the review AHEAD. So the card read "due in 8 days · Day 30" on a
 *  teen 134 days into their mentorship whose next review actually falls on survey
 *  day 120. Reported twice from the app, from both ends of the same defect:
 *  first as "we're missing the 30 day review scenario" (nothing ever showed a
 *  day-30 review coming due, because the record where one IS due said "Intake"),
 *  then as "119 days in mentorship doesn't match a 30 day review".
 *
 *  MEASURED, and this is the whole argument: every record labelled "Intake" has
 *  its review on survey day 30, and every record labelled "Day 30" has its review
 *  on survey day 120. Not one exception in the roster. No fixture could have
 *  fixed it — a `day30`-stage record cannot have a day-30 review due, because
 *  that stage begins the moment that review is done.
 *
 *  So the label follows the countdown it sits beside:
 *    intake     → the day-30 review is next
 *    day30      → the first 90-day review is next (day 30 + 90 = day 120)
 *    quarterly  → every 90-day review after that
 *
 *  TWO STAGES SHARING A LABEL IS CORRECT, not a collapse worth avoiding: the
 *  review due at day 120 and the one due at day 210 are the same review on the
 *  same 90-day cadence. What distinguished them was only which was first, and
 *  that is not a fact about the review a supervisor is being asked to do. */
/** ═══ R6: ALL THREE STAGES NOW READ "{N}-day review" ═══
 *
 *  `intake` said "Day 30", which named the milestone rather than the review. The
 *  Figma composition puts the review TYPE beside the status chip, and "Day 30"
 *  beside "Recommended presentation" reads as a date, not a review.
 *
 *  CHANGED IN PLACE RATHER THAN GIVEN A THIRD MAP. There are already two of these
 *  (`STAGE_LABEL` and `REVIEW_NOUN`) and the note below explains what the second
 *  one cost; a third for one string is how a fourth gets added. `STAGE_LABEL` has
 *  exactly two non-test consumers, both on the Care tab and both in this pack's
 *  scope, so the edit reaches nothing it should not. */
export const STAGE_LABEL: Record<CadenceStage, string> = {
  intake: "30-day review",
  day30: "90-day review",
  quarterly: "90-day review",
};

/** ═══ THE SAME THREE STAGES, AS A NOUN PHRASE ═══
 *
 *  TODO-COPY. For anywhere a sentence needs to name the review rather than the
 *  stage — "Documenting: 90-day review".
 *
 *  IT EXISTS BECAUSE THE OBVIOUS THING IS WRONG. The care tab composed this as
 *  `${STAGE_LABEL[stage].toLowerCase()} review`, which reads correctly for two of
 *  the three stages and produces "90-day review review" for the third, because
 *  `STAGE_LABEL.quarterly` already ends in the word. It rendered in the care-update
 *  compose dialog's "Documenting:" line, on the path a supervisor takes to approve
 *  an unchanged quarterly review.
 *
 *  A second map rather than a suffix rule, so the fix cannot be undone by somebody
 *  reaching for `STAGE_LABEL` and appending a word — which is exactly what happened
 *  the first time. */
export const REVIEW_NOUN: Record<CadenceStage, string> = {
  intake: "day 30 review",
  day30: "90-day review",
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
  /** A survey SENT and not yet returned. Distinct from `assignedSurvey`, which
   *  is the instrument being tracked FORWARD and only exists once something has
   *  come back — before the first completion there is no series to lock. A
   *  record with one of these is waiting on the teen, not blank. */
  outstandingSurvey: { instrument: string; sentAt: number } | null;
  stage: CadenceStage;
  /** LOCKED AT FIRST COMPLETION — the instrument a teen started on is the one
   *  their scores are comparable against, so this never changes afterwards.
   *  Null before the first completion, which is when it is still choosable. */
  assignedSurvey: string | null;
  surveyLockedAt: number | null;
  lastAssessment: CareAssessment | null;
  /** Null before the first survey — cadence starts at intake — and null on a
   *  CLOSED record, where nobody is going to do the review. */
  nextReviewDue: number | null;
  /** WHY there is no next review, when there isn't one. The two reasons read
   *  completely differently and a null date alone cannot tell them apart:
   *  "starts at the first survey" on a closed record with two surveys on file
   *  contradicts the history printed directly beneath it. */
  reviewClock: "scheduled" | "not-started" | "closed";
}

/** The action slot's payload. Generic slot, specific consumer — see
 *  care-task-region.tsx for how the region orders more than one open task. */
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
/** TODO-COPY.
 *
 *  "mentorship signal" IS FORWARD-LOOKING, BY DECISION. Nothing in this codebase
 *  computes one — which is exactly why AI_SUMMARY_LIMITATION was narrowed to
 *  "survey history" alone. This label keeps the wider wording on the user's
 *  explicit call ("keep verbatim — we will build the signal later"), so it is a
 *  known and accepted overstatement rather than an oversight. Do not narrow it
 *  without asking; do widen the inputs when the signal lands. */
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
  // The newest survey that was SENT and hasn't come back. Only meaningful while
  // nothing has been completed after it.
  const sent = events
    .filter((e) => e.type === "survey_assigned")
    .sort((a, b) => b.occurredAt - a.occurredAt)[0];
  const outstandingSurvey =
    sent && (!latest || sent.occurredAt > latest.occurredAt)
      ? { instrument: sent.description, sentAt: sent.occurredAt }
      : null;
  // A CLOSED record gets no review clock. Without this the three past-mentee
  // records read "overdue by 2 months" for a review nobody is going to do, and
  // an overdue warning on a mentorship that ended is noise dressed as a task.
  const closed = isClosedRecord(teenId);

  if (!latest) {
    // Pre-first-survey: cadence hasn't started. Not an error state — the common
    // one, through the PRD's "snooze" period. A record with an outstanding
    // survey lands here too, and says so rather than reading blank.
    return {
      outstandingSurvey,
      stage: "intake",
      assignedSurvey: null,
      surveyLockedAt: null,
      lastAssessment: null,
      nextReviewDue: null,
      reviewClock: closed ? "closed" : "not-started",
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
  const nextReviewDue = closed
    ? null
    : dueOffset !== null
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
    outstandingSurvey,
    stage,
    reviewClock: closed ? "closed" : "scheduled",
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
/** The teen's assessment scores on the LOCKED instrument, oldest → newest.
 *
 *  Single-instrument by construction: PHQ-9 tops out at 27 and GAD-7 at 21, so a
 *  mixed series would put two scales on one line. The locked instrument is the
 *  one `cadenceFor` reports, so the sparkline and the Last assessment chip
 *  beside it are always describing the same measurement. */
/** ═══ THE WEIGHTED AVERAGE ON RECORD, INDEPENDENT OF A PENDING REVIEW ═══
 *
 *  R6 gives the presentation card a `Weighted Avg` cell, and the brief requires it
 *  to reconcile with the review card's Weighted column and the attention strip.
 *  The review card gets its number from `pendingReviewFor(...).aggregate` — but
 *  the presentation card renders on EVERY record, including the many with no
 *  review pending, and a cell that reads "—" on a teen with five surveys would be
 *  hiding the row's most useful number behind an unrelated condition.
 *
 *  So the value is derived from the record itself, by the same rule: the locked
 *  instrument's most recent comparable surveys, newest first, through
 *  `weightedAggregate`. One ratio, one instrument rule, one rounding — which is
 *  what makes the two cells agree rather than merely look similar. Asserted in
 *  `record-scenarios.test.ts`.
 *
 *  INSTRUMENT SELECTION IS `scoreSeriesFor`'s, deliberately: the most recent
 *  assessment's instrument, so the axis, the series and this number all lock to
 *  the same one. `null` when there are fewer than two comparable readings, which
 *  is the cell's "—" state and not an error. */
export function weightedNowFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): { score: number; severity: string; surveys: CareAssessment[] } | null {
  const assessments = careTimelineFor(teenId, now, store)
    .filter((e) => e.type === "assessment")
    // NEWEST FIRST — `weightedAggregate` documents the ordering as the caller's.
    .sort((a, b) => b.occurredAt - a.occurredAt);
  if (assessments.length === 0) return null;
  const instrument = assessments[0].description;
  const surveys: CareAssessment[] = assessments
    .filter((e) => e.description === instrument)
    .map((e) => {
      const score = (e.items ?? []).reduce((a, i) => a + i.points, 0);
      return {
        instrument,
        at: e.occurredAt,
        score,
        severity: severityFor(instrument as "PHQ-9" | "GAD-7", score),
        items: e.items ?? [],
      };
    });
  return weightedAggregate(surveys);
}

export function scoreSeriesFor(
  teenId: string,
  now: number,
  store: CareStoreSlice = {}
): { instrument: string; scores: number[] } | null {
  const assessments = careTimelineFor(teenId, now, store)
    .filter((e) => e.type === "assessment")
    .sort((a, b) => a.occurredAt - b.occurredAt);
  if (assessments.length === 0) return null;
  const instrument = assessments[assessments.length - 1].description;
  const scores = assessments
    .filter((e) => e.description === instrument)
    .map((e) => (e.items ?? []).reduce((a, i) => a + i.points, 0));
  return { instrument, scores };
}

/** ═══ R6: RELATIVE TIME ONLY, AND A NARROWER URGENT WINDOW ═══
 *
 *  The Figma composition puts a bare relative time in the Next review cell — no
 *  pill, no "due in" preamble, no absolute-date sub-line (both the date and the
 *  review type move into that cell's tooltip). So the label IS the duration, and
 *  the framing that used to ride in front of it is gone.
 *
 *  THE WARNING WINDOW TIGHTENS FROM 14 DAYS TO 7. A fortnight of warning tone
 *  meant most records with a scheduled review rendered urgent, which is the same
 *  as none of them doing so.
 *
 *  `overdue` IS RETURNED RATHER THAN PARSED. The scenario suite used to test this
 *  with `label.startsWith("overdue")`, and its own module note says why that is
 *  the wrong shape: "parsing prose is how a test ends up agreeing with a typo".
 *  One copy change would have made that assertion silently vacuous.
 *
 *  CHANGED IN PLACE, NOT FORKED: this helper has exactly one non-test consumer
 *  (the presentation card's cell), so there is no second countdown to disagree
 *  with. TODO-COPY on every string. */
export function reviewDueState(
  dueAt: number,
  now: number
): { tone: "neutral" | "warning"; label: string; overdue: boolean; days: number } {
  const days = Math.round((dueAt - now) / DAY);
  if (days < 0)
    return { tone: "warning", label: `Overdue · ${elapsed(-days)}`, overdue: true, days };
  if (days === 0) return { tone: "warning", label: "Due today", overdue: false, days };
  return {
    tone: days <= URGENT_WITHIN_DAYS ? "warning" : "neutral",
    label: elapsed(days),
    overdue: false,
    days,
  };
}

/** The brief's window: "due within 7 days or overdue". Named so the cell and this
 *  helper cannot drift apart on what "urgent" means. */
export const URGENT_WITHIN_DAYS = 7;

/** ═══ DAYS, THEN MONTHS — NO WEEKS STEP ═══
 *
 *  The composition asks for "45 days" and "3 months", which means days have to
 *  survive well past the fortnight where the previous rollup switched to weeks.
 *  60 days is the changeover: two months is the point where a day count stops
 *  being a thing anyone counts.
 *
 *  This DIVERGES from `relJoined`'s steps, which the old version was written to
 *  match. That is deliberate and one-directional: a tenure ("196 days in
 *  mentorship") is a fact about the past that reads naturally in days for a long
 *  time, while a countdown is something a supervisor plans around. They are
 *  different questions and the composition treats them differently. */
function elapsed(days: number): string {
  if (days === 1) return "1 day";
  if (days <= 60) return `${days} days`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 month" : `${months} months`;
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
  // F32.1, not F33.0: `severity` and `code` sat in ONE object literal saying
  // different things — "moderate" beside a statement ending "mild". Single
  // episode as well as moderate, because this is one assessment 48 days in and
  // nothing on the record describes a prior episode to recur from.
  t8: { daysAgo: 48, instrument: "PHQ-9", score: 11, severity: "moderate", items: PHQ9_SCORE_11, code: "F32.1" },
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
  // A CLOSED record never carries a proposal. Asking a supervisor to approve a
  // billing code for a mentorship that ended is a task with no outcome, and the
  // slot's whole contract is that something in it needs deciding.
  if (isClosedRecord(teenId)) return null;
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
        // MODERATE, not F33.0. The rationale directly below says the scores rose
        // INTO the moderate band and the aggregate underneath states
        // `severity: "moderate"` — a mild code was the one thing on this card
        // that nothing else on it supported.
        statement: STATEMENT_OF["F33.1"],
        code: "F33.1",
      },
      rationale: {
        source: "ai",
        // The contact sentence is GONE: nothing computes message cadence, and an
        // AI-labelled rationale asserting it contradicts the provenance line
        // that now says survey history only.
        text: "Across the last three assessments the mood items have risen from the mild band into the moderate band, while the items that carried the anxiety presentation have not moved. The recurrent-depression presentation fits the current scores more closely than the one on record.",
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
  // Roster-wide profiles, built from the teen's own latest assessment.
  return live(profileReviewFor(teenId, now, stage));
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
// THE PROSE SCAFFOLDING THIS ONCE CARRIED IS RETIRED. Three Figma prompts drove
// both the compose template and the read structure; the care update is now a
// structured clinical form instead, because it also has to be the documentation
// artifact for a presentation event. The retired prompts are recorded in
// design-system-gaps.md row 298 rather than quoted here — the grep for them has
// to come back empty.

/** THE CARE UPDATE IS NOW A STRUCTURED CLINICAL FORM.
 *
 *  It replaced three Figma prose prompts (recorded in design-system-gaps.md row
 *  298, not quoted here so the grep for them stays empty). They were good
 *  clinical writing structure but were not the documentation artifact a
 *  presentation event needs. The care update is
 *  now the SINGLE documentation artifact for every presentation event — there is
 *  no second note object — so its fields have to carry the clinical reasoning and
 *  the diagnostic justification, not a narrative.
 *
 *  TWO PROSE SECTIONS plus one structured value. The prose sections are a list so
 *  the form, the main-column view and the timeline iterate the same source and
 *  cannot disagree about order or labels. The assessment is NOT in the list: it is
 *  a three-state single-select, rendered as a chip rather than a paragraph, and a
 *  renderer that treated it as prose would print a bare word under a heading. */
export const CARE_UPDATE_SECTIONS = [
  {
    id: "clinical",
    label: "Clinical summary", // TODO-COPY
    helper:
      // TODO-COPY
      "Description of current clinical presentation, including any new/recent symptom progression or regression.",
  },
  {
    id: "diagnostic",
    label: "Diagnostic support statement", // TODO-COPY
    helper:
      // TODO-COPY
      "Symptom evidence supporting the diagnosis (or, if changed, evidence supporting the updated diagnosis).",
  },
] as const;

export type CareUpdateSectionId = (typeof CARE_UPDATE_SECTIONS)[number]["id"];

/** THE THIRD FIELD'S LABEL, kept beside the other two so a renderer laying out
 *  "the three fields in order" has one source for all three. */
export const CARE_UPDATE_ASSESSMENT_LABEL = "Assessment of symptoms"; // TODO-COPY

/** THE THREE-STATE ASSESSMENT.
 *
 *  ═══ A REPORTED VOCABULARY COLLISION, IMPLEMENTED AS SPECIFIED ═══
 *
 *  "Escalated" collides with "Escalation", the SAFETY EVENT TYPE on this same
 *  page (`CareEventType` carries `escalation` and `risk_flag`, and the record has
 *  escalation workflows). A reader scanning a history sees the same word meaning
 *  two unrelated things: a symptom trend, and a safety event.
 *
 *  The collision was reported with "Worsened" recommended as a no-cost fix, and
 *  the product owner chose to keep "Escalated". Recorded here rather than
 *  silently accepted, because the ambiguity is now a property of the vocabulary
 *  and the next person to read a history row deserves to know it was deliberate.
 *  design-system-gaps.md row 298. */
export type CareUpdateAssessment = "escalated" | "maintained" | "improved";

export const CARE_UPDATE_ASSESSMENTS = [
  { value: "escalated", label: "Escalated" }, // TODO-COPY
  { value: "maintained", label: "Maintained" }, // TODO-COPY
  { value: "improved", label: "Improved" }, // TODO-COPY
] as const satisfies ReadonlyArray<{
  value: CareUpdateAssessment;
  label: string;
}>;

export const ASSESSMENT_LABEL: Record<CareUpdateAssessment, string> =
  Object.fromEntries(
    CARE_UPDATE_ASSESSMENTS.map((a) => [a.value, a.label])
  ) as Record<CareUpdateAssessment, string>;

export interface CareUpdateBody {
  clinical: string;
  diagnostic: string;
  /** `null` until chosen. The form requires it; null is "not answered yet", NOT
   *  a fourth state, and nothing renders a null assessment. */
  assessment: CareUpdateAssessment | null;
}

export function emptyCareUpdateBody(): CareUpdateBody {
  return { clinical: "", diagnostic: "", assessment: null };
}

/** WAS THE AI'S DRAFT ACTUALLY REVISED? — the highest-consequence fact on this
 *  page, and the reason this is stored rather than inferred.
 *
 *  A diagnostic justification drafted by a model and then signed by a supervisor
 *  is indistinguishable, once saved, from one they wrote — unless whether they
 *  changed a word is recorded at the moment of saving. It cannot be recovered
 *  afterwards. So the pre-filled text is captured alongside the saved text and
 *  the comparison is stored, not recomputed.
 *
 *  `source` mirrors `PresentationReview.rationale.source`, so the provenance
 *  label on the field and on the history row is DERIVED from the same value that
 *  labelled the rationale — never a second string that could drift from it. */
/** ═══ PER-FIELD PROVENANCE ON THE COMMITTED RECORD (C4) ═══
 *
 *  Immutable once written. An amendment is its own record and carries its OWN
 *  provenance for its OWN text — it does not inherit the original's, because a
 *  supervisor rewriting a paragraph by hand over an AI-assisted one has authored
 *  the correction whatever the thing it corrects was.
 *
 *  ═══ THE BACKEND CONTRACT ═══
 *
 *  The wire names are `clinical_summary_provenance` and
 *  `diagnostic_support_provenance`, each one of `authored | ai_inserted |
 *  ai_assisted`, written at commit and never updated. The TS fields below are
 *  camelCase per this codebase; the mapping is 1:1 and there is no third state
 *  to add later — `authored` is the absence of AI, not a fourth kind of it.
 *
 *  ABSENT MEANS AUTHORED, and that is deliberate rather than lazy: every record
 *  written before this field existed was written with a prefilled AI draft that
 *  nobody attributed, so a missing value cannot honestly be read as "no AI".
 *  It is read as `authored` because that is the state this schema can defend —
 *  see the known limitation on `field-provenance.ts`, which applies to the
 *  stored value exactly as it applies to the live one.
 *
 *  THE OLD `diagnosticPrefill` IS NOT REPLACED YET. It records a different
 *  thing (which source seeded the field, and whether the seed was edited) and
 *  is still written by the standalone modal. The two overlap and the older one
 *  should go once the read surfaces consume these; noted rather than removed
 *  mid-flight. */
export interface CareUpdateProvenance {
  clinicalProvenance?: FieldProvenance;
  diagnosticProvenance?: FieldProvenance;
}

export interface CareUpdatePrefill {
  source: "templated" | "ai" | "supervisor";
  /** True when the supervisor changed the pre-filled text before saving. */
  edited: boolean;
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
  /** THE PRESENTATION EVENT THIS UPDATE DOCUMENTS — a `CareEvent.id`.
   *
   *  Set when the update was committed through a presentation event (a cadence
   *  review or an ad-hoc change); absent on a standalone update. Deliberately a
   *  SEPARATE field from `amends`: that one means "corrects", this one means
   *  "documents", and collapsing them would make an amendment chain and a
   *  documentation link indistinguishable. */
  documents?: string;
  /** Present only when the diagnostic field arrived pre-filled. */
  diagnosticPrefill?: CareUpdatePrefill;
  /** C4. Absent = `authored`; see `CareUpdateProvenance`. */
  clinicalProvenance?: FieldProvenance;
  diagnosticProvenance?: FieldProvenance;
}

/** One body field, or "" when the stored record has no such key.
 *
 *  Returns the TRIMMED value, because every caller here is asking "is there text
 *  in this field" or "render this text" — and a field holding only whitespace
 *  should answer no to the first. */
function sectionText(u: CareUpdateRecord, id: CareUpdateSectionId): string {
  const raw = (u.body as Partial<Record<CareUpdateSectionId, unknown>>)[id];
  return typeof raw === "string" ? raw.trim() : "";
}

/** One care update as a timeline entry. The prose travels in `providerNote` so
 *  the timeline's existing disclosure renders it without a special case. */
function careUpdateToEvent(u: CareUpdateRecord): CareEvent {
  /** ═══ A STORED BODY IS UNTRUSTED INPUT, EVEN THOUGH WE WROTE IT ═══
   *
   *  This was `u.body[s.id].trim()`, and it threw
   *  `Cannot read properties of undefined (reading 'trim')` — taking down the
   *  ENTIRE person record, not just this row. The path is worth naming because
   *  it explains the blast radius: `PersonRecordPage` → `RecordTaskRegions`
   *  (the Overview tab's attention regions) → `alertsForTeen` → `cadenceFor` →
   *  `careTimelineFor` → here. A single malformed entry in `localStorage` and the
   *  record will not render at all, on any tab.
   *
   *  WHY A FIELD GOES MISSING: `body` is PERSISTED. Anything written by an
   *  earlier build outlives the code that wrote it, so a body stored before a
   *  section existed — or written partially — has no key for it. `CareUpdateBody`
   *  types the field as `string`, and TypeScript is describing what the CURRENT
   *  code writes, not what is already in the browser. A type is a claim about
   *  new data; it is not a guarantee about old data.
   *
   *  So the read tolerates it. `sectionText` is the only way this module touches
   *  a body field, so there is one place for the rule to live rather than a
   *  `?.` sprinkled at each use.
   *
   *  THIS IS THE READ HALF. The store's rehydrate repairs the record so the bad
   *  shape does not survive the session — see the care-update backfill there. */
  const filled = CARE_UPDATE_SECTIONS.filter((s) => sectionText(u, s.id));
  /** The row's outcome column names the FIELDS present, never their content —
   *  it is a row label, not a summary of clinical prose. The assessment is
   *  included because it is a structured value a reader can scan for. */
  const parts = [
    ...filled.map((s) => s.label),
    ...(u.body.assessment ? [ASSESSMENT_LABEL[u.body.assessment]] : []),
  ];
  return {
    id: `ce-cu-${u.id}`,
    occurredAt: u.createdAt,
    type: "care_update",
    // TODO-COPY. Names the SHAPE of what was written, never its content.
    description: u.amends ? "Care update amended" : "Care update written",
    result: parts.join(" · ") || "No fields filled", // TODO-COPY
    author: { kind: "person", name: u.author, role: u.authorRole },
    // Points at the amended update's EVENT id, so the chain renders both ways.
    amends: u.amends ? `ce-cu-${u.amends}` : undefined,
    visibility: "all_staff",
    // The prose travels here so the timeline's existing disclosure renders it
    // with no special case. The assessment does NOT: it is a structured value and
    // the timeline renders it as a chip from `body`, not as a line of text.
    // SAME GUARD AS ABOVE. `filled` already excludes the missing ones, so this
    // could not throw today — but it reads the raw body a second time, and the
    // next person to change the filter would have to notice that to keep it safe.
    // One accessor, used everywhere, is the property worth having.
    providerNote: filled
      .map((s) => `${s.label}\n${sectionText(u, s.id)}`)
      .join("\n\n"),
    documents: u.documents,
    diagnosticPrefill: u.diagnosticPrefill,
    assessment: u.body.assessment ?? undefined,
  };
}

/** Every care update on a teen, newest first — the fixtures plus whatever a
 *  supervisor has written in-session. Fixtures are unioned HERE rather than at
 *  the call site so the timeline, the "current update" card and any future
 *  reader can't disagree about which updates exist. */
export function careUpdatesFor(
  teenId: string,
  now: number,
  updates: CareUpdateRecord[]
): CareUpdateRecord[] {
  return [...fixtureCareUpdatesFor(teenId, now), ...updates]
    .filter((u) => u.teenId === teenId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** The one shown IN FULL beneath the presentation spine: the most recent update
 *  that nothing has superseded. Older ones live in the timeline — the main
 *  column carries the current clinical read, not an archive. */
export function latestCareUpdateFor(
  teenId: string,
  now: number,
  updates: CareUpdateRecord[]
): CareUpdateRecord | null {
  const mine = careUpdatesFor(teenId, now, updates);
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
  /** MOMENT DEEP LINKS — discussions the snapshot refers to.
   *
   *  THE LINK IS THE POINTER, NEVER THE CONTENT. `label` describes WHEN or WHAT
   *  the exchange was ("the check-in on Aug 18"), never a word of what was said.
   *  A reader who wants the words follows the link to the conversation surface,
   *  which is the only place message text ever renders.
   *
   *  Rendered as inline links with a small chat icon, beneath the narrative. Kept
   *  as structured data rather than markup inside `text` so the same summary can
   *  be rendered by a future feed with no parser. */
  moments?: { label: string; conversationWith: string }[];
}

/** TODO-COPY.
 *
 *  NARROWED FROM "survey history and mentorship activity". This function
 *  consumes `assessment` events and NOTHING ELSE — no message, contact or video
 *  data reaches it, and none exists in a shape it could use. On a page carrying a
 *  clinical diagnosis about a minor, a provenance line that overstates its own
 *  inputs is the worst possible thing to be wrong about: a reader who believes
 *  mentorship activity was weighed will read more into the sentence than the
 *  sentence knows. When contact data lands, widen this again — and not before. */
export const AI_SUMMARY_LIMITATION =
  "AI-generated from survey history, for context only — not a clinical determination.";

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
      // Same trim as t13's rationale — no contact data feeds this function.
      text: "Both intake instruments scored in the mild-to-moderate range, with the sleep items the highest across them, and the sleep items are the ones that have not moved since.",
      // TODO-DATA. Two moments, so the deep-link pattern is visible rather than
      // theoretical. Labels name WHEN, never WHAT — see the field comment.
      moments: [
        { label: "the check-in after the second survey", conversationWith: "t15" },
        { label: "the exchange the week the sleep items rose", conversationWith: "t15" },
      ],
    };
  }
  if (teenId === "t13") {
    return {
      generatedAt,
      text: "Scores across three assessments have moved from the mild band into the moderate band, with the mood items accounting for most of the change and the anxiety items flat. Contact has stayed weekly through the period with no gap longer than nine days.",
      moments: [
        { label: "the discussion that led to the escalation", conversationWith: "t13" },
        { label: "the check-in two weeks before it", conversationWith: "t13" },
      ],
    };
  }
  // DERIVED, not asserted. This used to return "scores have held in the same
  // band across the period" for every teen with two or more assessments — a
  // claim it never checked, which contradicts any record whose scores actually
  // moved. Same discipline as the score/items invariant: if the paragraph and
  // the timeline can disagree, sooner or later they do.
  const ordered = assessments.sort((a, b) => a.occurredAt - b.occurredAt);
  const sum = (e: CareEvent) => (e.items ?? []).reduce((a, i) => a + i.points, 0);
  const first = sum(ordered[0]);
  const last = sum(ordered[ordered.length - 1]);
  const bandFirst = ordered[0].result.split("—").pop()!.trim();
  const bandLast = ordered[ordered.length - 1].result.split("—").pop()!.trim();
  const n = ordered.length;
  const sameBand = bandFirst === bandLast;
  // TODO-COPY. Names what the scores DID and nothing else — no forecast, and no
  // reference to anything anyone wrote.
  const movement =
    last === first
      ? `Scores have returned the same total across ${n} assessments on file`
      : sameBand
        ? `Scores have moved ${last > first ? "up" : "down"} from ${first} to ${last} across ${n} assessments, staying inside the ${bandLast} band`
        : `Scores have moved ${last > first ? "up" : "down"} from ${first} to ${last} across ${n} assessments, out of the ${bandFirst} band and into the ${bandLast} one`;
  // The trailing "mentorship contact has continued" clause is GONE with it: it
  // was an unsourced claim about data this function never sees.
  return { generatedAt, text: `${movement}.` };
}

// ── COMMITTED CARE SUMMARIES AS HISTORY ─────────────────────────────────────
//
// A committed summary is a record entry, so it renders in History like every
// other entry — same table, same disclosure, no special surface. What it must
// NOT do is restate its findings as the record's own claims: the row names the
// call the document made and the counts behind it, and the document itself
// remains the place those are argued.

const COMMIT_TIER_LABEL: Record<RiskTier | "unassigned", string> = {
  imminent: TIER_LABEL.imminent,
  clinicalReview: TIER_LABEL.clinicalReview,
  generalMonitoring: TIER_LABEL.generalMonitoring,
  // TODO-COPY. `TIER_LABEL` has no entry: "unassigned" is the absence of a
  // tier rather than one of them, and the taxonomy is right not to name it.
  unassigned: "Untiered",
};

/** TODO-COPY. The CALL, not a verdict on the teen. */
const COMMIT_RESULT_LABEL: Record<ConcordanceResult, string> = {
  diverges: "Content diverges from code",
  concordant: "Concordant",
  insufficientData: "Insufficient data",
};

function summaryCommitToEvent(c: CareSummaryCommit): CareEvent {
  const markers = (Object.entries(c.markerCounts) as [
    RiskTier | "unassigned",
    number,
  ][])
    .filter(([, n]) => n > 0)
    .map(([tier, n]) => `${n} ${COMMIT_TIER_LABEL[tier].toLowerCase()}`);

  return {
    id: c.id,
    occurredAt: c.committedAt,
    type: "care_summary",
    // TODO-COPY. "Committed", not "generated": the generation is not the event,
    // the entering-into-the-record is.
    description: c.firstCycle
      ? "Care summary committed — first cycle"
      : "Care summary committed",
    // The outcome column carries the call and nothing softer. A row reading
    // "Summary committed" would tell a reader scanning History nothing about
    // why they might want to open it.
    result: COMMIT_RESULT_LABEL[c.concordance],
    // NOT ATTRIBUTED TO A PERSON. Nobody wrote this; it was derived, and putting
    // the approving supervisor's name in the author column would credit them
    // with authorship of evidence they only read. The system author kind is what
    // the provenance line inside the document says too.
    author: { kind: "system" },
    code: c.code ?? undefined,
    visibility: "all_staff",
    // ── THE DISCLOSURE, AS FROZEN FACTS ──
    // Every line is a value recorded at commit time. No trajectory sentence, no
    // themes prose, no restatement of the divergence argument: those live in the
    // document, which is where they can carry their provenance labels. TODO-COPY.
    providerNote: [
      `Window\n${fmtDay(c.windowFromAt)} – ${fmtDay(c.windowToAt)}`,
      `Contact days\n${c.contactDays}`,
      // "7/9" — the count and its denominator together, which is the only form
      // a theme count can be read in. `conversationDays` is null only when the
      // theme element refused, and then `themes` is empty and this line is gone.
      c.themes.length
        ? `Themes\n${c.themes
            // THE LABEL IS RESOLVED, NOT STORED. A committed summary holds tag
            // ids; the canonical label comes from the taxonomy at render, so a
            // copy change reaches an already-committed summary too.
            .map((t) => `${tagLabel(t.tagId)} ${t.days}/${c.conversationDays}`)
            .join(" · ")}`
        : null,
      markers.length ? `Flags in window\n${markers.join(" · ")}` : null,
    ]
      .filter((line): line is string => line !== null)
      .join("\n\n"),
    documentedBy: c.documents,
  };
}

/** Local day formatter — the timeline's own date rendering governs the primary
 *  column; this is disclosure text, which is prose and needs a readable date. */
const fmtDay = (at: number) =>
  new Date(at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
