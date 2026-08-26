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

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, Phone, RotateCcw } from "lucide-react";
import { RecordButton } from "@/components/record/record-button";
import { coalesceLabel, itemsOf, paneItemFor, type ListEntry } from "@/lib/tasks/list";
import { elapsedLabel } from "@/components/tasks/strips";
import { DOMAIN_LABEL, isBreached, type TaskDomain, type TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

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
      className={cn(
        "flex cursor-pointer items-center gap-3 border-t border-[color:var(--border-subtle)] px-4 py-2.5 transition-colors first:border-t-0",
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
        <span className="block truncate text-[12px] leading-[16px] text-[var(--text-muted)]">
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
          className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]"
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

function ListSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-t border-[color:var(--border-subtle)] px-4 py-3 first:border-t-0"
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

export function Worklist({
  entries,
  domain,
  now,
  selectedId,
  state,
  onSelect,
  onRetry,
}: {
  entries: ListEntry[];
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

  /** THE FLATTENED, VISIBLE OPTION SEQUENCE — what the arrow keys walk. A group's
   *  children are in it only while the group is expanded, which is what makes
   *  ↑/↓ match what a reader can see. */
  const visible = useMemo(() => {
    const out: Array<{ id: string; entry: ListEntry; item: TaskItem; child: boolean }> = [];
    for (const entry of entries) {
      out.push({ id: entry.id, entry, item: paneItemFor(entry), child: false });
      if (entry.kind === "group" && expanded.has(entry.id)) {
        for (const m of entry.members) {
          out.push({ id: m.id, entry: { kind: "item", id: m.id, item: m }, item: m, child: true });
        }
      }
    }
    return out;
  }, [entries, expanded]);

  const activeIndex = Math.max(
    0,
    visible.findIndex((v) => v.id === selectedId)
  );

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
    refs.current.get(next.id)?.focus();
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

  const frame =
    "overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]";

  if (state === "loading")
    return (
      <div className={frame}>
        <ListSkeleton />
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
  if (entries.length === 0)
    return (
      <div className={frame}>
        <EmptyList domain={domain} />
      </div>
    );

  return (
    <div
      role="tree"
      /* TODO-COPY */
      aria-label={`${DOMAIN_LABEL[domain]} worklist`}
      onKeyDown={onKeyDown}
      className={frame}
    >
      {visible.map((v, i) => (
        <Row
          key={v.id}
          entry={v.entry}
          now={now}
          optionId={`task-option-${v.id}`}
          selected={v.id === selectedId}
          expanded={expanded.has(v.id)}
          tabbable={i === activeIndex}
          indent={v.child}
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
    </div>
  );
}
