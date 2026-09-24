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

  it("holds no verb at all — escalating is an action, not a disposition", () => {
    /* ═══ THE INVERSION (addendum §2.8) ═══
       This used to assert that an `escalate` value EXISTED and did not
       resolve. It exists no longer: a disposition is a statement about the
       teen that a supervisor is recorded as having made, and putting a verb
       in the radiogroup meant the required clinical question could be
       answered with an action.
       WHAT IS ASSERTED NOW IS THE ABSENCE, and it is asserted over the LABELS
       as well as the effects — re-adding it as a `watch`-effect value called
       "Escalate now" would satisfy an effects-only check while putting the
       verb straight back on the control. */
    expect(DISPOSITION_VALUES.map((d) => d.effect)).not.toContain("escalate");
    for (const d of DISPOSITION_VALUES) {
      expect(d.label.toLowerCase(), d.id).not.toContain("escalat");
    }
  });

  it("offers exactly the three values §2.8 names", () => {
    /* THE COUNT AND THE IDS, because the primary is gated on this array being
       answerable and a fourth value would change what "required" costs. Still
       BLOCKED · Dr. Nissan — these three are proposed, not signed off. */
    expect(DISPOSITION_VALUES.map((d) => d.id)).toEqual([
      "no-concern",
      "support-in-place",
      "watching",
    ]);
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
    /* TWO ARMS SINCE §2.8 — `escalate` went with the value that carried it. */
    const effects = new Set(DISPOSITION_VALUES.map((d) => d.effect));
    expect([...effects].sort()).toEqual(["resolve", "watch"]);
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
// THE SECOND VOCABULARY IS GONE (addendum §2.1)
//
// Phase 8 added ~110 lines here pinning a practice event's own axis 1 and
// axis 2: that they shared no value id with the clinical axis, that they said
// nothing clinical, that "Pattern — for their lead" did not close, and that
// axis 2 asked about a THRESHOLD rather than a classifier. All of it described
// Mentor Practice, which is removed.
//
// WHAT THE PHASE LEFT BEHIND IS ABOVE, and it is the part worth keeping: the
// separation invariants on the one remaining pair of axes — that an accuracy
// answer cannot satisfy a disposition under any id, that only a disposition
// closes an event, and that nothing is pre-selected. Those were written for
// the collapse this file exists to prevent, and that collapse is still
// possible with one vocabulary.
//
// THE MUTATION THAT GOT THROUGH IN PHASE 8 is worth recording too, because the
// check it produced survives: renaming a `RULE_FEEDBACK_VALUES` label to
// "Classifier was right" passed every probe check, because the probe read the
// radiogroup's `aria-label` and the shortcut sheet but never the buttons. The
// `axes.*.axis2-values-agree` check in `monitoring-states.mjs` came from that
// and now guards the surviving axis 2.
