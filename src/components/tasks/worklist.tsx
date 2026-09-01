"use client";

// THE WORKLIST — rows, coalesced groups, keyboard selection, list states (§4).
//
// ROW ANATOMY (§4): avatar disc · teen name · "to {mentor}" caption · right-aligned
// differentiator chips + age in mono.
//
// ═══ WHAT A ROW MAY AND MAY NOT CARRY ═══
// NO PER-ROW TIER CHIPS (§3.3). Inside a tier-filtered list the tier is AMBIENT —
// every row in the Risk flags tab under a red-flag group is a red flag, and a chip
// saying so on each one is a chip that never varies. Rows carry only
// DIFFERENTIATORS: overdue · 911/non-911 · unreviewed/in-review · coalesce count.
// If you are adding a chip, the test is whether it differs between rows in the
// same list. Tier does not.
//
// NO MESSAGE SNIPPETS, EVER (locked decision 12). The flagged excerpt lives on the
// payload and renders only inside the detail pane. There is no code path from a row
// to `payload.flaggedExcerpt` in this file, deliberately.
//
// ═══ ROLE=TREE, NOT LISTBOX — AND WHY ═══
// §7 asks for "a listbox with proper selection semantics" AND for "disclosure
// buttons use aria-expanded". Those two cannot both be satisfied by a listbox:
//   · `aria-expanded` IS NOT a supported state of `role="option"`. The first draft
//     of this file used it and eslint's jsx-a11y rule was correct to reject it.
//   · A <button> nested inside a `role="option"` is also invalid — it pollutes the
//     option's accessible name and puts a second tab stop inside a widget whose
//     whole contract is one tab stop.
//
// `role="tree"` with `role="treeitem"` resolves both: treeitem supports
// `aria-selected` (so the selection semantics §7 wants are intact) AND
// `aria-expanded` (so the disclosure state is announced). A tree is a listbox with
// hierarchy, which is exactly what a coalesced worklist is.
//
// Every treeitem carries an EXPLICIT `aria-label`. Name-from-content on a treeitem
// that contains a nested `role="group"` is not reliably scoped to the item's own
// text, so the label is stated rather than computed.
//
// Expansion is driven by Right/Left arrows and by a click zone on the chevron; the
// chevron itself is aria-hidden because the state lives on the treeitem. Logged as
// design-system-gaps.md row 215.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, Phone, RotateCcw } from "lucide-react";
import { RecordButton } from "@/components/record/record-button";
import { coalesceLabel, itemsOf, paneItemFor, type ListEntry } from "@/lib/tasks/list";
import {
  bandHeaderLabel,
  bandsAreMeaningful,
  bandsFor,
  closedTodayInBand,
  retiredBandLabel,
  type TierBand,
} from "@/lib/tasks/bands";
import { elapsedLabel } from "@/components/tasks/strips";
import { DOMAIN_LABEL, isBreached, type TaskDomain, type TaskItem, type TaskType } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

/** ═══ FIXED ROW GEOMETRY — AND WHY IT IS FIXED ═══
 *
 *  56px per row, 34px per band header. Both are declared here rather than left to
 *  the content, because the virtualizer computes every offset from them: a row
 *  that grew to 57px would put the window one pixel out per row and forty rows
 *  down the list would be selecting the wrong thing.
 *
 *  So the row's height is a CONTRACT, not an outcome. `h-14` is exact rather than
 *  `min-h-14`, and the two-line name/mentor stack is sized to fit inside it
 *  (20 + 16 = 36, plus 10 top and bottom). Adding a third line to a row means
 *  changing this constant, and the compiler will not tell you — the list will
 *  simply drift. */
const ROW_H = 56;
const HEADER_H = 34;

/** Rows rendered beyond each edge of the viewport. Six is enough that ordinary
 *  arrow-key movement never lands on an unmounted row (so focus is immediate) and
 *  small enough that a hundred-row list mounts a dozen nodes rather than a
 *  hundred. */
