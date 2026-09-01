// ═══════════════════════════════════════════════════════════════════════════
// PROTOTYPE FIXTURES — NOT PRODUCT DATA, NOT A DATA MODEL.
// ═══════════════════════════════════════════════════════════════════════════
//
// Everything in this file is invented. Review documents, survey instruments and
// chat exchanges have no source system yet, and the Activity pane needs all
// three to be demonstrable. They live HERE, in one module, rather than as string
// literals scattered through the components that render them.
//
// ═══ WHY ONE MODULE ═══
//
// Invented strings spread across components are the way a prototype starts
// contradicting itself: one component says a review was written by a supervisor
// and another says a lead mentor; a survey shows nine items in one place and
// seven in another. Collected here, an inconsistency is visible while reading a
// single file, and the components stay about rendering.
//
// It also marks the boundary. Anything importing this module is displaying
// fabricated content, and that is greppable.
//
// ═══ THE INSTRUMENTS ARE REAL; THE RESPONSES ARE NOT ═══
//
// PHQ-9, GAD-7 and WHO-5 item wordings are the published instruments — a
// prototype that shows a supervisor a screen labelled "PHQ-9" and then lists
// nine invented questions is teaching the wrong thing about a tool they will
// actually use. The SCORES and the item-level answers are fabricated.
//
// NO CLINICAL CONTENT IS PUT IN A TEEN'S MOUTH beyond what the event already
// claims. The chat fixtures are ordinary check-in conversation; where an event
// carries a flagged line, that line is the event's own string.

import type { ActivityEvent } from "@/lib/activity/events";

// ─────────────────────────────────────────────────────────────────────────────
// 1 · CODE SYSTEMS
// ─────────────────────────────────────────────────────────────────────────────

/** ═══ ICD-10 AND HCPCS ARE DIFFERENT SYSTEMS (brief item 12) ═══
 *
 *  The seed used to draw `code` from `["F41.1", "F33.0", "F33.1", "F90.0",
 *  "H0038"]` and `previousCode` from F-codes only, so a row could read
 *  "F32.9 → H0038". F-codes are ICD-10 DIAGNOSES; H0038 is an HCPCS SERVICE
 *  code ("self-help/peer services, per 15 minutes"). A diagnosis does not become
 *  a service code, and a code CHANGE has to stay inside one system or it is not
 *  a change — it is a category error rendered with an arrow through it.
 *
 *  Both sides of a billing review's before/after now come from `ICD10`. The
 *  service code is kept, separately and unused by the change fixture, because it
 *  is genuinely part of this product's billing story — it just is not the thing
 *  a presentation review revises. */
export const ICD10 = [
  { code: "F41.1", label: "Generalized anxiety disorder" },
  { code: "F41.9", label: "Anxiety disorder, unspecified" },
  { code: "F32.9", label: "Major depressive disorder, single episode, unspecified" },
  { code: "F33.0", label: "Major depressive disorder, recurrent, mild" },
  { code: "F33.1", label: "Major depressive disorder, recurrent, moderate" },
  { code: "F90.0", label: "ADHD, predominantly inattentive type" },
] as const;

/** HCPCS — the SERVICE line, not a diagnosis. Not interchangeable with the
 *  above, and deliberately not part of any before/after pair. */
export const HCPCS = [
  { code: "H0038", label: "Self-help/peer services, per 15 minutes" },
] as const;

export function codeLabel(code: string): string | null {
  return (
    ICD10.find((c) => c.code === code)?.label ??
    HCPCS.find((c) => c.code === code)?.label ??
    null
  );
}

/** Which system a code belongs to. Used by the pane to label a code rather than
 *  leaving a reader to infer it, and by the fixture assertions. */
export function codeSystem(code: string): "ICD-10" | "HCPCS" | "unknown" {
  if (ICD10.some((c) => c.code === code)) return "ICD-10";
  if (HCPCS.some((c) => c.code === code)) return "HCPCS";
  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · SURVEY INSTRUMENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface Instrument {
  id: "PHQ-9" | "GAD-7" | "WHO-5";
  name: string;
  /** What the score means, in the direction the instrument runs. WHO-5 runs the
   *  OPPOSITE way to the other two — higher is better — and a pane that shows a
   *  rising WHO-5 with a worsening tint would be actively misleading. */
  direction: "higher-is-worse" | "higher-is-better";
  max: number;
  items: string[];
  /** The published severity bands. */
  bands: Array<{ upTo: number; label: string }>;
}

const PHQ9_ITEMS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure, or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed — or being so fidgety or restless that you have been moving a lot more than usual",
  "Thoughts that you would be better off dead, or of hurting yourself in some way",
];

