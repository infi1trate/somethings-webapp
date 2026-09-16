// ═══ THE PER-BUCKET DEADLINE FACT (arch-F, F1.2) ═══
//
// Each bucket's right-hand fact must carry what its header cannot, and the
// boundary between two buckets is where that either works or lies. The browser
// cannot exercise the boundary — Tasks freezes `now` at mount (`tasks-page.tsx`),
// so no row crosses a bucket while the page is open — which is exactly why the
// crossing is tested here, where the clock is an argument.

import { describe, expect, it } from "vitest";
import { bucketOf, deadlineFactFor } from "@/lib/tasks/deadline-buckets";
import { elapsedLabel } from "@/components/tasks/strips";

const MINUTE = 60_000;
const HOUR = 3_600_000;
/** A fixed afternoon so "today", "tomorrow" and "later" are unambiguous and the
 *  test does not change meaning at midnight. */
const NOW = new Date("2026-09-15T14:00:00").getTime();
const fact = (deadline: number, now = NOW) => deadlineFactFor(deadline, now, elapsedLabel);

describe("each bucket says what its header cannot", () => {
  it("overdue reports how late, which is the actionable number", () => {
    expect(fact(NOW - 9 * HOUR)).toBe("overdue by 9h");
    expect(fact(NOW - 40 * MINUTE)).toBe("overdue by 40m");
  });

  it("due today reports the hour", () => {
    expect(fact(NOW + 2 * HOUR)).toBe("due 4:00 PM");
    expect(fact(new Date("2026-09-15T23:30:00").getTime())).toBe("due 11:30 PM");
  });

  it("due tomorrow reports the hour too — the header already said which day", () => {
    expect(fact(new Date("2026-09-16T09:00:00").getTime())).toBe("due 9:00 AM");
  });

  it("later reports the date, because beyond tomorrow the day IS the fact", () => {
    expect(fact(new Date("2026-09-18T09:00:00").getTime())).toBe("due Sep 18");
  });
});

describe("the crossing", () => {
  it("changes expression the moment a deadline passes", () => {
    const deadline = NOW + MINUTE;
    /* ONE MINUTE EITHER SIDE of the same deadline. This is the transition the
       page cannot show with a frozen clock, and the one a supervisor watching a
       4:00 PM row at 3:59 has to see resolve correctly. */
    expect(bucketOf(deadline, NOW)).toBe("today");
    expect(fact(deadline, NOW)).toBe("due 2:01 PM");
    expect(bucketOf(deadline, NOW + 2 * MINUTE)).toBe("overdue");
    expect(fact(deadline, NOW + 2 * MINUTE)).toBe("overdue by 1m");
  });

  it("crosses from today into tomorrow at midnight, not at 24 hours", () => {
    const justBeforeMidnight = new Date("2026-09-15T23:59:00").getTime();
    const justAfterMidnight = new Date("2026-09-16T00:01:00").getTime();
    expect(bucketOf(justBeforeMidnight, NOW)).toBe("today");
    expect(bucketOf(justAfterMidnight, NOW)).toBe("tomorrow");
    /* BOTH READ AS A CLOCK TIME and are two minutes apart — which is the point:
       the DAY comes from the header, so the row does not have to disambiguate
       it and the two expressions are deliberately alike. */
    expect(fact(justBeforeMidnight)).toBe("due 11:59 PM");
    expect(fact(justAfterMidnight)).toBe("due 12:01 AM");
  });

  it("never reads 'due in 1d' in two different buckets, which is what it did before", () => {
    /* THE MEASURED DEFECT arch-F FIXED: `elapsedLabel` rounds 24–47h to "1d"
       while `bucketOf` partitions by calendar day, so on the shipped fixtures
       five rows under "Later" read "due in 1d" — they read as due tomorrow. */
    const tomorrowEvening = new Date("2026-09-16T20:00:00").getTime();
    const dayAfterMorning = new Date("2026-09-17T08:00:00").getTime();
    expect(bucketOf(tomorrowEvening, NOW)).toBe("tomorrow");
    expect(bucketOf(dayAfterMorning, NOW)).toBe("later");
    // Both are "1d" by elapsed rounding…
    expect(elapsedLabel(NOW, tomorrowEvening)).toBe("1d");
    expect(elapsedLabel(NOW, dayAfterMorning)).toBe("1d");
    // …and the two facts are now distinguishable.
    expect(fact(tomorrowEvening)).not.toBe(fact(dayAfterMorning));
    expect(fact(dayAfterMorning)).toBe("due Sep 17");
  });
});
