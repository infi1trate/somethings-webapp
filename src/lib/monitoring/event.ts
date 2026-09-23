// ═══ ONE EVENT PRIMITIVE FOR THE WHOLE SURFACE ═══
//
// An event surfaced for supervisor judgment, reviewed in its conversation,
// resolved with a recorded disposition. One type, one queue, one comparator.
//
// ═══ IT HELD TWO REVIEW SUBJECTS AND NOW HOLDS ONE (addendum §2.1) ═══
//
// arch-mon's claim was that a teen risk flag and a mentor practice breach are
// the same SHAPE of thing, so they should be one primitive filterable by
// subject rather than two tab structures with two orderings that drift. The
// shape argument was sound and is not what was withdrawn: Mentor Practice was
// removed because it is not a real concept in this product, which is a question
// about the DOMAIN and not about the modelling.
//
// WHAT WENT WITH IT: `ReviewSubject`, `PracticeKind`, `PracticeFacts`,
// `subjectOf`, the subject filter chips, and `groupEvents` — a grouping over one
// group is a header restating the page title, and the count it carried is now a
// header metric (§2.10). `EVENT_KIND_LABEL` went too: with one kind the row's
// secondary line was "Flag" on every row, which is the same defect arch-F
// removed from the Tasks row (emphasis follows what varies).
//
// THE COMPARATOR SURVIVED INTACT, which is the part of arch-mon worth keeping:
// it never read `subject` on any of its five steps. Removing a subject removed
// no ordering.
//
// ═══ WHAT THIS TYPE DELIBERATELY DOES NOT CARRY ═══
//
// No tier. No severity. No deadline. No breach. The page removed the severity
// taxonomy because it was asserting clinical severity it could not compute, and
// a field for it here would be the same assertion one layer down. Flags carry
// AGE. `TaskItem.slaDeadline` is still populated upstream for the flag task type
// — see `FLAG_REVIEW_SLA` — and this module never reads it. That is the one read
// whose absence is the point.

import { flagCategoryRank, FLAG_PATTERN_MIN } from "@/lib/monitoring/constants";
import type { RiskFlagPayload, TaskItem } from "@/lib/tasks/types";

export interface MonitoringEvent {
  id: string;
  /** ROLES ARE NAMED, NOT ORDERED. "Naomi R. to Maria Lopez" left a reader to
   *  work out which name was the teen, in the one state where identifying the
   *  teen instantly matters most. Both halves are labelled wherever they render. */
  teenId: string;
  teenName: string;
  mentorId: string;
  mentorName: string;
  conversationId: string;
  /** ═══ THE EVENT'S OWN MOMENT — AGE IS MEASURED FROM HERE ═══
   *  The flagged message's timestamp. The conversation fixture places the
   *  flagged message at `openedAt` (`conversation.ts`), so the two are the same
   *  instant by construction rather than by coincidence — and there is no
   *  separate flagged-message timestamp on the payload to prefer. */
  at: number;
  /** The classifier's category. Free text upstream — see
   *  `RiskFlagPayload.categories`. */
  category: string | null;
  /** Comparator inputs, computed once at build time so the sort stays O(n log n)
   *  and so every step is inspectable in a test without a DOM. */
  escalationOpen: boolean;
  patternCount: number;
  mentorReplied: boolean;
  /** The originating task item — the pane reads its payload for the rationale,
   *  the categories and the excerpt. */
  flag: TaskItem;
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
  };
}

/** ═══ THE COMPARATOR (locked decision 1) ═══
 *
 *   1 open escalation (any)
 *   2 flag category rank            — LIVE since Phase 4: the playbook's tier
 *                                     grouping over the 21 published categories.
 *                                     Separates the three groups; flat within a
 *                                     group, so it falls through to 3-5 there.
 *   3 conversation has >= 2 flags   — see FLAG_PATTERN_WINDOW for the widening
 *   4 flagged message has no mentor reply
 *   5 age, oldest first
 *
 *  THERE IS NO SECONDARY ORDERING ANYWHERE ELSE on this surface. Not in the
 *  list, not in the groups, and nothing AI-ordered. Step 5 ends in an id
 *  comparison so the order is total — two events at the same millisecond would
 *  otherwise sort differently between renders. */
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