const GAD7_ITEMS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid, as if something awful might happen",
];

const WHO5_ITEMS = [
  "I have felt cheerful and in good spirits",
  "I have felt calm and relaxed",
  "I have felt active and vigorous",
  "I woke up feeling fresh and rested",
  "My daily life has been filled with things that interest me",
];

export const INSTRUMENTS: Record<Instrument["id"], Instrument> = {
  "PHQ-9": {
    id: "PHQ-9",
    name: "Patient Health Questionnaire-9",
    direction: "higher-is-worse",
    max: 27,
    items: PHQ9_ITEMS,
    bands: [
      { upTo: 4, label: "Minimal" },
      { upTo: 9, label: "Mild" },
      { upTo: 14, label: "Moderate" },
      { upTo: 19, label: "Moderately severe" },
      { upTo: 27, label: "Severe" },
    ],
  },
  "GAD-7": {
    id: "GAD-7",
    name: "Generalized Anxiety Disorder-7",
    direction: "higher-is-worse",
    max: 21,
    items: GAD7_ITEMS,
    bands: [
      { upTo: 4, label: "Minimal" },
      { upTo: 9, label: "Mild" },
      { upTo: 14, label: "Moderate" },
      { upTo: 21, label: "Severe" },
    ],
  },
  "WHO-5": {
    id: "WHO-5",
    name: "WHO-5 Well-Being Index",
    // HIGHER IS BETTER. The one instrument here that runs the other way, and the
    // reason `direction` exists rather than the trend strip assuming a sign.
    direction: "higher-is-better",
    max: 25,
    items: WHO5_ITEMS,
    bands: [
      { upTo: 12, label: "Low well-being" },
      { upTo: 25, label: "Adequate well-being" },
    ],
  },
};

export function bandFor(instrumentId: string, score: number): string | null {
  const inst = INSTRUMENTS[instrumentId as Instrument["id"]];
  if (!inst) return null;
  return inst.bands.find((b) => score <= b.upTo)?.label ?? null;
}

/** Is a move in this instrument an improvement? Returns null for no change, so
 *  a caller can render "unchanged" rather than picking a direction. */
