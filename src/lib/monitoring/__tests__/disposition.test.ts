// ═══════════════════════════════════════════════════════════════════════════
// THE TWO AXES — and the properties that make them two rather than one
//
// arch-mon built the split; Phase 5 is where its rules get pinned. What the
// control replaced asked "Was this flagged correctly?" with No / Yes, styled Yes
// as primary, and on a self-harm-language flag produced a one-tap path to
// closure that recorded no clinical judgment at all.
//
// So the invariants worth a test are the ones that would let that collapse back:
//
//  · ONLY A DISPOSITION CLOSES AN EVENT. If `resolves()` ever returned true for
//    an accuracy answer, or for the watch or escalate values, the one-tap path
//    is back under a different name.
//  · THE ESCALATE VALUE DOES NOT RESOLVE. Resolving would file the event as
//    handled at the moment it stopped being handled.
//  · NOTHING IS PRE-SELECTED. A default disposition is a clinical statement
//    nobody made.
//  · EVERY CONSUMER READS THE ARRAY. The values are blocked on Dr. Nissan, and
//    the promise on `DISPOSITION_VALUES` is that answering the question is one
//    edit in one file — which is only true while nothing hardcodes a count, an
//    order or a label.
//
// WHAT IS NOT HERE: which vocabulary each destination RENDERS, and that the
// shortcut sheet's rows differ per destination. Both are rendering facts,
// asserted in `monitoring-states.mjs` against the DOM — a unit test would be
// asserting my own component's props back to me.
//
// PHASE 5'S NOTE HERE SAID "the accuracy axis is absent on a practice event",
// which was true then and is not now: Phase 8 gave practice events an axis 2
// with a DIFFERENT producer — the rule's provisional threshold rather than a
// classifier. Corrected rather than deleted, because the reasoning that removed
// it is the reasoning that shaped what replaced it.

import { describe, expect, it } from "vitest";
import {
  ACCURACY_VALUES,
  DISPOSITION_REQUIRED_HINT,
  DISPOSITION_VALUES,
  PRACTICE_DISPOSITION_REQUIRED_HINT,
  PRACTICE_DISPOSITION_VALUES,
  RULE_FEEDBACK_VALUES,
  dispositionById,
  practiceCloses,
  practiceDispositionById,
  resolves,
} from "@/lib/monitoring/disposition";

describe("only a clinical disposition can close an event", () => {
  it("resolves for exactly the values whose effect is resolve", () => {
    // THE INPUT IS ASSERTED: an empty array would satisfy every filter below.
    expect(DISPOSITION_VALUES.length).toBeGreaterThan(2);
    for (const d of DISPOSITION_VALUES) {
      expect(resolves(d), d.id).toBe(d.effect === "resolve");
    }
  });

  it("does not resolve on the escalate value", () => {
    // Resolving here would file the event as handled at the moment it stopped
    // being handled — the path the old control did not have at all.
    const esc = DISPOSITION_VALUES.find((d) => d.effect === "escalate");
    expect(esc, "an escalate value exists").toBeDefined();
    expect(resolves(esc!)).toBe(false);
  });

  it("does not resolve on the watch value, which is the open question", () => {
    const watch = DISPOSITION_VALUES.find((d) => d.effect === "watch");
    expect(watch, "a watch value exists").toBeDefined();
    expect(resolves(watch!)).toBe(false);
    // Flagged as clinically unresolved, so deleting it later is one array entry.
    expect(watch!.unresolvedQuestion).toBe(true);
  });

  it("resolves nothing for no answer at all", () => {
    expect(resolves(null)).toBe(false);
    expect(dispositionById(null)).toBeNull();
    expect(dispositionById("accurate")).toBeNull();
  });

  it("cannot be satisfied by an accuracy answer under any id", () => {
    // ═══ THE COLLAPSE THIS PREVENTS ═══
    // The two axes are separate arrays and a shared id would be the seam where
    // one could be passed for the other — `dispositionById("accurate")` above
    // returns null because of that separation, and this is why it holds.
    const dIds = new Set(DISPOSITION_VALUES.map((d) => d.id));
    for (const a of ACCURACY_VALUES) {
      expect(dIds.has(a.id), `${a.id} is both an axis-1 and an axis-2 id`).toBe(
        false
      );
      expect(resolves(dispositionById(a.id))).toBe(false);
    }
  });
});

