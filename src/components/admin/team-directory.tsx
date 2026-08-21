"use client";

// TEAM — the staff directory. ONE TABLE, scoped to who the viewer works with.
//
// This was three stacked grouped-list cards (Mentors / Lead mentors /
// Supervisors). It's a table now, the same shape the old /admin/users roster
// had — Role became a column instead of a heading, so every person sorts and
// filters against everyone else instead of only within their own card.
//
// Scope (unchanged):
//   Mentor      → Lead mentors + Supervisors        (the people above them)
//   Lead mentor → their Mentors + Leads + Supervisors
//   Supervisor  → all Mentors + Leads + Supervisors
//
// THE LIVE MENTOR IS IN HERE. They have no fixture row — everything about them
// comes from the store — so this table missed them entirely until
// useLiveMentorRow was extracted. That's the shared builder the roster uses, so
// the two directories can't disagree about who exists.
//
// Teens are deliberately absent: this is the STAFF directory. Mentors reach
// their mentees through Teens; leads and supervisors reach a teen through the
// mentor who holds the match.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { NameCell, SortHead } from "@/components/admin/roster";
import { ChatAction } from "@/components/admin/chat-action";
import {
  AvailabilityMenu,
  MentorStatusMenu,
} from "@/components/admin/mentor-status-badge";
import { ReviewQueues } from "@/components/admin/review-queues";
import {
  DEMO_MENTORS,
  DEMO_STAFF,
  LEAD_PERSONA_ID,
  leadUmbrellaMentors,
  roleOf,
  superviseesOf,
  type PersonRole,
} from "@/lib/record/people-demo";
import { getDemoOverview } from "@/lib/record/mentees-demo";
import { recordHrefFor } from "@/lib/record/subject";
// Bloom Role Label ramp (Figma 3466:10231) — replaced a flat outlined pill
// that gave every role the same visual rank.
import { RoleLabel } from "@/components/record/role-label";
import { currentMenteesOf } from "@/lib/record/relationships";
import { useLiveMentorRow, type StaffRow } from "@/lib/record/use-live-mentor";
import {
  availabilityFor,
  availabilityRank,
  statusRank,
} from "@/lib/record/mentor-status";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { MentorAvailability, MentorLifecycleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
// Role wording comes from the ONE shared map (Bloom Role Label) — six local
// copies of this had drifted into "Lead mentor" vs "Lead Mentor" and all six
// still said "Teen".

export type TeamScope = "mentor" | "lead" | "supervisor";

const ROLE_FILTERS = ["All", "Mentors", "Lead mentors", "Supervisors"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

const CHIP =
  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF =
  "border-[var(--border-subtle)] bg-[var(--surface-card)] text-foreground hover:bg-[var(--tint-faint)]";

type SortDir = "asc" | "desc";

export function TeamDirectory({ scope }: { scope: TeamScope }) {
  const router = useRouter();
  const caseloads = useOnboardingStore((s) => s.caseloads);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const relationshipEvents = useOnboardingStore((s) => s.relationshipEvents);
  const setMentorStatus = useOnboardingStore((s) => s.setMentorStatus);
  const mentorAccepting = useOnboardingStore((s) => s.mentorAccepting);
  const setMentorAccepting = useOnboardingStore((s) => s.setMentorAccepting);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [sortKey, setSortKey] = useState("role");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [now] = useState(() => Date.now());

  const liveRow = useLiveMentorRow();

  const rows = useMemo<StaffRow[]>(() => {
    // A mentor sees only the people above them; a lead sees the mentors they
    // actually lead (the live mentor among them); a supervisor sees everyone.
    const mentors =
      scope === "mentor"
        ? []
        : scope === "lead"
          ? leadUmbrellaMentors()
          : [...DEMO_MENTORS];
    const all: StaffRow[] = [...mentors, ...DEMO_STAFF].map((p) => ({
      ...p,
      recordHref: recordHrefFor(p.id),
    }));
    // The live mentor belongs wherever their lead/supervisor would see them: a
    // supervisor sees every mentor, a lead only the ones reporting to them.
    if (liveRow && scope !== "mentor") {
      if (scope === "supervisor" || liveRow.leadId === LEAD_PERSONA_ID) {
        all.unshift(liveRow);
      }
    }
    return all;
  }, [scope, liveRow]);

  // The live mentor's mentee set is the record's, so counts match everywhere.
  const liveMentees = useMemo(() => getDemoOverview(now).mentees, [now]);
  const menteeCountOf = (r: StaffRow) =>
    r.id === "live"
      ? liveMentees.length
      : // CURRENT matches, so a load figure never counts an ended pairing.
        currentMenteesOf(r.id, { events: relationshipEvents }).length;
  const capOf = (r: StaffRow) => caseloads[r.id]?.total ?? r.capacity;
  const statusOf = (r: StaffRow): MentorLifecycleStatus =>
    (mentorStatuses[r.id] as MentorLifecycleStatus) ?? r.status;
  const acceptingOf = (r: StaffRow) => mentorAccepting[r.id] ?? r.accepting ?? true;
  // Availability is a MENTOR axis. Leads and supervisors hold no mentees, so
  // there is nothing to be available for — the cell reads "—" rather than
  // inventing a state for them.
  const availabilityOf = (r: StaffRow): MentorAvailability | null =>
    roleOf(r) === "mentor"
      ? availabilityFor(statusOf(r), menteeCountOf(r), capOf(r), acceptingOf(r))
      : null;
  /** What this person carries: mentees for a mentor, staff for a lead/supervisor. */
  const loadOf = (r: StaffRow) =>
    roleOf(r) === "mentor"
      ? `${menteeCountOf(r)} of ${capOf(r)}`
      : `${superviseesOf(r.id).length} ${
          roleOf(r) === "lead-mentor" ? "mentors" : "supervised"
        }`;

  const q = search.trim().toLowerCase();
  const view = useMemo(() => {
    const matchRole = (r: StaffRow) =>
      roleFilter === "All" ||
      (roleFilter === "Mentors" && roleOf(r) === "mentor") ||
      (roleFilter === "Lead mentors" && roleOf(r) === "lead-mentor") ||
      (roleFilter === "Supervisors" && roleOf(r) === "supervisor");
    const matchName = (r: StaffRow) =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.goesBy?.toLowerCase().includes(q) ?? false);

    const dir = sortDir === "asc" ? 1 : -1;
    // Role sorts by HIERARCHY (supervisor → lead → mentor), not alphabetically —
    // "Lead mentor" before "Mentor" before "Supervisor" would read as noise.
    const roleRank = (r: StaffRow) =>
      ({ supervisor: 0, "lead-mentor": 1, mentor: 2, admin: 3, teen: 4 })[
        roleOf(r)
      ];
    const cmp = (a: StaffRow, b: StaffRow) => {
      switch (sortKey) {
        case "role":
          return (roleRank(a) - roleRank(b)) * dir || a.name.localeCompare(b.name);
        case "group":
          return a.group.localeCompare(b.group) * dir;
        case "load":
          return (menteeCountOf(a) - menteeCountOf(b)) * dir;
        case "status":
          return (statusRank(statusOf(a)) - statusRank(statusOf(b))) * dir;
        case "availability":
          return (
            (availabilityRank(availabilityOf(a)) -
              availabilityRank(availabilityOf(b))) *
            dir
          );
        default:
          return a.name.localeCompare(b.name) * dir;
      }
    };
    return rows.filter((r) => matchRole(r) && matchName(r)).sort(cmp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, roleFilter, sortKey, sortDir, mentorStatuses, mentorAccepting, caseloads]);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };
  const sortProps = { sortKey, sortDir, onSort: toggleSort };

  return (
    <div className="px-6 py-6 lg:px-10">
      <header className="max-w-prose">
        <h1
          className="text-[var(--text-primary)]"
          style={{ font: "var(--type-title-lg)" }}
        >
          Team
        </h1>
        <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {scope === "mentor"
            ? "The leads and supervisors supporting your mentoring."
            : scope === "lead"
              ? "The mentors you lead, and the leads and supervisors alongside you."
              : "Everyone on the mentoring side of the platform."}
        </p>
      </header>

      {/* Review inbox — renders nothing when nothing needs acting on. */}
      {scope !== "mentor" && <ReviewQueues className="mt-6" />}

      {/* Filters — one row above the table. A mentor sees no role chips: their
          scope is only leads + supervisors, so filtering by role would offer a
          "Mentors" chip that can never match. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {scope !== "mentor" &&
          ROLE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setRoleFilter(f)}
              aria-pressed={roleFilter === f}
              className={cn(CHIP, roleFilter === f ? CHIP_ON : CHIP_OFF)}
            >
              {f}
            </button>
          ))}
        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-1.5 text-sm text-[var(--text-secondary)]">
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

      <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-s2)] text-left text-[var(--text-secondary)]">
              <SortHead label="Name" k="name" {...sortProps} />
              <SortHead label="Role" k="role" {...sortProps} />
              <SortHead label="Group" k="group" {...sortProps} />
              <SortHead label="Mentees" k="load" {...sortProps} />
              <SortHead label="Status" k="status" {...sortProps} />
              <SortHead label="Availability" k="availability" {...sortProps} />
              <th className="px-5 py-3 font-medium">Chat</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const isMentor = roleOf(r) === "mentor";
              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(recordHrefFor(r.id))}
                  className={cn(
                    "cursor-pointer border-b border-[var(--surface-s2)] transition-colors last:border-0 hover:bg-[var(--tint-faint)]",
                    r.highlight && "bg-[var(--alert-warm-bg,transparent)]"
                  )}
                >
                  <td className="px-5 py-3">
                    <NameCell
                      name={r.name}
                      goesBy={r.goesBy}
                      recordHref={recordHrefFor(r.id)}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <RoleLabel role={roleOf(r)} />
                  </td>
                  <td className="px-5 py-3 text-[var(--text-secondary)]">
                    {r.group}
                  </td>
                  <td className="px-5 py-3 text-[var(--text-primary)] tabular-nums">
                    {loadOf(r)}
                  </td>
                  {/* stopPropagation so opening a menu doesn't also navigate. */}
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <MentorStatusMenu
                      status={statusOf(r)}
                      name={r.name}
                      onChange={(s) => setMentorStatus(r.id, s)}
                    />
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    {isMentor ? (
                      <AvailabilityMenu
                        value={availabilityOf(r)}
                        accepting={acceptingOf(r)}
                        atCap={menteeCountOf(r) >= capOf(r)}
                        name={r.name}
                        onChange={(a) => setMentorAccepting(r.id, a)}
                      />
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <ChatAction
                      personId={r.id}
                      name={r.name}
                      subjectRole={roleOf(r)}
                    />
                  </td>
                </tr>
              );
            })}
            {view.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-[var(--text-secondary)]"
                >
                  No one matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Role as a quiet outline pill — three staff roles, one neutral treatment.
 *  Status and availability are the coloured axes on this row; a coloured role
 *  would compete with them for the same glance. */
