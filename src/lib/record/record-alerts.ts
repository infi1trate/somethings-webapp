// RECORD ALERTS — the registry applied to one person.
//
// The registry (alerts.ts) says what an alert IS and who it is for. This module
// says which alerts are actually live on a given record right now, and hands the
// UI a flat, already-ordered list. Nothing here decides tone, ordering priority
// or role visibility: all three come from the registry, so a change there moves
// every surface at once.
//
// THE THREE TRANSFORMS, in order, and the order matters:
//
//   1. GROUP flags by conversation. Four classifier hits from one exchange are
//      one thing to review, not four.
//   2. ESCALATE to the overdue variant. A grouped instance is judged by its
//      OLDEST member — a group is overdue if anything in it is.
//   3. COLLAPSE base/overdue pairs. The registry holds both entries so a feed can
//      emit two events; a record shows one card.
//
// Grouping before overdue is deliberate: doing it the other way round can put the
// same conversation in two buckets (one overdue member, three not) and produce
// exactly the duplicate cards the collapse exists to prevent.

import {
  ALERTS,
  alertOrder,
  alertRoleFor,
  collapseOverdue,
  signalFor,
  type AlertRole,
  type AlertSignal,
} from "@/lib/record/alerts";
import {
  cadenceFor,
  pendingReviewFor,
  type CareStoreSlice,
  type PresentationReview,
} from "@/lib/record/care-demo";
import { openFlagsFor } from "@/lib/record/care-demo";
import type { CareFlagRecord, DemoTeen } from "@/lib/record/people-demo";
import { menteeRecency, teenAsMentee } from "@/lib/record/mentees-demo";

const DAY = 86_400_000;

/** HOW LONG BEFORE AN OPEN FLAG IS OVERDUE, by kind.
 *
 *  TODO: both numbers need clinical input — they are placed here, named, and
 *  commented rather than buried as literals so the conversation can happen
 *  against a visible default. An escalation is a same-or-next-day
 *  responsibility; a risk flag is a fortnight because it is a pattern to look
 *  at, not an incident to answer.
 *
 *  STRICTLY GREATER, not >=, so a flag sitting exactly on its threshold is not
 *  yet late. The boundary belongs to the person who still has today to act. */
export const FLAG_OVERDUE_DAYS: Record<CareFlagRecord["kind"], number> = {
  escalation: 2,
  risk_flag: 14,
};

// ── The instance union ──────────────────────────────────────────────────────

interface Base {
  /** Registry id — the ONLY place tone, label, home and ordering come from. */
  alertId: string;
  /** Stable per record, for React keys and for the grouping to be inspectable. */
  key: string;
}

export type AlertInstance = Base &
  (
    | {
        kind: "flag";
        /** One or more flags from ONE conversation. Length > 1 renders grouped. */
        flags: CareFlagRecord[];
        conversationId: string | null;
        /** Days since the OLDEST open flag in the group was raised. */
        oldestDaysAgo: number;
        overdueDays: number;
      }
    | { kind: "review"; review: PresentationReview; overdueDays: number }
    | { kind: "survey"; instrument: string; sentAt: number }
    | { kind: "hello"; sinceMatch: number }
    | {
        kind: "activity";
        activities: NonNullable<DemoTeen["completedActivities"]>;
      }
  );

// ── Grouping ────────────────────────────────────────────────────────────────

/** Open flags → instances, grouped by conversation.
 *
 *  A flag with no `conversationId` is its own instance. That is not a fallback
 *  to be tidied away later: an absent id means "we do not know these came from
 *  the same place", and inventing a grouping from an unknown is worse than
 *  showing two cards. */