describe("the axes are shaped so neither can be mistaken for the other", () => {
  it("gives every disposition a stated consequence, and axis 2 none", () => {
    // The consequence is shown AT the control, so a reader knows what the button
    // does before pressing it rather than from a toast afterwards. Axis 2 has no
    // consequence because it has no effect — that asymmetry is the design.
    for (const d of DISPOSITION_VALUES) {
      expect(d.consequence.length, d.id).toBeGreaterThan(10);
    }
    for (const a of ACCURACY_VALUES) {
      expect(Object.keys(a).sort()).toEqual(["id", "label"]);
    }
  });

  it("names the classifier on axis 2, and never asks for agreement", () => {
    // "Yes" invited a reader to agree with a model rather than judge its output.
    for (const a of ACCURACY_VALUES) {
      expect(a.label.toLowerCase()).toContain("classifier");
      expect(a.label.toLowerCase()).not.toMatch(/^(yes|no)$/);
    }
  });

  it("offers two answers on axis 2 and no third 'unsure' that would gate", () => {
    // Two, because it is optional: leaving it alone IS the third answer, and it
    // is the default. A rendered "unsure" would make the axis look answerable-
    // required.
    expect(ACCURACY_VALUES).toHaveLength(2);
  });

  it("states the requirement in words, for the inline hint", () => {
    // Not a disabled button, which announces nothing and gives no reason.
    expect(DISPOSITION_REQUIRED_HINT.toLowerCase()).toContain("disposition");
  });
});

