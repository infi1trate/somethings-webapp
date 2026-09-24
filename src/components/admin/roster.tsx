"use client";

// Shared people roster — now role- + segment-aware and FUNCTIONAL (search, sort,
// relevant per-view filters), replacing the earlier decorative version. Renders
// in the Supervisor console (AppChrome, with review queues) and the Lead Mentor
// app (AppChrome, list only, umbrella-scoped).
//
//   role "supervisor" → all mentors / all teens (plain directory — the review
//                       queues moved to the Lead Mentor, who owns reviews now)
//   role "lead"       → the lead's umbrella (+ the review queues on mentors);
//                       a CASELOAD column ("x of y") opens the mentee modal
//                       (teens list primary, caseload adjuster secondary)
//   segment "mentees" → teen rows: filter by TENURE, show each teen's Mentor
//   segment "mentors" → mentor rows: role chips (Teens + Super Admins removed)
//
// Data is a marked demo layer (lib/record/people-demo.ts, TODO-DATA).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Search,
  UsersRound,
} from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  DEMO_MENTORS,
  DEMO_TEENS,
  inTenureBucket,
  leadUmbrellaMentors,
  leadUmbrellaTeens,
  mentorName,
  relJoined,
  roleOf,
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
import { ChatAction } from "@/components/admin/chat-action";
import { teenDisplayName } from "@/lib/record/teen-name";
import {
  AvailabilityMenu,
  MentorStatusMenu,
} from "@/components/admin/mentor-status-badge";
import {
  availabilityFor,
  availabilityRank,
  STATUS_ORDER,
  STATUS_LABELS,
  statusRank,
} from "@/lib/record/mentor-status";
import type { MentorAvailability, MentorLifecycleStatus } from "@/lib/types";
import { touchTarget } from "@/lib/touch-target";
import { PageHeader } from "@/components/ia/page-header";
import { cn } from "@/lib/utils";
import { recordHrefFor } from "@/lib/record/subject";
import {
  BILLING_CODE_FILTERS,
  billingCodeDescription,
  billingCodeSortValue,
  billingCodeStateFor,
  billingHistoryHref,
  matchesBillingFilter,
  type BillingCodeFilter,
  type BillingCodeState,
} from "@/lib/record/billing-code";
import { currentMenteesOf } from "@/lib/record/relationships";
import { useLiveMentorRow } from "@/lib/record/use-live-mentor";
import { ReviewQueues } from "@/components/admin/review-queues";

