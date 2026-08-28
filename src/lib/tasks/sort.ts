// THE ONE GLOBAL PRIORITY SORT (§3, locked decision 8).
//
// ═══════════════════════════════════════════════════════════════════════════
// FOUR THINGS DERIVE FROM THIS COMPARATOR AND NOTHING ELSE:
//   · Next-up            = head of the globally sorted open set
//   · Tab list order     = the same sort, filtered to a domain
//   · Pre-selected item  = head of the active tab's list
//   · Default active tab = the domain of the Next-up item
//
// "NO SECONDARY PRIORITIZATION LOGIC ANYWHERE" is the locked decision, and the way
// it gets broken is not by someone writing a second comparator — it is by a
// component adding `.filter()` or a `.sort()` of its own "just for the cards". If
// you need an ordering, call one of the functions below. If none of them fits,
// the comparator is wrong and should be changed here.
//
// NO AI PRIORITIZATION (locked decision 9). The AI content on these items — flag
// rationale, billing recommendation — is per-item EXPLANATION produced upstream.
// It never touches order. There is nothing in this file that reads a payload.
// ═══════════════════════════════════════════════════════════════════════════
//
// SORTED BY PRIORITY, NEVER BY ARRIVAL (locked decision 1). `openedAt` appears
// only as the last tiebreak, and only to make the sort STABLE — two items
// identical on every other key need a deterministic order or the list reshuffles
// on re-render. It is not an arrival-order signal.

import { TASK_DOMAINS, isActiveEscalation, isBreached, slaRemaining, type TaskDomain, type TaskItem } from "@/lib/tasks/types";

/** The comparator. §3's sort key, in order:
 *
 *    isActiveEscalation DESC   an active escalation outranks everything
 *    isBreached         DESC   then anything past its SLA
 *    tierRank           ASC    then the tier ladder
 *    slaRemaining       ASC    then whatever runs out soonest
 *    openedAt           ASC    stable tiebreak
 *
 *  WHY BREACH OUTRANKS TIER: a breached orange flag beats an on-track red one.
 *  That is deliberate and it is the whole point of putting breach second — the
 *  ladder says what matters in the abstract, breach says what has already been
 *  failed. Reversing them would let a queue of on-track high-tier work hide an
 *  overdue low-tier item indefinitely.
 *
 *  `now` is a parameter, not a clock read. Two calls in one render must agree, and
 *  a comparator that read the clock per comparison could produce an inconsistent
 *  ordering mid-sort. */
export function compareTasks(a: TaskItem, b: TaskItem, now: number): number {
  // 1 · Active escalation first.
  const escA = isActiveEscalation(a) ? 1 : 0;
  const escB = isActiveEscalation(b) ? 1 : 0;
  if (escA !== escB) return escB - escA;

  // 2 · Breached before on-track.
  const brA = isBreached(a, now) ? 1 : 0;
  const brB = isBreached(b, now) ? 1 : 0;
  if (brA !== brB) return brB - brA;

  // 3 · Tier ladder.
  if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;

  // 4 · Soonest deadline. For two breached items this puts the MOST overdue
  //     first, because `slaRemaining` is negative and more negative is smaller.
  const remA = slaRemaining(a, now);
  const remB = slaRemaining(b, now);
  if (remA !== remB) return remA - remB;

  // 5 · Stable tiebreak. Not an arrival-order signal — see the module note.
  if (a.openedAt !== b.openedAt) return a.openedAt - b.openedAt;
  // Fully identical on every key: fall back to id so the order is total and the
  // list cannot reshuffle between renders.
  return a.id.localeCompare(b.id);
}

/** THE OPEN SET. `inProgress` counts as open — it is work still on the page. */
export function openTasks(items: TaskItem[]): TaskItem[] {
  return items.filter((i) => i.status !== "resolved");
}

/** The globally sorted open set. Every other ordering below is a view of this. */
export function sortedOpen(items: TaskItem[], now: number): TaskItem[] {
  return [...openTasks(items)].sort((a, b) => compareTasks(a, b, now));
}

/** NEXT-UP = head of the globally sorted open set (§3). Null when nothing is
 *  open, which is what hides the strip. */
