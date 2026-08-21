"use client";

// RELATIONSHIP TABLE — ONE component, two variants. The mentor's Mentees table
// and the supervisor's Mentors table were two separate implementations (a
// <table> and a PersonRow list); they render the same shape in the Figma, so
// they are one component now and can't drift.
//
// THE DISTINCTION THIS TABLE ENFORCES. A row is a RELATIONSHIP. Presence in the
// list means the pairing exists — that is what the list is for, so it never
// needs a column to say so. A person's PLATFORM STATUS is a different object,
// and the two variants treat it differently on purpose:
//
//   mentees — NO status column. A mentor doesn't administer a teen's account, so
//     offering the control here made "end this pairing" and "change this
//     person's account" one click apart. Non-active platform states surface as a
//     read-only EXCEPTION CHIP after the name: it describes the person, sits
//     with the person's name, and cannot be actuated.
//
//   mentors — status column KEPT. A supervisor is accountable for their mentors'
//     standing, and "In training" is legitimately their business. But the pill
//     opens a CONFIRM (see StatusConfirm in the caller) instead of committing on
//     selection: a one-click employment-status mutation must not ship.
//
// Defaults whisper, exceptions speak: an active mentee carries no chip at all.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  MessageSquare,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { avatarTintFor } from "@/components/record/person-row";
import { MentorStatusBadge } from "@/components/admin/mentor-status-badge";
import { recordHrefFor } from "@/lib/record/subject";
import { chatHrefFor } from "@/lib/record/chat";
import { relJoined } from "@/lib/record/people-demo";
import type { MentorLifecycleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const TH =
  "px-5 py-3 text-left text-[14px] font-medium leading-[20px] text-[var(--text-secondary)]";

export type RelationshipVariant = "mentees" | "mentors";

/** One row, already resolved by the caller — this component does no lookups, so
 *  both variants are guaranteed to read their data the same way. */
export interface RelationshipRow {
  id: string;
  name: string;
  goesBy?: string;
  /** Days since the RELATIONSHIP began. Null renders the honest empty state
   *  rather than borrowing the person's platform join date. */
  sinceDays: number | null;
  /** mentors variant only — the person's platform standing. */
  status?: MentorLifecycleStatus;
  /** mentees variant only — set ONLY when the platform status is an exception.
   *  Active is undefined, because a default that speaks is noise. */
  exception?: { label: string; tone: "warning" | "muted" } | null;
}

/** TODO-COPY — the chip names the PERSON's platform state, and says where that
 *  state lives so it can't be misread as a fact about the pairing. */
export function exceptionFor(
  status: "active" | "paused" | "deactivated"
): RelationshipRow["exception"] {
  if (status === "paused")
    return { label: "Paused on Somethings", tone: "warning" };
  if (status === "deactivated") return { label: "Deactivated", tone: "muted" };
  return null;
}

function ExceptionChip({
  chip,
}: {
  chip: NonNullable<RelationshipRow["exception"]>;
}) {
  return (
    <span
      // READ-ONLY, never a control: no button, no menu, no caret. Warning family
      // for paused (recoverable, worth noticing), muted for deactivated (a
      // settled fact). The word carries it — colour never alone.
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5",
        chip.tone === "warning"
          ? "bg-[var(--status-attention-bg)] text-[var(--status-attention-fg)]"
          : "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]"
      )}
      style={{ font: "var(--type-label-sm)" }}
    >
      {chip.label}
    </span>
  );
}

type SortKey = "name" | "status" | "since";

/** Opening a dialog FROM a menu item is a fight over focus: Radix restores focus
 *  to the menu's TRIGGER as the menu closes, and that restore outlives the
 *  dialog's own autofocus — so the dialog opened and focus was immediately
 *  yanked back to the ⋯ button, breaking the trap and Escape (measured; two
 *  animation frames of delay did NOT outlast it either).
 *
 *  The fix is to stop the menu restoring focus at all: `preventFocusRestore` on
 *  DropdownMenuContent. Nothing is lost, because ConfirmDialog returns focus to
 *  the trigger when it closes — the restore was duplicated, and the menu's copy
 *  was the one arriving too late.
 *
 *  That return needs the TRIGGER, so this table hands it up with the callback.
 *  A caller reading `document.activeElement` instead gets the MENU ITEM (which
 *  is what is focused when a menu item is selected) — an element that unmounts a
 *  moment later, so focusing it on close is a no-op and focus lands on <body>. */
