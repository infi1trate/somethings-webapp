// THE CLUSTERING GUARANTEE, ASSERTED.
//
// anno-mvp-1 shipped a fix with no test because the bug lived in a component and
// the runner is node-only. This is the answer to that: the part of R17 carrying
// the accessibility guarantee is pure geometry, so it is tested directly.
//
// The load-bearing test is `minSeparation` against the SC 2.5.8 floor, swept
// across every cluster size a review could plausibly produce. Everything else
// here protects the determinism the visual grouping depends on.

import { describe, expect, it } from "vitest";
import {
  clusterByProximity,
  fanOut,
  minSeparation,
  type Clusterable,
} from "@/lib/anno/cluster";

const at = (id: string, x: number, y: number): Clusterable => ({ id, x, y });

/** ═══ SWEPT, NOT PINNED TO ONE NUMBER ═══
 *
 *  This was `const SEP = 34`, tied to the pin's size at the time. The pin then
 *  doubled (26px disc -> 52px), `PIN_SEP` went 34 -> 60, and the assertion kept
 *  passing while its own comment had become false — a test that describes the
 *  wrong geometry is one nobody can read for the guarantee.
 *
 *  So the guarantee is asserted across a RANGE of separations that spans every
 *  plausible pin size, plus the criterion floor itself. `fanOut` takes the
 *  separation as an argument, so this is what it was always actually promising. */
const SEPARATIONS = [24, 30, 34, 44, 60, 72, 96];
const SEP = 60; // the layer's current PIN_SEP, for the shape assertions
const SC_2_5_8_FLOOR = 24;

describe("clusterByProximity", () => {
  it("leaves well-separated pins alone — one cluster each", () => {
    const out = clusterByProximity([at("a", 0, 0), at("b", 200, 0), at("c", 0, 200)], 30);
    expect(out).toHaveLength(3);
    expect(out.every((c) => c.members.length === 1)).toBe(true);
  });

  it("groups the measured failure case: two pins at the SAME point", () => {
    // anno-07 measured a 0px gap between two comments on one anchor.
    const out = clusterByProximity([at("a", 100, 100), at("b", 100, 100)], 30);
    expect(out).toHaveLength(1);
    expect(out[0].members.map((m) => m.id)).toEqual(["a", "b"]);
    expect(out[0].x).toBe(100);
    expect(out[0].y).toBe(100);
  });

  it("groups pins inside the radius and excludes one just outside it", () => {
    const out = clusterByProximity([at("a", 0, 0), at("b", 20, 0), at("c", 400, 0)], 30);
    expect(out).toHaveLength(2);
    expect(out[0].members).toHaveLength(2);
    expect(out[1].members).toHaveLength(1);
  });

  it("does not group a pair exactly beyond the radius", () => {
    // 31 > 30, so these are two clusters. The boundary is inclusive at 30.
    expect(clusterByProximity([at("a", 0, 0), at("b", 31, 0)], 30)).toHaveLength(2);
    expect(clusterByProximity([at("a", 0, 0), at("b", 30, 0)], 30)).toHaveLength(1);
  });

  it("centres a cluster on the mean of its members, not on the first one", () => {
    const out = clusterByProximity([at("a", 0, 0), at("b", 20, 20)], 40);
    expect(out[0].x).toBe(10);
    expect(out[0].y).toBe(10);
  });

  it("keys a cluster by its membership, so the key survives a re-render", () => {
    const a = clusterByProximity([at("7", 5, 5), at("3", 5, 5)], 30);
    const b = clusterByProximity([at("3", 6, 6), at("7", 4, 4)], 30);
    // Same two comments, different input order and slightly moved: same key.
    expect(a[0].key).toBe(b[0].key);
  });

  it("gives different memberships different keys", () => {
    const a = clusterByProximity([at("1", 0, 0), at("2", 0, 0)], 30);
    const b = clusterByProximity([at("1", 0, 0), at("3", 0, 0)], 30);
    expect(a[0].key).not.toBe(b[0].key);
  });

  it("is deterministic for a fixed input order", () => {
    const items = [at("a", 0, 0), at("b", 25, 0), at("c", 50, 0), at("d", 300, 0)];
    const first = clusterByProximity(items, 30);
    for (let i = 0; i < 20; i++) {
      const again = clusterByProximity(items, 30);
      expect(again.map((c) => c.key)).toEqual(first.map((c) => c.key));
      expect(again.map((c) => [c.x, c.y])).toEqual(first.map((c) => [c.x, c.y]));
    }
  });

  it("returns nothing for nothing", () => {
    expect(clusterByProximity([], 30)).toEqual([]);
  });

  it("preserves every input — no pin is ever dropped by grouping", () => {
    const items = Array.from({ length: 40 }, (_, i) =>
      at(`p${i}`, (i % 7) * 12, Math.floor(i / 7) * 12)
    );
    const out = clusterByProximity(items, 30);
    const seen = out.flatMap((c) => c.members.map((m) => m.id)).sort();
    expect(seen).toEqual(items.map((i) => i.id).sort());
  });
});

describe("fanOut — the SC 2.5.8 guarantee", () => {
  it("keeps every pair AND the centre control at least `separation` apart", () => {
    // The whole point of the module. Swept over BOTH axes — cluster size and the
    // separation asked for — so a future change to the pin's geometry cannot
    // quietly land outside what this proves.
    for (const sep of SEPARATIONS) {
      for (let n = 2; n <= 12; n++) {
        const offsets = fanOut(n, sep);
        expect(offsets, `n=${n} sep=${sep}`).toHaveLength(n);
        expect(minSeparation(offsets), `n=${n} sep=${sep}`).toBeGreaterThanOrEqual(
          sep - 0.01
        );
      }
    }
  });

  it("clears the 24px criterion floor when asked for exactly 24", () => {
    for (let n = 2; n <= 12; n++) {
      expect(minSeparation(fanOut(n, SC_2_5_8_FLOOR))).toBeGreaterThanOrEqual(
        SC_2_5_8_FLOOR - 0.01
      );
    }
  });

  it("opens wider as the cluster grows rather than crowding", () => {
    const r = (n: number) => Math.hypot(fanOut(n, SEP)[0].dx, fanOut(n, SEP)[0].dy);
    // Radius is flat while the floor dominates, then strictly grows.
    expect(r(8)).toBeGreaterThan(r(6) - 0.01);
    expect(r(12)).toBeGreaterThan(r(8));
  });

  it("puts two members opposite each other", () => {
    const [a, b] = fanOut(2, SEP);
    expect(a.dx).toBeCloseTo(0, 1);
    expect(b.dx).toBeCloseTo(0, 1);
    expect(a.dy).toBeCloseTo(-SEP, 1);
    expect(b.dy).toBeCloseTo(SEP, 1);
  });

  it("starts the ring directly above the centre, every time", () => {
    for (let n = 2; n <= 9; n++) {
      const first = fanOut(n, SEP)[0];
      expect(first.dx).toBeCloseTo(0, 1);
      expect(first.dy).toBeLessThan(0);
    }
  });

  it("is stable — the same cluster fans out identically on every call", () => {
    expect(fanOut(5, SEP)).toEqual(fanOut(5, SEP));
  });

  it("handles the degenerate sizes without inventing a ring", () => {
    expect(fanOut(0, SEP)).toEqual([]);
    expect(fanOut(1, SEP)).toEqual([{ dx: 0, dy: 0 }]);
    expect(minSeparation(fanOut(1, SEP))).toBe(Infinity);
  });
});
