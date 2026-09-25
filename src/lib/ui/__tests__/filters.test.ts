// ═══════════════════════════════════════════════════════════════════════════
// FILTERS SUBSET; THEY NEVER REORDER (Refinement §6.4, §9.9)
//
// §9.9 asks for confirmation that filters do not affect ordering AND how it was
// verified. This file is the how, and the method matters more than the result:
//
// A DOM CHECK CANNOT PROVE THIS. You could filter a list in a browser, read the
// rows, and see them in order — and that would hold for the fixture you tried
// while saying nothing about a fixture whose comparator ties differently. The
// property is SUBSEQUENCE: every survivor appears in the same relative order it
// had in the input. That is checkable directly, over adversarial inputs, and it
// fails for any implementation that sorts — including one that sorts by the
// same comparator, because a stable re-sort of a subset is still a re-sort and
// would pass an eyeball test while breaking the day the comparator changes.
//
// So the assertion is structural, and `applyFilters` is written to make it
// trivially true: it is `Array.prototype.filter` and imports no comparator.

import { describe, expect, it } from "vitest";
import {
  activeCount,
  applyFilters,
  EMPTY_FILTERS,
  isFiltering,
  timeDimension,
  type Filterable,
  type FilterDimension,
} from "@/lib/ui/filters";

interface Row extends Filterable {
  id: string;
  code: string;
}

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** DELIBERATELY NOT IN ANY NATURAL ORDER. Ids descend while ages ascend and the
 *  codes repeat, so a filter that sorted by ANY of the three fields would
 *  produce a different sequence and be caught. An already-sorted fixture would
 *  let a sorting implementation pass. */
const ROWS: Row[] = [
  { id: "e", code: "F33.1", searchText: "Theo L. Brandy Forrestor", at: NOW - 2 * HOUR },
  { id: "d", code: "F41.1", searchText: "Imani C. Victoria Ellery", at: NOW - 2 * DAY },
  { id: "c", code: "F33.1", searchText: "Naomi R. Brandy Forrestor", at: NOW - 30 * HOUR },
  { id: "b", code: "R45.89", searchText: "Simone B. Nour Barakat", at: NOW - 9 * DAY },
  { id: "a", code: "F41.1", searchText: "Theo M. Jae Sung Park", at: NOW - 4 * DAY },
];

const codeDim: FilterDimension<Row> = {
  id: "code",
  label: "Billing code",
  options: (items) => [...new Set(items.map((r) => r.code))].map((v) => ({ value: v, label: v })),
  match: (r, v) => r.code === v,
};
const DIMS = [codeDim, timeDimension<Row>(NOW)];

/** Is `out` a subsequence of `input`? The property, stated once. */
function isSubsequence<T>(out: T[], input: T[]): boolean {
  let i = 0;
  for (const item of input) {
    if (i < out.length && out[i] === item) i += 1;
  }
  return i === out.length;
}

describe("a filtered list is the same order with rows removed", () => {
  /** EVERY COMBINATION, not a sampled one. Five codes × five bands × a handful
   *  of queries is small enough to enumerate, and enumerating is what turns
   *  "we tried it" into "there is no input that breaks it". */
  const QUERIES = ["", "theo", "brandy", "z", " Theo ", "F33"];
  const CODES = [null, "F33.1", "F41.1", "R45.89", "nope"];
  const BANDS = [null, "24h", "3d", "7d", "older", "nope"];

  it("returns a subsequence for every filter combination", () => {
    let checked = 0;
    let nonTrivial = 0;
    for (const q of QUERIES) {
      for (const code of CODES) {
        for (const age of BANDS) {
          const out = applyFilters(ROWS, DIMS, { q, by: { code, age } });
          expect(
            isSubsequence(out, ROWS),
            `reordered for q=${JSON.stringify(q)} code=${code} age=${age}: ` +
              `${out.map((r) => r.id).join("")}`
          ).toBe(true);
          checked += 1;
          if (out.length > 1 && out.length < ROWS.length) nonTrivial += 1;
        }
      }
    }
    /* ═══ THE INPUT IS ASSERTED ═══
       A run where every combination returned everything or nothing would
       satisfy the subsequence check and prove nothing about ordering. This
       pins that the enumeration actually produced PARTIAL results — the only
       case where a re-sort could show up. */
    expect(checked).toBe(QUERIES.length * CODES.length * BANDS.length);
    expect(nonTrivial).toBeGreaterThan(5);
  });

  it("preserves relative order even when the survivors are non-adjacent", () => {
    // e, c both F33.1 — positions 0 and 2 in the input, so a survivor pair with
    // a gap between them, which is where an index-based bug would surface.
    const out = applyFilters(ROWS, DIMS, { q: "", by: { code: "F33.1" } });
    expect(out.map((r) => r.id)).toEqual(["e", "c"]);
  });

  it("returns the input itself when nothing is narrowing", () => {
    expect(applyFilters(ROWS, DIMS, EMPTY_FILTERS).map((r) => r.id)).toEqual(
      ROWS.map((r) => r.id)
    );
  });

  it("imports no comparator — asserted from source, because absence is the claim", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/lib/ui/filters.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    /* A DOM CHECK CANNOT SEE THIS and neither can the subsequence test: an
       implementation that sorted by the SAME comparator would return a
       subsequence for every fixture above and still be a re-sort waiting to
       diverge. What makes the property permanent is that this module cannot
       sort at all. */
    expect(src, "filters.ts sorts").not.toMatch(/\.sort\s*\(/);
    expect(src, "filters.ts imports a comparator").not.toMatch(
      /compare(Tasks|Events|Groups)/
    );
  });
});

describe("the search counts as a filter", () => {
  it("is in the active count, because it narrows exactly as much", () => {
    // A badge that ignored it would read 0 on a list showing three of 123 rows.
    expect(activeCount({ q: "theo", by: {} })).toBe(1);
    expect(isFiltering({ q: "theo", by: {} })).toBe(true);
    expect(activeCount({ q: "  ", by: {} })).toBe(0);
    expect(activeCount({ q: "theo", by: { code: "F33.1", age: null } })).toBe(2);
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
    expect(isFiltering(EMPTY_FILTERS)).toBe(false);
  });

  it("matches either name, which is what collapsed two dropdowns (§6.1)", () => {
    // The mentee filter and the mentor filter became one field; both halves of
    // the haystack have to hit or the collapse lost a dimension.
    expect(applyFilters(ROWS, DIMS, { q: "imani", by: {} }).map((r) => r.id)).toEqual(["d"]);
    expect(applyFilters(ROWS, DIMS, { q: "barakat", by: {} }).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("options describe what is present, never what is possible", () => {
  it("offers only bands some row falls in", () => {
    // An offered value that returns nothing is a control whose only outcome is
    // the filtered-empty state.
    const dim = timeDimension<Row>(NOW);
    const offered = dim.options(ROWS).map((o) => o.value);
    for (const v of offered) {
      expect(
        applyFilters(ROWS, [dim], { q: "", by: { age: v } }).length,
        `band ${v} is offered but matches nothing`
      ).toBeGreaterThan(0);
    }
    // THE INPUT IS ASSERTED: an empty option list would pass the loop above.
    expect(offered.length).toBeGreaterThan(2);
  });

  it("puts every row in exactly one band, so the bands partition the set", () => {
    const dim = timeDimension<Row>(NOW);
    for (const r of ROWS) {
      const hits = dim.options(ROWS).filter((o) => dim.match(r, o.value));
      expect(hits.length, `${r.id} fell in ${hits.length} bands`).toBe(1);
    }
  });
});