function flagInstances(
  flags: CareFlagRecord[],
  now: number
): AlertInstance[] {
  const groups = new Map<string, CareFlagRecord[]>();
  for (const f of flags) {
    // Ungrouped flags get a key unique to themselves, so they cannot collide
    // with each other or with a real conversation.
    const key = f.conversationId ?? `__solo:${f.id}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(f);
    else groups.set(key, [f]);
  }

  const out: AlertInstance[] = [];
  for (const [key, members] of groups) {
    // A MIXED GROUP TAKES ITS SEVERITY FROM ITS WORST MEMBER. One escalation
    // inside a group of risk flags makes the whole group an escalation, because
    // that is what the supervisor is being asked to look at.
    const worst = members.some((f) => f.kind === "escalation")
      ? "escalation"
      : "risk_flag";
    const oldest = Math.max(...members.map((f) => f.daysAgo));
    const threshold = FLAG_OVERDUE_DAYS[worst];
    const overdue = oldest > threshold;
    const base = worst === "escalation" ? "escalation" : "risk_flag";

    out.push({
      alertId: overdue ? `${base}_overdue` : `${base}_open`,
      key: `flag:${key}`,
      kind: "flag",
      // Newest first inside a group — the most recent match is the reason a
      // supervisor is looking now.
      flags: [...members].sort((a, b) => a.daysAgo - b.daysAgo),
      conversationId: members[0].conversationId ?? null,
      oldestDaysAgo: oldest,
      overdueDays: overdue ? oldest - threshold : 0,
    });
    void now;
  }
  return out;
}

// ── The whole record ────────────────────────────────────────────────────────

/** Every live alert instance on this teen, registry-ordered.
 *
 *  ROLE IS NOT APPLIED HERE. This returns what is TRUE of the record; the caller
 *  splits by signal for the viewing role. Keeping the two apart means a badge and
 *  a section cannot disagree about what exists — only about what they show. */
export function alertsForTeen(
  teen: DemoTeen,
  now: number,
  store: CareStoreSlice = {}
): AlertInstance[] {
  const out: AlertInstance[] = [];

  // 1 · FLAGS, grouped then graded.
  out.push(...flagInstances(openFlagsFor(teen.id, store), now));

  // 2 · PRESENTATION REVIEW. Care-homed, so on Overview this becomes a roll-up
  //     row. `pendingReviewFor` already returns null on a closed record.
  const cadence = cadenceFor(teen.id, now, store);
  const review = pendingReviewFor(teen.id, now, store);
  if (review) {
    const due = cadence.nextReviewDue;
    const overdueDays =
      due != null && now > due ? Math.floor((now - due) / DAY) : 0;
    out.push({
      alertId:
        overdueDays > 0
          ? "presentation_review_overdue"
          : "presentation_review_due",
      key: `review:${review.id}`,
      kind: "review",
      review,
      overdueDays,
    });
  }

  // 3 · OUTSTANDING SURVEY — waiting on the teen, so attention and never a count.
  if (cadence.outstandingSurvey) {
    out.push({
      alertId: "survey_outstanding",
      key: "survey",
      kind: "survey",
      instrument: cadence.outstandingSurvey.instrument,
      sentAt: cadence.outstandingSurvey.sentAt,
    });
  }

  // 4 · SAY HI. Derived from the no-contact recency state rather than stored —
  //     the messaging stamps already describe this, and a second stored boolean
  //     could contradict them.
  const recency = menteeRecency(teenAsMentee(teen, now), now);
  if (recency.kind === "no-contact") {
    out.push({
      alertId: "first_hello_pending",
      key: "hello",
      kind: "hello",
      sinceMatch: recency.sinceMatch,
    });
  }

  // 5 · COMPLETED ACTIVITIES — one instance carrying all of them, not one each.
  //     Three separate rows for "finished an activity" is the conversation-
  //     grouping failure in miniature.
  const acts = teen.completedActivities ?? [];
  if (acts.length > 0) {
    out.push({
      alertId: "activity_completed",
      key: "activities",
      kind: "activity",
      activities: [...acts].sort((a, b) => a.daysAgo - b.daysAgo),
    });
  }

  // COLLAPSE, then order by the registry's own index.
  const kept = new Set(collapseOverdue(out.map((i) => i.alertId)));
  return out
    .filter((i) => kept.has(i.alertId))
    .sort((a, b) => alertOrder(a.alertId) - alertOrder(b.alertId));
}

/** Split by what THIS role sees. Anything future-flagged or signalled
 *  activity/notification falls out of both lists — see `invisibleOnRecord`. */
export function splitBySignal(
  instances: AlertInstance[],
  role: AlertRole
): Record<"action" | "attention", AlertInstance[]> {
  const pick = (want: AlertSignal) =>
    instances.filter((i) => {
      const def = ALERTS.find((a) => a.id === i.alertId);
      if (!def || def.future) return false;
      return signalFor(i.alertId, role) === want;
    });
  return { action: pick("action"), attention: pick("attention") };
}

/** THE BADGE COUNTS.
 *
 *  ═══ THE OVERLAP IS DELIBERATE — DO NOT "FIX" IT ═══
 *  Overview counts EVERY open action item on the person, including the ones whose
 *  contextual home is Care. Care counts only its own. So a teen with one
 *  presentation review and nothing else shows `1` on both tabs, and the same
 *  review is being counted twice across the two numbers.
 *
 *  That is correct. Overview is the profile-level INDEX — "how much does this
 *  person need from us" — and an index that excluded the work living one tab over
 *  would understate the record and send a supervisor hunting. Care is a SCOPED
 *  list — "how much is there to do here". The two answer different questions and
 *  a reader never sums them.
 *
 *  Making them disjoint would mean the Overview badge could read 0 on a record
 *  with an overdue review, which is the actual bug.
 *
 *  ATTENTION IS NEVER COUNTED, on either tab. The badge means "action needed";
 *  putting "say hi" into it makes the number unusable for triage within a week.
 */
export function badgeCounts(
  instances: AlertInstance[],
  role: AlertRole
): { overview: number; care: number } {
  const { action } = splitBySignal(instances, role);
  const homeOf = (id: string) =>
    ALERTS.find((a) => a.id === id)?.contextualHome;
  return {
    // A GROUPED FLAG INSTANCE COUNTS AS ONE. Four classifier hits from one
    // exchange are one piece of work, and a badge reading 4 would send a
    // supervisor looking for four things to do.
    overview: action.length,
    care: action.filter((i) => homeOf(i.alertId) === "care").length,
  };
}

/** Registry severity for an instance, stepped for overdue. The registry already
 *  encodes the step (the `_overdue` entries carry their own severity), so this is
 *  a lookup and not a rule — which is the point. */
export function severityOf(instance: AlertInstance) {
  return ALERTS.find((a) => a.id === instance.alertId)?.severity ?? "routine";
}

/** Re-exported so a component needs ONE import for the whole record-alert
 *  surface rather than reaching into the registry for the role mapping. */
export { alertRoleFor as alertRoleForStore };
