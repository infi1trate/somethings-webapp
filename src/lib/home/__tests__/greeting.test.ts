// ═══════════════════════════════════════════════════════════════════════════
// THE GREETING NEVER LIES ABOUT THE TIME OF DAY (G.1.2, L.2)
//
// G.1 defaulted to a time-NEUTRAL greeting precisely because a computed one
// might render "morning" during a shift that runs 1 PM – 10 PM. L.2 overrides
// that default, so the condition it was protecting against has to be checked
// rather than assumed.
//
// A three-point check at 1 PM, 6 PM and 9:30 PM is what L.2 asks for. It is
// also the weakest possible version of the claim — three samples cannot show
// that no point in a nine-hour window fails. So the sweep is every minute of
// the shift, and the three named instants are asserted on top of it as the
// report-back the phase names.

import { describe, expect, it } from "vitest";
import {
  GREETING_WORD,
  greetingBandFor,
  greetingFor,
} from "@/lib/home/greeting";
import { SCHEDULE_TZ } from "@/lib/home/schedule";

/** An instant at a given wall-clock hour and minute in `SCHEDULE_TZ`, on a
 *  known weekday. Built by probing the zone rather than assuming an offset —
 *  the same discipline `dev-clock.ts` uses and for the same reason: a baked-in
 *  offset is wrong for half the year. */
function at(hour: number, minute = 0): number {
  const naive = Date.UTC(2026, 8, 28, hour, minute);
  const seen = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SCHEDULE_TZ,
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(naive))
      .find((p) => p.type === "hour")?.value ?? "0"
  );
  const drift = ((hour - seen + 36) % 24) - 12;
  return naive + drift * 3_600_000;
}

const hourIn = (ms: number) =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SCHEDULE_TZ,
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .find((p) => p.type === "hour")?.value ?? "0"
  );

describe("the helper builds the instants it claims to", () => {
  it("lands on the wall-clock hour it was asked for", () => {
    for (const h of [0, 9, 13, 18, 21, 23]) {
      expect(hourIn(at(h)), `at(${h}) is not ${h}:00 in ${SCHEDULE_TZ}`).toBe(h);
    }
  });
});

describe("no instant in the shift reads 'morning' (G.1.2's own test)", () => {
  /* The three L.2 names, reported explicitly. */
  it.each([
    [13, 0, "1:00 PM"],
    [18, 0, "6:00 PM"],
    [21, 30, "9:30 PM"],
  ])("%s:%s — %s", (h, m, label) => {
    const line = greetingFor(at(h, m), "Stephen");
    expect(line, `${label} reads "${line}"`).not.toMatch(/morning/i);
  });

  it("and no minute of the 1 PM – 10 PM window does either", () => {
    /* THE SWEEP, because three samples cannot show a nine-hour window is
       clean. Every minute from 13:00 to 21:59 inclusive. */
    let checked = 0;
    for (let h = 13; h < 22; h++) {
      for (let m = 0; m < 60; m++) {
        const band = greetingBandFor(at(h, m));
        expect(band, `${h}:${String(m).padStart(2, "0")} fell in the morning band`).not.toBe(
          "morning"
        );
        checked++;
      }
    }
    expect(checked).toBe(9 * 60);
  });

  it("but still says morning when it actually is morning", () => {
    /* The greeting is COMPUTED, not merely shift-safe. A version that never
       said "morning" at any hour would pass the sweep above and be wrong. */
    expect(greetingBandFor(at(9))).toBe("morning");
    expect(greetingFor(at(9), "Stephen")).toContain("Good morning");
  });
});

describe("the bands cover the clock with no gap and no overlap", () => {
  it("assigns every hour exactly one band", () => {
    const seen = new Map<number, string>();
    for (let h = 0; h < 24; h++) seen.set(h, greetingBandFor(at(h)));
    expect(seen.size).toBe(24);
    for (const [h, band] of seen) {
      expect(GREETING_WORD[band as keyof typeof GREETING_WORD], `hour ${h}`).toBeTruthy();
    }
  });

  it("runs late → morning → afternoon → evening → late across the day", () => {
    expect(greetingBandFor(at(2))).toBe("late");
    expect(greetingBandFor(at(5))).toBe("morning");
    expect(greetingBandFor(at(11, 59))).toBe("morning");
    expect(greetingBandFor(at(12))).toBe("afternoon");
    expect(greetingBandFor(at(16, 59))).toBe("afternoon");
    expect(greetingBandFor(at(17))).toBe("evening");
    expect(greetingBandFor(at(21, 59))).toBe("evening");
    /* 10 PM is the shift's last minute and the band turns over there. */
    expect(greetingBandFor(at(22))).toBe("late");
  });
});

describe("the name is optional and its absence is a real state", () => {
  it("stands the word alone rather than inventing a fallback", () => {
    const line = greetingFor(at(18), null);
    expect(line).toBe("Good evening");
    expect(greetingFor(at(18), "   ")).toBe("Good evening");
    expect(greetingFor(at(18), "Stephen")).toBe("Good evening, Stephen");
  });
});
