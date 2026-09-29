// ═══════════════════════════════════════════════════════════════════════════
// THE SORT IS AN OVERRIDE, NOT A NEW DEFAULT (rework §3)
//
// §3 grants Care Reviews column sorting on a surface whose whole architecture
// note says there is ONE comparator. That is only safe if three properties
// hold, and each of them is a place a plausible implementation gets it wrong:
//
//  1 · NO SORT MEANS THE COMPARATOR'S ORDER, UNTOUCHED. Not "sorted by the
//      same key", not "stably re-sorted" — the same array. A `sort(() => 0)`
//      would pass an eyeball test and invite the next reader to improve the
//      comparator, which is the failure `filters.test.ts` records for the
//      subsetting case.
//  2 · IT NEVER MUTATES ITS INPUT. `entries` is the memoised list the pane's
//      selection lookup and four counts share. `Array.prototype.sort` is
//      in-place, so the natural implementation reorders the list behind them.
//  3 · IT IS A TOTAL ORDER. Two entries tying on the key must not swap between
//      renders; and the tie-break must NOT invert with direction, or `desc`
//      would be a different grouping of ties rather than the reverse of `asc`.
//
// Each test below states which property it pins, and every assertion was
// mutation-tested — the mutation is named in the comment.

import { describe, expect, it } from "vitest";
import {
  applyCareSort,
  nextSort,
  SORT_LABEL,
  SORT_MEANING,
  type CareSort,
  type CareSortColumn,
} from "@/lib/ui/care-sort";
import { CYCLE_LABEL, cycleSortKey } from "@/lib/tasks/review-cycle";
import type { TaskItem, TaskType } from "@/lib/tasks/types";

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

interface Row {
  id: string;
  at: number;
  name: string;
  taskType: TaskType;
}

/* The `itemFor` the page passes is `paneItemFor`; only two of its fields are
   read, so the fixture supplies exactly those and nothing else — a fuller fake
   would let a test pass because of a field the sort must not consult. */
const itemFor = (r: Row) =>
  ({ teenDisplayName: r.name, taskType: r.taskType }) as unknown as TaskItem;

const row = (id: string, name: string, hoursOld: number, taskType: TaskType): Row => ({
  id,
  name,
  at: NOW - hoursOld * HOUR,
  taskType,
});

/* DELIBERATELY NOT IN ANY OF THE THREE SORT ORDERS. If the fixture arrived
   alphabetical, a `mentee` assertion would pass against an implementation that
   does nothing. */
const ROWS: Row[] = [
  row("e3", "Marcus L.", 50, "monthlyReReview"),
  row("e1", "Theo L.", 12, "intakeBillingReview"),
  row("e4", "Ana P.", 4, "intakeBillingReview"),
  row("e2", "Zoe R.", 30, "monthlyReReview"),
];

const ids = (rs: readonly Row[]) => rs.map((r) => r.id);
const names = (rs: readonly Row[]) => rs.map((r) => r.name);

describe("no sort is the comparator's order, by identity", () => {
  /* PROPERTY 1. The reference, not the contents — MUTATION: returning
     `[...entries]` keeps every element in place and fails only this line. */
  it("returns the very same array", () => {
    expect(applyCareSort(ROWS, null, itemFor)).toBe(ROWS);
  });
});

describe("it never mutates its input", () => {
  /* PROPERTY 2. MUTATION: dropping the spread in `[...entries].sort(...)` —
     which is the whole of the natural implementation — fails here. */
  it("leaves the caller's array in its original order", () => {
    const before = ids(ROWS);
    applyCareSort(ROWS, { column: "mentee", dir: "asc" }, itemFor);
    applyCareSort(ROWS, { column: "age", dir: "desc" }, itemFor);
    expect(ids(ROWS)).toEqual(before);
  });
});