const OVERSCAN = 6;

/** How long a cleared band's rows take to compress away. The brief's number.
 *  Short enough to read as the list settling, long enough to be seen at all —
 *  under about 120ms a collapse reads as a jump. */
const RETIRE_MS = 160;

/** And how long the retired header stays before it goes. Long enough to read a
 *  seven-word line, and it is the only reason the band lingers at all. */
const RETIRE_HOLD_MS = 2600;

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export type ListState = "ready" | "loading" | "error";

/** TODO-COPY. A CHILD ROW'S TIME, not its age.
 *
 *  Caught in review: the five children of a group all rendered "20h open" and all
 *  carried the SAME accessible label, because a group's members are by definition
 *  minutes apart and the age rounds to hours. Five indistinguishable options in a
 *  tree is a real failure — a screen reader reads the same string five times with
 *  nothing to tell them apart, and a sighted reader cannot tell which one they just
 *  looked at either.
 *
 *  So a child shows the clock time. Age is the useful figure for a parent row
 *  (how long has this been waiting); time-of-day is the useful figure inside a
 *  group (which one is this). Same reasoning the Activity ledger's coalesced
 *  children use. */
function childTimeLabel(openedAt: number): string {
  return new Date(openedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Chips ───────────────────────────────────────────────────────────────────

/** THE ONE BREACH CHIP PATTERN (§3.3), compact form for a row. Icon + text —
 *  never colour alone. */
function OverdueChip() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-[14px]"
      style={{
        backgroundColor: "var(--band-clay-bg)",
        color: "var(--band-clay-fg)",
      }}
    >
      <AlertTriangle className="size-2.5 shrink-0" aria-hidden />
      {/* TODO-COPY */}
      Overdue
    </span>
  );
}

/** 911 / non-911 — a real differentiator between escalation rows. Tonal, NOT
 *  filled red: the alarm budget reserves that for the Respond strip. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-s2)] px-1.5 py-0.5 text-[11px] font-semibold leading-[14px] text-[var(--text-secondary)]">
      {children}
    </span>
  );
}

/** Every differentiator a row carries, in one place so the "no tier chips" rule is
 *  enforced by there being nowhere to put one. */
function RowChips({ entry, now }: { entry: ListEntry; now: number }) {
  const item = paneItemFor(entry);
  const all = itemsOf(entry);
  // A GROUP IS OVERDUE IF ANY MEMBER IS — the row stands for all of them.
  const overdue = all.some((i) => isBreached(i, now));
  const p = item.payload;
  return (
    <>
      {entry.kind === "group" && <Chip>{coalesceLabel(entry.members.length)}</Chip>}
      {overdue && <OverdueChip />}
      {p.kind === "escalation" && (
        <Chip>
          <Phone className="size-2.5 shrink-0" aria-hidden />
          {/* TODO-COPY */}
          {p.is911 ? "911" : "No 911"}
        </Chip>
      )}
      {/* UNREVIEWED / IN-REVIEW. Only the exception speaks: an untouched item says
          nothing, an in-progress one says so. */}
      {item.status === "inProgress" && <Chip>{/* TODO-COPY */}In review</Chip>}
    </>
  );
}

// ── The row ─────────────────────────────────────────────────────────────────

