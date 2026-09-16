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

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, Phone, RotateCcw } from "lucide-react";
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
import { discFor } from "@/lib/tasks/avatar";
import { useMinuteTick } from "@/lib/use-clock";
import { CompletedGroup, type CompletedEntry } from "@/components/tasks/completed-group";
import { deadlineBandsFor, deadlineFactFor } from "@/lib/tasks/deadline-buckets";
import { TASK_KIND_ICON, TASK_KIND_LABEL } from "@/lib/tasks/task-kind";
import { proposalPreview } from "@/lib/record/proposal-kind";
import { escalationStateLine } from "@/lib/tasks/escalation-response";
import {
  deadlineLabel,
  rowEmphasisFor,
  type RowEmphasis,
} from "@/lib/tasks/row-emphasis";
import { compositionLabel } from "@/lib/tasks/monitoring-list";
import { DOMAIN_LABEL, isBreached, type TaskDomain, type TaskItem, type TaskType } from "@/lib/tasks/types";
import type { SurfaceState } from "@/lib/tasks/load-plan";
import {
  GROUP_HEADER_H,
  RetiringBand,
  WorklistGroupHeader,
} from "@/components/tasks/group-header";
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
  /** A ticking timestamp, minute-granular, or 0 before mount. Only the response
   *  bucket reads it. */
  liveNow = 0,
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
}: {
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
  liveNow?: number;
}) {
  const item = paneItemFor(entry);
  const isGroup = entry.kind === "group";
  const isTeenGroup = isGroup && entry.groupBy === "teen";
  const disc = discFor(item.teenId);
  const mentorFirstName = item.mentorName.split(" ")[0];
  const KindIcon = TASK_KIND_ICON[item.taskType];
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
      ? proposalPreview(item.payload.current?.code ?? null, item.payload.recommended.code)
      : escalationStateLine(item);
  /** TODO-COPY. "3 clinical · 2 routine" — the tiers a teen row stands for, in
   *  the band order, and only the tiers actually present. Null on a flag row and
   *  on a conversation group, where every member is the same tier by
   *  construction (taskType is half that key) and the line would restate the
   *  header. */
  const composition = isTeenGroup ? compositionLabel(entry.members) : null;
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
      ? deadlineFactFor(
          item.slaDeadline,
          /* THE LIVE CLOCK, FOR THIS BUCKET ONLY. Everything else on the page
             reads the frozen mount clock — see the page's own note on why — and a
             response task is the one row whose number is useless if it does not
             move. `liveNow` falls back to the frozen value before mount. */
          isResponse && liveNow > 0 ? liveNow : now,
          elapsedLabel,
          isResponse ? { openedAt: item.openedAt } : undefined
        )
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
    composition,
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
      style={{
        height: ROW_H,
        ...(isResponse ? { backgroundColor: "var(--task-respond-bg)" } : null),
      }}
      className={cn(
        /* EXACT HEIGHT, NOT A MINIMUM — see ROW_H. `border-t` on EVERY row,
           including the first: a band header sits above it and the hairline is
           what separates the two. The old `first:border-t-0` made the first row
           55px while every other row was 56, which the virtualizer would have
           accumulated into a real offset error. */
        "flex cursor-pointer items-center gap-3 border-t border-[color:var(--border-subtle)] px-4 transition-colors",
        // SELECTED AND FOCUSED ARE DISTINCT (§4): selected is a filled ground,
        // focus is the ring. A reader arrowing through a list sees the ring move
        // while the fill stays put.
        /* ═══ THE ONE SATURATED FILL IN THE TASKS LIST (arch-G, G2) ═══
           A live escalation, and nothing else on this surface. The alarm budget
           has room for exactly one filled treatment and this is where it is
           spent — the same rule Monitoring's escalation region follows, and the
           reason the Overdue bucket gets a tint rather than a fill. */
        isResponse && "text-[var(--task-respond-fg)]",
        selected
          ? isResponse
            ? "ring-2 ring-inset ring-[var(--task-respond-fg)]"
            : "bg-[var(--surface-s2)]"
          : isResponse
            ? "transition-opacity hover:opacity-95"
            : "hover:bg-[var(--tint-hover)]",
        indent && "pl-11",
        /* RESOLVING: dimmed, and the word is in the accessible name above. The
           row keeps its height and its place — the whole point is that the list
           does not move while the undo window is open. */
        resolving && "opacity-55",
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

      {/* ═══ WHAT SITS AT THE HEAD OF THE ROW — PERSON OR JOB (arch-E) ═══
          PERSON-FORWARD (Monitoring's coalesced rows): the identity disc. HUE
          MEANS WHO, AND NEVER WHAT — not the tier, not breach, not the flag
          count. See `lib/tasks/avatar.ts`; the short form is that the row already
          carries every state in words and a second colour language would leave a
          reader fluent in neither.
          DEADLINE-FORWARD (Tasks): the TASK-TYPE ICON in a neutral well. The disc
          is gone from these rows and that is a real loss, taken deliberately — a
          supervisor works this queue in deadline order rather than hunting for a
          named teen, and person-first lookup belongs on Mentees. It also makes
          the two surfaces visibly different species, which is correct: Tasks'
          unit is the review, Monitoring's is the person.
          THE WELL IS NEUTRAL, NOT PER-TYPE. A hue per task type would compete
          with breach, which is the one thing colour is spent on here — and with
          one task type on the surface today it would be a colour that never
          varies. The icon plus the label beside it carry the type (SC 1.4.1).
          `aria-hidden` on both: the initial shortens a name printed beside it,
          and the icon duplicates the task name printed beside it. */}
      {taskLed ? (
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-s1)] text-[var(--text-secondary)]"
        >
          <KindIcon className="size-3.5" />
        </span>
      ) : (
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
          style={{ backgroundColor: disc.bg, color: disc.fg }}
        >
          {item.teenDisplayName.charAt(0)}
        </span>
      )}

      <span className="min-w-0 flex-1">
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
            className={cn(
              "truncate text-[14px] leading-[20px]",
              /* ═══ THE FILL CHANGES THE GROUND, SO IT CHANGES THE INK ═══
                 MEASURED by axe: `--text-primary` (#1f1e1d) on the respond fill
                 (#c9351d) is 3.17:1 — a WCAG failure on the most urgent row on
                 the surface. The row root already sets `--task-respond-fg`; this
                 element was overriding it with the ink for the ground it is NOT
                 on. Inheriting instead of restating is the fix. */
              isResponse ? "text-[var(--task-respond-fg)]" : "text-[var(--text-primary)]",
              (taskLed || emphasis === "person") && "font-display"
            )}
          >
            {item.teenDisplayName}
          </span>
          {taskLed && (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-px text-[11px] leading-[15px]",
                /* THE CHIP'S OWN GROUND IS THE FILL, not `--surface-s1`: a pale
                   chip on the escalation red would be a second ground inside a
                   saturated row, which reads as a badge rather than a label. A
                   hairline in the fill's own ink instead. */
                isResponse
                  ? "border border-[color:var(--task-respond-fg)] text-[var(--task-respond-fg)]"
                  : "bg-[var(--surface-s1)] text-[var(--text-secondary)]"
              )}
            >
              {TASK_KIND_LABEL[item.taskType]}
            </span>
          )}
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
          className={cn(
            "block truncate text-[12px] leading-[16px]",
            /* ═══ 1.45:1 — THE WORST PAIR ON THE SURFACE (arch-G, G6) ═══
               MEASURED by axe: `--text-secondary` (#58534b) on the respond fill
               (#c9351d). At 12px. On the line that says "911 dispatched".
               Same cause as line 1: an explicit ink for the default ground,
               restated on a row whose ground is not the default. */
            isResponse ? "text-[var(--task-respond-fg)]" : "text-[var(--text-secondary)]"
          )}
        >
          {taskLed ? (
            /* ═══ THE DISPOSITION ALONE (arch-F) ═══
               arch-E put the teen name here with the disposition beside it. The
               name moved up to line 1 where the emphasis went, so repeating it
               here would spend the caption on a string already six pixels above.
               THE MENTOR IS STILL GONE — removed in arch-E, and for the same
               reason: they do not perform a billing review, are not accountable
               for it, and cannot change the decision. */
            <>
              {resolving
                ? /* NEEDS-COPY-NICOLE. VISIBLE, not just dimmed — opacity alone
                     is a state nobody can read (SC 1.4.1). */
                  "Closing…"
                : (disposition ?? TASK_KIND_LABEL[item.taskType])}
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

      <span className="flex shrink-0 items-center gap-1.5">
        <RowChips entry={entry} now={now} suppressOverdue={taskLed} />
        {/* ═══ THE COMPOSITION MOVED TO THE RIGHT (arch-D, D3) ═══
            It shared the mentor caption, which put the row's PRIMARY fact — how
            much signal this teen is carrying — in the quietest line on the row,
            behind a `to {mentor}` that is only identification. On a person-
            forward row the count and the composition ARE the point, so they sit
            with the other facts where the eye already goes.
            STILL TEXT, NEVER COLOUR ALONE: the alarm budget spends colour on the
            escalation treatment and nothing else, and a row encoding its tier mix
            in hue would be unreadable to anyone who cannot separate two pale
            tints. */}
        {composition && (
          <span className="shrink-0 truncate text-[12px] leading-[16px] text-[var(--text-secondary)]">
            {composition}
          </span>
        )}
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
        <span
          className={cn(
            "shrink-0 tabular-nums",
            taskLed
              ? isResponse
                ? /* ON THE SATURATED BAND: the fact sits on the respond fill, so
                     it takes that pair's ink rather than the clay breach ink —
                     and goes semibold once the five minutes are gone. */
                  cn(
                    "text-[13px] text-[var(--task-respond-fg)]",
                    overdue && "font-semibold"
                  )
                : overdue
                  ? /* THE ONLY BREACH STATEMENT ON THE ROW NOW — so it carries
                       the ink. Not colour alone: the word "overdue" is in the
                       string and in the accessible name. */
                    "text-[13px] font-semibold text-[var(--band-clay-fg)]"
                  : "text-[13px] text-[var(--text-secondary)]"
              : emphasis === "deadline" && !indent
                ? "text-[14px] font-bold text-[var(--text-primary)]"
                : "text-[12px] text-[var(--text-secondary)]"
          )}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {/* TODO-COPY */}
          {temporal}
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
  /* TODO-COPY on all four. */
  const copy: Record<TaskDomain, string> = {
    escalation: "No active escalations.",
    riskFlag: "No open flags.",
    billing: "No billing reviews open.",
    routineFlag: "Nothing in routine review right now.",
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
}: {
  entries: ListEntry[];
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
  grouping?: "tier" | "deadline";
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
  const liveNow = useMinuteTick();

  const bands = useMemo(
    () => (grouping === "deadline" ? deadlineBandsFor(entries, now) : bandsFor(entries)),
    [entries, grouping, now]
  );
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
            <div key={band.id} role="group" aria-label={bandHeaderLabel(band)}>
              <WorklistGroupHeader label={band.label} count={band.taskCount} />
              <ListSkeleton rows={Math.min(band.entries.length, 6)} />
            </div>
          ))
        ) : (
          /* Enough rows to fill whatever height this frame got, so the load does
             not read as a five-item list. */
          <ListSkeleton rows={Math.max(5, Math.ceil((viewport.height || 560) / ROW_H))} />
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

  return (
    <div
      ref={scrollerRef}
      role="tree"
      /* TODO-COPY */
      aria-label={`${subjectLabel} worklist`}
      onKeyDown={onKeyDown}
      /* ═══ THE LIST IS ITS OWN SCROLLER (Part 3) ═══
         It used to sit inside a scrolling column, which was fine at eight rows and
         wrong at fifty: a sticky band header inside a non-scrolling element sticks
         to nothing, so "Imminent — 23" would scroll away and the reader forty rows
         down would have no idea which tier they were in. Moving the scroll here
         gives the headers something to stick to — the card's own top edge. */
      data-anno-ref="tasks-worklist-scroller"
      className={cn(frame, "h-full overflow-y-auto overscroll-contain")}
    >
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
        const first = pinned ? 0 : clamp(Math.floor((winTop - section.rowsTop) / ROW_H), 0, n);
        const last = pinned ? n : clamp(Math.ceil((winBottom - section.rowsTop) / ROW_H), 0, n);
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
            {first > 0 && <div aria-hidden style={{ height: first * ROW_H }} />}
            {section.rows.slice(first, last).map((v) => (
              <Row
                key={v.id}
                resolving={resolvingIds?.has(v.item.id) ?? false}
                liveNow={liveNow}
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
            {last < n && <div aria-hidden style={{ height: (n - last) * ROW_H }} />}
          </div>
        );
      })}

      {retiring.map((r) => (
        <RetiringBand
          key={r.id}
          label={r.label}
          closedToday={r.closedToday}
          height={r.height}
        />
      ))}

      {/* AFTER EVERY BUCKET AND AFTER THE RETIRING BANDS — the last thing in the
          scroller, which is where "behind you" belongs. Outside the virtualizer
          on purpose: it is collapsed by default and holds a shift's worth of
          rows, not a hundred, so the spacer arithmetic has nothing to gain here
          and everything to lose. */}
      {onSelectCompleted && (
        <CompletedGroup
          entries={completed}
          selectedId={completedSelectedId}
          onSelect={onSelectCompleted}
          activityHref={activityHref}
        />
      )}
    </div>
  );
}

/** THE STICKY BAND HEADER. Quiet by construction: muted ink, no fill beyond the
 *  card's own, no rule of its own — the first row's hairline already separates it.
 *  It is a wayfinding label, not a section title competing with the rows. */
