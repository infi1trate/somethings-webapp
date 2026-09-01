// TIER BANDS — the sub-headers a list of forty rows needs and a list of four
// does not (§ Part 3).
//
// ═══ THE PROBLEM AT REAL VOLUME ═══
//
// At eight rows the priority sort is legible on its own: a reader sees the whole
// list and the order explains itself. At fifty it does not. The list is still
// perfectly ordered, but "where do the imminent ones stop" becomes a question the
// reader answers by scanning ages, and the answer is invisible because THE TIER IS
// NOT ON THE ROW — deliberately, and it must not go there (§3.3, alarm budget: a
// chip that is identical on every row in its neighbourhood is not information).
//
// A band header answers it once, for a run of rows, and costs one line per band.
//
// ═══ BANDS DO NOT REORDER ANYTHING — READ THIS BEFORE EDITING ═══
//
// Locked decision 8 is "no secondary prioritization logic anywhere", and a
// grouping function is exactly the shape a violation of it takes. This one does
// not violate it, by construction:
//
//   · A band's POSITION is its first member's position in the one sorted list.
//   · A band's MEMBERS are in that same list's order, unchanged.
//   · Nothing is sorted here. There is no comparator in this file, and the only
//     ordering that exists is the order `entries` arrived in.
//
// That is the identical contract `listEntriesFor` already uses for coalesced
// groups ("a group's position is its head's position"). Bands are the same idea
// one level up. If you find yourself adding a `.sort()` below, the band model is
// wrong and the fix is upstream in the comparator, not here.
//
// ═══ WHY "RED FIRST" IS NOT ENFORCED HERE ═══
//
// The brief asks for the red band before the clinical-review band. That is not a
// rule this file applies — it FALLS OUT of TIER_RANK (red 2 < orange 3) via the
// comparator. Enforcing it here as well would create a second place that decides
// order, and the two would eventually disagree. If red ever stops coming first,
// the comparator changed and that is where to look.
//
// One consequence worth stating: Billing's two types share tierRank 4, so which
// billing band leads depends on which one holds the more urgent item. That is
// correct — an intake breaching in two hours outranks a re-review due Friday, and
// a fixed band order would bury it.

import { paneItemFor, type ListEntry } from "@/lib/tasks/list";
import { itemsOf } from "@/lib/tasks/list";
import type { TaskDomain, TaskItem, TaskType } from "@/lib/tasks/types";

/** TODO-COPY. The band each task type belongs to.
 *
 *  "Imminent" rather than "Red": the band names the URGENCY, not the colour
 *  chip that used to sit on the row. A reader who is colourblind gets the same
 *  sentence, and the word survives being read aloud. */
export const BAND_LABEL: Record<TaskType, string> = {
  activeEscalation: "Active",
  escalationDocumentation: "Documentation",
  redFlagReview: "Imminent",
  orangeFlagReview: "Clinical review",
  intakeBillingReview: "Intake",
  monthlyReReview: "Monthly re-review",
  // Monitoring has ONE type, so its band is never rendered — see `bandsFor`.
  standardFlagReview: "Monitoring",
};

export interface TierBand {
  /** The task type, which is also the band key. */
  id: TaskType;
  label: string;
  entries: ListEntry[];
  /** How many TASKS the band stands for — not how many rows. A coalesced group
   *  is one row and five flags, and the header counts the work, not the
   *  furniture. Getting this backwards would mean a supervisor reading
   *  "Imminent — 12" and finding forty flags behind it. */
  taskCount: number;
}

/** Split a domain's entries into bands, in first-appearance order.
 *
 *  Returns a SINGLE band with `label: null` semantics handled by the caller when
 *  the domain has only one — Monitoring, and any domain whose second type happens
 *  to be empty today. A header over the whole list saying what the tab already
 *  says is chrome. */
export function bandsFor(entries: ListEntry[]): TierBand[] {
  const byId = new Map<TaskType, TierBand>();
  const order: TaskType[] = [];

  for (const entry of entries) {
    // A group's band is its head's band. Groups never span task types — taskType
    // is half the coalescing key — so every member agrees with the head, and this
    // cannot silently pick one of two answers.
    const id = paneItemFor(entry).taskType;
    let band = byId.get(id);
    if (!band) {
      band = { id, label: BAND_LABEL[id], entries: [], taskCount: 0 };
      byId.set(id, band);
      order.push(id);
    }
    band.entries.push(entry);
    band.taskCount += itemsOf(entry).length;
  }

  return order.map((id) => byId.get(id)!);
}

/** Whether the headers should render at all. One band is a header that repeats
 *  the tab label; two or more is a navigational aid. */
export function bandsAreMeaningful(bands: TierBand[]): boolean {
  return bands.length > 1;
}

/** ═══ RETIREMENT: WHAT A CLEARED BAND SAYS ═══
 *
 *  When the last row in a band resolves, the band does not simply vanish. Vanishing
 *  reads as a glitch — the header a reader was working under disappears from under
 *  their cursor and the rows below jump up to meet them. It also throws away the
 *  one piece of information the moment actually contains: that this tier is DONE.
 *
 *  So the band stays for a beat, its rows compress, and the header reports the
 *  clearance. Somethings voice: a fact, not a celebration. No exclamation mark, no
 *  tick, no "Nice work" — a supervisor who has just cleared twelve imminent flags
 *  does not need to be congratulated by a list.
 *
 *  TODO-COPY. */
export function retiredBandLabel(label: string, closedToday: number): string {
  return `${label} — cleared · ${closedToday} today`;
}

/** How many of a band's tasks were resolved today. Feeds the retirement line.
 *
 *  Counts by TASK TYPE, not by domain: a cleared "Imminent" band reports the red
 *  flags closed today, not every risk-flag row of any tier. `closedToday` in
 *  sort.ts answers the domain-level question for the tab cards; this is the band
 *  scoped version of the same fact, and both read the same `resolvedAt`. */
export function closedTodayInBand(
  items: TaskItem[],
  taskType: TaskType,
  now: number
): number {
  const day = new Date(now);
  return items.filter((i) => {
    if (i.taskType !== taskType) return false;
    if (i.status !== "resolved" || i.resolvedAt === undefined) return false;
    const r = new Date(i.resolvedAt);
    return (
      r.getFullYear() === day.getFullYear() &&
      r.getMonth() === day.getMonth() &&
      r.getDate() === day.getDate()
    );
  }).length;
}

/** TODO-COPY. The header line: "Imminent — 12". An em dash, not a hyphen. */
export function bandHeaderLabel(band: TierBand): string {
  return `${band.label} — ${band.taskCount}`;
}

/** Present only so a caller can name the domain in an accessible label without
 *  importing the label table twice. */
export type BandDomain = TaskDomain;
