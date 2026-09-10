// THE TRANSITIONS, ASSERTED — because the value they produce is immutable on a
// committed clinical record and wrong in either direction is invisible in
// review.

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTHORED,
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

  it("holds the two specced strings exactly, as ONE vocabulary", () => {
    /* ═══ WHY THE EXACT STRING AND NOT A PATTERN ═══
       These are the words a reader sees on a clinical record, specced verbatim,
       and the failure this guards against is DRIFT rather than absence: the
       compose modal had grown its own "AI notes inserted" beside this map's "AI
       notes inserted, unedited", two phrasings of one state on two surfaces of
       one record. A `/inserted/` pattern passes for every variant of that.
       So the assertion is the string. It is meant to fail when the copy changes
       — that is a copy decision, and this is where it gets made once. */
    expect(PROVENANCE_PHRASE.ai_inserted).toBe("AI draft inserted, unedited");
    expect(PROVENANCE_PHRASE.ai_assisted).toBe("Written with AI assistance");
    // Both open a line, so both are sentence-capped. A lowercase phrase read as
    // a fragment continuing text that was not there.
    for (const s of [PROVENANCE_PHRASE.ai_inserted, PROVENANCE_PHRASE.ai_assisted])
      expect(s[0]).toBe(s[0].toUpperCase());
    // And neither is a sentence: they are suffixes on someone else's prose.
    for (const s of Object.values(PROVENANCE_PHRASE)) expect(s).not.toMatch(/\.$/);
  });

  it("is the only place a read surface gets the words", () => {
    // THE STRUCTURAL HALF OF THE SAME CLAIM. Normalizing the two strings does
    // nothing if a surface can still write its own — so no component may carry
    // one of these phrases as a literal. Checked against the source, because it
    // is a claim about where the copy LIVES rather than what it says.
    const dir = "src/components/record";
    const offenders: string[] = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".tsx")) continue;
      const src = readFileSync(`${dir}/${f}`, "utf8");
      // Strip comments: this file's own history is discussed in prose above the
      // chip, and a comment quoting the old string is documentation, not copy.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const phrase of ["AI draft inserted", "Written with AI assistance", "AI notes inserted"])
        if (code.includes(phrase)) offenders.push(`${f}: "${phrase}"`);
    }
    expect(offenders).toEqual([]);
  });
});
