// THE TRANSITIONS, ASSERTED — because the value they produce is immutable on a
// committed clinical record and wrong in either direction is invisible in
// review.

import { describe, expect, it } from "vitest";
import {
  AUTHORED,
  onRevise,
  discloses,
  onEdit,
  onInsert,
  PROVENANCE_PHRASE,
  type FieldProvenanceState,
} from "@/lib/record/field-provenance";

describe("the walk the pack specifies", () => {
  it("authored -> insert -> ai_inserted -> edit -> ai_assisted", () => {
    let p: FieldProvenanceState = AUTHORED;
    expect(p.state).toBe("authored");
    p = onInsert("The weighted PHQ-9 is 10, in the moderate band.");
    expect(p.state).toBe("ai_inserted");
    p = onEdit(p, "The weighted PHQ-9 is 10, in the moderate band. Sleep leads.");
    expect(p.state).toBe("ai_assisted");
  });
});

describe("authored is terminal under editing", () => {
  it("stays authored however much the field is typed into", () => {
    let p = AUTHORED;
    for (const t of ["a", "ab", "abc", ""]) p = onEdit(p, t);
    expect(p.state).toBe("authored");
  });

  it("stays authored when a draft is only viewed or copied", () => {
    // There is no `onView` / `onCopy` and that is the point: neither event can
    // move the state, so a supervisor who reads a draft and writes their own
    // paragraph is recorded as having written it.
    expect(Object.keys({ onInsert, onEdit })).toEqual(["onInsert", "onEdit"]);
    expect(AUTHORED.state).toBe("authored");
  });
});

describe("ai_inserted is a claim about the current text", () => {
  it("survives a change event that does not change the string", () => {
    // React fires these; treating one as an edit would flip a verbatim
    // insertion to "assisted" without a keystroke.
    const p = onInsert("exact");
    expect(onEdit(p, "exact").state).toBe("ai_inserted");
  });

  it("moves on the first edit that does change it", () => {
    expect(onEdit(onInsert("exact"), "exac").state).toBe("ai_assisted");
  });
});

describe("the edit transition is one-way", () => {
  it("does not return to ai_inserted when the text is retyped exactly", () => {
    const inserted = onInsert("verbatim draft");
    const edited = onEdit(inserted, "verbatim draf");
    expect(edited.state).toBe("ai_assisted");
    // Restoring the characters does not restore the state: the state records
    // that a human formed a view about the model's text.
    expect(onEdit(edited, "verbatim draft").state).toBe("ai_assisted");
  });

  it("keeps what was inserted after the transition", () => {
    const p = onEdit(onInsert("original"), "changed");
    expect(p.insertedText).toBe("original");
  });
});

describe("replace over authored text is more AI involvement, not less", () => {
  it("goes straight to ai_inserted from a typed field", () => {
    let p = AUTHORED;
    p = onEdit(p, "my own paragraph");
    expect(p.state).toBe("authored");
    p = onInsert("the model's paragraph");
    expect(p.state).toBe("ai_inserted");
  });
});

describe("disclosure", () => {
  it("says nothing for authored and something for both AI states", () => {
    expect(discloses("authored")).toBe(false);
    expect(discloses("ai_inserted")).toBe(true);
    expect(discloses("ai_assisted")).toBe(true);
  });

  it("names the unedited case distinctly — it is the clinically notable one", () => {
    expect(PROVENANCE_PHRASE.ai_inserted).not.toBe(PROVENANCE_PHRASE.ai_assisted);
    expect(PROVENANCE_PHRASE.ai_inserted).toMatch(/unedited/);
    // Nothing renders for authored, so nothing is written for it.
    expect(PROVENANCE_PHRASE.authored).toBe("");
  });
});

// ── TAKING AN AI REVISION (E) ───────────────────────────────────────────────
// The claim under test is a NARROWER one than insertion makes, and these
// assertions exist because the tempting implementation — reuse `onInsert` —
// would put "AI draft inserted, unedited" on a field holding the supervisor's
// own revised sentences.

describe("onRevise", () => {
  it("lands ai_assisted from authored — never ai_inserted", () => {
    const p = onRevise(AUTHORED);
    expect(p.state).toBe("ai_assisted");
    // The precise defect this guards: the phrase that would otherwise be
    // recorded is a factual claim about text the supervisor wrote.
    expect(PROVENANCE_PHRASE[p.state]).not.toMatch(/unedited/);
  });

  it("is idempotent on ai_assisted", () => {
    const once = onRevise(AUTHORED);
    expect(onRevise(once).state).toBe("ai_assisted");
  });

  it("carries insertedText through rather than adopting the revision", () => {
    const inserted = onInsert("the model's paragraph");
    const revised = onRevise(inserted);
    expect(revised.insertedText).toBe("the model's paragraph");
    // And so a later edit still compares against the draft that was received,
    // which is the only thing `insertedText` is for.
    expect(onEdit(revised, "anything at all").state).toBe("ai_assisted");
  });

  it("degrades honestly if Improve is ever offered on an untouched draft", () => {
    // The UI suppresses this path (E1). If that suppression is lifted, the
    // transition must weaken the claim, not strengthen it.
    expect(onRevise(onInsert("draft")).state).toBe("ai_assisted");
    expect(discloses(onRevise(onInsert("draft")).state)).toBe(true);
  });
});
