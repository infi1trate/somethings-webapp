// THE HYBRID UNIT OF REVIEW.
//
// Two claims are worth a test and one of them is the whole design: an IMMINENT
// flag must never be able to hide inside a group row, and a teen's lower-tier
// flags must gather into one picture. A change that made the units uniform in
// either direction would look tidy in a diff and would either bury a 24-hour
// deadline or scatter a clinical picture across forty rows.

import { describe, expect, it } from "vitest";
import {
  compareTeenGroups,
  compositionLabel,
  monitoringEntriesFor,
  tierCounts,
} from "@/lib/tasks/monitoring-list";
import { bandsFor } from "@/lib/tasks/bands";
import { itemsOf, paneItemFor } from "@/lib/tasks/list";
import { deadlineFor } from "@/lib/tasks/sla";
import { DOMAIN_OF_TYPE, TIER_RANK } from "@/lib/tasks/types";
import type { TaskItem, TaskType } from "@/lib/tasks/types";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

let n = 0;
function flag(taskType: TaskType, teenId: string, openedAgo: number): TaskItem {
  n += 1;
  const openedAt = NOW - openedAgo;
  return {
    id: `f${n}`,
    domain: DOMAIN_OF_TYPE[taskType],
    taskType,
    tierRank: TIER_RANK[taskType],
    teenId,
    teenDisplayName: `${teenId} X.`,
    mentorId: "m1",
    mentorName: "Mentor One",
    objectId: `conv-${teenId}`,
    openedAt,
    slaDeadline: deadlineFor(taskType, openedAt),
    status: "open",
    payload: {
      kind: "riskFlag",
      tier: taskType === "imminentFlagReview" ? "imminent" : taskType === "clinicalFlagReview" ? "clinicalReview" : "routine",
      sourceType: "Message",
      categories: ["Low mood"],
      flaggedExcerpt: "…",
      aiRationale: "…",
      flaggedCorrectly: null,
      conversationFlagCount: 1,
    },
  } as TaskItem;
}

describe("the hybrid unit of review", () => {
  it("never coalesces an imminent flag, even two on one teen", () => {
    // THE CORE CLAIM. Same teen, same conversation — under the conversation
    // coalescing these would be one row with a chevron, and a 24h deadline
    // behind a chevron is a deadline that can be missed.
    const entries = monitoringEntriesFor(
      [flag("imminentFlagReview", "t1", 2 * HOUR), flag("imminentFlagReview", "t1", 5 * HOUR)],
      NOW
    );
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.kind === "item")).toBe(true);
  });

  it("gathers a teen's lower-tier flags into one row", () => {
    const entries = monitoringEntriesFor(
      [
        flag("clinicalFlagReview", "t1", 10 * HOUR),
        flag("routineFlagReview", "t1", 30 * HOUR),
        flag("routineFlagReview", "t1", 40 * HOUR),
      ],
      NOW
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("group");
    expect(itemsOf(entries[0])).toHaveLength(3);
  });

  it("groups by teen and not by conversation", () => {
    // Two teens, so two rows — the conversation key would give the same answer
    // here. The discriminator is the NEXT test.
    const entries = monitoringEntriesFor(
      [
        flag("clinicalFlagReview", "t1", HOUR),
        flag("routineFlagReview", "t1", 2 * HOUR),
        flag("clinicalFlagReview", "t2", HOUR),
        flag("routineFlagReview", "t2", 2 * HOUR),
      ],
      NOW
    );
    expect(entries).toHaveLength(2);
  });

  it("spans tiers inside one teen row, which the conversation key could not", () => {
    // `listEntriesFor`'s key is (taskType, objectId), so a clinical and a routine
    // flag on ONE conversation were two separate rows. This is the behaviour
    // change, asserted directly.
    const entries = monitoringEntriesFor(
      [flag("clinicalFlagReview", "t1", HOUR), flag("routineFlagReview", "t1", 2 * HOUR)],
      NOW
    );
    expect(entries).toHaveLength(1);
    const types = itemsOf(entries[0]).map((i) => i.taskType);
    expect(new Set(types).size).toBe(2);
  });

  it("leaves a teen with one lower-tier flag as a plain row", () => {
    // A disclosure over a single child is a control that does nothing.
    const entries = monitoringEntriesFor([flag("routineFlagReview", "t1", HOUR)], NOW);
    expect(entries[0].kind).toBe("item");
  });

  it("puts a teen row in the band of the worst tier it carries", () => {
    // DECISION (a): the bands stay a partition. Every flag is counted once, no
    // teen row is drawn twice, and the row's composition line discloses the mix.
    const entries = monitoringEntriesFor(
      [
        flag("clinicalFlagReview", "t1", HOUR),
        flag("routineFlagReview", "t1", 2 * HOUR),
        flag("routineFlagReview", "t1", 3 * HOUR),
      ],
      NOW
    );
    const bands = bandsFor(entries);
    expect(bands).toHaveLength(1);
    expect(bands[0].label).toBe("Clinical review");
    // THE COUNT IS EVERY FLAG UNDER THE BAND, not just the same-tier ones —
    // otherwise the header excludes rows that are visibly inside it.
    expect(bands[0].taskCount).toBe(3);
  });

  it("selects the highest-priority child when the parent is selected", () => {
    const entries = monitoringEntriesFor(
      [flag("routineFlagReview", "t1", 40 * HOUR), flag("clinicalFlagReview", "t1", HOUR)],
      NOW
    );
    expect(paneItemFor(entries[0]).taskType).toBe("clinicalFlagReview");
  });
});

