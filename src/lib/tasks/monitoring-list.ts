// ═══ WHAT IS LEFT OF THIS MODULE, AND WHAT TOOK THE REST ═══
//
// It held arch-B's hybrid unit of review: imminent flag rows never coalesced,
// clinical and routine flags coalesced by teen, each teen row filed under the
// worst tier it carried. That whole arrangement was a consequence of the SEVERITY
// TIERS, and arch-mon Phase 1 removed the tiers — the page was asserting clinical
// severity it could not compute, and the grouping the tiers justified went with
// them. Monitoring now builds its own events in `lib/monitoring/event.ts`,
// groups them by REVIEW SUBJECT, and orders them with one five-step comparator.
//
// TWO FUNCTIONS SURVIVE, BOTH TASKS-FACING:
//   · `coalescesByTeen` — read by `row-emphasis.ts`, which decides whether a row
//     emphasises the person or the deadline. Still keyed on task type.
//   · `compositionLabel` — read by `worklist.tsx` for a coalesced row's mix.
//
// The tier vocabulary below is therefore class (c) under this phase's audit: a
// data-model fact about task types that Tasks still consumes, and which nothing
// on Monitoring renders or sorts by.

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

/** How many of each tier a teen row stands for. Keyed by TASK TYPE rather than by
 *  the payload's tier, so it cannot disagree with the band the group was filed
 *  under — both read the same field. */

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
/** How many of each type a coalesced group holds. Local since arch-mon Phase 1:
 *  `compositionLabel` is its only reader now that Monitoring builds its own
 *  events. */
function tierCounts(members: TaskItem[]): Map<TaskType, number> {
  const counts = new Map<TaskType, number>();
  for (const m of members) counts.set(m.taskType, (counts.get(m.taskType) ?? 0) + 1);
  return counts;
}

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
/* ═══ `monitoringEntriesFor` IS GONE (arch-mon Phase 1) ═══
   It built Monitoring's hybrid unit of review: imminent flags as individual
   rows, the two lower TIERS coalesced by teen. The tiers were the severity
   taxonomy this phase removed, so the grouping they justified went with them —
   Monitoring now groups by REVIEW SUBJECT and builds its own events in
   `lib/monitoring/event.ts`.
   WHAT SURVIVES HERE, and why the file did not go with it: `coalescesByTeen`
   (read by `row-emphasis.ts`, which Tasks uses) and `compositionLabel` (read by
   `worklist.tsx`). Both are Tasks-facing now. */
