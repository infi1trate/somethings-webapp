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
import {
  isRepeatPattern,
  type FlagGroup,
} from "@/lib/monitoring/flag-group";
import {
  ROW_GEOMETRY,
  type ViewPreset,
} from "@/lib/ui/view-options";
import { cn } from "@/lib/utils";

/* The row's focus ring is a `group-focus-visible:ring` on the pill now, so it
   traces the same inset rounded box the selection fill does — see the row
   note. The outline constant is gone rather than left unused, because an
   unused focus constant in a list file is an invitation to put the outline
   back. */

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
function ariaFor(g: FlagGroup, now: number): string {
  const parts = [
    `teen ${g.teenName}`,
    `mentor ${g.mentorName}`,
    categoryTextFor(g.events[0]),
    /* ═══ THE COUNT IS IN THE ACCESSIBLE NAME WHENEVER IT IS MORE THAN ONE ═══
       The visible marker only appears at `FLAG_PATTERN_MIN`, because below that
       it is not a pattern. But a row standing for two flags is standing for two
       flags whether or not that is a pattern, and a screen-reader user choosing
       between rows needs to know the row is a set before they open it. */
    g.events.length > 1 ? `${g.events.length} flags in this conversation` : null,
    g.escalationOpen ? "escalation open for this teen" : null,
    g.anyUnanswered ? "no mentor reply" : null,
    ageLabel(g.oldestAt, now),
  ];
  return parts.filter(Boolean).join(", ");
}

/** The quiet markers. NONE of these is breach treatment — that belongs to
 *  escalation obligations alone now — and none carries colour alone: each is a
 *  glyph plus words. */
/** ═══ THE NARROW TIER: A CANVAS UNDER 588 ═══
 *  Read off the canvas (`@container/canvas`), so a phone and a desktop with
 *  Support open (1024 → a 336 canvas) take the same row — the same tier Care
 *  Reviews has (`ROW_NARROW_CANVAS`, 496), at this row's own number.
 *
 *  WHY 588. The widest fixture row, every line whole, is the row inset 48 +
 *  disc 36 + two gaps 24 + `Assessment scores below threshold` 194 + its
 *  trailing furniture 236 (inset 24 + `2 in this conversation` 146 + 6 + the
 *  age's 60 floor) = 538. Plus the card border 2 and page gutters 48 is 588,
 *  on the 4px step. Checked across the default, repeat-pattern, no-reply,
 *  in-escalation and false-positive scenarios; MEASURED at a 548 canvas, that
 *  row's category rendered 154 of its 194px — so the floor is the arithmetic,
 *  not the browser's min-content, which reported 495 for the same row.
 *  WHAT IT DOES NOT COVER, stated: no fixture row carries two markers. All
 *  three in words are 451 of trailing furniture and would need an 803 canvas,
 *  so a row like that compresses its mentor and category, then scrolls inside
 *  its card, between 588 and 803. Taking 803 as the tier would put glyphs on a
 *  1024 desktop with Support closed (a 760 canvas) for a row no data produces.
 *
 *  BELOW IT: the disc hides, the age and the markers stack, and the markers
 *  become glyphs — see each site. */
export const FLAG_ROW_NARROW_CANVAS = 588;

/* ═══ NARROW (`FLAG_ROW_NARROW_CANVAS`): THE GLYPH, AND `short` ═══
   MEASURED: the three markers in words are 118.5, 146 and 77.6 wide, and at a 320
   phone the row has 222 inside its inset — one marker in words and the age
   already leave the names 0. So below the tier each marker is its glyph, plus
   `short` where the words carry a number (`3` for the repeat count).
   JUDGMENT, AND ITS COST: a glyph is a weaker statement than a phrase. What
   keeps it honest is that nothing is lost to assistive tech — the row's name
   is STATED (`ariaFor`) and says all three in words — and that the glyphs are
   distinct shapes, not colours (SC 1.4.1). The words come back above the
   tier and are always in the pane. */
function Marker({
  icon: Icon,
  short,
  children,
}: {
  icon: typeof Repeat2;
  short?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-s1)] px-2 py-0.5 text-[12px] leading-[16px] text-[var(--text-secondary)]">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="@max-[588px]/canvas:hidden">{children}</span>
      {short != null && <span className="hidden tabular-nums @max-[588px]/canvas:inline">{short}</span>}
    </span>
  );
}

