"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DATAVIEW — one column definition, two renderings: a table when there is room
// for one, a card list when there is not.
//
// KILLS RC-3. Four tables carried `min-w-[720px]`/`min-w-[760px]`/`min-w-[640px]`
// and no small-screen strategy at all: on a 390px phone they were either
// horizontally scrolled with no affordance, or — in `relationship-table.tsx`'s
// case — clipped and unreachable. A table is the right shape for scanning many
// records across many attributes; it is the wrong shape for a 342px column. Both
// are needed, and the failure mode of maintaining them separately is that they
// drift: a column added to the table never appears on the phone.
//
// ═══ THE THRESHOLD IS A CONTAINER QUERY, NOT A VIEWPORT BREAKPOINT ═══
//
// This is the load-bearing decision. The same table renders in containers of
// wildly different widths at the SAME viewport: on `/app/mentees` at 960px the
// content column is ~900px, while inside the record at 960px it is ~804px, and
// inside the record at 390px it is 342px. A viewport breakpoint would have to
// guess which of those it was in, and would be wrong on at least one.
//
// `@container` + `@min-[45rem]` asks the only question that matters: is THIS BOX
// wide enough for a table? 45rem = 720px, derived from the app's own numbers —
// the widest of these tables needs 640px of table, and 720 leaves 80px for the
// page padding that always surrounds it (`px-6` = 48px, plus headroom).
//
// ═══ WHAT THE SLOTS MEAN ═══
//
// A card cannot show eight columns, so each column declares where it goes:
//
//   primary    the card's title line — one per table
//   secondary  the meta line under it, middot-joined in column order
//   trailing   the right-hand cluster (a chat link, an overflow menu)
//   detail     TABLE ONLY. Not deleted from the product — reachable on the
//              person's own record, which is one tap from the card.
//
// `detail` is the honest slot. `03-DEFINITION-OF-DONE.md` forbids deleting
// content at a breakpoint to avoid solving the layout; it permits a product
// decision about what belongs on a phone, recorded. Every `detail` column is
// that decision, and the per-table reasoning is in the Phase 5 report.
//
// ═══ HOW A CARD ROW STAYS CLICKABLE WITHOUT NESTING INTERACTIVES ═══
//
// Copied from `mentee-table.tsx`'s `PastMenteeRow`, which documents the measured
// hydration error that comes from putting an `<a>` inside an `<a>`: invalid HTML,
// a React hydration error, and the inner click also firing the outer navigation.
// So the row's link is a FULL-BLEED OVERLAY BEHIND the content; the content is
// `pointer-events-none`, and the trailing cluster opts back in with
// `pointer-events-auto`.
//
// design-system-gaps row 267.
// ═══════════════════════════════════════════════════════════════════════════

import { useRef } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { EdgeFades, useEdgeOverflow } from "@/components/ui/scroll-affordance";
import { cn } from "@/lib/utils";
import { touchTarget } from "@/lib/touch-target";

/** Where a column appears in card mode. See the module note. */
export type CardSlot = "primary" | "secondary" | "trailing" | "detail";

export interface DataColumn<T> {
  id: string;
  /** Table header text. Omit for a headerless column (chat, overflow) and set
   *  `srHeader` so the column is still named to a screen reader. */
  header?: string;
  /** Accessible name for a column whose header is visually empty. */
  srHeader?: string;
  /** Fixed `colgroup` width in px. Omit on exactly one column — that one absorbs
   *  the remaining space, which is what makes `table-fixed` predictable. */
  width?: number;
  /** The table cell's content. */
  cell: (row: T) => React.ReactNode;
  /** Card-mode content, when it differs from the table cell — usually it does,
   *  because a card line has no column header to give it meaning ("140 days"
   *  needs to become "140 days in mentorship"). Falls back to `cell`. */
  card?: (row: T) => React.ReactNode;
  slot: CardSlot;
  /** Sort key. When set, the header renders as a sort button. */
  sortKey?: string;
  /** Extra classes on the `<td>`. */
  className?: string;
}

export interface DataViewSort {
  key: string;
  dir: "asc" | "desc";
  onSort: (key: string) => void;
}

const TH = "px-5 py-3 font-medium";

/** ═══ THE THRESHOLDS, AS LITERAL CLASS PAIRS ═══
 *
 *  Tailwind scans source TEXT for class strings, so a threshold passed in as a
 *  prop and interpolated (`@min-[${w}]:hidden`) generates nothing at all. Every
 *  usable value is therefore written out here, and callers pick by key.
 *
 *  WHY MORE THAN ONE. The question "is this box wide enough for a table?" has a
 *  different answer per table, because the tables are different widths. A 640px
 *  4-column table is comfortable in a 720px box; a 7-column staff directory with
 *  two mutation menus in it needs ~960px before its Name column stops being an
 *  ellipsis. Forcing one threshold on both means either cards on a tablet that
 *  had room for a table, or a table squeezed past readability. */
