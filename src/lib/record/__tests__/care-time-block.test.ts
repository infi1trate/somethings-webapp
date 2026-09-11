// THE RAIL'S TIME BLOCKS — the windows, and the boundary they must not cross.
//
// Rail time-block is a viewing control; clinical review windows are
// cadence-anchored and independent. The last describe block asserts exactly
// that, because it is the claim a reviewer of this feature most needs held: a
// supervisor re-scoping the rail is asking a question about the record, not
// changing the period a clinical decision is judged on.
//
// THE OTHER CLAIMS ARE ABOUT THE FIXTURE TABLE, and they exist because that
// table is hand-written. Four blocks × two scenarios of counts is exactly the
// shape where "the 7-day view reports more engaged days than the 90-day view"
// becomes possible, and no type stops it.

import { describe, expect, it } from "vitest";
import {
  CARE_TIME_BLOCKS,
  DEFAULT_CARE_BLOCK,
  blockById,
  blockRangeLine,
  blockWindowFor,
  type CareTimeBlockId,
} from "@/lib/record/care-time-block";
import { careSummaryFor } from "@/lib/record/care-summary-doc";
import { pendingReviewFor } from "@/lib/record/care-demo";
import { DEMO_TEENS } from "@/lib/record/people-demo";

const NOW = Date.UTC(2026, 8, 10, 12);
const DAY = 86_400_000;
const IDS = CARE_TIME_BLOCKS.map((b) => b.id);
/** The two scenarios the pack names as fully fixtured. */
const FULL = ["t17", "t23"] as const;

const doc = (id: string, b: CareTimeBlockId) =>
  careSummaryFor(id, NOW, undefined, b);

describe("the blocks and their windows", () => {
  it("offers exactly three, and defaults to the 7-day block", () => {
    // THE 30-DAY BLOCK WAS DROPPED on instruction, and this is the assertion
    // that makes the default's move deliberate: `DEFAULT_CARE_BLOCK` was `d30`,
    // so removing the block without choosing a successor would have left the
    // rail defaulting to an id that no longer exists.
    expect(IDS).toEqual(["recent", "d90", "all"]);
    expect(DEFAULT_CARE_BLOCK).toBe("recent");
    // And the default must BE one of the blocks — the failure the above would
    // otherwise let through, since a stale string still type-checks if it stays
    // in the union.
    expect(IDS).toContain(DEFAULT_CARE_BLOCK);
  });

  it("spells the labels out, and gives each block its own", () => {
    // THE FRAME'S COPY. "7 day" rather than "7d" — read rather than decoded.
    expect(CARE_TIME_BLOCKS.map((b) => b.label)).toEqual(["7 day", "90 day", "All"]);
  });

  it("falls back to the default, not to a position", () => {
    // `blockById` indexed `CARE_TIME_BLOCKS[1]` for an unknown id, which meant
    // dropping a block silently re-pointed the fallback from 30 days to 90.
    expect(blockById("nope" as CareTimeBlockId).id).toBe(DEFAULT_CARE_BLOCK);
  });

  it("measures trailing windows from today", () => {
    const w = blockWindowFor("t17", NOW, "d90")!;
    expect(w.toAt).toBe(NOW);
    expect(Math.round((NOW - w.fromAt) / DAY)).toBe(90);
    expect(w.clamped).toBe(false);
    expect(Math.round((NOW - blockWindowFor("t17", NOW, "recent")!.fromAt) / DAY)).toBe(7);
  });

  it("makes All the mentorship, not a large day count", () => {
    const teen = DEMO_TEENS.find((t) => t.id === "t17")!;
    const w = blockWindowFor("t17", NOW, "all")!;
    expect(Math.round((NOW - w.fromAt) / DAY)).toBe(teen.joinedDaysAgo);
  });

  it("clamps a trailing block to the join date and says it clamped", () => {
    // A 90-day block on a 1-day record is not a 90-day window. Reporting
    // "0 engaged days in 90" against a period the teen was not enrolled for
    // would be counting absence as a finding.
    const teen = DEMO_TEENS.find((t) => t.id === "t1")!;
    expect(teen.joinedDaysAgo).toBeLessThan(7);
    for (const b of ["recent", "d90"] as const) {
      const w = blockWindowFor("t1", NOW, b)!;
      expect(w.clamped, `${b} did not clamp`).toBe(true);
      expect(Math.round((NOW - w.fromAt) / DAY)).toBe(teen.joinedDaysAgo);
    }
  });
});

