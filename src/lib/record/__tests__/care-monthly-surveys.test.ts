import { describe, expect, it } from "vitest";
import { carePatternFor } from "@/lib/record/care-pattern";
import { DEMO_TEENS } from "@/lib/record/people-demo";

// THE CLAIM UNDER TEST IS DATE-INDEPENDENCE, so it is tested across dates.
// 30-day spacing passed on the day it was written and doubled a column on 382
// of 730 anchor dates; this is the assertion that would have caught it.
describe("one reading per calendar month, on every anchor date", () => {
  it("never doubles a month and never skips one, across 400 days", () => {
    const monthKey = (at: number) => {
      const d = new Date(at);
      return d.getFullYear() * 12 + d.getMonth();
    };
    let doubled = 0, skipped = 0, checked = 0;
    const base = Date.UTC(2026, 0, 1, 12);
    for (let off = 0; off < 400; off++) {
      const now = base + off * 86_400_000;
      for (const t of DEMO_TEENS) {
        const p = carePatternFor(t.id, now);
        if (!p) continue;
        const keys = p.marks
          .filter((m) => m.cls === "assessment" && m.score !== undefined)
          .map((m) => monthKey(m.at));
        if (keys.length < 2) continue;
        checked++;
        if (new Set(keys).size !== keys.length) doubled++;
        if (Math.max(...keys) - Math.min(...keys) !== keys.length - 1) skipped++;
      }
    }
    // A green result over an empty set proves nothing.
    expect(checked).toBeGreaterThan(2000);
    expect(doubled, `${doubled} of ${checked} record-days doubled a month`).toBe(0);
    expect(skipped, `${skipped} of ${checked} record-days skipped a month`).toBe(0);
  });
});