const THRESHOLDS = {
  /** 720px — a 640px table plus the page padding that always surrounds it. */
  "45rem": {
    cards: "@min-[45rem]:hidden",
    table: "hidden @min-[45rem]:block",
  },
  /** 960px — for wide tables whose fixed columns already sum past 760px. */
  "60rem": {
    cards: "@min-[60rem]:hidden",
    table: "hidden @min-[60rem]:block",
  },
} as const;

export type DataViewThreshold = keyof typeof THRESHOLDS;

/** THE ONE SORT HEADER. `roster.tsx` and `relationship-table.tsx` each had their
 *  own copy of this, rendering the same three chevron states with different
 *  markup. One implementation, driven by the column definition. */
function SortHeader({
  label,
  colKey,
  sort,
}: {
  label: string;
  colKey: string;
  sort: DataViewSort;
}) {
  const on = sort.key === colKey;
  return (
    <button
      type="button"
      onClick={() => sort.onSort(colKey)}
      // SC 2.5.8: the label renders at 20px, which is under the 24px floor. The
      // visual is deliberately unchanged — `touchTarget` extends the hit area
      // with a `::after` and paints nothing. See lib/touch-target.ts for why the
      // pseudo-element has to sit on the button itself.
      className={cn(
        "inline-flex items-center gap-1 rounded-sm hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
        touchTarget(20)
      )}
    >
      {label}
      {on ? (
        sort.dir === "asc" ? (
          <ChevronUp className="size-3.5" aria-hidden />
        ) : (
          <ChevronDown className="size-3.5" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
      )}
    </button>
  );
}

export function DataView<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  rowLabel,
  leading,
  sort,
  empty,
  caption,
  surface = "var(--surface-card)",
  minTableWidth = 640,
  reserveScrollbarGutter = false,
  maxCardHeight,
  threshold = "45rem",
  className,
  annoRef,
}: {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  /** The row's destination. Null for a row that does not navigate. */
  rowHref?: (row: T) => string | null;
  /** The overlay link's accessible name — it covers the row, so it needs to say
   *  where it goes rather than inheriting a cell's text. */
  rowLabel?: (row: T) => string;
  /** Card-mode leading visual, typically an avatar. Decorative: it is rendered
   *  `aria-hidden` inside a `pointer-events-none` wrapper. */
  leading?: (row: T) => React.ReactNode;
  sort?: DataViewSort;
  empty?: React.ReactNode;
  /** Screen-reader caption for the table. A table with no caption in a page of
   *  several is unnavigable by screen reader. */
  caption: string;
  /** The colour the edge fades resolve to — the surface this sits ON. */
  surface?: string;
  minTableWidth?: number;
  /** Reserve the vertical scrollbar's gutter even when nothing scrolls.
   *  `relationship-table.tsx` needs this: its paused group scrolls and eats
   *  ~15px of inner width, and with `table-fixed` the flexible column absorbs
   *  all of it, so the two tables' columns visibly stepped by 15px. */
  reserveScrollbarGutter?: boolean;
  /** Cap the card list's height and scroll it — the card-mode equivalent of the
   *  paused group's row cap. */
  maxCardHeight?: number;
  /** The container width at which the table replaces the cards. See THRESHOLDS. */
  threshold?: DataViewThreshold;
  className?: string;
  /** ═══ AN ANNOTATION REGION NAME, OPTIONAL ═══
   *
   *  A `data-anno-ref` written on `<DataView>` at a call site would be DROPPED —
   *  this component destructures a closed prop list and spreads nothing, which is
   *  precisely the failure anno-02 measured when a tag was put on a component
   *  boundary. So the name comes in as a prop and is written onto the real root
   *  element below.
   *
   *  Omitted by default: no prop, no attribute, and every existing caller renders
   *  exactly what it rendered before. Names must not contain ":" — that suffix
   *  convention marks a region as record-bound, and annotating one is refused. */
  annoRef?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const edges = useEdgeOverflow(scrollRef);

  const primary = columns.find((c) => c.slot === "primary");
  const secondary = columns.filter((c) => c.slot === "secondary");
  const trailing = columns.filter((c) => c.slot === "trailing");

  const renderCard = (col: DataColumn<T>, row: T) =>
    (col.card ?? col.cell)(row);

  const at = THRESHOLDS[threshold];

  return (
    <div data-anno-ref={annoRef} className={cn("@container", className)}>
      {/* ══ CARD LIST — below the threshold ═══════════════════════════════ */}
      <ul
        className={cn(
          at.cards,
          maxCardHeight != null && "overflow-y-auto"
        )}
        style={maxCardHeight != null ? { maxHeight: maxCardHeight } : undefined}
      >
        {rows.length === 0 && empty != null && (
          <li className="px-5 py-6 text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {empty}
          </li>
        )}
        {rows.map((row) => {
          const href = rowHref?.(row) ?? null;
          const metas = secondary
            .map((c) => renderCard(c, row))
            .filter((v) => v != null && v !== "" && v !== false);
          return (
            // ═══ THE CARD WRAPS RATHER THAN CRUSHING ITS IDENTITY ═══
            //
            // MEASURED FAILURE that produced this: on `/app/team` at 320px the
            // trailing cluster (a status menu ~100px + a chat action ~70px, both
            // `shrink-0`) took 180px of a 240px card interior, so the name
            // column got ~4px and "Stephen Rowe" rendered as "S." with the role
            // pill bleeding out behind it. `shrink-0` on the trailing cluster is
            // correct — a squashed control is worse than a wrapped one — which
            // means the row itself has to give.
            //
            // `flex-wrap` PLUS A FLOOR ON THE TEXT COLUMN. The floor is what
            // makes the wrap happen at the right moment: with `min-w-[8rem]` the
            // text can no longer be compressed to nothing, so when the trailing
            // cluster cannot fit beside 128px of name it drops to a second line
            // instead. The identity is never the thing that gives.
            <li
              key={rowKey(row)}
              className="group relative flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[color:var(--border-subtle)] px-4 py-2.5 last:border-b-0"
            >
              {/* THE OVERLAY LINK, BEHIND the content — see the module note. */}
              {href && (
                <Link
                  href={href}
                  aria-label={rowLabel?.(row)}
                  className={cn(
                    "absolute inset-0 z-0 transition-colors",
                    "group-hover:bg-[var(--tint-hover)]",
                    "focus-visible:bg-[var(--tint-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
                  )}
                />
              )}
              {leading && (
                <span
                  aria-hidden
                  className="pointer-events-none relative z-10 shrink-0"
                >
                  {leading(row)}
                </span>
              )}
              <span className="pointer-events-none relative z-10 min-w-[8rem] flex-1">
                <span
                  className="block truncate text-[var(--text-primary)]"
                  style={{ font: "var(--type-row-value)" }}
                >
                  {primary ? renderCard(primary, row) : null}
                </span>
                {metas.length > 0 && (
                  <span
                    className="block truncate text-[var(--text-secondary)]"
                    style={{ font: "var(--type-row-label)" }}
                  >
                    {metas.map((m, i) => (
                      <span key={i}>
                        {i > 0 && " · "}
                        {m}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              {trailing.length > 0 && (
                // `pointer-events-auto` — the one live region over the overlay
                // link, so a tap on the chat icon does not navigate to the
                // record instead.
                // `ml-auto` keeps this right-aligned whether it shares the
                // first line or has wrapped onto its own.
                <span className="pointer-events-auto relative z-10 ml-auto flex shrink-0 items-center gap-1">
                  {trailing.map((c) => (
                    <span key={c.id}>{renderCard(c, row)}</span>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* ══ TABLE — at and above the threshold ════════════════════════════ */}
      <div className={cn("relative", at.table)}>
        <div
          ref={scrollRef}
          // BOTH AXES DECLARED. Per the CSS overflow spec, when one axis is
          // `visible` and the other is not, the `visible` one computes to
          // `auto` — the rule that put a 15px vertical scrollbar inside the
          // record's 44px tab strip. Declaring only `overflow-x` here would
          // silently make the Y axis scrollable and invite that back.
          className={cn(
            "overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            reserveScrollbarGutter ? "overflow-y-scroll" : "overflow-y-hidden"
          )}
        >
          <table
            className="w-full table-fixed border-collapse text-left"
            style={{ minWidth: minTableWidth }}
          >
            <caption className="sr-only">{caption}</caption>
            <colgroup>
              {columns.map((c) => (
                <col
                  key={c.id}
                  style={c.width != null ? { width: c.width } : undefined}
                />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-[color:var(--surface-s2)]">
                {columns.map((c) => {
                  const sortable = sort && c.sortKey;
                  return (
                    <th
                      key={c.id}
                      className={TH}
                      aria-sort={
                        sortable
                          ? sort!.key === c.sortKey
                            ? sort!.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                          : undefined
                      }
                    >
                      {sortable ? (
                        <SortHeader
                          label={c.header ?? ""}
                          colKey={c.sortKey!}
                          sort={sort!}
                        />
                      ) : (
                        (c.header ?? (
                          <span className="sr-only">{c.srHeader ?? c.id}</span>
                        ))
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && empty != null && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-5 py-6 text-[14px] leading-[20px] text-[var(--text-secondary)]"
                  >
                    {empty}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-[color:var(--surface-s2)] last:border-b-0 hover:bg-[var(--tint-hover)]"
                >
                  {columns.map((c) => (
                    <td key={c.id} className={cn("px-5 py-3", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <EdgeFades edges={edges} surface={surface} />
      </div>
    </div>
  );
}