export function isImprovement(
  instrumentId: string,
  from: number,
  to: number
): boolean | null {
  if (from === to) return null;
  const inst = INSTRUMENTS[instrumentId as Instrument["id"]];
  if (!inst) return null;
  return inst.direction === "higher-is-worse" ? to < from : to > from;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · REVIEW DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewDocument {
  title: string;
  /** Paragraphs. Structure is the point — see `DocumentPreview`: a document that
   *  renders as one undifferentiated block reads as a paragraph, not an artifact. */
  paragraphs: string[];
}

/** ═══ CLINICAL PROSE, WRITTEN AS A SUPERVISOR WOULD ═══
 *
 *  Operational and specific: what the scores did, what the content supported,
 *  what the code becomes and why. No hedging filler, no reassurance, nothing
 *  addressed to the teen — this is a document one clinician writes for another
 *  and for an auditor.
 *
 *  Seeded by index rather than at random so a given event always previews the
 *  same document. */
const REVIEW_DOCUMENTS: ReviewDocument[] = [
  {
    title: "Presentation review",
    paragraphs: [
      "Three consecutive readings have held in the moderate band, with the most recent at 11. The prior code was assigned during a single-episode presentation; the pattern since does not support that framing.",
      "Conversation content over the window is consistent with a recurrent course: two distinct low periods separated by an interval of reported normal function, and no evidence of a first presentation.",
      "Coding to the recurrent, moderate descriptor. Next review at the standard 90-day cadence unless a reading moves a band.",
    ],
  },
  {
    title: "Presentation review",
    paragraphs: [
      "The most recent survey moved a band and the session content supports the change rather than contradicting it. Sleep and appetite items account for most of the movement; the mood items are unchanged.",
      "No risk content in the window. The mentor reports engagement is steady and the teen has kept the last four scheduled calls.",
      "Updating the code to match the current severity. No change to the review cadence.",
    ],
  },
  {
    title: "Presentation review",
    paragraphs: [
      "Scores have held within one point across the window and the presenting content is unchanged. There is no basis for a revision in either direction.",
      "Confirming the existing code. Documented here so the absence of a change is on the record as a decision rather than as an omission.",
    ],
  },
];

export function reviewDocumentFor(seed: number): ReviewDocument {
  return REVIEW_DOCUMENTS[Math.abs(seed) % REVIEW_DOCUMENTS.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · REVIEWER NOTES AND DISCUSSION
// ─────────────────────────────────────────────────────────────────────────────

/** Short, attributed, first-person. These are QUOTED in the pane, so they have
 *  to read as something a named person wrote rather than as system copy. */
export const REVIEWER_NOTES: string[] = [
  "Read the full thread before closing. The language is blunt but it is about a game, not about self-harm — the mentor had the context and handled it well.",
  "Escalated to the on-call lead at the time. Guardian was reached the same evening and confirmed the plan.",
  "Category was right, severity was not. Downgraded after reading the surrounding messages; leaving the flag on the record so the pattern is visible if it repeats.",
  "No further action. The teen raised it themselves and the mentor's response was appropriate.",
];

export function reviewerNoteFor(seed: number): string {
  return REVIEWER_NOTES[Math.abs(seed) % REVIEWER_NOTES.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · DERIVED HISTORY — FROM THE LEDGER, NOT FROM A NEW MODEL
// ─────────────────────────────────────────────────────────────────────────────

/** ═══ THE CODE HISTORY IS ALREADY IN THE EVENT STORE ═══
 *
 *  The ledger is append-only, so a teen's prior `BILLING_REVIEW_COMPLETE` events
 *  ARE their code history — there is no second model to build and no back-fill to
 *  write. This reads the events the scenario already holds.
 *
 *  UNFILTERED BY SCOPE ON PURPOSE, and the caller must not change that: the pane
 *  only ever renders this for a row that already passed the scope check, and
 *  re-deriving visibility here would put a second, weaker copy of rule 12 in a
 *  fixtures module. The data layer owns who can see what. */
export interface CodeChange {
  /** ISO, matching `ActivityEvent.occurredAt` — NOT an epoch. The event store
   *  stores strings, and converting here would mean two representations of the
   *  same instant travelling through the pane. */
  at: string;
  from: string | null;
  to: string;
  actorId: string;
}

export function codeHistoryFor(
  events: ActivityEvent[],
  teenId: string,
  /** ISO. Exclusive: the selected event is the pane's subject, so its own row
   *  belongs in the header rather than in its own history. */
  before: string
): CodeChange[] {
  const cutoff = new Date(before).getTime();
  return events
    .filter(
      (e) =>
        e.eventType === "BILLING_REVIEW_COMPLETE" &&
        e.objectId === teenId &&
        new Date(e.occurredAt).getTime() < cutoff &&
        typeof e.payload.code === "string"
    )
    .map((e) => ({
      at: e.occurredAt,
      from: typeof e.payload.previousCode === "string" ? e.payload.previousCode : null,
      to: e.payload.code as string,
      actorId: e.actorId,
    }))
    // Newest first — a code history is read backwards from what is in force now.
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/** The last N readings of one instrument for one teen, oldest first — the shape
 *  `TrendStrip` draws. Same source and same reasoning as `codeHistoryFor`. */
export interface Reading {
  /** ISO — see `CodeChange.at`. */
  at: string;
  score: number;
}

export function readingsFor(
  events: ActivityEvent[],
  teenId: string,
  instrument: string,
  /** ISO. INCLUSIVE: the selected survey is the current reading, and a trend
   *  that excluded it would emphasise the wrong number. */
  upTo: string,
  limit = 5
): Reading[] {
  const cutoff = new Date(upTo).getTime();
  return events
    .filter(
      (e) =>
        e.eventType === "SURVEY_COMPLETED" &&
        e.objectId === teenId &&
        e.payload.instrument === instrument &&
        new Date(e.occurredAt).getTime() <= cutoff &&
        typeof e.payload.score === "number"
    )
    // Oldest first, then the LAST five — the strip reads left to right in time.
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    .slice(-limit)
    .map((e) => ({ at: e.occurredAt, score: e.payload.score as number }));
}
