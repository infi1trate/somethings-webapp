// ═══════════════════════════════════════════════════════════════════════════
// THE CYCLE IS THE ONE THE CARE PAGE ALREADY NAMES (rework §6.1, §6.2)
//
// §6.1 asks for an even 30-day series; the cadence does not run one. The
// survey-day sequence (30, 120, 210, 300) is accurate and renders nothing a
// supervisor thinks in. What the Care page SAYS is two things — "30-day review"
// and "90-day review", with two stages deliberately sharing the second — and
// matching it is the semantics Brandon asked for.
//
// So these tests pin two claims: the values are the Care page's own, and the
// derivation comes off `taskType` rather than a stored field that could drift
// from it.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAGE_LABEL } from "@/lib/record/care-demo";
import {
  CYCLE_LABEL,
  cycleFor,
  cycleLabelFor,
  cycleSortKey,
} from "@/lib/tasks/review-cycle";

describe("the two cycles are the Care page's two", () => {
  it("derives the first review from the intake type and the recurring from the re-review", () => {
    expect(cycleFor("intakeBillingReview")).toBe("first");
    expect(cycleFor("monthlyReReview")).toBe("recurring");
  });

  it("and nothing else has a cycle", () => {
    for (const t of ["riskFlagReview", "activeEscalation", "escalationDocumentation"] as const) {
      expect(cycleFor(t), `${t} claimed a cadence it has no part in`).toBeNull();
      expect(cycleLabelFor(t)).toBeNull();
    }
  });

  /* ═══ THE CROSS-SURFACE CHECK, AND IT IS THE POINT OF THIS FILE ═══
     The cell is the Care page's label minus the noun. If `STAGE_LABEL` is ever
     re-worded, this fails and names the drift — which is the failure mode the
     shared-row work one pack ago was all about. */
  it("says what the Care page says, minus the noun the column header carries", () => {
    expect(STAGE_LABEL.intake).toBe("30-day review");
    expect(STAGE_LABEL.quarterly).toBe("90-day review");
    expect(STAGE_LABEL.intake).toBe(`${CYCLE_LABEL.first} review`);
    expect(STAGE_LABEL.quarterly).toBe(`${CYCLE_LABEL.recurring} review`);
  });

  it("and the cell does not repeat the word review (§6.2)", () => {
    for (const v of Object.values(CYCLE_LABEL)) {
      expect(v.toLowerCase()).not.toContain("review");
    }
  });

  it("keeps the two stages that share a label sharing it", () => {
    /* `care-demo.ts`: two stages sharing a label is "correct, not a collapse
       worth avoiding" — a teen has one first review and then a recurring one. */
    expect(STAGE_LABEL.day30).toBe(STAGE_LABEL.quarterly);
  });
});

describe("sorting is cycle order, never the label (§3)", () => {
  it("puts the first review before the recurring one", () => {
    expect(cycleSortKey("intakeBillingReview")).toBeLessThan(
      cycleSortKey("monthlyReReview")
    );
  });

  it("puts an unknown cycle last in ascending order, not first", () => {
    expect(cycleSortKey("riskFlagReview")).toBeGreaterThan(
      cycleSortKey("monthlyReReview")
    );
  });

  it("is a rank and not a string compare, which a third cycle would break", () => {
    /* "120-day" sorts before "30-day" lexicographically. The rank does not
       care, which is why the sort reads the rank. */
    expect("120-day".localeCompare("30-day")).toBeLessThan(0);
    const src = readFileSync(
      join(process.cwd(), "src/lib/tasks/review-cycle.ts"),
      "utf8"
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toContain("localeCompare");
  });
});

describe("the cycle is derived, not stored", () => {
  it("adds no field to the billing payload", () => {
    const types = readFileSync(join(process.cwd(), "src/lib/tasks/types.ts"), "utf8");
    /* A stored cycle would be a second statement of what `taskType` already
       says, and the two would drift. */
    expect(types).not.toMatch(/\bcycle\b/i);
  });
});
