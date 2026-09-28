// ═══════════════════════════════════════════════════════════════════════════
// THE PINNED CLOCK LANDS WHERE IT SAYS (Phase J.1, J.4)
//
// The pack warns about exactly the bug this file exists to prevent: the
// reference Figma labels "Monday October 11, 2026", which is a Sunday. A
// fixture whose anchor is off by a day produces the wrong schedule variant, and
// the UI would render it without complaint because a timestamp is always a
// valid timestamp.
//
// So nothing here trusts the anchor. Every position is read back through
// `Intl` in `SCHEDULE_TZ` and checked against the weekday and wall time its
// label claims — the label is the assertion, and a label that lies fails.

import { describe, expect, it } from "vitest";
import {
  DEV_CLOCK_POSITIONS,
  devClockAt,
  devClockByKey,
} from "@/lib/home/dev-clock";
import {
  SCHEDULE_TZ,
  scheduleNowFor,
  scheduleStateFor,
  variantForWeekday,
} from "@/lib/home/schedule";

/* `scheduleStateFor` takes a `ScheduleNow` — the WALL CLOCK in the schedule's
   zone — not an instant, and block bounds are minutes-from-midnight rather
   than timestamps. Converting here is the point of `scheduleNowFor` being
   pure given `now`: the pinned instant goes in, the zone's wall clock comes
   out, and nothing in the schedule has to know about the harness. */
const whenAt = (key: string) => scheduleNowFor(devClockAt(key)!);

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function inZone(at: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TZ,
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

describe("the anchor week is what it claims", () => {
  it("anchors on a real Monday, in the schedule's own timezone", () => {
    const mon = devClockAt("mon-block");
    expect(mon).not.toBeNull();
    expect(inZone(mon!).weekday).toBe("Monday");
  });

  it("has no DST boundary inside it, which the offset correction assumes", () => {
    /* `instantAt` corrects the zone offset once, which is only valid if the
       offset is constant across the anchor week. Checked rather than assumed. */
    const offsets = new Set<number>();
    for (let d = 0; d < 7; d++) {
      for (const hour of [0, 12, 23]) {
        const at = Date.UTC(2026, 8, 28) + d * 86_400_000 + hour * 3_600_000;
        const seen = inZone(at).hour;
        offsets.add(((seen - hour + 24) % 24));
      }
    }
    expect(offsets.size, `the anchor week spans more than one UTC offset: ${[...offsets]}`).toBe(1);
  });
});

describe("every position lands on the weekday and time its label claims", () => {
  it.each(DEV_CLOCK_POSITIONS.map((p) => [p.key, p.label, p.at] as const))(
    "%s",
    (key, label, at) => {
      const seen = inZone(at);
      /* The label's own prefix is the claim: "Mon 6:00 PM — …". */
      const wantDay = label.slice(0, 3);
      expect(
        WEEKDAY.find((w) => w.startsWith(wantDay)),
        `${key}: label names a day this test does not know: ${label}`
      ).toBeTruthy();
      expect(seen.weekday, `${key} (${label})`).toBe(
        WEEKDAY.find((w) => w.startsWith(wantDay))
      );
      const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/.exec(label);
      expect(m, `${key}: label states no wall time: ${label}`).toBeTruthy();
      const wantHour =
        (Number(m![1]) % 12) + (m![3] === "PM" ? 12 : 0);
      expect(seen.hour, `${key} (${label}) hour`).toBe(wantHour);
      expect(seen.minute, `${key} (${label}) minute`).toBe(Number(m![2]));
    }
  );

  it("has a unique key per position and resolves each one", () => {
    const keys = DEV_CLOCK_POSITIONS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(devClockByKey(k)?.key).toBe(k);
    expect(devClockByKey(null)).toBeNull();
    expect(devClockByKey("nope")).toBeNull();
    expect(devClockAt(null)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AND THE POSITIONS REACH THE STATES J.4 SAYS THEY DO
//
// A position landing on the right wall time is necessary and not sufficient —
// what J.4 actually promises is a SCHEDULE STATE. These assert the state, so a
// change to the authored schedule that moved a block out from under
// `mon-overlap` would fail here rather than quietly making the highest-value
// fixture in the pack demonstrate nothing.
// ═══════════════════════════════════════════════════════════════════════════

describe("the positions reach the schedule states they serve", () => {
  it("mon-block is inside a sequential block on the weekday variant", () => {
    const state = scheduleStateFor(whenAt("mon-block"));
    expect(state.kind).toBe("in-block");
  });

  it("fri-block selects the Friday variant, which is a different sequence", () => {
    const when = whenAt("fri-block");
    const state = scheduleStateFor(when);
    const friday = variantForWeekday(5);
    const weekday = variantForWeekday(1);
    expect(friday).not.toBeNull();
    expect(weekday).not.toBeNull();
    /* The two variants are genuinely different sequences — otherwise "the
       Friday variant" would be an untested distinction. */
    expect(friday!.blocks.map((b) => b.labels.join(" / "))).not.toEqual(
      weekday!.blocks.map((b) => b.labels.join(" / "))
    );
    expect(state.kind === "out-of-shift" ? state.variant : state.variant).toBe(friday);
  });

  it("pre-shift and post-shift are both out of shift", () => {
    expect(scheduleStateFor(whenAt("pre-shift")).kind).toBe("out-of-shift");
    expect(scheduleStateFor(whenAt("post-shift")).kind).toBe("out-of-shift");
  });

  /* ═══ THE ONE J.4 CALLS THE HIGHEST-VALUE FIXTURE ═══
     A sequential block AND the standing obligation, both running. It is the
     only state that demonstrates why the module is two parts, and Friday
     cannot produce it. */
  it("mon-overlap has a block AND the obligation running at once", () => {
    const when = whenAt("mon-overlap");
    const state = scheduleStateFor(when);
    /* `in-block` is the state itself, and it is the first half of the claim:
       a sequential block is running. */
    expect(state.kind, "mon-overlap is not inside any sequential block").toBe("in-block");
    const variant = state.variant;
    expect(variant).not.toBeNull();

    const block = variant!.blocks.find(
      (b) => when.minutes >= b.start && when.minutes < b.end
    );
    expect(block, "mon-overlap is not inside any sequential block").toBeTruthy();

    const ob = variant!.obligation;
    expect(
      when.minutes >= ob.start && when.minutes < ob.end,
      `mon-overlap (${when.minutes} min) is outside the obligation window ${ob.start}-${ob.end}`
    ).toBe(true);
  });

  it("mon-obligation-only has the obligation running with no block", () => {
    const state = scheduleStateFor(whenAt("mon-obligation-only"));
    expect(state.kind).toBe("obligation-only");
  });

  it("and Friday genuinely cannot produce that overlap, which is why Monday is used", () => {
    const friday = variantForWeekday(5)!;
    const ob = friday.obligation;
    const overlapping = friday.blocks.filter((b) => b.start < ob.end && b.end > ob.start);
    /* On Friday the obligation follows the sequence rather than containing it.
       If this ever becomes non-empty the Friday variant would ALSO exercise the
       split, and `mon-overlap`'s "only Monday can do this" note is stale. */
    expect(
      overlapping.map((b) => b.labels.join(" / ")),
      "Friday now overlaps its obligation — update the note on mon-overlap"
    ).toEqual([]);
  });
});
