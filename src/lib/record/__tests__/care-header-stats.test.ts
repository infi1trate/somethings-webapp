// THE HEADER'S STAT ROW — two constant labels, two numbers, and one utterance.
//
// ═══ WHAT THESE TESTS ARE FOR ═══
//
// `summaryStats` is four lines long, and none of its claims are about
// arithmetic. They are about SHAPE: that the row always has two data, that an
// absent measurement is a `0` rather than a missing column, that the labels do
// not agree with their values, and that the spoken form is built from the same
// two strings the visible labels use. Every one of those is a decision that a
// later edit could quietly reverse while every count still added up.
//
// ═══ AND ONE THING THEY DELIBERATELY DO NOT TEST ═══
//
// The previous version of this file tested pluralization at length. Those tests
// are deleted with the strings — a label that never agrees with its value has no
// singular form to get wrong. What replaces them is the assertion that no label
// changes with its number, which is the invariant that makes the deletion safe.

import { describe, expect, it } from "vitest";
import {
  summaryStats,
  summaryStatsSpoken,
} from "@/components/record/care-summary-doc";
import {
  careSummaryFor,
  contactFloorFor,
} from "@/lib/record/care-summary-doc";
import { CARE_TIME_BLOCKS } from "@/lib/record/care-time-block";
import { DEMO_TEENS } from "@/lib/record/people-demo";

const NOW = Date.UTC(2026, 8, 10, 12);

describe("the row always has two data", () => {
  it("returns both stats in a fixed order", () => {
    // THE ORDER IS THE LAYOUT. The row is read left to right and the two
    // columns are positional, so a swap here silently moves a number under the
    // wrong label — the one defect in this component a reader cannot detect.
    expect(summaryStats(22, 9).map((s) => s.label)).toEqual([
      "engaged days",
      "messages sent",
    ]);
  });

  it("keeps the value a number, so the renderer can typeset it", () => {
    const [days, ex] = summaryStats(22, 9);
    expect(days.value).toBe(9);
    expect(ex.value).toBe(22);
    for (const s of summaryStats(22, 9)) expect(typeof s.value).toBe("number");
  });

  it("never returns one datum, whatever is missing", () => {
    // A COLUMN THAT DISAPPEARS TAKES ITS LABEL WITH IT, and a reader then cannot
    // tell "nothing happened" from "this card does not track that".
    for (const args of [
      [22, 9],
      [22, null],
      [null, 9],
      [null, null],
      [0, 0],
    ] as const)
      expect(summaryStats(args[0], args[1]), `${args}`).toHaveLength(2);
    expect(summaryStats(22)).toHaveLength(2);
  });
});

describe("a zero is a value, not an absence", () => {
  it("renders 0 where there is no measurement", () => {
    // THE REVERSAL, ASSERTED. This function used to drop a half it had no number
    // for. In a stat row a zero under a standing label is the more honest of the
    // two, and the sections below carry the interpretation in words.
    expect(summaryStats(null, null).map((s) => s.value)).toEqual([0, 0]);
    expect(summaryStats(null, 9).map((s) => s.value)).toEqual([9, 0]);
    expect(summaryStats(22, null).map((s) => s.value)).toEqual([0, 22]);
  });

  it("never yields an em-dash or a blank where a number belongs", () => {
    for (const s of summaryStats(null, null)) {
      expect(String(s.value)).toBe("0");
      expect(String(s.value)).not.toMatch(/[—–-]/);
    }
  });

  it("reaches the zero state on a real record", () => {
    // A DAY-ONE RECORD, not a hand-made null: t1 has no per-block conversation
    // entry, so this is the state the card actually renders for it.
    const doc = careSummaryFor("t1", NOW, undefined, "recent")!;
    expect(doc.themes).toBeNull();
    expect(summaryStats(doc.exchanges, doc.themes?.conversationDays ?? null).map((s) => s.value))
      .toEqual([0, 0]);
  });
});

