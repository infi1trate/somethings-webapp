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
// WHAT IS NOT HERE: that the accuracy axis is absent on a practice event, and
// that the shortcut sheet's rows differ per destination. Both are rendering
// facts, and both are asserted in `monitoring-states.mjs` against the DOM —
// a unit test would be asserting my own component's props back to me.

import { describe, expect, it } from "vitest";
import {
  ACCURACY_VALUES,
  DISPOSITION_REQUIRED_HINT,
  DISPOSITION_VALUES,
  dispositionById,
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
