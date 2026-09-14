"use client";

// ═══ THE ESCALATION REGION — the whole lifecycle, in one place ═══
//
// Sits above the flags view and renders ONLY when non-empty. It is not a zone
// that must persist: the flags view is this surface's resting state, and a
// permanently empty band above it would be furniture a reader learns to skip —
// which is the worst possible habit to build above the one region that matters.
//
// ═══ INDIVIDUAL ROWS, NEVER COALESCED ═══
//
// Two escalations on one teen are two events, each with its own responder, its
// own 911 decision and its own write-up. Grouping them would put a count where a
// name belongs and hide one behind a chevron. Too consequential to group, and
// there are one to three of them — a count is not solving a volume problem.
//
// ═══ AN ESCALATION IS NOT FINISHED UNTIL IT IS DOCUMENTED ═══
//
// So all three states live here — active, closed-with-write-up-due, and
// closed-with-write-up-overdue — rather than the closed ones falling off the
// surface into a separate queue. The state chip and the clock both change with
// the state; see `escalation-state.ts` for which field is authoritative and for
// the "20h open" / "Closed Sep 13" contradiction that module exists to end.
//
// ═══ THE ALARM BUDGET, SPENT ONCE ═══
//
// ACTIVE escalations carry the only filled saturated treatment on this surface —
// the same `--task-respond-*` pair the Respond strip used, which is defined in
// `:root` only and deliberately does not theme, because an alarm should be the
// same object in both modes (gap row 214).
//
// AN OVERDUE WRITE-UP DOES NOT GET IT. It is a compliance failure about something
// that is already over; giving it the same treatment would spend the budget twice
// and teach a reader to discount both. It gets the breach chip every other overdue
// thing on the surface gets.

