"use client";

// Shared people roster — now role- + segment-aware and FUNCTIONAL (search, sort,
// relevant per-view filters), replacing the earlier decorative version. Renders
// in the Supervisor console (AdminShell, with review queues) and the Lead Mentor
// app (MentorShell, list only, umbrella-scoped).
//
//   role "supervisor" → all mentors / all teens (plain directory — the review
//                       queues moved to the Lead Mentor, who owns reviews now)
//   role "lead"       → the lead's umbrella (+ the review queues on mentors);
//                       a CASELOAD column ("x of y") opens the mentee modal
//                       (teens list primary, caseload adjuster secondary)
//   segment "teens"   → teen rows: filter by TENURE, show each teen's Mentor
//   segment "mentors" → mentor rows: role chips (Teens + Super Admins removed)
//
// Data is a marked demo layer (lib/record/people-demo.ts, TODO-DATA).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Search,
  UsersRound,
} from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import {
  DEMO_MENTORS,
  DEMO_TEENS,
  inTenureBucket,
  leadUmbrellaMentors,
  leadUmbrellaTeens,
  mentorName,
  relJoined,
  TENURE_FILTERS,
  teensForMentor,
  type DemoMentorRow,
  type DemoTeen,
  type TenureBucket,
} from "@/lib/record/people-demo";
import { getDemoOverview, relLength } from "@/lib/record/mentees-demo";
import {
  CaseloadModal,
  type CaseloadPerson,
} from "@/components/record/caseload-modal";
import { ContactCell } from "@/components/admin/contact-cell";
import {
  AvailabilityMenu,
  MentorStatusMenu,
} from "@/components/admin/mentor-status-badge";
import {
  availabilityFor,
  availabilityRank,
  liveLifecycle,
  STATUS_ORDER,
  STATUS_LABELS,
  statusRank,
} from "@/lib/record/mentor-status";
import type { MentorAvailability, MentorLifecycleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { recordHrefFor } from "@/lib/record/subject";
import { ReviewQueues } from "@/components/admin/review-queues";

export type RosterSegment = "teens" | "mentors";
export type RosterRole = "supervisor" | "lead";

// Mentors tab role chips — "Teens" and "Super Admins" removed (irrelevant here).
const MENTOR_ROLE_FILTERS = ["All", "Supervisors", "Mentors"] as const;
type MentorRoleFilter = (typeof MENTOR_ROLE_FILTERS)[number];
// The status filter is per-mount: mentors filter by lifecycle status, teens by
// the binary active/inactive (teens keep the old model). Kept as a string and
// branched by `isMentors` for both the options and the predicate.
type StatusFilter = string;
type AvailabilityFilter = "any" | MentorAvailability;
type SortDir = "asc" | "desc";

type MentorRow = DemoMentorRow & { recordHref?: string; highlight?: boolean };

const CHIP =
  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF =
  "border-[var(--border-subtle)] bg-[var(--surface-card)] text-foreground hover:bg-[var(--tint-faint)]";
const CONTROL =
  "rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-1.5 text-sm text-[var(--text-secondary)]";

export function Roster({
  role,
  segment,
  showQueues,
}: {
  role: RosterRole;
  segment: RosterSegment;
  showQueues: boolean;
}) {
  const mounted = useMounted();
  const status = useOnboardingStore((s) => s.status);
  const draft = useOnboardingStore((s) => s.draft);
  const slots = useOnboardingStore((s) => s.slots);
  const caseloads = useOnboardingStore((s) => s.caseloads);
  // Live mentor lifecycle is derived from these existing axes (see liveLifecycle).
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const profileHidden = useOnboardingStore((s) => s.profileHidden);
  // Manual status overrides (staff toggle) win over fixture/derived status.
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const setMentorStatus = useOnboardingStore((s) => s.setMentorStatus);
  // Manual availability-intent overrides win over the fixture `accepting`.
  const mentorAccepting = useOnboardingStore((s) => s.mentorAccepting);
  const setMentorAccepting = useOnboardingStore((s) => s.setMentorAccepting);

  const isMentors = segment === "mentors";
  const isLead = role === "lead";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [availFilter, setAvailFilter] = useState<AvailabilityFilter>("any");
  const [roleFilter, setRoleFilter] = useState<MentorRoleFilter>("All");
  const [tenure, setTenure] = useState<TenureBucket>("all");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Which mentor's mentee modal is open (lead only).
  const [caseloadRow, setCaseloadRow] = useState<MentorRow | null>(null);
  // "Now" captured once (lazy init) — reference point for the live mentor's
  // mentee set (mentees-demo); keeps render pure.
  const [now] = useState(() => Date.now());

  const liveName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Jordan Rivera";
  const needsReview = mounted && status === "in_review";

  const heading = isMentors ? "Mentors" : "Teens";
  const q = search.trim().toLowerCase();
  const matchName = (name: string, goesBy?: string) =>
    !q ||
    name.toLowerCase().includes(q) ||
    (goesBy?.toLowerCase().includes(q) ?? false);
  const matchStatus = (active: boolean) =>
    statusFilter === "any" ||
    (statusFilter === "active" ? active : !active);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };
  const cmp = (a: string | number, b: string | number) => {
    const r = typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b));
    return sortDir === "asc" ? r : -r;
  };

  // ── Mentors segment ─────────────────────────────────────────────────────────
  const mentorRows = useMemo<MentorRow[]>(() => {
    const base: MentorRow[] = isLead ? leadUmbrellaMentors() : [...DEMO_MENTORS];
    // Every fixture mentor now has a record (subject-identity layer) — before
    // this, only the store-backed mentor was navigable and the rest were inert.
    const rows: MentorRow[] = base.map((m) => ({
      ...m,
      recordHref: recordHrefFor(m.id),
    }));
    // The store-backed live mentor (the one with real review flows) renders
    // for BOTH staff roles — the lead manages them (role migration), the
    // supervisor retains view/edit. Both rows open the record.
    if (mounted && draft.firstName) {
      rows.unshift({
        id: "live",
        name: liveName,
        goesBy:
          draft.displayName.trim() &&
          draft.displayName.trim() !== draft.firstName.trim()
            ? draft.displayName.trim()
            : undefined,
        phone: draft.phone || "+1 (415) 555-0188",
        email: draft.email || undefined,
        group: "California",
        // Lifecycle derived from the store's existing axes; no "accepting" flag
        // exists on the store yet, so the live mentor defaults to accepting.
        status: liveLifecycle(status, accountStatus, profileHidden),
        accepting: true,
        capacity: slots.total,
        recordHref: recordHrefFor("live"),
        highlight: needsReview,
      });
    }
    return rows;
  }, [isLead, mounted, draft.firstName, draft.displayName, draft.phone, draft.email, liveName, status, accountStatus, profileHidden, needsReview, slots.total]);

  // ── Caseload (lead view) — current mentees + capacity per mentor ───────────
  // The live mentor's mentee set is the record's (mentees-demo) so counts match
  // the record everywhere; demo mentors derive from their teen assignments.
  const liveMentees = useMemo(() => getDemoOverview(now).mentees, [now]);
  const menteeCountFor = (r: MentorRow) =>
    r.id === "live" ? liveMentees.length : teensForMentor(r.id).length;
  const caseloadTotalFor = (r: MentorRow) =>
    caseloads[r.id]?.total ?? r.capacity;
  const peopleFor = (r: MentorRow): CaseloadPerson[] =>
    r.id === "live"
      ? liveMentees.map((m) => ({
          id: m.id,
          name: m.name,
          secondary: `together ${relLength(m.matchedAt, now)}`,
        }))
      : teensForMentor(r.id).map((t) => ({
          id: t.id,
          name: t.name,
          secondary: `joined ${relJoined(t.joinedDaysAgo)}`,
        }));

  // Resolved lifecycle status: a manual staff override wins over the row's
  // fixture/derived status (the live row's r.status is already liveLifecycle).
  const statusOf = (r: MentorRow): MentorLifecycleStatus =>
    mentorStatuses[r.id] ?? r.status;
  // Resolved availability intent: staff override wins over the fixture value.
  const acceptingOf = (r: MentorRow): boolean =>
    mentorAccepting[r.id] ?? r.accepting ?? true;
  const atCapFor = (r: MentorRow): boolean =>
    menteeCountFor(r) >= caseloadTotalFor(r);
  // Availability is derived (status + caseload count/cap + accepting intent) —
  // same count/cap the Caseload cell uses, so the two columns always agree.
  const availabilityOf = (r: MentorRow): MentorAvailability | null =>
    availabilityFor(statusOf(r), menteeCountFor(r), caseloadTotalFor(r), acceptingOf(r));

  const mentorView = useMemo(() => {
    let rows = mentorRows.filter(
      (r) =>
        matchName(r.name, r.goesBy) &&
        (statusFilter === "any" || statusOf(r) === statusFilter) &&
        (availFilter === "any" || availabilityOf(r) === availFilter)
    );
    // Role chips: only "Mentors"/"All" have subjects here (Supervisors → none).
    if (roleFilter === "Supervisors") rows = [];
    const val = (r: MentorRow): string | number => {
      switch (sortKey) {
        case "group": return r.group;
        case "status": return statusRank(statusOf(r)); // lifecycle order, not A–Z
        case "availability": return availabilityRank(availabilityOf(r)); // n/a last
        // Sort by load, capacity as the tiebreak.
        case "caseload": return menteeCountFor(r) * 100 + caseloadTotalFor(r);
        default: return r.name;
      }
    };
    return [...rows].sort((a, b) => cmp(val(a), val(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorRows, q, statusFilter, availFilter, roleFilter, sortKey, sortDir, caseloads, mentorStatuses, mentorAccepting]);

  // ── Teens segment ───────────────────────────────────────────────────────────
  const teenView = useMemo(() => {
    const base: DemoTeen[] = isLead ? leadUmbrellaTeens() : DEMO_TEENS;
    let rows = base.filter(
      (t) =>
        matchName(t.name, t.goesBy) &&
        matchStatus(t.active) &&
        inTenureBucket(t.joinedDaysAgo, tenure)
    );
    const val = (t: DemoTeen): string | number => {
      switch (sortKey) {
        case "mentor": return mentorName(t.mentorId);
        case "group": return t.group;
        case "status": return t.active ? 1 : 0;
        case "joined": return t.joinedDaysAgo;
        default: return t.name;
      }
    };
    rows = [...rows].sort((a, b) => cmp(val(a), val(b)));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLead, q, statusFilter, tenure, sortKey, sortDir]);

  const sortProps = { sortKey, sortDir, onSort: toggleSort };

  return (
    <div className="px-6 py-6 lg:px-10">
      <h1 className="font-display text-2xl font-bold tracking-tight">{heading}</h1>

      {/* Filters — relevant to the view; all functional. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {isMentors
          ? MENTOR_ROLE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setRoleFilter(f)}
                className={cn(CHIP, roleFilter === f ? CHIP_ON : CHIP_OFF)}
              >
                {f}
              </button>
            ))
          : TENURE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTenure(f.id)}
                className={cn(CHIP, tenure === f.id ? CHIP_ON : CHIP_OFF)}
              >
                {f.label}
              </button>
            ))}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className={cn(CONTROL, "cursor-pointer")}
        >
          <option value="any">Any status</option>
          {isMentors ? (
            STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))
          ) : (
            <>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </>
          )}
        </select>

        {/* Availability is a mentor-only, derived axis. */}
        {isMentors && (
          <select
            value={availFilter}
            onChange={(e) =>
              setAvailFilter(e.target.value as AvailabilityFilter)
            }
            aria-label="Filter by availability"
            className={cn(CONTROL, "cursor-pointer")}
          >
            <option value="any">Any availability</option>
            <option value="accepting">Accepting</option>
            <option value="full">Full</option>
            <option value="not-accepting">Not accepting</option>
          </select>
        )}

        <span className={cn(CONTROL, "ml-auto inline-flex items-center gap-2")}>
          <Search className="size-4" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search by name"
            className="w-28 bg-transparent text-foreground outline-none placeholder:text-[var(--text-secondary)]"
          />
        </span>
      </div>

      {/* Review inbox — extracted to review-queues.tsx so the Team page can
          mount it too (the Mentors roster it used to live in merged away). It
          renders nothing when nothing needs acting on, so its own root carries
          the separation from the filter bar — a wrapper here would leave an
          empty margin behind. */}
      {showQueues && <ReviewQueues className="mt-6" />}

      {/* Roster table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-s2)] text-left text-[var(--text-secondary)]">
              {isMentors ? (
                <>
                  <SortHead label="Name" k="name" {...sortProps} />
                  <th className="px-5 py-3 font-medium">Role</th>
                  <SortHead label="Group" k="group" {...sortProps} />
                  {isLead && <SortHead label="Caseload" k="caseload" {...sortProps} />}
                  <SortHead label="Status" k="status" {...sortProps} />
                  {/* Availability — a separate, mentor-only axis (secondary to
                      Status). Profile column removed: incomplete → In Training. */}
                  <SortHead label="Availability" k="availability" {...sortProps} />
                  {/* Contact replaces the Phone column — PII gated behind a
                      deliberate click (see contact-cell.tsx). Not sortable. */}
                  <th className="px-5 py-3 font-medium">Contact</th>
                </>
              ) : (
                <>
                  <SortHead label="Name" k="name" {...sortProps} />
                  <SortHead label="Mentor" k="mentor" {...sortProps} />
                  <SortHead label="Group" k="group" {...sortProps} />
                  <SortHead label="Status" k="status" {...sortProps} />
                  <SortHead label="Joined" k="joined" {...sortProps} />
                  <th className="px-5 py-3 font-medium">Contact</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {isMentors
              ? mentorView.map((r) => (
                  <MentorRowView
                    key={r.id}
                    row={r}
                    status={statusOf(r)}
                    onStatusChange={(s) => setMentorStatus(r.id, s)}
                    availability={availabilityOf(r)}
                    accepting={acceptingOf(r)}
                    atCap={atCapFor(r)}
                    onAcceptingChange={(a) => setMentorAccepting(r.id, a)}
                    caseload={
                      isLead
                        ? {
                            count: menteeCountFor(r),
                            total: caseloadTotalFor(r),
                            onOpen: () => setCaseloadRow(r),
                          }
                        : undefined
                    }
                  />
                ))
              : teenView.map((t) => <TeenRowView key={t.id} teen={t} />)}
            {((isMentors && mentorView.length === 0) ||
              (!isMentors && teenView.length === 0)) && (
              <tr>
                <td
                  colSpan={isMentors && isLead ? 7 : 6}
                  className="px-5 py-8 text-center text-[var(--text-secondary)]"
                >
                  No {isMentors ? "mentors" : "teens"} match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mentee modal (lead) — teens list primary, caseload adjuster secondary. */}
      {caseloadRow && (
        <CaseloadModal
          open
          onOpenChange={(o) => {
            if (!o) setCaseloadRow(null);
          }}
          mentorId={caseloadRow.id}
          mentorName={caseloadRow.name}
          defaultTotal={caseloadRow.capacity}
          people={peopleFor(caseloadRow)}
        />
      )}
    </div>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function SortHead({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: string;
  sortKey: string;
  sortDir: SortDir;
  onSort: (k: string) => void;
}) {
  const on = sortKey === k;
  return (
    <th
      className="px-5 py-3 font-medium"
      aria-sort={on ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 rounded-sm hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
      >
        {label}
        {on ? (
          sortDir === "asc" ? (
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

function MentorRowView({
  row,
  status,
  onStatusChange,
  availability,
  accepting,
  atCap,
  onAcceptingChange,
  caseload,
}: {
  row: MentorRow;
  /** Resolved lifecycle status (override-aware) — staff can change it inline. */
  status: MentorLifecycleStatus;
  onStatusChange: (next: MentorLifecycleStatus) => void;
  /** Derived availability (null = n/a → "—"). Computed by the parent so it
   *  shares the Caseload cell's count/cap. */
  availability: MentorAvailability | null;
  /** Availability intent + at-cap flag + change handler (staff toggle). */
  accepting: boolean;
  atCap: boolean;
  onAcceptingChange: (next: boolean) => void;
  /** Lead view: current load + capacity; the cell opens the mentee modal. */
  caseload?: { count: number; total: number; onOpen: () => void };
}) {
  const router = useRouter();
  return (
    <tr
      onClick={row.recordHref ? () => router.push(row.recordHref!) : undefined}
      className={cn(
        "border-b border-[var(--surface-s2)] last:border-0",
        row.highlight && "bg-amber-50/60",
        row.recordHref && "cursor-pointer transition-colors hover:bg-[var(--tint-faint)]"
      )}
    >
      <td className="px-5 py-3">
        <NameCell name={row.name} goesBy={row.goesBy} recordHref={row.recordHref} />
      </td>
      <td className="px-5 py-3">
        <RolePill role="Mentor" />
      </td>
      <td className="px-5 py-3 text-[var(--text-secondary)]">{row.group}</td>
      {caseload && (
        <td className="px-5 py-3">
          {/* Quiet CTA — "x of y" opens the mentee modal (caseload prompt).
              stopPropagation so the live row's record click stays intact. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              caseload.onOpen();
            }}
            aria-label={`${row.name} — mentees, ${caseload.count} of ${caseload.total}`}
            className="group/cl -mx-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[var(--text-primary)] tabular-nums transition-colors hover:bg-[var(--tint-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          >
            {caseload.count} of {caseload.total}
            <UsersRound
              className="size-3.5 text-[var(--text-muted)] transition-colors group-hover/cl:text-[var(--text-primary)]"
              aria-hidden
            />
          </button>
        </td>
      )}
      {/* stopPropagation so opening the status menu doesn't fire the row's
          record navigation. */}
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <MentorStatusMenu status={status} name={row.name} onChange={onStatusChange} />
      </td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <AvailabilityMenu
          value={availability}
          accepting={accepting}
          atCap={atCap}
          name={row.name}
          onChange={onAcceptingChange}
        />
      </td>
      {/* stopPropagation so opening the Contact menu doesn't fire the row's
          record navigation. */}
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <ContactCell
          person={{ id: row.id, name: row.name, phone: row.phone, email: row.email }}
        />
      </td>
    </tr>
  );
}

function TeenRowView({ teen }: { teen: DemoTeen }) {
  const router = useRouter();
  const href = recordHrefFor(teen.id);
  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer border-b border-[var(--surface-s2)] transition-colors last:border-0 hover:bg-[var(--tint-faint)]"
    >
      <td className="px-5 py-3">
        <NameCell name={teen.name} goesBy={teen.goesBy} recordHref={href} />
      </td>
      <td className="px-5 py-3 text-[var(--text-secondary)]">{mentorName(teen.mentorId)}</td>
      <td className="px-5 py-3 text-[var(--text-secondary)]">{teen.group}</td>
      <td className="px-5 py-3"><StatusPill active={teen.active} /></td>
      <td className="px-5 py-3 text-[var(--text-secondary)] tabular-nums">{relJoined(teen.joinedDaysAgo)}</td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <ContactCell
          person={{ id: teen.id, name: teen.name, phone: teen.phone, email: teen.email }}
        />
      </td>
    </tr>
  );
}

function NameCell({
  name,
  goesBy,
  recordHref,
}: {
  name: string;
  goesBy?: string;
  recordHref?: string;
}) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
        {initials(name)}
      </span>
      <span className="min-w-0">
        {recordHref ? (
          <Link
            href={recordHref}
            className="block rounded-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          >
            {name}
          </Link>
        ) : (
          <span className="block font-medium">{name}</span>
        )}
        {goesBy && (
          <span className="block text-xs text-[var(--text-secondary)]">
            goes by &ldquo;{goesBy}&rdquo;
          </span>
        )}
      </span>
    </span>
  );
}

function RolePill({ role }: { role: "Mentor" | "Mentee" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        role === "Mentor" ? "border-[#7b5bd6]/40 text-[#5b41a8]" : "border-destructive/40 text-destructive"
      )}
    >
      {role}
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        active ? "bg-foreground text-background" : "bg-muted text-[var(--text-secondary)]"
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
