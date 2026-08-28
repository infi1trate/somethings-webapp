// THE DIGEST TRIGGER (§7). One rule, three edges.
//
// The trigger lives in a component file because it is the digest's own rule, but
// it is pure and it decides whether a whole region appears — so it is tested here
// with the rest of the tasks logic rather than left to a click-through.

import { describe, expect, it } from "vitest";
import { SHIFT_GAP_MS, isNewShift } from "@/components/tasks/digest";

const HOUR = 60 * 60 * 1000;

describe("isNewShift", () => {
  it("is 8 hours", () => {
    expect(SHIFT_GAP_MS).toBe(8 * HOUR);
  });

  it("treats a never-opened page as a new shift", () => {
    // 0 is the store's initial value. A first-ever visit should MEET the digest,
    // not miss it — otherwise the state is unreachable in a fresh browser.
    expect(isNewShift(0, 1_000_000)).toBe(true);
  });

  it("is false inside the gap", () => {
    const now = 100 * HOUR;
    expect(isNewShift(now - 7.9 * HOUR, now)).toBe(false);
  });

  it("is false exactly at the gap", () => {
    // `>`, not `>=`: a shift is a gap of MORE than 8 hours. An eight-hour shift
    // handed straight over should not greet the next reader with a digest about
    // the shift they just worked.
    const now = 100 * HOUR;
    expect(isNewShift(now - SHIFT_GAP_MS, now)).toBe(false);
  });

  it("is true past the gap", () => {
    const now = 100 * HOUR;
    expect(isNewShift(now - SHIFT_GAP_MS - 1, now)).toBe(true);
  });

  it("is true across an overnight", () => {
    const now = 100 * HOUR;
    expect(isNewShift(now - 16 * HOUR, now)).toBe(true);
  });
});
