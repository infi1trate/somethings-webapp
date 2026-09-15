// ═══ GROUPING BY WHEN WORK IS DUE, NOT BY WHAT KIND IT IS ═══
//
// ═══ WHAT THIS REPLACES, AND WHY THE OLD GROUPING FAILED ═══
//
// Tasks grouped by task type: "Monthly re-review — 7" then "Intake — 8". Three
// compounding problems, and the third is the one that made it wrong rather than
// merely plain:
//
//   1 THE GROUP HEADER TOOK THE VERB OFF THE ROW. When the header says the task
//     type, the row says only a name and a deadline — which reads as a person
//     rather than as work, and collapses entirely once a second and third task
//     type exist and every row has to state what it is.
//
//   2 TYPE BUCKETS DESTROYED DEADLINE ORDER ACROSS BUCKETS. MEASURED: the list
//     ran Monthly re-review 15h → 2d, then RESTARTED at Intake 20h → 2d. The
//     sort was correct within each bucket and the page as a whole was not
//     scannable — finding what is about to breach meant mentally merging N
//     sorted lists, on a surface whose entire job is deadline awareness.
//
//   3 It was a grouping nobody needed. A supervisor working a deadline queue does
//     not ask "which kind first"; the comparator already answers that.
//
// Time buckets fix 2 by construction — see the note on `bucketOf`.
//
// ═══ NO SECOND ORDERING PATH, AND THAT IS VERIFIABLE ═══
//
// Buckets are a PARTITION of the one sorted list, not a re-sort. `slaRemaining`
// is the comparator's fourth key, and on the billing list keys 1 and 3 are inert
// — no billing item is an active escalation, and both billing types share
// `tierRank` 4 — so the effective order already is breached → slaRemaining →
// openedAt. MEASURED across all five scenarios: `slaRemaining` is monotonically
// non-decreasing down the sorted list, which makes every bucket a contiguous run
// of it.
//
// So there is no comparator here and no `.sort()`. If one appears below, the
// buckets have stopped being a partition and the fix is upstream.

import { itemsOf, paneItemFor, type ListEntry } from "@/lib/tasks/list";
import type { TierBand } from "@/lib/tasks/bands";
import type { TaskItem } from "@/lib/tasks/types";

export type DeadlineBucketId = "overdue" | "today" | "tomorrow" | "later";

/** FIXED ORDER, NEVER REORDERED. The order is the deadline's, which is the whole
 *  point — a bucket list that reordered would reintroduce problem 2 above. */
export const DEADLINE_BUCKETS: DeadlineBucketId[] = [
  "overdue",
  "today",
  "tomorrow",
  "later",
];

/** TODO-COPY, all four. */
export const BUCKET_LABEL: Record<DeadlineBucketId, string> = {
  overdue: "Overdue",
  today: "Due today",
  tomorrow: "Due tomorrow",
  later: "Later",
};

/** ═══ WHICH BUCKET A DEADLINE FALLS IN ═══
 *
 *  CALENDAR DAYS, NOT ROLLING HOURS, and the difference matters to a reader: "due
 *  today" means before you go home, which is a wall-clock fact. A rolling
 *  twenty-four hours would put something due at 9am tomorrow in the same bucket
 *  as something due at 5pm today, and those are two different afternoons.
 *
 *  THE COST, STATED: the edge is midnight, so an item three hours out is today's
 *  until late evening and tomorrow's after. That is correct behaviour and it
 *  means a FIXTURE CANNOT PIN A BUCKET — see the seed's own note where the
 *  billing ages were widened to straddle the deadline.
 *
 *  `<= now` IS OVERDUE, matching `isBreached`'s `now > slaDeadline` at the only
 *  instant they could differ: something sitting exactly on its deadline is not
 *  yet late by the comparator, and this agrees. */
