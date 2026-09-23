"use client";

// ═══ THE EVENT QUEUE ═══
//
// ═══ WHY THIS IS NOT `Worklist` ═══
//
// Monitoring rendered Tasks' `Worklist` with a `domain={null}` escape hatch, and
// after this phase the two surfaces share nothing that list encodes: no tiers, no
// deadlines, no breach, no coalesced groups, a different row anatomy, a second
// review subject, and one comparator of its own. Bending `Worklist` to a fifth
// axis would have meant every future Tasks change reasoning about a surface that
// no longer resembles it.
//
// THE COST, NAMED: this is a second list implementation, and a second list is
// how silent per-screen forks start. What it does NOT duplicate is the part
// worth sharing — the group header component, the chips, the identity disc and
// the excerpt all still come from one place. What it deliberately does not
// inherit is `Worklist`'s virtualizer, and the reason has been RE-MEASURED
// because Phase 10 invalidated the old one.
//
// ═══ THE PREMISE MOVED, AND THE DECISION DID NOT ═══
//
// This said "at the measured ceiling (64 rows on `surge`) a plain list costs
// nothing". Phase 10 raised `surge` from 64 to 420 — the production audit asked
// for 400+ — which made that sentence false, and a decision resting on a stale
// measurement is indistinguishable from one nobody checked.
//
// RE-MEASURED AT THE NEW CEILING, xl, every row mounted:
//
//    420 rows -> 7,721 DOM nodes -> 1.0ms for ten forced layouts
//    123 rows -> 2,636 DOM nodes -> 0.2ms   (the unscoped default)
//     12 rows ->   703 DOM nodes -> 0.1ms
//
// So a plain list still costs nothing at four hundred rows, and the trade stands
// for the original reason: the virtualizer's invariants — ROW_H exact, spacer
// arithmetic — are the most fragile thing in that file, and inheriting them to
// save a millisecond would be buying fragility with no return.
//
// WHAT WOULD CHANGE IT is a row whose height is not fixed, or a fixture past a
// few thousand rows. The number to beat is in this comment.
//
// ═══ ONE EMPHASISED ELEMENT PER ROW ═══
// The subject of review, in the display face. Age is mono and tabular and does
// not take the weight channel — the same rule arch-D and arch-E settled for
// Tasks, applied to a different anatomy.

import { riskCategoryLabel } from "@/lib/record/risk-taxonomy";
import { useEffect, useRef, useState } from "react";
import { MessageSquareOff, Repeat2, ShieldAlert } from "lucide-react";
import { elapsedLabel } from "@/components/tasks/strips";
import { discFor } from "@/lib/tasks/avatar";
import { type MonitoringEvent } from "@/lib/monitoring/event";
import { FLAG_PATTERN_MIN } from "@/lib/monitoring/constants";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ THE CATEGORY IS ALWAYS A PLAYBOOK ID NOW (addendum §2.1) ═══
 *
 *  It used to be two things — "the classifier's category for a flag, THE RULE'S
 *  OWN NAME for practice" — and Phase 4 mapped both through `riskCategoryLabel`,
 *  which is right for the first and wrong for the second: measured on
 *  `/app/mentor-practice`, every practice row read "Category not recognised",
 *  because a rule name is correctly not in the risk playbook. With one event
 *  kind there is one producer and the gate is gone.
 *
 *  NO `?? e.category` FALLBACK, then or now. That is what would have hidden the
 *  original defect, and what would let an unrecognised playbook id leak its raw
 *  enum onto the row — which is the whole reason the mapping exists. */
function categoryTextFor(e: MonitoringEvent): string {
  /* NEEDS-COPY-NICOLE. A flag with no category at all is a classifier that
     produced no answer, which is a different statement from one this playbook
     does not know — and `riskCategoryLabel` already owns the second. */
  if (e.category == null) return "Category not recorded";
  return riskCategoryLabel(e.category);
}

export function ageLabel(at: number, now: number): string {
  return `${elapsedLabel(at, now)} ago`;
}

