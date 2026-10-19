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

import type { ClosedCareReview } from "@/lib/tasks/closed-review";
import { compareTasks, listForDomain, sortedOpen } from "@/lib/tasks/sort";
import type { TaskDomain, TaskItem, TaskType } from "@/lib/tasks/types";

/** The flag task type — the only one that coalesces.
 *
 *  A SET OF ONE, KEPT AS A SET. It held the three tier types; a single `===`
 *  would read as cheaper and would have to be found and widened the moment a
 *  second coalescing type exists. The predicate is the authority either way. */
const FLAG_TASK_TYPES: ReadonlySet<TaskType> = new Set(["riskFlagReview"]);

export function isFlagTask(taskType: TaskType): boolean {
  return FLAG_TASK_TYPES.has(taskType);
}

export type ListEntry =
  | { kind: "item"; id: string; item: TaskItem }
  | {
      kind: "group";
      id: string;
      /** WHAT THE GROUP STANDS FOR. Tasks groups a CONVERSATION's flags; arch-B's
       *  Monitoring groups a TEEN's, across two tiers — different rows, different
       *  anatomy, and a renderer that guessed from the members would guess wrong
       *  on a teen whose flags happen to share a conversation. Absent means
       *  conversation, which is every group this file builds. */
      groupBy?: "conversation" | "teen";
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

/** THE LIST FOR ONE DOMAIN: its sorted open items, with flags coalesced. */
export function listEntriesFor(
  items: TaskItem[],
  domain: TaskDomain,
  now: number
): ListEntry[] {
  return coalesce(listForDomain(items, domain, now), now);
}

/** ═══ MANY DOMAINS, ONE LIST (arch-G, G2) ═══
 *
 *  Tasks hosts more than one task type now — billing reviews and the two
 *  escalation tasks — and those live in two DOMAINS (`billing`, `escalation`),
 *  because the domain is what the ledger and the SLA table are keyed on. So the
 *  surface can no longer ask for "the list for a domain".
 *
 *  NOTHING COALESCES ACROSS DOMAINS, and that is not a rule this function has to
 *  enforce: coalescing keys on `(taskType, objectId)` and a task type belongs to
 *  exactly one domain, so a group cannot span two. Asserted in the tests rather
 *  than left as a happy accident.
 *
 *  ONE SORT, then one coalesce — not per-domain lists concatenated, which would
 *  put every escalation above every billing review by construction rather than
 *  by the comparator, and would hide a comparator regression behind a grouping. */
export function listEntriesForDomains(
  items: TaskItem[],
  domains: readonly TaskDomain[],
  now: number
): ListEntry[] {
  const set = new Set(domains);
  return coalesce(
    sortedOpen(items, now).filter((i) => set.has(i.domain)),
    now
  );
}

/** ═══ THE SUBMITTED SET (Care Reviews rework §5.1) ═══
 *
 *  `listEntriesForDomains` above runs `sortedOpen`, so it can only ever build
 *  the open list. The Submitted tab needs the other half.
 *
 *  ═══ NO COALESCING, AND THAT IS NOT AN OVERSIGHT ═══
 *
 *  The open list groups a conversation's flags because several open items about
 *  one conversation are one piece of work. A submitted review is a decision
 *  that has already been made, and two decisions about one teen are two
 *  entries in a history — collapsing them would hide one behind a disclosure
 *  control on a list whose job is to show what happened.
 *
 *  ═══ NEWEST FIRST, WHICH IS THE OPPOSITE OF THE OPEN LIST ═══
 *
 *  Open runs oldest-first because the oldest thing is the most overdue. A
 *  history runs newest-first because the last thing you did is the thing you
 *  are most likely looking for. Ordered by WHEN IT WAS SUBMITTED, not by when
 *  the item opened — the log is of decisions, not of arrivals.
 */
export function closedEntries(
  records: readonly ClosedCareReview[],
  domains: readonly TaskDomain[]
): ListEntry[] {
  /* ═══ THE RECORD IS THE ROW (Closed-tab pack §0.1) ═══
     This resolved `{ id, at }` pairs against the live fixture and DROPPED any id
     that no longer resolved. A closed review is now a self-contained snapshot,
     so the row is built from what was submitted — nothing is looked up, and
     nothing can drift or disappear because the fixture moved.
     DE-DUPLICATED BY ID, FIRST WINS: the caller passes the store's records
     before the fixture history, so a review the tester submitted outranks a
     fixture entry that happened to share its id. */
  const set = new Set(domains);
  const seen = new Set<string>();
  const out: ClosedCareReview[] = [];
  for (const r of records) {
    if (seen.has(r.id) || !set.has(r.snapshot.item.domain)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .map((r) => ({ kind: "item" as const, id: r.id, item: r.snapshot.item }));
}

/** ═══ EVERY FLAG — AND THERE IS ONE DOMAIN NOW (Phase 4) ═══
 *
 *  This said "Monitoring is one surface over three tiers, and the tiers do not
 *  share a domain… kept because the routine tier's SLA and its ledger mapping
 *  genuinely differ". Both of those differences were themselves tier artifacts:
 *  the SLA was one of three fabricated numbers (now `null`) and the ledger
 *  mapping sent both domains to the same `RISK_FLAG_CLOSED` event anyway.
 *
 *  THE FILTER IS STILL THE TASK TYPE, NOT THE DOMAIN, and the reason survives
 *  the collapse: `isFlagTask` is the authority on what coalesces, so making it
 *  the authority on what the queue holds keeps the two from drifting into a list
 *  containing something that does not group and a group containing something not
 *  in the list.
 *
 *  ORDER IS THE ONE COMPARATOR'S, unchanged: the items are sorted before they are
 *  grouped, exactly as a single domain's are. */
export function flagEntriesFor(items: TaskItem[], now: number): ListEntry[] {
  return coalesce(
    sortedOpen(items, now).filter((i) => isFlagTask(i.taskType)),
    now
  );
}

/** The grouping half, shared by both. Walks an ALREADY-SORTED list once and
 *  attaches each flag to its group as it is encountered — which is what
 *  guarantees a group lands exactly where its head would have, with no second
 *  comparator and no re-sort. */
function coalesce(sorted: TaskItem[], now: number): ListEntry[] {

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
