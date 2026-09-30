"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TOOLBAR BELONGS TO THE LIST (Refinement §5, §6)
//
// ═══ WHY IT IS HERE AND NOT IN THE HEADER ═══
//
// MEASURED before: the View trigger sat at x=1374 while the list column it
// governs ended at x=842 — 532px away, in the gap between the list and the
// metric cluster, belonging to neither. It spans the list column now and is
// right-aligned to that column's edge. Same reasoning that puts the metric
// cluster with the header: a control sits with the thing it acts on.
//
// ═══ WHY SEVEN CONTROLS ARE NOT SEVEN CONTROLS (§6.3) ═══
//
// Seven dropdowns in a row is a wall, and most go unused most of the time. What
// is always visible is the search box and ONE primary dimension — Category on
// Risk Flags, Billing code on Care Reviews. Everything else is behind a
// `Filters` button carrying a count, so the cost of the rare dimensions is one
// click rather than permanent width.
//
// ═══ THE ACTIVE SET IS ALWAYS VISIBLE, THOUGH ═══
//
// Collapsing the CONTROLS must not collapse the STATE. A filter narrowing the
// list from behind a closed popover is exactly the failure §6.4 legislates
// against, so every active filter renders as a removable chip below the
// toolbar — including the search term, which narrows just as much as a
// dropdown does.

import { useId } from "react";
import { ListFilter, Search, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ViewOptionsButton } from "@/components/ia/view-options";
/* §4.3's chip is the ROW chip, parameterised — see its note in `worklist.tsx`
   on why the toolbar consumes it instead of restating the treatment. */
import { OverdueChip } from "@/components/tasks/worklist";
import {
  activeCount,
  type FilterDimension,
  type FilterState,
  type Filterable,
} from "@/lib/ui/filters";
import { type ViewPreset } from "@/lib/ui/view-options";
import { cn } from "@/lib/utils";
import {
  CARE_TABS,
  CARE_TAB_LABEL,
  CARE_TAB_NAME,
  type CareTab,
} from "@/lib/ui/care-tab";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The shared control shell — 44px (HIG), pill, quiet until hovered. */
const CONTROL =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3 text-[13px] leading-[18px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]";