/** ═══ THE TEEN LEADS, AND THAT IS THE DISAMBIGUATION ═══
 *  "Naomi R. to Maria Lopez" left a reader to work out which name was the teen,
 *  in the one state where identifying the teen instantly matters most. The teen
 *  is the subject of every row on this surface, so the teen leads and the
 *  accessible name spells both roles out regardless.
 *
 *  IT BRANCHED ON SUBJECT until §2.1 — a mentor-practice row led with the
 *  mentor. One subject, one rule. */
function ariaFor(e: MonitoringEvent, now: number): string {
  const parts = [
    `teen ${e.teenName}`,
    `mentor ${e.mentorName}`,
    categoryTextFor(e),
    e.escalationOpen ? "escalation open for this teen" : null,
    e.patternCount >= FLAG_PATTERN_MIN ? `${e.patternCount} flags in this conversation` : null,
    !e.mentorReplied ? "no mentor reply" : null,
    ageLabel(e.at, now),
  ];
  return parts.filter(Boolean).join(", ");
}

/** The quiet markers. NONE of these is breach treatment — that belongs to
 *  escalation obligations alone now — and none carries colour alone: each is a
 *  glyph plus words. */
function Marker({ icon: Icon, children }: { icon: typeof Repeat2; children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-s1)] px-2 py-0.5 text-[11px] leading-[14px] text-[var(--text-secondary)]">
      <Icon className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