const preventFocusRestore = (e: Event) => e.preventDefault();

export function RelationshipTable({
  variant,
  title,
  rows,
  /** Column header for the relationship-start date — "Matched" / "Assigned". */
  sinceLabel,
  addLabel,
  onAdd,
  statusRank,
  onStatusSelect,
  onEndRelationship,
  endLabel,
  emptyLabel,
}: {
  variant: RelationshipVariant;
  title: string;
  rows: RelationshipRow[];
  sinceLabel: string;
  addLabel?: string;
  onAdd?: () => void;
  /** mentors variant — sort rank for the status column. */
  statusRank?: (s: MentorLifecycleStatus) => number;
  /** mentors variant — a selection REQUESTS a change; the caller confirms it.
   *  `trigger` is the control that opened the menu, for focus return. */
  onStatusSelect?: (
    row: RelationshipRow,
    next: MentorLifecycleStatus,
    trigger: HTMLElement | null
  ) => void;
  /** Overflow action. Supervisor-tier callers pass it; others don't, and the
   *  overflow menu then carries View record alone. */
  onEndRelationship?: (
    row: RelationshipRow,
    trigger: HTMLElement | null
  ) => void;
  /** "Unmatch…" / "Unassign…" — never "Remove" or "Delete". */
  endLabel: string;
  emptyLabel: string;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("name");
  const [asc, setAsc] = useState(true);
  // The ⋯ triggers, by row id — handed to the caller so a confirm can put focus
  // back where the reader left it.
  const overflowRefs = useRef<Record<string, HTMLElement | null>>({});

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort === "since") {
        // Null (no date on file) sorts last in either direction — an unknown is
        // not "oldest", and letting it lead the list reads as data.
        if (a.sinceDays === null || b.sinceDays === null)
          return a.sinceDays === null ? 1 : -1;
        return dir * (a.sinceDays - b.sinceDays);
      }
      if (sort === "status" && statusRank)
        return (
          dir *
          (statusRank(a.status ?? "active") - statusRank(b.status ?? "active"))
        );
      return dir * (a.goesBy ?? a.name).localeCompare(b.goesBy ?? b.name);
    });
  }, [rows, sort, asc, statusRank]);

  const toggleSort = (k: SortKey) => {
    if (k === sort) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(true);
    }
  };

  const showStatus = variant === "mentors";
  const showChat = variant === "mentees";
  const colCount = 2 + (showStatus ? 1 : 0) + (showChat ? 1 : 0) + 1;

  return (
    <section
      aria-label={title}
      data-record-section={`relationship-${variant}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className={H2}>{title}</h2>
        {onAdd && addLabel && (
          // Outlined, never a second filled button.
          <button
            type="button"
            onClick={onAdd}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-2 rounded-full border border-[color:var(--button-border-default)] px-4",
              "font-display text-[12px] font-bold leading-[16px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            <Plus className="size-3.5" aria-hidden />
            {addLabel}
          </button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)]">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[color:var(--surface-s2)]">
              <SortHead label="Name" k="name" sort={sort} asc={asc} onSort={toggleSort} />
              {showStatus && (
                <SortHead label="Status" k="status" sort={sort} asc={asc} onSort={toggleSort} />
              )}
              <SortHead label={sinceLabel} k="since" sort={sort} asc={asc} onSort={toggleSort} />
              {/* The chat column carries no header — the link names itself. */}
              {showChat && <th className={TH} />}
              {/* Overflow column: unheaded, its trigger is labelled per row. */}
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-5 py-6 text-[14px] leading-[20px] text-[var(--text-secondary)]"
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
            {sorted.map((r) => {
              const display = r.goesBy ?? r.name;
              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(recordHrefFor(r.id))}
                  className="cursor-pointer border-b border-[color:var(--surface-s2)] transition-colors last:border-0 hover:bg-[var(--tint-faint)]"
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold leading-4"
                        style={{
                          backgroundColor: avatarTintFor(display).bg,
                          color: avatarTintFor(display).fg,
                        }}
                      >
                        {display.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                          {display}
                        </span>
                        {/* The exception chip sits WITH THE NAME, because it is
                            a fact about the person — not in a column of its own,
                            which is what made it read as a property of the
                            pairing. */}
                        {r.exception && <ExceptionChip chip={r.exception} />}
                      </span>
                    </span>
                  </td>

                  {showStatus && (
                    // stopPropagation so opening the menu doesn't also navigate.
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      {r.status && onStatusSelect ? (
                        <StatusTrigger
                          status={r.status}
                          name={display}
                          onSelect={(next, trigger) =>
                            onStatusSelect(r, next, trigger)
                          }
                        />
                      ) : (
                        r.status && <MentorStatusBadge status={r.status} />
                      )}
                    </td>
                  )}

                  <td className="px-5 py-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                    {r.sinceDays === null ? (
                      // TODO-COPY — honest about missing data rather than
                      // borrowing a date that means something else.
                      <span className="text-[var(--text-muted)]">Not recorded</span>
                    ) : (
                      relJoined(r.sinceDays)
                    )}
                  </td>

                  {showChat && (
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={chatHrefFor(r.id)}
                        aria-label={`View chat with ${display}`}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-2 rounded-sm text-[14px] font-medium text-[var(--text-primary)]",
                          "transition-colors hover:text-[var(--text-secondary)]",
                          RING
                        )}
                      >
                        <MessageSquare className="size-4" aria-hidden />
                        View chat
                      </Link>
                    </td>
                  )}

                  <td
                    className="px-5 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          ref={(el) => {
                            overflowRefs.current[r.id] = el;
                          }}
                          aria-label={`More actions for ${display}`}
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-full text-[var(--text-muted)]",
                            "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                            RING
                          )}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="min-w-44"
                        onCloseAutoFocus={preventFocusRestore}
                      >
                        <DropdownMenuItem
                          onSelect={() => router.push(recordHrefFor(r.id))}
                        >
                          {/* TODO-COPY */}
                          View record
                        </DropdownMenuItem>
                        {onEndRelationship && (
                          <DropdownMenuItem
                            onSelect={() =>
                              onEndRelationship(r, overflowRefs.current[r.id] ?? null)
                            }
                          >
                            {endLabel}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The status pill as a menu trigger. Selecting REQUESTS a change — the caller
 *  opens a confirm and only then commits. The caret is what tells a reader the
 *  pill is actionable at all. */
function StatusTrigger({
  status,
  name,
  onSelect,
}: {
  status: MentorLifecycleStatus;
  name: string;
  onSelect: (next: MentorLifecycleStatus, trigger: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          ref={ref}
          aria-label={`${name} — status ${status}. Change status`}
          className={cn(
            "group/st inline-flex items-center gap-1 rounded-full outline-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          )}
        >
          <MentorStatusBadge status={status} />
          <ChevronDown
            className="size-3.5 text-[var(--text-muted)] transition-transform group-data-[state=open]/st:rotate-180"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-52"
        onCloseAutoFocus={preventFocusRestore}
      >
        {STATUS_CHOICES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => onSelect(s, ref.current)}
            aria-current={s === status || undefined}
          >
            <MentorStatusBadge status={s} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The staff lifecycle, in progression order. "Guided" is included because it is
 *  a real member of the enum, even though no fixture currently sits in it. */
const STATUS_CHOICES: MentorLifecycleStatus[] = [
  "in-training",
  "guided",
  "active",
  "paused",
  "deactivated",
];

function SortHead({
  label,
  k,
  sort,
  asc,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  asc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const on = sort === k;
  return (
    <th
      scope="col"
      className={TH}
      aria-sort={on ? (asc ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-[var(--text-primary)]",
          RING
        )}
      >
        {label}
        {on ? (
          asc ? (
            <ChevronUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  );
}
