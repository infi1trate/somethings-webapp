// WHAT A TASKS ROW SAYS, AND THE FILTER THAT IS NOT THERE YET.
//
// Two things unit-testable here. The disposition preview, which must agree with
// the pane it opens — a row labelling a review differently from its own detail
// view is the failure the shared derivation exists to prevent. And the kind
// filter's visibility rule, which is the only way to exercise the two-type case
// at all: no fixture puts two task types on Tasks, because arch-A scoped the
// surface to billing.

import { describe, expect, it } from "vitest";
import {
  PROPOSAL_LABEL,
  proposalKindFor,
  proposalPreview,
} from "@/lib/record/proposal-kind";
import { TASK_KIND_LABEL, taskKindKey } from "@/lib/tasks/task-kind";
import {
  ALL_KINDS,
  filterByKind,
  kindChipsFor,
} from "@/components/tasks/kind-filter";
import { tasksScenario } from "@/lib/tasks/seed";
import { openTasks } from "@/lib/tasks/sort";
import type { BillingPayload, TaskItem, TaskType } from "@/lib/tasks/types";

const NOW = Date.now();
const billing = (scenario: string) =>
  openTasks(tasksScenario(scenario, NOW)).filter((i) => i.domain === "billing");

describe("the disposition preview", () => {
  it("names the three cases the pane names", () => {
    // ONE TABLE. The row reads the same strings the pane's chip does, so a
    // rename moves both surfaces and neither can drift.
    expect(proposalPreview(null, "F41.1")).toBe(PROPOSAL_LABEL.assign);
    expect(proposalPreview("F33.1", "F33.1")).toBe(PROPOSAL_LABEL.renewal);
    expect(proposalPreview("F33.0", "F33.1")).toBe(`${PROPOSAL_LABEL.change} → F33.1`);
  });

  it("points at a code only when there is a second one to point at", () => {
    // A renewal's codes are the same value and an assignment has nothing on the
    // other side; an arrow on either would be a diagram of nothing.
    expect(proposalPreview("F33.1", "F33.1")).not.toMatch(/→/);
    expect(proposalPreview(null, "F41.1")).not.toMatch(/→/);
    expect(proposalPreview("F33.0", "F33.1")).toMatch(/→ F33\.1$/);
  });

  it("calls a re-worded statement under the same code a renewal", () => {
    // Keyed on the CODE alone: the billable fact has not changed, and calling it
    // a change would put the attention chip on a copy edit.
    expect(proposalKindFor("F33.1", "F33.1")).toBe("renewal");
  });

  it("is derivable for every billing item, from list data alone", () => {
    /* THE PREVIEW DEPENDS ON THIS. Both halves are on the payload —
       `current` and `recommended` — so the row never has to reach into the pane
       or infer a case from partial data. */
    for (const item of billing("heavy-caseload")) {
      const p = item.payload as BillingPayload;
      expect(() => proposalPreview(p.current?.code ?? null, p.recommended.code)).not.toThrow();
    }
  });

  it("reaches all three cases on the scenario the surface is judged on", () => {
    /* arch-E widened the billing fixture partly for this: `renewal` was
       previously reachable only on `quiet-day`'s single item, so the row had a
       case that volume never exercised. */
    const kinds = new Set(
      billing("typical-shift").map((i) => {
        const p = i.payload as BillingPayload;
        return proposalKindFor(p.current?.code ?? null, p.recommended.code);
      })
    );
    expect(kinds).toEqual(new Set(["assign", "change", "renewal"]));
  });
});

describe("the task-kind vocabulary", () => {
  it("gives the two billing types one name, because they are one job", () => {
    // A supervisor reviewing a code does not need to know it is the monthly one;
    // the cadence survives on the payload where it is load-bearing.
    expect(TASK_KIND_LABEL.intakeBillingReview).toBe(TASK_KIND_LABEL.monthlyReReview);
    expect(taskKindKey("intakeBillingReview")).toBe(taskKindKey("monthlyReReview"));
  });

  it("names every task type, so a new row can never render blank", () => {
    const types: TaskType[] = [
      "activeEscalation",
      "escalationDocumentation",
      "imminentFlagReview",
      "clinicalFlagReview",
      "intakeBillingReview",
      "monthlyReReview",
      "routineFlagReview",
    ];
    for (const t of types) expect(TASK_KIND_LABEL[t], t).toBeTruthy();
  });
});

describe("the kind filter", () => {
  it("offers no chips with one task type — which is every scenario today", () => {
    /* THE AFFORDANCE IS BUILT AND HIDDEN. A single filter offering no choice is
       dead chrome, the same reasoning that removed the one-tab row in arch-A. No
       fixture puts two task types on Tasks, so this is the only place the
       two-type case can be exercised. */
    for (const scenario of ["typical-shift", "heavy-caseload", "quiet-day"]) {
      expect(kindChipsFor(billing(scenario)), scenario).toHaveLength(1);
    }
  });

  it("offers one chip per KIND once a second type arrives", () => {
    const simulated = [
      ...billing("typical-shift"),
      { ...billing("typical-shift")[0], id: "sim-1", taskType: "routineFlagReview" as TaskType },
    ] as TaskItem[];
    const chips = kindChipsFor(simulated);
    expect(chips).toHaveLength(2);
    expect(chips).toContain(TASK_KIND_LABEL.intakeBillingReview);
    expect(chips).toContain(TASK_KIND_LABEL.routineFlagReview);
  });

  it("filters to a kind, and All returns everything", () => {
    const simulated = [
      ...billing("typical-shift"),
      { ...billing("typical-shift")[0], id: "sim-1", taskType: "routineFlagReview" as TaskType },
    ] as TaskItem[];
    expect(filterByKind(simulated, ALL_KINDS)).toHaveLength(simulated.length);
    expect(filterByKind(simulated, TASK_KIND_LABEL.routineFlagReview)).toHaveLength(1);
    expect(filterByKind(simulated, TASK_KIND_LABEL.intakeBillingReview)).toHaveLength(
      simulated.length - 1
    );
  });

  it("collapses two task types that share a name into one chip", () => {
    // Intake and monthly re-review are both billing code reviews. Two chips for
    // one label would imply a distinction the row deliberately is not making.
    const both = billing("typical-shift");
    expect(new Set(both.map((i) => i.taskType)).size).toBe(2);
    expect(kindChipsFor(both)).toHaveLength(1);
  });
});
