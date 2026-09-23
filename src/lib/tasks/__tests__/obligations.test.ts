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
import { DOMAIN_OF_TYPE, TYPE_URGENCY_RANK } from "@/lib/tasks/types";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

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
    urgencyRank: TYPE_URGENCY_RANK[taskType],
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
  /* ═══ RETARGETED TWICE, AND THE SECOND TIME IT GOT STRICTER ═══
     arch-mon Phase 1 kept `imminentBreached` computed-but-not-debt, for Home's
     digest to read. Phase 3 replaced that surface and Phase 4 deleted the field,
     the flag tiers it was keyed on, and the fabricated 24h SLA it measured.
     SO THE CLAIM IS NOW THE STRONGER ONE: a flag of ANY age is not debt, and it
     cannot be, because it has no deadline to breach. The old form asserted a
     number stayed out of one total; this asserts the input cannot produce one. */
  it("never treats a flag as debt, at any age, because a flag has no deadline", () => {
    for (const ago of [HOUR, 25 * HOUR, 40 * 24 * HOUR]) {
      const o = monitoringObligations([item("riskFlagReview", ago)], NOW);
      expect(o.total, `${ago}ms old`).toBe(0);
      expect(o.ackOutstanding).toBe(0);
      expect(o.documentationOpen).toBe(0);
    }
  });

  it("counts documentation from the moment it is due, not only when it is late", () => {
    // 24h from close. At 2h the escalation note is owed and not yet late; both states
    // are debt, and the badge does not wait for the second one.
    const due = monitoringObligations([item("escalationDocumentation", 2 * HOUR)], NOW);
    expect(due).toMatchObject({
      documentationOpen: 1,
      documentationOverdue: 0,
      /* ═══ RETARGETED: THE BADGE WAITS FOR LATE NOW ═══
         It counted every open note. An escalation note owed but not yet late is
         work in hand, and the badge exists for missed clocks — the same
         reasoning that took the manufactured flag breach out of it. */
      total: 0,
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
        item("riskFlagReview", 60 * HOUR),
        item("riskFlagReview", 9 * 24 * HOUR),
        item("riskFlagReview", 2 * HOUR),
        item("riskFlagReview", HOUR),
      ],
      NOW
    );
    expect(o.total).toBe(0);
  });

  /* ═══ REVERSED BY arch-mon PHASE 3 ═══
     It asserted that active escalations are not obligations. They are now THE
     obligation: five minutes from trigger to acknowledgement is the only
     published response SLA on the surface, and the UI did not enforce it.
     Locked decision 3 still holds — nothing about an escalation is RESOLVED on
     this page — which is a different question from whether it is owed. */
  it("counts an active escalation past its five minutes", () => {
    const fresh = monitoringObligations([item("activeEscalation", 2 * MINUTE)], NOW);
    expect(fresh.ackOutstanding).toBe(0);
    expect(fresh.total).toBe(0);

    const late = monitoringObligations([item("activeEscalation", 6 * HOUR)], NOW);
    expect(late.ackOutstanding).toBe(1);
    expect(late.total).toBe(1);
  });

  it("drops resolved work but keeps work someone opened and left", () => {
    /* ON AN ESCALATION NOTE NOW, because the imminent flag this used to use is
       no longer debt — the claim under test is about STATUS, not about which
       task type, and it needs a subject that still counts. */
    const resolved = monitoringObligations(
      [item("escalationDocumentation", 30 * HOUR, "resolved")],
      NOW
    );
    expect(resolved.total).toBe(0);

    const inProgress = monitoringObligations(
      [item("escalationDocumentation", 30 * HOUR, "inProgress")],
      NOW
    );
    expect(inProgress.total).toBe(1);
  });

  it("adds the two kinds of debt and nothing else", () => {
    const o = monitoringObligations(
      [
        item("riskFlagReview", 30 * HOUR),
        item("riskFlagReview", 40 * HOUR),
        item("escalationDocumentation", 3 * HOUR),
        item("riskFlagReview", 60 * HOUR),
        item("riskFlagReview", 9 * 24 * HOUR),
        item("activeEscalation", HOUR),
        item("intakeBillingReview", 90 * HOUR),
      ],
      NOW
    );
    expect(o).toMatchObject({
      documentationOpen: 1,
      documentationOverdue: 0,
      /* THE ONE REAL OBLIGATION IN THAT LIST: the active escalation is an hour
         old against a five-minute acknowledgement window. The note is owed and
         not yet late; the three flags have no deadline at all and the billing
         review is inside its own. */
      ackOutstanding: 1,
      total: 1,
    });
  });

  it("reaches zero, which is the point of it", () => {
    expect(monitoringObligations([], NOW).total).toBe(0);
  });
});
