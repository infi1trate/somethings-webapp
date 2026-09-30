"use client";

// THE WORKLIST — rows, coalesced groups, keyboard selection, list states (§4).
//
// ROW ANATOMY (§4): avatar disc · teen name · "to {mentor}" caption · right-aligned
// differentiator chips + age in mono.
//
// ═══ WHAT A ROW MAY AND MAY NOT CARRY ═══
// NO PER-ROW TIER CHIPS (§3.3). Inside a tier-filtered list the tier is AMBIENT —
// every row under an Imminent group is an imminent flag, and a chip
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
//
// ═══ AND THE TREE'S CONTENT MODEL IS THE OTHER HALF OF THAT CHOICE ═══
//
// A tree's strength is what it accepts and that is also its cost: `treeitem` and
// `group`, NOTHING ELSE. This file already records two things the rule forbade —
// an `<h3>` band heading and a nested `<button>` — and it shipped a third: the
// role sat on the SCROLLER, so the column header and the completed-today band
// were children of the tree. MEASURED by axe, `aria-required-children`, nine
// times, once per viewport on D10.
// SO THE ROLE IS ON THE QUEUE AND THE SCROLL IS ON THE CARD. Two elements, one
// job each, and the test for anything new in this list is now easy to apply: if
// it is not a `treeitem` or a `group`, it goes in the scroller BESIDE the tree,
// not inside it. Both of the things that broke the rule are controls or lists
// ABOUT the queue rather than rows in it, which is why that test is the right
// one rather than a workaround — relabelling a sort header `role="group"` would
// have satisfied axe and lied about the structure.
// MONITORING'S LIST NEVER HAD THIS. `event-list.tsx` puts `role="tree"` on an
// element whose only children are treeitems — checked, and its own axe probe
// reports zero violations — because it has no column header and no completed
// band. The defect was this surface's alone.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, PencilLine, Phone, Repeat2, RotateCcw } from "lucide-react";
import { RecordButton } from "@/components/record/record-button";
import { coalesceLabel, itemsOf, paneItemFor, type ListEntry } from "@/lib/tasks/list";
import {
  bandHeaderLabel,
  bandsAreMeaningful,
  bandsFor,
  closedTodayInBand,
  type TierBand,
} from "@/lib/tasks/bands";
import { elapsedLabel } from "@/components/tasks/strips";
import { CompletedGroup, type CompletedEntry } from "@/components/tasks/completed-group";
import { deadlineBandsFor } from "@/lib/tasks/deadline-buckets";
import { TASK_KIND_LABEL } from "@/lib/tasks/task-kind";
import { proposalSpoken } from "@/components/record/proposal-codes";
import { escalationStateLine } from "@/lib/tasks/escalation-response";
import {
  deadlineLabel,
  rowEmphasisFor,
  type RowEmphasis,
} from "@/lib/tasks/row-emphasis";
import { DOMAIN_LABEL, isBreached, type TaskDomain, type TaskItem, type TaskType } from "@/lib/tasks/types";
import type { SurfaceState } from "@/lib/tasks/load-plan";
import {
  GROUP_HEADER_H,
  RetiringBand,
  WorklistGroupHeader,
} from "@/components/tasks/group-header";
import {
  LIST_MIN_ROWS,
  ROW_GEOMETRY,
  type ViewPreset,
} from "@/lib/ui/view-options";
import { cn } from "@/lib/utils";
import {
  COL_AGE,
  COL_MENTEE_MIN,
  COL_PRESENTATION,
  COL_REVIEW,
  ReviewCycleCell,
  ReviewDisc,
  ReviewRowHeader,
  proposalCaption,
  proposalCaptionIcon,
} from "@/components/tasks/review-row";
import type { CareSort, CareSortColumn } from "@/lib/ui/care-sort";

/** §5.2's leading marker slot. ONE NUMBER, TWO READERS: the row reserves it so
 *  a dot appearing cannot shift the row, and the header reserves the same width
 *  so its first column starts at the row's first column. It was inline in the
 *  row and the header did not have it at all, which measured as a 16px offset
 *  between "Mentee" and the names under it. */
const MARKER_SLOT = 8;
/* ═══ AND IT STAYS 8 THOUGH THE DOT IS NOW 6 (parity pack §3) ═══
   The slot is the RESERVATION, not the mark: the dot is centred in it, so a
   6px dot in an 8px slot leaves every disc, name and column exactly where it
   was. Shrinking the slot to 6 would shift the whole row — and the HEADER with
   it, since `ReviewRowHeader` takes `markerWidth={MARKER_SLOT}` precisely so
   the two flex chains start at the same x. That alignment was measured to the
   pixel one pack ago; it is not worth 2px. */

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
/* ═══ AND WHY IT IS NOW A FUNCTION OF DENSITY (Layout Pass §3, §5) ═══
   56px was the only row this list had, so the contract above could be a
   module constant. §3 raises the row and §5 makes the raise a choice, which
   changes nothing about the contract and everything about where it lives: the
   number is still exact, still the thing every offset is computed from, and
   still a value the compiler will not check — it just has two values now.
   `ROW_GEOMETRY` in `lib/ui/view-options.ts` holds both, with the arithmetic
   that produces them. `Worklist` reads `rowH` off it once and every piece of
   window arithmetic below uses that, so the two cannot drift apart within a
   render. `Row` and `ListSkeleton` take the preset and derive the same number
   from the same table.
   COMPACT IS 56 EXACTLY — the preset the virtualizer's measurements were taken
   against is still one of the two settings, which is the setting to fall back
   to if the taller row ever misbehaves. */
/** THE HEADER'S HEIGHT, from the component that draws it. Two constants for one
 *  box is how the virtualizer's offsets and the rendered header drift apart, and
 *  that drift is invisible: the list simply stops scrolling rows to where the
 *  keyboard thinks they are. */
const HEADER_H = GROUP_HEADER_H;

/** Rows rendered beyond each edge of the viewport. Six is enough that ordinary
 *  arrow-key movement never lands on an unmounted row (so focus is immediate) and
 *  small enough that a hundred-row list mounts a dozen nodes rather than a
 *  hundred.
 *
 *  ═══ THE VIRTUALIZER IS OVER-PROVISIONED FOR WHAT TASKS NOW HOLDS (arch-A) ═══
 *
 *  It was built for the flag domains: 49 open on typical-shift, 97 on
 *  heavy-caseload. Scoping Tasks to billing leaves 15 and 16 — measured across
 *  all five scenarios, the billing set is 1 / 15 / 16 / 1 / 1 — and at a screenful
 *  plus twelve overscan rows the window covers the whole list on every one of
 *  them. So nothing here is currently doing any work.
 *
 *  KEPT ANYWAY, DELIBERATELY. Billing volume grows with the roster, this is the
 *  list arch-B's Monitoring surface comes back to, and the cost of carrying
 *  it is a constant and two `slice` calls. Removing it would also take the
 *  arithmetic `revealRow` with it — which exists BECAUSE of virtualization but is
 *  the only reason keyboard movement to an off-screen row works at all. */
const OVERSCAN = 6;

/** ═══ THE TABLE'S TWO FIXED COLUMNS (Figma alignment §4.3) ═══
 *
 *  Care Reviews becomes a table with column headers. A header can only line up
 *  with its rows if both read the SAME widths, so they are declared here and
 *  imported by both — the alternative is two sets of Tailwind classes that
 *  agree until somebody edits one.
 *
 *  THE MENTEE COLUMN IS NOT HERE because it is `flex-1`: it takes whatever the
 *  other two leave, which is what lets the table survive the pane's fixed width
 *  changing under it.
 *
 *  ═══ WHY A TABLE HERE AND A LIST ON RISK FLAGS ═══
 *
 *  Stated because it partly reverses two passes of moving away from table
 *  affect. Care Reviews' data IS tabular — every row has the same three
 *  attributes and a reader compares them down a column. Risk Flags' rows are
 *  conversations whose facts differ per row, which is a list.
 *  WHAT DOES NOT COME BACK is the old table ROW: the avatar, the type scale,
 *  the inset selection pill, the full-width dividers and the three density
 *  presets all stay exactly as built. This is a header added to the existing
 *  row system, not a return to the thing that system replaced. */
/* ═══ MEASURED, NOT ESTIMATED ═══
   The widest presentation cell is a CHANGE — two lozenges and an arrow, e.g.
   `F33.0 → F33.1` — which measures 130px at the lozenge's 11.5px mono. 144
   clears it with room for a five-character code like `R45.89`.
   The age column is sized by its HEADER, not its cells: `12d` measures 30px at
   13px mono, but "Review age" needs 68px at 12px — and MEASURED at 56 the
   header wrapped to two lines ("Review / age") while the cells sat in a column
   twice as wide as they needed. A column is as wide as the widest thing in it,
   and on a short-value column that is the label.
   FIRST TUNING WAS 168/96 AND IT COST THE MENTEE COLUMN: at a 499px list the
   type line truncated to "Renewal propo…" on every row. Fixed columns take
   their width from the content they hold, not from a round number. */
/* ═══ THE COLUMN CONSTANTS AND THE HEADER MOVED (Phase K.1) ═══
   They live in `review-row.tsx` now and Today's preview reads the same ones,
   which is what makes "identical on both surfaces" true by construction rather
   than by two files agreeing. The measured tuning that produced 144 and 72 is
   recorded there, where the numbers are.
   RE-EXPORTED so the list's own call sites and its probes resolve unchanged. */
export { COL_PRESENTATION, COL_AGE };

/** And how long the retired header stays before it goes. Long enough to read a
 *  seven-word line, and it is the only reason the band lingers at all. */
const RETIRE_HOLD_MS = 2600;

/* ═══ THE ROW'S FOCUS RING MOVED TO THE PILL (§3) ═══
   It was an `outline` on the row root, which traced a full-bleed rectangle —
   correct for the full-bleed row it was drawn around, and wrong for an inset
   one: the ring would have sat 8px outside the shape it was indicating. It is
   a `group-focus-visible:ring` on the pill element now, so focus traces the
   same rounded box selection does. The constant is gone rather than left
   unused, because an unused focus constant in a list file is an invitation to
   put the outline back. */

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
 *  never colour alone.
 *  ═══ EXPORTED FOR THE TOOLBAR (parity pack §4.3) ═══
 *  §4.3 asks the overdue chip beside the tabs to use "the system-wide breach
 *  pattern", and this is it — so the toolbar consumes this component rather
 *  than restating clay-on-clay plus a triangle in a second place. A pattern
 *  described twice is a pattern that diverges once.
 *  `count` AND `size` ARE THE ONLY PARAMETERS. The row form says just
 *  "Overdue" because the row IS the overdue thing; the toolbar form counts a
 *  subset, so it needs the figure. Nothing else about it varies. */
