"use client";

// MENTEE TABLE — the mentor's mentees. Name · Status · Joined · chat link.
//
// A TABLE, deliberately (this went list → table → list → table across passes;
// the table is the settled answer). Four columns of comparable facts across a
// caseload is a grid's job: sortable heads let a lead order by standing or
// tenure, which a stack of prose rows can't.
//
// Sort is always available on the three head cells; search chrome stays
// threshold-gated so a short list carries no controls.
//
// Status is a MUTATION ON THIS PAGE, by explicit product decision (it had been
// removed once as "the wrong page for a teen's standing" — the screenshot spec
// puts it back). It writes `menteeStatus`, the single source the header count,
// this table and Past mentees all read.
//
// PAST MENTEES stays: collapsed at the foot, only "deactivated" matches, neutral
// copy because no outcome is recorded (see pastMenteesFor's gap note).
//
// Vocabulary law: "mentees" for the people, "caseload" for the capacity concept.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PersonRow, avatarTintFor } from "@/components/record/person-row";
import { MentorStatusBadge } from "@/components/admin/mentor-status-badge";
import {
  DEMO_TEENS,
  defaultMenteeStatus,
  pastMenteesFor,
  relJoined,
  teensForMentor,
  type DemoTeen,
} from "@/lib/record/people-demo";
import { relLength, teenAsMentee } from "@/lib/record/mentees-demo";
import { recordHrefFor } from "@/lib/record/subject";
import { chatHrefFor } from "@/lib/record/chat";
import { useOnboardingStore, type MenteeStatus } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const TH =
  "px-5 py-3 text-left text-[14px] font-medium leading-[20px] text-[var(--text-secondary)]";

/** Below this many mentees, no search chrome renders. */
const SEARCH_THRESHOLD = 9;

type SortKey = "name" | "status" | "joined";
const STATUS_RANK: Record<MenteeStatus, number> = {
  active: 0,
  paused: 1,
  deactivated: 2,
};
/** Only the three states a MATCH can be in — a teen is never "in training". */
const MENTEE_STATES: MenteeStatus[] = ["active", "paused", "deactivated"];