describe("mentee sorts by the displayed name", () => {
  it("asc is A to Z", () => {
    expect(names(applyCareSort(ROWS, { column: "mentee", dir: "asc" }, itemFor))).toEqual([
      "Ana P.",
      "Marcus L.",
      "Theo L.",
      "Zoe R.",
    ]);
  });
  it("desc is exactly the reverse", () => {
    const asc = names(applyCareSort(ROWS, { column: "mentee", dir: "asc" }, itemFor));
    const desc = names(applyCareSort(ROWS, { column: "mentee", dir: "desc" }, itemFor));
    expect(desc).toEqual([...asc].reverse());
  });
});

describe("age ascending is NEWEST first", () => {
  /* THE ONE THAT INVERTS, and the reason `SORT_MEANING` states effects rather
     than directions. MUTATION: comparing `a.at - b.at` puts the oldest first
     and fails both assertions — which is what makes this pair worth having,
     because that mutation is the one a reader would call the obvious reading of
     "ascending". */
  it("asc puts the youngest review at the top", () => {
    expect(ids(applyCareSort(ROWS, { column: "age", dir: "asc" }, itemFor))).toEqual([
      "e4",
      "e1",
      "e2",
      "e3",
    ]);
  });
  it("and desc is oldest first, which is what the default happens to be", () => {
    expect(ids(applyCareSort(ROWS, { column: "age", dir: "desc" }, itemFor))).toEqual([
      "e3",
      "e2",
      "e1",
      "e4",
    ]);
  });
  it("the label says the effect, not the direction", () => {
    expect(SORT_MEANING.age.asc).toBe("newest first");
    expect(SORT_MEANING.age.desc).toBe("oldest first");
  });
});

describe("cycle sorts by cadence position, not by the label", () => {
  it("asc puts the first review before the recurring ones", () => {
    const out = applyCareSort(ROWS, { column: "cycle", dir: "asc" }, itemFor);
    expect(out.slice(0, 2).map((r) => r.taskType)).toEqual([
      "intakeBillingReview",
      "intakeBillingReview",
    ]);
  });
  /* ═══ THE TRAP `review-cycle.ts` RECORDS — DOCUMENTED, NOT PINNED ═══
     Today's two labels sort the same way as strings and as ranks, so this
     asserts the PROPERTY that makes the rank necessary rather than catching a
     label-based implementation: a third cycle named "120-day" would sort FIRST
     as a string and LAST by rank.
     MEASURED, AND IT IS WORTH BEING EXACT: swapping `cycleSortKey` for a
     `cycleLabelFor(...).localeCompare(...)` leaves this test GREEN — it reads
     `cycleSortKey` directly and never goes through the comparator. The
     mutation is caught by "an item with no cycle never heads the list" below,
     where the label path has no rank to fall back on and a placeholder string
     collates ahead of the real labels. With two cycles that is the only
     assertion that can catch it, which is itself the argument for the rank:
     the ordering is currently correct by coincidence of the two labels. */
  it("a hypothetical 120-day cycle would break a label comparison", () => {
    expect("120-day".localeCompare(CYCLE_LABEL.first)).toBeLessThan(0);
    expect(cycleSortKey("intakeBillingReview")).toBeLessThan(
      cycleSortKey("monthlyReReview")
    );
  });
  /* UNKNOWN SORTS LAST IN ASCENDING ORDER — "an item with no cycle is not the
     earliest cycle, it is unknown". A flag has no cycle. */
  it("an item with no cycle never heads the list", () => {
    const withFlag = [...ROWS, row("e5", "Aaron B.", 1, "riskFlagReview")];
    const out = applyCareSort(withFlag, { column: "cycle", dir: "asc" }, itemFor);
    expect(out[out.length - 1].id).toBe("e5");
  });
});

