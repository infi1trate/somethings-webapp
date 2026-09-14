// WHAT THE MONITORING BADGE COUNTS — and, more usefully, what it refuses to.
//
// The failure this guards against is not an off-by-one. It is someone adding
// open flags to the total because the number looked small on the day they
// checked, which turns a badge that means "something is late" into one that
// means "the surface exists". The exclusions are therefore asserted as
// explicitly as the inclusions.

import { describe, expect, it } from "vitest";
import { monitoringObligations } from "@/lib/tasks/obligations";
import { deadlineFor } from "@/lib/tasks/sla";
import type { TaskItem, TaskStatus, TaskType } from "@/lib/tasks/types";
import { DOMAIN_OF_TYPE, TIER_RANK } from "@/lib/tasks/types";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

let n = 0;
function item(
  taskType: TaskType,
  openedAgo: number,
  status: TaskStatus = "open"
): TaskItem {
  n += 1;
  const openedAt = NOW - openedAgo;
  return {
    id: `t${n}`,
    domain: DOMAIN_OF_TYPE[taskType],
    taskType,
    tierRank: TIER_RANK[taskType],
    teenId: `teen-${n}`,
    teenDisplayName: "A. B.",
    mentorId: "m1",
    mentorName: "Mentor One",
    objectId: `obj-${n}`,
    openedAt,
    slaDeadline: deadlineFor(taskType, openedAt),
    status,
    payload: { kind: "documentation", escalationId: "e1", closedAt: openedAt },
  } as TaskItem;
}

describe("what Monitoring owes", () => {
  it("counts an imminent flag only once it is past its SLA", () => {
    // 24h SLA: 23h old is work in hand, 25h old is a missed deadline.
    const onTrack = monitoringObligations([item("imminentFlagReview", 23 * HOUR)], NOW);
    expect(onTrack.imminentBreached).toBe(0);
    expect(onTrack.total).toBe(0);

    const late = monitoringObligations([item("imminentFlagReview", 25 * HOUR)], NOW);
    expect(late.imminentBreached).toBe(1);
    expect(late.total).toBe(1);
  });

  it("counts documentation from the moment it is due, not only when it is late", () => {
    // 24h from close. At 2h the write-up is owed and not yet late; both states
    // are debt, and the badge does not wait for the second one.
    const due = monitoringObligations([item("escalationDocumentation", 2 * HOUR)], NOW);
    expect(due).toMatchObject({
      documentationOpen: 1,
      documentationOverdue: 0,
      total: 1,
    });

    const overdue = monitoringObligations([item("escalationDocumentation", 30 * HOUR)], NOW);
    expect(overdue).toMatchObject({
      documentationOpen: 1,
      documentationOverdue: 1,
      // Still one obligation. Overdue is a WORSE state of the same debt, not a
      // second one — double-counting it would inflate the badge as time passed
      // without anything new having happened.
      total: 1,
    });
  });

  it("ignores volume — open flags at the lower tiers are not debt", () => {
    const o = monitoringObligations(
      [
        // Both breached, on purpose: 48h and 7d SLAs are the normal rhythm of a
        // worked queue, and badging them would bury the Imminent signal.
        item("clinicalFlagReview", 60 * HOUR),
        item("routineFlagReview", 9 * 24 * HOUR),
        item("imminentFlagReview", 2 * HOUR),
        item("routineFlagReview", HOUR),
      ],
      NOW
    );
    expect(o.total).toBe(0);
  });

  it("ignores active escalations, which are not handled here", () => {
    // 5m SLA, so this one is breached many times over — and still not counted.
    // They have their own interrupt layer and locked decision 3 keeps them off
    // this surface's resolve path entirely.
    const o = monitoringObligations([item("activeEscalation", 6 * HOUR)], NOW);
    expect(o.total).toBe(0);
  });

  it("drops resolved work but keeps work someone opened and left", () => {
    const resolved = monitoringObligations(
      [item("imminentFlagReview", 30 * HOUR, "resolved")],
      NOW
    );
    expect(resolved.total).toBe(0);

    const inProgress = monitoringObligations(
      [item("imminentFlagReview", 30 * HOUR, "inProgress")],
      NOW
    );
    expect(inProgress.total).toBe(1);
  });

  it("adds the two kinds of debt and nothing else", () => {
    const o = monitoringObligations(
      [
        item("imminentFlagReview", 30 * HOUR),
        item("imminentFlagReview", 40 * HOUR),
        item("escalationDocumentation", 3 * HOUR),
        item("clinicalFlagReview", 60 * HOUR),
        item("routineFlagReview", 9 * 24 * HOUR),
        item("activeEscalation", HOUR),
        item("intakeBillingReview", 90 * HOUR),
      ],
      NOW
    );
    expect(o).toMatchObject({
      imminentBreached: 2,
      documentationOpen: 1,
      total: 3,
    });
  });

  it("reaches zero, which is the point of it", () => {
    expect(monitoringObligations([], NOW).total).toBe(0);
  });
});
