"use client";

// ═══ THE FILTER CHIP ROW — AND WHY IT IS NOT A TAB ROW ═══
//
// ═══ arch-D's THRESHOLD WAS INHERITED AND IS SUPERSEDED ═══
//
// Phase D recorded: "a second domain on Tasks → the tab row returns, with group
// headers nesting beneath tabs." That rule came from the four-domain
// architecture, where a tab was a DOMAIN with its own success model — escalations
// measured by response time, billing by completion, flags by coverage — and
// switching tabs meant switching what "done" meant.
//
// Tasks has one success model now and will have many task types. Tabs would
// claim separate surfaces where there is one; chips say "narrow this list", which
// is what a reader actually wants and is a much lighter promise.
//
// THREE RULES, AND THE THIRD IS THE ONE THAT KEEPS IT HONEST:
//
//   · A NEW TASK TYPE needs no structural change at all. Rows state their type
//     and time buckets hold any mix, so a second type just appears in the list.
//   · MORE THAN ONE TYPE PRESENT → this row appears, defaulting to All.
//   · ONE TYPE → nothing renders. A single filter offering no choice is dead
//     chrome, the same reasoning that removed the one-tab row in Phase A.
//
// IT IS BUILT NOW AND HIDDEN NOW. The affordance exists before the second type
// lands, so the day it does there is no scramble — and with billing alone on the
// surface a reader sees no control, which is the correct amount of chrome for a
// list with nothing to narrow.
//
// ═══ IT DOES NOT COMPETE WITH THE TIME GROUPING ═══
//
// The chips narrow WHICH TASKS; the buckets say WHEN they are due. Those are
// different questions and both answers stay visible — filtering to one type
// leaves the buckets intact, and an emptied bucket simply stops rendering.

import { TASK_KIND_LABEL, taskKindKey } from "@/lib/tasks/task-kind";
import type { TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The sentinel for "no narrowing". Not a task kind, and never compared against
 *  one. */
export const ALL_KINDS = "__all__";

/** ═══ WHICH CHIPS EXIST — DERIVED FROM THE LIST, NOT DECLARED ═══
 *
 *  A chip appears because a task of that kind is on the surface, so the row can
 *  never offer a filter that returns nothing. That also means the chips change as
 *  the list does, which is right: a kind that has been fully worked stops being a
 *  thing to filter by.
 *
 *  KEYED ON THE KIND LABEL, so the two billing task types collapse to one chip.
 *  Nobody wants "Intake" separately from "Monthly re-review" when both are
 *  billing code reviews — see `taskKindKey`.
 *
 *  FIRST-APPEARANCE ORDER, which on a deadline-sorted list means the kind whose
 *  most urgent item is most urgent comes first. Not alphabetical: a fixed
 *  alphabet would put the least pressing kind first on a bad day. */
export function kindChipsFor(items: TaskItem[]): string[] {
  const seen: string[] = [];
  for (const item of items) {
    const key = taskKindKey(item.taskType);
    if (!seen.includes(key)) seen.push(key);
  }
  /* ═══ FIXED ORDER, NOT FIRST APPEARANCE (arch-G, G2) ═══
     First appearance on a deadline-sorted list meant the chip order changed as
     the data did — "Billing · Escalations" on a quiet morning and the reverse
     once an escalation opened. A control that reorders under a reader is a
     control they have to re-read every time. Escalations first because they are
     the surface's most urgent work and the order is then a statement rather than
     an accident. */
  const ORDER = ["Escalations", "Flags", "Billing"];
  return [...seen].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

/** How many items each chip would show. The chip states it, so narrowing is a
 *  decision a reader can make before they make it. */
export function kindCountsFor(items: TaskItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = taskKindKey(item.taskType);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export function filterByKind(items: TaskItem[], kind: string): TaskItem[] {
  if (kind === ALL_KINDS) return items;
  return items.filter((i) => taskKindKey(i.taskType) === kind);
}

export function KindFilter({
  items,
  value,
  onChange,
}: {
  /** The UNFILTERED set, so the chips do not disappear as soon as one is used. */
  items: TaskItem[];
  value: string;
  onChange: (next: string) => void;
}) {
  const kinds = kindChipsFor(items);
  /* ONE KIND IS NO CHOICE. See the module note. */
  if (kinds.length < 2) return null;

  const chips = [ALL_KINDS, ...kinds];
  const counts = kindCountsFor(items);

  return (
    <div
      /* ═══ A GROUP OF TOGGLES, NOT A TABLIST ═══
         `role="tablist"` would announce these as switching between panels, which
         is the exact claim the chips exist to avoid — there is one list and it
         narrows. A labelled group of pressed/unpressed buttons says what is
         happening: `aria-pressed` carries which narrowing is in force. */
      role="group"
      /* TODO-COPY */
      aria-label="Filter by task type"
      data-anno-ref="tasks-kind-filter"
      className="mt-4 flex shrink-0 flex-wrap items-center gap-1.5"
    >
      {chips.map((kind) => {
        const active = kind === value;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onChange(kind)}
            aria-pressed={active}
            /* THE COUNT IS `aria-hidden` IN THE LABEL, so the name carries it
               here instead — a screen-reader user gets "Escalations, 4 items"
               rather than "Escalations 4". */
            aria-label={
              kind === ALL_KINDS
                ? `All, ${items.length} item${items.length === 1 ? "" : "s"}`
                : `${kind}, ${counts[kind] ?? 0} item${(counts[kind] ?? 0) === 1 ? "" : "s"}`
            }
            className={cn(
              "inline-flex min-h-8 items-center rounded-full px-3 text-[12.5px] leading-[17px] transition-colors",
              /* SELECTION IS A FILL PLUS A WEIGHT, never colour alone — the
                 active chip is `--text-primary` ground with inverse ink, which
                 also reads as pressed in a forced-colours mode where the tint
                 would not. */
              active
                ? "bg-[var(--text-primary)] font-semibold text-[var(--text-inverse)]"
                : "border border-[color:var(--border-contour)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            {/* NEEDS-COPY-NICOLE. "All" is the only string this component owns;
                every other chip is a task-kind GROUP from `task-kind.ts`.
                THE COUNT IS PART OF THE LABEL (arch-G, G2): a chip that says how
                many it would show lets a reader decide before deciding, and it
                is the same grammar the bucket headers use — name, em dash,
                count. Tabular so a two-digit count does not shift the row. */}
            {kind === ALL_KINDS ? "All" : kind}
            <span aria-hidden className="pl-1.5 tabular-nums opacity-70">
              {kind === ALL_KINDS ? items.length : (counts[kind] ?? 0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { TASK_KIND_LABEL };
