// THE AI NOTES, DERIVED FROM THE CARE SUMMARY DOCUMENT.
//
// The previous version of this file tested four hand-authored bullet sets. That
// authoring WAS the bug: only t17/t23/t19/t18 had notes, so every other record
// — including the Day 30 review scenario a supervisor is most likely to open —
// correctly rendered no control at all, which is indistinguishable from a
// broken feature. The notes are derived now, so the questions worth asking
// changed:
//
//   · does every record with a summary get notes (the coverage claim);
//   · is the shape still notes rather than prose (the 3–5 claim);
//   · and do the notes agree with the document they came from, rather than
//     asserting a second set of facts beside it.
//
// THE LAST ONE IS WHY DERIVING WAS WORTH IT, so it is asserted directly: the
// trajectory bullet must be the document's own sentence, character for
// character, and the weighted bullet must carry the review's own number.

import { describe, expect, it } from "vitest";
import { NOTES_MAX, NOTES_MIN, aiNotesFor, draftBasis } from "@/lib/record/ai-drafts";
import { careSummaryFor } from "@/lib/record/care-summary-doc";
import { pendingReviewFor } from "@/lib/record/care-demo";
import { DEMO_TEENS } from "@/lib/record/people-demo";

const NOW = Date.UTC(2026, 8, 9, 12);

const docFor = (id: string) => careSummaryFor(id, NOW, undefined);
/** Mirrors what `care-tab` passes: the aggregate when there is one, the single
 *  survey otherwise. A day-30 review has one intake result, not a period. */
const aggFor = (id: string) => {
  const r = pendingReviewFor(id, NOW, undefined);
  if (r?.aggregate)
    return {
      score: r.aggregate.score,
      severity: r.aggregate.severity,
      count: r.aggregate.surveys.length,
      instrument: r.aggregate.surveys[0]?.instrument,
    };
  if (r?.survey)
    return {
      score: r.survey.score,
      severity: r.survey.severity,
      count: 1,
      instrument: r.survey.instrument,
    };
  return null;
};
const notesFor = (id: string) => aiNotesFor(docFor(id), aggFor(id));

/** Every roster record whose Care tab has a summary document — which is every
 *  record that can open either surface the notes appear on. */
const withDoc = () => DEMO_TEENS.filter((t) => docFor(t.id)).map((t) => t.id);

describe("coverage — the defect that prompted the rewrite", () => {
  it("gives notes to every record that has a summary", () => {
    const ids = withDoc();
    expect(ids.length).toBeGreaterThan(8);
    const without = ids.filter((id) => !notesFor(id));
    expect(without, "records with a summary but no notes").toEqual([]);
  });

  it("covers the Day 30 review scenario, which had none before", () => {
    // t9 is `review-day30`'s subject and was the record in the bug report.
    expect(notesFor("t9")).not.toBeNull();
    expect(notesFor("t9")!.clinical?.length).toBeGreaterThanOrEqual(NOTES_MIN);
  });

  it("returns null only when there is no summary at all", () => {
    expect(aiNotesFor(null)).toBeNull();
  });
});

