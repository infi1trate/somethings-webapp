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

/** ═══ `needsResponse` IS NOT A DEADLINE (arch-G, G2) ═══
 *  Every other bucket is a partition of the SLA clock. This one is a partition of
 *  the TASK TYPE: a live escalation belongs at the top of the list whatever its
 *  five-minute clock currently reads, including before it has run out. It shares
 *  the bucket machinery because the grammar is the same — a labelled band with a
 *  count, in fixed order — and not because it is computed the same way. */
export type DeadlineBucketId =
  | "needsResponse"
  | "overdue"
  | "today"
  | "tomorrow"
  | "later";

/** FIXED ORDER, NEVER REORDERED. The order is the deadline's, which is the whole
 *  point — a bucket list that reordered would reintroduce problem 2 above. */
export const DEADLINE_BUCKETS: DeadlineBucketId[] = [
  "needsResponse",
  "overdue",
  "today",
  "tomorrow",
  "later",
];

/** NEEDS-COPY-NICOLE, all five. */
export const BUCKET_LABEL: Record<DeadlineBucketId, string> = {
  needsResponse: "Needs response now",
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

/** ═══ THE BUCKET FOR AN ITEM, WHICH IS NOT ALWAYS ITS DEADLINE'S ═══
 *  A live escalation goes to the top regardless of its clock. Everything else
 *  asks `bucketOf`. Separate from `bucketOf` rather than folded into it because
 *  `bucketOf` answers a question about a DEADLINE and is tested as such — an
 *  item-shaped argument would make its own tests about task types. */
export function bucketForItem(item: TaskItem, now: number): DeadlineBucketId {
  if (item.taskType === "activeEscalation") return "needsResponse";
  /* ═══ NO DEADLINE MEANS `later`, AND IT SHOULD NEVER BE REACHED (Phase 4) ═══
     A risk flag has no published review deadline. The surfaces that bucket by
     deadline — Care Reviews and the escalation panes — hold billing and
     escalation items, all of which have real ones, so this branch is a
     correctness floor rather than a display decision.
     `later` RATHER THAN `overdue`: those are the two ends a missing value could
     land on, and one of them would put every flag at the top of the list under a
     breach header. `bucketOf` keeps its non-null signature because it answers a
     question about a DEADLINE and is tested as such. */
  if (item.slaDeadline == null) return "later";
  return bucketOf(item.slaDeadline, now);
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
    const id = bucketForItem(item, now);
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
  entries: readonly ListEntry[],
  now: number
): TierBand[] {
  const byId = new Map<DeadlineBucketId, TierBand>();
  const order: DeadlineBucketId[] = [];

  for (const entry of entries) {
    /* `bucketForItem`, NOT `bucketOf` — a live escalation's bucket is decided by
       its TASK TYPE, and asking its deadline would file it under whatever its
       five-minute clock happened to read (arch-G, G2). The first build of this
       phase changed only `deadlineBucketsFor` and left this line, so the pinned
       band never formed and the response rows sat in Overdue. */
    const id = bucketForItem(paneItemFor(entry), now);
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

/** ═══ THE RIGHT-HAND FACT, PER BUCKET (arch-F, F1.2) ═══
 *
 *  Every row carried the same expression — `due in {n}` — and the bucket header
 *  above it said the same thing in words, so five rows under "Due tomorrow — 5"
 *  each read "due in 1d" and told a reader nothing the header had not.
 *
 *  MEASURED, AND WORSE THAN A REPETITION: `elapsedLabel` rounds 24–47h to "1d"
 *  while `bucketOf` partitions by CALENDAR DAY, so on the shipped fixtures five
 *  rows under "Later" also read "due in 1d". The countdown did not merely repeat
 *  its header, it contradicted it — those rows read as due tomorrow.
 *
 *  So each bucket's fact carries what its header cannot:
 *
 *    overdue   how late, which is the actionable number once the deadline is gone
 *    today     the clock time, because "today" is hours away and which hour matters
 *    tomorrow  the clock time, for the same reason one day out
 *    later     the date, because beyond tomorrow the day is the fact
 *
 *  ═══ THE LOCALE, AND WHY THIS PICKS ONE RATHER THAN INVENTING ONE ═══
 *
 *  This codebase has no single convention: `childTimeLabel` in `worklist.tsx`
 *  hardcodes `en-US` with `hour12: true`, `conversation-excerpt.tsx` passes
 *  `undefined` (browser locale), `use-clock.ts` derives hour12 from the browser,
 *  and `care-pattern.ts` and `activity/sentences.ts` hardcode `en-US`. There is
 *  no timezone handling anywhere — everything is local browser time.
 *
 *  This follows its NEAREST NEIGHBOUR, `childTimeLabel`, which is the other
 *  clock on this very row: same locale, same options. Introducing a third
 *  convention on one surface would be the worse of the two available mistakes.
 *  The inconsistency is reported rather than resolved here. */
export function deadlineFactFor(
  /** NULL FOR AN ITEM WITH NO PUBLISHED DEADLINE — see `TaskItem.slaDeadline`. */
  deadline: number | null,
  now: number,
  elapsed: (from: number, to: number) => string,
  /** ═══ A LIVE ESCALATION COUNTS UP (arch-G, G2) ═══
   *  Not a countdown. During an incident the actionable number is how long
   *  somebody has been waiting — the five-minute SLA is the threshold the figure
   *  crosses, not the thing being counted to, and a countdown that has expired
   *  reads as finished when the opposite is true. `openedAt` rather than the
   *  deadline, because that is the instant the wait began. */
  live?: { openedAt: number },
): string {
  if (live) {
    /* NEEDS-COPY-NICOLE */
    return `${elapsed(live.openedAt, now)} elapsed`;
  }
  /* ═══ THE ABSENCE IS STATED, NOT SUBSTITUTED (Phase 4) ═══
     NEEDS-COPY-NICOLE. A risk flag has no published review deadline. Returning
     "" would leave a dangling figure in the row's temporal slot — the
     empty-label-stack defect the production audit recorded — and a `?? now`
     fallback would render "overdue by 0m" on every flag, which is a breach claim
     manufactured out of a missing value. */
  if (deadline == null) return "no review deadline";
  const bucket = bucketOf(deadline, now);
  if (bucket === "overdue") {
    /* NEEDS-COPY-NICOLE. "by" rather than a bare duration: the number alone
       beside a breach chip could be read as time remaining. */
    return `overdue by ${elapsed(deadline, now)}`;
  }
  if (bucket === "later") {
    /* NEEDS-COPY-NICOLE */
    return `due ${new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  /* NEEDS-COPY-NICOLE. Today and tomorrow both read as a clock time — the bucket
     header already says which day, so the row says which hour. */
  return `due ${new Date(deadline).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
}
