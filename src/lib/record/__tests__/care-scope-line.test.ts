// THE SCOPE STACK'S SECOND LINE — the counts, as values rather than a sentence.
//
// `summaryCounts` exists so the renderer can typeset the numeral differently
// from the noun, which is the whole of item A: a pre-joined "9 engaged days"
// string cannot be split into two voices without parsing it back apart. So the
// first claim here is a TYPE claim — the numeral survives as a number — and the
// rest is the pluralization and the absence handling.
//
// ═══ THE SINGULAR IS UNREACHABLE IN THE RAIL, AND THAT IS ASSERTED TOO ═══
//
// The checklist asks for a singular fixture. There is none, and one of the two
// singulars cannot exist: the themes element is gated on `contactDays >=
// contactFloor`, the floor is `min(3, ceil(blockDays * 0.25))`, and its minimum
// over the three trailing blocks is 2 — so a rendered engaged-day count is
// never 1. The last test states that arithmetic rather than leaving the report's
// claim unchecked. The pluralization itself is covered on the function, which is
// where it is decidable.

import { describe, expect, it } from "vitest";
import { summaryCounts } from "@/components/record/care-summary-doc";
import {
  careSummaryFor,
  contactFloorFor,
} from "@/lib/record/care-summary-doc";
import { CARE_TIME_BLOCKS } from "@/lib/record/care-time-block";
import { DEMO_TEENS } from "@/lib/record/people-demo";

const NOW = Date.UTC(2026, 8, 10, 12);

describe("the counts reach the renderer as values", () => {
  it("keeps the numeral a number and the noun a word", () => {
    // THE CONTRACT THE TWO-VOICE LINE RESTS ON. Returning `"9 engaged days"`
    // passes every count assertion below and makes the stat voice impossible.
    const [days] = summaryCounts(22, 9);
    expect(days.value).toBe(9);
    expect(typeof days.value).toBe("number");
    expect(days.unit).toBe("engaged days");
    // And the noun carries no digits, which is the other half of the split.
    expect(days.unit).not.toMatch(/\d/);
  });

  it("puts the engaged days before the exchanges", () => {
    expect(summaryCounts(22, 9).map((c) => c.unit)).toEqual([
      "engaged days",
      "exchanges",
    ]);
  });

  it("carries no terminal punctuation on either noun", () => {
    // Standing rule: this is a label, not a sentence.
    for (const c of summaryCounts(22, 9)) expect(c.unit).not.toMatch(/[.,;]$/);
  });
});

describe("pluralization", () => {
  it("uses the singular at exactly one, on both nouns", () => {
    expect(summaryCounts(1, 1).map((c) => `${c.value} ${c.unit}`)).toEqual([
      "1 engaged day",
      "1 exchange",
    ]);
  });

  it("uses the plural at two and above", () => {
    expect(summaryCounts(2, 2).map((c) => c.unit)).toEqual([
      "engaged days",
      "exchanges",
    ]);
    expect(summaryCounts(149, 58)[0].unit).toBe("engaged days");
  });

  it("pluralizes each noun on its own count", () => {
    // One of each: the mixed case is the one a shared flag would get wrong.
    expect(summaryCounts(1, 9).map((c) => `${c.value} ${c.unit}`)).toEqual([
      "9 engaged days",
      "1 exchange",
    ]);
  });
});

describe("absence is not a zero", () => {
  it("drops a half that has no measurement", () => {
    expect(summaryCounts(22, null).map((c) => c.unit)).toEqual(["exchanges"]);
    expect(summaryCounts(null, 9).map((c) => c.unit)).toEqual(["engaged days"]);
    expect(summaryCounts(22).map((c) => c.unit)).toEqual(["exchanges"]);
  });

  it("treats zero as an absence rather than a count", () => {
    // "0 engaged days" reads as a measurement of nothing; no measurement reads
    // as no measurement, and the renderer drops the line entirely.
    expect(summaryCounts(0, 0)).toEqual([]);
  });

  it("returns nothing at all when neither is measured", () => {
    // THE RENDERER'S CONDITION IS `counts.length > 0`, so this is what makes the
    // range stand alone on a record with no extraction.
    expect(summaryCounts(null, null)).toEqual([]);
  });
});

describe("what the rail can actually show", () => {
  it("never renders a one-day count, because the floor is two", () => {
    // The floor is `min(SUMMARY_MIN_CONTACT_DAYS, ceil(blockDays * 0.25))` and
    // the themes element is null below it — so a VISIBLE engaged-day count is
    // never 1, whatever the fixtures say. Stated as arithmetic over the real
    // blocks rather than as a claim about today's data.
    // `contactFloorFor` is the SHIPPED formula, imported rather than restated —
    // a local `min(3, ceil(…))` here would keep passing after the real one moved.
    const floors = CARE_TIME_BLOCKS.filter((b) => b.days !== null).map((b) =>
      contactFloorFor(b.id)
    );
    expect(Math.min(...floors)).toBe(2);
    // And the cadence path — no block — keeps the unproportioned floor.
    expect(contactFloorFor()).toBe(3);
  });

  it("agrees with the fixtures: no rendered count is below two", () => {
    const rendered: number[] = [];
    for (const teen of DEMO_TEENS)
      for (const b of CARE_TIME_BLOCKS) {
        const doc = careSummaryFor(teen.id, NOW, undefined, b.id);
        if (!doc) continue;
        for (const c of summaryCounts(
          doc.exchanges,
          doc.themes?.conversationDays ?? null
        ))
          rendered.push(c.value);
      }
    // A green result over an empty set would prove nothing.
    expect(rendered.length).toBeGreaterThanOrEqual(16);
    expect(Math.min(...rendered)).toBeGreaterThanOrEqual(2);
  });
});