export type RosterSegment = "mentees" | "mentors";
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
  const caseloads = useOnboardingStore((s) => s.caseloads);
  // The live mentor's name/status/capacity/groups now come from
  // useLiveMentorRow, so this component no longer reads those store axes itself.
  // Manual status overrides (staff toggle) win over fixture/derived status.
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const relationshipEvents = useOnboardingStore((s) => s.relationshipEvents);
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
  /** THE CODE FILTER — the supervisor's "see all mentees and their current codes"
   *  affordance. Teens segment only; the mentors segment has no codes. */
  const [codeFilter, setCodeFilter] = useState<BillingCodeFilter>("All codes");
  /** Fixed at mount — `Date.now()` in render scope is impure and every date and
   *  overdue figure in the column would move on a re-render. */
  const [rosterNow] = useState(() => Date.now());
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Which mentor's mentee modal is open (lead only).
  const [caseloadRow, setCaseloadRow] = useState<MentorRow | null>(null);
  // "Now" captured once (lazy init) — reference point for the live mentor's
  // mentee set (mentees-demo); keeps render pure.
  const [now] = useState(() => Date.now());

  // The store-backed mentor as a directory row — shared with the Team table.
  const liveRow = useLiveMentorRow();

  const heading = isMentors ? "Mentors" : "Mentees";
  const q = search.trim().toLowerCase();
  const matchName = (name: string, goesBy?: string, firstName?: string) =>
    !q ||
    name.toLowerCase().includes(q) ||
    (goesBy?.toLowerCase().includes(q) ?? false) ||
    (firstName?.toLowerCase().includes(q) ?? false);
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
    // supervisor retains view/edit. Built by the SHARED hook so this table and
    // the Team directory can't disagree about whether they exist.
    if (liveRow) rows.unshift(liveRow);
    return rows;
  }, [isLead, liveRow]);

  // ── Caseload (lead view) — current mentees + capacity per mentor ───────────
  // The live mentor's mentee set is the record's (mentees-demo) so counts match
  // the record everywhere; demo mentors derive from their teen assignments.
  const liveMentees = useMemo(() => getDemoOverview(now).mentees, [now]);
  const menteeCountFor = (r: MentorRow) =>
    r.id === "live"
      ? liveMentees.length
      : // CURRENT matches, so a load figure never counts an ended pairing.
        currentMenteesOf(r.id, { events: relationshipEvents }).length;
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
          // FULL NAME since rule 6 was retired (gap row 284). The modal renders
          // this raw and derives two-letter initials from it — which is now the
          // intended pairing rather than a hazard, and the same thing staff rows
          // have always done.
          name: teenDisplayName(t),
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
        // SEARCH STILL MATCHES THE LEGAL NAME — staff type "Ortiz" and find
        // Caleb. Matching a string is not rendering it, and this is the roster
        // that exists to find a specific person. What comes BACK is first-name
        // only; `firstName` joins the haystack so typing what you can see works.
        matchName(t.name, t.goesBy, t.firstName) &&
        matchStatus(t.active) &&
        inTenureBucket(t.joinedDaysAgo, tenure) &&
        matchesBillingFilter(billingCodeStateFor(t.id, rosterNow), codeFilter)
    );
    const val = (t: DemoTeen): string | number => {
      switch (sortKey) {
        case "mentor": return mentorName(t.mentorId);
        case "group": return t.group;
        case "status": return t.active ? 1 : 0;
        case "joined": return t.joinedDaysAgo;
        case "code":
          return billingCodeSortValue(billingCodeStateFor(t.id, rosterNow));
        // BY THE VISIBLE NAME. Sorting teens by their legal name ordered the
        // list on a string the reader cannot see.
        default: return teenDisplayName(t);
      }
    };
    rows = [...rows].sort((a, b) => cmp(val(a), val(b)));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLead, q, statusFilter, tenure, sortKey, sortDir, codeFilter, rosterNow]);

  const sortProps = { sortKey, sortDir, onSort: toggleSort };

  return (
    /* ANNO REGIONS. Inert `data-anno-ref` markers so a review comment anchors to
       the filter bar or the table rather than to the whole content area — the
       measured problem after the first cycle, where 10 of 10 comments landed on
       `app-main`. No name carries a ":", so none of these is volatile: the rows
       inside the table stay unannotatable by the accepted anno-02 trade. */
    <div data-anno-ref="roster" className="px-6 py-6 lg:px-10">
      {/* ═══ THE SHARED HEADER (addendum §2.10) ═══
          It was a bare `h1` with no purpose line and no figure. The metric is
          the ACTIVE FILTER'S total, which is what §2.10 asks for and what the
          filter chips below make readable: a count that does not move when a
          reader filters teaches them not to trust it. */}
      <PageHeader
        title={heading}
        purpose={
          /* NEEDS-COPY-NICOLE, both. */
          isMentors
            ? "Everyone who mentors on the platform, and who they answer to."
            : "Every teen on the platform, and the mentor they are matched with."
        }
        metrics={[
          {
            value: String(isMentors ? mentorView.length : teenView.length),
            label:
              (isMentors ? mentorView.length : teenView.length) ===
              (isMentors ? mentorRows.length : DEMO_TEENS.length)
                ? isMentors
                  ? "mentors"
                  : "teens"
                : `of ${isMentors ? mentorRows.length : DEMO_TEENS.length}`,
          },
        ]}
      />

      {/* Filters — relevant to the view; all functional. */}
      <div data-anno-ref="roster-filters" className="mt-5 flex flex-wrap items-center gap-2">
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

        {/* THE CODE FILTER — teens segment only; the mentors segment has no codes.
            A <select> rather than a fifth chip group: the filter row already has
            a tenure chip set, and two chip sets side by side read as one set with
            an arbitrary break in it. This is also the affordance the brief calls
            the supervisor's "see all mentees and their current codes" path. */}
        {!isMentors && (
          <select
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value as BillingCodeFilter)}
            /* TODO-COPY */
            aria-label="Filter by billing code state"
            className={cn(CONTROL, "cursor-pointer")}
          >
            {BILLING_CODE_FILTERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}

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

        <span className={cn(CONTROL, "ml-auto inline-flex items-center gap-2 py-0")}>
          <Search className="size-4" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search by name"
            // SC 2.5.8 — `self-stretch` makes the input fill the pill instead of sitting
            // as a 20px strip inside it. Its own box goes 20px -> ~32px, clearing the
            // 24px floor, and most of the pill becomes typeable where before only the
            // middle band responded.
            //
            // NOT `touchTarget()` here: a `::after` overlay is unreliable on a
            // replaced element like <input>, and an overlay above a text field would
            // be the wrong shape of fix anyway. The remaining dead zone is the `px-4`
            // padding and the icon — making the wrapper a <label> would claim those
            // too; noted in design-system-gaps row 285.
            className="w-28 self-stretch py-1.5 bg-transparent text-foreground outline-none placeholder:text-[var(--text-secondary)]"
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
      <div
        data-anno-ref="roster-table"
        className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]"
      >
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
                  {/* Chat only. The Phone column became a Contact dropdown,
                      then this: phone + email are stored data and live on the
                      person's record, not in a directory row. Not sortable. */}
                  <th className="px-5 py-3 font-medium">Chat</th>
                </>
              ) : (
                <>
                  <SortHead label="Name" k="name" {...sortProps} />
                  {/* TODO-COPY. "Billing code", not "Presentation" — see
                      design-system-gaps.md row 206: the mentor-record surface
                      calls the same value "Presentation" and one of the two
                      headings should win. */}
                  <SortHead label="Billing code" k="code" {...sortProps} />
                  <SortHead label="Mentor" k="mentor" {...sortProps} />
                  <SortHead label="Group" k="group" {...sortProps} />
                  <SortHead label="Status" k="status" {...sortProps} />
                  <SortHead label="Joined" k="joined" {...sortProps} />
                  <th className="px-5 py-3 font-medium">Chat</th>
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
              : teenView.map((t) => (
                  <TeenRowView key={t.id} teen={t} now={rosterNow} />
                ))}
            {((isMentors && mentorView.length === 0) ||
              (!isMentors && teenView.length === 0)) && (
              <tr>
                <td
                  colSpan={isMentors && isLead ? 7 : 6}
                  className="px-5 py-8 text-center text-[var(--text-secondary)]"
                >
                  No {isMentors ? "mentors" : "mentees"} match these filters.
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

export function SortHead({
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
        // SC 2.5.8 — the label is 20px tall, under the 24px floor, and this table
        // is the highest-traffic one in the app: cluster D carried 428 of the 584
        // target-size failures in the Phase 8 baseline. Visual unchanged;
        // `touchTarget` extends the hit area with a `::after` that paints nothing.
        //
        // FOURTH COPY OF THIS CONTROL. Byte-identical strings live at
        // `data-view.tsx:145` and twice in `relationship-table.tsx` (912, 954),
        // and all four needed the same edit — the first attempt patched three and
        // /app/mentees still measured 20px, because this one renders it. Noted in
        // design-system-gaps row 285; not consolidated in this unit.
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
          touchTarget(20)
        )}
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
            // SC 2.5.8 — 32px of visual, 44px of target. The caseload cell is a
            // MUTATION control (it opens the caseload adjuster), so a mis-tap
            // here is not a navigation the reader can undo with Back.
            className={cn(
              touchTarget(32),
              "group/cl -mx-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[var(--text-primary)] tabular-nums transition-colors hover:bg-[var(--tint-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            )}
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
        {/* Chat only. Phone + email moved to the person's Account tab — a
            directory row shouldn't hand out PII. */}
        <ChatAction
          personId={row.id}
          name={row.name}
          subjectRole={roleOf(row)}
        />
      </td>
    </tr>
  );
}

/** THE BILLING-CODE CELL. One column; the STATE IS THE TREATMENT of the value,
 *  never a second column.
 *
 *  NEVER COLOUR ALONE (WCAG 1.4.1). The expired state carries a glyph AND the word
 *  "Re-review" AND the tint — three channels, so a monochrome print, a
 *  forced-colors mode and a colourblind reader all get it.
 *
 *  NO COUNTDOWN. A countdown is an obligation and obligation lives in Tasks; this
 *  cell answers "is it current", never "how long have you got". The SLA constant is
 *  deliberately not imported anywhere near here.
 *
 *  THE CODE IS THE LINK, to the object-scoped Activity feed — which IS the code's
 *  history, because the ledger is append-only and BILLING_REVIEW_COMPLETE is the
 *  only billing ACTIVITY event. No separate history screen.
 *
 *  `stopPropagation` because the whole row already navigates to the record; without
 *  it the code link would be swallowed by the row's own click. */
function BillingCodeCell({ teen, now }: { teen: DemoTeen; now: number }) {
  const state: BillingCodeState = billingCodeStateFor(teen.id, now);
  // Through the shared helper, which now yields the full name (rule 6 retired,
  // gap row 284). Worth remembering why it routes here at all: this was a
  // hand-rolled split, the only site that satisfied the old rule, and it did so
  // by accident of being written separately. Accidental compliance is why the
  // chokepoint exists — and why reversing the rule was one edit.
  const first = teenDisplayName(teen);
  const description = billingCodeDescription(state, first);

  // The em-dash states. A MUTED EM DASH WITH AN ACCESSIBLE LABEL, never a blank
  // cell — a blank reads as a rendering failure and says nothing to a screen
  // reader.
  if (state.kind === "pending" || state.kind === "none") {
    return (
      <td className="px-5 py-3">
        <span className="flex items-center gap-1.5" title={description}>
          <span
            aria-label={description}
            className={cn(
              "tabular-nums",
              state.kind === "none"
                ? "text-[var(--text-muted)]"
                : "text-[var(--text-secondary)]"
            )}
          >
            —
          </span>
          {state.kind === "pending" && (
            <span className="rounded-full bg-[var(--surface-s2)] px-2 py-0.5 text-[12px] leading-[16px] text-[var(--text-secondary)]">
              {/* TODO-COPY */}
              Pending
            </span>
          )}
        </span>
      </td>
    );
  }

  const expired = state.kind === "expired";
  return (
    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
      <span className="flex flex-wrap items-center gap-1.5">
        <Link
          href={billingHistoryHref(teen.id)}
          aria-label={description}
          title={description}
          className={cn(
            // SC 2.5.8 — the code renders at 42x20, one per row. Not inline in a
            // sentence (it is a `block` link in its own cell), so the inline
            // exception does not apply and the target is genuinely under the floor.
            "rounded-sm tabular-nums text-[var(--text-primary)] underline decoration-transparent underline-offset-2",
            touchTarget(20),
            "transition-colors hover:decoration-[color:var(--text-primary)]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          )}
          // --font-mono, not Geist Mono: Geist is not loaded in this project.
          // See design-system-gaps.md row 205.
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {state.code}
        </Link>
        {expired && (
          <span
            className="inline-flex items-center gap-1 text-[12px] leading-[16px]"
            style={{ color: "var(--band-amber-fg)" }}
          >
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            {/* TODO-COPY. The WORD, so the glyph and the tint are never alone. */}
            Re-review
          </span>
        )}
      </span>
    </td>
  );
}

function TeenRowView({ teen, now }: { teen: DemoTeen; now: number }) {
  const router = useRouter();
  // ORIGIN: back goes to the Teens list this row lives on.
  const href = recordHrefFor(teen.id, "teens");
  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer border-b border-[var(--surface-s2)] transition-colors last:border-0 hover:bg-[var(--tint-faint)]"
    >
      <td className="px-5 py-3">
        {/* THE `goesBy` SUBTITLE IS BACK FOR TEENS (gap row 284). It was omitted
            because the cell already showed the nickname as the display name, so a
            "goes by" line would have repeated it or contrasted it against a legal
            name rule 6 forbade showing. Now the cell shows the full legal name, so
            the subtitle contrasts rather than repeats — "Patricia Vance" over
            'goes by "Pat"' — which is exactly what the mentor rows do.
            It also recovers the one thing the rule-6 reversal cost: `goesBy` stopped
            winning in `teenDisplayName`, and without this the nickname rendered
            nowhere outside the record. No new copy — `NameCell` already had the
            subtitle and the wording. */}
        <NameCell
          name={teenDisplayName(teen)}
          goesBy={teen.goesBy}
          recordHref={href}
        />
      </td>
      <BillingCodeCell teen={teen} now={now} />
      <td className="px-5 py-3 text-[var(--text-secondary)]">{mentorName(teen.mentorId)}</td>
      <td className="px-5 py-3 text-[var(--text-secondary)]">{teen.group}</td>
      <td className="px-5 py-3"><StatusPill active={teen.active} /></td>
      <td className="px-5 py-3 text-[var(--text-secondary)] tabular-nums">{relJoined(teen.joinedDaysAgo)}</td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        {/* The name reaches an aria-label — "Chat with Caleb". A surname
            announced only to a screen reader is still a surname rendered. */}
        <ChatAction
          personId={teen.id}
          name={teenDisplayName(teen)}
          subjectRole="teen"
        />
      </td>
    </tr>
  );
}

export function NameCell({
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
      {/* `shrink-0` — WITHOUT IT THIS IS AN ELLIPSE. `size-8` sets width and
          height, but a flex item's width is a starting point, not a floor: in a
          compressed row the avatar was the only thing that could give, so it
          squashed horizontally while keeping its 32px height and its
          `rounded-full`. A circle that is not a circle reads as a rendering
          fault. Height is unaffected, so this changes nothing at desktop. */}
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
        {initials(name)}
      </span>
      {/* `min-w-0` was already here and did nothing on its own — it permits the
          box to shrink, but `truncate` on the CHILDREN is what makes a long name
          end in an ellipsis instead of forcing the column wider. `flex-1` so it
          claims the space the avatar no longer takes. */}
      <span className="min-w-0 flex-1">
        {recordHref ? (
          // ═══ SC 2.5.8, AND THE ONLY WAY INTO A RECORD ═══
          //
          // MEASURED on `/app/mentees` at 1280: this link is 131x20 inside a 61px
          // row, there is NO row-level overlay link, and `elementFromPoint` at 75%
          // of the row width returns a plain `<td>`. So a 61px row was openable
          // only through a 20px strip of text — 37 failures on one view, and a
          // usability problem before it is a criterion problem.
          //
          // `truncate` MOVED TO AN INNER SPAN, deliberately. It sets
          // `overflow: hidden`, which clips the element's own `::after` — so
          // `touchTarget` on a truncating element silently does nothing, which is
          // the same class of trap as the template-literal class in
          // lib/touch-target.ts. The link keeps `block` (full column width) and
          // the span inside it does the ellipsis.
          <Link
            href={recordHref}
            className={cn(
              "block rounded-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]",
              touchTarget(20)
            )}
          >
            <span className="block truncate">{name}</span>
          </Link>
        ) : (
          <span className="block truncate font-medium">{name}</span>
        )}
        {goesBy && (
          <span className="block truncate text-xs text-[var(--text-secondary)]">
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

/** Two-letter staff initials. Exported for `team-directory.tsx`'s card-mode
 *  avatar, which needs the same letterform the table's NameCell uses.
 *
 *  TEENS NOW MATCH. `teenAvatarInitial` used to return ONE letter, because two
 *  letters on a teen reconstruct the surname's first letter — the fact standing
 *  rule 6 suppressed. That rule was retired on 2026-08-28 (gap row 284), so both
 *  paths give two letters and the duplication below is now FOUR copies of one
 *  behaviour. (Three near-identical copies of this exist: here,
 *  `care-network.tsx:41` and `caseload-modal.tsx:30`. Not consolidated in this
 *  phase; noted in design-system-gaps row 268.) */
export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
