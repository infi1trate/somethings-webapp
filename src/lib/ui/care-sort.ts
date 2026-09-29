// ═══════════════════════════════════════════════════════════════════════════
// COLUMN SORTING ON CARE REVIEWS (rework §3)
//
// ═══ HOW THIS RECONCILES WITH THE SINGLE-COMPARATOR DECISION ═══
//
// `compareTasks` is the one ordering on this surface and §3 does not replace
// it. It reconciles in three parts, and all three matter:
//
//  1 · THE COMPARATOR STILL SETS THE DEFAULT. `null` here means "no user
//      sort", and the list renders in the order `listEntriesForDomains`
//      produced — oldest first, which fell out of the null SLA rather than
//      being added as a rule. There is no "default" sort key in this module
//      because the default is not a key, it is the absence of one.
//  2 · A USER SORT IS AN EXPLICIT, VISIBLE OVERRIDE. Not a preference that
//      leaks, not a smarter default — a state the reader turned on and can see
//      is on.
//  3 · SESSION-SCOPED, NEVER PERSISTED. §3's own reasoning, which is the
//      filter rule's: "a supervisor returning to a list ordered by something
//      they set days ago, without remembering, misreads the list." On a
//      clinical queue that misreading is the dangerous direction — a list that
//      looks like it is in urgency order and is in alphabetical order.
//
// ═══ WHY THE KEYS ARE HERE AND NOT IN THE COMPONENT ═══
//
// A sort key is a claim about what a column means. `cycle` sorts by cadence
// position and not by its rendered label, because "120-day" sorts before
// "30-day" as a string — the trap `review-cycle.ts` records. Keeping the keys
// beside each other is what makes that comparison visible.

import { cycleSortKey } from "@/lib/tasks/review-cycle";
import type { TaskItem } from "@/lib/tasks/types";

/** The three §3 names, and they match the column headers exactly — §6.2's
 *  rule, which is why this is `cycle` and not `type` or `review`. */
export type CareSortColumn = "mentee" | "cycle" | "age";

export type SortDirection = "asc" | "desc";

export interface CareSort {
  column: CareSortColumn;
  dir: SortDirection;
}

/** NEEDS-COPY-NICOLE, all three. The column's name as the sort control says
 *  it — the same string the header renders, so the control and the column
 *  cannot drift apart. */
export const SORT_LABEL: Record<CareSortColumn, string> = {
  mentee: "Mentee",
  cycle: "Cycle",
  age: "Review age",
};

/** ═══ WHAT EACH DIRECTION MEANS, IN WORDS ═══
 *  NEEDS-COPY-NICOLE throughout.
 *
 *  "Ascending" is meaningless to a reader looking at a queue — ascending WHAT?
 *  So the accessible name and the indicator's tooltip say the effect rather
 *  than the direction: A to Z, first review first, oldest first.
 *
 *  AGE IS THE ONE THAT INVERTS AND IT IS WORTH BEING EXPLICIT. A larger age is
 *  an OLDER item, so ascending age is NEWEST first — the opposite of the
 *  list's default. Labelling that "ascending" would be true and useless.
 */
export const SORT_MEANING: Record<CareSortColumn, Record<SortDirection, string>> = {
  mentee: { asc: "A to Z", desc: "Z to A" },
  cycle: { asc: "first review first", desc: "later reviews first" },
  age: { asc: "newest first", desc: "oldest first" },
};

/** The entry shape this module needs. Structural rather than importing
 *  `ListEntry`, so the sort has no opinion about grouping. */
export interface SortableEntry {
  id: string;
  at: number;
}

/**
 * Apply a user sort, or return the input untouched.
 *
 * UNTOUCHED IS THE POINT when `sort` is null: returning the same array
 * reference means the default path costs nothing and, more importantly, cannot
 * accidentally reorder. A `[...entries].sort(() => 0)` would be stable in
 * modern engines and still invites someone to "improve" the comparator later.
 *
 * NEVER MUTATES. `Array.prototype.sort` sorts in place, and `entries` is the
 * memoised list every other reader shares — sorting it in place would reorder
 * the list behind the pane's selection lookup.
 */
export function applyCareSort<T extends SortableEntry>(
  entries: readonly T[],
  sort: CareSort | null,
  itemFor: (entry: T) => TaskItem
): readonly T[] {
  if (!sort) return entries;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    const d = compare(sort.column, a, b, itemFor) * sign;
    /* ═══ A TOTAL ORDER, ALWAYS ═══
       Two entries that tie on the key must not swap between renders — a list
       that reshuffles under a stable sort reads as broken. The id is the
       tie-break because it is the only field guaranteed unique, and the
       direction does NOT apply to it: reversing the tie-break would make
       `desc` a different grouping of ties rather than the reverse of `asc`. */
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

function compare<T extends SortableEntry>(
  column: CareSortColumn,
  a: T,
  b: T,
  itemFor: (entry: T) => TaskItem
): number {
  if (column === "age") {
    /* ASCENDING AGE IS NEWEST FIRST. `at` is an instant, so a LARGER `at` is a
       younger item; comparing the instants ascending puts the newest first,
       which is what `SORT_MEANING.age.asc` says. */
    return b.at - a.at;
  }
  if (column === "cycle") {
    return cycleSortKey(itemFor(a).taskType) - cycleSortKey(itemFor(b).taskType);
  }
  /* MENTEE — alphabetical by the displayed name, with `localeCompare` rather
     than `<`: the roster has no non-ASCII names today and a byte comparison
     would order them wrongly the day it does. */
  return itemFor(a).teenDisplayName.localeCompare(itemFor(b).teenDisplayName);
}

/** ═══ THE CLICK CYCLE, AND WHY IT RETURNS TO DEFAULT ═══
 *  A column goes asc → desc → off. The third state is what §3 means by "a way
 *  back to default ordering must exist" — though not the whole of it, because a
 *  third click is not OBVIOUS. The visible reset control is the obvious one;
 *  this is the path for a reader who is already clicking the header.
 *  A DIFFERENT COLUMN STARTS AT `asc`, rather than inheriting the last
 *  direction — inheriting means clicking "Mentee" after "oldest first" silently
 *  gives Z-to-A. */
export function nextSort(current: CareSort | null, column: CareSortColumn): CareSort | null {
  if (current?.column !== column) return { column, dir: "asc" };
  if (current.dir === "asc") return { column, dir: "desc" };
  return null;
}
