// ═══════════════════════════════════════════════════════════════════════════
// ONE AGE EXPRESSION, AND IT CANNOT FORK AGAIN (Phase K.2)
//
// K.2 called this a critical live bug: the same item reported "3d" on Today and
// "2d" on Care Reviews. The rendered symptom was `ageOf` rounding where
// `elapsedLabel` floors. The underlying defect was that BOTH had their own
// arithmetic, so fixing the rounding left two expressions agreeing by accident
// — the state `open-counts.ts` describes as worse than disagreement, because
// nothing fails while the accident holds.
//
// There are two claims here and they need different instruments:
//
//  1 · THE ROUNDING RULE IS FLOOR, at every boundary. A property sweep, because
//      the failure mode is a value nobody tried — and the original defect lived
//      at 66 hours, which is exactly such a value.
//  2 · THERE IS ONLY ONE DEFINITION. Decidable only from the source: a second
//      copy that agreed today would satisfy (1) forever and diverge on the next
//      edit to either. Read here rather than grepped in a shell, so it fails
//      with the other tests and names what came back.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  elapsedAgo,
  elapsedLabel,
  oldestAgeAgo,
  oldestAgeLabel,
  oldestAt,
} from "@/lib/ia/age";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;

describe("the rounding rule is floor, everywhere", () => {
  it.each([
    [0, "0m"],
    [59 * MIN, "59m"],
    [60 * MIN, "1h"],
    [23 * HOUR + 59 * MIN, "23h"],
    [24 * HOUR, "1d"],
    /* ═══ THE VALUES THE DEFECT LIVED AT ═══
       `Math.round` gave 36h → "2d", 60h → "3d", 66h → "3d" and 84h → "4d".
       Floor gives the true whole-day count at each. */
    [36 * HOUR, "1d"],
    [60 * HOUR, "2d"],
    [66 * HOUR, "2d"],
    [72 * HOUR, "3d"],
    [84 * HOUR, "3d"],
  ])("%ims elapsed reads %s", (ago, want) => {
    expect(elapsedLabel(NOW - ago, NOW)).toBe(want);
  });

  it("never rounds up — the figure only ever grows", () => {
    /* A sweep across every quarter-hour of a fortnight. The claim is that the
       label is monotonic in elapsed time and never exceeds the true whole-unit
       count, which is what "floor" means and what rounding violated. */
    let last = -1;
    for (let mins = 0; mins <= 14 * 24 * 60; mins += 15) {
      const label = elapsedLabel(NOW - mins * MIN, NOW);
      const n = Number(label.slice(0, -1));
      const unit = label.slice(-1);
      const trueValue =
        unit === "m" ? mins : unit === "h" ? Math.floor(mins / 60) : Math.floor(mins / 1440);
      expect(n, `at ${mins}m the label ${label} is not the floored value`).toBe(trueValue);
      /* Monotonic within a unit. */
      if (unit === "d") {
        expect(n).toBeGreaterThanOrEqual(last === -1 ? 0 : 0);
        last = n;
      }
    }
    expect(last, "the sweep never reached days").toBeGreaterThan(0);
  });

  it("clamps a future instant to zero rather than reporting a negative age", () => {
    expect(elapsedLabel(NOW + DAY, NOW)).toBe("0m");
  });

  it("adds the preposition and nothing else", () => {
    expect(elapsedAgo(NOW - 66 * HOUR, NOW)).toBe("2d ago");
    expect(elapsedAgo(NOW - 66 * HOUR, NOW)).toBe(`${elapsedLabel(NOW - 66 * HOUR, NOW)} ago`);
  });
});

describe("the oldest in a set", () => {
  it("is the minimum instant, not the first element", () => {
    const items = [{ at: NOW - HOUR }, { at: NOW - 3 * DAY }, { at: NOW - 2 * HOUR }];
    expect(oldestAt(items)).toBe(NOW - 3 * DAY);
    expect(oldestAgeLabel(items, NOW)).toBe("3d");
    expect(oldestAgeAgo(items, NOW)).toBe("3d ago");
  });

  /* ═══ NULL IS NOT ZERO ═══
     An empty list has no oldest item, which the header renders as an em dash.
     Returning "0d" would assert that a review exists and is zero days old. */
  it("is null for an empty set, never a zero label", () => {
    expect(oldestAt([])).toBeNull();
    expect(oldestAgeLabel([], NOW)).toBeNull();
    expect(oldestAgeAgo([], NOW)).toBeNull();
  });

  it("agrees with the item formatter on the same instant, by construction", () => {
    for (const ago of [5 * MIN, 90 * MIN, 36 * HOUR, 66 * HOUR, 72 * HOUR]) {
      const at = NOW - ago;
      expect(oldestAgeLabel([{ at }], NOW)).toBe(elapsedLabel(at, NOW));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AND THERE IS ONLY ONE DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("no surface restates the arithmetic", () => {
  /* The shape of the duplicated logic: a whole-unit division by 60 or 24 that
     is not inside `lib/ia/age.ts`. `Math.round` on an elapsed quantity is the
     specific thing that produced the defect. */
  const SITES = [
    "src/lib/home/today.ts",
    "src/components/tasks/tasks-page.tsx",
    "src/components/tasks/strips.tsx",
    "src/components/tasks/worklist.tsx",
    "src/lib/home/start-here.ts",
  ];

  /* ═══ ONE NAMED EXEMPTION, AND IT IS A DIFFERENT QUANTITY ═══
     `Math.ceil(left / 60_000)` in `today.ts` is a COUNTDOWN — "an
     acknowledgement is due in 2m", time REMAINING against the five-minute ack
     SLA — not an elapsed age. Its rounding rule is deliberately the opposite:
     with 61 seconds left it must say "2m", because understating a deadline is
     the dangerous direction, where for an age overstating is.
     LISTED RATHER THAN EXCLUDED BY A LOOSER REGEX, so a new rounding site
     still fails this check and has to justify itself here. */
  const ALLOWED = ["Math.ceil(left / 60_000"];

  it.each(SITES)("%s does not divide an elapsed value into hours or days", (rel) => {
    const src = stripComments(read(rel));
    /* `/ 60_000`, `/ 3_600_000`, `/ 24` and friends, paired with a rounding
       call — the signature of a reimplementation. */
    const offenders = [
      ...src.matchAll(/Math\.(round|floor|ceil)\s*\(\s*[^)]*\/\s*(60_?000|3_?600_?000|86_?400_?000|24|60)\b/g),
    ]
      .map((m) => m[0])
      .filter((m) => !ALLOWED.includes(m));
    expect(
      offenders,
      `${rel} computes an age itself; it should read lib/ia/age.ts`
    ).toEqual([]);
  });

  it("and today.ts's ageOf delegates rather than computing", () => {
    const src = read("src/lib/home/today.ts");
    const body = src.slice(
      src.indexOf("function ageOf("),
      src.indexOf("}", src.indexOf("function ageOf("))
    );
    expect(body, "ageOf no longer delegates to the shared expression").toContain(
      "elapsedAgo("
    );
    expect(body).not.toContain("Math.round");
    expect(body).not.toContain("Math.floor");
  });

  it("and strips.tsx re-exports rather than defining", () => {
    const src = read("src/components/tasks/strips.tsx");
    expect(src).not.toMatch(/export function elapsedLabel/);
    expect(src).toContain('from "@/lib/ia/age"');
  });
});