describe("the blocked values stay one edit away", () => {
  it("has a unique id per value on both axes", () => {
    for (const vals of [DISPOSITION_VALUES, ACCURACY_VALUES]) {
      expect(new Set(vals.map((v) => v.id)).size).toBe(vals.length);
    }
  });

  it("covers every effect the page branches on, and no others", () => {
    // `DispositionEffect` is the union the page switches over. A value with an
    // effect nothing handles would fall through to doing nothing at all.
    const effects = new Set(DISPOSITION_VALUES.map((d) => d.effect));
    expect([...effects].sort()).toEqual(["escalate", "resolve", "watch"]);
  });

  it("carries a reader-facing label on every value", () => {
    for (const v of [...DISPOSITION_VALUES, ...ACCURACY_VALUES]) {
      expect(v.label.length, v.id).toBeGreaterThan(3);
      // Not the id shouted quietly.
      expect(v.label).not.toBe(v.id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AXIS 1 AND 2, FOR A MENTOR PRACTICE EVENT (Phase 8)
//
// Gap row 421 left one question open: does a practice event take a SECOND
// vocabulary, or does the required axis become flag-only? It takes a second one,
// and these pin the properties that make it a different axis rather than the
// clinical one relabelled.

describe("a practice event takes its own vocabulary", () => {
  it("shares no value id with the clinical axis", () => {
    // ═══ THE COLLAPSE THIS PREVENTS ═══
    // A shared id is the seam where one axis could be passed for the other, and
    // the pane routes by SUBJECT rather than by id — so an overlap would make a
    // clinical disposition satisfiable from the practice destination.
    const clinical = new Set(DISPOSITION_VALUES.map((d) => d.id));
    for (const d of PRACTICE_DISPOSITION_VALUES) {
      expect(clinical.has(d.id), `${d.id} is in both vocabularies`).toBe(false);
      expect(dispositionById(d.id), `${d.id} resolves as clinical`).toBeNull();
    }
    for (const d of DISPOSITION_VALUES) {
      expect(practiceDispositionById(d.id), `${d.id} resolves as practice`).toBeNull();
    }
  });

  it("says nothing clinical, because nobody asked a clinical question", () => {
    // The defect gap 421 recorded, asserted as a property of the words: a
    // mentor's missed video note was offered "No clinical concern".
    for (const d of PRACTICE_DISPOSITION_VALUES) {
      const text = `${d.label} ${d.consequence}`.toLowerCase();
      for (const w of ["clinical", "teen", "escalat"]) {
        expect(text, `${d.id} says "${w}"`).not.toContain(w);
      }
    }
  });

  it("can record that the rule did not apply, which is what makes it usable", () => {
    // Every threshold these rules read is PROVISIONAL and none can see PTO, an
    // unreachable teen, or a swapped shift. Without this value a supervisor
    // would have to record having spoken to a mentor who did nothing wrong in
    // order to clear the row.
    const v = PRACTICE_DISPOSITION_VALUES.find((d) => d.id === "rule-did-not-apply");
    expect(v, "the value exists").toBeDefined();
    expect(practiceCloses(v!)).toBe(true);
  });

  it("does not close on a pattern — noticing one is not resolving it", () => {
    const v = PRACTICE_DISPOSITION_VALUES.find((d) => d.effect === "pattern");
    expect(v, "a pattern value exists").toBeDefined();
    expect(practiceCloses(v!)).toBe(false);
    // Its ROUTING is what is blocked, not the value — there is no lead-mentor
    // object to hand it to — and the flag is what says so.
    expect(v!.unresolvedRouting).toBe(true);
    expect(v!.consequence.toLowerCase()).toContain("lead");
  });

  it("closes on nothing at all, and on a clinical id", () => {
    expect(practiceCloses(null)).toBe(false);
    expect(practiceCloses(practiceDispositionById("no-concern"))).toBe(false);
  });

  it("gives every value a consequence, because one of them does not close", () => {
    for (const d of PRACTICE_DISPOSITION_VALUES) {
      expect(d.consequence.length, d.id).toBeGreaterThan(10);
    }
  });
});

describe("axis 2 asks about the producer, and each subject has a different one", () => {
  it("asks about the THRESHOLD on practice, never about a classifier", () => {
    // Phase 5 removed the classifier axis from practice events because the five
    // rules are deterministic. The threshold is the question that remains, and
    // it is the only feedback that could un-provisional a constant.
    for (const v of RULE_FEEDBACK_VALUES) {
      expect(v.label.toLowerCase()).toContain("threshold");
      expect(v.label.toLowerCase()).not.toContain("classifier");
    }
  });

  it("and about the CLASSIFIER on a flag, never about a threshold", () => {
    for (const v of ACCURACY_VALUES) {
      expect(v.label.toLowerCase()).toContain("classifier");
      expect(v.label.toLowerCase()).not.toContain("threshold");
    }
  });

  it("is two answers on both, so leaving it alone stays the default", () => {
    expect(RULE_FEEDBACK_VALUES).toHaveLength(2);
    expect(ACCURACY_VALUES).toHaveLength(2);
  });

  it("shares no id with either axis 1, so neither can resolve anything", () => {
    for (const v of [...RULE_FEEDBACK_VALUES, ...ACCURACY_VALUES]) {
      expect(practiceCloses(practiceDispositionById(v.id))).toBe(false);
      expect(resolves(dispositionById(v.id))).toBe(false);
    }
  });

  it("is not axis 1 restated — the two ask about different things", () => {
    // "Rule didn't apply here" is about THIS INSTANCE (a mentor on PTO).
    // "Threshold looks wrong" is about THE CONSTANT (a cutoff that trips
    // everybody daily). Conflating them loses the only signal that can settle a
    // provisional number, so no label may appear on both axes.
    const a1 = PRACTICE_DISPOSITION_VALUES.map((d) => d.label.toLowerCase());
    for (const v of RULE_FEEDBACK_VALUES) {
      expect(a1, v.label).not.toContain(v.label.toLowerCase());
    }
  });
});

describe("the practice hint names its own axis", () => {
  it("does not ask for a disposition, which is the other axis's word", () => {
    expect(PRACTICE_DISPOSITION_REQUIRED_HINT.toLowerCase()).not.toContain(
      "disposition"
    );
    expect(PRACTICE_DISPOSITION_REQUIRED_HINT.length).toBeGreaterThan(10);
  });
});
