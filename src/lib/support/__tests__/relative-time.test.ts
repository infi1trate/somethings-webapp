import { describe, expect, it } from "vitest";
import { supportStamp, supportStampAbsolute } from "../relative-time";

const NOW = new Date(2026, 9, 16, 12, 0).getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("supportStamp", () => {
  it("reads now under a minute, and for a future instant", () => {
    expect(supportStamp(NOW, NOW)).toBe("now");
    expect(supportStamp(NOW - 59_999, NOW)).toBe("now");
    expect(supportStamp(NOW + 5 * MIN, NOW)).toBe("now");
  });
  it("counts minutes below an hour", () => {
    expect(supportStamp(NOW - MIN, NOW)).toBe("1m");
    expect(supportStamp(NOW - 59 * MIN, NOW)).toBe("59m");
  });
  it("counts hours below a day", () => {
    expect(supportStamp(NOW - HOUR, NOW)).toBe("1h");
    expect(supportStamp(NOW - (24 * HOUR - 1), NOW)).toBe("23h");
  });
  it("counts days below a week", () => {
    expect(supportStamp(NOW - DAY, NOW)).toBe("1d");
    expect(supportStamp(NOW - (7 * DAY - 1), NOW)).toBe("6d");
  });
  it("turns into a date at a week, never a large day count", () => {
    expect(supportStamp(NOW - 7 * DAY, NOW)).toBe("Oct 9");
    // The Figma row's 243d.
    expect(supportStamp(NOW - 243 * DAY, NOW)).toBe("Feb 15");
  });
  it("adds the year at a year", () => {
    expect(supportStamp(NOW - 365 * DAY, NOW)).toBe("Oct 2025");
    expect(supportStamp(NOW - 800 * DAY, NOW)).toBe("Aug 2024");
  });
  it("gives the absolute instant for the title", () => {
    // A local instant, not NOW − n×24h: that arithmetic crosses a DST change.
    expect(supportStampAbsolute(new Date(2026, 1, 15, 12, 0).getTime())).toBe("Feb 15, 2026, 12:00 PM");
  });
});

import { supportMessageTime } from "../relative-time";

describe("supportMessageTime", () => {
  const at = (m: number, d: number, h: number, min = 0, y = 2026) => new Date(y, m, d, h, min).getTime();
  it("is a clock time today", () => {
    expect(supportMessageTime(at(9, 16, 9, 5), NOW)).toBe("9:05 AM");
  });
  it("says yesterday, by calendar day not by 24 hours", () => {
    expect(supportMessageTime(at(9, 15, 23, 59), NOW)).toBe("Yesterday, 11:59 PM");
  });
  it("carries the date this year, and the year before it", () => {
    expect(supportMessageTime(at(9, 9, 13, 4), NOW)).toBe("Oct 9, 1:04 PM");
    expect(supportMessageTime(at(11, 30, 8, 0, 2025), NOW)).toBe("Dec 30, 2025, 8:00 AM");
  });
});
