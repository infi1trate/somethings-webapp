// ═══════════════════════════════════════════════════════════════════════════
// THE ROW'S UNIT IS A CONVERSATION (addendum §3.1)
//
// The comparator's five steps were facts about ONE flag. Over a set, three of
// them need a rule for which member answers — and every one of those three is
// a place where the queue could quietly stop being ordered while still looking
// sorted. So each gets a test that fails if the wrong member is consulted, and
// the wrong member is a PLAUSIBLE one in every case: the newest flag rather
// than the oldest, the first category rather than the worst, all members
// rather than any.
//
// WHAT IS NOT TESTED HERE: that the rows render, which is `monitoring-states`'
// job, and the five steps themselves, which `event.test.ts` owns and which
// this file deliberately does not restate — `compareGroups` is `compareEvents`
// with its keys read off a set, and duplicating its cases would mean two
// places to update when a step changes.

import { describe, expect, it } from "vitest";
import {
  compareGroups,
  groupByConversation,
  isRepeatPattern,
  sortGroups,
} from "@/lib/monitoring/flag-group";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import { FLAG_PATTERN_MIN } from "@/lib/monitoring/constants";
import type { TaskItem } from "@/lib/tasks/types";

const NOW = 1_760_000_000_000;
const HOUR = 3_600_000;

/** Real playbook ids, because `flagCategoryRank` reads the published grouping
 *  and an invented string would rank as UNRANKED and hide a mis-keyed sort. */
const IMMINENT = "SELF_HARM_IN_PROGRESS";
const CLINICAL = "PASSIVE_SUICIDAL_IDEATION";
const ROUTINE = "ASSESSMENT_BELOW_THRESHOLD";

function ev(o: Partial<MonitoringEvent> & { id: string }): MonitoringEvent {
  return {
    teenId: "t1",
    teenName: "Ava M.",
    mentorId: "m1",
    mentorName: "Brandon Forant",
    conversationId: "c1",
    at: NOW - HOUR,
    category: ROUTINE,
    escalationOpen: false,
    patternCount: 1,
    mentorReplied: true,
    flag: {} as TaskItem,
    ...o,
  };
}