describe("how teen rows are ordered", () => {
  const group = (types: TaskType[], teenId: string, agesH: number[]) =>
    types.map((t, i) => flag(t, teenId, agesH[i] * HOUR));

  it("puts any clinical flag ahead of a pile of routine ones", () => {
    // KEY 1 BEATS KEY 2, on purpose: severity is not a volume contest.
    const oneClinical = group(["clinicalFlagReview"], "a", [1]);
    const fiveRoutine = group(
      ["routineFlagReview", "routineFlagReview", "routineFlagReview", "routineFlagReview", "routineFlagReview"],
      "b",
      [1, 2, 3, 4, 5]
    );
    expect(compareTeenGroups(oneClinical, fiveRoutine)).toBeLessThan(0);
  });

  it("then puts the bigger picture first", () => {
    /* ═══ THE OLDEST FLAG IS HELD EQUAL ON PURPOSE ═══
       The first version of this test was three flags aged [1,2,3] against one
       aged [1], and it passed with the COUNT KEY DELETED — because the bigger
       group also happened to hold the older flag, so key 3 gave the same answer.
       A mutation run caught it. Both groups now reach back exactly 3 hours, so
       key 3 is a tie.
       AND THE TEEN IDS RUN AGAINST THE EXPECTED ANSWER, because holding key 3
       equal was not enough either: with the count deleted the comparison fell
       through to key 4, the id tiebreak, which happened to put the bigger group
       first anyway and the mutation ran green a SECOND time. `z` before `a` can
       only be the count. */
    const three = group(
      ["clinicalFlagReview", "clinicalFlagReview", "clinicalFlagReview"],
      "z",
      [1, 2, 3]
    );
    const one = group(["clinicalFlagReview"], "a", [3]);
    expect(compareTeenGroups(three, one)).toBeLessThan(0);
  });

  it("then the one that has been accumulating longest", () => {
    const older = group(["clinicalFlagReview", "clinicalFlagReview"], "a", [90, 2]);
    const newer = group(["clinicalFlagReview", "clinicalFlagReview"], "b", [10, 2]);
    expect(compareTeenGroups(older, newer)).toBeLessThan(0);
  });

  it("is a total order, so the list cannot reshuffle between renders", () => {
    const a = group(["clinicalFlagReview"], "aaa", [5]);
    const b = group(["clinicalFlagReview"], "zzz", [5]);
    expect(compareTeenGroups(a, b)).toBeLessThan(0);
    expect(compareTeenGroups(b, a)).toBeGreaterThan(0);
  });

  // ARRIVAL ORDER IS THE THING THIS AVOIDS. A queue worked oldest-first is a
  // moderation queue; this surface claims to be a clinical picture.
  it("is not arrival order", () => {
    const oldSingle = group(["routineFlagReview"], "a", [200]);
    const freshPair = group(["clinicalFlagReview", "clinicalFlagReview"], "b", [1, 2]);
    expect(compareTeenGroups(freshPair, oldSingle)).toBeLessThan(0);
  });
});

describe("the composition line", () => {
  it("reads worst tier first, even when the worst is the smaller count", () => {
    /* ═══ THE COUNTS ARE LOPSIDED THE OTHER WAY ON PURPOSE ═══
       This was "2 clinical · 1 routine", where tier order and count order agree
       — so ordering by count instead of by tier produced the same string and the
       mutation ran green. One clinical against three routine is the case that
       tells them apart: by count it would read "3 routine · 1 clinical" and bury
       the more serious half behind the bigger number. */
    const members = [
      flag("routineFlagReview", "t1", HOUR),
      flag("routineFlagReview", "t1", HOUR),
      flag("routineFlagReview", "t1", HOUR),
      flag("clinicalFlagReview", "t1", HOUR),
    ];
    expect(compositionLabel(members)).toBe("1 clinical · 3 routine");
  });

  it("says nothing when there is only one tier to say", () => {
    // The band header and the count badge already carry both facts.
    const members = [flag("routineFlagReview", "t1", HOUR), flag("routineFlagReview", "t1", HOUR)];
    expect(compositionLabel(members)).toBeNull();
  });

  it("counts by task type, so it cannot disagree with the band", () => {
    const members = [flag("clinicalFlagReview", "t1", HOUR), flag("routineFlagReview", "t1", HOUR)];
    const counts = tierCounts(members);
    expect(counts.get("clinicalFlagReview")).toBe(1);
    expect(counts.get("routineFlagReview")).toBe(1);
  });
});