export function nextUp(items: TaskItem[], now: number): TaskItem | null {
  return sortedOpen(items, now)[0] ?? null;
}

/** TAB LIST ORDER = the same sort, filtered to a domain (§3). Filtered AFTER
 *  sorting rather than sorted after filtering — same result here, but it makes it
 *  obvious in the code that there is one sort and the tabs are views of it. */
export function listForDomain(
  items: TaskItem[],
  domain: TaskDomain,
  now: number
): TaskItem[] {
  return sortedOpen(items, now).filter((i) => i.domain === domain);
}

/** PRE-SELECTED PANE ITEM = head of the active tab's list (§3). */
export function preselectedFor(
  items: TaskItem[],
  domain: TaskDomain,
  now: number
): TaskItem | null {
  return listForDomain(items, domain, now)[0] ?? null;
}

/** DEFAULT ACTIVE TAB ON LOAD = the domain of the Next-up item (§3).
 *
 *  Falls back to the first domain in fixed order when nothing is open — the tabs
 *  still render (they never hide, locked decision 7), so one has to be selected. */
export function defaultActiveDomain(items: TaskItem[], now: number): TaskDomain {
  return nextUp(items, now)?.domain ?? TASK_DOMAINS[0];
}

// ── Counts the header and the cards read ────────────────────────────────────

export interface DomainSummary {
  domain: TaskDomain;
  openCount: number;
  breachedCount: number;
  /** The worst breach in this domain, for the card's chip copy ("1 past 24h").
   *  Null when nothing is breached. */
  worstBreachMs: number | null;
}

/** Per-domain counts, in FIXED DOMAIN ORDER — never sorted by count, never
 *  hidden at zero (locked decision 7: tabs never reorder, cards never reshuffle;
 *  breach is expressed by treatment, never position). */
export function domainSummaries(items: TaskItem[], now: number): DomainSummary[] {
  const open = openTasks(items);
  return TASK_DOMAINS.map((domain) => {
    const mine = open.filter((i) => i.domain === domain);
    const breached = mine.filter((i) => isBreached(i, now));
    return {
      domain,
      openCount: mine.length,
      breachedCount: breached.length,
      worstBreachMs: breached.length
        ? Math.max(...breached.map((i) => now - i.slaDeadline))
        : null,
    };
  });
}

/** Header counts: "20 open · 4 overdue" (§1). */
export function headerCounts(items: TaskItem[], now: number) {
  const open = openTasks(items);
  return {
    open: open.length,
    overdue: open.filter((i) => isBreached(i, now)).length,
  };
}

/** "Closed today" per domain (§1). Counts RESOLVED items whose resolvedAt falls
 *  on the same calendar day as `now`.
 *
 *  Note the domains it reports: §1 names escalations, flags and billing —
 *  monitoring is deliberately absent from the header counters, because closing a
 *  green-flag review is not an achievement worth a counter. Monitoring still has
 *  its own tab and its own list. */
export function closedToday(items: TaskItem[], now: number): Partial<Record<TaskDomain, number>> {
  const sameDay = (a: number, b: number) => {
    const x = new Date(a);
    const y = new Date(b);
    return (
      x.getFullYear() === y.getFullYear() &&
      x.getMonth() === y.getMonth() &&
      x.getDate() === y.getDate()
    );
  };
  const out: Partial<Record<TaskDomain, number>> = {};
  for (const domain of ["escalation", "riskFlag", "billing"] as TaskDomain[]) {
    const n = items.filter(
      (i) =>
        i.domain === domain &&
        i.status === "resolved" &&
        i.resolvedAt !== undefined &&
        sameDay(i.resolvedAt, now)
    ).length;
    if (n > 0) out[domain] = n;
  }
  return out;
}

/** Every OPEN active escalation, in sort order — the Respond strip's rows.
 *
 *  ESCALATIONS ARE NEVER ONLY INSIDE A TAB (locked decision 10): this reads the
 *  whole item set, not the active domain, so the strip is identical from every
 *  tab. */
export function openEscalations(items: TaskItem[], now: number): TaskItem[] {
  return sortedOpen(items, now).filter(isActiveEscalation);
}
