// ═══════════════════════════════════════════════════════════════════════════
// WHO A CARE REVIEW IS ASSIGNED TO — teen → mentor → supervisor
//
// The definition is two caseloads chained, so the tests pin the table's shape
// (every mentor in exactly one caseload), the chain, and the two rules the
// column depends on: a closed record keeps the supervisor it closed under, and
// a record written before the column existed gets one derived once.

import { describe, expect, it } from "vitest";
import {
  SUPERVISOR_CASELOADS,
  TASK_SUPERVISORS,
  assignedSupervisor,
  supervisorOfMentor,
} from "@/lib/tasks/assignment";
import { buildClosedReview, normaliseClosedRecord, type ClosedCareReview } from "@/lib/tasks/closed-review";
import { billingReviewFor } from "@/lib/tasks/billing-presentation";
import { shortName } from "@/components/tasks/review-row";
import { MENTOR_POOL, tasksScenario } from "@/lib/tasks/seed";
import type { BillingPayload } from "@/lib/tasks/types";

const NOW = new Date(2026, 9, 6, 15, 30).getTime();

describe("the supervisor caseloads", () => {
  it("hold every task mentor exactly once", () => {
    const all = Object.values(SUPERVISOR_CASELOADS).flat();
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(MENTOR_POOL.map((m) => m.id).sort());
  });
  it("span more than one supervisor, so the column is not one name", () => {
    const used = new Set(MENTOR_POOL.map((m) => supervisorOfMentor(m.id)?.id));
    expect(used.size).toBe(Object.keys(TASK_SUPERVISORS).length);
  });
});

describe("a review's supervisor is its teen's mentor's", () => {
  it("follows the chain for every care review in the fixture", () => {
    const items = tasksScenario("heavy-caseload", NOW).filter((i) => i.payload.kind === "billing");
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      const sid = Object.entries(SUPERVISOR_CASELOADS).find(([, ms]) => ms.includes(i.mentorId))?.[0];
      expect(assignedSupervisor(i)?.id, i.id).toBe(sid);
    }
  });
  it("and a mentor in no caseload is unassigned — not a fallback", () => {
    expect(assignedSupervisor({ mentorId: "tk-m-nobody" })).toBeNull();
  });
});

describe("a closed record keeps the supervisor it closed under", () => {
  const item = tasksScenario("care-mixed-cycles", NOW).find((i) => i.payload.kind === "billing")!;
  const p = item.payload as BillingPayload;
  const r = buildClosedReview({
    item,
    review: billingReviewFor(item, p),
    committedCode: p.recommended.code,
    committedStatement: p.recommended.statement,
    body: { assessment: "improved", clinical: "c", diagnostic: "d" },
    provenance: { clinical: "authored", diagnostic: "authored" },
    submittedAt: NOW,
    submittedBy: { name: "A", role: "Supervisor" },
  });
  it("freezes it at build time", () => {
    expect(r.assignedTo).toEqual(assignedSupervisor(item));
  });
  it("and normalising never overwrites a frozen value", () => {
    const frozen = { ...r, assignedTo: { id: "tk-s-old", name: "Old Supervisor" } };
    expect(normaliseClosedRecord(frozen).assignedTo?.name).toBe("Old Supervisor");
  });
  it("a record written before the column gets one derived once from its own snapshot", () => {
    const legacy = { ...r } as Partial<ClosedCareReview>;
    delete legacy.assignedTo;
    expect(normaliseClosedRecord(legacy as ClosedCareReview).assignedTo).toEqual(assignedSupervisor(item));
  });
});

describe("the short form below 1440", () => {
  it("is first name and initial", () => {
    expect(shortName("Stephen Rowe")).toBe("Stephen R.");
    expect(shortName("Jae Sung Park")).toBe("Jae P.");
    expect(shortName("Cher")).toBe("Cher");
  });
});