import Link from "next/link";
import { AlertTriangle, FileText, Phone } from "lucide-react";
import { elapsedLabel, escalationHref } from "@/components/tasks/strips";
import { discFor } from "@/lib/tasks/avatar";
import {
  LIFECYCLE_LABEL,
  clockFor,
  isAlarming,
  lifecycleOf,
} from "@/lib/tasks/escalation-state";
import type { SurfaceState } from "@/lib/tasks/load-plan";
import type { TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY. THE CLOCK, IN THE READER'S QUESTION.
 *
 *  An active escalation counts UP — "how long has someone been waiting". A closed
 *  one counts DOWN to its write-up deadline, and past it counts up again. Three
 *  sentences rather than one figure, because a bare "4h" beside a closed
 *  escalation could mean four hours since it closed, four hours left, or four
 *  hours late, and those are three different afternoons. */
export function clockLabel(item: TaskItem, now: number): string {
  const clock = clockFor(item, now);
  if (clock.kind === "elapsed") return `${elapsedLabel(clock.at, now)} elapsed`;
  if (clock.kind === "remaining") return `due in ${elapsedLabel(now, clock.at)}`;
  return `${elapsedLabel(clock.at, now)} overdue`;
}

/** ═══ A FACT ON THE ROW — AND ON THE ALARM ROW IT HAS NO GROUND ═══
 *
 *  MEASURED: the tinted pill this used to draw on the saturated row was
 *  `--task-respond-fg` at 20% over `--task-respond-bg`, which computes to
 *  `#d45d4a`, and white on it is **3.84:1** — a fail for 11.5px text, which
 *  needs 4.5. The pattern came from the Respond strip, so that shipped the
 *  failure too. Axe found 22 instances across four viewports and both themes.
 *
 *  White directly on `--task-respond-bg` is **5.24:1**. A border at the same 20%
 *  mix would not have rescued it either — `#d45d4a` against `#c9351d` is 1.36:1,
 *  under the 3:1 a non-text boundary needs, so it would have been an invisible
 *  fix for a visible failure.
 *
 *  So the alarm row's facts are icon plus text with no ground at all. They were
 *  never told apart by the tint — the icon and the words do that (SC 1.4.1) — and
 *  the row is already one saturated object, so a second fill inside it was
 *  decoration that cost contrast. The calm rows keep the pill, where it separates
 *  a chip from a card that is otherwise the same colour. */
function Fact({
  icon: Icon,
  children,
  alarming,
}: {
  icon: typeof AlertTriangle;
  children: React.ReactNode;
  alarming: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold leading-[16px]",
        alarming
          ? "text-[var(--task-respond-fg)]"
          : "rounded-full bg-[var(--surface-s1)] px-2 py-0.5 font-normal text-[var(--text-secondary)]"
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

function Row({
  item,
  now,
  selected,
  onSelect,
}: {
  item: TaskItem;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const state = lifecycleOf(item, now);
  const alarming = isAlarming(state);
  const p = item.payload;
  const is911 = p.kind === "escalation" ? p.is911 : false;
  const disc = discFor(item.teenId);
  const escalationId =
    p.kind === "escalation" || p.kind === "documentation"
      ? p.escalationId
      : item.objectId;

  /** TODO-COPY. The row, spoken. THE STATE COMES FIRST because it decides
   *  whether this row is read now or later — and on the closed ones it is also
   *  the correction: a reader who hears "Riley T., closed, write-up due in 4
   *  hours" cannot come away thinking anyone is still in danger. */
  const ariaLabel = [
    item.teenDisplayName,
    LIFECYCLE_LABEL[state].replace(" · ", ", "),
    `to ${item.mentorName}`,
    /* 911 ONLY WHEN IT WAS CALLED, on the closed rows. On an active escalation
       both answers are load-bearing — "no 911" is a decision somebody made and a
       responder needs to know it. On a closed one, "no 911" is an absence. */
    is911 ? "911 dispatched" : state === "active" ? "no 911" : null,
    clockLabel(item, now),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    /* ═══ A LIST AND TWO CONTROLS, NOT A LISTBOX ═══
     *
     *  This was `<ul role="listbox">` → `<li>` → `<div role="option">` holding a
     *  link, and axe rejected it four ways at once: `aria-required-children`
     *  (the listbox's options were not its children), `aria-required-parent`
     *  (the options' parent was an `li`), `listitem` (an `li` whose parent had a
     *  role), and `nested-interactive` — an option may not CONTAIN a control,
     *  and this one contained the link that is the whole point of the row. 56
     *  violations, four of the six rules axe reported on this page.
     *
     *  The STRUCTURE was wrong rather than the markup. A listbox is for choosing
     *  one of a set; these rows do two different things — selecting shows the
     *  evidence in the pane, the link leaves for the escalation flow. So it is a
     *  plain list, the row body is a button, and the action is its sibling: both
     *  reachable by Tab, in that order, which is also the order they are used in.
     *  `aria-current` carries which one the pane is showing. */
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2",
        alarming
          ? "text-[var(--task-respond-fg)]"
          : "bg-[var(--surface-card)] text-[var(--text-primary)]",
        selected &&
          (alarming
            ? "ring-2 ring-inset ring-[var(--task-respond-fg)]"
            : "bg-[var(--surface-s2)]")
      )}
      style={alarming ? { backgroundColor: "var(--task-respond-bg)" } : undefined}
      data-anno-ref={`escalation-row:${item.id}`}
      data-escalation-state={state}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={ariaLabel}
        /* SELECTION IS `aria-current`, NOT `aria-pressed`. The button is not a
           toggle — pressing it again does not un-show the pane — and "this is
           the one being shown" is exactly what `current` means. */
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-control)] py-1 text-left",
          RING
        )}
      >
        {alarming ? (
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
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
          <span
            className={cn(
              "block truncate text-[14px] leading-[20px]",
              alarming && "font-semibold"
            )}
          >
            {item.teenDisplayName}
          </span>
          <span
            className={cn(
              "block truncate text-[12px] leading-[16px]",
              alarming
                ? "text-[var(--task-respond-fg)]"
                : "text-[var(--text-secondary)]"
            )}
          >
            {/* TODO-COPY */}
            to {item.mentorName}
          </span>
        </span>

        {/* 911 / NO 911 — on active rows only. See the aria note above: on a
            closed escalation "No 911" is an absence rather than a decision, and
            the row has a state and a deadline to spend its width on. */}
        {(state === "active" || is911) && (
          <Fact icon={Phone} alarming={alarming}>
            {/* TODO-COPY */}
            {is911 ? "911 dispatched" : "No 911"}
          </Fact>
        )}

        <Fact icon={state === "active" ? AlertTriangle : FileText} alarming={alarming}>
          {LIFECYCLE_LABEL[state]}
        </Fact>

        {/* THE CLOCK, mono so a live counter does not jitter as digits change
            width — and so the column reads as a column. */}
        <span
          className={cn(
            "shrink-0 text-[13px] tabular-nums",
            alarming ? "font-semibold" : "text-[var(--text-secondary)]"
          )}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {clockLabel(item, now)}
        </span>
      </button>

      <Link
        href={escalationHref(escalationId)}
        className={cn(
          "inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold",
          alarming
            ? "bg-[var(--task-respond-fg)] text-[var(--task-respond-bg)] transition-opacity hover:opacity-90"
            : "border border-[color:var(--border-contour)] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
          RING
        )}
      >
        {/* TODO-COPY. THE ACTION NAMES THE WORK, NOT THE OBJECT. "Open
            escalation" on a closed one would send a reader looking for a crisis
            that is over; what is waiting for them is the write-up. */}
        {state === "active" ? "Open escalation" : "Open documentation"}
      </Link>
    </li>
  );
}