export function MenteeTable({
  mentorId,
  mentorName,
}: {
  mentorId: string;
  mentorName: string;
}) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [sort, setSort] = useState<SortKey>("name");
  const [asc, setAsc] = useState(true);
  const [query, setQuery] = useState("");
  const [pastOpen, setPastOpen] = useState(false);
  const [confirming, setConfirming] = useState<DemoTeen | null>(null);
  const [picking, setPicking] = useState(false);

  const menteeStatus = useOnboardingStore((s) => s.menteeStatus);
  const setMenteeStatus = useOnboardingStore((s) => s.setMenteeStatus);
  const statusOf = (t: DemoTeen): MenteeStatus =>
    menteeStatus[t.id] ?? defaultMenteeStatus(t);
  const hasEnded = (t: DemoTeen) => statusOf(t) === "deactivated";

  // An ended match leaves the table for Past mentees; "paused" has not ended, so
  // it stays in the list but stops counting as active.
  const live = useMemo(
    () => teensForMentor(mentorId).filter((t) => !hasEnded(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentorId, menteeStatus]
  );
  const past = useMemo(
    () => pastMenteesFor(mentorId, hasEnded),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentorId, menteeStatus]
  );
  const showSearch = live.length >= SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = (showSearch && q
      ? live.filter((t) => (t.goesBy ?? t.name).toLowerCase().includes(q))
      : live
    ).slice();
    const dir = asc ? 1 : -1;
    list.sort((a, b) => {
      if (sort === "joined") return dir * (a.joinedDaysAgo - b.joinedDaysAgo);
      if (sort === "status")
        return dir * (STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)]);
      return dir * (a.goesBy ?? a.name).localeCompare(b.goesBy ?? b.name);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, sort, asc, q, showSearch, menteeStatus]);

  const toggleSort = (k: SortKey) => {
    if (k === sort) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(true);
    }
  };

  const apply = (t: DemoTeen, next: MenteeStatus) => {
    // Deactivating stands down a live mentorship — confirm. The other two are
    // reversible in one click, so they don't.
    if (next === "deactivated") setConfirming(t);
    else setMenteeStatus(t.id, next);
  };

  return (
    <section aria-label="Mentees" data-record-section="mentees">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className={H2}>Mentees</h2>
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-1.5 text-sm text-[var(--text-secondary)]">
              <Search className="size-4" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search mentees by name"
                className="w-28 bg-transparent text-foreground outline-none placeholder:text-[var(--text-secondary)]"
              />
            </span>
          )}
          {/* Outlined, never a second filled button. The picker is a stub — it
              toasts rather than writing a match (no match-creation flow exists). */}
          <button
            type="button"
            onClick={() => setPicking(true)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-2 rounded-full border border-[color:var(--button-border-default)] px-4",
              "font-display text-[12px] font-bold leading-[16px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            <Plus className="size-3.5" aria-hidden />
            Add mentee
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)]">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[color:var(--surface-s2)]">
              <SortHead label="Name" k="name" sort={sort} asc={asc} onSort={toggleSort} />
              <SortHead label="Status" k="status" sort={sort} asc={asc} onSort={toggleSort} />
              <SortHead label="Joined" k="joined" sort={sort} asc={asc} onSort={toggleSort} />
              {/* The chat column carries no header — the link names itself. */}
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-6 text-[14px] leading-[20px] text-[var(--text-secondary)]"
                >
                  {/* TODO-COPY */}
                  {q ? "No mentees match that name." : "No mentees matched yet."}
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const display = t.goesBy ?? t.name;
              const st = statusOf(t);
              return (
                <tr
                  key={t.id}
                  onClick={() => router.push(recordHrefFor(t.id))}
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
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                          {display}
                        </span>
                        {t.goesBy && (
                          <span className="block truncate text-[12px] leading-4 text-[var(--text-secondary)]">
                            goes by &ldquo;{t.goesBy}&rdquo;
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  {/* stopPropagation so the menu doesn't also open the record. */}
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${display} — ${st}. Change status`}
                          className="group/ms inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                        >
                          <MentorStatusBadge status={st} />
                          <ChevronDown
                            className="size-3.5 text-[var(--text-muted)] transition-transform group-data-[state=open]/ms:rotate-180"
                            aria-hidden
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-52">
                        <DropdownMenuLabel>Set status</DropdownMenuLabel>
                        {MENTEE_STATES.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onSelect={() => apply(t, s)}
                            aria-current={s === st || undefined}
                          >
                            <MentorStatusBadge status={s} />
                            {s === st && (
                              <Check
                                className="ml-auto size-4 text-[var(--text-secondary)]"
                                aria-hidden
                              />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                  <td className="px-5 py-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                    {relJoined(t.joinedDaysAgo)}
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={chatHrefFor(t.id)}
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
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── Past mentees (kept) ──────────────────────────────────────────── */}
        {past.length > 0 && (
          <div className="border-t border-[color:var(--surface-s2)] px-5">
            <button
              type="button"
              onClick={() => setPastOpen((o) => !o)}
              aria-expanded={pastOpen}
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left",
                RING
              )}
            >
              <span
                className="text-[var(--text-secondary)]"
                style={{ font: "var(--type-row-label)" }}
              >
                Past mentees ({past.length})
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-[var(--text-muted)] transition-transform",
                  pastOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            {pastOpen && (
              <ul className="pb-1.5 [&>li+li]:border-t [&>li+li]:border-[var(--border-subtle)]">
                {past.map(({ teen, endedLabel }) => {
                  const m = teenAsMentee(teen, now);
                  const display = teen.goesBy ?? teen.name;
                  return (
                    <li key={teen.id}>
                      <PersonRow
                        name={display}
                        // TODO-COPY. Neutral "ended" — no outcome is recorded, so
                        // a graduation and a rematch can't be told apart.
                        secondary={
                          endedLabel
                            ? `together ${relLength(m.matchedAt, now)} · ended in ${endedLabel}`
                            : `together ${relLength(m.matchedAt, now)} · ended`
                        }
                        href={recordHrefFor(teen.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Deactivating ends a live mentorship — confirm before it happens. */}
      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set {confirming?.goesBy ?? confirming?.name} to deactivated?</DialogTitle>
            <DialogDescription>
              {`They move to Past mentees and stop counting toward ${mentorName}'s caseload. Nothing is deleted, and you can set them active again any time.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={() => {
                if (confirming) setMenteeStatus(confirming.id, "deactivated");
                setConfirming(null);
              }}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddMenteePicker open={picking} onOpenChange={setPicking} mentorName={mentorName} />
    </section>
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

/** Unmatched teens, as a picker. STUB: toasts, never writes — no
 *  match-creation flow exists (reported). */
function AddMenteePicker({
  open,
  onOpenChange,
  mentorName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mentorName: string;
}) {
  const unmatched = DEMO_TEENS.filter((t) => !t.mentorId);
  const pool = unmatched.length > 0 ? unmatched : DEMO_TEENS.slice(0, 4);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a mentee</DialogTitle>
          <DialogDescription>
            {`Matching isn't part of this prototype yet — picking someone shows what would happen.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {pool.map((t) => (
            <li key={t.id}>
              <PersonRow
                name={t.goesBy ?? t.name}
                secondary={t.group}
                onPress={() => {
                  toast(`${t.goesBy ?? t.name} would be matched with ${mentorName}.`);
                  onOpenChange(false);
                }}
              />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