describe("the range line — the card's one scope declaration", () => {
  it("uses an en dash, because it is a range", () => {
    const line = blockRangeLine(blockWindowFor("t17", NOW, "d90")!, "d90");
    expect(line).toContain("–");
    expect(line).not.toContain(" - ");
  });

  it("marks the span complete only when the dates ARE the whole record", () => {
    // "· all time", NOT "· full mentorship" — shortened because the frame's
    // `Reporting Period : ` prefix made the longer suffix fold onto a second
    // line on every record that carried it. Measured; see the note on
    // `blockRangeLine`.
    expect(blockRangeLine(blockWindowFor("t17", NOW, "all")!, "all")).toContain(
      "· all time"
    );
    expect(blockRangeLine(blockWindowFor("t17", NOW, "d90")!, "d90")).not.toContain(
      "all time"
    );
    // …including a clamped trailing block, where they are.
    expect(blockRangeLine(blockWindowFor("t1", NOW, "d90")!, "d90")).toContain(
      "· all time"
    );
    // AND THE OLD STRING IS GONE, not merely unasserted: a caption carrying it
    // is the fold this replaced.
    for (const b of ["recent", "d90", "all"] as const)
      expect(blockRangeLine(blockWindowFor("t1", NOW, b)!, b)).not.toContain("mentorship");
  });

  it("prints one year, at the end", () => {
    const line = blockRangeLine(blockWindowFor("t17", NOW, "d90")!, "d90");
    expect(line.match(/2026/g)).toHaveLength(1);
    expect(line).toMatch(/, 2026$/);
  });
});

