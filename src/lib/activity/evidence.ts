// EVENT EVIDENCE — what the Activity pane shows, and what it refuses to.
//
// ═══ THIS SUPERSEDES A12'S OBJECT INSPECTOR, AND THE REASONING IT WAS BUILT ON ═══
//
// A12 specified a summary of the row's OBJECT — four fields about the teen or the
// conversation — reasoning that a ledger row has no body behind it. That reasoning
// was wrong. Every event here acted on an artifact, and the artifact IS the body:
// a billing review has a code change and a review document, a survey has responses
// and a trend, a closed flag has a decision and the content it was about.
//
// So the pane answers "what was decided, on what basis" rather than "who is this
// teen" — which the record already answers, one click away, from every row.
//
// ═══ ABSENCE IS A RESULT, AND IT IS ENFORCED HERE ═══
//
// Three separate reasons this returns nothing, and none of them is a component's
// decision to make:
//
//  1. THE ROW IS DEGRADED. Standing rule 12: network-scope detail degradation is
//     enforced at the data layer. A degraded row has no `payload` at all, so there
//     is nothing to build evidence from and nothing a component could assemble —
//     which is the enforcement, rather than a check someone has to remember.
//
//  2. THE TYPE HAS NO EVIDENCE TO SHOW. Mentorship paused and matched carry a
//     reason and two names; the row's own third line already renders them, and a
//     pane would be that same string under an eyebrow. A presentation review's
//     sentence already carries its code and outcome. A pane that restates the row
//     it was opened from has not earned a column, so those types open none.
//
//  3. THE PAYLOAD IS THIN. A type that should have evidence but does not — a
//     billing row with no code — returns null rather than a pane of empty labels.
//
// ═══ FLAGGED CONTENT IS NOT PART OF THE EVIDENCE OBJECT ═══
//
// It is reachable only through `flaggedContentFor`, which logs. See the note there.

import type { ActivityEventType } from "@/lib/activity/events";
// `humaniseCategory` is exported from `query.ts` rather than duplicated: the
// underscored wire values have exactly one plain-language mapping, and a second
// copy is how "Hate speech racial slurs" and "Hate speech / racial slurs" end up
// on two surfaces.
import { humaniseCategory, type FeedRow } from "@/lib/activity/query";
import { recordFlaggedContentAccess } from "@/lib/activity/access-log";
import {
  INSTRUMENTS,
  bandFor,
  reviewDocumentFor,
  reviewerNoteFor,
} from "@/lib/activity/pane-fixtures";

/** Seeds a fixture per EVENT, so one row always previews the same document. The
 *  same shape the seed and the conversation fixtures use. */
/** ═══ THE OUTCOME WORD IS SENTENCE CASE, WHOEVER WROTE IT ═══
 *
 *  A risk flag's `decision` is stored "Closed"; an escalation's `outcome` is
 *  stored "referred". Both land in the same pill, so without normalising, one
 *  type's pill was capitalised and another's was not — on a surface whose voice
 *  is meant to be consistent, in the one element that carries the decision.
 *
 *  SENTENCE CASE, NOT TITLE CASE: "Guardian contacted" and "Safety plan agreed"
 *  are sentences about what happened, and title-casing them ("Guardian
 *  Contacted") would read as a status enum rather than as an outcome. */
