// ═══ THE HYBRID UNIT OF REVIEW — the core decision of arch-B ═══
//
// THE UNIT FOLLOWS THE OBLIGATION, which means this surface has two units and
// not one:
//
//   IMMINENT       individual flag rows, never coalesced.
//   CLINICAL/ROUTINE   coalesced by TEEN.
//
// The reason is not symmetry, it is what a group row costs. A coalesced row
// hides its members behind a count until someone expands it, and that is exactly
// right for a picture of accumulating low-tier signal — five routine flags on one
// teen IS one thing to look at — and exactly wrong for a flag with a 24-hour
// deadline, which must not be able to hide inside a group row. An imminent flag
// that a supervisor has to expand a chevron to find is an imminent flag they can
// miss.
//
// ═══ A TEEN CAN APPEAR TWICE, AND THAT IS CORRECT ═══
//
// Their imminent flags are individual rows in the Imminent band; their lower-tier
// flags coalesce into one teen row further down. The two entries mean different
// things — "this flag, now" and "this teen's accumulating signal" — and merging
// them would mean either burying the deadline or splitting the picture.
//
// ═══ THE BAND IS THE HEAD'S, AND THAT MAKES THE BANDS A PARTITION ═══
//
// `bandsFor` files an entry under `paneItemFor(entry).taskType`, and a teen
// group's head is its highest-priority member — so a teen carrying three clinical
// and two routine flags files under Clinical review, and the header counts all
// five. That is deliberate and it is the only arrangement where every flag is
// counted exactly once and no teen row is drawn twice:
//
//   · Counting only same-tier members would make "Clinical review — 26" exclude
//     routine flags that are on screen inside that band's rows, which is the
//     failure the header count exists to prevent ("a supervisor reading
//     'Imminent — 12' and finding forty flags behind it").
//   · Listing the teen in both bands draws the same person twice, and a reader
//     resolving from one copy would watch the other go stale.
//
// The row's own tier-composition line ("3 clinical · 2 routine") is what
// discloses the mix, in text, never in colour alone.

import { compareTasks, sortedOpen } from "@/lib/tasks/sort";
import { isFlagTask, type ListEntry } from "@/lib/tasks/list";
import { BAND_LABEL } from "@/lib/tasks/bands";
import { TIER_RANK, type TaskItem, type TaskType } from "@/lib/tasks/types";

/** The tiers that coalesce. Imminent is absent BY DESIGN — see the module note. */
const COALESCED_TYPES: ReadonlySet<TaskType> = new Set([
  "clinicalFlagReview",
  "routineFlagReview",
]);

export function coalescesByTeen(taskType: TaskType): boolean {
  return COALESCED_TYPES.has(taskType);
}

/** ═══ A SECOND COMPARATOR, AND IT IS A DELIBERATE DEVIATION ═══
 *
 *  Locked decision 8 is "no secondary prioritization logic anywhere", and
 *  `bands.ts` states the rule this breaks in as many words: "if you find yourself
 *  adding a `.sort()` below, the band model is wrong and the fix is upstream in
 *  the comparator." This IS that `.sort()`, and it is taken knowingly rather than
 *  slipped in.
 *
 *  WHY THE ONE COMPARATOR CANNOT DO IT: `compareTasks` orders TASKS by urgency —
 *  breach, tier, deadline. A teen row is not a task. Its salience is a property of
 *  the SET behind it: a teen carrying five clinical flags is a bigger clinical
 *  picture than a teen carrying one, and no ordering of individual flags expresses
 *  that, because the five could be interleaved with everyone else's by deadline
 *  and the picture would never appear.
 *
 *  ARRIVAL ORDERING IS THE THING THIS AVOIDS. Sorting these rows by age would
 *  make Monitoring a moderation queue — work through what came in, oldest first —
 *  and the surface's whole claim is that it is a clinical picture instead.
 *
 *  THE QUARANTINE: this orders TEEN GROUPS ONLY, inside the two coalesced bands.
 *  Imminent rows, every individual flag, and the members inside an expanded group
 *  all stay on `compareTasks`. So there is exactly one place a second ordering
 *  exists, it is named, and it cannot reach a row that carries a deadline.
 *
 *  KEYS, IN ORDER:
 *    1 · highest tier present   a teen with any clinical flag outranks one with
 *                               only routine, whatever the counts
 *    2 · flag count             then the bigger picture
 *    3 · oldest flag age        then the one that has been accumulating longest
 *    4 · teen id                total order, so the list cannot reshuffle between
 *                               renders (the same tiebreak `compareTasks` ends on)
 */