/** ═══ THE REGION'S OWN SKELETON ═══
 *  Two placeholder rows at the height real ones occupy, so resolving does not
 *  move the flags view under the reader's eye. Two rather than three: the
 *  measured fixtures carry one to three escalations, and a skeleton promising
 *  more than usually arrives is a worse signal than one promising fewer. */
function RegionSkeleton() {
  return (
    <section
      aria-hidden
      className="mt-4 shrink-0 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)]"
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-t border-[color:var(--border-subtle)] px-4 py-3 first:border-t-0"
        >
          <span className="size-7 shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-3 w-40 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
            <span className="block h-2.5 w-24 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
          </span>
          <span className="h-3 w-20 shrink-0 rounded-full bg-[var(--surface-s2)] motion-safe:animate-pulse" />
        </div>
      ))}
    </section>
  );
}

/** ═══ THE REGION FAILING IS NOT THE REGION BEING EMPTY ═══
 *  Absent means "nothing is escalated", which is the good news a supervisor most
 *  wants to be able to trust. If the escalation service is down, saying nothing
 *  would assert that good news from an outage — so the failure is stated, and it
 *  is stated where the region would have been. */
function RegionError() {
  return (
    <section
      role="alert"
      className="mt-4 shrink-0 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-4 py-3"
    >
      <p className="text-[13.5px] leading-[19px] text-[var(--text-secondary)]">
        {/* TODO-COPY. NAMES WHAT IS UNKNOWN rather than what failed: "couldn't
            load escalations" invites the reading "so there are none". */}
        Escalations couldn’t be loaded, so this page can’t say whether any
        are open.
      </p>
    </section>
  );
}

export function EscalationRegion({
  items,
  now,
  state = "ready",
  selectedId,
  onSelect,
}: {
  /** Every escalation-domain item, active and documentation alike, in the one
   *  comparator's order — active first, because `TIER_RANK` says so. */
  items: TaskItem[];
  now: number;
  selectedId: string | null;
  onSelect: (item: TaskItem) => void;
  state?: SurfaceState;
}) {
  if (state === "loading") return <RegionSkeleton />;
  if (state === "error") return <RegionError />;
  if (items.length === 0) return null;

  const active = items.filter((i) => lifecycleOf(i, now) === "active").length;

  return (
    <section
      /* TODO-COPY. NAMES THE WHOLE LIFECYCLE, not "Open escalations" — the region
         holds closed ones too and a landmark that said "open" would repeat, at
         the landmark level, the exact defect the rows were fixed for. */
      aria-label={`Escalations — ${active} active, ${items.length - active} awaiting documentation`}
      data-anno-ref="escalation-region"
      className="mt-4 shrink-0 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)]"
    >
      <ul className="divide-y divide-[color:var(--border-subtle)]">
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            now={now}
            selected={item.id === selectedId}
            onSelect={() => onSelect(item)}
          />
        ))}
      </ul>
    </section>
  );
}