function outcomeWord(raw: string): string {
  const t = raw.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** A labelled fact. Values are strings because the pane renders them — anything
 *  that needs formatting is formatted before it gets here, so the component never
 *  has to know what a code or a score is. */
export interface EvidenceFact {
  label: string;
  value: string;
}

/** ═══ ONE SHAPE PER EVENT TYPE (C3) ═══
 *
 *  C2 gave every type the same four fields — `facts`, an optional `body`, an
 *  optional `related` — and the pane rendered them in one order. That was the
 *  right thing while the primitives were being built, and it is the wrong thing
 *  now: a billing review's evidence is a code change, a document and a history; a
 *  survey's is a number in a series; a closed flag's is a judgement and the words
 *  it was about. Those are not the same shape wearing different labels.
 *
 *  A DISCRIMINATED UNION rather than a widening bag of optional fields. With
 *  optionals, "which of these does a survey have" is answerable only by reading
 *  the builder, and every renderer has to re-check; with a union the compiler
 *  answers it, and a new event type cannot be added without deciding what its
 *  evidence IS.
 *
 *  THE SHARED FIELDS ARE THE ONES EVERY PANE HAS REGARDLESS: what happened, how
 *  it came out, who it concerns, and the way to the record. */
export interface EvidenceBase {
  eventType: ActivityEventType;
  /** The pane's own heading. TODO-COPY. */
  title: string;
  /** The outcome word for the header pill — Active, Closed, Monitoring,
   *  Referred, Paused. Null for a type that has no outcome: a completed survey
   *  did not come out any way, and inventing "Done" would be filler in a pill
   *  whose whole job is to carry a real decision. */
  outcome: string | null;
  /** The persistent footer link every pane carries. */
  record: { href: string; label: string };
}

/** A labelled fact. Values are strings because the pane renders them — anything
 *  that needs formatting is formatted before it gets here, so the component never
 *  has to know what a code or a score is. */
export interface EvidenceFact {
  label: string;
  value: string;
}

export interface BillingEvidence extends EvidenceBase {
  kind: "billing";
  facts: EvidenceFact[];
  /** The code now in force, for the related-record card. */
  code: string;
  /** The review document. Multi-paragraph — see `reviewDocumentFor`. The seed's
   *  one-line `note` is used as the document's OPENING paragraph when present, so
   *  a supervisor's own sentence is never replaced by a fixture. */
  document: { title: string; paragraphs: string[] };
}

export interface SurveyEvidence extends EvidenceBase {
  kind: "survey";
  facts: EvidenceFact[];
  instrument: string;
  score: number;
  /** The instrument's items, for the response breakdown. Empty when the
   *  instrument is not one this prototype has an item set for — an unknown
   *  instrument shows its score and says nothing it cannot support. */
  items: string[];
  instrumentName: string | null;
  band: string | null;
}

export interface RiskFlagEvidence extends EvidenceBase {
  kind: "riskFlag";
  facts: EvidenceFact[];
  /** The reviewer's own words, with who wrote them. A quote without attribution
   *  on this surface is ambiguous in a way that matters: an unattributed sentence
   *  could be the reviewer's judgement or the teen's message. */
  reviewerNote: { text: string; attribution: string; meta: string } | null;
  hasFlaggedContent: boolean;
  conversationId?: string;
}

export interface EscalationEvidence extends EvidenceBase {
  kind: "escalation";
  facts: EvidenceFact[];
  notes: { text: string; attribution: string; meta: string } | null;
}

export type EventEvidence =
  | BillingEvidence
  | SurveyEvidence
  | RiskFlagEvidence
  | EscalationEvidence;

/** ═══ THE TYPES THAT OPEN NO PANE, AS A LIST RATHER THAN A DEFAULT ═══
 *
 *  Written out so adding an event type is a decision rather than an omission: a
 *  new type falls through to `null` below and shows no pane until someone puts it
 *  in the switch, which is the safe direction. */
export const NO_PANE_TYPES: ActivityEventType[] = [
  // Reason + actor + effective date, and the row's line 3 already reads
  // "Paused · exams". A pane would be the same string under an eyebrow.
  "TEEN_PAUSED",
  "TEEN_MATCHED",
  "TEEN_DEACTIVATED",
  // The sentence already carries the code and the outcome.
  "PRESENTATION_REVIEW_COMPLETE",
  // An opened or overdue item has no decision yet. The pane is about what was
  // DECIDED, and "pending" is not a decision — the worklist is where an open
  // item gets acted on.
  "BILLING_REVIEW_OPENED",
  "BILLING_REVIEW_OVERDUE",
  "RISK_FLAG_RAISED",
  "RISK_FLAG_OVERDUE",
  "ESCALATION_RAISED",
  "ESCALATION_OVERDUE",
];

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

/** TODO-COPY on every label and title below. */
export function eventEvidenceFor(row: FeedRow): EventEvidence | null {
  // ── 1 · DEGRADATION. No payload, no evidence. Rule 12's enforcement point.
  if (row.degraded || !row.payload) return null;
  // ── 2 · A GROUP has no single artifact: its members disagree about the code,
  //        the score, the decision. Expanding the group is the way in.
  if (row.eventIds.length > 1) return null;
  // ── 3 · TYPES THAT OPEN NO PANE.
  if (NO_PANE_TYPES.includes(row.eventType)) return null;

  const p = row.payload;
  const teenHref = `/admin/person/${row.groupObjectId}?tab=care`;

  switch (row.eventType) {
    // ═══ BILLING · a code change, its reasoning, and what it applies to ═══
    case "BILLING_REVIEW_COMPLETE": {
      const code = str(p.code);
      if (!code) return null;
      const previous = str(p.previousCode);
      const doc = reviewDocumentFor(hashOf(row.id));
      const note = str(p.note);
      return {
        kind: "billing",
        eventType: row.eventType,
        title: "Billing review",
        // THE STATUS IS THE OUTCOME — the code took effect, which is what a
        // completed review comes out as.
        outcome: outcomeWord(str(p.status) ?? "Active"),
        code,
        facts: [
          // THE CHANGE, NOT JUST THE RESULT. "F41.9 → F41.1" is the decision;
          // "F41.1" alone is the state, and the state is on the row already.
          { label: "Code", value: previous ? `${previous} → ${code}` : code },
          {
            label: "Approved by",
            value: row.actorIsSelf ? "You" : `${row.actorName} · ${row.actorRole}`,
          },
          { label: "When", value: row.absolute },
        ],
        /** ═══ THE SUPERVISOR'S OWN SENTENCE LEADS ═══
         *  The seed carries a one-line `note` — a real thing someone wrote — and
         *  the fixture carries the multi-paragraph structure a document needs.
         *  The note goes FIRST and the fixture continues it, so the prose a
         *  reviewer actually typed is never replaced by invented text; it is
         *  given a document to sit in. Where there is no note, the fixture stands
         *  alone. */
        document: {
          title: doc.title,
          paragraphs: note ? [note, ...doc.paragraphs.slice(1)] : doc.paragraphs,
        },
        record: { href: teenHref, label: "Open the full billing record" },
      };
    }

    // ═══ SURVEY · a number that only means something in a series ═══
    case "SURVEY_COMPLETED": {
      const instrument = str(p.instrument);
      const score = num(p.score);
      if (!instrument || score === undefined) return null;
      const inst = INSTRUMENTS[instrument as keyof typeof INSTRUMENTS];
      return {
        kind: "survey",
        eventType: row.eventType,
        title: "Survey",
        /** NO OUTCOME PILL. A completed survey did not come out any way — the
         *  BAND is a reading of the score, not a decision anybody took, and
         *  putting it in the pill would make a measurement look like a judgement
         *  beside four types where the pill genuinely is one. It renders in the
         *  trend strip instead, next to the number it describes. */
        outcome: null,
        instrument,
        instrumentName: inst?.name ?? null,
        score,
        band: bandFor(instrument, score),
        items: inst?.items ?? [],
        facts: [
          { label: "Instrument", value: instrument },
          { label: "Completed", value: row.absolute },
        ],
        record: { href: teenHref, label: "Open the survey history" },
      };
    }

    // ═══ RISK FLAG · a judgement, and the words it was about ═══
    case "RISK_FLAG_CLOSED": {
      const cats = (Array.isArray(p.categories) ? p.categories : []).filter(
        (c): c is string => typeof c === "string"
      );
      const decision = str(p.decision);
      if (!decision && cats.length === 0) return null;
      const note = str(p.reviewerNotes) ?? reviewerNoteFor(hashOf(row.id));
      return {
        kind: "riskFlag",
        eventType: row.eventType,
        title: "Risk flag",
        // THE DECISION IS THE OUTCOME, and it is already one of the pill's words.
        outcome: outcomeWord(decision ?? "Closed"),
        facts: [
          ...(cats.length
            ? [{ label: "Category", value: cats.map(humaniseCategory).join(", ") }]
            : []),
          {
            label: "Closed by",
            value: row.actorIsSelf ? "You" : `${row.actorName} · ${row.actorRole}`,
          },
          { label: "When", value: row.absolute },
        ],
        reviewerNote: {
          text: note,
          // WHO WROTE IT. The pane already names the actor in a metadata row, and
          // repeating it here is the point: on a quote, attribution is not
          // redundancy — it is what separates the reviewer's judgement from the
          // teen's message two sections below.
          attribution: row.actorIsSelf ? "You" : row.actorName,
          meta: row.actorIsSelf ? row.absolute : `${row.actorRole} · ${row.absolute}`,
        },
        hasFlaggedContent: !!str(p.flaggedExcerpt),
        conversationId: str(p.conversationId) ?? undefined,
        record: { href: teenHref, label: "Open the full record" },
      };
    }

    // ═══ ESCALATION · an outcome and what was said ═══
    case "ESCALATION_CLOSED": {
      const outcome = str(p.outcome);
      if (!outcome) return null;
      const notes = str(p.notes);
      return {
        kind: "escalation",
        eventType: row.eventType,
        title: "Escalation",
        outcome: outcomeWord(outcome),
        facts: [
          {
            label: "Closed by",
            value: row.actorIsSelf ? "You" : `${row.actorName} · ${row.actorRole}`,
          },
          { label: "When", value: row.absolute },
        ],
        notes: notes
          ? {
              text: notes,
              attribution: row.actorIsSelf ? "You" : row.actorName,
              meta: row.actorIsSelf
                ? row.absolute
                : `${row.actorRole} · ${row.absolute}`,
            }
          : null,
        record: { href: teenHref, label: "Open the escalation record" },
      };
    }
  }

  // A type not handled above opens no pane — see NO_PANE_TYPES' note.
  return null;
}

/** ═══ FLAGGED CONTENT IS FETCHED, NOT RENDERED WITH THE PANE ═══
 *
 *  ═══ AND THIS DIVERGES FROM THE TASKS PANE ON PURPOSE — DO NOT "FIX" IT ═══
 *
 *  `/app/tasks` shows flagged content the moment its pane opens, and that is
 *  right there: Tasks is an active queue of items a supervisor must act on NOW,
 *  the content is the thing being judged, and one item is open at a time.
 *
 *  Activity is a browsable 30-day history. The same content has a far wider
 *  exposure surface: a reader scrolling a month of rows would surface teen
 *  messages incidentally, dozens of times, while looking for something else. So
 *  the decision, the category and the notes show by default and the MESSAGE sits
 *  behind an explicit control.
 *
 *  Someone will eventually notice the two panes differ and make them match. This
 *  comment is the reason not to, and the divergence is recorded as
 *  design-system-gaps row 328.
 *
 *  IT LOGS, THROUGH THE SAME SEAM THE REST OF THIS FEATURE USES. Reading a teen's
 *  message is a third-party data access whether or not anyone is writing it down
 *  yet — same argument `recordNetworkAccess` makes for itself. */
export function flaggedContentFor(
  row: FeedRow,
  viewerId: string,
  at: number
): string | null {
  if (row.degraded || !row.payload) return null;
  const excerpt = str(row.payload.flaggedExcerpt);
  if (!excerpt) return null;
  recordFlaggedContentAccess({
    viewerId,
    eventId: row.eventIds[0],
    teenId: row.groupObjectId,
    at,
  });
  return excerpt;
}

/** TODO-COPY. Shown in place of a pane when the row degraded — the message A5
 *  already established, reused rather than reworded. */
export { DEGRADED_MESSAGE } from "@/lib/activity/inspector";
