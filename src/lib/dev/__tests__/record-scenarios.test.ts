// THE GUARD ON THE SCENARIO REGISTRY'S OWN CLAIMS.
//
// ═══ WHY THIS TEST EXISTS ═══
//
// The registry's contract is that a scenario NAMES A RECORD THAT ALREADY EXHIBITS
// THE STATE, and `data: "real"` asserts exactly that. Nothing verified it, and one
// entry had been wrong for long enough to be reported from the app: `review-30`
// pointed at t17, who is 196 days into a mentorship on the quarterly cadence, so
// selecting "30-day review due" produced a screen reading "due in 2 days · 90-day
// review". Every data point on it contradicted the scenario's own name.
//
// A test cannot verify "exhibits the state" in general — most of these states are
// visual. But the review scenarios name a MACHINE-READABLE state (a cadence stage
// plus a due/overdue distinction), so those three can be held exactly, and they are
// the three that drifted.
//
// ═══ AND IT CATCHES THE DUPLICATE ═══
//
// `review-90` and `review-overdue` both named t19 in the identical state, so two of
// the twenty scenarios were the same screenshot. A registry of curated pointers is
// only worth having if the pointers are distinct.

import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS, scenarioById } from "@/lib/dev/record-scenarios";
import { cadenceFor, reviewDueState, STAGE_LABEL } from "@/lib/record/care-demo";

/** A fixed instant. Every fixture is positioned relative to a passed `now`, so the
 *  test pins one rather than depending on when it runs. */
const NOW = new Date("2026-09-01T12:00:00.000Z").getTime();

/** What each review scenario CLAIMS, in machine-readable form. Written here rather
 *  than parsed out of the label, because parsing prose is how a test ends up
 *  agreeing with a typo. */
const REVIEW_CLAIMS = [
  { id: "review-intake", stage: "intake" as const, overdue: false },
  { id: "review-90", stage: "quarterly" as const, overdue: false },
  { id: "review-overdue", stage: "quarterly" as const, overdue: true },
];

describe("the record scenario registry", () => {
  it("every scenario resolves to a subject", () => {
    expect(ALL_SCENARIOS.length).toBeGreaterThan(15);
    for (const s of ALL_SCENARIOS) {
      expect(scenarioById(s.id), s.id).toBeDefined();
      expect(s.subjectId.length, s.id).toBeGreaterThan(0);
    }
  });

  it("every mocked scenario says what is missing", () => {
    // The `data` field is the whole point of the registry — a reviewer looking at a
    // screenshot needs to know whether they are seeing behaviour or a dressed-up
    // fixture. "mocked" with no note is the same as no label at all.
    for (const s of ALL_SCENARIOS) {
      if (s.data !== "mocked") continue;
      expect(s.note, `${s.id} is mocked with no note`).toBeDefined();
      expect(s.note!.length, s.id).toBeGreaterThan(40);
    }
  });

  it("no scenario label names a cadence the product cannot render", () => {
    /* THE ROOT OF THE ORIGINAL BUG. The label read "30-day review due", and the
       three stages this product renders are Intake, Day 30 and 90-day review — so
       no record could ever have shown those words. A label naming a string the
       product does not have is a label that will always be wrong about something.
       MEASURED at the time: "30-day" appeared nowhere in the rendered record. */
    const renderable = Object.values(STAGE_LABEL).map((l) => l.toLowerCase());
    for (const s of ALL_SCENARIOS) {
      for (const phrase of s.label.toLowerCase().match(/[0-9]+-day [a-z]+/g) ?? []) {
        expect(
          renderable.some((r) => r.includes(phrase)),
          `"${s.label}" names "${phrase}", which is not one of: ${renderable.join(" / ")}`
        ).toBe(true);
      }
    }
  });
});

describe("the review scenarios exhibit the state they name", () => {
  it("each one's subject is in the cadence stage its label claims", () => {
    for (const claim of REVIEW_CLAIMS) {
      const scenario = scenarioById(claim.id);
      expect(scenario, `${claim.id} is missing from the registry`).toBeDefined();
      const cadence = cadenceFor(scenario!.subjectId, NOW, {});
      expect(
        cadence.stage,
        `${claim.id} → ${scenario!.subjectId}: labelled "${scenario!.label}" but the record is in the ${cadence.stage} stage, which renders as "${STAGE_LABEL[cadence.stage]}"`
      ).toBe(claim.stage);
    }
  });

  it("and its due-or-overdue state matches too", () => {
    /* THE HALF THE STAGE DOES NOT CATCH. `review-90` and `review-overdue` are both
       quarterly; what separates them is whether the review has already lapsed — and
       that is exactly the distinction that collapsed when both pointed at t19. */
    for (const claim of REVIEW_CLAIMS) {
      const scenario = scenarioById(claim.id)!;
      const cadence = cadenceFor(scenario.subjectId, NOW, {});
      expect(cadence.nextReviewDue, `${claim.id} has no review due at all`).not.toBeNull();
      const state = reviewDueState(cadence.nextReviewDue!, NOW);
      expect(
        state.label.startsWith("overdue"),
        `${claim.id} → ${scenario.subjectId}: expected ${claim.overdue ? "overdue" : "due, not overdue"} but the chip reads "${state.label}"`
      ).toBe(claim.overdue);
      // All three exist to show the WARNING TONE on the cadence row. A review due
      // in forty days renders neutral and demonstrates nothing.
      expect(state.tone, `${claim.id} is outside the warning window ("${state.label}")`).toBe(
        "warning"
      );
    }
  });

  it("no two review scenarios name the same record", () => {
    const subjects = REVIEW_CLAIMS.map((c) => scenarioById(c.id)!.subjectId);
    expect(new Set(subjects).size, `subjects: ${subjects.join(", ")}`).toBe(subjects.length);
  });
});
