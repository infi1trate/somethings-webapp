// FREEZING A SUMMARY INTO THE RECORD.
//
// `commitFor` exists because a committed summary must NOT be re-derived — the
// evidence a past decision rests on has to stay what it was. That is a claim
// about aliasing and about completeness, and both are checkable:
//
//  · nothing in the returned entry points back into the live document, so a
//    later mutation of the record cannot edit history;
//  · every finding the card displayed has a counterpart in the entry, so the
//    History row is not a lossier story than the document was.
//
// The second one is the reason this file asserts on `markerCounts` per tier
// rather than on a total: a total would pass while the tier breakdown was
// silently wrong, and the tier breakdown is the part a supervisor reads.

import { describe, expect, it } from "vitest";
import {
  commitFor,
  type CareSummaryDoc,
} from "@/lib/record/care-summary-doc";

const doc = (over: Partial<CareSummaryDoc> = {}): CareSummaryDoc => ({
  teenId: "t17",
  window: { fromAt: 1_000, toAt: 9_000, firstCycle: false },
  generatedAt: 9_000,
  sources: ["assessments"],
  // The qualitative read is not part of a COMMIT — `commitFor` does not copy it
  // — so the builder states it as absent rather than inventing prose the
  // assertions would then have to ignore.
  conversationSummary: null,
  trajectory: "Scores held in the moderate band.",
  themes: {
    conversationDays: 9,
    themes: [
      { tagId: "sleep-disturbance", days: 7 },
      { tagId: "low-mood-hopelessness", days: 6 },
    ],
  },
  contentDelta: { added: ["appetite-change"], resolved: [] },
  flags: [
    {
      eventId: "ce-f-1",
      tier: "imminent",
      tierLabel: "Imminent risk",
      categoryLabels: ["Active suicidal ideation"],
      at: 5_000,
      resolved: false,
    },
    {
      eventId: "ce-f-2",
      tier: "clinicalReview",
      tierLabel: "Clinical support",
      categoryLabels: ["Passive suicidal ideation"],
      at: 6_000,
      resolved: true,
    },
    {
      eventId: "ce-f-3",
      tier: "clinicalReview",
      tierLabel: "Clinical support",
      categoryLabels: ["Passive suicidal ideation"],
      at: 7_000,
      resolved: false,
    },
  ],
  concordance: { result: "diverges" },
  contactDays: 9,
  currentCode: "F33.0",
  ...over,
});

describe("the frozen entry", () => {
  it("carries the window, the code, the call and the contact days", () => {
    const c = commitFor(doc(), "ce-cs-1", 9_500);
    expect(c.id).toBe("ce-cs-1");
    expect(c.teenId).toBe("t17");
    expect(c.committedAt).toBe(9_500);
    expect(c.windowFromAt).toBe(1_000);
    expect(c.windowToAt).toBe(9_000);
    expect(c.firstCycle).toBe(false);
    expect(c.code).toBe("F33.0");
    expect(c.concordance).toBe("diverges");
    expect(c.contactDays).toBe(9);
  });

  it("counts flags per tier, resolved ones included", () => {
    // A flag that was resolved DURING the window was still evidence in it. The
    // document lists it; dropping it from the record would make the entry
    // disagree with the card it was frozen from.
    const c = commitFor(doc(), "ce-cs-1", 9_500);
    expect(c.markerCounts).toEqual({
      imminent: 1,
      clinicalReview: 2,
      generalMonitoring: 0,
      unassigned: 0,
    });
  });

  it("carries every theme WITH its denominator", () => {
    const c = commitFor(doc(), "ce-cs-1", 9_500);
    expect(c.themes).toEqual([
      { tagId: "sleep-disturbance", days: 7 },
      { tagId: "low-mood-hopelessness", days: 6 },
    ]);
    expect(c.conversationDays).toBe(9);
  });

  it("records the cross-reference when one is supplied, and nothing when not", () => {
    expect(commitFor(doc(), "ce-cs-1", 9_500, "ce-cu-7").documents).toBe("ce-cu-7");
    expect(commitFor(doc(), "ce-cs-1", 9_500).documents).toBeUndefined();
  });
});

describe("what a refusal freezes", () => {
  it("keeps the refusal as the call rather than omitting it", () => {
    const c = commitFor(
      doc({ concordance: { result: "insufficientData" }, contactDays: 2 }),
      "ce-cs-2",
      9_500
    );
    // "We could not say" is a finding about the cycle and belongs in the record.
    expect(c.concordance).toBe("insufficientData");
    expect(c.contactDays).toBe(2);
  });

  it("stores an empty theme list and a null denominator when element 2 refused", () => {
    const c = commitFor(doc({ themes: null }), "ce-cs-3", 9_500);
    expect(c.themes).toEqual([]);
    expect(c.conversationDays).toBeNull();
  });

  it("records zero markers as zeroes, not as absent keys", () => {
    // An empty flag list is meaningful — the document renders it explicitly —
    // and a reader of the record must be able to tell "none" from "unknown".
    const c = commitFor(doc({ flags: [] }), "ce-cs-4", 9_500);
    expect(c.markerCounts).toEqual({
      imminent: 0,
      clinicalReview: 0,
      generalMonitoring: 0,
      unassigned: 0,
    });
  });

  it("keeps a null code as null rather than inventing one", () => {
    expect(commitFor(doc({ currentCode: null }), "ce-cs-5", 9_500).code).toBeNull();
  });
});

describe("the freeze holds", () => {
  it("shares no mutable structure with the document", () => {
    const source = doc();
    const c = commitFor(source, "ce-cs-1", 9_500);

    // The theme objects are COPIES. Aliasing them would put a live fixture
    // object inside a record entry — see the note on the field.
    expect(c.themes[0]).not.toBe(source.themes!.themes[0]);
    source.themes!.themes[0].tagId = "EDITED";
    source.themes!.themes[0].days = 99;
    expect(c.themes[0]).toEqual({ tagId: "sleep-disturbance", days: 7 });

    // And the array itself.
    source.themes!.themes.push({ tagId: "appeared-later", days: 1 });
    expect(c.themes).toHaveLength(2);
  });

  it("does not mutate the document it froze", () => {
    const source = doc();
    const before = JSON.stringify(source);
    commitFor(source, "ce-cs-1", 9_500);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("is deterministic for identical input", () => {
    const source = doc();
    const first = JSON.stringify(commitFor(source, "ce-cs-1", 9_500));
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(commitFor(source, "ce-cs-1", 9_500))).toBe(first);
    }
  });

  it("stores no message content, no score and no person-level tier", () => {
    const c = commitFor(doc(), "ce-cs-1", 9_500);
    const keys = Object.keys(c);
    // The governing rules, as a shape assertion: a field named for a transcript,
    // a sentiment number or a tier for the TEEN would each be a rule break, and
    // this is the cheapest place to catch one being added.
    for (const forbidden of ["messages", "transcript", "excerpt", "sentiment", "score", "tier", "risk"]) {
      expect(keys).not.toContain(forbidden);
    }
    // The trajectory PROSE is deliberately not carried either: it is written for
    // a reader of the card, and a record entry that quoted it would be storing a
    // sentence nobody signed.
    expect(keys).not.toContain("trajectory");
  });
});