function Row({
  event: e,
  now,
  selected,
  active,
  onSelect,
}: {
  event: MonitoringEvent;
  now: number;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const lead = e.teenName;
  const counterpart = e.mentorName;
  const disc = discFor(e.teenId);
  return (
    <div
      /* ═══ TREE / GROUP / TREEITEM, AND NOT LISTBOX / OPTION ═══
         The first build nested `ul[role=listbox] > li > ul[role=group] > li[role=option]`
         and axe returned 600 violations across eight runs: a listbox's children
         must be options or groups, the role-less `li` between them broke the
         parentage for every row, and the bare `li`s failed `listitem` too. This
         is the structure `worklist.tsx` already settled on for the same reason —
         a tree permits groups, a group permits treeitems, and none of it needs a
         `ul`. MEASURED: 600 → 0. */
      role="treeitem"
      aria-selected={selected}
      tabIndex={active ? 0 : -1}
      data-anno-ref={`event-row:${e.id}`}
      onClick={onSelect}
      onKeyDown={(ev) => {
        if (ev.key === " " || ev.key === "Enter") {
          ev.preventDefault();
          onSelect();
        }
      }}
      aria-label={ariaFor(e, now)}
      className={cn(
        "flex h-14 cursor-pointer items-center gap-3 px-3",
        "border-t border-[color:var(--border-subtle)] first:border-t-0",
        selected ? "bg-[var(--surface-s2)]" : "hover:bg-[var(--tint-hover)]",
        RING
      )}
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
        style={{ backgroundColor: disc.bg, color: disc.fg }}
      >
        {lead.charAt(0)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          {/* THE ONE EMPHASISED ELEMENT. */}
          <span className="truncate font-display text-[14px] leading-[20px] text-[var(--text-primary)]">
            {lead}
          </span>
          {counterpart && (
            <>
              <span aria-hidden className="shrink-0 text-[12px] text-[var(--text-muted)]">
                ↔
              </span>
              <span className="truncate text-[13px] leading-[18px] text-[var(--text-secondary)]">
                {counterpart}
              </span>
            </>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-[16px] text-[var(--text-secondary)]">
          {/* CATEGORY, THEN AGE. No repeated noun phrase: the header says what
              these are, so the row never says "flag" again. */}
          <span className="truncate">{categoryTextFor(e)}</span>
          <span aria-hidden className="shrink-0 opacity-40">·</span>
          <span
            className="shrink-0 tabular-nums"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {ageLabel(e.at, now)}
          </span>
        </span>
      </span>
      {/* WHAT THE COMPARATOR ACTED ON, SAID OUT LOUD. A queue whose order cannot
          be explained from the rows is a queue a supervisor learns to distrust. */}
      <span className="flex shrink-0 items-center gap-1.5">
        {e.escalationOpen && <Marker icon={ShieldAlert}>Escalation open</Marker>}
        {e.patternCount >= FLAG_PATTERN_MIN && (
          <Marker icon={Repeat2}>{e.patternCount} in this conversation</Marker>
        )}
        {!e.mentorReplied && <Marker icon={MessageSquareOff}>No reply</Marker>}
      </span>
    </div>
  );
}

/* ═══ THE SUBJECT FILTER IS GONE (addendum §2.1) ═══
 *
 *  It narrowed one queue to teen safety or mentor practice, with `All` as the
 *  default and the whole row hidden below two subjects. With Mentor Practice
 *  removed there is one subject, so the control could only ever have offered
 *  one choice — and `AGENTS.md` settled that case explicitly: a single filter
 *  offering no choice is dead chrome, which is the same reasoning that removed
 *  the one-tab row in arch-A.
 *
 *  THE `present.length < 2` GUARD MEANT IT ALREADY RENDERED NOTHING, so this
 *  deletion changes no pixel. It is here because a hidden control that can never
 *  un-hide is worse than no control: the next reader has to work out that the
 *  condition is now unsatisfiable. If a second review subject ever lands, the
 *  chip pattern is `kind-filter.tsx`, which is where it was copied from. */

export function EventList({
  events,
  now,
  selectedId,
  onSelect,
  emptyLine,
}: {
  events: MonitoringEvent[];
  now: number;
  selectedId: string | null;
  onSelect: (e: MonitoringEvent) => void;
  /** NEEDS-COPY-NICOLE. What an empty queue says — and it never says "you're
   *  done", because coverage is the floor and the queue emptying is weather. */
  emptyLine: string;
}) {
  /* ═══ NO GROUP LAYER, AND NO GROUP HEADER (addendum §2.1, §3.1) ═══
     The list was grouped by review subject, and with one subject the header read
     "Teen safety — 9" over every row on a page titled Risk Flags: the same noun
     twice and a count that, per §3.1, was counting the wrong unit anyway. The
     count moved to the page header's metric pair, which is where §2.10 puts it,
     and stating it in both places would be the clock told twice. */
  const flat = events;
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  /** Keep the roving stop inside the list when it shrinks under the reader —
   *  derived per render rather than reset in an effect (the compiler's purity
   *  rule rejects the effect, and a clamped read is simpler than a write). */
  const idx = Math.min(activeIdx, Math.max(0, flat.length - 1));

  useEffect(() => {
    /* MOVE FOCUS ONLY IF FOCUS IS ALREADY IN THE LIST. Otherwise arrowing in the
       coverage view or typing in the pane would yank focus back here. */
    const el = listRef.current;
    if (!el) return;
    if (!el.contains(document.activeElement)) return;
    const row = el.querySelectorAll<HTMLElement>('[role="treeitem"]')[idx];
    row?.focus();
  }, [idx]);

  if (flat.length === 0) {
    return (
      <p className="px-3 py-6 text-[13.5px] leading-[19px] text-[var(--text-secondary)]">
        {emptyLine}
      </p>
    );
  }

  const move = (d: number) => {
    const next = Math.max(0, Math.min(flat.length - 1, idx + d));
    setActiveIdx(next);
    onSelect(flat[next]);
  };

  return (
    <div
      ref={listRef}
      role="tree"
      /* NEEDS-COPY-NICOLE */
      aria-label="Events for review"
      className="min-w-0"
      onKeyDown={(ev) => {
        // ↑/↓ and j/k, the same contract Tasks' list has — a supervisor moves
        // between the two surfaces and the keys must not change meaning.
        if (ev.key === "ArrowDown" || ev.key === "j") {
          ev.preventDefault();
          move(1);
        } else if (ev.key === "ArrowUp" || ev.key === "k") {
          ev.preventDefault();
          move(-1);
        }
      }}
    >
      {flat.map((e, i) => (
        <Row
          key={e.id}
          event={e}
          now={now}
          selected={selectedId === e.id}
          active={i === idx}
          onSelect={() => {
            setActiveIdx(i);
            onSelect(e);
          }}
        />
      ))}
    </div>
  );
}
