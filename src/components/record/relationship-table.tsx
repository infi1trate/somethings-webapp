"use client";

// RELATIONSHIP TABLE — ONE component, two variants. The mentor's Mentees table
// and the supervisor's Mentors table were two separate implementations (a
// <table> and a PersonRow list); they render the same shape, so they are one
// component now and can't drift.
//
// THE DISTINCTION THIS TABLE ENFORCES. A row is a RELATIONSHIP. Presence in the
// list means the pairing exists — that is what the list is for, so it never
// needs a column to say so. A person's PLATFORM STATUS is a different object,
// and the two variants treat it differently on purpose:
//
//   mentees — NO status column. A mentor doesn't administer a teen's account, so
//     offering the control here made "end this pairing" and "change this
//     person's account" one click apart. PAUSED mentees are still matched, so
//     they stay in this card — grouped away from the active ones, not exiled to
//     a section of their own. DEACTIVATED mentees are not here at all: that ends
//     the pairing, so they belong in Past mentees (product decision).
//
//   mentors — status column KEPT. A supervisor is accountable for their mentors'
//     standing, and "In training" is legitimately their business. The pill opens
//     a CONFIRM rather than committing on selection.
//
// Defaults whisper, exceptions speak: an active mentee carries no chip at all.
//
// COLUMN ALIGNMENT ACROSS TWO TABLES. The paused group scrolls internally with
// its header staying put, which one <table> cannot do — a scrolling <tbody>
// needs display:block and loses column sizing. So the group is its own table,
// and both share COLGROUP + table-layout:fixed so the columns line up exactly.

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
  Search,
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
import { TonalChip } from "@/components/record/tonal-chip";
import { chatHrefFor } from "@/lib/record/chat";
import { relJoined } from "@/lib/record/people-demo";
import { formatDaysInMentorship } from "@/lib/record/relationships";
import type { MentorLifecycleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const TH =
  "px-5 py-3 text-left text-[14px] font-medium leading-[20px] text-[var(--text-secondary)]";
const TD = "px-5 py-3";
const ROW =
  "cursor-pointer border-b border-[color:var(--surface-s2)] transition-colors last:border-0 hover:bg-[var(--tint-faint)]";

/** Below this many rows, no search chrome renders — a short list carries no
 *  controls. Counts BOTH groups: the chrome searches across them. */
const SEARCH_THRESHOLD = 9;
/** The paused group scrolls past this many rows rather than growing the card. */
const PAUSED_VISIBLE_ROWS = 8;
const ROW_PX = 57; // measured row height, for the scroll cap

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
  /** mentees variant only — routes the row into the paused group. */
  paused?: boolean;
  /** CARE FACTS for the presentation column. Present only when the caller opted
   *  in (`showCare`), and only at supervisor tier — see MenteeTable.
   *
   *  THE CODE ONLY, NEVER THE STATEMENT. "F41.1", not "Generalised anxiety
   *  disorder": the statement is too long for a list cell, and a scannable list
   *  of diagnostic sentences about named minors is a materially different
   *  exposure from the same fact on one record behind a deliberate click. */
  care?: {
    /** Null = nothing assigned yet, which renders a muted em dash, never blank. */
    code: string | null;
    reviewDue: "none" | "due" | "overdue";
    /** Days past due. 0 unless `reviewDue` is "overdue". */
    overdueDays: number;
  };
}

/** THE PRESENTATION CELL — a code, and a review-due chip when one is due.
 *
 *  THE CODE ONLY. Never the diagnostic statement: too long for a cell, and a
 *  scannable column of diagnoses about named minors is a different exposure from
 *  the same fact on one record. Data minimisation is the reason the whole column
 *  is supervisor-tier-and-above.
 *
 *  NOT-YET-ASSIGNED IS A MUTED EM DASH WITH AN ACCESSIBLE LABEL, never a blank
 *  cell. A blank reads as a rendering failure and tells a screen reader nothing
 *  at all; "—" plus "No presentation assigned" says the true thing to both.
 *
 *  THE REVIEW CHIP is warning-family only when OVERDUE. A review due next week is
 *  routine — defaults whisper — and tinting it would make the whole column shout
 *  on a healthy caseload. */
