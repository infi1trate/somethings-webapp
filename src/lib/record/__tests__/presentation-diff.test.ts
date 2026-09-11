// WHICH OF THE THREE PROPOSALS THIS IS — the one decision the shared diff makes.
//
// The framing and the chip both hang off `proposalKindFor`, so a wrong answer
// here shows up twice: a renewal drawn as a two-column diff printing one
// sentence twice under an arrow, AND a chip saying "Change proposed" beside a
// code that did not change. That is the whole reason the derivation is one
// function rather than a comparison at each of the two call sites.

import { describe, expect, it } from "vitest";
import {
  PROPOSAL_LABEL,
  proposalKindFor,
} from "@/components/record/presentation-diff";

describe("the three kinds of proposal", () => {
  it("calls nothing-on-record an assignment", () => {
    expect(proposalKindFor(null, "F43.22")).toBe("assign");
    // `undefined` is the same absence — a payload that omits the field and one
    // that carries null both mean "nothing has been assigned yet".
    expect(proposalKindFor(undefined, "F43.22")).toBe("assign");
  });

  it("calls the same code a renewal", () => {
    expect(proposalKindFor("F33.1", "F33.1")).toBe("renewal");
  });

  it("calls a different code a change", () => {
    expect(proposalKindFor("F33.0", "F33.1")).toBe("change");
  });

  it("keys on the CODE, never the statement", () => {
    /* A re-worded statement under the same code is a renewal of that code — the
       billable fact has not moved — and calling it a change would put the
       attention chip on a copy edit. The signature makes that structural: there
       is nowhere to pass a statement. */
    expect(proposalKindFor.length).toBe(2);
  });
});

describe("the labels", () => {
  it("gives each kind its own words", () => {
    const labels = Object.values(PROPOSAL_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("uses the Care page's vocabulary, not the queue's", () => {
    /* THE PRODUCT OWNER'S CALL: the Care page's strings are the more refined of
       the two and are canonical for both surfaces. Tasks said "First assignment"
       for the assign case; asserted exactly, because the failure mode is drift —
       two surfaces committing one decision under two vocabularies is what this
       extraction exists to end. */
    expect(PROPOSAL_LABEL.assign).toBe("Presentation proposed");
    expect(PROPOSAL_LABEL.change).toBe("Change proposed");
    expect(PROPOSAL_LABEL.renewal).toBe("Renewal proposed");
    // And none of them is the retired queue string.
    for (const l of labels_()) expect(l).not.toMatch(/first assignment/i);
  });
});

function labels_() {
  return Object.values(PROPOSAL_LABEL);
}
