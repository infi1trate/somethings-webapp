// ═══════════════════════════════════════════════════════════════════════════
// THE PINNED ROW — FOUR FIELDS, AND NOT A FIFTH (Today Phase F)
//
// ═══ WHAT THE CONTRACT IS FOR ═══
//
// The section answers "does this person need me right now, and where do I go" —
// not "how is this person doing". F is explicit that recency and open/closed
// are facts while COUNTS INVITE COMPARISON AND RANKING of named people, which
// is the risk-score-by-another-name this product removed once already.
//
// So the row is exactly: name, last activity recency, ONE open obligation and
// its destination, and the assigned mentor. This module returns exactly those
// and has nowhere to put anything else — a per-person flag total has no field
// to live in, which is a stronger guarantee than a rule in a comment.
//
// ═══ THE OBLIGATION IS READ FROM THE DESTINATIONS, AND TODAY IT IS ALWAYS NULL ═══
//
// MEASURED: the record side has 26 teens (`t1`…), the task and monitoring
// fixtures have 32 (`tk-…`), and the two sets share ZERO ids. `pinned-mentee`
// ids come from the record route, so no pinned mentee can match a task item, a
// flag event or an escalation record — and `obligationFor` returns null for
// every one of them. Every row will read "Nothing open" until that changes.
//
// THAT IS GAP 432, AND IT IS PINNED BY A TEST ALREADY.
// `lib/tasks/__tests__/teen-namespaces.test.ts` asserts the disjointness on
// purpose and carries the instruction for the day it closes. This module is
// written against the DESTINATIONS rather than against the record's own
// `careFlags` and `escalation` fields, which do exist per teen — because
// naming a destination from record-side data would print "1 open in Risk
// Flags" on a row whose destination holds nothing for that teen. That is a
// door that does not open, and this codebase has already removed two of them
// (Coverage's row control, the escalation pane's link-outs) rather than point
// them somewhere plausible.
//
// So the field is correct-by-construction and currently constant. When the
// namespaces reconcile it starts working with no change here.

import {
  DESTINATION_ORDER,
  type DestinationId,
} from "@/lib/ia/destinations";
import { activeEscalations, openCareReviews } from "@/lib/ia/open-counts";
import type { TaskItem } from "@/lib/tasks/types";
import type { EscalationRecord } from "@/lib/monitoring/escalation";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import type { PinnedMentee } from "@/lib/record/pinned";

export interface ObligationRef {
  destination: DestinationId;
  /** This teen's open items AT THAT ONE DESTINATION. Never a total across
   *  destinations — F forbids it, and a total is the number that invites
   *  ranking people against each other. */
  count: number;
  /** The oldest item's instant, which is how the destination is chosen. */
  oldestAt: number;
}

export interface ObligationInput {
  items: TaskItem[];
  events: MonitoringEvent[];
  escalations: EscalationRecord[];
  now: number;
}

/**
 * The ONE obligation a pinned row names, or null.
 *
 * WHERE SEVERAL DESTINATIONS HOLD WORK, THE OLDEST WINS — F's rule, and the
 * only tie-break that does not require ranking the destinations against each
 * other by importance. `DESTINATION_ORDER` breaks an exact tie so the answer is
 * deterministic rather than dependent on object iteration.
 */
export function obligationFor(
  teenId: string,
  input: ObligationInput
): ObligationRef | null {
  const { items, events, escalations, now } = input;

  const per: ObligationRef[] = [];

  const escs = activeEscalations(escalations, now).filter((r) => r.teenId === teenId);
  if (escs.length > 0) {
    per.push({
      destination: "escalations",
      count: escs.length,
      oldestAt: Math.min(...escs.map((r) => r.triggeredAt)),
    });
  }

  const flags = events.filter((e) => e.teenId === teenId);
  if (flags.length > 0) {
    per.push({
      destination: "risk-flags",
      count: flags.length,
      oldestAt: Math.min(...flags.map((e) => e.at)),
    });
  }

  const reviews = openCareReviews(items).filter((i) => i.teenId === teenId);
  if (reviews.length > 0) {
    per.push({
      destination: "care-reviews",
      count: reviews.length,
      oldestAt: Math.min(...reviews.map((i) => i.openedAt)),
    });
  }

  if (per.length === 0) return null;
  return per.sort(
    (a, b) =>
      a.oldestAt - b.oldestAt ||
      DESTINATION_ORDER.indexOf(a.destination) -
        DESTINATION_ORDER.indexOf(b.destination)
  )[0];
}

/** ═══ LAST ACTIVITY, AS A RELATIVE PHRASE (F contract, field 2) ═══
 *
 *  RECENCY, NOT FREQUENCY. F rules out a rate, a trend and a graph; what is
 *  left is when something last happened. The record carries the two sides
 *  separately — `menteeLastSentDaysAgo` and `mentorLastSentDaysAgo` — and the
 *  activity of the CONVERSATION is the more recent of them.
 *
 *  DAYS IS THE GRANULARITY THE DATA HAS. F's example is "Active 2h ago"; the
 *  record stores whole days, so an hour-precision string would be invented
 *  precision. Stated rather than rounded into something that looks finer than
 *  it is. */
export function activityLabel(
  menteeDaysAgo: number | undefined,
  mentorDaysAgo: number | undefined
): string | null {
  const days = [menteeDaysAgo, mentorDaysAgo].filter(
    (d): d is number => typeof d === "number" && Number.isFinite(d)
  );
  if (days.length === 0) return null;
  const d = Math.min(...days);
  /* NEEDS-COPY-NICOLE ×3. */
  if (d <= 0) return "Active today";
  if (d === 1) return "Active yesterday";
  return `Active ${d}d ago`;
}

/** Pinned ids, in pin order. A pass-through that exists so the ORDERING is a
 *  named thing a test can point at rather than an implicit property of an
 *  array — F asks for the ordering expression to be quoted. */
export function pinnedInOrder(pinned: PinnedMentee[]): PinnedMentee[] {
  /* ASCENDING PIN TIME. The store appends, so insertion order already is this;
     sorting explicitly means a hand-edited or migrated store cannot render in
     an order the report claims it does not. NOT by recency, not by open count,
     not by anything that ranks people. */
  return [...pinned].sort((a, b) => a.at - b.at);
}