export function compareTeenGroups(
  a: TaskItem[],
  b: TaskItem[]
): number {
  const topTier = (xs: TaskItem[]) => Math.min(...xs.map((x) => TIER_RANK[x.taskType]));
  const oldest = (xs: TaskItem[]) => Math.min(...xs.map((x) => x.openedAt));

  const tierDelta = topTier(a) - topTier(b);
  if (tierDelta !== 0) return tierDelta;

  if (a.length !== b.length) return b.length - a.length;

  const ageDelta = oldest(a) - oldest(b);
  if (ageDelta !== 0) return ageDelta;

  return a[0].teenId.localeCompare(b[0].teenId);
}

/** How many of each tier a teen row stands for. Keyed by TASK TYPE rather than by
 *  the payload's tier, so it cannot disagree with the band the group was filed
 *  under — both read the same field. */
export function tierCounts(members: TaskItem[]): Map<TaskType, number> {
  const counts = new Map<TaskType, number>();
  for (const m of members) counts.set(m.taskType, (counts.get(m.taskType) ?? 0) + 1);
  return counts;
}

/** TODO-COPY. "3 clinical · 2 routine".
 *
 *  ═══ ONE WORD PER TIER, NOT THE BAND'S FULL LABEL ═══
 *
 *  The band header above already says "Clinical review — 26"; repeating "clinical
 *  review" inside the row would spend a third of a 12px line restating it. The
 *  short form is the band label's first word, DERIVED rather than written out, so
 *  a rename of the band cannot leave this line saying the old name — which is
 *  exactly the failure arch-B spent a commit cleaning up one layer down.
 *
 *  TIER ORDER, NOT COUNT ORDER. "3 clinical · 2 routine" always reads worst-first,
 *  so a reader scanning the column compares like with like; ordering by count
 *  would put a teen's five routine flags ahead of their one clinical flag and
 *  bury the more serious half.
 *
 *  ONE TIER PRESENT MEANS NO LINE. A teen carrying only routine flags gets `null`
 *  — the band header has already said "Routine review" and the count badge has
 *  already said how many, so "5 routine" is both facts a third time. */
export function compositionLabel(members: TaskItem[]): string | null {
  const counts = tierCounts(members);
  if (counts.size < 2) return null;
  return [...counts.entries()]
    .sort((a, b) => TIER_RANK[a[0]] - TIER_RANK[b[0]])
    .map(([type, n]) => `${n} ${BAND_LABEL[type].split(" ")[0].toLowerCase()}`)
    .join(" · ");
}

/** ═══ THE MONITORING LIST ═══
 *
 *  Imminent rows first, in comparator order, then teen groups. Both halves come
 *  out of ONE `sortedOpen` call, so an imminent row's position relative to every
 *  other imminent row is the priority sort's answer and nothing else's.
 *
 *  A TEEN WITH ONE LOWER-TIER FLAG IS A PLAIN ROW, not a group of one: a
 *  disclosure control over a single child is a control that does nothing, and a
 *  "1 flag" badge is a count nobody needs. Same rule the conversation coalescing
 *  already applies. */
export function monitoringEntriesFor(
  items: TaskItem[],
  now: number
): ListEntry[] {
  const sorted = sortedOpen(items, now).filter((i) => isFlagTask(i.taskType));

  const singles = sorted.filter((i) => !coalescesByTeen(i.taskType));

  const byTeen = new Map<string, TaskItem[]>();
  for (const item of sorted) {
    if (!coalescesByTeen(item.taskType)) continue;
    const bucket = byTeen.get(item.teenId);
    if (bucket) bucket.push(item);
    else byTeen.set(item.teenId, [item]);
  }

  const groups = [...byTeen.values()].sort(compareTeenGroups);

  const entries: ListEntry[] = singles.map((item) => ({
    kind: "item",
    id: item.id,
    item,
  }));

  for (const members of groups) {
    if (members.length === 1) {
      entries.push({ kind: "item", id: members[0].id, item: members[0] });
      continue;
    }
    entries.push({
      kind: "group",
      // TEEN-KEYED, so it cannot collide with the conversation-keyed group ids
      // Tasks builds — the two surfaces read each other's selection state in
      // neither direction today, and an id that could mean two things is how
      // that stops being true by accident.
      id: `teen:${members[0].teenId}`,
      groupBy: "teen",
      // `sorted` is already in comparator order, so the first member reached is
      // the highest-priority one — which is also what decides the band.
      head: members[0],
      members: [...members].sort((a, b) => compareTasks(a, b, now)),
    });
  }

  return entries;
}