export function bucketOf(deadline: number, now: number): DeadlineBucketId {
  if (deadline <= now) return "overdue";
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (deadline <= endOfToday.getTime()) return "today";
  const endOfTomorrow = new Date(now + 86_400_000);
  endOfTomorrow.setHours(23, 59, 59, 999);
  if (deadline <= endOfTomorrow.getTime()) return "tomorrow";
  return "later";
}

export interface DeadlineBucket {
  id: DeadlineBucketId;
  label: string;
  items: TaskItem[];
}

/** ═══ EMPTY BUCKETS DO NOT RENDER ═══
 *
 *  Deliberately unlike the tab-card rule, which kept every card for position
 *  stability. A card was a NAVIGATION target and a reader learned where it sat;
 *  a bucket is a content grouping, and an "Overdue — 0" header is a line of noise
 *  claiming a shape the list does not have. On a quiet day three of these four
 *  are empty and the list should look like one list.
 *
 *  WALKS THE ALREADY-SORTED INPUT ONCE. Order inside a bucket is whatever order
 *  it arrived in, which is the comparator's — the same contract `bandsFor` has
 *  ("a band's position is its first member's position in the one sorted list"). */
export function deadlineBucketsFor(
  sorted: TaskItem[],
  now: number
): DeadlineBucket[] {
  const byId = new Map<DeadlineBucketId, TaskItem[]>();
  for (const item of sorted) {
    const id = bucketOf(item.slaDeadline, now);
    const bucket = byId.get(id);
    if (bucket) bucket.push(item);
    else byId.set(id, [item]);
  }
  return DEADLINE_BUCKETS.filter((id) => byId.has(id)).map((id) => ({
    id,
    label: BUCKET_LABEL[id],
    items: byId.get(id)!,
  }));
}

/** ═══ BUCKETS AS BANDS, SO THE LIST DOES NOT FORK ═══
 *
 *  `Worklist` renders `TierBand`s — sections, offsets, sticky headers and the
 *  keyboard's order all derive from them — and every one of those is identical
 *  whether a band is a tier or a deadline. So a bucket is expressed AS a band
 *  rather than as a second code path through the list.
 *
 *  `taskCount` counts the TASKS a band stands for, not the rows, because a
 *  coalesced group is one row and five flags. Billing never coalesces, so on
 *  Tasks the two are the same number today — it is computed properly anyway,
 *  since the day a task type on this surface does coalesce, a header saying 7
 *  over 12 items would be the header lying.
 *
 *  THE BUCKET OF AN ENTRY IS ITS HEAD'S. Groups never straddle a deadline
 *  boundary today (nothing coalesces here), and taking the head's bucket means
 *  that if one ever did, the row files under its most urgent member — which is
 *  the same rule `bandsFor` uses for tiers and the only one that cannot hide a
 *  deadline inside a group. */
export function deadlineBandsFor(
  entries: ListEntry[],
  now: number
): TierBand[] {
  const byId = new Map<DeadlineBucketId, TierBand>();
  const order: DeadlineBucketId[] = [];

  for (const entry of entries) {
    const id = bucketOf(paneItemFor(entry).slaDeadline, now);
    let band = byId.get(id);
    if (!band) {
      band = { id, label: BUCKET_LABEL[id], entries: [], taskCount: 0 };
      byId.set(id, band);
      order.push(id);
    }
    band.entries.push(entry);
    band.taskCount += itemsOf(entry).length;
  }

  /* ═══ FIXED ORDER, NOT FIRST-APPEARANCE ORDER ═══
     `bandsFor` uses first appearance because the comparator's tier ladder already
     puts tiers in the right sequence. Here the order is the DEADLINE's and is
     stated outright: a partition of a list sorted by `slaRemaining` arrives in
     bucket order anyway, so this is a guarantee rather than a re-sort — and it is
     the guarantee that makes "Overdue is always first" true even if the
     comparator's earlier keys ever reorder something. */
  return DEADLINE_BUCKETS.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
}
