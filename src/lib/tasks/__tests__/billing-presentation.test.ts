// A BILLING TASK, SEEN THROUGH THE SHARED REVIEW MODULE.
//
// The adapter's whole job is that ONE clinical decision looks like one thing on
// both surfaces. So these assert the mapping's two risky halves: that nothing is
// misattributed, and that the derived evidence agrees with the number it sits
// under. A grid whose points do not add up to the score displayed above it would
// be a contradiction on a minor's billing record, and nothing would error.

import { describe, expect, it } from "vitest";
import { billingReviewFor } from "@/lib/tasks/billing-presentation";
import { tasksScenario } from "@/lib/tasks/seed";
import { openTasks } from "@/lib/tasks/sort";
import { INSTRUMENT_MAX, RATIONALE_SOURCE_LABEL, severityFor } from "@/lib/record/care-demo";
import type { BillingPayload, TaskItem } from "@/lib/tasks/types";

const NOW = Date.now();

function billingItems(scenario = "typical-shift"): TaskItem[] {
  return openTasks(tasksScenario(scenario, NOW)).filter((i) => i.domain === "billing");
}

describe("a billing task as a presentation review", () => {
  it("carries the model's proposal through unchanged", () => {
    for (const item of billingItems()) {
      const p = item.payload as BillingPayload;
      expect(billingReviewFor(item, p).recommended).toEqual(p.recommended);
    }
  });

  it("attributes the rationale to the model, never to a person or a template", () => {
    // Provenance is mandatory on this field so it cannot be MISattributed —
    // "templated" would credit an intake mapping that had no part in it, and
    // "supervisor" would credit somebody who did not write it.
    for (const item of billingItems()) {
      const p = item.payload as BillingPayload;
      const r = billingReviewFor(item, p);
      expect(r.rationale.source).toBe("ai");
      expect(r.rationale.text).toBe(p.aiSummary);
      expect(RATIONALE_SOURCE_LABEL[r.rationale.source]).toMatch(/AI-generated/);
    }
  });

  it("never claims a weighted score over one assessment", () => {
    // One reading weighted is not a weighting. The module reads `aggregate` to
    // decide whether to say "Weighted across N assessments", and a non-null
    // aggregate here would put that sentence over a single survey.
    for (const item of billingItems("heavy-caseload")) {
      const r = billingReviewFor(item, item.payload as BillingPayload);
      expect(r.aggregate).toBeNull();
      expect(r.survey).not.toBeNull();
    }
  });

  it("derives the band from the instrument rather than carrying one", () => {
    for (const item of billingItems()) {
      const p = item.payload as BillingPayload;
      const r = billingReviewFor(item, p);
      const inst = p.survey.instrument as keyof typeof INSTRUMENT_MAX;
      if (inst in INSTRUMENT_MAX) {
        expect(r.survey!.severity).toBe(severityFor(inst, p.survey.score));
      }
    }
  });

  it("breaks the score down into answers that add up to it", () => {
    // THE CONTRADICTION THIS PREVENTS: a grid of answers under a score they do
    // not sum to. Nothing would error and a supervisor would be reading two
    // numbers for one assessment.
    for (const item of billingItems("heavy-caseload")) {
      const p = item.payload as BillingPayload;
      const survey = billingReviewFor(item, p).survey!;
      expect(survey.items.length).toBeGreaterThan(0);
      const total = survey.items.reduce((n, i) => n + i.points, 0);
      expect(total, `${item.id} ${survey.instrument}`).toBe(p.survey.score);
    }
  });

  it("gives two tasks with the same score different answers", () => {
    // Seeded on the TASK id. Two reviews that happened to score the same should
    // not show one teen's assessment twice.
    const all = billingItems("heavy-caseload");
    const byScore = new Map<number, TaskItem[]>();
    for (const i of all) {
      const s = (i.payload as BillingPayload).survey.score;
      byScore.set(s, [...(byScore.get(s) ?? []), i]);
    }
    const pair = [...byScore.values()].find((g) => g.length > 1);
    expect(pair, "the fixture has no two billing tasks sharing a score").toBeTruthy();
    const [a, b] = pair!;
    const ia = billingReviewFor(a, a.payload as BillingPayload).survey!.items;
    const ib = billingReviewFor(b, b.payload as BillingPayload).survey!.items;
    expect(ia.map((i) => i.points)).not.toEqual(ib.map((i) => i.points));
  });

  it("is deterministic — the same task maps to the same review", () => {
    const item = billingItems()[0];
    const p = item.payload as BillingPayload;
    expect(billingReviewFor(item, p)).toEqual(billingReviewFor(item, p));
  });

  it("files an intake as an intake and a re-review as a single-survey stage", () => {
    // `quarterly` is the stage the module associates with a weighted aggregate
    // over a period, which a monthly re-review of one assessment is not.
    for (const item of billingItems()) {
      const r = billingReviewFor(item, item.payload as BillingPayload);
      expect(r.stage).toBe(item.taskType === "intakeBillingReview" ? "intake" : "day30");
      expect(r.stage).not.toBe("quarterly");
    }
  });
});