/** ═══ THE ROW IS THREE LAYERS, AND THAT IS WHAT MAKES §3 POSSIBLE ═══
 *
 *  §3 asks for two things that fight each other in a one-element row:
 *
 *   · "Selection becomes an inset rounded pill with margin on all four sides."
 *   · "Separators inset — start after the avatar, stop before the trailing
 *     metadata."
 *
 *  A `border-t` on the row root cannot be inset horizontally, and a border on
 *  an inner element renders at that element's top rather than at the row
 *  boundary — so put it on a child that is FULL HEIGHT and the two stop
 *  competing:
 *
 *    root      height = ROW_H exactly, `relative`     ← the virtualizer's box
 *    ├ pill    absolute, inset-x-2 inset-y-1          ← fill, hover, focus ring
 *    └ content flex, h-full, items-stretch            ← the row as read
 *        ├ disc          shrink-0, centred
 *        ├ text column   flex-1, `border-t`, h-full   ← THE SEPARATOR
 *        └ trailing      shrink-0, pl-6
 *
 *  ═══ AND THE DIVIDER REVERSED (Refinement §1.2) ═══
 *
 *  It was the text column's top border, inset to start after the disc and stop
 *  before the trailing block. MEASURED on this surface: the marker chips are
 *  wide, so the line stopped 272px short of the row's right edge and the age
 *  hung past a ragged edge — which reads as a rendering fault rather than as
 *  intent. §1.2 reverses it, and the inset selection pill stays: the pill was
 *  doing the work of making rows read as regions and the divider inset was
 *  redundant.
 *  IT IS ON THE PADDING BOX, so the line runs 24px to 24px symmetrically and
 *  never bleeds to the panel edge. A border on the padded parent would span
 *  its border box — the pill's own edges — which is a different line.
 *  IT NEVER CROSSES A PILL: it sits at y=0 of the content region and the pill
 *  starts at y=4, so it falls in the gutter between two pills.
 *  NOT UNDER `Cards`, where each row carries its own contour.
 *
 *  THE ROOT'S HEIGHT IS STILL EXACT. `h-full` everywhere inside it means the
 *  taller row costs the same invariant the old one had, which is what let this
 *  become a preset axis rather than a rewrite. */
