// THE ROW CHIP — which kind of billing proposal a queue row stands for.
//
// The chip exists so a run of renewals can be worked as a run: a renewal, a
// change and a first presentation are three different decisions wearing one row,
// and a supervisor could not tell them apart without opening each.
//
// WHAT IS WORTH ASSERTING HERE is not that a chip renders — that is DOM, and it
// is verified in the browser — but that the row and the pane cannot disagree
// about which of the three an item is, and that the short label the row shows is
// the same noun as the long one the pane shows.

import { describe, expect, it } from "vitest";
import {
  PROPOSAL_LABEL,
  PROPOSAL_SHORT,
  proposalKindFor,
} from "@/components/record/presentation-diff";
import { tasksScenario, TASK_SCENARIOS } from "@/lib/tasks/seed";

const NOW = Date.UTC(2026, 8, 11, 12);

const openBilling = (scenario: string) =>
  tasksScenario(scenario, NOW).filter(
    (i) => i.payload.kind === "billing" && !i.resolvedAt
  );

const kindOf = (item: ReturnType<typeof openBilling>[number]) => {
  const p = item.payload as Extract<typeof item.payload, { kind: "billing" }>;
  return proposalKindFor(p.current?.code ?? null, p.recommended.code);
};

describe("the short label is the long label's noun", () => {
  it("IS the full label's first word, for all three", () => {
    /* THE POINT OF ONE SOURCE. The row shows "Renewal" and the pane shows
       "Renewal proposed"; a supervisor who opens the row must not meet a
       different word for the thing they just clicked.
       FIRST WORD, NOT `startsWith`. The prefix version of this assertion did not
       catch a mutation shortening "Renewal" to "Renew" — a prefix of the same
       word is still a prefix, and "Renew" is a different word on screen. Caught
       by mutating it, which is the only reason this line reads the way it
       does. */
    for (const kind of ["assign", "change", "renewal"] as const) {
      expect(PROPOSAL_SHORT[kind]).toBe(PROPOSAL_LABEL[kind].split(" ")[0]);
    }
  });

  it("gives each kind its own short word", () => {
    const shorts = Object.values(PROPOSAL_SHORT);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  it("keeps every short label short enough for a row", () => {
    // The row's chip sits beside an age, a coalesce count and a name that has to
    // stay readable. Not a pixel measurement — that is the browser's job — but a
    // floor under the thing that made the short map necessary at all.
    for (const s of Object.values(PROPOSAL_SHORT)) expect(s.length).toBeLessThanOrEqual(12);
  });
});

describe("the kind is decided once", () => {
  it("reads the payload's own two codes on every open billing item", () => {
    /* THE ROW USES THE PAYLOAD, NOT THE PANE'S OVERRIDE — the row describes the
       item as the queue holds it, and an uncommitted pick in the pane is not a
       fact about the queue. This checks the derivation is total: every item
       resolves to one of the three, so no row can render a chip with no word. */
    let checked = 0;
    for (const sc of TASK_SCENARIOS)
      for (const item of openBilling(sc.id)) {
        expect(["assign", "change", "renewal"]).toContain(kindOf(item));
        checked++;
      }
    // A green result over an empty set proves nothing.
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it("agrees with what the payload plainly says", () => {
    // The two ends of the derivation, spelled out against the fixture rather
    // than against itself: no current code IS a first presentation, and a
    // current code equal to the recommendation IS a renewal.
    for (const sc of TASK_SCENARIOS)
      for (const item of openBilling(sc.id)) {
        const p = item.payload as Extract<typeof item.payload, { kind: "billing" }>;
        if (!p.current) expect(kindOf(item)).toBe("assign");
        else if (p.current.code === p.recommended.code) expect(kindOf(item)).toBe("renewal");
        else expect(kindOf(item)).toBe("change");
      }
  });
});

describe("what the fixtures can actually demonstrate", () => {
  it("has all three kinds SOMEWHERE, or the chip distinguishes nothing", () => {
    const kinds = new Set(
      TASK_SCENARIOS.flatMap((sc) => openBilling(sc.id).map(kindOf))
    );
    expect([...kinds].sort()).toEqual(["assign", "change", "renewal"]);
  });

  it("but has NO renewal in either busy scenario — recorded, not asserted away", () => {
    /* ═══ THE CHIP'S STATED PURPOSE IS NOT DEMONSTRABLE AT VOLUME ═══
       A7 asks for this chip "so renewals can be batched". Measured: the two
       scenarios with a real queue — 15 and 16 open billing items — contain ZERO
       renewals, and the only renewal in the seed is the single billing item in
       `quiet-day`. So the chip is correct and the distinction is real, but a
       reviewer opening the busy board sees two kinds and no batching case.
       ASSERTED SO IT CANNOT CHANGE SILENTLY: the day someone adds renewals to a
       busy scenario, this test fails and the note above gets deleted with it.
       Not fixed here — inventing queue items to demonstrate a feature is fixture
       invention, and the teen ids are coalescing keys, which is on the brief's
       locked non-regression list. */
    for (const id of ["typical-shift", "heavy-caseload"]) {
      const kinds = openBilling(id).map(kindOf);
      expect(kinds.length).toBeGreaterThan(10);
      expect(kinds.filter((k) => k === "renewal")).toEqual([]);
    }
    expect(openBilling("quiet-day").map(kindOf)).toEqual(["renewal"]);
  });
});
