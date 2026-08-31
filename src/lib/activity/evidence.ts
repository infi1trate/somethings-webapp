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

/** A labelled fact. Values are strings because the pane renders them — anything
 *  that needs formatting is formatted before it gets here, so the component never
 *  has to know what a code or a score is. */
export interface EvidenceFact {
  label: string;
  value: string;
}

export interface EventEvidence {
  eventType: ActivityEventType;
  /** The pane's own heading. TODO-COPY. */
  title: string;
  /** What was decided. Two to four facts — more than that is a table, and a table
   *  is what A12's object summary already proved does not earn a column. */
  facts: EvidenceFact[];
  /** The artifact itself, when the event has one to preview: the review document,
   *  the survey responses, the reviewer's notes. Prose, never a value. */
  body?: { label: string; text: string };
  /** Related context — the presentation in force, a prior score. Absent when
   *  there is nothing true to say. */
  related?: EvidenceFact[];
  /** Set only when the event's artifact includes a teen's own words. The words
   *  themselves are NOT here — see `flaggedContentFor`. */
  hasFlaggedContent: boolean;
  /** The conversation the flagged content belongs to, for the chat link. */
  conversationId?: string;
  /** The persistent footer link every pane carries. */
  record: { href: string; label: string };
}

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
    case "BILLING_REVIEW_COMPLETE": {
      const code = str(p.code);
      if (!code) return null;
      const facts: EvidenceFact[] = [];
      const previous = str(p.previousCode);
      // THE CHANGE, NOT JUST THE RESULT. "F41.9 → F41.1" is the decision; "F41.1"
      // alone is the state, and the state is already on the row.
      facts.push({
        label: "Code",
        value: previous ? `${previous} → ${code}` : code,
      });
      facts.push({ label: "Status", value: str(p.status) ?? "Active" });
      facts.push({
        label: "Approved by",
        value: row.actorIsSelf ? "You" : `${row.actorName} · ${row.actorRole}`,
      });
      facts.push({ label: "When", value: row.absolute });
      return {
        eventType: row.eventType,
        title: "Billing review",
        facts,
        body: str(p.note)
          ? { label: "Review document", text: str(p.note)! }
          : undefined,
        related: [{ label: "Primary presentation", value: code }],
        hasFlaggedContent: false,
        record: { href: teenHref, label: "Open the full billing record" },
      };
    }

    case "SURVEY_COMPLETED": {
      const instrument = str(p.instrument);
      const score = num(p.score);
      if (!instrument || score === undefined) return null;
      const prior = num(p.priorScore);
      return {
        eventType: row.eventType,
        title: "Survey",
        facts: [
          { label: "Instrument", value: instrument },
          { label: "Score", value: String(score) },
          { label: "Completed", value: row.absolute },
        ],
        // TREND ONLY WHEN THERE IS A PRIOR SCORE. A "trend" from one reading is a
        // number with an arrow next to it.
        related:
          prior !== undefined
            ? [
                {
                  label: "Previous",
                  value: `${prior} → ${score} (${score > prior ? "up" : score < prior ? "down" : "unchanged"})`,
                },
              ]
            : undefined,
        hasFlaggedContent: false,
        record: { href: teenHref, label: "Open the survey history" },
      };
    }

    case "RISK_FLAG_CLOSED": {
      const cats = (Array.isArray(p.categories) ? p.categories : []).filter(
        (c): c is string => typeof c === "string"
      );
      const decision = str(p.decision);
      if (!decision && cats.length === 0) return null;
      return {
        eventType: row.eventType,
        title: "Risk flag",
        facts: [
          { label: "Decision", value: decision ?? "Closed" },
          ...(cats.length
            ? [{ label: "Category", value: cats.map(humaniseCategory).join(", ") }]
            : []),
          {
            label: "Closed by",
            value: row.actorIsSelf ? "You" : `${row.actorName} · ${row.actorRole}`,
          },
          { label: "When", value: row.absolute },
        ],
        body: str(p.reviewerNotes)
          ? { label: "Reviewer notes", text: str(p.reviewerNotes)! }
          : undefined,
        // The one type that has any, and it stays behind the disclosure.
        hasFlaggedContent: !!str(p.flaggedExcerpt),
        conversationId: str(p.conversationId) ?? undefined,
        record: { href: teenHref, label: "Open the full record" },
      };
    }

    case "ESCALATION_CLOSED": {
      const outcome = str(p.outcome);
      if (!outcome) return null;
      return {
        eventType: row.eventType,
        title: "Escalation",
        facts: [
          { label: "Outcome", value: outcome },
          {
            label: "Closed by",
            value: row.actorIsSelf ? "You" : `${row.actorName} · ${row.actorRole}`,
          },
          { label: "When", value: row.absolute },
        ],
        body: str(p.notes)
          ? { label: "Notes and recorded discussion", text: str(p.notes)! }
          : undefined,
        hasFlaggedContent: false,
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