describe("the notes are notes, not a paragraph in a list", () => {
  it("keeps every field between three and five bullets", () => {
    let checked = 0;
    for (const id of withDoc()) {
      const n = notesFor(id)!;
      for (const set of [n.clinical, n.diagnostic]) {
        if (!set) continue; // a field under the floor is dropped, not shown
        expect(set.length, `${id}: ${set.length} bullets`).toBeGreaterThanOrEqual(NOTES_MIN);
        expect(set.length).toBeLessThanOrEqual(NOTES_MAX);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("keeps every COMPOSED bullet to one scannable sentence", () => {
    /* ═══ THE QUOTED TRAJECTORY IS EXEMPT, AND THAT IS THE POINT ═══
       Two of these assertions were in conflict: bullets stay short, and the
       trajectory bullet is the document's own sentence character for character.
       t20's runs to 163. Verbatim wins — re-wording it would put two phrasings
       of one trajectory in front of a reader, which is the defect deriving
       these was meant to avoid — so the cap applies to the bullets this module
       COMPOSES and the quoted one is measured separately below. */
    for (const id of withDoc()) {
      const doc = docFor(id)!;
      const n = notesFor(id)!;
      for (const set of [n.clinical, n.diagnostic])
        for (const b of set ?? []) {
          if (b === doc.trajectory) continue;
          expect(b.length, `${id}: "${b}" is ${b.length} chars`).toBeLessThanOrEqual(120);
          expect(b.length).toBeGreaterThan(15);
          expect(b.trim()).toBe(b);
        }
    }
  });

  it("bounds the quoted trajectory too — it is a bullet, not a paragraph", () => {
    // Not unlimited: if the document's trajectory ever grows into prose, this
    // panel would be showing a paragraph again under a bullet marker.
    let checked = 0;
    for (const id of withDoc()) {
      const t = docFor(id)!.trajectory;
      if (!t) continue;
      expect(t.length, `${id}: trajectory is ${t.length} chars`).toBeLessThanOrEqual(200);
      checked++;
    }
    expect(checked).toBeGreaterThan(4);
  });

  it("never repeats a bullet inside a field — they are React keys", () => {
    for (const id of withDoc()) {
      const n = notesFor(id)!;
      for (const set of [n.clinical, n.diagnostic])
        if (set) expect(new Set(set).size, `${id} has a duplicate`).toBe(set.length);
    }
  });

  it("gives the two fields different bullets", () => {
    // Handing both fields the same observations is handing a supervisor one
    // note to paste twice, which is how two fields end up saying one thing.
    for (const id of withDoc()) {
      const n = notesFor(id)!;
      if (!n.clinical || !n.diagnostic) continue;
      const overlap = n.clinical.filter((b) => n.diagnostic!.includes(b));
      expect(overlap, `${id} shares bullets across fields`).toEqual([]);
    }
  });
});

describe("the notes agree with the document they came from", () => {
  it("uses the document's own trajectory sentence, unaltered", () => {
    let checked = 0;
    for (const id of withDoc()) {
      const doc = docFor(id)!;
      if (!doc.trajectory) continue;
      expect(notesFor(id)!.diagnostic).toContain(doc.trajectory);
      checked++;
    }
    expect(checked).toBeGreaterThan(4);
  });

  it("carries the review's own weighted number, not a recomputed one", () => {
    let checked = 0;
    for (const id of withDoc()) {
      const agg = aggFor(id);
      if (!agg || agg.count < 2) continue; // a single reading is not weighted
      const line = notesFor(id)!.diagnostic!.find((b) => /Recency-weighted/.test(b));
      expect(line, `${id} has no weighted bullet`).toBeDefined();
      expect(line).toContain(`is ${agg.score} —`);
      expect(line).toContain(agg.severity);
      checked++;
    }
    expect(checked).toBeGreaterThan(2);
  });

  it("states an empty flag window rather than omitting it", () => {
    // An empty window is a finding. The rail says so; so do the notes.
    let quiet = 0;
    for (const id of withDoc()) {
      const doc = docFor(id)!;
      if (doc.flags.length) continue;
      expect(notesFor(id)!.clinical).toContain(
        "No risk flags were raised in this window."
      );
      quiet++;
    }
    expect(quiet).toBeGreaterThan(0);
  });

  it("proposes nothing — no bullet makes the judgment the review makes", () => {
    // The review flow diagnoses; these observe. A bullet that recommended a
    // code would be a second opinion competing with the card above it.
    const banned = /should |recommend|propose|suggests? (that )?the code|still fits|no longer fits|change the code/i;
    for (const id of withDoc()) {
      const n = notesFor(id)!;
      for (const set of [n.clinical, n.diagnostic])
        for (const b of set ?? [])
          expect(banned.test(b), `${id}: "${b}" reads as a proposal`).toBe(false);
    }
  });
});

describe("the basis line", () => {
  it("names the instrument and the count it actually read", () => {
    const basis = draftBasis([
      { instrument: "GAD-7", at: 0, score: 9, severity: "mild", items: [] },
      { instrument: "GAD-7", at: 0, score: 8, severity: "mild", items: [] },
    ]);
    expect(basis).toContain("2 GAD-7 readings");
    expect(basis).toContain("not itself a clinical determination");
  });

  it("says something true when there are no readings", () => {
    const basis = draftBasis([]);
    expect(basis).not.toContain("0 ");
    expect(basis).toContain("conversation themes");
  });
});