function Select<T extends Filterable>({
  dim,
  items,
  value,
  onPick,
}: {
  dim: FilterDimension<T>;
  items: T[];
  value: string | null;
  onPick: (v: string | null) => void;
}) {
  const id = useId();
  const options = dim.options(items);
  /* ═══ A DIMENSION WITH NOTHING TO OFFER DOES NOT RENDER ═══
     Options are derived from the present set, so an empty list means no row
     could answer this question — and a select whose only choice is "Any" is
     the dead chrome `AGENTS.md` removed the one-tab row for. */
  if (options.length === 0) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <label htmlFor={id} className="sr-only">
        {dim.label}
      </label>
      <select
        id={id}
        data-anno-ref={`filter:${dim.id}`}
        value={value ?? ""}
        onChange={(e) => onPick(e.target.value || null)}
        className={cn(CONTROL, "max-w-[13rem] cursor-pointer", RING)}
      >
        {/* NEEDS-COPY-NICOLE. The unfiltered option states the DIMENSION, so a
            resting control says what it would narrow rather than just "All". */}
        <option value="">{dim.label}: any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function ListToolbar<T extends Filterable>({
  items,
  dimensions,
  filters,
  onFilters,
  preset,
  onPreset,
  searchHint,
  showView = true,
  /** ═══ §4 — FILTERS ARE PER-SURFACE NOW ═══
   *  Care Reviews removes them; Risk Flags keeps them. Confirmed scope: "just
   *  care reviews for now". A GATE RATHER THAN A DELETION, because the control
   *  is shared and Risk Flags has no table and no sorting — removing it there
   *  would leave search and comparator order as the only way through 123
   *  items, which is the reasoning §4 asked to check before touching it.
   *  DEFAULTS TRUE, so the surface that keeps them is unchanged by this prop
   *  existing. */
  showFilters = true,
  /** ═══ §5.1 — THE OPEN / SUBMITTED SEGMENTED CONTROL ═══
   *  Rendered beside search, before the filter controls. Omitted, nothing
   *  renders — the other list surface has no such axis. */
  tabs,
}: {
  /** The UNFILTERED set, so every dimension's options describe what exists
   *  rather than what the other filters have already left. */
  items: T[];
  dimensions: FilterDimension<T>[];
  filters: FilterState;
  onFilters: (next: FilterState) => void;
  preset: ViewPreset;
  onPreset: (p: ViewPreset) => void;
  /** NEEDS-COPY-NICOLE. What the search box matches, per destination. */
  searchHint: string;
  /** ═══ CARE REVIEWS DROPS IT; RISK FLAGS KEEPS IT (§4.2) ═══
   *  §4.2 simplifies the Care Reviews toolbar to two controls, and that was
   *  confirmed rather than inferred from the mockup's silence.
   *  THE PRESETS THEMSELVES STAY, per §4.3's "the three density presets stay
   *  as built" — it is the CONTROL that goes, not the row system. So Care
   *  Reviews renders at whatever preset is stored, defaulting to comfortable,
   *  with no way to change it from that surface. That asymmetry is stated in
   *  the report rather than smoothed over: a stored preference with no control
   *  is an odd state, and it is the state §4.2 asks for. */
  showView?: boolean;
  showFilters?: boolean;
  tabs?: {
    value: CareTab;
    onChange: (next: CareTab) => void;
    /** Per-tab counts, so a segment says how much is behind it. */
    count: Record<CareTab, number>;
    /** ═══ §4.3 — THE OVERDUE SUBSET OF THE ACTIVE TAB ═══
     *  A chip, not a fourth segment: overdue items ARE open items, so as a peer
     *  tab the counts would stop partitioning — `16 open · 1 overdue` with the
     *  1 inside the 16 — and tabs read as mutually exclusive by convention.
     *  The caller computes it over the ACTIVE tab's set, so this subsets
     *  whichever tab is showing. Zero hides it. */
    overdue?: number;
  };
}) {
  /* ═══ §4 — BOTH THE PRIMARY SELECT AND THE `Filters` POPOVER ARE GATED ═══
     "Remove the `Filters` control and its dimension config. Keep search." The
     primary dimension goes with it: it is a filter that happens to be always
     visible, and leaving Billing code on the toolbar while removing the
     popover would keep one filter and call it something else.
     THE COUNT BADGE, THE ACTIVE CHIPS AND THE FILTERED-EMPTY STATE all fall
     out of this — they render only when something is filtering, and nothing on
     this surface can filter now. */
  const primary = showFilters ? dimensions.find((d) => d.primary) : undefined;
  const behind = showFilters ? dimensions.filter((d) => !d.primary) : [];
  const n = activeCount(filters);
  const searchId = useId();
  const set = (patch: Partial<FilterState>) =>
    onFilters({ ...filters, ...patch });
  const setBy = (id: string, v: string | null) =>
    onFilters({ ...filters, by: { ...filters.by, [id]: v } });

  /** Every active narrowing, as a removable chip. The search is one of them. */
  const chips = [
    ...(filters.q.trim()
      ? [
          {
            key: "q",
            /* NEEDS-COPY-NICOLE */
            label: `“${filters.q.trim()}”`,
            clear: () => set({ q: "" }),
          },
        ]
      : []),
    ...dimensions.flatMap((d) => {
      const v = filters.by[d.id];
      if (v == null) return [];
      const opt = d.options(items).find((o) => o.value === v);
      return [
        {
          key: d.id,
          label: `${d.label}: ${opt?.label ?? v}`,
          clear: () => setBy(d.id, null),
        },
      ];
    }),
  ];

  return (
    <div data-anno-ref="list-toolbar" className="shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        {/* ═══ SEARCH REPLACES TWO DROPDOWNS (§6.1) ═══
            `mentee` and `mentor` collapsed into one field: matching either name
            is more useful than two selects and covers both. */}
        <span className="relative inline-flex min-w-0 flex-1 items-center">
          <label htmlFor={searchId} className="sr-only">
            {searchHint}
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 size-3.5 text-[var(--text-muted)]"
          />
          <input
            id={searchId}
            type="search"
            data-anno-ref="filter:search"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={searchHint}
            className={cn(
              CONTROL,
              "min-w-[10rem] flex-1 pl-8 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              RING
            )}
          />
        </span>

        {/* ═══ §5.1 — TWO STATES, AND THE COUNT IS IN EACH SEGMENT ═══
            A `radiogroup` rather than `role="tablist"`: these select which set
            the list shows, and they are not tabs over separate panels — the
            panel is the same list. Arrow keys come free from the radio
            semantics, which is what a segmented control should have.
            THE COUNT SITS IN THE SEGMENT because §5.1 requires the header's
            figures to follow the active state — so without it, switching to
            Submitted would hide the open count with nothing saying what it
            was, and a supervisor would have to switch back to find out.
            44px MINIMUM on each segment (2.5.8), which is why the row is
            `min-h-11` and not the 32px a segmented control often gets. */}
        {tabs && (
          <div
            role="radiogroup"
            /* NEEDS-COPY-NICOLE */
            aria-label="Which reviews to show"
            data-anno-ref="care-tabs"
            /* ═══ THE CONTROL IS 44 TALL AND SO IS EACH SEGMENT ═══
               It was `p-1` with `min-h-9` segments, which measured 36px per
               target inside a 44px control. 36 clears SC 2.5.8's 24×24 floor,
               but this codebase holds the 44px HIG bar everywhere else on this
               toolbar — the search field and every button are `min-h-11` — and
               a segmented control whose segments are the odd one out is the
               kind of inconsistency nobody can see and everybody feels.
               NO WRAPPER PADDING, so the control and its targets are the same
               44 rather than 44 + 8. */
            className="flex shrink-0 items-center overflow-hidden rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-card)]"
          >
            {CARE_TABS.map((t) => {
              const active = tabs.value === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${CARE_TAB_NAME[t]}, ${tabs.count[t]}`}
                  data-anno-ref={`care-tab:${t}`}
                  onClick={() => tabs.onChange(t)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 px-3.5 text-[13px] leading-[18px] transition-colors",
                    /* ═══ NOT COLOUR ALONE (SC 1.4.1) ═══
                       The selected segment carries a FILL, and `aria-checked`
                       carries it to assistive tech — but a sighted reader in
                       forced colours would lose the fill, so the selected
                       segment is also the only one in primary ink at full
                       weight. Two visual channels plus the state attribute. */
                    active
                      ? "bg-[var(--text-primary)] font-semibold text-[var(--text-inverse)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                    RING
                  )}
                >
                  {CARE_TAB_LABEL[t]}
                  {/* ═══ §4.2 — THE COUNT DOES THE METRIC LINE'S JOB NOW ═══
                      IT WAS 13px AT `opacity-70` — a parenthetical, which is
                      what §4.2 rules out now that the header carries no figures
                      at all. So it is 16px, tabular, and at full opacity.
                      THE ACTIVE TAB'S IS STRONGEST, which §4.2 asks for and
                      which the segment's own ink already delivers: the selected
                      segment is `--text-inverse` on a filled ground and the
                      others are `--text-secondary`, so the figures inherit that
                      contrast rather than needing a second rule.
                      `Closed 0` STILL RENDERS — knowing a tab is empty before
                      clicking it is useful, which is the one place on this
                      surface a zero earns its space. */}
                  <span
                    aria-hidden
                    className="text-[16px] leading-[20px] tabular-nums"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {tabs.count[t]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ═══ §4.3 — THE CHIP SITS BESIDE THE TABS, NOT AMONG THEM ═══
            Outside the `radiogroup` deliberately: inside it, a non-radio child
            breaks the group's content model and a screen reader would count it
            among the options — the same class of error as a roleless div inside
            a `tree`. Beside it, it reads as what it is: a qualifier on whatever
            the group has selected.
            IT RENDERS ONLY ABOVE ZERO (§4.3), so a clear queue shows nothing
            rather than a permanent `0 overdue` that teaches a reader to skip
            the spot.
            NOT A CONTROL. It filters nothing and navigates nowhere — there is
            no overdue view to go to, and inventing one here would be a
            disposition path on a list. So it is a `span`, with no tab stop and
            nothing to press. */}
        {tabs && (tabs.overdue ?? 0) > 0 && (
          <OverdueChip count={tabs.overdue} size="toolbar" />
        )}
        {primary && (
          <Select
            dim={primary}
            items={items}
            value={filters.by[primary.id] ?? null}
            onPick={(v) => setBy(primary.id, v)}
          />
        )}

        {behind.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-anno-ref="filters-button"
                /* THE COUNT IS IN THE NAME, not only in the badge — a badge is
                   a visual channel and this is the control that tells a reader
                   the list is narrowed. */
                aria-label={
                  n > 0
                    ? `Filters, ${n} active`
                    : /* NEEDS-COPY-NICOLE */ "Filters"
                }
                className={cn(CONTROL, RING)}
              >
                <ListFilter aria-hidden className="size-3.5" />
                {/* NEEDS-COPY-NICOLE */}
                Filters
                {n > 0 && (
                  <span
                    aria-hidden
                    data-anno-ref="filters-count"
                    className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--text-primary)] px-1 text-[11px] leading-[16px] tabular-nums text-[var(--text-inverse)]"
                  >
                    {n}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 gap-3 p-3">
              {behind.map((d) => (
                <div key={d.id} className="flex flex-col gap-1">
                  <span className="px-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
                    {d.label}
                  </span>
                  <Select
                    dim={d}
                    items={items}
                    value={filters.by[d.id] ?? null}
                    onPick={(v) => setBy(d.id, v)}
                  />
                </div>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {/* RIGHT-ALIGNED TO THE LIST COLUMN'S EDGE (§5). */}
        {showView && (
          <span className="ml-auto shrink-0">
            <ViewOptionsButton preset={preset} onChange={onPreset} />
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <div
          data-anno-ref="filter-chips"
          className="mt-2 flex flex-wrap items-center gap-1.5"
        >
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              /* NEEDS-COPY-NICOLE */
              aria-label={`Remove filter ${c.label}`}
              className={cn(
                /* 24×24 IS THE FLOOR HERE (SC 2.5.8), NOT 44. A chip is inline
                   with text and sized by its own label; a 44px-tall chip row
                   under the toolbar would cost more vertical space than the
                   filters themselves. 28px clears the floor with margin. */
                "inline-flex min-h-7 items-center gap-1 rounded-full bg-[var(--surface-s2)] px-2.5 text-[12px] leading-[16px] text-[var(--text-primary)] transition-colors",
                "hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              <span className="max-w-[14rem] truncate">{c.label}</span>
              <X aria-hidden className="size-3 shrink-0" />
            </button>
          ))}
          <button
            type="button"
            data-anno-ref="clear-filters"
            onClick={() => onFilters({ q: "", by: {} })}
            className={cn(
              "inline-flex min-h-7 items-center rounded-full px-2 text-[12px] leading-[16px] text-[var(--text-secondary)] underline decoration-dotted underline-offset-2 hover:text-[var(--text-primary)]",
              RING
            )}
          >
            {/* NEEDS-COPY-NICOLE */}
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