function CareCell({
  care,
  name,
}: {
  care?: RelationshipRow["care"];
  name: string;
}) {
  return (
    <td className={TD}>
      <span className="flex flex-wrap items-center gap-1.5">
        {care?.code ? (
          <TonalChip mono className="text-[var(--text-secondary)]">
            {care.code}
          </TonalChip>
        ) : (
          <span
            className="text-[14px] leading-[20px] text-[var(--text-muted)]"
            /* TODO-COPY. `aria-label` on the span so the em dash is never the
               only thing announced — a lone "—" is silence with extra steps. */
            aria-label={`${name}: no presentation assigned`}
          >
            —
          </span>
        )}
        {care && care.reviewDue !== "none" && (
          <TonalChip tone={care.reviewDue === "overdue" ? "warning" : "neutral"}>
            {/* TODO-COPY. Elapsed time, per the house rule — everything that is
                not a named platform metric reads as elapsed.

                "FIRST REVIEW DUE" WHEN THERE IS NO CODE YET. A bare "Review due"
                beside an em dash reads as a review of nothing — the row appears
                to contradict itself. It does not: at intake the pending review IS
                the proposal of a first presentation, so the supervisor's job is
                to approve one rather than re-examine one. The word "first" is the
                whole difference between a coherent row and a puzzling one. */}
            {care.reviewDue === "overdue"
              ? `Overdue ${care.overdueDays}d`
              : care.code === null
                ? "First review due"
                : "Review due"}
          </TonalChip>
        )}
      </span>
    </td>
  );
}

/** TODO-COPY — the chip names the PERSON's platform state, and says where that
 *  state lives so it can't be misread as a fact about the pairing.
 *
 *  Deactivated has no chip here any more: a deactivated mentee is not in this
 *  card at all (the pairing is over — see Past mentees). */
export function exceptionFor(
  status: "active" | "paused" | "deactivated"
): RelationshipRow["exception"] {
  if (status === "paused") return { label: "Paused", tone: "warning" };
  return null;
}

