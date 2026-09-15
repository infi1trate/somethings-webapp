/* ═══ TRIMMED BY arch-mon PHASE 1 ═══
   The suites for the hybrid unit of review, the teen-group ordering and
   `monitoringEntriesFor` tested Monitoring's tier grouping, which no longer
   exists — their subject was deleted, not their assertions weakened. What is
   left covers the two functions Tasks still uses. Monitoring's own event model,
   comparator and escalation lifecycle are tested in
   `src/lib/monitoring/__tests__/`. */
// THE HYBRID UNIT OF REVIEW.
//
// What is left is the COMPOSITION LINE, which Tasks still draws on a coalesced
// row: worst tier first, and silent when there is only one tier to name.

import { describe, expect, it } from "vitest";
import { compositionLabel } from "@/lib/tasks/monitoring-list";
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

});
