// THE STATE AN ESCALATION IS IN, AND THE WORD USED ABOUT IT.
//
// The defect this guards is the one B0 was asked to find: a row reading "20h
// open" beside a pane reading "Closed Sep 13". Both figures were right and the
// data never disagreed — `openedAt`, `clockStartAgo` and `closedAt` are the same
// instant on a documentation task by construction. What was wrong was a suffix
// appended to every row regardless of what kind of task it was.
//
// So these assert the DERIVATION rather than any string: which state, which
// clock, and which direction it runs.

import { describe, expect, it } from "vitest";
import {
  clockFor,
  closedAtOf,
  isAlarming,
  isEscalationTask,
  lifecycleOf,
  LIFECYCLE_LABEL,
} from "@/lib/tasks/escalation-state";
import { deadlineFor } from "@/lib/tasks/sla";
import { tasksScenario } from "@/lib/tasks/seed";
import { DOMAIN_OF_TYPE, TIER_RANK } from "@/lib/tasks/types";
import type { TaskItem, TaskType } from "@/lib/tasks/types";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

function esc(taskType: TaskType, agoH: number): TaskItem {
  const openedAt = NOW - agoH * HOUR;
  return {
    id: `e-${taskType}-${agoH}`,
    domain: DOMAIN_OF_TYPE[taskType],
    taskType,
    tierRank: TIER_RANK[taskType],
    teenId: "t1",
    teenDisplayName: "A. B.",
    mentorId: "m1",
    mentorName: "Mentor One",
    objectId: "esc-1",
    openedAt,
    slaDeadline: deadlineFor(taskType, openedAt),
    status: "open",
    payload:
      taskType === "escalationDocumentation"
        ? { kind: "documentation", escalationId: "esc-1", closedAt: openedAt }
        : {
            kind: "escalation",
            is911: true,
            flaggedBy: "Mentor One",
            emergencyContact: "—",
            escalationId: "esc-1",
          },
  } as TaskItem;
}

describe("the escalation lifecycle", () => {
  it("has three states and they are not three kinds of thing", () => {
    expect(lifecycleOf(esc("activeEscalation", 1), NOW)).toBe("active");
    // 24h from close: 20h in it is due, 31h in it is overdue. One obligation,
    // two conditions.
    expect(lifecycleOf(esc("escalationDocumentation", 20), NOW)).toBe("documentationDue");
    expect(lifecycleOf(esc("escalationDocumentation", 31), NOW)).toBe("documentationOverdue");
  });

  it("says Closed on both documentation states", () => {
    // The most useful fact about one of these rows is that nobody is in danger
    // now. A chip reading only "write-up due" makes a reader work that out.
    expect(LIFECYCLE_LABEL.documentationDue).toMatch(/^Closed/);
    expect(LIFECYCLE_LABEL.documentationOverdue).toMatch(/^Closed/);
    expect(LIFECYCLE_LABEL.active).not.toMatch(/Closed/);
  });

  it("spends the alarm budget on the active state alone", () => {
    // An overdue write-up is a compliance failure about something already over.
    // Giving it the filled treatment would spend the budget twice.
    expect(isAlarming("active")).toBe(true);
    expect(isAlarming("documentationDue")).toBe(false);
    expect(isAlarming("documentationOverdue")).toBe(false);
  });

  it("runs the clock in the direction the reader is asking about", () => {
    // Active counts UP from the start — how long has someone been waiting.
    const active = esc("activeEscalation", 2);
    expect(clockFor(active, NOW)).toEqual({ kind: "elapsed", at: active.openedAt });

    // Due counts DOWN to the deadline.
    const due = esc("escalationDocumentation", 20);
    expect(clockFor(due, NOW)).toEqual({ kind: "remaining", at: due.slaDeadline });

    // Past it, up again.
    const over = esc("escalationDocumentation", 31);
    expect(clockFor(over, NOW)).toEqual({ kind: "over", at: over.slaDeadline });
  });

  it("refuses to report a close time for something that is not closed", () => {
    // `openedAt` would have been available and wrong. Returning it under the
    // word "Closed" is the exact defect this module exists to end, so the type
    // makes it impossible rather than the caller remembering.
    expect(closedAtOf(esc("activeEscalation", 2))).toBeNull();
    const docs = esc("escalationDocumentation", 20);
    expect(closedAtOf(docs)).toBe(docs.openedAt);
  });

  it("knows which tasks are escalations at all", () => {
    expect(isEscalationTask(esc("activeEscalation", 1))).toBe(true);
    expect(isEscalationTask(esc("escalationDocumentation", 1))).toBe(true);
    expect(isEscalationTask(esc("imminentFlagReview", 1))).toBe(false);
  });
});

describe("the fixtures exercise the region", () => {
  it("typical-shift carries all three states at once", () => {
    // Before arch-B the two scenarios with flag volume had ZERO active
    // escalations, so the region could not be seen in its full state on the
    // scenario a supervisor's Tuesday is meant to look like.
    const open = tasksScenario("typical-shift", Date.now()).filter(
      (i) => isEscalationTask(i) && i.status !== "resolved"
    );
    const states = new Set(open.map((i) => lifecycleOf(i, Date.now())));
    expect(states).toEqual(
      new Set(["active", "documentationDue", "documentationOverdue"])
    );
  });

  it("stays inside the brief's seeds — 1–3 active, 1–2 awaiting documentation", () => {
    const now = Date.now();
    for (const id of ["typical-shift", "heavy-caseload"]) {
      const open = tasksScenario(id, now).filter(
        (i) => isEscalationTask(i) && i.status !== "resolved"
      );
      const active = open.filter((i) => lifecycleOf(i, now) === "active").length;
      const docs = open.length - active;
      expect(active, `${id} active`).toBeGreaterThanOrEqual(1);
      expect(active, `${id} active`).toBeLessThanOrEqual(3);
      expect(docs, `${id} documentation`).toBeGreaterThanOrEqual(1);
      expect(docs, `${id} documentation`).toBeLessThanOrEqual(2);
    }
  });
});