function ExceptionChip({
  chip,
}: {
  chip: NonNullable<RelationshipRow["exception"]>;
}) {
  return (
    <span
      // READ-ONLY, never a control: no button, no menu, no caret. The word
      // carries it — colour never alone (WCAG 1.4.1).
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

type SortKey = "name" | "status" | "since" | "code" | "review";

/** Opening a dialog FROM a menu item is a fight over focus: Radix restores focus
 *  to the menu's TRIGGER as the menu closes, and that restore outlives the
 *  dialog's own autofocus. Stopping the menu's restore fixes it; ConfirmDialog
 *  already returns focus to the trigger this table hands up. */
const preventFocusRestore = (e: Event) => e.preventDefault();

export function RelationshipTable({
  origin,
  showCare = false,
  variant,
  title,
  rows,
  sinceLabel,
  /** How the relationship-start value reads. "metric" is the named
   *  days-in-mentorship format; "elapsed" is the standard prose. */
  sinceFormat = "elapsed",
  /** Quiet line under the heading — the capacity readout. */
  caption,
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
  /** ORIGIN STAMP for the record links (see origins.ts). Optional: without it
   *  the URLs are byte-identical to before and the record falls back to its
   *  subject-derived back link. */
  origin?: string;
  /** THE PRESENTATION COLUMN — OFF BY DEFAULT, and that default is the point.
   *  This table is shared with Supervision and the mentors variant; a column
   *  added unconditionally would appear on screens this brief did not touch.
   *  Only MenteeTable opts in, and only for the supervisor tier. */
  showCare?: boolean;
  sinceLabel: string;
  sinceFormat?: "elapsed" | "metric";
  caption?: React.ReactNode;
  addLabel?: string;
  onAdd?: () => void;
  statusRank?: (s: MentorLifecycleStatus) => number;
  onStatusSelect?: (
    row: RelationshipRow,
    next: MentorLifecycleStatus,
    trigger: HTMLElement | null
  ) => void;
  onEndRelationship?: (
    row: RelationshipRow,
    trigger: HTMLElement | null
  ) => void;
  endLabel: string;
  emptyLabel: string;
}) {
  const [sort, setSort] = useState<SortKey>("name");
  const [asc, setAsc] = useState(true);
  const [query, setQuery] = useState("");
  const [pausedOpenManual, setPausedOpenManual] = useState(false);

  const showStatus = variant === "mentors";
  const showChat = variant === "mentees";
  const showCode = showCare && variant === "mentees";
  const colCount =
    2 + (showStatus ? 1 : 0) + (showCode ? 1 : 0) + (showChat ? 1 : 0) + 1;

  const compare = (a: RelationshipRow, b: RelationshipRow) => {
    const dir = asc ? 1 : -1;
    if (sort === "since") {
      // Null (no date on file) sorts last in either direction — an unknown is
      // not "oldest", and letting it lead the list reads as data.
      if (a.sinceDays === null || b.sinceDays === null)
        return a.sinceDays === null ? 1 : -1;
      return dir * (a.sinceDays - b.sinceDays);
    }
    if (sort === "code") {
      // NO CODE SORTS LAST in either direction — an unassigned presentation is
      // an unknown, not an empty string that belongs at the top of the alphabet.
      const ac = a.care?.code ?? null;
      const bc = b.care?.code ?? null;
      if (ac === null || bc === null) return ac === null ? 1 : -1;
      return dir * ac.localeCompare(bc);
    }
    if (sort === "review") {
      // MOST OVERDUE FIRST when ascending — the point of sorting by review is
      // triage, and triage wants the worst at the top.
      const rank = (r: RelationshipRow) =>
        r.care?.reviewDue === "overdue"
          ? 2000 + r.care.overdueDays
          : r.care?.reviewDue === "due"
            ? 1000
            : 0;
      return -dir * (rank(a) - rank(b));
    }
    if (sort === "status" && statusRank)
      return (
        dir * (statusRank(a.status ?? "active") - statusRank(b.status ?? "active"))
      );
    return dir * (a.goesBy ?? a.name).localeCompare(b.goesBy ?? b.name);
  };

  const q = query.trim().toLowerCase();
  const matches = (r: RelationshipRow) =>
    !q || (r.goesBy ?? r.name).toLowerCase().includes(q);

  // Sort runs across BOTH groups before the split, so ordering is consistent
  // whichever group a row lands in.
  const all = useMemo(
    () => [...rows].sort(compare),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, sort, asc, statusRank]
  );
  const activeRows = all.filter((r) => !r.paused).filter(matches);
  const pausedAll = all.filter((r) => r.paused);
  const pausedRows = pausedAll.filter(matches);

  // A search match inside a COLLAPSED paused group auto-expands it — a hidden
  // hit reads as "no results" and sends the reader looking somewhere else.
  const searching = q.length > 0;
  const pausedOpen = pausedOpenManual || (searching && pausedRows.length > 0);
  const showSearch = rows.length >= SEARCH_THRESHOLD;
  const scrolls = pausedRows.length > PAUSED_VISIBLE_ROWS;

  const renderSince = (days: number | null) =>
    days === null ? (
      // TODO-COPY — honest about missing data rather than borrowing a date that
      // means something else.
      <span className="text-[var(--text-muted)]">Not recorded</span>
    ) : sinceFormat === "metric" ? (
      <span className="tabular-nums">{formatDaysInMentorship(days)}</span>
    ) : (
      relJoined(days)
    );

  const cols = (
    <colgroup>
      <col />
      {showStatus && <col style={{ width: 180 }} />}
      {/* Narrow: a code is five characters and a review chip is short. Wider
          would invite the diagnostic statement in later. */}
      {showCode && <col style={{ width: 150 }} />}
      <col style={{ width: 190 }} />
      {showChat && <col style={{ width: 140 }} />}
      <col style={{ width: 72 }} />
    </colgroup>
  );

  const rowFor = (r: RelationshipRow) => (
    <Row
      key={r.id}
      row={r}
      showStatus={showStatus}
      showChat={showChat}
      showCode={showCode}
      origin={origin}
      renderSince={renderSince}
      onStatusSelect={onStatusSelect}
      onEndRelationship={onEndRelationship}
      endLabel={endLabel}
    />
  );

  return (
    <section aria-label={title} data-record-section={`relationship-${variant}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className={H2}>{title}</h2>
          {caption && (
            <p
              className="mt-0.5 text-[var(--text-secondary)]"
              style={{ font: "var(--type-row-label)" }}
            >
              {caption}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-1.5 text-sm text-[var(--text-secondary)]">
              <Search className="size-4" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label={`Search ${title.toLowerCase()} by name`}
                className="w-28 bg-transparent text-foreground outline-none placeholder:text-[var(--text-secondary)]"
              />
            </span>
          )}
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
      </div>

      <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)]">
        {/* GUTTER PARITY. When the paused group scrolls, its scrollbar eats ~15px
            of inner width, and with table-layout:fixed the flexible Name column
            absorbs all of it — measured 496px here vs 481px there, a visible
            15px step between the two groups. `overflow-y: scroll` on this
            wrapper reserves the SAME gutter without ever showing a thumb (the
            content is shorter than the box), so both tables get identical inner
            widths and the columns line up. */}
        <div className={cn(scrolls && "overflow-y-scroll")}>
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
          {cols}
          <thead>
            <tr className="border-b border-[color:var(--surface-s2)]">
              <SortHead label="Name" k="name" sort={sort} asc={asc} onSort={setSortKey} />
              {showStatus && (
                <SortHead label="Status" k="status" sort={sort} asc={asc} onSort={setSortKey} />
              )}
              {showCode && (
                /* TWO SORTS IN ONE HEADER CELL, because the cell holds two facts.
                   The alternative was making one control cycle code → review →
                   code, which is undiscoverable: nothing on screen would tell a
                   reader the third click does something different. Two labelled
                   buttons say what they do.

                   TODO-COPY. "Presentation", not "Billing code" — the code IS the
                   billing code, but on a teen's row the clinical framing is the
                   honest one; the finance framing reads as what the teen is for. */
                <th
                  scope="col"
                  className={TH}
                  aria-sort={
                    sort === "code" || sort === "review"
                      ? asc
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <span className="flex items-center gap-2">
                    <SortButton
                      label="Presentation"
                      k="code"
                      sort={sort}
                      asc={asc}
                      onSort={setSortKey}
                    />
                    <span aria-hidden className="opacity-40">
                      ·
                    </span>
                    <SortButton
                      /* TODO-COPY */
                      label="Review"
                      k="review"
                      sort={sort}
                      asc={asc}
                      onSort={setSortKey}
                    />
                  </span>
                </th>
              )}
              <SortHead label={sinceLabel} k="since" sort={sort} asc={asc} onSort={setSortKey} />
              {/* The chat column carries no header — the link names itself. */}
              {showChat && <th className={TH} />}
              {/* Overflow column: unheaded, its trigger is labelled per row. */}
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {activeRows.length === 0 && pausedRows.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-5 py-6 text-[14px] leading-[20px] text-[var(--text-secondary)]"
                >
                  {/* TODO-COPY */}
                  {searching ? "No one matches that name." : emptyLabel}
                </td>
              </tr>
            )}
            {activeRows.map(rowFor)}
          </tbody>
        </table>
        </div>

        {/* PAUSED GROUP — still matched, so still in this card, just set apart.
            Its own table so it can scroll under a header that stays put; the
            shared colgroup keeps the columns aligned with the active table. */}
        {pausedAll.length > 0 && (
          <div className="border-t border-[color:var(--surface-s2)]">
            <button
              type="button"
              onClick={() => setPausedOpenManual((o) => !o)}
              aria-expanded={pausedOpen}
              aria-controls="paused-group"
              className={cn(
                "flex min-h-11 w-full items-center gap-2 bg-[var(--surface-s1)] px-5 py-2 text-left",
                RING
              )}
            >
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-[var(--text-muted)] transition-transform",
                  pausedOpen && "rotate-180"
                )}
                aria-hidden
              />
              <span
                className="text-[var(--text-secondary)]"
                style={{ font: "var(--type-row-label)" }}
              >
                {/* TODO-COPY */}
                Paused · {pausedAll.length}
              </span>
              {/* When a search hit is hiding in here, say how many — otherwise
                  the auto-expand looks like the group opened at random. */}
              {searching && (
                <span
                  className="text-[var(--text-muted)]"
                  style={{ font: "var(--type-label-sm)" }}
                >
                  {/* TODO-COPY */}
                  {/* No leading middot — the flex gap already separates this
                      from the count, and both produced "10· 1 matching". */}
                  {pausedRows.length === 0
                    ? "no matches here"
                    : `${pausedRows.length} matching`}
                </span>
              )}
            </button>
            {pausedOpen && (
              <div
                id="paused-group"
                className={cn(scrolls && "overflow-y-auto")}
                style={scrolls ? { maxHeight: PAUSED_VISIBLE_ROWS * ROW_PX } : undefined}
              >
                <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
                  {cols}
                  <tbody>{pausedRows.map(rowFor)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );

  function setSortKey(k: SortKey) {
    if (k === sort) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(true);
    }
  }
}

function Row({
  row: r,
  showStatus,
  showChat,
  showCode,
  origin,
  renderSince,
  onStatusSelect,
  onEndRelationship,
  endLabel,
}: {
  row: RelationshipRow;
  showStatus: boolean;
  showChat: boolean;
  showCode: boolean;
  origin?: string;
  renderSince: (days: number | null) => React.ReactNode;
  onStatusSelect?: (
    row: RelationshipRow,
    next: MentorLifecycleStatus,
    trigger: HTMLElement | null
  ) => void;
  onEndRelationship?: (
    row: RelationshipRow,
    trigger: HTMLElement | null
  ) => void;
  endLabel: string;
}) {
  const router = useRouter();
  const display = r.goesBy ?? r.name;
  // Each row owns its own ⋯ ref and hands the element up with the callback, so a
  // confirm can put focus back where the reader left it. A shared map passed
  // down as a prop would mean the child mutating the parent's prop.
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <tr onClick={() => router.push(recordHrefFor(r.id, origin))} className={ROW}>
      <td className={TD}>
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
            {/* The chip sits WITH THE NAME, because it is a fact about the
                person — not in a column, which is what made it read as a
                property of the pairing. */}
            {r.exception && <ExceptionChip chip={r.exception} />}
          </span>
        </span>
      </td>

      {showStatus && (
        // stopPropagation so opening the menu doesn't also navigate.
        <td className={TD} onClick={(e) => e.stopPropagation()}>
          {r.status && onStatusSelect ? (
            <StatusTrigger
              status={r.status}
              name={display}
              onSelect={(next, trigger) => onStatusSelect(r, next, trigger)}
            />
          ) : (
            r.status && <MentorStatusBadge status={r.status} />
          )}
        </td>
      )}

      {showCode && <CareCell care={r.care} name={display} />}

      <td className={cn(TD, "text-[14px] leading-[20px] text-[var(--text-secondary)]")}>
        {renderSince(r.sinceDays)}
      </td>

      {showChat && (
        <td className={TD} onClick={(e) => e.stopPropagation()}>
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

      <td className={cn(TD, "text-right")} onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              ref={triggerRef}
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
            <DropdownMenuItem onSelect={() => router.push(recordHrefFor(r.id, origin))}>
              {/* TODO-COPY */}
              View record
            </DropdownMenuItem>
            {onEndRelationship && (
              <DropdownMenuItem
                onSelect={() =>
                  onEndRelationship(r, triggerRef.current)
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

/** The sort control itself, extracted so a header cell can hold more than one.
 *  SortHead is the one-sort-per-cell wrapper around it. */
function SortButton({
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
    <button
      type="button"
      onClick={() => onSort(k)}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm hover:text-[var(--text-primary)]",
        on && "text-[var(--text-primary)]",
        RING
      )}
    >
      {label}
      {on && (
        <ChevronUp
          className={cn("size-3 transition-transform", !asc && "rotate-180")}
          aria-hidden
        />
      )}
    </button>
  );
}

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
