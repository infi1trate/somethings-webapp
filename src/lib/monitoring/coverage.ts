// ═══ COVERAGE IS THE FLOOR; EVENTS ARE THE ENTRY POINTS ═══
//
// The page offered no path to a conversation the classifier had not flagged. A
// supervisor arriving expects to review the conversations under their
// supervision — the flagged ones first, but not only those. A surface that can
// only show what a model noticed cannot answer "have I looked at my teens this
// shift", which is the question the role is measured on.
//
// COVERAGE IS PROGRESS AGAINST A PERIOD, NEVER AN INBOX COUNT. "69" is not a
// backlog and must never render as one: it is a denominator.

import { COVERAGE_CREDIT_RULE_UNRESOLVED, COVERAGE_PERIOD } from "@/lib/monitoring/constants";

export interface SupervisedConversation {
  id: string;
  teenId: string;
  teenName: string;
  mentorId: string;
  mentorName: string;
  lastActivityAt: number;
  /** When the supervisor last reviewed it IN THIS PERIOD. Null = not yet. */
  reviewedAt: number | null;
  /** How many open events this conversation is carrying. Zero is the normal
   *  case and the reason coverage exists. */
  eventCount: number;
}

export interface CoverageProgress {
  reviewed: number;
  total: number;
  /** 0–1. Rounded only at the point of display. */
  fraction: number;
  period: typeof COVERAGE_PERIOD;
}

export function coverageProgress(
  conversations: SupervisedConversation[],
  credited: ReadonlySet<string>
): CoverageProgress {
  const reviewed = conversations.filter(
    (c) => c.reviewedAt != null || credited.has(c.id)
  ).length;
  return {
    reviewed,
    total: conversations.length,
    fraction: conversations.length === 0 ? 1 : reviewed / conversations.length,
    period: COVERAGE_PERIOD,
  };
}

/** ═══ BLOCKED · Meg — AND THIS IS THE ONE PLACE THE RULE LIVES ═══
 *
 *  Reviewing a flag in its conversation credits that conversation: the
 *  supervisor read the surrounding turns to do the review, and asking them to
 *  then open the same conversation again to "mark it reviewed" would be making
 *  them do the same work twice for the metric's benefit.
 *
 *  While `COVERAGE_CREDIT_RULE_UNRESOLVED` is `"flag-review-or-open"` both paths
 *  credit. The other two readings are implemented as branches rather than
 *  described, so answering the question is one constant. */
export function creditsCoverage(
  source: "event-review" | "conversation-open" | "explicit-mark"
): boolean {
  switch (COVERAGE_CREDIT_RULE_UNRESOLVED) {
    case "flag-review-only":
      return source === "event-review";
    case "explicit-mark-only":
      return source === "explicit-mark";
    case "flag-review-or-open":
    default:
      return source !== "explicit-mark";
  }
}

/** NEEDS-COPY-NICOLE. Progress, stated as progress.
 *  "12 of 38 conversations reviewed this shift" — a fraction with its unit and
 *  its period. Never "26 unreviewed", which is the inbox reading of the same
 *  number and the one this view exists to avoid. */
export function coverageLine(p: CoverageProgress): string {
  return `${p.reviewed} of ${p.total} conversations reviewed this ${p.period}`;
}

/** Sort for the coverage view: unreviewed first, then oldest activity — so the
 *  conversation nobody has looked at and nobody has spoken to is at the top.
 *  NOT a second event comparator: these are conversations, not events, and the
 *  queue's five steps do not apply to a thing with no event on it. */
export function compareConversations(
  a: SupervisedConversation,
  b: SupervisedConversation,
  credited: ReadonlySet<string>
): number {
  const aDone = a.reviewedAt != null || credited.has(a.id);
  const bDone = b.reviewedAt != null || credited.has(b.id);
  if (aDone !== bDone) return aDone ? 1 : -1;
  if (a.lastActivityAt !== b.lastActivityAt) return a.lastActivityAt - b.lastActivityAt;
  return a.id.localeCompare(b.id);
}