function Row({
  entry,
  now,
  selected,
  expanded,
  optionId,
  tabbable,
  indent,
  flush,
  onSelect,
  onToggle,
  registerRef,
}: {
  entry: ListEntry;
  now: number;
  selected: boolean;
  expanded: boolean;
  optionId: string;
  tabbable: boolean;
  indent?: boolean;
  /** The first row of the whole list with no band header above it — drops the
   *  top hairline so it does not draw against the card's rounded corner. */
  flush?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const item = paneItemFor(entry);
  const isGroup = entry.kind === "group";
  /** TODO-COPY. The full row, spoken — teen, mentor, differentiators, age. */
  const ariaLabel = [
    item.teenDisplayName,
    `to ${item.mentorName}`,
    isGroup ? coalesceLabel(entry.members.length) : null,
    itemsOf(entry).some((i) => isBreached(i, now)) ? "overdue" : null,
    item.payload.kind === "escalation"
      ? item.payload.is911
        ? "911 dispatched"
        : "no 911"
      : null,
    item.status === "inProgress" ? "in review" : null,
    // A CHILD IS IDENTIFIED BY ITS TIME, a parent by its age — see
    // childTimeLabel.
    indent
      ? childTimeLabel(item.openedAt)
      : `${elapsedLabel(item.openedAt, now)} open`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      ref={registerRef}
      id={optionId}
      role="treeitem"
      aria-selected={selected}
      // Supported on treeitem, unlike option — see the module note.
      aria-expanded={isGroup ? expanded : undefined}
      aria-level={indent ? 2 : 1}
      // STATED, NOT COMPUTED: a treeitem containing a nested group does not have
      // reliably-scoped name-from-content.
      aria-label={ariaLabel}
      // ROVING TABINDEX: one tab stop for the whole listbox.
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      style={{ height: ROW_H }}
      className={cn(
        /* EXACT HEIGHT, NOT A MINIMUM — see ROW_H. `border-t` on EVERY row,
           including the first: a band header sits above it and the hairline is
           what separates the two. The old `first:border-t-0` made the first row
           55px while every other row was 56, which the virtualizer would have
           accumulated into a real offset error. */
        "flex cursor-pointer items-center gap-3 border-t border-[color:var(--border-subtle)] px-4 transition-colors",
        flush && "border-t-0",
        // SELECTED AND FOCUSED ARE DISTINCT (§4): selected is a filled ground,
        // focus is the ring. A reader arrowing through a list sees the ring move
        // while the fill stays put.
        selected ? "bg-[var(--surface-s2)]" : "hover:bg-[var(--tint-hover)]",
        indent && "pl-11",
        RING
      )}
    >
      {/* THE DISCLOSURE INDICATOR. aria-hidden — the state is on the option. Its
          own click zone so a pointer reader can expand without selecting. */}
      {isGroup ? (
        <span
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="-ml-1 flex size-6 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]"
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform motion-reduce:transition-none",
              expanded && "rotate-90"
            )}
          />
        </span>
      ) : (
        !indent && <span aria-hidden className="w-5 shrink-0" />
      )}

      {/* AVATAR — teen initial disc. */}
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-s2)] text-[12px] font-semibold text-[var(--text-secondary)]"
      >
        {item.teenDisplayName.charAt(0)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] leading-[20px] text-[var(--text-primary)]">
          {item.teenDisplayName}
        </span>
        {/* `--text-secondary`, NOT `--text-muted` (gap row 294). These rows sit on
            `--surface-s2` (#e5e0d2), the shell canvas, and muted ink measures
            4.01:1 there — under the 4.5 floor for 12px text. This is the exact
            surface flagged when `--muted-foreground` was aliased in gap row 276:
            the alias cleared card (5.30) and s1 (4.82) and could not clear s2.
            `--text-secondary` (#58534b) is 5.78:1 on s2 and is the design
            system's own next step, so nothing is invented. */}
        <span className="block truncate text-[12px] leading-[16px] text-[var(--text-secondary)]">
          {/* TODO-COPY */}
          to {item.mentorName}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <RowChips entry={entry} now={now} />
        {/* AGE IN MONO (§4) — "3h open" on a parent row. Mono so the column
            reads as a column rather than as ragged text. A CHILD shows its clock
            time instead, because inside a group the age is identical on every
            row — see childTimeLabel. */}
        <span
          // `--text-secondary` for the same reason as the line above — s2 is too
          // dark for muted ink at 12px. Gap row 294.
          className="shrink-0 text-[12px] tabular-nums text-[var(--text-secondary)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {/* TODO-COPY */}
          {indent
            ? childTimeLabel(item.openedAt)
            : `${elapsedLabel(item.openedAt, now)} open`}
        </span>
      </span>
    </div>
  );
}

