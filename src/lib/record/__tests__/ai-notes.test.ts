// THE AI NOTES FIXTURES.
//
// The old file here tested `improve()` and the visibility of the control that
// called it — both removed. What is checkable about notes is different and
// smaller: the SHAPE has to hold, because "3 to 5 bullets" degrades into a
// paragraph in list clothing one long bullet at a time, and nothing in the type
// system stops that.
//
// SO THE ASSERTIONS ARE ABOUT LENGTH AND COUNT, and they are deliberately
// mechanical. A bullet is not a sentence a reader parses for meaning; it is an
// observation they scan, agree with, and copy. The moment one runs to three
// lines it is prose, and the panel is a draft again under a different name.

import { describe, expect, it } from "vitest";
import {
  NOTES_MAX,
  NOTES_MIN,
  aiNotesFor,
  draftBasis,
} from "@/lib/record/ai-drafts";

/** Every record that has notes at all. Named rather than derived, so a fixture
 *  disappearing shows up as a failure here instead of a silently smaller loop. */
const WITH_NOTES = ["t17", "t23", "t19", "t18"] as const;

const allSets = () =>
  WITH_NOTES.flatMap((id) => {
    const n = aiNotesFor(id);
    return [
      { id, field: "clinical", bullets: n?.clinical },
      { id, field: "diagnostic", bullets: n?.diagnostic },
    ];
  });

describe("the notes are notes, not a paragraph in a list", () => {
  it("gives every field between three and five bullets", () => {
    let checked = 0;
    for (const { id, field, bullets } of allSets()) {
      expect(bullets, `${id}.${field} has no bullets`).toBeDefined();
      expect(
        bullets!.length,
        `${id}.${field} has ${bullets!.length} bullets`
      ).toBeGreaterThanOrEqual(NOTES_MIN);
      expect(bullets!.length).toBeLessThanOrEqual(NOTES_MAX);
      checked++;
    }
    // A green result over an empty set proves nothing.
    expect(checked).toBe(WITH_NOTES.length * 2);
  });

  it("keeps each bullet to one scannable line", () => {
    // ~110 characters is roughly one line at the panel's 13px in the rail's
    // 380px column, measured. The cap is the point: a bullet that wraps three
    // times is the paragraph this change removed.
    for (const { id, field, bullets } of allSets())
      for (const b of bullets!) {
        expect(b.length, `${id}.${field}: "${b}" is ${b.length} chars`).toBeLessThanOrEqual(110);
        expect(b.length).toBeGreaterThan(20);
      }
  });

  it("gives each bullet exactly one sentence's worth of content", () => {
    // Two sentences in one bullet is two observations a reader cannot copy
    // separately, which defeats the per-bullet copy control.
    for (const { id, field, bullets } of allSets())
      for (const b of bullets!) {
        const terminators = (b.match(/[.!?](\s|$)/g) ?? []).length;
        expect(terminators, `${id}.${field}: "${b}" has ${terminators}`).toBe(1);
      }
  });

  it("never repeats a bullet inside a field — they are React keys", () => {
    for (const { id, field, bullets } of allSets())
      expect(new Set(bullets).size, `${id}.${field} has a duplicate`).toBe(
        bullets!.length
      );
  });

  it("returns null for a record with nothing to draw on", () => {
    // The disclosure is HIDDEN on this, not disabled.
    expect(aiNotesFor("t13")).toBeNull();
    expect(aiNotesFor("t24")).toBeNull();
    expect(aiNotesFor("nope")).toBeNull();
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