describe("the per-block data is coherent", () => {
  it("never lets a shorter block report more than a longer one", () => {
    // THE FAILURE MODE OF A HAND-WRITTEN TABLE. A 7-day view claiming more
    // engaged days than the quarter containing it is not a rendering bug a
    // reader can spot — it just quietly makes the card untrustworthy.
    for (const id of FULL) {
      const order: CareTimeBlockId[] = ["recent", "d90", "all"];
      const days = order.map((b) => doc(id, b)!.themes?.conversationDays ?? 0);
      const ex = order.map((b) => doc(id, b)!.exchanges ?? 0);
      for (let i = 1; i < order.length; i++) {
        expect(days[i], `${id}: ${order[i]} has fewer days than ${order[i - 1]}`)
          .toBeGreaterThanOrEqual(days[i - 1]);
        expect(ex[i], `${id}: ${order[i]} has fewer exchanges than ${order[i - 1]}`)
          .toBeGreaterThanOrEqual(ex[i - 1]);
      }
    }
  });

  it("keeps every chip count inside its own block's engaged days", () => {
    // The denominator IS the block's engaged days, so a count above it would
    // render "11/9" — a theme on more days than the record was engaged.
    for (const id of FULL)
      for (const b of IDS) {
        const d = doc(id, b)!;
        if (!d.themes) continue;
        for (const t of d.themes.themes)
          expect(t.days, `${id}/${b}: ${t.tagId} is ${t.days}/${d.themes.conversationDays}`)
            .toBeLessThanOrEqual(d.themes.conversationDays);
      }
  });

  it("drops chips that do not occur in the block", () => {
    // The pack's demonstrable-change requirement: the rich record's chip SET
    // must differ across blocks, not just its numbers.
    const recent = doc("t17", "recent")!.themes!.themes.map((t) => t.tagId);
    const all = doc("t17", "all")!.themes!.themes.map((t) => t.tagId);
    expect(recent.length).toBeLessThan(all.length);
    for (const gone of ["school-avoidance", "family-member-illness", "divorce-separation"])
      expect(recent, `${gone} should not be in the last 7 days`).not.toContain(gone);
  });

  it("gives every block its own summary, and never another block's", () => {
    for (const id of FULL) {
      const texts = IDS.map((b) => doc(id, b)!.conversationSummary);
      for (const t of texts) expect(t, `${id} has a block with no summary`).toBeTruthy();
      expect(new Set(texts).size, `${id} repeats a summary across blocks`).toBe(IDS.length);
    }
  });

  it("degrades to an empty state rather than borrowing another block's text", () => {
    // THE STALE-TEXT FAILURE MODE. A record with no per-block entry must show
    // the empty state, not the unwindowed fixture — otherwise a 7-day view
    // renders an all-time summary under a line reading "Sep 3 – Sep 10".
    const other = DEMO_TEENS.map((t) => t.id).filter(
      (id) => !FULL.includes(id as (typeof FULL)[number])
    );
    let checked = 0;
    for (const id of other)
      for (const b of IDS) {
        const d = doc(id, b);
        if (!d) continue;
        expect(d.conversationSummary, `${id}/${b} borrowed a summary`).toBeNull();
        expect(d.themes, `${id}/${b} borrowed chips`).toBeNull();
        checked++;
      }
    expect(checked).toBeGreaterThan(40);
  });

  it("shows a summary ONLY for a record with a per-block entry", () => {
    /* ═══ THE INVARIANT, AND AN HONEST NOTE ON ITS LIMIT ═══
       Mutating the summary lookup to fall back on the unwindowed fixture passed
       all sixteen of these tests, and it was not a gap in the assertions — it
       is unreachable. The summary is gated on `contactDays`, which comes from
       the THEMES, and a record with no per-block themes has `contactDays: 0`,
       so the summary is null whatever the fallback says. The borrow can only
       fire for a record with per-block chips and no per-block prose, and no
       such record exists.
       So this asserts the implication that IS checkable — a summary implies an
       entry — and the branch stays dead by construction rather than by a test.
       Named rather than papered over: five of six mutations were caught, and
       the sixth could not be. */
    for (const teen of DEMO_TEENS)
      for (const b of IDS) {
        const d = doc(teen.id, b);
        if (!d?.conversationSummary) continue;
        expect(
          FULL.includes(teen.id as (typeof FULL)[number]),
          `${teen.id}/${b} has a summary but no per-block entry`
        ).toBe(true);
      }
  });

  it("relaxes the contact floor for the 7-day block only", () => {
    // 3 engaged days is "almost no conversation" over a cadence cycle and real
    // engagement over a week. t23's Recent has 2 of 7 and must not be gated.
    const recent = doc("t23", "recent")!;
    expect(recent.themes?.conversationDays).toBe(2);
    expect(recent.themes).not.toBeNull();
    expect(recent.conversationSummary).toBeTruthy();
  });
});

describe("the boundary — nothing clinical moves with the block", () => {
  it("leaves the review identical whatever the rail is showing", () => {
    // `pendingReviewFor` takes no block, so this is a structural fact; the test
    // exists because the structure is what a future change would break first.
    for (const id of [...FULL, "t19", "t13"]) {
      const base = JSON.stringify(pendingReviewFor(id, NOW, undefined));
      for (const b of IDS) {
        doc(id, b); // re-derive the rail
        expect(
          JSON.stringify(pendingReviewFor(id, NOW, undefined)),
          `${id}: the review moved when the rail was set to ${b}`
        ).toBe(base);
      }
    }
  });

  it("keeps the cadence window when no block is passed", () => {
    // The committed summary's window is the period its decision rested on.
    // `commitFor` never passes a block, and this is what makes that safe.
    const cadence = careSummaryFor("t17", NOW, undefined)!;
    const scoped = doc("t17", "recent")!;
    expect(cadence.window.fromAt).not.toBe(scoped.window.fromAt);
    expect(cadence.exchanges).toBeNull();
  });

  it("answers firstCycle from the record, not from the block", () => {
    // "There is no prior code to be relative to" is a fact about history. A
    // 7-day block on a record with three code changes is not a first cycle.
    const cadence = careSummaryFor("t17", NOW, undefined)!;
    for (const b of IDS)
      expect(doc("t17", b)!.window.firstCycle).toBe(cadence.window.firstCycle);
  });
});
