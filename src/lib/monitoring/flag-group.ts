// ═══════════════════════════════════════════════════════════════════════════
// ONE ROW PER CONVERSATION (addendum §3.1)
//
// ═══ THE DEFECT, MEASURED ═══
//
// On `flag-repeat-pattern` the queue rendered nine rows, three of which were
// Marcus L. ↔ Brandon Forant at 8h, 5h and 2h — and EACH of those three read
// "3 in this conversation". The list was simultaneously un-coalesced and
// telling the supervisor it was coalesced. The group header said "Teen safety
// — 9", counting flags while the rows described conversations.
//
// The coalesce LABEL has been right since arch-D; what never happened is the
// coalescing it describes.
//
// ═══ THE UNIT CHANGES, SO THE COMPARATOR'S KEYS HAVE TO SAY WHICH MEMBER ═══
//
// `compareEvents` has five steps and every one of them was a fact about one
// flag. Over a set, three of the five need a rule for WHICH member answers,
// and picking the wrong member is how a queue quietly stops being ordered:
//
//  1 ESCALATION OPEN — ANY member. It is a fact about the teen, so every
//    member carries the same answer and "any" is also "all".
//  2 CATEGORY RANK — the HIGHEST-RANKING member, not the newest and not the
//    first. A conversation holding one self-harm flag among four routine ones
//    IS a self-harm conversation, and taking any other member would let four
//    quiet flags bury the one that matters.
//  3 REPEAT PATTERN — STRUCTURAL now rather than a tiebreak. The row IS the
//    set, so `count >= FLAG_PATTERN_MIN` is a property of the row itself.
//  4 NO MENTOR REPLY — ANY member. One unanswered flagged message in a
//    conversation is an unanswered conversation; requiring all of them would
//    let a single courtesy reply clear the signal.
//  5 AGE — the OLDEST member. A conversation whose oldest flag has waited 20h
//    has waited 20h. Taking the newest would let a busy conversation sink
//    below a quiet one it has been outrunning all shift.
//
// ═══ WHAT THIS IS NOT ═══
//
// It is not a re-sort and not a second ordering. `compareGroups` is
// `compareEvents` with its five keys read off a set instead of off an element,
// in the same order, and the tie-break is still an id comparison so the order
// is total. THERE IS STILL NO SECONDARY ORDERING ANYWHERE ON THIS SURFACE.
//
// AND IT IS NOT A GROUPING LAYER. A group header over a conversation would put
// the teen's name in the header and leave the row saying nothing — which is the
// arch-E mistake, one level down. The conversation IS the row.

import { flagCategoryRank, FLAG_PATTERN_MIN } from "@/lib/monitoring/constants";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import { compareEvents } from "@/lib/monitoring/event";

export interface FlagGroup {
  /** The conversation's id — the row's identity, and what selection is keyed
   *  on. A row survives its members being resolved one at a time; it leaves
   *  when the last one goes. */
  id: string;
  teenId: string;
  teenName: string;
  mentorId: string;
  mentorName: string;
  /** Sorted by the event comparator, so the pane's first flag is the one the
   *  queue's own ordering would have put first. */
  events: MonitoringEvent[];
  /** ═══ THE COMPARATOR'S FIVE KEYS, DERIVED ONCE ═══
   *  Computed at build time rather than inside the sort, so an O(n log n)
   *  comparison stays O(n log n) and every key is inspectable in a test. */
  escalationOpen: boolean;
  worstCategory: string | null;
  anyUnanswered: boolean;
  oldestAt: number;
}

export function groupByConversation(events: MonitoringEvent[]): FlagGroup[] {
  const byConversation = new Map<string, MonitoringEvent[]>();
  for (const e of events) {
    const k = e.conversationId;
    const at = byConversation.get(k);
    if (at) at.push(e);
    else byConversation.set(k, [e]);
  }

  const out: FlagGroup[] = [];
  for (const [id, members] of byConversation) {
    const sorted = [...members].sort(compareEvents);
    /* THE HIGHEST-RANKING CATEGORY, WHICH IS THE LOWEST RANK NUMBER — see the
       module note on why it is not the newest. `sorted[0]` is NOT a shortcut
       for it: the comparator's first step is escalation, which every member
       answers identically, so the head of the sorted list is decided by
       category only when nothing above it differs. Computed directly. */
    let worstCategory: string | null = null;
    let worstRank = Number.POSITIVE_INFINITY;
    for (const e of sorted) {
      const r = flagCategoryRank(e.category);
      if (r < worstRank) {
        worstRank = r;
        worstCategory = e.category;
      }
    }
    out.push({
      id,
      teenId: sorted[0].teenId,
      teenName: sorted[0].teenName,
      mentorId: sorted[0].mentorId,
      mentorName: sorted[0].mentorName,
      events: sorted,
      escalationOpen: sorted.some((e) => e.escalationOpen),
      worstCategory,
      anyUnanswered: sorted.some((e) => !e.mentorReplied),
      oldestAt: Math.min(...sorted.map((e) => e.at)),
    });
  }
  return out;
}

/** True when the row itself is the repeat pattern — see step 3. */
export function isRepeatPattern(g: FlagGroup): boolean {
  return g.events.length >= FLAG_PATTERN_MIN;
}

/** `compareEvents`' five steps, read off a set. Same order, same tie-break. */
export function compareGroups(a: FlagGroup, b: FlagGroup): number {
  if (a.escalationOpen !== b.escalationOpen) return a.escalationOpen ? -1 : 1;

  const rank = flagCategoryRank(a.worstCategory) - flagCategoryRank(b.worstCategory);
  if (rank !== 0) return rank;

  const aPattern = isRepeatPattern(a);
  const bPattern = isRepeatPattern(b);
  if (aPattern !== bPattern) return aPattern ? -1 : 1;

  if (a.anyUnanswered !== b.anyUnanswered) return a.anyUnanswered ? -1 : 1;

  if (a.oldestAt !== b.oldestAt) return a.oldestAt - b.oldestAt;
  return a.id.localeCompare(b.id);
}

export function sortGroups(groups: FlagGroup[]): FlagGroup[] {
  return [...groups].sort(compareGroups);
}