export function OverdueChip({
  count,
  size = "row",
}: {
  /** Omitted on a row — see above. */
  count?: number;
  size?: "row" | "toolbar";
} = {}) {
  return (
    <span
      data-anno-ref="overdue-chip"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold",
        size === "row"
          ? "px-1.5 py-0.5 text-[11px] leading-[14px]"
          : /* 44px to match every other target in the toolbar — §7's hit-target
               item, and the same bar the segmented control holds. */
            "min-h-11 px-3 text-[13px] leading-[18px]"
      )}
      style={{
        backgroundColor: "var(--band-clay-bg)",
        color: "var(--band-clay-fg)",
      }}
    >
      <AlertTriangle
        aria-hidden
        className={cn("shrink-0", size === "row" ? "size-2.5" : "size-4")}
      />
      {/* TODO-COPY · NEEDS-COPY-NICOLE on the counted form. THE FIGURE LEADS,
          because the word is the same on every chip and the number is what
          varies — the same reasoning §4.2 uses for the tab counts. */}
      {count == null ? "Overdue" : `${count} overdue`}
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
function RowChips({
  entry,
  now,
  /** ═══ THE BUCKET ALREADY SAID IT (arch-G, G1) ═══
   *  On a task-led row the bucket header carries the breach treatment, so a chip
   *  here would be the second of three statements about one lateness. The
   *  deadline column keeps the number and takes the breach ink. Monitoring's
   *  rows have no bucket above them and keep their chip. */
  suppressOverdue = false,
}: {
  entry: ListEntry;
  now: number;
  suppressOverdue?: boolean;
}) {
  const item = paneItemFor(entry);
  const all = itemsOf(entry);
  // A GROUP IS OVERDUE IF ANY MEMBER IS — the row stands for all of them.
  const overdue = all.some((i) => isBreached(i, now));
  const p = item.payload;
  return (
    <>
      {entry.kind === "group" && <Chip>{coalesceLabel(entry.members.length)}</Chip>}
      {overdue && !suppressOverdue && <OverdueChip />}
      {/* ═══ THE 911 CHIP IS THE STATE LINE'S JOB NOW (arch-G, G2) ═══
          On a task-led row the caption says "911 dispatched" in full, so a "911"
          chip beside it is the same fact abbreviated — the third time this phase
          has removed a duplicate statement from a row. Monitoring's rows have no
          caption and keep the chip.
          "No 911" SURVIVES THERE FOR THE REASON `escalation-region.tsx` records:
          on an ACTIVE escalation, "no 911" is a decision somebody made and a
          responder needs to know it. The state line carries that too — it reads
          "Awaiting response" or the recorded disposition. */}
      {p.kind === "escalation" && !suppressOverdue && (
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
  variant,
  /** ═══ THE UNDO WINDOW IS SIX SECONDS AND THE ROW STAYS PUT (arch-F, F4) ═══
   *  A resolved row used to vanish the instant the button was pressed, so the
   *  undo toast offered to restore something the reader could no longer see. It
   *  now holds its place until the window closes and the ledger event is
   *  written, dimmed, with the state in WORDS beside the name — never opacity
   *  alone, which says nothing to a screen reader and nothing in high contrast. */
  resolving = false,
  group,
  now,
  selected,
  expanded,
  optionId,
  tabbable,
  indent,
  onSelect,
  onToggle,
  registerRef,
  preset,
  hasGroups,
  hairline,
  unviewed = false,
  drafted = false,
}: {
  /** ═══ §8 — WHETHER THIS REVIEW HAS A SAVED DRAFT ═══
   *  Resolved by the list from `sessionStorage` through the version counter, and
   *  handed down as a boolean for the same reason `unviewed` is: a row must not
   *  read storage or subscribe individually. */
  drafted?: boolean;
  /** ═══ §5.2 — WHETHER THIS REVIEW HAS BEEN OPENED IN THE PANE ═══
   *  Passed in rather than read from the store here: a row must not subscribe
   *  to a 500-entry array individually, or every row re-renders on every view.
   *  The list resolves membership once and hands each row a boolean. */
  unviewed?: boolean;
  /** §5's row scale. See the geometry note on why this is not a class. */
  preset: ViewPreset;
  /** Whether ANY row in this list is a group — see the list's own prop. */
  hasGroups: boolean;
  /** False on the first row under a band header, and on the first row of an
   *  ungrouped list: a hairline there is a second line 1px from the header's
   *  own, or from the card's border. */
  hairline: boolean;
  entry: ListEntry;
  /** See `rowVariant` on the list. A CHILD is always `subject`: inside an
   *  expanded group every member shares the teen and the tier, so job-first would
   *  print the same label down a run of rows. */
  variant: "subject" | "task";
  /** The band this row sits under — for the accessible name only. See the call
   *  site for why it is not drawn. */
  group: string;
  now: number;
  selected: boolean;
  expanded: boolean;
  optionId: string;
  tabbable: boolean;
  indent?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
  resolving?: boolean;
  /* ═══ `liveNow` IS GONE FROM THE ROW (addendum §2.9) ═══
     A ticking, minute-granular timestamp, read only by the response bucket's
     five-minute countdown — which is a DEADLINE, and this list has none: Care
     Reviews is its only surface and §2.9 retired the concept there. Every
     figure on a row now is an age from the frozen mount clock, which does not
     need to tick to stay true across a shift. */
}) {
  const item = paneItemFor(entry);
  const isGroup = entry.kind === "group";
  const isTeenGroup = isGroup && entry.groupBy === "teen";
  const mentorFirstName = item.mentorName.split(" ")[0];
  /* `KindIcon` IS GONE WITH THE ICON WELL (Refinement §1.3). `TASK_KIND_ICON`
     is NOT deleted — the strangler rule, and the pane and the ledger still read
     it. What went is the ROW's use of it, because one glyph on a surface holding
     one kind of work drew the same thing on every row. */
  /** JOB-FIRST ANATOMY. A child row is never task-led — see `variant`. */
  const taskLed = variant === "task" && !indent;
  /** A LIVE ESCALATION'S ROW. Drives the elapsed counter and the fill's ink. */
  const isResponse = taskLed && item.taskType === "activeEscalation";
  /** ═══ THE DISPOSITION PREVIEW — THE WEIGHT OF THE DECISION, BEFORE IT OPENS ═══
   *
   *  "Change proposed → F33.1" against "Renewal proposed": a renewal is a
   *  twenty-second confirm and a proposed change needs thought, and a supervisor
   *  can plan a queue around that if the row says so.
   *
   *  DERIVED FROM THE LIST DATA, which already carries both halves —
   *  `payload.current` and `payload.recommended` are on the item, not only in the
   *  pane. And derived through the SHARED function the pane uses, so a row cannot
   *  label a review differently from the pane it opens. That function was
   *  extracted for this; before arch-E the comparison lived inline inside
   *  `ReviewBody` and was reachable nowhere else.
   *
   *  BILLING ONLY. Flags have no proposal and escalations have no code; a
   *  preview on those would be a blank segment after a separator. */
  /** ═══ THE SAME SLOT, THREE VOCABULARIES (arch-G, G2) ═══
   *  Billing spends it on the proposal's weight; an escalation spends it on its
   *  STATE, which is what tells a supervisor scanning the list whether this one
   *  is already in hand. One derivation each, both named elsewhere so the row
   *  does not hold a vocabulary. */
  const disposition =
    item.payload.kind === "billing"
      ? /* ═══ THE SPOKEN FORM, FOR THE ACCESSIBLE NAME (addendum §2.9) ═══
           The row DRAWS lozenges now. This string is what a screen reader gets
           instead, and it states the direction in words because the arrow
           between the lozenges is `aria-hidden` — "F33.1 → F41.1" announced as
           two codes with no relation between them is worse than the sentence
           it replaced. */
        proposalSpoken(item.payload.current?.code ?? null, item.payload.recommended.code)
      : escalationStateLine(item);
  /** TODO-COPY. "3 clinical · 2 routine" — the tiers a teen row stands for, in
   *  the band order, and only the tiers actually present. Null on a flag row and
   *  on a conversation group, where every member is the same tier by
   *  construction (taskType is half that key) and the line would restate the
   *  header. */
  /* ═══ THE COMPOSITION LINE IS GONE (Phase 4) ═══
     It read "3 clinical · 2 routine" — the MIX OF TIERS a coalesced teen row
     stood for. With one flag type a flag group is one type by construction, so
     `compositionLabel` could only ever return null and was deleted with the
     tiers it described.
     WHAT THE ROW STILL CARRIES is the coalesce count ("2 in this conversation"),
     which is a fact about the set rather than a claim about severity — see
     `coalesceLabel` below, unchanged. */
  /** ═══ THE AGE ON A TEEN ROW IS THE OLDEST FLAG'S ═══
   *  Not the head's. The head is the most URGENT flag, which on a teen carrying
   *  three clinical and two routine is usually not the one that has been waiting
   *  longest — and "how long has this been accumulating" is the question a
   *  coalesced clinical picture is asked. */
  const ageAt = isTeenGroup
    ? Math.min(...entry.members.map((m) => m.openedAt))
    : item.openedAt;

  const overdue = itemsOf(entry).some((i) => isBreached(i, now));

  /** ═══ WHAT THIS ROW LEADS WITH (arch-D) ═══
   *
   *  Derived from the task type rather than passed by the surface — see
   *  `rowEmphasisFor` for the full argument. A row whose tier gathers by teen is
   *  a picture of a person; everything else is one piece of work with a clock on
   *  it. Monitoring's Imminent rows therefore take the Tasks emphasis, and that
   *  is not an exception bolted on: it falls out, because an imminent flag is
   *  individual and deadline-bearing for exactly the reason it is never
   *  coalesced. Emphasis follows obligation, like the unit of review above it.
   *
   *  A CHILD ROW IS ALWAYS QUIET. Inside an expanded group every member shares
   *  the teen and the tier, so the thing that distinguishes one child from the
   *  next is when it arrived — which is what `childTimeLabel` already says, and
   *  which is not an obligation worth shouting one row under its parent. */
  const emphasis: RowEmphasis = indent
    ? "person"
    : rowEmphasisFor(item.taskType);

  /** ═══ ONE TEMPORAL FACT PER ROW ═══
   *
   *  A deadline-forward row shows the COUNTDOWN and drops elapsed age entirely.
   *  "2d open" is history; "due in 15h" is the question the surface answers, and
   *  the pane header still carries age for anyone who wants it.
   *
   *  A person-forward row keeps age, quietly: on a coalesced clinical picture
   *  "how long has this been accumulating" is a real question and there is no
   *  single deadline to count to — the members' SLAs differ by tier.
   *
   *  ═══ "OPEN" IS NOT TRUE OF EVERY ROW (arch-B, and it survives arch-D) ═══
   *  This column appended the literal word "open" to every elapsed figure, so an
   *  escalation DOCUMENTATION row read "20h open" while the pane read "Closed
   *  Sep 13". Both figures were right and the word was wrong. Documentation rows
   *  do not reach this surface today, but the suffix is still derived rather than
   *  written, so the defect cannot come back with the row type. */
  const openSuffix = item.taskType === "escalationDocumentation" ? "" : " open";
  const temporal = indent
    ? childTimeLabel(item.openedAt)
    : /* ═══ PER BUCKET ON A TASK-LED ROW (arch-F, F1.2) ═══
         A task-led row sits under a bucket header that already names the day, so
         the row states what the header cannot — the hour, the date, or how late.
         `deadlineLabel`'s uniform "due in {n}" stays for Monitoring's imminent
         flags, which have no bucket above them to defer to. */
      taskLed
      ? /* ═══ AGE, NOT A DEADLINE (addendum §2.9) ═══
           It was `deadlineFactFor` — "due 6:48 PM", "overdue by 9h" — under a
           bucket header that named the day. §2.9 retires the deadline concept
           from this destination, and with `TASK_SLA_MS` null for both billing
           types that call now returns the literal "no review deadline" on
           every row: a label stating the absence of a thing the surface no
           longer has.
           AGE IS WHAT IS LEFT, and it is also what the list is ORDERED by —
           see `sla.ts` on why oldest-first fell out of the nulls. A column of
           figures that explains the sort is what this row can honestly carry. */
        `${elapsedLabel(ageAt, now)}${openSuffix}`
      : emphasis === "deadline"
        ? deadlineLabel(item.slaDeadline, now, elapsedLabel)
        : `${elapsedLabel(ageAt, now)}${openSuffix}`;

  /** TODO-COPY. The full row, spoken — group, teen, mentor, differentiators,
   *  and the one temporal fact.
   *
   *  THE GROUP COMES FIRST, and only on a top-level row. A sighted reader gets
   *  the task type or the tier from the sticky header; before arch-D a
   *  screen-reader user got it from nowhere, because that header is `aria-hidden`
   *  and the enclosing group's label is announced on entry and not again forty
   *  rows down. A CHILD omits it — it is announced immediately after its parent,
   *  which just said it. */
  const ariaLabel = [
    indent ? null : group,
    /* THE JOB FIRST ON A DEADLINE ROW, matching what the row draws. A name-first
       accessible label on a task-led row would tell a screen-reader user they
       are in a directory while a sighted reader sees a work queue. */
    /* THE NAME FIRST ON A TASK-LED ROW NOW, matching what the row draws —
       arch-E led with the job because the job was the emphasis. The task type
       follows immediately, so a screen-reader user gets both in the order a
       sighted reader's eye takes them. */
    ...(taskLed
      ? [item.teenDisplayName, TASK_KIND_LABEL[item.taskType], disposition]
      : [item.teenDisplayName, `to ${item.mentorName}`]),
    isGroup ? coalesceLabel(entry.members.length) : null,
    /* ═══ §5.2 — THE MARKER IN WORDS ═══
       The dot is `aria-hidden` and the face is not announceable at all, so
       without this a screen-reader user has no access to the state. NEEDS-COPY-
       NICOLE. */
    unviewed ? "unviewed" : null,
    /* §8's accessible label. NEEDS-COPY-NICOLE. After "unviewed" because a row
       can be both, and the order matches the row's own reading order — the
       leading-edge marker before the content one. */
    drafted ? "draft saved" : null,
    overdue ? "overdue" : null,
    item.payload.kind === "escalation"
      ? item.payload.is911
        ? "911 dispatched"
        : "no 911"
      : null,
    item.status === "inProgress" ? "in review" : null,
    /* THE SAME ONE TEMPORAL FACT THE ROW DRAWS. This read `{elapsed} open` for
       every row and did not move when arch-D changed the column — so the screen
       reader went on hearing "2d open" on a row that said "due in 15h", which is
       two different facts about one item told to two readers. The probe caught
       it, and only because it checks the accessible name separately from the
       rendered spans. */
    temporal,
    /* ═══ TWO FLAGS ON ONE TEEN NEED TWO NAMES ═══
       MEASURED on Monitoring: the Imminent band never coalesces — deliberately,
       so a 24h deadline cannot hide inside a group row — and a teen carrying two
       imminent flags therefore gets two rows whose accessible names were
       character-for-character identical ("Nia P., to Brandon Forant, 20h open",
       twice). A sighted reader tells them apart by position; a screen-reader
       user gets the same sentence and no way to know they have moved.
       THE CLOCK TIME IS THE DISCRIMINATOR, which is not a new idea here — it is
       the same one the indented children already use, for the same reason: "a
       CHILD is identified by its time, a parent by its age". Elapsed is rounded
       to the hour and two flags twenty minutes apart both read "20h".
       NAME-ONLY. Nothing visual moves: the column still shows the age, because
       age is what a reader scans and a clock time in that column would be a
       second format in one line of figures. */
    !isGroup && !indent ? childTimeLabel(item.openedAt) : null,
    /* THE STATE IN THE NAME, not only in the opacity. */
    resolving ? /* NEEDS-COPY-NICOLE */ "closing" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const geo = ROW_GEOMETRY[preset];

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
      /* ═══ THE ROW'S OWN ID IS PART OF THE NAME ═══
         A bare "task-row" repeats on every mounted row, and the anno-02 spike
         measured what that costs: four pins on four different rows all captured
         the same reference and all resolved to the first one, reporting tier 1
         while pointing at the wrong task. The id makes the name identify a row
         rather than a row TYPE — so a pin resolves exactly when its row is
         mounted, and honestly orphans when the virtualizer has unmounted it. */
      data-anno-ref={`task-row:${item.id}`}
      data-resolving={resolving ? "true" : undefined}
      data-response={isResponse ? "true" : undefined}
      /* ONE `style`, BOTH FACTS. The height is the virtualizer's invariant and
         cannot be a class; the fill is a token that Tailwind cannot compose with
         an inline height without two attributes, which JSX refuses. */
      /* ═══ THE ROW BOX IS THE PITCH, NOT THE CARD (Refinement §4) ═══
         EXACT, NOT A MINIMUM — see the geometry note. `Cards` needs a gap
         between rows, and a margin cannot provide it: a margin is not in the
         virtualizer's offset arithmetic, so every card would draw 12px lower
         than the window thinks it is. The gutter is carried INSIDE the row box
         instead — the box steps by `pitch`, the card draws `height`, and the
         difference is the gap. One number moves; the arithmetic does not. */
      style={{ height: geo.pitch }}
      data-preset={preset}
      className={cn(
        "group relative cursor-pointer",
        /* THE RING MOVED TO THE PILL, so it traces the inset shape instead of a
           full-bleed rectangle; `outline-none` stops the root drawing a second
           one around the whole row. */
        "outline-none",
        isResponse && "text-[var(--task-respond-fg)]",
        /* RESOLVING: dimmed, and the word is in the accessible name above. The
           row keeps its height and its place — the whole point is that the list
           does not move while the undo window is open. */
        resolving && "opacity-55"
      )}
    >
      {/* ═══ ONE ELEMENT FOR EVERY GROUND THIS ROW CAN HAVE ═══
          Selection, hover, focus and the escalation band, so they cannot
          disagree about the shape. GROUPED presets draw it as an inset pill —
          4px of vertical margin, an 8px gutter between neighbours, no border,
          because the divider is what separates them. `Cards` draws it as a
          detached panel with its own contour and fill, filling the card region
          with the gutter below it.
          THE SATURATED FILL COMES WITH IT (arch-G, G2). A live escalation is
          still the one filled treatment on this surface; its shape changes with
          the preset and its rank does not. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-2 rounded-[var(--radius-inset)] transition-colors",
          "group-focus-visible:ring-2 group-focus-visible:ring-[color:var(--focus-ring)]",
          geo.detached && "border border-[color:var(--border-contour)]",
          selected
            ? isResponse
              ? "ring-2 ring-inset ring-[var(--task-respond-fg)]"
              : "bg-[var(--surface-s2)]"
            : isResponse
              ? null
              : cn(
                  geo.detached && "bg-[var(--surface-card)]",
                  "group-hover:bg-[var(--tint-hover)]"
                )
        )}
        /* THE CARD FILLS ITS REGION; THE PILL INSETS INSIDE IT. Inline because
           both numbers come off the geometry table. */
        style={{
          top: geo.detached ? 0 : 4,
          height: geo.detached ? geo.height : geo.height - 8,
          ...(isResponse ? { backgroundColor: "var(--task-respond-bg)" } : null),
        }}
      />
      <div
        /* THE CONTENT REGION IS THE CARD'S HEIGHT, not the row box's — so under
           `Cards` the content centres in the panel and the gutter stays empty.
           px-6 = 8px of card track plus 16px of row padding, so content starts
           24px inside the panel. */
        style={{ height: geo.height }}
        className={cn("relative px-6", indent && "pl-14")}
      >
      {/* ═══ THE DIVIDER RUNS THE FULL CONTENT BOX (Refinement §1.2) ═══
          REVERSING the prior pack's inset separator, and the reversal is
          measured: inset, the line stopped 272px short of the row's right edge
          on Risk Flags, so the age hung past a ragged edge and read as a
          rendering fault rather than as intent.
          IT IS ON THIS WRAPPER, NOT THE PADDED PARENT. A border on the parent
          would span its border box — 8px to 8px, the card's own edges — while
          this element IS the padding box, so the line runs 24px to 24px,
          symmetrically, and never bleeds to the panel edge.
          NOT UNDER `Cards`: a detached panel carries its own contour and a
          divider as well would be two separators for one boundary. */
      }
      <div
        className={cn(
          "flex h-full items-stretch gap-3",
          hairline && !geo.detached && "border-t border-[color:var(--border-subtle)]"
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
        /* THE ALIGNMENT SPACER, ONLY WHEN THERE IS SOMETHING TO ALIGN TO. */
        !indent && hasGroups && <span aria-hidden className="w-5 shrink-0" />
      )}

      {/* ═══ THE IDENTITY DISC, ON BOTH SURFACES NOW (Refinement §1.3) ═══
          arch-E gave Tasks a TASK-TYPE ICON in a neutral well instead of the
          disc, reasoning that "a supervisor works this queue in deadline order
          rather than hunting for a named teen" and that it makes the two
          surfaces visibly different species.
          THE DEADLINE IS GONE (addendum §2.9) AND THE ICON WENT WITH ITS
          ARGUMENT. With one icon for a surface holding one kind of work, every
          row drew the SAME glyph — which is the defect arch-F removed from the
          emphasis channel and §2.9 removed from the label channel, arriving a
          third time in the icon channel: the most prominent element on nineteen
          rows carrying no information. The disc carries the teen, which varies.
          HUE MEANS WHO, AND NEVER WHAT — not the tier, not breach, not a count.
          See `lib/tasks/avatar.ts`; the short form is that the row already
          carries every state in words and a second colour language would leave a
          reader fluent in neither.
          `aria-hidden`: the initial shortens a name printed beside it.
          ═══ AND IT CENTRES TO THE ROW BOX (§1.1) ═══
          MEASURED before: the well sat 22px above the row's centre while the
          trailing metadata was centred — two alignment logics in one row. The
          cause was mine: the content row became `items-stretch` last pass so
          the text column could carry a full-height border, and a fixed-height
          child of a stretch container aligns to its START. The wrapper is what
          re-centres it, and it is the same wrapper Risk Flags already had. */}
      {/* ═══ §5.2 — THE UNVIEWED MARKER, AT THE LEADING EDGE ═══
          Inbox convention: a mark before the identity, in a fixed position, on
          rows that have not been opened.
          THE SLOT IS ALWAYS THERE AND THE DOT IS NOT. Reserving the width means
          a viewed row and an unviewed row start their disc at the same x — a
          marker that shifts the whole row as it appears would make the list
          twitch as a supervisor works down it.
          `--text-primary`, NOT AN ECRU DOT. §5.2 says an ecru dot alone fails
          1.4.1, and the reason is contrast rather than hue: ecru on cream is
          around 1.2:1, so its PRESENCE is not reliably perceivable and
          presence is the whole signal. At primary ink it is 15.14:1 light and
          15.43:1 dark — a shape a reader can see, which is what makes
          presence/absence a non-colour channel.
          `aria-hidden` BECAUSE THE NAME SAYS IT — see `ariaLabel`, which
          carries "unviewed" in words. */}
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center"
        style={{ width: MARKER_SLOT }}
      >
        {unviewed && (
          <span
            data-anno-ref="unviewed-dot"
            /* ═══ 6px, AND IT WAS 8 (parity pack §3) ═══
               "Live dots are larger than the Figma. Reduce to match, snapped to
               a Bloom step."
               MEASURED BEFORE: `size-2` — 8px. AFTER: `size-1.5` — 6px.
               ON THE 4px GRID'S HALF-STEP, which is the only scale available:
               Bloom ships no spacing scale (four component pads and nothing
               else), so Tailwind's 4px step with its 2px half is what this
               product actually has — recorded when the type ramp was audited.
               6 IS THE STEP DOWN, NOT 4. `size-1` would be 4px, and §3's own
               sentence rules it out by naming "anyone who cannot resolve a 4px
               mark" as the reason the weight pairing exists. Going TO 4 would
               make the mark the thing the sentence says not to rely on.
               THE PAIRING IS WHY THIS IS SAFE AT ALL. The dot is shape-and-hue;
               the mentee name's FACE carries the same state independently (§5.2
               swapped Lausanne's inert weight for Avantt), so shrinking the
               mark does not shrink the signal. */
            className="size-1.5 rounded-full bg-[var(--text-primary)]"
          />
        )}
      </span>

      <span className="flex shrink-0 items-center">
        {/* SHARED WITH TODAY'S PREVIEW (K.1) — one disc implementation. */}
        <ReviewDisc
          teenId={item.teenId}
          name={item.teenDisplayName}
          size={geo.disc}
        />
      </span>

      {/* ═══ THE SEPARATOR IS NOT HERE ANY MORE — IT WAS THE SECOND STROKE ═══
          THE SECTION THIS REPLACES asked for an inset separator: "start after
          the avatar, stop before the trailing metadata", and a stretched flex
          child was the right way to get it — the two ends derive from the
          layout rather than from insets that drift when the disc resizes.
          REFINEMENT §1.2 THEN REVERSED THE INSET and gave the divider to the
          content wrapper above, measured: inset, the line stopped 272px short
          of the row's right edge on Risk Flags, so the age hung past a ragged
          edge and read as a rendering fault. THE OLD BORDER WAS NEVER REMOVED,
          so both drew, and this is the double stroke reported three times.

          MEASURED AT 1600, one row, the two borderers inside it:
            div.flex.h-full.items-stretch  y=521  x=305  w=576  border-top 1px
            span.flex.min-w-0.flex-col     y=522  x=373  w=316  border-top 1px

          EXACTLY 1px APART, AND THE MECHANISM IS THE FIRST BORDER ITSELF: the
          wrapper is `items-stretch`, so this child's box begins at the
          wrapper's CONTENT edge — which its own 1px top border has already
          pushed down by 1. So the segmentation and the "slightly different
          vertical position" are one defect, not two: a 576px line at y=521
          with a 316px line at y=522 sitting 68px into it, which is why it read
          as a thick stroke under the mentee cell and a thin one after it.

          ONE OWNER NOW, AND IT IS THE ROW. The wrapper's border is the one
          Refinement §1.2 measured and argued; this one is the superseded
          treatment, so it is the one that goes.
          IT ALSO FIXES `Cards`, WHICH NOBODY REPORTED. The wrapper's border is
          gated `!geo.detached` because a detached panel carries its own
          contour; this one was gated on `hairline` alone, so under the Cards
          preset it drew a divider inside a bordered panel — the exact
          two-separators-for-one-boundary the wrapper's note rules out.
          MEASURED, border-drawing elements per row under `Cards`: Care Reviews
          2 -> 1. RISK FLAGS WAS ALREADY 1 IN BOTH STATES, because `event-list`
          builds its own row and never carried this border — so the Cards defect
          was this surface's alone, and the shared geometry is not what spread
          it. Stated because "also fixes Cards" would otherwise read as a claim
          about both surfaces. */}
      <span
        className="flex min-w-0 flex-col justify-center"
        /* ═══ THE MENTEE COLUMN'S SHARE (§6.5, CORRECTED IN §3) ═══
           MEASURED at 1280 before the cadence column replaced the codes
           column: this cell was **11px** wide and the NAME truncated — "Theo
           L." at 50px of content in an 11px box. §6.5 describes the second
           line truncating "while the cell has room"; the cell had no room at
           all, because three fixed columns plus the detail pane had taken
           everything. Swapping 144 for 72 got it to 83px and that was still
           short — the caption "Presentation Review" is 110px.
           IT WAS `flex-1` PLUS `minWidth`, AND THE FLOOR IS WHAT CLIPPED THE
           ROW. A `min-width` a flex line cannot honour does not make the line
           yield, it makes the line OVERFLOW: measured at 1280 with the pane
           open, the list card is 367px, this row wanted 428, and the 61px
           remainder ran out of an `overflow-hidden` card — taking the REVIEW
           AGE column with it, down to 1 visible pixel, on the column §3 had
           just given a sort control.
           SO THE NUMBER IS A BASIS AND THE PRIORITY IS A SHRINK RATIO. This
           cell is what the row's spare width goes to and what it starts from;
           the cadence cell gives 6× as readily, so it is still what yields
           first; and when it has given everything, this caption truncates
           rather than a whole column leaving the card.
           STILL STATED IN TWO PLACES — `ReviewIdentityCell` carries the same
           flex for Today's table, because this row renders its own identity
           spans (the one fork K.1 named) until that fork closes. */
        style={{ flex: `1 1 ${COL_MENTEE_MIN}px` }}
      >
        {/* ═══ LINE 1 — THE JOB, OR THE PERSON ═══
            DEADLINE-FORWARD: the task name, at the row's strongest available
            weight. `font-display` is Avantt, which ships Bold only, so it is the
            one real weight step here — MEASURED: Lausanne renders identically at
            400/500/600/700, so every `font-semibold` that used to sit on these
            rows was a declaration with no rendering behind it.
            THE COUNTDOWN IS ALSO EMPHASISED, and that is not two emphases: it is
            mono at 700 (a real +41% ink) against Avantt, two different FACES
            neither of which competes for the other's channel, and they are the
            two halves of one sentence — what is owed, and when. arch-D's rule is
            one emphasised ELEMENT per row on each axis, and the row has one of
            each.
            PERSON-FORWARD: unchanged from arch-D — the teen name in Avantt. */}
        {/* ═══ arch-F REVISES arch-E: EMPHASIS FOLLOWS WHAT VARIES ═══
            arch-E made the task name the row's strongest element. With one task
            type on the surface that string is IDENTICAL on every row — an
            emphasis carrying no information, and a column of nineteen rows all
            shouting the same three words. Emphasis belongs on the varying
            content, which is the teen.
            THE TASK NAME STAYS, as a chip: without it the row reads as a
            directory entry, and the day a second task type lands the chip is
            already the place that says which. Small, neutral, secondary — a
            label, not the focal point.
            AND THE RULE IS NOW ONE EMPHASISED ELEMENT PER ZONE, not per row:
            identity on the left, deadline on the right. Two scan zones, one
            focal point each. Recorded here so it is not read as drift from
            arch-D's per-row rule — it is a refinement of it, and the thing both
            versions forbid is two focal points competing inside one zone. */}
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span
            style={{
              fontSize: geo.primary.size,
              lineHeight: `${geo.primary.leading}px`,
            }}
            className={cn(
              "truncate",
              /* ═══ THE FILL CHANGES THE GROUND, SO IT CHANGES THE INK ═══
                 MEASURED by axe: `--text-primary` (#1f1e1d) on the respond fill
                 (#c9351d) is 3.17:1 — a WCAG failure on the most urgent row on
                 the surface. The row root already sets `--task-respond-fg`; this
                 element was overriding it with the ink for the ground it is NOT
                 on. Inheriting instead of restating is the fix. */
              isResponse ? "text-[var(--task-respond-fg)]" : "text-[var(--text-primary)]",
              /* ═══ §5.2's SECOND CHANNEL IS THE FACE, BECAUSE WEIGHT IS INERT ═══
                 §5.2 asks for "a weight difference on the mentee name (unviewed
                 slightly heavier), which is the convention the inbox reference
                 is actually built on". THAT CHANNEL DOES NOT EXIST IN THIS
                 BUILD: only `TWKLausanne-400` and `Avantt-Bold` ship, and this
                 codebase records the measurement in four places — Lausanne
                 renders identically at 400, 500, 600 and 700, so
                 `font-semibold` here would be a declaration with no rendering
                 behind it. Faking it is what K.3 forbids.
                 THE FACE IS THE SUBSTITUTE AND IT IS THIS CODEBASE'S OWN: "the
                 two emphasis channels that actually work are Avantt and the
                 mono stack at 700" (arch-F). Avantt over Lausanne is a measured
                 +19% ink, which is a real weight step in every sense except the
                 CSS property's.
                 SO AN UNVIEWED NAME IS AVANTT AND A VIEWED ONE IS THE TEXT
                 FACE. That is the direction §5.2 asks for — unviewed heavier —
                 and it is the same treatment arch-F gave the row's focal point,
                 now earned per row rather than granted to all of them. */
              (taskLed || emphasis === "person") && unviewed && "font-display"
            )}
          >
            {item.teenDisplayName}
          </span>
          {/* ═══ THE ITEM-TYPE CHIP IS GONE (addendum §2.9) ═══
              It read "Billing code review" on every row of a destination where
              every row is one — the same defect arch-F removed from the
              emphasis channel, in the label channel: the strongest-positioned
              element on nineteen rows carrying no information.
              IT SURVIVES IN THE ACCESSIBLE NAME for exactly one reason: a
              screen-reader user arriving mid-list has no page title above
              them, so the row still says what kind of work it is once. */}
        </span>
        {/* ═══ LINE 2 — THE CAPTION ═══
            `--text-secondary`, NOT `--text-muted` (gap row 294). These rows sit
            on `--surface-s2` (#e5e0d2), the shell canvas, and muted ink measures
            4.01:1 there — under the 4.5 floor for 12px text. `--text-secondary`
            (#58534b) is 5.78:1 on s2 and is the design system's own next step.

            ═══ THE MENTOR IS GONE FROM TASKS ROWS (arch-E) ═══
            It was inherited from the flag row, where it earns its place because
            supervisors coach mentors and a flag reflects on the mentorship. On a
            billing code review the mentor does not perform the task, is not
            accountable for it, and cannot change the decision — the code derives
            from survey data. It remains on Monitoring's rows, where it is
            load-bearing, and on the pane header and the transcript, where it
            attributes who said what. */}
        <span
          style={{
            marginTop: geo.lineGap,
            fontSize: geo.secondary.size,
            lineHeight: `${geo.secondary.leading}px`,
          }}
          className={cn(
            "block truncate",
            /* ═══ 1.45:1 — THE WORST PAIR ON THE SURFACE (arch-G, G6) ═══
               MEASURED by axe: `--text-secondary` (#58534b) on the respond fill
               (#c9351d). At 12px. On the line that says "911 dispatched".
               Same cause as line 1: an explicit ink for the default ground,
               restated on a row whose ground is not the default. */
            isResponse ? "text-[var(--task-respond-fg)]" : "text-[var(--text-secondary)]"
          )}
        >
          {/* ═══ §8 — THE DRAFT MARKER, AND IT IS NOT A DOT ═══
              §8's whole instruction is that this must not read as the same
              signal as §5.2's unviewed dot: "two subtle markers in one row —
              unviewed and draft-started — will read as the same signal if both
              are dots. Make them different affordance classes."
              SO THEY DIFFER ON EVERY AXIS AVAILABLE:
                unviewed  · a DOT   · at the LEADING EDGE · outside the content
                drafted   · an ICON · in the CONTENT AREA · on line 2
              LINE 2 RATHER THAN LINE 1. Line 1 is the row's focal point and
              carries the emphasis; an icon beside the name would put a second
              thing in that zone, which is what arch-D and arch-F both forbid.
              Line 2 is about the review's NATURE — "Presentation Review" /
              "Presentation Change" — and a started draft is a fact of the same
              kind.
              `PencilLine` IS ALREADY THIS CODEBASE'S DRAFT GLYPH — see
              `step-status-badge`, where it is keyed to `draft` with the label
              "Draft". Same glyph, same meaning, one vocabulary.
              THE SHAPE IS THE NON-COLOUR CARRIER. It inherits the caption's
              ink, so nothing here is distinguished by hue at all.
              `aria-hidden` BECAUSE THE ROW'S NAME IS STATED, not computed from
              content — an `aria-label` on this icon would never be announced.
              The words go in `ariaLabel`, which is where §8's "accessible
              label" actually lands on this row. */}
          {drafted && (
            <PencilLine
              aria-hidden
              data-anno-ref="draft-icon"
              className="mr-1 inline size-3 shrink-0 align-[-1px]"
            />
          )}
          {taskLed ? (
            /* ═══ THE DISPOSITION ALONE (arch-F) ═══
               arch-E put the teen name here with the disposition beside it. The
               name moved up to line 1 where the emphasis went, so repeating it
               here would spend the caption on a string already six pixels above.
               THE MENTOR IS STILL GONE — removed in arch-E, and for the same
               reason: they do not perform a billing review, are not accountable
               for it, and cannot change the decision. */
            <>
              {resolving ? (
                /* NEEDS-COPY-NICOLE. VISIBLE, not just dimmed — opacity alone
                   is a state nobody can read (SC 1.4.1). */
                "Closing…"
              ) : item.payload.kind === "billing" ? (
                /* ═══ THE REVIEW TYPE, IN WORDS (§4.4) ═══
                   The lozenges moved to their own column. This line now names
                   the KIND of review — "Change proposed" / "Presentation
                   proposed" / "Renewal proposed" — which is a real improvement
                   over the `Billing code review` label §2.9 removed, because
                   these values DIFFER PER ROW and carry information.
                   ONE CARRIER, AND IT IS THE TEXT. §4.4: a lozenge pair used
                   to mean "a change was proposed" and a single lozenge meant it
                   did not, which made the count a second carrier of the same
                   fact. The lozenges show CODES now and nothing else; this
                   says what kind of review it is. A pair still appears when
                   there are two codes to show, because two codes is data — but
                   it is no longer what a reader has to infer the kind from. */
                /* SHARED WITH TODAY'S PREVIEW (K.1) — one caption expression,
                   and since §5 one glyph decision from the same two arguments. */
                <>
                  {proposalCaptionIcon(
                    item.payload.current?.code ?? null,
                    item.payload.recommended.code
                  ) && (
                    <Repeat2
                      aria-hidden
                      data-anno-ref="renew-icon"
                      className="mr-1 inline size-3 shrink-0 align-[-1px]"
                    />
                  )}
                  {proposalCaption(
                    item.payload.current?.code ?? null,
                    item.payload.recommended.code
                  )}
                </>
              ) : (
                (disposition ?? TASK_KIND_LABEL[item.taskType])
              )}
            </>
          ) : (
            /* TODO-COPY. THE MENTOR'S FIRST NAME ONLY ON A TEEN ROW. A coalesced
               teen row already spends its width on a count and a composition
               line, and the mentor is context rather than the subject — the full
               name is what pushes that line to truncate first. Flag rows keep
               it: there the mentor line is the row's only secondary fact. */
            <>to {isTeenGroup ? mentorFirstName : item.mentorName}</>
          )}
        </span>
      </span>

      {/* ═══ THE PRESENTATION COLUMN (§4.3, §4.4) ═══
          The lozenges left the mentee column and became a column of their own,
          so they line up down the list and under their header. They show CODES
          and nothing else now — the review's KIND is the line under the name.
          FIXED WIDTH, from the shared constant: a column that sized to its
          content would shift every time a row held one code instead of two,
          and the header would line up with none of them. */}
      {item.payload.kind === "billing" && (
        /* SHARED WITH TODAY'S PREVIEW (K.1) — one presentation cell. */
        /* ═══ THE REVIEW CYCLE, NOT THE CODES (§6.1, §6.3) ═══
           Codes leave the list entirely and live only in the detail pane. This
           column carries the cadence position instead. */
        /* `grow={1}` IS THE ROW LAYOUT PASS's EVENNESS — the list's spare width
           is shared with the mentee column instead of all landing on it. Today's
           table leaves it at 0, because three exact thirds cannot have a
           growing member. See the prop's own note. */
        <ReviewCycleCell taskType={item.taskType} grow={1} />
      )}

      {/* pl-6 IS §3's "real separation from the content block" — the chips used
          to sit 6px from a truncating caption, so on a narrow column the two
          read as one run of text. */}
      <span
        className="flex shrink-0 items-center justify-end gap-1.5 pl-6"
        style={item.payload.kind === "billing" ? { width: COL_AGE + 24 } : undefined}
      >
        <RowChips entry={entry} now={now} suppressOverdue={taskLed} />
        {/* ═══ THE COMPOSITION SPAN IS GONE WITH THE TIERS (Phase 4) ═══
            arch-D moved it here from the mentor caption, on the reasoning that
            "on a person-forward row the count and the composition ARE the
            point". The COUNT still is and still sits here. The composition was
            the tier mix, so it went with the tiers.
            THE RULE THAT SURVIVES: never colour alone. The alarm budget spends
            colour on the escalation treatment and nothing else, which is why the
            count beside this is text. */}
        {/* ═══ THE ONE TEMPORAL FACT ═══
            MONO AND TABULAR ON BOTH PATHS, so the column reads as a column and a
            live figure does not jitter as its digits change width.
            THE WEIGHT IS REAL HERE, unlike anywhere else on this row. MEASURED by
            rendering both to a canvas and summing ink: the mono stack draws 41%
            more ink at 700 than at 400 (79,171 vs 56,058), because a system
            monospace ships a bold. Lausanne draws the SAME at both, which is why
            the name cannot use weight and reaches for Avantt instead. So the two
            emphasised elements on this surface are emphasised by two different
            faces, and neither is competing for the same channel.
            DEADLINE-FORWARD takes it: "when is this owed" is the question the
            surface answers. PERSON-FORWARD keeps age quiet — on a coalesced
            picture there is no single deadline to count to, because the members'
            SLAs differ by tier. */}
        {/* ═══ ONE EMPHASISED ELEMENT, AND arch-E MOVED WHICH ONE ═══
            arch-D gave the countdown mono-bold because it was the row's only
            emphasis and Lausanne has no weight axis. arch-E puts the JOB on line
            1 at the display face, so a bold countdown would be a second
            emphasis — measured, the probe counted two on every row.
            IT STAYS PROMINENT WITHOUT THE WEIGHT: 14px, `--text-primary`, mono
            and tabular, right-aligned in a column of figures. A column IS
            scannable without being bold, which is what "deadline as the
            scannable fact" actually asked for; what it does not need is to win
            the weight channel from the thing that names the row.
            A SUBJECT ROW KEEPS THE BOLD — on Monitoring's imminent flags the
            countdown is still the only emphasis, because line 1 is a name at
            regular weight there. */}
        {/* ═══ THE RIGHT ZONE'S ONE ELEMENT (arch-F) ═══
            Mono, tabular, SECONDARY ink. The bucket header carries the urgency —
            "Overdue" and "Due today" are the alarm — so this fact informs rather
            than alarms: it answers "which hour" and "how late", questions the
            header cannot. Primary ink at 14px made it the loudest thing in the
            row's right half and put it in competition with the breach chip
            beside it. */}
        {/* ═══ 14/20, AND THE OLD 13px WAS OFF THE RAMP (row layout §1) ═══
            "Cycle and Review age type size — up a step. They are column data,
            not metadata, and currently read as subordinate to the mentee name
            when they are peers."
            THE STEP IS ALSO A CORRECTION. Bloom's ramp is 32/40 · 24/32 ·
            16/24 · 14/20 · 12/16, and all three `taskLed` branches here were
            `text-[13px]` — an invented size, and the exact defect
            `view-presets.test.ts` says "the last pass retired from these rows
            (11, 13 and 13.5px)". IT DID NOT REACH THIS ONE: that test reads the
            GEOMETRY TABLE, and this size is an inline class the table does not
            own. So the ramp guard passed while a 13px value sat on every row.
            MEASURED BEFORE: 13px / 19.5px computed. The `leading-[18px]` that
            once sat beside it is gone from this branch, so the line-height was
            the 1.5 default rather than any declared pair — a second way the
            value was off the ramp. 14/20 is declared, so it cannot fall back.
            IT DOES NOT BECOME THE ROW'S FOCAL POINT. arch-F's rule is one
            emphasised element per ZONE, and the right zone's emphasis is still
            carried by nothing — this is secondary ink at regular weight. The
            name stays strongest: 16px Avantt in primary ink, a face worth a
            measured +19% ink over the text face. Size went up one step; the
            weight and ink channels did not move. */}
        <span
          className={cn(
            "shrink-0 tabular-nums",
            taskLed
              ? isResponse
                ? /* ON THE SATURATED BAND: the fact sits on the respond fill, so
                     it takes that pair's ink rather than the clay breach ink —
                     and goes semibold once the five minutes are gone. */
                  cn(
                    "text-[14px] leading-[20px] text-[var(--task-respond-fg)]",
                    overdue && "font-semibold"
                  )
                : overdue
                  ? /* THE ONLY BREACH STATEMENT ON THE ROW NOW — so it carries
                       the ink. Not colour alone: the word "overdue" is in the
                       string and in the accessible name. */
                    "text-[14px] leading-[20px] font-semibold text-[var(--band-clay-fg)]"
                  : "text-[14px] leading-[20px] text-[var(--text-secondary)]"
              : emphasis === "deadline" && !indent
                ? "text-[14px] font-bold text-[var(--text-primary)]"
                : "text-[12px] text-[var(--text-secondary)]"
          )}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {/* ═══ THE COLUMN HEADER CARRIES THE NOUN, SO THE CELL DOES NOT ═══
              `temporal` is "3d open"; under a column headed "Review age" the
              suffix is the header repeated on every row. The cell shows the
              age alone — which is also the Figma's shape.
              THE ACCESSIBLE NAME KEEPS THE NOUN. A screen-reader user reaching
              a row hears its fields in sequence with no column header above
              them, so `temporal` is still what `ariaLabel` is built from: the
              suffix is dropped from the CELL, not from the row. */}
          {item.payload.kind === "billing" ? elapsedLabel(ageAt, now) : temporal}
        </span>
        </span>
        </div>
      </div>
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
function ListSkeleton({ rows, preset }: { rows: number; preset: ViewPreset }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{ height: ROW_GEOMETRY[preset].height }}
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

/** DOMAIN ERROR, INLINE, WITH RETRY (§4). Non-blaming, with a next step
 *  (Somethings voice).
 *
 *  THE SECOND SENTENCE USED TO BE "The other tabs are unaffected", and arch-A
 *  removed the other tabs. It survived the removal because it is a string, not a
 *  reference — nothing type-checks an error message — and it was caught by
 *  reading the error state rather than by any tool. What is left is the part
 *  that was ever actionable: try again. */
function ListError({ subject, onRetry }: { subject: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="max-w-xs text-[14px] leading-[20px] text-[var(--text-secondary)]">
        {/* TODO-COPY. ONE TEMPLATE STRING, not an expression adjacent to text:
            JSX collapses the newline between `{expr}` and the following literal,
            which rendered "Billingdidn't load". The same trap the person record's
            role line already hit once. */}
        {`${subject} didn’t load — try again.`}
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
 *  THE ROUTINE-REVIEW EMPTY STATE MUST NOT CELEBRATE. No "Nice work", no
 *  exclamation, no tick-with-a-flourish — an empty routine queue means nobody has
 *  written anything worth reading, which is neither an achievement nor a problem.
 *  The other three are allowed to read as relief; this one reads as a fact. */
function EmptyList({ domain, line }: { domain: TaskDomain | null; line?: string }) {
  /* TODO-COPY on all three. `routineFlag`'s line — "Nothing in routine review
     right now" — went with the domain in Phase 4; "No open flags" covers every
     flag, which is what one flag type means. */
  const copy: Record<TaskDomain, string> = {
    escalation: "No active escalations.",
    riskFlag: "No open flags.",
    billing: "No billing reviews open.",
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
        {line ?? (domain ? copy[domain] : null)}
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
  id: string;
  label: string;
  closedToday: number;
  /** The height its rows occupied, which is what compresses to zero. */
  height: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function Worklist({
  entries,
  items,
  /** ═══ §5.2 — THE VIEWED SET ═══
   *  Ids the supervisor has opened in the pane. A `Set` so membership is O(1)
   *  per row on a list that can be 123 long, resolved once by the page rather
   *  than subscribed to per row.
   *  DEFAULTS EMPTY, so the surface that does not track viewing — Risk Flags —
   *  is unchanged by the prop existing, and every row there renders the
   *  unviewed treatment it already had. */
  viewed,
  /** ═══ §8 — IDS WITH A SAVED DRAFT ═══
   *  A `Set`, resolved once by the page from `sessionStorage` through the draft
   *  version counter. Empty default, so a surface that does not track drafts is
   *  unchanged by the prop existing. */
  drafted,
  /** §3. Passed only by Care Reviews; omitted, the header is a legend. */
  sort,
  domain,
  subject,
  emptyLine,
  focusBand = null,
  grouping = "tier",
  rowVariant = "subject",
  headersState = "ready",
  /** ═══ THE BUCKET BEHIND YOU (arch-F, F4) ═══
   *  Closed reviews whose undo window has shut, and where a link to the ledger
   *  goes. Empty by default and absent entirely on Monitoring, which has its own
   *  list — a surface that never empties has no completion to rest. */
  completed = [],
  completedSelectedId = null,
  onSelectCompleted,
  activityHref = "",
  /** Items whose undo window is still open. They stay in their bucket, visibly
   *  resolving — see the row's own note. */
  resolvingIds,
  now,
  selectedId,
  state,
  onSelect,
  onRetry,
  preset,
  hasGroups,
}: {
  /** §5.2. See the destructured prop above for why it is a Set. */
  viewed?: ReadonlySet<string>;
  /** §8. Same shape and the same reason. */
  drafted?: ReadonlySet<string>;
  /** §3. */
  sort?: {
    value: CareSort | null;
    onToggle: (column: CareSortColumn) => void;
  };
  /** §5's row scale. Required rather than defaulted — see the geometry note:
   *  a surface that forgot to pass it would render rows the virtualizer is not
   *  measuring, which is the one failure in this file that is invisible. */
  preset: ViewPreset;
  /** ═══ ANY GROUP IN THIS LIST AT ALL (Refinement §1.3) ═══
   *  Not "is THIS row a group" — that is `entry.kind`. A non-group row renders
   *  a 20px spacer so its avatar lines up with a group row's disclosure
   *  chevron, and that only earns its width when a chevron exists somewhere in
   *  the list. MEASURED: every Care Reviews entry is `kind: "item"` (billing
   *  types are not flag tasks, so `list.ts` never coalesces them), so the
   *  spacer was 20px of dead space on every row of that surface — and it was
   *  the reason the two lists still did not align after §1.3 gave both the
   *  same disc. */
  hasGroups: boolean;
  /** ═══ `readonly` SINCE §3 ═══
   *  The page hands this the SORTED array, and the sort must be the last thing
   *  that decides order. `readonly` is what says so at the boundary: an
   *  in-place `entries.sort(...)` anywhere below would be a second ordering
   *  applied after the first, and it would not be visible at the call site.
   *  The band builders widened to match rather than the array being copied —
   *  neither mutates, and copying would have made the unsorted path allocate. */
  entries: readonly ListEntry[];
  /** THE WHOLE DOMAIN'S ITEMS, open and resolved. Needed only by band
   *  retirement, which reports how many of a cleared tier closed today — a fact
   *  that by definition is not in `entries`, since `entries` is the open set. */
  items: TaskItem[];
  /** ═══ THE DOMAIN IS OPTIONAL NOW, AND THAT IS arch-B ═══
   *
   *  Tasks is one domain and names itself from it. Monitoring is THREE TIERS
   *  ACROSS TWO domains — imminent and clinical are `riskFlag`, routine is
   *  `routineFlag` — so there is no single domain for it to pass, and passing one
   *  of the two would put "Risk flags worklist" on a list that also holds routine
   *  rows.
   *
   *  `null` disables exactly two things and nothing else: the per-domain empty
   *  line (supply `emptyLine`) and the scroll-position reset's domain guard,
   *  which exists to stop a TAB SWITCH from restoring a scroll offset measured in
   *  a different list. Monitoring has no tab switch, so there is nothing for that
   *  guard to catch. */
  domain: TaskDomain | null;
  /** What the list is called, in the tree's accessible name and the loading and
   *  error lines. Defaults to the domain's label. */
  subject?: string;
  /** The empty line, when `domain` is null. */
  emptyLine?: string;
  /** ═══ WHAT THE BANDS MEAN (arch-E) ═══
   *
   *  `"tier"` groups by task type — Monitoring's Imminent / Clinical review /
   *  Routine review, unchanged by this phase.
   *
   *  `"deadline"` groups by WHEN work is due, which is what Tasks needs: its
   *  type groups took the verb off the row AND destroyed deadline order across
   *  buckets, so the list restarted its countdown at every header. See
   *  `deadline-buckets.ts` for the measurement and for why buckets are a
   *  partition of the one sort rather than a second ordering.
   *
   *  ONE AXIS, TWO VALUES, rather than two components: everything below this —
   *  the sections, the offsets, the sticky headers, the keyboard order — is
   *  identical either way, and forking the list to change what a header says
   *  would have been two virtualizers to keep in step. */
  grouping?: "tier" | "deadline" | "none";
  /** ═══ THE ROW'S ANATOMY — TWO AXES, NOT ONE (arch-E) ═══
   *
   *  `"subject"` is arch-D's row: identity disc, name on line 1, `to {mentor}`
   *  beneath. `"task"` is arch-E's: a task-type icon, the JOB on line 1, and the
   *  subject plus its disposition beneath.
   *
   *  SEPARATE FROM `emphasis`, AND CONFLATING THEM WAS A BUG. A first pass keyed
   *  the anatomy on `emphasis === "deadline"`, which is also true of Monitoring's
   *  IMMINENT rows — so those lost their mentor and their identity disc, on the
   *  one surface where both are load-bearing. The probe caught it.
   *  They are genuinely two questions: WHICH element is emphasised (arch-D,
   *  derived from the obligation) and WHAT the row is made of (arch-E, a property
   *  of the surface). Monitoring's imminent rows want deadline emphasis AND
   *  subject anatomy, which only two axes can express. */
  rowVariant?: "subject" | "task";
  /** ═══ arch-C's STAGE LINK LANDS HERE ═══
   *  A band to bring into view on arrival. Home's shift sequence gives each stage
   *  one way in, and "the imminent tier" has to mean more than "the top of a
   *  hundred-row list". Scrolled to ONCE per value — a reader who then scrolls
   *  away is not dragged back, because the link expressed where to START. */
  focusBand?: TaskType | null;
  /** ═══ THE HEADERS RESOLVE BEFORE THE ROWS (arch-B) ═══
   *  Monitoring's load hierarchy puts the band counts ahead of the rows, because
   *  "how much is there, and at which tiers" is the question a supervisor asks
   *  before "which specific ones". While this is "loading" the header renders its
   *  label with the COUNT withheld rather than a placeholder count, which would
   *  be a number that is wrong for 240ms. */
  headersState?: SurfaceState;
  completed?: CompletedEntry[];
  completedSelectedId?: string | null;
  onSelectCompleted?: (entry: CompletedEntry) => void;
  activityHref?: string;
  resolvingIds?: ReadonlySet<string>;
  now: number;
  /** The selected ENTRY id — a group id for a collapsed group, an item id
   *  otherwise. */
  selectedId: string | null;
  state: ListState;
  onSelect: (entry: ListEntry, item: TaskItem) => void;
  onRetry: () => void;
}) {
  /** ═══ THE ROW HEIGHT, READ ONCE PER RENDER ═══
   *  Every offset below computes from `rowH` — the window, the spacers, the
   *  section tops, `revealRow`'s arithmetic and the skeleton's count. Reading it
   *  once is what stops two of those disagreeing inside one render, which is the
   *  drift the geometry note warns about and the reason the height was a
   *  constant in the first place. */
  const geo = ROW_GEOMETRY[preset];
  const rowH = geo.pitch;
  /** TODO-COPY. The list's own name, in three places that must agree. */
  const subjectLabel = subject ?? (domain ? DOMAIN_LABEL[domain] : "Worklist");
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
  /** ═══ THE ONE TICKING VALUE ON THE SURFACE (arch-G, G2) ═══
   *  Minute-granular, and read by exactly one thing: the elapsed counter on a
   *  live escalation's row. Everything else on this page measures from the
   *  frozen mount clock, deliberately — see `tasks-page.tsx`. A response task's
   *  number is the one that is useless if it does not move. */

  /** ═══ AND "none" IS A THIRD VALUE NOW (addendum §2.9) ═══
   *  Care Reviews has no deadline to group by and one task type to group by,
   *  so it groups by nothing: one unlabelled band holding every row, in the
   *  comparator's order, which with no SLA is oldest-first.
   *  ONE BAND RATHER THAN A SECOND CODE PATH — every offset, sticky header,
   *  keyboard sequence and virtualiser measurement below reads `bands`, and a
   *  branch that skipped them would be a second list to keep in step. The
   *  header is suppressed below, by a rule that already existed for exactly
   *  this: a single band's header names the whole list. */
  const bands = useMemo(
    () =>
      grouping === "none"
        ? [{ id: "all", label: "", entries: [...entries], taskCount: entries.length }]
        : grouping === "deadline"
          ? deadlineBandsFor(entries, now)
          : bandsFor(entries),
    [entries, grouping, now]
  );
  /* ═══ A SINGLE UNLABELLED BAND DRAWS NO HEADER (addendum §2.9) ═══
     `bandsAreMeaningful` answers "is there anything to group"; this adds the
     case §2.9 creates — one band whose label is empty, whose header would
     restate the page title. Same rule that removed the one-tab row in arch-A
     and the subject chips in §2.1. */
  const showBands = bandsAreMeaningful(bands) && bands.some((b) => b.label !== "");

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
      y += rows.length * rowH;
    }
    return out;
    /* `rowH` IS A REAL DEPENDENCY, NOT A LINT APPEASEMENT. Every `rowsTop` in
       this table is accumulated from it, so a preset change that did not
       recompute here would leave the virtualizer measuring 56px rows while the
       DOM rendered 80px ones — the exact drift the geometry note describes,
       and the reason it is invisible: nothing throws, the list simply scrolls
       to the wrong row. */
  }, [bands, showBands, expanded, rowH]);

  /** The flattened, visible sequence — what the arrow keys walk. */
  const visible = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  /** Absolute offset per row id, so the keyboard can scroll a row into view
   *  without it being mounted first. */
  const offsets = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sections) {
      s.rows.forEach((r, i) => m.set(r.id, s.rowsTop + i * rowH));
    }
    return m;
    // Same reason as `sections` above — every offset is a multiple of `rowH`.
  }, [sections, rowH]);

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
  const winTop = viewport.top - OVERSCAN * rowH;
  const winBottom = viewport.top + (viewport.height || 900) + OVERSCAN * rowH;

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
    else if (top + rowH > el.scrollTop + vh) next = top + rowH - vh;
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

  /** ═══ BRING THE LINKED BAND INTO VIEW, ONCE ═══
   *
   *  `sections` already carries every band's absolute offset, so this is the same
   *  arithmetic `revealRow` uses rather than a `scrollIntoView` that would scroll
   *  the pane and the page with it.
   *
   *  ONCE PER VALUE, tracked in a ref: an effect that re-ran on every render
   *  would yank a reader back to the band they arrived at every time the list
   *  re-rendered underneath them — which on this surface is every resolve. The
   *  link says where to START, not where to stay. */
  const focusedBand = useRef<string | null>(null);
  useEffect(() => {
    if (!focusBand || focusedBand.current === focusBand) return;
    const section = sections.find((s) => s.band.id === focusBand);
    if (!section) return;
    focusedBand.current = focusBand;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, section.rowsTop - (showBands ? HEADER_H : 0));
    setViewport((v) => ({ ...v, top: el.scrollTop }));
  }, [focusBand, sections, showBands]);

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
  /** ═══ RETIREMENT IS A TIER'S, NOT A BUCKET'S (arch-E) ═══
   *
   *  A cleared tier reports the clearance — "Imminent — cleared · 1 today" —
   *  because the moment contains information: that tier is DONE. A deadline
   *  bucket emptying does not mean that. It can empty because the work was done
   *  OR because the clock moved and every item slid into the next bucket, and
   *  `closedTodayInBand` counts by TASK TYPE, so it could not tell a reader which
   *  of those happened even if the message were wanted.
   *
   *  So a bucket simply stops rendering when it empties, which is also why empty
   *  buckets never render in the first place. Gated rather than guarded inside
   *  the effect, so the whole mechanism is inert on Tasks rather than running and
   *  producing nothing. */
  const lastSeen = useRef<
    Map<string, { label: string; ids: string[]; height: number; domain: TaskDomain | null }>
  >(new Map());

  useEffect(() => {
    if (grouping !== "tier") return;
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
      if (domain !== null && prev.domain !== domain) continue;
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
                closedToday: closedTodayInBand(items, id as TaskType, now),
                height: prev.height,
              },
            ]
      );
    }

    for (const s of sections) {
      next.set(s.band.id, {
        label: s.band.label,
        ids: s.rows.filter((r) => !r.child).flatMap((r) => itemsOf(r.entry).map((i) => i.id)),
        height: s.rows.length * rowH,
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

  if (state === "loading") {
    /* ═══ THE HEADERS CAN ARRIVE BEFORE THE ROWS (arch-B) ═══
     *
     *  Monitoring's load hierarchy resolves band counts at stage 2 and rows at
     *  stage 3, because "how much is there, and at which tiers" is the question a
     *  supervisor asks before "which specific ones". That staging did nothing at
     *  first: this branch returned a flat skeleton and the sections — which is
     *  where the headers live — only rendered once the whole list was ready. The
     *  probe caught it by looking for a band name 520ms in and finding none.
     *
     *  So when the headers have resolved and the rows have not, the bands render
     *  with skeleton rows beneath them, each band's skeleton as tall as its own
     *  contents. A reader sees the shape of the caseload before its detail, which
     *  is the whole point of ordering the two.
     *
     *  Tasks never reaches this branch with `headersState` set, so its loading
     *  state is byte-identical to what it was. */
    const headersReady = headersState === "ready" && showBands && bands.length > 0;
    return (
      <div className={cn(frame, "h-full")} ref={scrollerRef}>
        {headersReady ? (
          bands.map((band) => (
            <div key={band.id} role="group" aria-label={bandHeaderLabel(band, subjectLabel)}>
              <WorklistGroupHeader label={band.label} count={band.taskCount} />
              <ListSkeleton rows={Math.min(band.entries.length, 6)} preset={preset} />
            </div>
          ))
        ) : (
          /* Enough rows to fill whatever height this frame got, so the load does
             not read as a five-item list. */
          <ListSkeleton
            rows={Math.max(5, Math.ceil((viewport.height || 560) / rowH))}
            preset={preset}
          />
        )}
        <p className="sr-only" role="status">
          {/* TODO-COPY */}
          Loading {subjectLabel}.
        </p>
      </div>
    );
  }
  if (state === "error")
    return (
      <div className={frame}>
        <ListError subject={subjectLabel} onRetry={onRetry} />
      </div>
    );
  if (entries.length === 0 && retiring.length === 0)
    return (
      <div className={frame}>
        <EmptyList domain={domain} line={emptyLine} />
      </div>
    );

  /** ═══ THE PINNED BUCKET HAS TO BE HEARD, NOT ONLY SEEN (arch-G, G7) ═══
   *
   *  Everything that makes a live escalation impossible to miss is visual: the
   *  saturated fill, the sticky position at the top of the scroller, the bucket
   *  that never windows. A screen-reader user gets none of it — they meet the
   *  pinned rows as the first two `treeitem`s of a list of twenty-eight, in a
   *  group whose label is the only thing distinguishing them.
   *
   *  SO THE COUNT IS ANNOUNCED. Polite, not assertive: this is a standing fact
   *  about the list a reader has just arrived at, not an interruption — and
   *  Monitoring's escalation region already holds the surface's one assertive
   *  region, which its own probe asserts is the only one.
   *  IT ALSO UPDATES, which is the part a static label could not do: an
   *  escalation arriving or being recorded changes this sentence, and that
   *  change is exactly what a reader working through the list needs to hear. */
  const pinnedCount =
    sections.find((sec) => sec.band.id === "needsResponse")?.rows.length ?? 0;

  return (
    <>
      {pinnedCount > 0 && (
        /* ═══ OUTSIDE THE TREE, AND THAT IS NOT A STYLE CHOICE ═══
           MEASURED by axe: `aria-required-children`. `role="tree"` accepts
           `treeitem` and `group` and nothing else, so a `<p role="status">`
           inside it invalidates the whole widget's content model — the same
           trap this file's header records for `<h3>` band headings and for a
           nested `<button>`. It is a SIBLING, and `sr-only` takes it out of
           flow so the scroller's layout is untouched. */
        <p className="sr-only" role="status" aria-live="polite">
          {/* NEEDS-COPY-NICOLE. NAMES THE WORK, not the treatment: "highlighted
              in red" would describe a thing this reader cannot see. */}
          {`${pinnedCount} escalation${pinnedCount === 1 ? "" : "s"} need${
            pinnedCount === 1 ? "s" : ""
          } a response now, at the top of the list.`}
        </p>
      )}
    <div
      ref={scrollerRef}
      onKeyDown={onKeyDown}
      /* ═══ THE SCROLLER IS NOT THE TREE ANY MORE ═══
         It carried `role="tree"` and `aria-label` as well as the scroll, and
         that made every other thing in the scroller a child of the tree.
         MEASURED by axe, 9 of them — one per viewport on D10 — all
         `aria-required-children` on this one element: `tree` accepts `treeitem`
         and `group` and NOTHING else, and this element owned two roleless divs
         besides its groups. The column header, and the completed-today band.
         THE ROLE MOVED ONE LEVEL IN RATHER THAN THE CHILDREN BEING RELABELLED,
         because relabelling would have been the dodge: a `role="group"` on the
         sort header would satisfy axe while claiming a row of controls ABOUT
         the list is content IN it, and `toolbar` — the role it actually wants
         — is not a legal tree child either. The completed band is a plainer
         case: it is a separate `ul role="list"` holding a separate selection,
         which its own note calls "the other selection". Neither is queue
         content, so neither belongs inside the tree.
         WHAT STAYS HERE: the scroll, the ref the virtualizer measures, and
         `onKeyDown`. The handler is deliberately still on the element that
         contains BOTH the header and the rows, which is where it already was
         — so `j`/`k` reach the list from the header's sort buttons exactly as
         before, and this is a change to the a11y tree and nothing else.
         ═══ THE LIST IS ITS OWN SCROLLER (Part 3) ═══
         It used to sit inside a scrolling column, which was fine at eight rows and
         wrong at fifty: a sticky band header inside a non-scrolling element sticks
         to nothing, so "Imminent — 23" would scroll away and the reader forty rows
         down would have no idea which tier they were in. Moving the scroll here
         gives the headers something to stick to — the card's own top edge. */
      data-anno-ref="tasks-worklist-scroller"
      /* ═══ CONTENT-SIZED WITH A FLOOR (§2) ═══
         `h-full` made the card absorb the page, so a two-row queue rendered
         inside a box the height of the viewport — §2 is right that this reads
         as a rendering fault rather than a short list. `max-h-full` keeps the
         scroll bounded by the page; the floor is three rows at the current
         preset, the smallest count that still reads as a list. */
      /* CONTENT-SIZED AND STILL SHRINKABLE — the full reasoning is on
         Monitoring's scroller, and the short form is that `max-h-full` meant
         100% of a column that now also holds a toolbar, so the page started
         scrolling. */
      style={{ minHeight: rowH * LIST_MIN_ROWS }}
      className={cn(frame, "min-h-0 overflow-y-auto overscroll-contain")}
    >
      {/* ═══ THE TABLE HEADER, ON THE BILLING SURFACE ONLY (§4.3) ═══
          `Worklist` is Care Reviews' list and nothing else's today, but the
          guard is on the DATA rather than on that fact: a header naming
          "Presentation" over rows that carry none would be a legend for
          columns that are not there. */}
      {entries.some((e) => paneItemFor(e).payload.kind === "billing") && (
        <ReviewRowHeader
          sort={sort}
          disc={ROW_GEOMETRY[preset].disc}
          /* THE ROW'S LEADING SLOT, so "Mentee" sits over the names rather
             than 16px to their left — see the header's own note. */
          markerWidth={MARKER_SLOT}
          /* §6.1: the codes column became the cadence column, and it is half
             its width — which is what gives the mentee column back the room
             §6.5's collapse took. */
          presentationWidth={COL_REVIEW}
          sticky
        />
      )}

      {/* ═══ THE TREE IS THE QUEUE, AND ONLY THE QUEUE ═══
          Its children are the band groups and the retiring bands, which are
          `role="group"` already — so the content model is legal by
          construction rather than by exception. `aria-label` comes with the
          role: it names the widget a reader is navigating, and it named the
          scroller before.
          NO BOX OF ITS OWN BEYOND THE DEFAULT BLOCK. It adds a level to the
          DOM, and the one thing that could have noticed is a `position: sticky`
          child, whose containing block is now this wrapper rather than the
          scroller. The only sticky section is the pinned escalation band, and
          it cannot occur here: `pinned` is `band.id === "needsResponse"`, which
          only the `deadline` grouping produces, and Care Reviews — the one
          surface that mounts `Worklist` — groups by nothing since addendum
          §2.9. Measured: one band, id `all`, on every fixture. Stated rather
          than assumed, because it is the thing a reader should check first if
          a grouping ever comes back. */}
      <div role="tree" /* TODO-COPY */ aria-label={`${subjectLabel} worklist`}>
      {sections.map((section) => {
        const n = section.rows.length;
        /** ═══ THE PINNED BUCKET IS NEVER WINDOWED (arch-G, G2) ═══
         *  A live escalation may not leave the viewport, which means its rows
         *  cannot be subject to the virtualizer at all: the window would unmount
         *  them the moment a reader scrolled past, and a sticky container with
         *  unmounted children is an empty band that claims an escalation is
         *  visible. It holds one or two rows on every shipped fixture, so
         *  rendering all of them costs nothing the spacers were protecting. */
        const pinned = section.band.id === "needsResponse";
        const first = pinned ? 0 : clamp(Math.floor((winTop - section.rowsTop) / rowH), 0, n);
        const last = pinned ? n : clamp(Math.ceil((winBottom - section.rowsTop) / rowH), 0, n);
        return (
          <div
            key={section.band.id}
            /* A `group`, not an `<h3>`: `role="tree"` accepts `treeitem` and
               `group` as children and nothing else, so a heading element here
               would have broken the tree's content model. The band's name and
               count ride on the group's label instead, which is also how a
               screen reader announces it — "Imminent — 23, group". */
            role="group"
            aria-label={bandHeaderLabel(section.band, subjectLabel)}
            data-bucket={section.band.id}
            className={cn(
              /* STICKY ABOVE EVERY OTHER BAND. `top-0` with a higher z than the
                 other headers (`z-10`), so it pins over them rather than under
                 them as they scroll up into it. */
              pinned && "sticky top-0 z-20"
            )}
          >
            {showBands && (
              <WorklistGroupHeader
                label={section.band.label}
                count={headersState === "ready" ? section.band.taskCount : null}
                /* THE BUCKET'S OWN URGENCY (arch-G). Only the deadline grouping
                   has tones — Monitoring's tier bands stay quiet, because there
                   the tier is a kind of work rather than a clock. */
                tone={
                  grouping !== "deadline"
                    ? "quiet"
                    : section.band.id === "needsResponse"
                      ? "respond"
                      : section.band.id === "overdue"
                        ? "breach"
                        : "quiet"
                }
              />
            )}
            {/* SPACERS, NOT RENDERED ROWS. Two divs stand in for everything
                outside the window, which is what keeps a hundred-row list at a
                dozen mounted nodes. */}
            {first > 0 && <div aria-hidden style={{ height: first * rowH }} />}
            {section.rows.slice(first, last).map((v, vi) => (
              <Row
                key={v.id}
                preset={preset}
                hasGroups={hasGroups}
                /* §5.2. Absent `viewed` means the surface does not track it, so
                   nothing is marked — which is Risk Flags' behaviour. */
                unviewed={viewed ? !viewed.has(v.id) : false}
                /* §8. Absent means the surface does not track drafts. */
                drafted={drafted?.has(v.id) ?? false}
                /* ═══ WHICH ROW GOES WITHOUT A HAIRLINE ═══
                   Under a band header, every row keeps one: the header is a
                   filled strip and the line beneath it separates two different
                   things rather than doubling a border.
                   With no header — which is every row on Care Reviews since the
                   grouping was removed — only the very first row drops it, so
                   the card's own border is not shadowed by a hairline 1px
                   inside it. `first + vi` is the ABSOLUTE index: `first` is the
                   virtualizer's window start, and `vi` alone would put a gap at
                   the top of every scroll position. */
                /* ═══ AND NOT DIRECTLY UNDER THE SELECTION ═══
                   §1.2's full-width divider and the inset pill are both
                   correct and they meet badly at one edge: the next row's
                   hairline sits 4px below the selected pill and reads as an
                   underline on it rather than as a boundary between two rows.
                   The row ABOVE the line is the one that owns the problem, so
                   the row below it drops its hairline. `first + vi - 1` is the
                   absolute previous index — `vi` alone would compare against
                   the wrong row at every scroll position. */
                hairline={
                  (showBands || first + vi > 0) &&
                  section.rows[first + vi - 1]?.id !== selectedId
                }
                resolving={resolvingIds?.has(v.item.id) ?? false}
                entry={v.entry}
                variant={rowVariant}
                /* ═══ THE ROW SAYS WHICH GROUP IT IS IN, BECAUSE IT NO LONGER
                       SHOWS IT (arch-D, D1) ═══
                   The task type and the tier came off the rows deliberately —
                   they are in the sticky header now. A sighted reader gets them
                   from that header; a screen-reader user was getting them from
                   nowhere, because the header is `aria-hidden` and the enclosing
                   group's label is announced once on entry and not again forty
                   rows later. Putting the band on each row's own name is what
                   makes the two readings equivalent. */
                group={section.band.label}
                now={now}
                optionId={`task-option-${v.id}`}
                selected={v.id === selectedId}
                expanded={expanded.has(v.id)}
                tabbable={visible[activeIndex]?.id === v.id}
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
            {last < n && <div aria-hidden style={{ height: (n - last) * rowH }} />}
          </div>
        );
      })}

      {/* INSIDE THE TREE, because a retiring band IS queue content — a cleared
          tier reporting its clearance, `role="group"` already, in the position
          the reader last saw its rows. */}
      {retiring.map((r) => (
        <RetiringBand
          key={r.id}
          label={r.label}
          closedToday={r.closedToday}
          height={r.height}
        />
      ))}
      </div>

      {/* AFTER EVERY BUCKET AND AFTER THE RETIRING BANDS — the last thing in the
          scroller, which is where "behind you" belongs. Outside the virtualizer
          on purpose: it is collapsed by default and holds a shift's worth of
          rows, not a hundred, so the spacer arithmetic has nothing to gain here
          and everything to lose.
          AND OUTSIDE THE TREE, which is new and is the point: its root is a
          roleless div wrapping a toggle and a `ul role="list"`, so as a child
          of `role="tree"` it broke the tree's content model. It is a separate
          list with a separate selection and it was never queue content. */}
      {onSelectCompleted && (
        <CompletedGroup
          entries={completed}
          selectedId={completedSelectedId}
          onSelect={onSelectCompleted}
          activityHref={activityHref}
        />
      )}
    </div>
    </>
  );
}

/** THE STICKY BAND HEADER. Quiet by construction: muted ink, no fill beyond the
 *  card's own, no rule of its own — the first row's hairline already separates it.
 *  It is a wayfinding label, not a section title competing with the rows. */
