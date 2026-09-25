// ═══════════════════════════════════════════════════════════════════════════
// FILTERS SUBSET; THEY NEVER REORDER (Refinement §6)
//
// ═══ THE ONE INVARIANT THIS MODULE EXISTS TO HOLD ═══
//
// §6.4, and it is a standing locked decision older than this pack: the single
// comparator governs order. A filtered list is the same order with rows removed.
//
// So `applyFilters` is `Array.prototype.filter` and nothing else. It takes no
// comparator, imports no sort, and returns a SUBSEQUENCE of its input — which is
// a property a test can check directly rather than a claim a comment makes. It
// is not "we remembered not to sort"; there is nothing here that could.
//
// ═══ AND THEY DO NOT PERSIST (§6.4) ═══
//
// A SAFETY RULE, not a preference — which is why it is stated here, in the
// module the filters live in, rather than left to whichever component happens to
// hold the state. Returning to a filtered safety queue that looks empty, when
// 117 flags are hidden behind a filter set from yesterday, is a failure mode
// with a real cost.
//
// The enforcement is structural: `FilterState` is held in `useState` and this
// module never touches the store. `view-options.ts` is the persisted one, and
// the two are deliberately separate files so "which of these survives a reload"
// is answerable by looking at the imports.
//
// ═══ OPTIONS ARE DERIVED FROM THE PRESENT SET, NOT ENUMERATED ═══
//
// A dropdown offering a category no row has is a control whose only outcome is
// the filtered-empty state. Every dimension computes its options from the items
// in front of the reader, so an offered value always returns at least one row at
// the moment it is offered.

/** What a dimension needs from an item, so this module depends on neither
 *  surface's model. Both lists can answer all three. */
export interface Filterable {
  /** Free-text haystack — the names a search should match. */
  searchText: string;
  /** The instant the row's age is measured from, for the time dimension. */
  at: number;
}

export interface FilterOption {
  value: string;
  /** NEEDS-COPY-NICOLE. What the reader sees, in the dropdown and in the chip. */
  label: string;
}

export interface FilterDimension<T> {
  id: string;
  /** NEEDS-COPY-NICOLE. */
  label: string;
  /** The one dimension that renders in the toolbar rather than behind the
   *  `Filters` button. Exactly one per destination (§6.3). */
  primary?: boolean;
  /** Derived from the items present — see the module note. */
  options: (items: T[]) => FilterOption[];
  /** Does this item satisfy `value`? */
  match: (item: T, value: string) => boolean;
}

export interface FilterState {
  /** The search box. Trimmed at match time, not at keystroke time, so a
   *  trailing space while typing a second word does not empty the list. */
  q: string;
  /** dimension id → chosen value. Absent or null means "not filtering on it". */
  by: Record<string, string | null>;
}

export const EMPTY_FILTERS: FilterState = { q: "", by: {} };

/** ═══ THE TIME DIMENSION, SHARED ═══
 *
 *  Both surfaces measure the same thing — how long this has been waiting — so
 *  the buckets are defined once. They are AGE bands rather than calendar dates:
 *  neither surface has a deadline (`FLAG_REVIEW_SLA` and both billing SLAs are
 *  null), so "older than a week" is a fact this system can state while "due
 *  Friday" is not.
 *
 *  OPEN-ENDED AT THE TOP. `7d+` has no upper bound because a queue's oldest
 *  item is the one a supervisor most needs to be able to isolate. */
const DAY = 86_400_000;
const AGE_BANDS: { value: string; label: string; maxAge: number }[] = [
  /* NEEDS-COPY-NICOLE */
  { value: "24h", label: "Last 24 hours", maxAge: DAY },
  { value: "3d", label: "Last 3 days", maxAge: 3 * DAY },
  { value: "7d", label: "Last 7 days", maxAge: 7 * DAY },
  { value: "older", label: "Older than 7 days", maxAge: Infinity },
];

export function timeDimension<T extends Filterable>(
  now: number
): FilterDimension<T> {
  return {
    id: "age",
    /* NEEDS-COPY-NICOLE */
    label: "Waiting",
    options: (items) =>
      AGE_BANDS.filter((b) =>
        items.some((i) => inBand(now - i.at, b.value))
      ).map(({ value, label }) => ({ value, label })),
    match: (item, value) => inBand(now - item.at, value),
  };
}

function inBand(age: number, value: string): boolean {
  const i = AGE_BANDS.findIndex((b) => b.value === value);
  if (i < 0) return true;
  const lower = i === 0 ? -Infinity : AGE_BANDS[i - 1].maxAge;
  return age > lower && age <= AGE_BANDS[i].maxAge;
}

/** ═══ SUBSET. NOTHING ELSE. ═══
 *  See the module note: this is a `filter` and cannot reorder its input. */
export function applyFilters<T extends Filterable>(
  items: T[],
  dimensions: FilterDimension<T>[],
  state: FilterState
): T[] {
  const q = state.q.trim().toLowerCase();
  return items.filter((item) => {
    if (q && !item.searchText.toLowerCase().includes(q)) return false;
    for (const d of dimensions) {
      const v = state.by[d.id];
      if (v != null && !d.match(item, v)) return false;
    }
    return true;
  });
}

/** How many dimensions are narrowing the list, for the button's badge. The
 *  SEARCH COUNTS: it narrows exactly as much as a dropdown does, and a badge
 *  that ignored it would read 0 on a list showing three of 123 rows. */
export function activeCount(state: FilterState): number {
  return (
    (state.q.trim() ? 1 : 0) +
    Object.values(state.by).filter((v) => v != null).length
  );
}

export function isFiltering(state: FilterState): boolean {
  return activeCount(state) > 0;
}
