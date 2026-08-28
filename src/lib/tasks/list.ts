// THE WORKLIST'S ENTRIES — items and coalesced groups (§4).
//
// COALESCING KEY IS (taskType, objectId), matching the Activity spec's key so one
// conversation's flags group the same way on both surfaces.
//
// ONLY FLAGS COALESCE. §4 says "flags group by (taskType, objectId)" and means it:
// an escalation is a single event about a person, and a billing review's objectId
// is a survey id that is unique per review — grouping either would only ever
// produce groups of one, while making the code look as though it might not.
// `isFlagTask` is the explicit gate.
//
// GROUPS NEVER SPAN DOMAINS (§4). That is automatic, because taskType determines
// domain and taskType is half the key — but it is asserted in the tests rather
// than left as a happy accident, since a future key that dropped taskType would
// break it silently.
//
// EVERYTHING IS DERIVED FROM THE ONE SORT. A group's position is its head's
// position; members are in comparator order; the head IS the highest-priority
// child, which is what "selecting the parent selects its highest-priority child"
// resolves to. No second ordering anywhere (locked decision 8).
//
// RESOLVING IS ALSO DERIVED, which is why T4 needs no group bookkeeping: groups
// are computed from the OPEN set, so resolving a child drops it and the group
// recomputes one smaller. Resolving down to one member turns the group into a
// plain row, and resolving the last one removes the row entirely — §4's "resolving
// the last child resolves the group row", for free.

import { compareTasks, listForDomain } from "@/lib/tasks/sort";
import type { TaskDomain, TaskItem, TaskType } from "@/lib/tasks/types";

/** The flag task types — the only ones that coalesce. */
const FLAG_TASK_TYPES: ReadonlySet<TaskType> = new Set([
  "redFlagReview",
  "orangeFlagReview",
  "standardFlagReview",
]);

export function isFlagTask(taskType: TaskType): boolean {
  return FLAG_TASK_TYPES.has(taskType);
}

export type ListEntry =
  | { kind: "item"; id: string; item: TaskItem }
  | {
      kind: "group";
      id: string;
      /** Highest-priority child — the pane selects this when the parent is
       *  selected (§4), and the row's identity comes from it. */
      head: TaskItem;
      /** Comparator order. Length is always ≥ 2; a group of one is emitted as an
       *  `item` instead, because a disclosure control over a single child is a
       *  control that does nothing. */
      members: TaskItem[];
    };

/** The entry a selection resolves to in the pane. For a group that is its head. */
export function paneItemFor(entry: ListEntry): TaskItem {
  return entry.kind === "item" ? entry.item : entry.head;
}

/** Every task an entry stands for — what a resolve acts on. */
export function itemsOf(entry: ListEntry): TaskItem[] {
  return entry.kind === "item" ? [entry.item] : entry.members;
}

/** THE LIST FOR A TAB: the domain's sorted open items, with flags coalesced.
 *
 *  Built by walking the already-sorted list once and attaching each flag to its
 *  group as it is encountered. Walking the sorted list rather than grouping and
 *  re-sorting is what guarantees a group lands exactly where its head would have
 *  — no second comparator, no re-sort. */
export function listEntriesFor(
  items: TaskItem[],
  domain: TaskDomain,
  now: number
): ListEntry[] {
  const sorted = listForDomain(items, domain, now);

  const groups = new Map<string, TaskItem[]>();
  for (const item of sorted) {
    if (!isFlagTask(item.taskType)) continue;
    const key = `${item.taskType}::${item.objectId}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const emitted = new Set<string>();
  const entries: ListEntry[] = [];

  for (const item of sorted) {
    if (!isFlagTask(item.taskType)) {
      entries.push({ kind: "item", id: item.id, item });
      continue;
    }
    const key = `${item.taskType}::${item.objectId}`;
    if (emitted.has(key)) continue;
    emitted.add(key);

    const members = groups.get(key)!;
    if (members.length === 1) {
      // A GROUP OF ONE IS A PLAIN ROW. No count badge, no disclosure — there is
      // nothing behind it.
      entries.push({ kind: "item", id: item.id, item });
      continue;
    }
    entries.push({
      kind: "group",
      id: `group:${key}`,
      // `sorted` is already in comparator order, so the first member reached is
      // the highest-priority one.
      head: members[0],
      members: [...members].sort((a, b) => compareTasks(a, b, now)),
    });
  }

  return entries;
}

/** TODO-COPY. The coalesce count badge: "3 flags". */
export function coalesceLabel(count: number): string {
  return `${count} flags`;
}
