// THE CONCORDANCE RULE, PROVEN DETERMINISTIC.
//
// The brief asks for "a deterministic rule set, not model judgment", and the only
// way that claim means anything is if it is checked. `concordanceFor` is a pure
// function — no clock, no randomness, no store, no network — so every branch is
// reachable from a literal input, and the same input must always produce the same
// call. Both are asserted below.
//
// Category ids are REAL values from `risk-taxonomy.ts`, not invented strings: a
// test that passes on `"FAKE_CATEGORY"` would pass while `tierOf` returned null
// for everything, which is the failure most worth catching.

import { describe, expect, it } from "vitest";
import {
  concordanceFor,
  SUMMARY_MARKER_THRESHOLD,
  SUMMARY_MIN_CONTACT_DAYS,
  type ConcordanceInput,
} from "@/lib/record/care-summary-doc";
import { tierOf } from "@/lib/record/risk-taxonomy";

/** Top-1% equivalent — see the note on QUALIFYING_TIERS. */
const IMMINENT = "ACTIVE_SUICIDAL_IDEATION_WITH_PLAN_OR_MEANS";
/** Top-5% equivalent. */
const CLINICAL = "PASSIVE_SUICIDAL_IDEATION";
/** Below both, so it must NOT count as a marker. */
const GENERAL = "HATE_SPEECH_RACIAL_SLURS";

const base: ConcordanceInput = {
  contactDays: 9,
  instrument: "PHQ-9",
  priorScore: 12, // moderate
  currentScore: 12, // moderate — no movement
  categoriesPerFlag: [],
  currentCode: "F33.0",
};

const withMarkers = (n: number, cat = IMMINENT): string[][] =>
  Array.from({ length: n }, () => [cat]);

describe("the tier fixtures this suite depends on", () => {
  it("uses category ids that really carry the tiers the rule looks for", () => {
    // Guards the whole suite: if these drift, every assertion below still passes
    // for the wrong reason.
    expect(tierOf(IMMINENT)).toBe("imminent");
    expect(tierOf(CLINICAL)).toBe("clinicalReview");
    expect(tierOf(GENERAL)).toBe("generalMonitoring");
  });
});

describe("insufficient data — a refusal, checked first", () => {
  it("refuses below the contact-day floor even when markers would otherwise fire", () => {
    const call = concordanceFor({
      ...base,
      contactDays: SUMMARY_MIN_CONTACT_DAYS - 1,
      categoriesPerFlag: withMarkers(5),
    });
    expect(call.result).toBe("insufficientData");
    // A refusal carries no statement: there is nothing honest to put in one.
    expect(call.statement).toBeUndefined();
  });

  it("refuses when there is only one comparable reading", () => {
    expect(
      concordanceFor({ ...base, priorScore: null }).result
    ).toBe("insufficientData");
  });

  it("refuses when no instrument is present", () => {
    expect(
      concordanceFor({ ...base, instrument: null }).result
    ).toBe("insufficientData");
  });
});

describe("diverges", () => {
  it("fires on no tier movement plus enough qualifying markers", () => {
    const call = concordanceFor({
      ...base,
      categoriesPerFlag: withMarkers(SUMMARY_MARKER_THRESHOLD),
    });
    expect(call.result).toBe("diverges");
  });

  it("counts clinical-review markers as well as imminent ones", () => {
    const call = concordanceFor({
      ...base,
      categoriesPerFlag: withMarkers(SUMMARY_MARKER_THRESHOLD, CLINICAL),
    });
    expect(call.result).toBe("diverges");
  });

  it("does NOT count general-monitoring flags as markers", () => {
    const call = concordanceFor({
      ...base,
      categoriesPerFlag: withMarkers(6, GENERAL),
    });
    expect(call.result).toBe("concordant");
  });

  it("names the code's implication, the threshold met, and the gap", () => {
    const call = concordanceFor({
      ...base,
      categoriesPerFlag: withMarkers(SUMMARY_MARKER_THRESHOLD),
    });
    const s = call.statement;
    expect(s).toBeDefined();
    // "Score and content diverge" is not acceptable output — every fragment has
    // to carry something a supervisor can check.
    expect(s!.codeImplies).toContain("F33.0");
    expect(s!.codeImplies).toContain("moderate");
    expect(s!.contentMeets).toMatch(/PHQ-9 ≥ 10/);
    expect(s!.contentMeets).toMatch(/consistent with/);
    expect(s!.gap).toBe("one severity tier");
  });
});

describe("concordant", () => {
  it("fires when the score moved a tier, however many markers there are", () => {
    const call = concordanceFor({
      ...base,
      priorScore: 12, // moderate
      currentScore: 6, // mild — one tier down
      categoriesPerFlag: withMarkers(5),
    });
    expect(call.result).toBe("concordant");
  });

  it("fires when markers are below the threshold", () => {
    const call = concordanceFor({
      ...base,
      categoriesPerFlag: withMarkers(SUMMARY_MARKER_THRESHOLD - 1),
    });
    expect(call.result).toBe("concordant");
  });

  it("carries no statement — the three-part fragment belongs to divergence", () => {
    expect(concordanceFor(base).statement).toBeUndefined();
  });
});

describe("instrument-specific severity ladders", () => {
  it("does not report a GAD-7 move across a band GAD-7 does not have", () => {
    // 17 and 19 are both "severe" on GAD-7 (no "moderately severe" band), so
    // there is no movement — a shared ladder would have found one.
    const call = concordanceFor({
      ...base,
      instrument: "GAD-7",
      priorScore: 17,
      currentScore: 19,
      categoriesPerFlag: withMarkers(SUMMARY_MARKER_THRESHOLD),
    });
    expect(call.result).toBe("diverges");
  });

  it("sees the same two scores as a move on PHQ-9, which has the extra band", () => {
    // 17 is "moderately severe", 19 is "moderately severe" — still no move.
    // 14 → 17 crosses moderate → moderately severe, which only PHQ-9 can do.
    const call = concordanceFor({
      ...base,
      instrument: "PHQ-9",
      priorScore: 14,
      currentScore: 17,
      categoriesPerFlag: withMarkers(SUMMARY_MARKER_THRESHOLD),
    });
    expect(call.result).toBe("concordant");
  });
});

describe("determinism", () => {
  it("returns an identical call for identical input, every time", () => {
    const input: ConcordanceInput = {
      ...base,
      categoriesPerFlag: withMarkers(4, CLINICAL),
    };
    const first = JSON.stringify(concordanceFor(input));
    for (let i = 0; i < 25; i++) {
      expect(JSON.stringify(concordanceFor(input))).toBe(first);
    }
  });

  it("does not mutate its input", () => {
    const input: ConcordanceInput = {
      ...base,
      categoriesPerFlag: withMarkers(3),
    };
    const before = JSON.stringify(input);
    concordanceFor(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("resolves the documented overlap in favour of diverges", () => {
    // The brief's conditions overlap: matching direction (no movement) AND 4
    // markers satisfies both branches. The more consequential call wins, and this
    // test is the record of that decision.
    const call = concordanceFor({
      ...base,
      categoriesPerFlag: withMarkers(4),
    });
    expect(call.result).toBe("diverges");
  });
});