describe("the labels are categorical", () => {
  it("does not change a label with its value", () => {
    // THIS IS WHAT MAKES DELETING THE SINGULAR FORMS SAFE. "Engaged days: 1" is
    // correct in a column whose header names the measure; "Engaged day: 1" would
    // not be. So no label may vary with its number — asserted across the range
    // that a plural rule would have branched on.
    const labelsAt = (n: number) => summaryStats(n, n).map((s) => s.label);
    const base = labelsAt(9);
    for (const n of [0, 1, 2, 11, 149]) expect(labelsAt(n), `at ${n}`).toEqual(base);
  });

  it("carries no digits and no punctuation", () => {
    for (const s of summaryStats(1, 1)) {
      expect(s.label).not.toMatch(/\d/);
      expect(s.label).not.toMatch(/[.,;:]/);
    }
  });

  it("is lowercase, because the VALUE opens the pair now", () => {
    // THIS INVERTED WITH THE FRAME. The labels were sentence-capped while they
    // sat ABOVE their values and read as column headings. The value leads now,
    // so the label is the continuation — "10 / engaged days" — and a capital
    // there would start a second sentence under the first.
    for (const s of summaryStats(1, 1)) expect(s.label).toBe(s.label.toLowerCase());
  });
});

describe("what a screen reader hears", () => {
  it("speaks the numbers with their nouns, in row order", () => {
    expect(summaryStatsSpoken(summaryStats(50, 10))).toBe(
      "10 engaged days, 50 messages sent."
    );
  });

  it("speaks zeros rather than omitting them", () => {
    expect(summaryStatsSpoken(summaryStats(null, null))).toBe(
      "0 engaged days, 0 messages sent."
    );
  });

  it("is built from the visible labels, so the two cannot drift", () => {
    // THE POINT OF DERIVING IT. A second spoken vocabulary is a second copy set,
    // and the failure is silent: the row says one thing and the announcement
    // says another, and only a screen-reader user ever finds out.
    const stats = summaryStats(22, 9);
    const spoken = summaryStatsSpoken(stats);
    for (const s of stats) expect(spoken).toContain(s.label.toLowerCase());
  });
});

describe("what the rail can actually show", () => {
  it("still recomputes per block, unchanged", () => {
    // The stat row is a presentation change; the numbers behind it are the same
    // per-block values. THREE blocks now — the 30-day pair ("9/22") went with
    // the block and its fixtures, so this list is also the check that nothing
    // still reaches for it.
    const pairs = CARE_TIME_BLOCKS.map((b) => {
      const doc = careSummaryFor("t17", NOW, undefined, b.id)!;
      return summaryStats(doc.exchanges, doc.themes?.conversationDays ?? null)
        .map((s) => s.value)
        .join("/");
    });
    expect(new Set(pairs).size).toBe(3);
    expect(pairs).toEqual(["3/7", "24/61", "58/149"]);
  });

  it("never renders a one-day count, because the floor is two", () => {
    // `contactFloorFor` is the SHIPPED formula, imported rather than restated —
    // a local `min(3, ceil(…))` here would keep passing after the real one moved.
    // This is also why "1 engaged days" — the cost of dropping the singular —
    // is unreachable rather than merely unlikely.
    const floors = CARE_TIME_BLOCKS.filter((b) => b.days !== null).map((b) =>
      contactFloorFor(b.id)
    );
    expect(Math.min(...floors)).toBe(2);
    // And the cadence path — no block — keeps the unproportioned floor.
    expect(contactFloorFor()).toBe(3);
  });

  it("shows only 0 or 2-and-up on every record and block", () => {
    const seen = new Set<number>();
    for (const teen of DEMO_TEENS)
      for (const b of CARE_TIME_BLOCKS) {
        const doc = careSummaryFor(teen.id, NOW, undefined, b.id);
        if (!doc) continue;
        for (const s of summaryStats(doc.exchanges, doc.themes?.conversationDays ?? null))
          seen.add(s.value);
      }
    // A green result over an empty set would prove nothing.
    expect(seen.size).toBeGreaterThan(8);
    expect([...seen].filter((v) => v === 1)).toEqual([]);
  });
});
