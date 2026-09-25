// ═══════════════════════════════════════════════════════════════════════════
// THE SCHEDULE'S SHAPE, AND THE THINGS THE RENDERER CANNOT BE TRUSTED WITH
//
// The rendered states are checked in the DOM. What a DOM check cannot see is
// the DATA being wrong in a way that renders plausibly: overlapping blocks
// would put two rows in the "now" state and look like a styling bug; an
// obligation smuggled into `blocks[]` would dim at 10 PM and look correct until
// somebody read it at 9:59. Those are properties of the table, so they are
// asserted against the table.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clockLabel,
  FRIDAY,
  obligationActive,
  positionOf,
  scheduleNowFor,
  scheduleStateFor,
  variantForWeekday,
  WEEKDAY,
  type ScheduleVariant,
} from "@/lib/home/schedule";

const VARIANTS: ScheduleVariant[] = [WEEKDAY, FRIDAY];
const at = (iso: string) => scheduleNowFor(new Date(iso).getTime());

describe("two parts, and the obligation is not one of the blocks", () => {
  it("keeps the standing obligation out of the block sequence", () => {
    /* ═══ THE STRUCTURAL CLAIM THE WHOLE MODULE RESTS ON ═══
       If the oversight row were a block it would overlap four others, so two
       rows would be "now" at once and dim-the-past would grey out something
       still running. Asserted by NAME, because the failure mode is somebody
       adding it back as a seventh row where it looks like it belongs. */
    for (const v of VARIANTS) {
      for (const b of v.blocks) {
        expect(
          b.labels.join(" "),
          `${v.id}: the standing obligation is in blocks[]`
        ).not.toMatch(/Oversight/i);
      }
      expect(v.obligation.label).toMatch(/Oversight/i);
    }
  });

  const overlapping = (v: ScheduleVariant) =>
    v.blocks.filter((b) => b.start < v.obligation.end && b.end > v.obligation.start);

  it("overlaps real blocks on the weekday variant, which is why it is not one", () => {
    // The reason it cannot be a block, asserted rather than assumed: if it
    // stopped overlapping, the two-part split would be unnecessary and this
    // test should be the thing that says so.
    expect(overlapping(WEEKDAY).length).toBeGreaterThan(0);
  });

  it("overlaps nothing on Friday, and that is the truncation showing", () => {
    /* ═══ THIS ASSERTS A GAP IN THE SOURCE, ON PURPOSE ═══
       The reference mock's Friday column is CUT OFF after 3:30–4:00 PM while
       the shift runs to 7, so Friday's blocks stop at 4 and the obligation
       (5–7) overlaps none of them. That is a fact about the source table, not
       about the model — and the model records it as `truncatedAfter`.
       IT FAILS THE DAY FRIDAY IS AUTHORED IN FULL, which is the point: at that
       moment the obligation should overlap something, `truncatedAfter` should
       become null, and the `unspecified` state should stop being reachable.
       This is the test that will say so. */
    expect(
      FRIDAY.truncatedAfter,
      "Friday is no longer truncated — re-check its obligation window, which was DERIVED"
    ).not.toBeNull();
    expect(overlapping(FRIDAY)).toHaveLength(0);
    expect(FRIDAY.blocks[FRIDAY.blocks.length - 1].end).toBe(FRIDAY.truncatedAfter);
    // And the shift genuinely extends past where the table stops.
    expect(FRIDAY.shift.end).toBeGreaterThan(FRIDAY.truncatedAfter!);
  });

  it("never marks the obligation as `now` — it has no position at all", () => {
    // `positionOf` takes a block. There is no call that could give the
    // obligation one, and this pins that the obligation's API is only
    // "is it active", which carries no past/now/later.
    expect(obligationActive(WEEKDAY, 17 * 60 + 30)).toBe(true);
    expect(obligationActive(WEEKDAY, 13 * 60)).toBe(false);
  });
});