describe("grouping", () => {
  it("puts one row per conversation, not one per flag", () => {
    const groups = groupByConversation([
      ev({ id: "a", conversationId: "c1" }),
      ev({ id: "b", conversationId: "c1" }),
      ev({ id: "c", conversationId: "c2" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.events.length).sort()).toEqual([1, 2]);
  });

  it("is the row that says how many, so the count describes what a reader sees", () => {
    /* ═══ THE DEFECT THIS EXISTS FOR ═══
       MEASURED on `flag-repeat-pattern` before the change: three separate
       Marcus L. rows, each reading "3 in this conversation" — the list was
       un-coalesced and telling the supervisor it was coalesced. */
    const [g] = groupByConversation([
      ev({ id: "a" }),
      ev({ id: "b" }),
      ev({ id: "c" }),
    ]);
    expect(g.events).toHaveLength(3);
    expect(isRepeatPattern(g)).toBe(true);
  });

  it("calls a set a pattern at exactly the published minimum, and not below", () => {
    /* THE CONSTANT IS 2 — asserted, because the two cases below are chosen
       from it and would silently stop testing the boundary if it moved. The
       first draft of this test assumed 3 and failed here rather than passing
       on the wrong side of the line. */
    expect(FLAG_PATTERN_MIN).toBe(2);
    const below = groupByConversation([ev({ id: "a" })])[0];
    const at = groupByConversation([ev({ id: "a" }), ev({ id: "b" })])[0];
    expect(isRepeatPattern(below)).toBe(false);
    expect(isRepeatPattern(at)).toBe(true);
  });

  it("orders each conversation's own flags by the event comparator", () => {
    /* The pane opens on `events[0]`, so the member a reader sees first has to
       be the one the queue's own ordering would have put first. */
    const [g] = groupByConversation([
      ev({ id: "routine", category: ROUTINE }),
      ev({ id: "imminent", category: IMMINENT }),
    ]);
    expect(g.events[0].id).toBe("imminent");
  });
});

describe("the three keys that have to name a member", () => {
  it("2 · takes the WORST category, not the first or the newest", () => {
    /* ═══ THE FAILURE THIS PREVENTS ═══
       A conversation holding one self-harm flag among four routine ones IS a
       self-harm conversation. Keying on any other member lets four quiet
       flags bury the one that matters — on the surface whose whole job is
       noticing it. */
    const worst = groupByConversation([
      ev({ id: "r1", conversationId: "c1", category: ROUTINE, at: NOW - 5 * HOUR }),
      ev({ id: "i1", conversationId: "c1", category: IMMINENT, at: NOW - HOUR }),
      ev({ id: "r2", conversationId: "c1", category: ROUTINE, at: NOW - 2 * HOUR }),
    ])[0];
    expect(worst.worstCategory).toBe(IMMINENT);

    const clinicalOnly = groupByConversation([
      ev({ id: "c1a", conversationId: "c2", category: CLINICAL }),
    ])[0];
    expect(sortGroups([clinicalOnly, worst]).map((g) => g.id)).toEqual(["c1", "c2"]);
  });

  it("4 · takes ANY unanswered flag, so one courtesy reply does not clear it", () => {
    const g = groupByConversation([
      ev({ id: "a", mentorReplied: true }),
      ev({ id: "b", mentorReplied: false }),
    ])[0];
    expect(g.anyUnanswered).toBe(true);
  });

  it("5 · takes the OLDEST flag, so a busy conversation cannot sink", () => {
    /* ═══ THE FAILURE THIS PREVENTS ═══
       Keying on the newest would let a conversation that keeps producing
       flags slide below a quiet one it has been outrunning all shift — the
       most-active conversation sorting last. */
    const busy = groupByConversation([
      ev({ id: "old", conversationId: "busy", at: NOW - 20 * HOUR }),
      ev({ id: "new", conversationId: "busy", at: NOW - 1 * HOUR }),
    ])[0];
    expect(busy.oldestAt).toBe(NOW - 20 * HOUR);

    /* ═══ THE COMPARISON HAS TO REACH STEP 5, OR IT PROVES NOTHING ═══
       A two-member `busy` against a one-member `quiet` is decided at step 3,
       where the pattern wins and age is never consulted — the first draft of
       this test did exactly that and passed for the wrong reason. Both sides
       are two-member sets here, same category, both patterns, so escalation,
       category and pattern are all ties and AGE is what decides.
       `quiet`'s members are BOTH newer than `busy`'s oldest, so keying on the
       newest member would flip the order. */
    const quiet = groupByConversation([
      ev({ id: "q1", conversationId: "quiet", at: NOW - 10 * HOUR }),
      ev({ id: "q2", conversationId: "quiet", at: NOW - 9 * HOUR }),
    ])[0];
    expect(isRepeatPattern(busy) && isRepeatPattern(quiet)).toBe(true);
    expect(busy.worstCategory).toBe(quiet.worstCategory);
    expect(sortGroups([quiet, busy]).map((g) => g.id)).toEqual(["busy", "quiet"]);
  });

  it("1 · takes ANY escalated member, which is also every member", () => {
    /* `escalationOpen` is a fact about the TEEN, so the members agree by
       construction. Asserted anyway: the day it becomes per-flag, "any" is
       the answer that stays correct. */
    const g = groupByConversation([
      ev({ id: "a", escalationOpen: false }),
      ev({ id: "b", escalationOpen: true }),
    ])[0];
    expect(g.escalationOpen).toBe(true);
  });
});

describe("the ordering is still total and still one comparator", () => {
  it("breaks a full tie on the conversation id", () => {
    const a = groupByConversation([ev({ id: "x", conversationId: "c-b" })])[0];
    const b = groupByConversation([ev({ id: "y", conversationId: "c-a" })])[0];
    expect(compareGroups(a, b)).toBeGreaterThan(0);
    expect(sortGroups([a, b]).map((g) => g.id)).toEqual(["c-a", "c-b"]);
  });

  it("keeps the five steps in their order — escalation outranks category", () => {
    const escalated = groupByConversation([
      ev({ id: "e", conversationId: "esc", category: ROUTINE, escalationOpen: true }),
    ])[0];
    const imminent = groupByConversation([
      ev({ id: "i", conversationId: "imm", category: IMMINENT }),
    ])[0];
    expect(sortGroups([imminent, escalated]).map((g) => g.id)).toEqual(["esc", "imm"]);
  });
});
