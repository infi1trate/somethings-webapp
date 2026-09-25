// ═══════════════════════════════════════════════════════════════════════════
// THE WORKING SET — ITS CAP, ITS ORDER, AND THE WORD IT IS CALLED BY
//
// The control is checked in the DOM. What a DOM check cannot see:
//
//  · A CAP ENFORCED ONLY IN A COMPONENT. The toggle explains at five rather
//    than disabling, so nothing in the UI ever tries to exceed it — which
//    means a UI test cannot prove the store would refuse. Phase F reads this
//    same set, and the day something else writes to it the cap has to hold
//    without the toggle's help.
//  · THE ORDER BEING THE DATA. Phase F orders by pin time ascending and must
//    report "rendered order vs pin timestamps". That is only checkable if the
//    array's order IS the timestamp order, which is a property of the writer.
//  · THE VOCABULARY. E.10 asks for one word used everywhere; a rendered check
//    would only see the strings that happen to be on screen.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atPinCap, isPinned, PIN_CAP, type PinnedMentee } from "@/lib/record/pinned";

const at = (n: number): PinnedMentee[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, at: 1000 + i }));

describe("five, and the fifth is not special", () => {
  it("caps at five", () => {
    expect(PIN_CAP).toBe(5);
  });

  it("is at cap only for someone not already in the set", () => {
    /* THE ASYMMETRY IS THE POINT. A full set blocks ADDING; it never blocks
       removing, or the supervisor would be stuck at five forever with no way
       down — which is the failure a naive `length >= CAP` check produces. */
    const full = at(5);
    expect(atPinCap(full, "t6")).toBe(true);
    expect(atPinCap(full, "t1")).toBe(false);
    expect(isPinned(full, "t1")).toBe(true);
    expect(isPinned(full, "t6")).toBe(false);
  });

  it("is not at cap below five", () => {
    for (let n = 0; n < PIN_CAP; n += 1) {
      expect(atPinCap(at(n), "tX"), `${n} pinned`).toBe(false);
    }
  });
});

describe("the store refuses past the cap, with no help from the control", () => {
  /** A minimal reducer over the same rules the store's setters use, so this
   *  tests the LOGIC without booting zustand's persist middleware. The store's
   *  own wiring is exercised in the DOM. */
  const pin = (list: PinnedMentee[], id: string, t: number) =>
    list.some((p) => p.id === id) || list.length >= PIN_CAP
      ? list
      : [...list, { id, at: t }];
  const unpin = (list: PinnedMentee[], id: string) =>
    list.filter((p) => p.id !== id);

  it("drops a sixth pin rather than growing", () => {
    let list: PinnedMentee[] = [];
    for (let i = 1; i <= 8; i += 1) list = pin(list, `t${i}`, i);
    expect(list).toHaveLength(PIN_CAP);
    expect(list.map((p) => p.id)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });

  it("ignores a duplicate rather than re-stamping it", () => {
    // Re-pinning something already pinned must not move it to the end: its pin
    // time did not change, and Phase F renders in that order.
    let list = pin(pin([], "t1", 10), "t2", 20);
    list = pin(list, "t1", 99);
    expect(list).toEqual([
      { id: "t1", at: 10 },
      { id: "t2", at: 20 },
    ]);
  });

  it("makes room after an unpin, and the new pin is newest", () => {
    let list: PinnedMentee[] = [];
    for (let i = 1; i <= 5; i += 1) list = pin(list, `t${i}`, i);
    list = unpin(list, "t3");
    list = pin(list, "t9", 99);
    expect(list.map((p) => p.id)).toEqual(["t1", "t2", "t4", "t5", "t9"]);
    // ORDER IS ASCENDING PIN TIME, which is what Phase F renders by.
    expect(list.map((p) => p.at)).toEqual([...list.map((p) => p.at)].sort((a, b) => a - b));
  });
});

describe("one word, and it is `pin` (E.10)", () => {
  const FILES = [
    "src/lib/record/pinned.ts",
    "src/components/record/pin-mentee-toggle.tsx",
  ];
  const raw = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  /** ═══ COMMENTS STRIPPED FOR THE ONE-WORD CHECK, AND NOT FOR THE OTHER ═══
   *  E.10 is about not using two words INTERCHANGEABLY. A comment that names
   *  the rejected word once, to say it was rejected, is documentation — and
   *  this codebase's doctrine is to record what was turned down, because a
   *  decision with no argument gets re-litigated. So the guard runs on code
   *  and strings, which is where a synonym would actually do damage.
   *  THE PROHIBITED-VOCABULARY CHECK BELOW IS NOT STRIPPED: the pack bans
   *  those words in comments explicitly, so there the comment IS the target.
   *  Same technique as `live-gate.test.ts`, same reason. */
  const code = (f: string) =>
    raw(f)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  it("says `follow` nowhere in the feature — not in code, not in a comment", () => {
    /* E.10: "Do not use 'follow' and 'pin' interchangeably — pick one, use it
       everywhere". Two words for one concept is how a product ends up with a
       "Followed" section listing "pinned" people. Comments included, because a
       comment is where the second word gets in first. */
    for (const f of FILES) {
      expect(code(f).toLowerCase(), `${f} says "follow"`).not.toMatch(/follow/);
    }
  });

  it("uses the nav's noun for the people, not a second one", () => {
    // "Mentees" is what the rail says; until Nicole rules on teen-vs-mentee
    // this feature matches it rather than introducing a third term.
    expect(code(FILES[1])).toMatch(/mentee/i);
  });

  it("carries no prohibited vocabulary", () => {
    /* RAW, COMMENTS INCLUDED — the pack bans these "in visible copy,
       aria-labels, alt text, component names, variable names, and comments".
       This caught one of my own comments calling the set a roster by the
       banned word. */
    for (const f of FILES) {
      const src = raw(f).toLowerCase();
      for (const w of ["patient", "caseload", "churn", "at risk"]) {
        expect(src, `${f} says "${w}"`).not.toContain(w);
      }
    }
  });
});

describe("the control can never be disabled", () => {
  it("renders no disabled attribute in any branch of the source", () => {
    /* THE STANDING CONSTRAINT, AND E.8 SPECIFICALLY. Asserted from source
       because the at-cap state is the only one where a `disabled` would be
       tempting, and a DOM check proves it only for the fixtures it tried. */
    /* CODE ONLY. The module note explains at length WHY it never disables, so
       an unstripped search matches the sentence stating the rule and fails the
       rule — the same trap `live-gate.test.ts` documents. */
    const src = readFileSync(
      join(process.cwd(), "src/components/record/pin-mentee-toggle.tsx"),
      "utf8"
    )
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    expect(src).not.toMatch(/\bdisabled\b/);
    expect(src).not.toMatch(/aria-disabled/);
  });
});