// ── States ──────────────────────────────────────────────────────────────────

/** ═══ SKELETON ROWS FILL THE FRAME, THEY DO NOT COUNT TO FIVE ═══
 *
 *  Five skeleton rows under a forty-row list is a worse signal than none: the
 *  frame is mostly empty, so the load reads as "there are five of these" and then
 *  the list arrives eight times taller and everything below it jumps. The count
 *  comes from the height actually available.
 *
 *  Sized from `ROW_H` so a skeleton row occupies exactly what a real row will —
 *  which is what makes the swap from skeleton to content produce no layout shift
 *  at all. */
function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{ height: ROW_H }}
          className="flex items-center gap-3 border-t border-[color:var(--border-subtle)] px-4 first:border-t-0"
        >
          <span className="w-5 shrink-0" />
          <span className="size-7 shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span
              className="block h-3 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse"
              style={{ maxWidth: `${44 + ((i * 13) % 26)}%` }}
            />
            <span className="block h-2.5 w-24 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          </span>
          <span className="h-3 w-12 shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** PER-DOMAIN ERROR, INLINE, WITH RETRY (§4). Scoped to this tab — the other
 *  three keep their lists, because one domain failing to load is not a reason to
 *  blank the board. Non-blaming, with a next step (Somethings voice). */
function ListError({ domain, onRetry }: { domain: TaskDomain; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="max-w-xs text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {/* TODO-COPY. ONE TEMPLATE STRING, not an expression adjacent to text:
            JSX collapses the newline between `{expr}` and the following literal,
            which rendered "Billingdidn't load". The same trap the person record's
            role line already hit once. */}
        {`${DOMAIN_LABEL[domain]} didn’t load. The other tabs are unaffected — try again.`}
      </p>
      <RecordButton onClick={onRetry}>
        <RotateCcw className="size-3.5" aria-hidden />
        {/* TODO-COPY */}
        Retry
      </RecordButton>
    </div>
  );
}

/** EMPTY TAB (§4). A calm check and a domain-appropriate line.
 *
 *  THE MONITORING EMPTY STATE MUST NOT CELEBRATE. No "Nice work", no exclamation,
 *  no tick-with-a-flourish — an empty monitoring queue means nobody has written
 *  anything worth reading, which is neither an achievement nor a problem. The other
 *  three are allowed to read as relief; this one reads as a fact. */
function EmptyList({ domain }: { domain: TaskDomain }) {
  /* TODO-COPY on all four. */
  const copy: Record<TaskDomain, string> = {
    escalation: "No active escalations.",
    riskFlag: "No open flags.",
    billing: "No billing reviews open.",
    monitoring: "Nothing to monitor right now.",
  };
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-full bg-[var(--surface-s2)] text-[var(--text-muted)]"
      >
        <CalmCheck />
      </span>
      <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {copy[domain]}
      </p>
    </div>
  );
}

/** A thin check. Deliberately not a filled success badge — this is the calm end of
 *  the range, and a green tick is a celebration. */
function CalmCheck() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── The list ────────────────────────────────────────────────────────────────

/** One rendered row — a parent entry or an expanded child. */
interface VisibleRow {
  id: string;
  entry: ListEntry;
  item: TaskItem;
  child: boolean;
}

/** A band plus everything the renderer needs to place it. */
interface Section {
  band: TierBand;
  rows: VisibleRow[];
  /** Absolute y of the band's first row inside the scroller. */
  rowsTop: number;
}

/** A band that has just been cleared and is on its way out. Held in state rather
 *  than derived, because the whole point is that it OUTLIVES the data. */