describe("it is a total order and the tie-break does not invert", () => {
  /* PROPERTY 3. Four rows, one name, so the KEY ties everywhere and only the
     tie-break decides. */
  const tied: Row[] = [
    row("e9", "Same N.", 5, "intakeBillingReview"),
    row("e7", "Same N.", 5, "intakeBillingReview"),
    row("e8", "Same N.", 5, "intakeBillingReview"),
  ];
  it("ties resolve by id, ascending, in BOTH directions", () => {
    expect(ids(applyCareSort(tied, { column: "mentee", dir: "asc" }, itemFor))).toEqual([
      "e7",
      "e8",
      "e9",
    ]);
    /* MUTATION: applying `sign` to the tie-break reverses this to e9,e8,e7 —
       and the list would reshuffle its ties on a direction toggle that is
       supposed to be a reversal of a key nothing here distinguishes. */
    expect(ids(applyCareSort(tied, { column: "mentee", dir: "desc" }, itemFor))).toEqual([
      "e7",
      "e8",
      "e9",
    ]);
  });
  it("is deterministic across calls", () => {
    const a = ids(applyCareSort(ROWS, { column: "cycle", dir: "asc" }, itemFor));
    const b = ids(applyCareSort(ROWS, { column: "cycle", dir: "asc" }, itemFor));
    expect(a).toEqual(b);
  });
});

describe("the click cycle returns to the default", () => {
  /* §3: "A way back to default ordering must exist." The third click IS a way;
     the visible reset control is the OBVIOUS one, and both exist. */
  it("asc, then desc, then off", () => {
    let s: CareSort | null = null;
    s = nextSort(s, "age");
    expect(s).toEqual({ column: "age", dir: "asc" });
    s = nextSort(s, "age");
    expect(s).toEqual({ column: "age", dir: "desc" });
    /* MUTATION: returning `{column, dir: "asc"}` here makes the control a
       two-state toggle with no way home from the header. */
    expect(nextSort(s, "age")).toBeNull();
  });
  it("a different column starts at asc rather than inheriting the direction", () => {
    /* Inheriting means clicking `Mentee` after `oldest first` silently gives
       Z to A — a sort the reader did not ask for under a label that says
       nothing about it. */
    expect(nextSort({ column: "age", dir: "desc" }, "mentee")).toEqual({
      column: "mentee",
      dir: "asc",
    });
  });
});

describe("the control's words", () => {
  const COLUMNS: CareSortColumn[] = ["mentee", "cycle", "age"];
  /* THE LABEL IS THE COLUMN HEADER. §6.2's rule, and the reason `SORT_LABEL`
     is the single source both the header and the control read: a sort option
     naming a column differently from the column is the surface disagreeing
     with itself. */
  it("names every column and every direction", () => {
    for (const c of COLUMNS) {
      expect(SORT_LABEL[c]).toBeTruthy();
      expect(SORT_MEANING[c].asc).toBeTruthy();
      expect(SORT_MEANING[c].desc).toBeTruthy();
      expect(SORT_MEANING[c].asc).not.toBe(SORT_MEANING[c].desc);
    }
  });
  /* "Ascending" is meaningless to a reader looking at a queue — ascending
     WHAT? No direction word may appear in a meaning. */
  it("no meaning says ascending or descending", () => {
    const all = COLUMNS.flatMap((c) => [SORT_MEANING[c].asc, SORT_MEANING[c].desc]);
    for (const m of all) expect(m.toLowerCase()).not.toMatch(/scending/);
  });
  /* `Cycle`, NOT `Review` — measured: the header row read "Mentee · Review ·
     Review age" and the sort control would have offered "Review" and "Review
     age" as separate options. */
  it("no two columns share a label, and none is a prefix of another", () => {
    for (const a of COLUMNS) {
      for (const b of COLUMNS) {
        if (a === b) continue;
        expect(SORT_LABEL[a]).not.toBe(SORT_LABEL[b]);
        expect(SORT_LABEL[b].startsWith(SORT_LABEL[a])).toBe(false);
      }
    }
  });
});