function Row({
  group: g,
  now,
  preset,
  hairline,
  selected,
  active,
  onSelect,
}: {
  group: FlagGroup;
  now: number;
  preset: ViewPreset;
  /** False on the first row only — a hairline at the top of the card's inner
   *  edge is a line against the card's own border, two hairlines 1px apart. */
  hairline: boolean;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const disc = discFor(g.teenId);
  const n = g.events.length;
  const geo = ROW_GEOMETRY[preset];
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
      /* THE CONVERSATION IS THE ROW'S IDENTITY, not the flag. A row survives
         its members being resolved one at a time. */
      data-anno-ref={`event-row:${g.id}`}
      data-flag-count={n}
      data-preset={preset}
      onClick={onSelect}
      onKeyDown={(ev) => {
        if (ev.key === " " || ev.key === "Enter") {
          ev.preventDefault();
          onSelect();
        }
      }}
      aria-label={ariaFor(g, now)}
      /* THE ROW BOX IS THE PITCH — `Cards` carries its gutter inside the box,
         because a margin is not in the virtualizer's offset arithmetic. */
      style={{ height: geo.pitch }}
      /* THE RING IS ON THE PILL, so it traces the inset shape rather than a
         full-bleed rectangle. `outline-none` here stops the root drawing a
         second one around the whole row. */
      className="group relative cursor-pointer outline-none"
    >
      {/* ═══ THE PILL — FILL, HOVER AND FOCUS, ALL INSET ═══
          One element for all three states so they cannot disagree about the
          shape. `inset-x-2 inset-y-1` is §3's "margin on all four sides": 8px
          horizontal, 4px vertical, which puts an 8px gutter between adjacent
          pills without the vertical cost of detached cards — the thing §3
          rules out by name, because on a 123-item queue card gaps roughly
          halve items per screen. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-2 rounded-[var(--radius-inset)] transition-colors",
          "group-focus-visible:ring-2 group-focus-visible:ring-[color:var(--focus-ring)]",
          geo.detached && "border border-[color:var(--border-contour)]",
          selected
            ? "bg-[var(--surface-s2)]"
            : cn(
                geo.detached && "bg-[var(--surface-card)]",
                "group-hover:bg-[var(--tint-hover)]"
              )
        )}
        style={{
          top: geo.detached ? 0 : 4,
          height: geo.detached ? geo.height : geo.height - 8,
        }}
      />
      <div
        /* THE CONTENT REGION IS THE CARD'S HEIGHT, not the row box's, so under
           `Cards` the content centres in the panel and the gutter stays empty.
           px-6 = 8px of card track plus 16px of row padding. */
        style={{ height: geo.height }}
        className="relative px-6"
      >
      {/* THE DIVIDER — see the component note on the reversal. */}
      <div
        className={cn(
          "flex h-full items-stretch gap-3",
          hairline && !geo.detached && "border-t border-[color:var(--border-subtle)]"
        )}
      >
        {/* NARROW: the disc hides, as on Care Reviews — it restates the first
            letter of the name beside it, and the 48px is the names'. */}
        <span className="flex shrink-0 items-center @max-[588px]/canvas:hidden">
          <span
            aria-hidden
            className="flex items-center justify-center rounded-full text-[12px] font-semibold"
            style={{
              backgroundColor: disc.bg,
              color: disc.fg,
              width: geo.disc,
              height: geo.disc,
            }}
          >
            {g.teenName.charAt(0)}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="flex min-w-0 items-baseline gap-1.5">
            {/* THE ONE EMPHASISED ELEMENT. */}
            {/* ═══ THE TEEN NAME DOES NOT YIELD TO THE MENTOR'S ═══
                Both were `truncate` at the default shrink of 1, so a squeezed
                line cut both — MEASURED at a 320 phone, "Naomi R." at 51 of
                its 62px beside a clipped "Brandy Forrestor". `shrink-0` hands
                the whole deficit to the mentor; `max-w-full` is what still
                truncates a name too long for the line on its own. */}
            <span
              className="max-w-full shrink-0 truncate font-display text-[var(--text-primary)]"
              style={{
                fontSize: geo.primary.size,
                lineHeight: `${geo.primary.leading}px`,
              }}
            >
              {g.teenName}
            </span>
            <span aria-hidden className="shrink-0 text-[12px] text-[var(--text-muted)]">
              ↔
            </span>
            {/* ═══ 13px WAS OFF BLOOM'S RAMP ═══
                The ramp is 32/40 · 24/32 · 16/24 · 14/20 · 12/16 and this line
                sat at 13/18, which is not a stop on it. It takes the stop below
                the primary line instead, which is also what §3 asks for
                directly: a clearer step down so the pair reads as one scan
                target with a subject rather than as two titles. */}
            <span
              className="truncate text-[var(--text-secondary)]"
              style={{
                fontSize: geo.secondary.size,
                lineHeight: `${geo.secondary.leading}px`,
              }}
            >
              {g.mentorName}
            </span>
          </span>
          <span
            className="flex items-center gap-1.5 text-[var(--text-secondary)]"
            style={{
              marginTop: geo.lineGap,
              fontSize: geo.secondary.size,
              lineHeight: `${geo.secondary.leading}px`,
            }}
          >
            {/* ═══ THE WORST CATEGORY, AND THE OLDEST AGE ═══
                Both are the comparator's own answers — see `flag-group.ts` on why
                a set's category is its highest-ranking member and its age is its
                oldest. A row that sorted on one member and displayed another
                would be a queue whose order cannot be read off it. */}
            <span className="truncate">
              {categoryTextFor({ ...g.events[0], category: g.worstCategory })}
            </span>
          </span>
        </span>
        {/* WHAT THE COMPARATOR ACTED ON, SAID OUT LOUD. A queue whose order cannot
            be explained from the rows is a queue a supervisor learns to distrust.
            ═══ pl-6 IS §3's "REAL SEPARATION FROM THE CONTENT BLOCK" ═══
            The markers used to sit 6px from a truncating category label, so on a
            narrow column the two read as one run of text. */}
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 pl-6",
            /* ═══ NARROW: THE TRAILING STACK, AS ON CARE REVIEWS ═══
               The age on line 1 beside the names, the markers on line 2 beside
               the category. `flex-col-reverse` because the age is last in
               source and first on screen; the row's name is stated, so the
               visual order is the only order this changes. The row's `gap-3`
               is the separation, so the 24px inset goes. */
            "@max-[588px]/canvas:flex-col-reverse @max-[588px]/canvas:items-end @max-[588px]/canvas:justify-center @max-[588px]/canvas:gap-0 @max-[588px]/canvas:pl-0"
          )}
        >
          {(g.escalationOpen || isRepeatPattern(g) || g.anyUnanswered) && (
          /* `contents` above the tier, so the markers stay direct flex
             children exactly as they were; one line of glyphs below it. */
          <span className="contents @max-[588px]/canvas:flex @max-[588px]/canvas:gap-1">
          {g.escalationOpen && <Marker icon={ShieldAlert}>Escalation open</Marker>}
          {/* ═══ THE MARKER FINALLY DESCRIBES ITS OWN ROW ═══
              It read "3 in this conversation" on each of three separate rows for
              the same conversation. One row per conversation, so the count is a
              fact about the row a reader is looking at. */}
          {isRepeatPattern(g) && <Marker icon={Repeat2} short={n}>{n} in this conversation</Marker>}
          {g.anyUnanswered && <Marker icon={MessageSquareOff}>No reply</Marker>}
          </span>
          )}
          {/* ═══ THE ONE MONO STRING ON THIS ROW ═══
              §3: "Mono — time values only". This row already complied and still
              does; the age is the only mono on it. RIGHT-ALIGNED ON A CONSISTENT
              AXIS: the markers to its left vary in width, so the age is given a
              floor and its own right edge lands at the same x on every row,
              which is the axis §3 asks for. */}
          <span
            /* NARROW: the 60px floor aligned the age past markers of varying
               width on one line; in the stack it has its own line and is
               right-aligned, so the floor is 16px the category can use — the
               difference, at a 360 phone, between `Assessment scores below
               threshold` whole and clipped by 4px. */
            className="shrink-0 text-right tabular-nums @max-[588px]/canvas:min-w-0!"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: geo.secondary.size,
              lineHeight: `${geo.secondary.leading}px`,
              minWidth: 60,
            }}
          >
            {ageLabel(g.oldestAt, now)}
          </span>
        </span>
        </div>
      </div>
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
  groups,
  now,
  selectedId,
  onSelect,
  emptyLine,
  preset,
}: {
  /** ONE PER CONVERSATION, pre-sorted by `compareGroups`. */
  groups: FlagGroup[];
  now: number;
  /** The selected CONVERSATION's id — see the row's note on identity. */
  selectedId: string | null;
  onSelect: (g: FlagGroup) => void;
  /** NEEDS-COPY-NICOLE. What an empty queue says — and it never says "you're
   *  done", because coverage is the floor and the queue emptying is weather. */
  emptyLine: string;
  /** §5's row scale. Not defaulted — a surface that forgets to pass it should
   *  fail to compile rather than silently render the other preset. */
  preset: ViewPreset;
}) {
  /* ═══ NO GROUP LAYER, AND NO GROUP HEADER (addendum §2.1, §3.1) ═══
     The list was grouped by review subject, and with one subject the header read
     "Teen safety — 9" over every row on a page titled Risk Flags: the same noun
     twice and a count that, per §3.1, was counting the wrong unit anyway. The
     count moved to the page header's metric pair, which is where §2.10 puts it,
     and stating it in both places would be the clock told twice. */
  const flat = groups;
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
      <p className="px-6 py-6 text-[14px] leading-[20px] text-[var(--text-secondary)]">
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
      {flat.map((g, i) => (
        <Row
          key={g.id}
          group={g}
          now={now}
          preset={preset}
          /* NOT DIRECTLY UNDER THE SELECTION — see `worklist.tsx`'s note on
             why the row below the selected one drops its hairline. */
          hairline={i > 0 && flat[i - 1].id !== selectedId}
          selected={selectedId === g.id}
          active={i === idx}
          onSelect={() => {
            setActiveIdx(i);
            onSelect(g);
          }}
        />
      ))}
    </div>
  );
}