interface Retiring {
  id: TaskType;
  label: string;
  closedToday: number;
  /** The height its rows occupied, which is what compresses to zero. */
  height: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function Worklist({
  entries,
  items,
  domain,
  now,
  selectedId,
  state,
  onSelect,
  onRetry,
}: {
  entries: ListEntry[];
  /** THE WHOLE DOMAIN'S ITEMS, open and resolved. Needed only by band
   *  retirement, which reports how many of a cleared tier closed today — a fact
   *  that by definition is not in `entries`, since `entries` is the open set. */
  items: TaskItem[];
  domain: TaskDomain;
  now: number;
  /** The selected ENTRY id — a group id for a collapsed group, an item id
   *  otherwise. */
  selectedId: string | null;
  state: ListState;
  onSelect: (entry: ListEntry, item: TaskItem) => void;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  /* ═══ THE VIRTUALIZER'S ONLY STATE ═══
     Where the scroller is and how tall it is. Everything else — which rows mount,
     how tall the spacers are — is computed from these two numbers during render,
     so there is no second copy of the window to fall out of sync. */
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  /** A row the keyboard has moved to that may not be mounted yet. See the layout
   *  effect below — this is what makes selection work ACROSS the window boundary
   *  rather than only inside it. */
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  const bands = useMemo(() => bandsFor(entries), [entries]);
  const showBands = bandsAreMeaningful(bands);

  /* ═══ SECTIONS: THE RENDER ORDER, AND THE KEYBOARD'S ORDER ═══
     Both come from here, and that is deliberate. Bands bucket by first
     appearance, so a band's second run of entries is pulled up to join its first
     — which means the rendered order is NOT the raw `entries` order. Deriving the
     arrow-key sequence from `entries` instead would have produced a list where
     ↓ sometimes jumps two rows up. */
  const sections = useMemo(() => {
    const out: Section[] = [];
    let y = 0;
    for (const band of bands) {
      if (showBands) y += HEADER_H;
      const rows: VisibleRow[] = [];
      for (const entry of band.entries) {
        rows.push({ id: entry.id, entry, item: paneItemFor(entry), child: false });
        if (entry.kind === "group" && expanded.has(entry.id)) {
          for (const m of entry.members) {
            rows.push({
              id: m.id,
              entry: { kind: "item", id: m.id, item: m },
              item: m,
              child: true,
            });
          }
        }
      }
      out.push({ band, rows, rowsTop: y });
      y += rows.length * ROW_H;
    }
    return out;
  }, [bands, showBands, expanded]);

  /** The flattened, visible sequence — what the arrow keys walk. */
  const visible = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  /** Absolute offset per row id, so the keyboard can scroll a row into view
   *  without it being mounted first. */
  const offsets = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sections) {
      s.rows.forEach((r, i) => m.set(r.id, s.rowsTop + i * ROW_H));
    }
    return m;
  }, [sections]);

  const activeIndex = Math.max(
    0,
    visible.findIndex((v) => v.id === selectedId)
  );

  // ── Measuring the scroller ───────────────────────────────────────────────
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const sync = () => setViewport({ top: el.scrollTop, height: el.clientHeight });
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    // The frame is a grid row that resizes with the window; a resize that grows
    // the viewport must mount the rows it just revealed.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [state]);

  /* THE WINDOW. `height || 900` covers the first render, before the effect above
     has measured anything: mounting a screenful is right, mounting zero rows
     would make the first paint empty. */
  const winTop = viewport.top - OVERSCAN * ROW_H;
  const winBottom = viewport.top + (viewport.height || 900) + OVERSCAN * ROW_H;

  // ── Keyboard movement, including across the boundary ─────────────────────

  /** Scroll a row into view by ARITHMETIC, not by `scrollIntoView` — the element
   *  may not exist yet, which is the entire problem virtualization creates for
   *  keyboard users. `HEADER_H` of clearance above, so a row never comes to rest
   *  underneath its own sticky band header. */
  const revealRow = (id: string) => {
    const el = scrollerRef.current;
    const top = offsets.get(id);
    if (!el || top === undefined) return;
    const vh = el.clientHeight;
    const pad = showBands ? HEADER_H : 0;
    let next = el.scrollTop;
    if (top - pad < el.scrollTop) next = Math.max(0, top - pad);
    else if (top + ROW_H > el.scrollTop + vh) next = top + ROW_H - vh;
    if (next === el.scrollTop) return;
    el.scrollTop = next;
    // AND UPDATE STATE IN THE SAME TICK. The scroll event fires asynchronously,
    // so waiting for it would render one frame with the old window — and the row
    // we are about to focus would not be in it.
    setViewport((v) => ({ ...v, top: next }));
  };

  /** Focus the pending row once it exists. Runs again on every window change, so
   *  a row that was outside the window when the key was pressed gets focused the
   *  moment `revealRow`'s scroll brings it in. */
  useLayoutEffect(() => {
    if (!pendingFocus) return;
    const el = refs.current.get(pendingFocus);
    if (!el) return;
    el.focus();
    setPendingFocus(null);
  }, [pendingFocus, viewport, visible]);

  // Collapsing a group whose child is selected would strand the selection on an
  // invisible option. Reselect the group instead.
  useEffect(() => {
    if (!selectedId) return;
    if (visible.some((v) => v.id === selectedId)) return;
    const owner = entries.find(
      (e) => e.kind === "group" && e.members.some((m) => m.id === selectedId)
    );
    if (owner) onSelect(owner, paneItemFor(owner));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedId]);

  const move = (delta: number) => {
    const next = visible[activeIndex + delta];
    if (!next) return;
    onSelect(next.entry, next.item);
    revealRow(next.id);
    setPendingFocus(next.id);
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onKeyDown = (e: React.KeyboardEvent) => {
    // ↑/↓ AND j/k (§4). j/k because this is a queue a supervisor works through
    // repeatedly, and the arrows are a hand-move away from the home row.
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      move(1);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      move(-1);
      return;
    }
    const current = visible[activeIndex];
    if (!current || current.entry.kind !== "group") return;
    // Right/Left expand and collapse — the disclosure's keyboard path, since the
    // chevron is not a focusable button. See the module note.
    if (e.key === "ArrowRight" && !expanded.has(current.id)) {
      e.preventDefault();
      toggle(current.id);
    } else if (e.key === "ArrowLeft" && expanded.has(current.id)) {
      e.preventDefault();
      toggle(current.id);
    }
  };

  // ── Band retirement ──────────────────────────────────────────────────────

  const [retiring, setRetiring] = useState<Retiring[]>([]);
  /** What was on screen last render: each band's task ids and its pixel height.
   *  Both are needed — the ids to prove the band was CLEARED rather than merely
   *  swapped away, the height to know what to compress. */
  const lastSeen = useRef<
    Map<TaskType, { label: string; ids: string[]; height: number; domain: TaskDomain }>
  >(new Map());

  useEffect(() => {
    const next = new Map(lastSeen.current);
    const live = new Set(sections.map((s) => s.band.id));

    for (const [id, prev] of lastSeen.current) {
      if (live.has(id)) continue;
      next.delete(id);
      /* ═══ WHY THIS IS NOT JUST "THE BAND IS GONE" ═══
         A band disappears for three different reasons and only one of them is a
         clearance: the supervisor resolved its last row (retire), they switched
         tabs (do not), or the dev bar swapped the scenario out from under the
         page (do not). Retiring on all three would flash "cleared · 0 today" on
         every tab change, which is both wrong and loud.
         The test is specific: every task the band held must now exist, resolved.
         A tab switch fails it because the ids are absent from this domain's
         items; a scenario swap fails it because the ids do not exist at all. */
      if (prev.domain !== domain) continue;
      const allResolved =
        prev.ids.length > 0 &&
        prev.ids.every((tid) =>
          items.some((it) => it.id === tid && it.status === "resolved")
        );
      if (!allResolved) continue;
      // And nothing to retire INTO an empty list — the whole-tab empty state is a
      // better answer than a header over nothing.
      if (sections.length === 0) continue;
      setRetiring((r) =>
        r.some((x) => x.id === id)
          ? r
          : [
              ...r,
              {
                id,
                label: prev.label,
                closedToday: closedTodayInBand(items, id, now),
                height: prev.height,
              },
            ]
      );
    }

    for (const s of sections) {
      next.set(s.band.id, {
        label: s.band.label,
        ids: s.rows.filter((r) => !r.child).flatMap((r) => itemsOf(r.entry).map((i) => i.id)),
        height: s.rows.length * ROW_H,
        domain,
      });
    }
    lastSeen.current = next;
    // `now` ticks every second and must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, items, domain]);

  // Retired bands leave on their own.
  useEffect(() => {
    if (retiring.length === 0) return;
    const t = window.setTimeout(() => setRetiring((r) => r.slice(1)), RETIRE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [retiring]);

  // ── The frame ────────────────────────────────────────────────────────────

  const frame =
    "overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]";

  if (state === "loading")
    return (
      <div className={cn(frame, "h-full")} ref={scrollerRef}>
        {/* Enough rows to fill whatever height this frame got, so the load does
            not read as a five-item list. */}
        <ListSkeleton rows={Math.max(5, Math.ceil((viewport.height || 560) / ROW_H))} />
        <p className="sr-only" role="status">
          {/* TODO-COPY */}
          Loading {DOMAIN_LABEL[domain]}.
        </p>
      </div>
    );
  if (state === "error")
    return (
      <div className={frame}>
        <ListError domain={domain} onRetry={onRetry} />
      </div>
    );
  if (entries.length === 0 && retiring.length === 0)
    return (
      <div className={frame}>
        <EmptyList domain={domain} />
      </div>
    );

  return (
    <div
      ref={scrollerRef}
      role="tree"
      /* TODO-COPY */
      aria-label={`${DOMAIN_LABEL[domain]} worklist`}
      onKeyDown={onKeyDown}
      /* ═══ THE LIST IS ITS OWN SCROLLER (Part 3) ═══
         It used to sit inside a scrolling column, which was fine at eight rows and
         wrong at fifty: a sticky band header inside a non-scrolling element sticks
         to nothing, so "Imminent — 23" would scroll away and the reader forty rows
         down would have no idea which tier they were in. Moving the scroll here
         gives the headers something to stick to — the card's own top edge. */
      className={cn(frame, "h-full overflow-y-auto overscroll-contain")}
    >
      {sections.map((section, si) => {
        const n = section.rows.length;
        const first = clamp(Math.floor((winTop - section.rowsTop) / ROW_H), 0, n);
        const last = clamp(Math.ceil((winBottom - section.rowsTop) / ROW_H), 0, n);
        return (
          <div
            key={section.band.id}
            /* A `group`, not an `<h3>`: `role="tree"` accepts `treeitem` and
               `group` as children and nothing else, so a heading element here
               would have broken the tree's content model. The band's name and
               count ride on the group's label instead, which is also how a
               screen reader announces it — "Imminent — 23, group". */
            role="group"
            aria-label={bandHeaderLabel(section.band)}
          >
            {showBands && <BandHeader band={section.band} />}
            {/* SPACERS, NOT RENDERED ROWS. Two divs stand in for everything
                outside the window, which is what keeps a hundred-row list at a
                dozen mounted nodes. */}
            {first > 0 && <div aria-hidden style={{ height: first * ROW_H }} />}
            {section.rows.slice(first, last).map((v, k) => (
              <Row
                key={v.id}
                entry={v.entry}
                now={now}
                optionId={`task-option-${v.id}`}
                selected={v.id === selectedId}
                expanded={expanded.has(v.id)}
                tabbable={visible[activeIndex]?.id === v.id}
                indent={v.child}
                // The very first row of the whole list, with no header above it,
                // would otherwise draw a hairline against the card's rounded top
                // edge.
                flush={!showBands && si === 0 && first + k === 0}
                onSelect={() => onSelect(v.entry, v.item)}
                onToggle={
                  v.entry.kind === "group" ? () => toggle(v.entry.id) : undefined
                }
                registerRef={(el) => {
                  if (el) refs.current.set(v.id, el);
                  else refs.current.delete(v.id);
                }}
              />
            ))}
            {last < n && <div aria-hidden style={{ height: (n - last) * ROW_H }} />}
          </div>
        );
      })}

      {retiring.map((r) => (
        <RetiredBand key={r.id} band={r} />
      ))}
    </div>
  );
}

/** THE STICKY BAND HEADER. Quiet by construction: muted ink, no fill beyond the
 *  card's own, no rule of its own — the first row's hairline already separates it.
 *  It is a wayfinding label, not a section title competing with the rows. */
function BandHeader({ band }: { band: TierBand }) {
  return (
    <div
      aria-hidden
      style={{ height: HEADER_H }}
      /* SENTENCE CASE, for the same reasons the pane's field labels dropped
         theirs — and more so here, because this label's ENTIRE JOB is to be
         scanned. All caps strips the ascenders and descenders that make
         "Imminent" recognisable in peripheral vision, which is exactly how a
         reader forty rows down uses it.
         `--type-field-label`, not a hand-rolled size: the token exists, this is
         the stop it names, and its weight is 400 because TWKLausanne-700 is not
         shipped — a `font-semibold` here would be a synthesised faux bold. */
      className="sticky top-0 z-10 flex items-center bg-[var(--surface-card)] px-4 [font:var(--type-field-label)] [letter-spacing:var(--type-field-label-tracking)] text-[var(--text-muted)]"
    >
      {/* `tabular-nums` — the counts tick down as a supervisor works, and
          proportional figures would shift the whole line each time. */}
      <span className="tabular-nums">{bandHeaderLabel(band)}</span>
    </div>
  );
}

/** ═══ A BAND ON ITS WAY OUT ═══
 *
 *  Mounts at the height its rows occupied and compresses to zero, so the list
 *  settles rather than jumps. The header stays for a beat and reports the
 *  clearance as a fact — see `retiredBandLabel` for why it does not celebrate.
 *
 *  `motion-reduce:transition-none` is not decoration: a 160ms height collapse is
 *  exactly the kind of unrequested movement `prefers-reduced-motion` exists to
 *  suppress, and with it the band simply appears cleared and then goes. */
function RetiredBand({ band }: { band: Retiring }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // A frame later, so the browser has a start value to animate FROM. Setting
    // both heights in one commit animates nothing.
    const id = requestAnimationFrame(() => setCollapsed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div role="group" aria-label={retiredBandLabel(band.label, band.closedToday)}>
      <div
        aria-hidden
        style={{ height: HEADER_H }}
        /* SENTENCE CASE, for the same reasons the pane's field labels dropped
         theirs — and more so here, because this label's ENTIRE JOB is to be
         scanned. All caps strips the ascenders and descenders that make
         "Imminent" recognisable in peripheral vision, which is exactly how a
         reader forty rows down uses it.
         `--type-field-label`, not a hand-rolled size: the token exists, this is
         the stop it names, and its weight is 400 because TWKLausanne-700 is not
         shipped — a `font-semibold` here would be a synthesised faux bold. */
      className="sticky top-0 z-10 flex items-center bg-[var(--surface-card)] px-4 [font:var(--type-field-label)] [letter-spacing:var(--type-field-label-tracking)] text-[var(--text-muted)]"
      >
        <span className="tabular-nums">
          {retiredBandLabel(band.label, band.closedToday)}
        </span>
      </div>
      <div
        aria-hidden
        style={{
          height: collapsed ? 0 : band.height,
          transitionDuration: `${RETIRE_MS}ms`,
        }}
        className="overflow-hidden transition-[height] ease-out motion-reduce:transition-none"
      />
    </div>
  );
}
