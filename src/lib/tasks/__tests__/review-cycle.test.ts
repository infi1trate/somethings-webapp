// ═══════════════════════════════════════════════════════════════════════════
// THE CYCLE IS THE ONE THIS PRODUCT SCHEDULES (rework §6.1)
//
// §6.1 asks for an even 30-day series — "30-day, 60-day, 90-day, 120-day,
// 150-day, and onward". The Care page's cadence is not that, and the difference
// is the whole reason this file exists: `care-demo.ts` derives
// `intake → day-30 next`, `day30 → day-120 next`, `quarterly → every 90 after`.
//
// So the real sequence is 30, 120, 210, 300 — and a "60-day review" is a
// delivery schedule this product does not run. Inventing one would render a
// clinical cadence authoritatively and wrongly, which `care-demo.ts` already
// paid for once: its chip read "due in 8 days · Day 30" on a teen 134 days in,
// and it was reported twice from the app.
//
// These tests pin the sequence against the two constants rather than against a
// list, so the day Meg confirms an even series there is one table to change and
// this file says exactly what changed.

import { describe, expect, it } from "vitest";
import {
  CYCLE_INTERVAL_DAYS,
  FIRST_CYCLE_DAY,
  cycleDays,
  cycleLabel,
  cycleSortKey,
  isCycleDay,
} from "@/lib/tasks/review-cycle";

describe("the sequence is day 30, then every 90", () => {
  it("starts at 30 and steps by 90, from the Care page's own derivation", () => {
    expect(FIRST_CYCLE_DAY).toBe(30);
    expect(CYCLE_INTERVAL_DAYS).toBe(90);
  });

  it("generates 30, 120, 210, 300, 390, 480", () => {
    expect(cycleDays(6)).toEqual([30, 120, 210, 300, 390, 480]);
  });

  it("is generated, not listed — a longer run keeps stepping by the interval", () => {
    const ten = cycleDays(10);
    for (let i = 1; i < ten.length; i++) {
      expect(ten[i] - ten[i - 1]).toBe(CYCLE_INTERVAL_DAYS);
    }
  });

  /* ═══ THE TWO THE PACK NAMES THAT DO NOT EXIST ═══
     60 and 150 are in §6.1's list and are not cadence days. Asserted, so a
     fixture seeding one fails rather than rendering a plausible wrong value —
     and so that if the even series IS confirmed, this test is the thing that
     tells you the model changed. */
  it("rejects 60-day and 150-day, which §6.1 names and the cadence does not run", () => {
    expect(isCycleDay(60)).toBe(false);
    expect(isCycleDay(150)).toBe(false);
    expect(isCycleDay(90)).toBe(false);
  });

  it("accepts every day the cadence does produce", () => {
    for (const d of cycleDays(8)) expect(isCycleDay(d), `${d} should be a cycle day`).toBe(true);
  });

  it("rejects anything before the first review", () => {
    expect(isCycleDay(0)).toBe(false);
    expect(isCycleDay(29)).toBe(false);
  });
});

describe("the label is a position, not a repeated noun (§6.2)", () => {
  it("reads '30-day', without the word review", () => {
    expect(cycleLabel(30)).toBe("30-day");
    expect(cycleLabel(120)).toBe("120-day");
  });

  it("so the header can be `Review` without saying it twice", () => {
    /* §6.2's naming split: the column header is the taxonomy's name and the
       cell is a position in it. "30-day review" under a header reading
       `Review` is the noun twice. */
    for (const d of cycleDays(4)) {
      expect(cycleLabel(d).toLowerCase()).not.toContain("review");
    }
  });
});

describe("sorting is by the day, never by the label (§3)", () => {
  it("orders numerically, which a lexicographic sort would not", () => {
    const days = cycleDays(4);
    const byLabel = [...days].sort((a, b) => cycleLabel(a).localeCompare(cycleLabel(b)));
    const byKey = [...days].sort((a, b) => cycleSortKey(a) - cycleSortKey(b));
    /* THE TRAP, DEMONSTRATED: sorting the rendered string puts "120-day"
       before "30-day", because "1" < "3". */
    expect(byLabel[0]).toBe(120);
    expect(byKey).toEqual([30, 120, 210, 300]);
  });

  it("puts an unknown cycle last in ascending order, not first", () => {
    /* An item with no cycle is not the earliest cycle — it is unknown, and
       unknown sorts to the end so it never heads a list a reader is scanning
       for the soonest review. */
    const mixed = [210, null, 30];
    const sorted = [...mixed].sort((a, b) => cycleSortKey(a) - cycleSortKey(b));
    expect(sorted).toEqual([30, 210, null]);
  });
});
