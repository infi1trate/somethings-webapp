// WHEN THE IMPROVE CONTROL IS OFFERED, AND WHAT IT SAYS WHEN OPENED.
//
// These are two different questions and the bug this file was written for was
// answering them with one function. `canImprove` used to call `improve()` and
// hide the control whenever it returned null — and `improve()` returns null the
// moment its output would equal its input, which becomes true at every full stop
// and false again at the next word. The control blinked four times over one
// two-sentence draft and was absent for the whole of the space after each
// sentence, which is how it was reported.
//
// SO THE FIRST DESCRIBE BLOCK IS ABOUT STABILITY, NOT CORRECTNESS OF THE
// SUGGESTION. Its assertions are deliberately about what does NOT change the
// answer: punctuation, trailing spaces, already-clean prose. A test that only
// checked "3 words shows, 2 words hides" would pass against the old
// implementation too.

import { describe, expect, it } from "vitest";
import {
  IMPROVE_MIN_WORDS,
  canImproveText,
  improve,
  wordCount,
} from "@/lib/record/ai-drafts";

/** The predicate, replayed one character at a time — the only shape that can
 *  catch a control that flickers, because every assertion on a finished string
 *  is blind to what happened on the way there. */
function visibilityFlips(text: string): number {
  let shown: boolean | null = null;
  let flips = 0;
  for (let i = 1; i <= text.length; i++) {
    const can = canImproveText(text.slice(0, i));
    if (shown !== null && can !== shown) flips++;
    shown = can;
  }
  return flips;
}

describe("the Improve control's visibility", () => {
  it("appears at three words and not before", () => {
    expect(IMPROVE_MIN_WORDS).toBe(3);
    expect(canImproveText("two words")).toBe(false);
    expect(canImproveText("now three words")).toBe(true);
  });

  it("never flickers while a draft is typed out", () => {
    // THE REGRESSION, EXACTLY. Four flips before; one transition after — off,
    // then on, and never off again.
    expect(visibilityFlips("The worry is generalised. It is not situational. ")).toBe(1);
    expect(visibilityFlips("I think the anxiety still fits. It is not new.")).toBe(1);
    expect(visibilityFlips("Contact steady. Worry recurs. No flags raised.")).toBe(1);
  });

  it("is unmoved by a trailing space after the last character", () => {
    // The specific report: the link disappeared once a space followed the text.
    for (const base of [
      "The worry is generalised.",
      "The worry is generalised",
      "one two three",
    ]) {
      expect(canImproveText(base)).toBe(true);
      expect(canImproveText(`${base} `)).toBe(true);
      expect(canImproveText(`${base}   `)).toBe(true);
    }
  });

  it("is unmoved by punctuation, which is what used to flip it", () => {
    const words = "The worry is generalised";
    expect(canImproveText(words)).toBe(true);
    // Adding the full stop is the keystroke that used to hide the control.
    expect(canImproveText(`${words}.`)).toBe(true);
    expect(canImproveText(`${words}. `)).toBe(true);
    expect(canImproveText(`${words}. And`)).toBe(true);
  });

  it("stays visible on prose that has nothing left to improve", () => {
    // The decisive case: `improve` declines, and the control is there anyway.
    const clean = "The worry is generalised rather than situational.";
    expect(improve(clean)).toBeNull();
    expect(canImproveText(clean)).toBe(true);
  });

  it("hides again only when the text falls back under three words", () => {
    expect(canImproveText("one two three")).toBe(true);
    expect(canImproveText("one two")).toBe(false);
    expect(canImproveText("")).toBe(false);
    expect(canImproveText("   ")).toBe(false);
  });
});

describe("wordCount", () => {
  it("ignores leading, trailing and repeated whitespace", () => {
    expect(wordCount("  a  b   c  ")).toBe(3);
    expect(wordCount("a\n\nb\tc")).toBe(3);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount("")).toBe(0);
  });

  it("counts a partial word, because a person mid-word is still typing one", () => {
    expect(wordCount("The worry i")).toBe(3);
  });
});

describe("improve", () => {
  it("declines below the control's own threshold, using the same rule", () => {
    expect(improve("two words")).toBeNull();
    expect(wordCount("two words")).toBeLessThan(IMPROVE_MIN_WORDS);
  });

  it("uses the WORD threshold, not a character floor — they disagree", () => {
    // THE CASE THAT SEPARATES THEM, and the reason this test exists: the
    // assertion above passes against a 12-character floor too, because "two
    // words" is short by both rules. `improve` must accept a three-word string
    // under twelve characters, or the button is offered on text the function
    // will silently refuse to work on.
    const short = "a b c";
    expect(short.length).toBeLessThan(12);
    expect(wordCount(short)).toBe(IMPROVE_MIN_WORDS);
    expect(canImproveText(short)).toBe(true);
    expect(improve(short)).not.toBeNull();
  });

  it("never refuses on length something the control offers", () => {
    // The general form of the above, over the boundary either side.
    for (const t of ["a b c", "ab cd ef", "i am ok", "one two three four"]) {
      if (!canImproveText(t)) continue;
      // A refusal here can only be "nothing to change", never "too short" —
      // and each of these has something to change (capital, full stop).
      expect(improve(t), `improve refused ${JSON.stringify(t)}`).not.toBeNull();
    }
  });

  it("declines when its output would equal what was written", () => {
    expect(improve("The worry is generalised rather than situational.")).toBeNull();
  });

  it("treats trailing whitespace alone as nothing to suggest", () => {
    // Otherwise every draft would have a suggestion pending mid-typing.
    expect(improve("The worry is generalised rather than situational. ")).toBeNull();
  });

  it("does offer to collapse a doubled space between words", () => {
    // THIS USED TO BE MISSED. The comparison ran against the already-normalised
    // string, so the one change the function had actually made was invisible to
    // it and it reported "nothing to change".
    const out = improve("The worry is  generalised rather than situational.");
    expect(out).toBe("The worry is generalised rather than situational.");
  });

  it("still strips a filler opener, capitalises and terminates", () => {
    expect(improve("i think the worry is generalised")).toBe(
      "The worry is generalised."
    );
  });

  it("adds no claim that was not in the input", () => {
    // The pipeline constraint, held as an assertion: every word out came in.
    const input = "basically the mentor reports two missed calls this month";
    const out = improve(input)!;
    const inWords = new Set(input.toLowerCase().match(/[a-z]+/g));
    for (const w of out.toLowerCase().match(/[a-z]+/g)!)
      expect(inWords.has(w), `"${w}" was not in the input`).toBe(true);
  });
});
