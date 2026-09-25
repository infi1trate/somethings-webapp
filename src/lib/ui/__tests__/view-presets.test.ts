// ═══════════════════════════════════════════════════════════════════════════
// THE GEOMETRY IS A CONTRACT (Refinement §4)
//
// `worklist.tsx` computes every virtualizer offset from `pitch`, and the module
// note there is explicit about the failure: a row that renders taller than the
// number puts the window one pixel out per row, and forty rows down the list the
// keyboard selects the wrong thing. Nothing throws. The list simply drifts.
//
// The DOM side of this is checked by `monitoring-states`, which asserts a rendered
// row is exactly the height its own `data-preset` declares. What a DOM check
// CANNOT see is the table being internally incoherent — a `height` larger than
// its `pitch` renders a card overlapping its neighbour, and a `detached` preset
// with no gutter renders touching panels that read as a broken grouped list.
// Those are properties of the table, so they are asserted against the table.

import { describe, expect, it } from "vitest";
import {
  LIST_MIN_ROWS,
  listMinHeight,
  ROW_GEOMETRY,
  VIEW_OPTIONS_DEFAULT,
  VIEW_PRESETS,
} from "@/lib/ui/view-options";

describe("one axis, three steps", () => {
  it("offers exactly the three §4 names, loosest to tightest", () => {
    // THE ORDER IS PART OF THE CONTRACT: the control renders in array order and
    // §4 describes an ordered dimension, so a shuffled array would present
    // three steps that do not read as steps.
    expect(VIEW_PRESETS).toEqual(["cards", "comfortable", "compact"]);
  });

  it("defaults to Comfortable, and the default is a real preset", () => {
    expect(VIEW_OPTIONS_DEFAULT.preset).toBe("comfortable");
    expect(VIEW_PRESETS).toContain(VIEW_OPTIONS_DEFAULT.preset);
  });

  it("describes every preset, so none can render an undefined row", () => {
    for (const p of VIEW_PRESETS) {
      expect(ROW_GEOMETRY[p], p).toBeDefined();
    }
    expect(Object.keys(ROW_GEOMETRY).sort()).toEqual([...VIEW_PRESETS].sort());
  });
});

describe("pitch and height cannot contradict each other", () => {
  it("never draws a card taller than the step between rows", () => {
    // height > pitch is a row overlapping the next one.
    for (const p of VIEW_PRESETS) {
      const g = ROW_GEOMETRY[p];
      expect(g.height, `${p} draws taller than its pitch`).toBeLessThanOrEqual(g.pitch);
      expect(g.height).toBeGreaterThan(0);
    }
  });

  it("gives a detached preset a gutter, and a grouped one none", () => {
    // ═══ THE TWO WAYS THIS TABLE CAN BE WRONG ═══
    // A detached preset with pitch === height draws panels that touch, which
    // reads as a grouped list whose dividers are missing. A grouped preset with
    // a gutter leaves a dead band between rows that no divider can span, so
    // §1.2's full-width divider would float in a gap.
    for (const p of VIEW_PRESETS) {
      const g = ROW_GEOMETRY[p];
      if (g.detached) {
        expect(g.pitch - g.height, `${p} is detached with no gutter`).toBeGreaterThanOrEqual(8);
      } else {
        expect(g.pitch, `${p} is grouped but carries a gutter`).toBe(g.height);
      }
    }
    // THE INPUT IS ASSERTED: a table with no detached preset would satisfy the
    // loop above and leave the `Cards` branch of the row unexercised anywhere.
    expect(VIEW_PRESETS.filter((p) => ROW_GEOMETRY[p].detached)).toEqual(["cards"]);
  });

  it("keeps every number on the 4px scale, because Bloom has no spacing scale", () => {
    // Measured and recorded in the module note: `settings-tokens.css` defines
    // four component pads and nothing general, so Tailwind's 4px step is the
    // only real scale available and an off-scale row is off ANY scale.
    for (const p of VIEW_PRESETS) {
      const g = ROW_GEOMETRY[p];
      for (const [name, v] of [
        ["pitch", g.pitch],
        ["height", g.height],
        ["disc", g.disc],
        ["padX", g.padX],
        ["lineGap", g.lineGap],
      ] as const) {
        expect(v % 2, `${p}.${name} = ${v} is not on a 2px boundary`).toBe(0);
      }
      expect(g.pitch % 4, `${p}.pitch = ${g.pitch}`).toBe(0);
    }
  });

  it("types every line at a Bloom ramp stop", () => {
    // The ramp, measured off `settings-tokens.css`. An invented pair is the
    // defect the last pass retired from these rows (11, 13 and 13.5px).
    const RAMP = new Map([
      [32, 40],
      [24, 32],
      [16, 24],
      [14, 20],
      [12, 16],
    ]);
    for (const p of VIEW_PRESETS) {
      const g = ROW_GEOMETRY[p];
      for (const [name, pair] of [
        ["primary", g.primary],
        ["secondary", g.secondary],
      ] as const) {
        expect(
          RAMP.get(pair.size),
          `${p}.${name} size ${pair.size} is not a ramp stop`
        ).toBeDefined();
        expect(
          pair.leading,
          `${p}.${name} is ${pair.size}/${pair.leading}; the ramp pairs ${pair.size} with ${RAMP.get(pair.size)}`
        ).toBe(RAMP.get(pair.size));
      }
    }
  });

  it("orders the presets by the room they take", () => {
    // "Loosest → tightest" is what the control promises by rendering them in
    // order; a table that did not descend would present three steps in an
    // order that means nothing.
    const pitches = VIEW_PRESETS.map((p) => ROW_GEOMETRY[p].pitch);
    expect(pitches).toEqual([...pitches].sort((a, b) => b - a));
    // And they are DISTINGUISHABLE — §4's whole argument for one axis over a
    // matrix is that the steps are clearly different. Two presets 4px apart
    // would be the duplicate cell it removed.
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i - 1] - pitches[i], `steps ${i - 1}→${i}`).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("the list's floor is stated in rows", () => {
  it("reserves three rows of whatever preset is showing", () => {
    expect(LIST_MIN_ROWS).toBe(3);
    for (const p of VIEW_PRESETS) {
      expect(listMinHeight(p)).toBe(ROW_GEOMETRY[p].pitch * 3);
    }
    // Tightest floor still has to read as a list rather than as a clipped box.
    expect(listMinHeight("compact")).toBeGreaterThanOrEqual(150);
  });
});
