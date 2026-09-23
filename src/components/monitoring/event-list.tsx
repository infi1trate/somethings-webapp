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
import { WorklistGroupHeader } from "@/components/tasks/group-header";
import { elapsedLabel } from "@/components/tasks/strips";
import { discFor } from "@/lib/tasks/avatar";
import {
  EVENT_KIND_LABEL,
  SUBJECT_LABEL,
  type EventGroup,
  type MonitoringEvent,
  type ReviewSubject,
} from "@/lib/monitoring/event";
import { FLAG_PATTERN_MIN } from "@/lib/monitoring/constants";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** NEEDS-COPY-NICOLE. Age, from the event's own moment — the flagged message for
 *  a flag, the breach for a practice event. "2h ago", never "due in". */
/** ═══ ONLY A FLAG'S CATEGORY IS A PLAYBOOK ID ═══
 *
 *  `MonitoringEvent.category` is documented as two things: "the classifier's
 *  category for a flag; THE RULE'S OWN NAME for practice". Phase 4 mapped every
 *  event's category through `riskCategoryLabel`, which is right for the first and
 *  wrong for the second — measured on `/app/mentor-practice`, every practice row
 *  read "Category not recognised", because a rule name is correctly not in the
 *  risk playbook.
 *
 *  The lookup is therefore gated on the KIND, not on whether the lookup happens
 *  to succeed. A `?? e.category` fallback would have hidden this: practice rows
 *  would have rendered fine and a genuinely unrecognised FLAG category would
 *  have leaked its raw id, which is the defect the mapping exists to prevent. */
function categoryTextFor(e: MonitoringEvent): string {
  if (e.category == null) return EVENT_KIND_LABEL[e.kind];
  return e.kind === "riskFlag" ? riskCategoryLabel(e.category) : e.category;
}

export function ageLabel(at: number, now: number): string {
  return `${elapsedLabel(at, now)} ago`;
}

/** ═══ THE SUBJECT OF REVIEW COMES FIRST, AND THAT IS THE DISAMBIGUATION ═══
 *  "Naomi R. to Maria Lopez" left a reader to work out which name was the teen.
 *  On a teen-safety row the teen is the subject and leads; on a mentor-practice
 *  row the mentor is. The group header above states which kind of row this is,
 *  so the leading name's role is never in question — and the accessible name
 *  spells both roles out regardless. */
function rowNames(e: MonitoringEvent): { lead: string; counterpart: string | null } {
  if (e.subject === "mentorPractice") {
    return { lead: e.mentorName, counterpart: e.teenName };
  }
  return { lead: e.teenName ?? e.mentorName, counterpart: e.mentorName };
}

function ariaFor(e: MonitoringEvent, now: number, groupLabel: string): string {
  const parts = [
    groupLabel,
    e.subject === "mentorPractice"
      ? `mentor ${e.mentorName}`
      : `teen ${e.teenName ?? "unknown"}`,
    e.subject === "mentorPractice"
      ? e.teenName
        ? `teen ${e.teenName}`
        : null
      : `mentor ${e.mentorName}`,
    e.category ? categoryTextFor(e) : null,
    e.practice?.measure ?? null,
    e.escalationOpen ? "escalation open for this teen" : null,
    e.patternCount >= FLAG_PATTERN_MIN ? `${e.patternCount} flags in this conversation` : null,
    !e.mentorReplied && e.subject === "teenSafety" ? "no mentor reply" : null,
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
  groupLabel,
  selected,
  active,
  onSelect,
}: {
  event: MonitoringEvent;
  now: number;
  groupLabel: string;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const { lead, counterpart } = rowNames(e);
  const disc = discFor(e.subject === "mentorPractice" ? e.mentorId : (e.teenId ?? e.mentorId));
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
      data-event-subject={e.subject}
      onClick={onSelect}
      onKeyDown={(ev) => {
        if (ev.key === " " || ev.key === "Enter") {
          ev.preventDefault();
          onSelect();
        }
      }}
      aria-label={ariaFor(e, now, groupLabel)}
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
          <span className="truncate">
            {e.category ? categoryTextFor(e) : EVENT_KIND_LABEL[e.kind]}
          </span>
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
        {!e.mentorReplied && e.subject === "teenSafety" && (
          <Marker icon={MessageSquareOff}>No reply</Marker>
        )}
      </span>
    </div>
  );
}

/** ═══ THE SUBJECT FILTER — CHIPS, ONE QUEUE ═══
 *  Not tabs and not a second structure: these narrow one list that keeps its
 *  order, its groups and its selection. Same contract as Tasks' kind filter
 *  (`kind-filter.tsx`): `role="group"` with `aria-pressed`, deliberately not a
 *  tablist, and hidden entirely below two subjects. */
export const ALL_SUBJECTS = "__all__";

export function SubjectFilter({
  present,
  value,
  onChange,
}: {
  present: ReviewSubject[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (present.length < 2) return null;
  const chips = [
    { id: ALL_SUBJECTS, label: "All" },
    ...present.map((s) => ({ id: s, label: SUBJECT_LABEL[s] })),
  ];
  return (
    <div
      role="group"
      /* NEEDS-COPY-NICOLE */
      aria-label="Filter by review subject"
      className="mt-3 flex shrink-0 flex-wrap items-center gap-1.5"
    >
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "inline-flex min-h-8 items-center rounded-full border px-3 text-[12.5px] font-semibold",
            value === c.id
              ? "border-[color:var(--border-contour)] bg-[var(--surface-s2)] text-[var(--text-primary)]"
              : "border-[color:var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
            RING
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function EventList({
  groups,
  now,
  selectedId,
  onSelect,
  emptyLine,
}: {
  groups: EventGroup[];
  now: number;
  selectedId: string | null;
  onSelect: (e: MonitoringEvent) => void;
  /** NEEDS-COPY-NICOLE. What an empty queue says — and it never says "you're
   *  done", because coverage is the floor and the queue emptying is weather. */
  emptyLine: string;
}) {
  const flat = groups.flatMap((g) => g.events.map((e) => ({ e, label: g.label })));
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
    onSelect(flat[next].e);
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
      {groups.map((g) => (
        /* THE COUNT IS IN THE ACCESSIBLE NAME, not only in the visible header —
           the header is `aria-hidden`, so without this a screen-reader user
           entering the group hears "Teen safety" and has no idea whether it holds
           three rows or sixty. Tasks' bands already read "Due today — 2"; the two
           surfaces now say it the same way. */
        <div
          key={g.subject}
          role="group"
          aria-label={`${g.label} — ${g.events.length}`}
          className="min-w-0"
        >
          {/* THE SHARED HEADER COMPONENT — one treatment for every group header
              on every supervisor surface, which is what arch-D settled. The
              header is also the only place the noun phrase lives. It is
              `aria-hidden`, and the group's `aria-label` is what a screen reader
              gets instead. */}
          <WorklistGroupHeader label={g.label} count={g.events.length} />
          <div className="min-w-0">
            {g.events.map((e) => {
              const i = flat.findIndex((f) => f.e.id === e.id);
              return (
                <Row
                  key={e.id}
                  event={e}
                  now={now}
                  groupLabel={g.label}
                  selected={selectedId === e.id}
                  active={i === idx}
                  onSelect={() => {
                    setActiveIdx(i);
                    onSelect(e);
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