describe("the block sequence is a sequence", () => {
  it("is ordered and non-overlapping in both variants", () => {
    for (const v of VARIANTS) {
      for (let i = 1; i < v.blocks.length; i += 1) {
        expect(
          v.blocks[i].start,
          `${v.id}: block ${i} starts before block ${i - 1} ends`
        ).toBeGreaterThanOrEqual(v.blocks[i - 1].end);
      }
      for (const b of v.blocks) expect(b.end, v.id).toBeGreaterThan(b.start);
    }
  });

  it("puts at most one block in the `now` position, at every minute of the day", () => {
    /* EVERY MINUTE, not a sample. Two "now" blocks is the defect overlapping
       data would produce, and it would only appear in the minutes where the
       overlap lives. */
    for (const v of VARIANTS) {
      for (let m = 0; m < 24 * 60; m += 1) {
        const nows = v.blocks.filter((b) => positionOf(b, m) === "now");
        expect(nows.length, `${v.id} at ${clockLabel(m)}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("stays inside its own shift window", () => {
    for (const v of VARIANTS) {
      for (const b of v.blocks) {
        expect(b.start, `${v.id}`).toBeGreaterThanOrEqual(v.shift.start);
        expect(b.end, `${v.id}`).toBeLessThanOrEqual(v.shift.end);
      }
    }
  });
});

describe("the four states, at fixture times in the schedule's own zone", () => {
  const cases: [string, string, string][] = [
    ["Wed 1:30 PM", "2026-09-23T17:30:00Z", "in-block"],
    ["Wed 4:45 PM", "2026-09-23T20:45:00Z", "in-block"],
    /* THE FOUR-HOUR GAP. Nothing sequential runs between 5:30 and 9:30; the
       obligation is the schedule, and the state says so. */
    ["Wed 7:00 PM", "2026-09-23T23:00:00Z", "obligation-only"],
    ["Wed 9:40 PM", "2026-09-24T01:40:00Z", "in-block"],
    ["Wed 11:30 PM", "2026-09-24T03:30:00Z", "out-of-shift"],
    ["Fri 2:30 PM", "2026-09-25T18:30:00Z", "in-block"],
    /* THE SOURCE TABLE IS TRUNCATED after 4 PM and Friday runs to 7. */
    ["Fri 5:30 PM", "2026-09-25T21:30:00Z", "unspecified"],
    ["Sat 3:00 PM", "2026-09-26T19:00:00Z", "out-of-shift"],
    ["Sun 8:00 PM", "2026-09-27T00:00:00Z", "out-of-shift"],
  ];

  for (const [label, iso, kind] of cases) {
    it(`${label} → ${kind}`, () => {
      expect(scheduleStateFor(at(iso)).kind).toBe(kind);
    });
  }

  it("names a real next shift whenever it is out of one", () => {
    for (const [, iso, kind] of cases) {
      if (kind !== "out-of-shift") continue;
      const st = scheduleStateFor(at(iso));
      if (st.kind !== "out-of-shift") throw new Error("unreachable");
      expect(VARIANTS).toContain(st.next);
    }
  });

  it("reads the zone explicitly, so a device elsewhere sees the same schedule", () => {
    // Same instant, and the wall clock is Eastern regardless of where this
    // runs. 17:30Z is 1:30 PM in New York in September.
    expect(at("2026-09-23T17:30:00Z").minutes).toBe(13 * 60 + 30);
    // And the abbreviation is COMPUTED, so it is right on both sides of DST.
    expect(at("2026-09-23T17:30:00Z").zoneAbbrev).toBe("EDT");
    expect(at("2026-01-14T18:30:00Z").zoneAbbrev).toBe("EST");
  });

  it("has a variant for every weekday the shift runs, and none for the weekend", () => {
    expect([1, 2, 3, 4].map(variantForWeekday)).toEqual([WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY]);
    expect(variantForWeekday(5)).toBe(FRIDAY);
    expect(variantForWeekday(6)).toBeNull();
    expect(variantForWeekday(0)).toBeNull();
  });
});

describe("one CTA mapping, and the rest are deliberately absent", () => {
  it("maps exactly the block that has a destination holding exactly that work", () => {
    /* SIX OF SEVEN ARE NULL and that is the finding, not an omission — see
       `BLOCK_DESTINATIONS`. The trap is "Mentor Performance Escalations",
       which reads like the Escalations destination and is a different thing:
       that destination holds TEEN safety escalations, and the mentor-practice
       surface was removed. */
    const mapped = WEEKDAY.blocks.filter((b) => b.destination != null);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].destination).toBe("care-reviews");
    expect(mapped[0].labels[0]).toMatch(/Billing Compliance/);

    const mentorBlock = WEEKDAY.blocks.find((b) =>
      b.labels.some((l) => /Mentor Performance Escalations/.test(l))
    );
    expect(mentorBlock, "the trap block is missing from the fixture").toBeDefined();
    expect(
      mentorBlock!.destination,
      "Mentor Performance Escalations was pointed at a destination"
    ).toBeNull();
  });
});

describe("it is a reference, not a tracker", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/today/suggested-schedule.tsx"),
    "utf8"
  )
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  it("renders no completion, adherence or progress affordance", () => {
    for (const banned of [
      "checkbox",
      "progressbar",
      "<progress",
      "complete",
      "behind",
      "%",
    ]) {
      expect(src.toLowerCase(), `the module renders "${banned}"`).not.toContain(banned);
    }
  });

  it("does not use the de-emphasis token that fails AA", () => {
    /* `--text-tertiary` is 2.82:1 on the card and the token file flags it
       "⚠ FAILS AA. Decorative". D.3 sets a 4.5:1 floor on dimmed past-block
       text, so it is `--text-muted` (5.30:1 light, 4.71:1 dark) — measured in
       the DOM, pinned here against the easy substitution. */
    expect(src).not.toContain("--text-tertiary");
    expect(src).toContain("--text-muted");
  });

  it("localises to no device timezone", () => {
    // D.6: the zone is the schedule's, whoever is reading. A bare
    // `toLocaleTimeString` would silently be the device's.
    expect(src).not.toMatch(/toLocale(Time|Date)String/);
  });
});
