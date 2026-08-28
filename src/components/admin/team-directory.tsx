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
import { Search } from "lucide-react";
import { NameCell, initials } from "@/components/admin/roster";
import { DataView } from "@/components/ui/data-view";
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
} from "@/lib/record/people-demo";
import { getDemoOverview } from "@/lib/record/mentees-demo";
import { recordHrefFor } from "@/lib/record/subject";
// Bloom Role Label ramp (Figma 3466:10231) — replaced a flat outlined pill
// that gave every role the same visual rank.
import { ROLE_LABEL, RoleLabel } from "@/components/record/role-label";
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
        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-0 text-sm text-[var(--text-secondary)]">
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

      {/* ═══ DATAVIEW (Phase 5, RC-3) ═══
          
          THE TASK: find a colleague, and see who needs review. That is a
          LOOKUP, not an analysis — the reader arrives with a person or a
          question in mind, and the columns exist to identify and route, not to
          be compared across rows. So a card list loses nothing essential on a
          phone, and the wrapper below is gone: it was
          `overflow-x-auto rounded-2xl` around a `min-w-[760px]` table, which at
          390px meant a 760px table in a 342px box — reachable by drag, with no
          affordance saying so, and 55% of it off-screen at any moment.
          
          AVAILABILITY IS THE ONE DEMOTED COLUMN (`slot: "detail"`). It is
          mentor-only, and accepting/at-capacity is a CASELOAD question — the
          roster is the surface built for that, and it keeps the control. Nothing
          is deleted: the column is still in the table above the threshold, and
          the person's own record is one tap from every card.
          
          STATUS KEEPS ITS LIVE MENU on the card, in the trailing cluster. It is
          the column the "who needs review" half of the task is asking about, and
          its trigger doubles as the status chip — so demoting it would have cost
          both the answer and the action. */}
      <DataView
        className="mt-6 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]"
        caption="Team directory"
        rows={view}
        rowKey={(r) => r.id}
        rowHref={(r) => recordHrefFor(r.id)}
        rowLabel={(r) => `${r.name} — open record`}
        leading={(r) => (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
            {initials(r.name)}
          </span>
        )}
        // ═══ WIDTHS AND THRESHOLD ═══
        //
        // This table was `min-w-[760px]` with AUTO layout, so content sized the
        // columns. DataView is `table-fixed` (the colgroup has to be
        // authoritative for the paused-group alignment the record tables need),
        // and under fixed layout a column with no width shares the remainder
        // equally — so seven width-less columns became seven 156px columns and
        // every name was an ellipsis. Six are pinned here and Name absorbs the
        // rest: 282px at a 1092px container.
        //
        // THRESHOLD 60rem, NOT 45rem: the pinned columns already sum to 810px,
        // so a 720px box cannot show this table without squeezing Name to
        // nothing. Cards until 960px is the honest line for a seven-column
        // directory carrying two mutation menus.
        minTableWidth={960}
        threshold="60rem"
        sort={{ key: sortKey, dir: sortDir, onSort: toggleSort }}
        empty="No one matches these filters."
        columns={[
          {
            id: "name",
            header: "Name",
            sortKey: "name",
            slot: "primary",
            cell: (r) => (
              <NameCell
                name={r.name}
                goesBy={r.goesBy}
                recordHref={recordHrefFor(r.id)}
              />
            ),
            // On a card the avatar is already the row's `leading` and the whole
            // row is the link, so the name is text, not a second link inside a
            // link — the nesting `PastMenteeRow` documents.
            card: (r) => r.name,
          },
          {
            id: "role",
            width: 120,
            header: "Role",
            sortKey: "role",
            slot: "secondary",
            cell: (r) => <RoleLabel role={roleOf(r)} />,
            // PLAIN TEXT ON A CARD, not the pill. The card's meta line is one
            // truncating row of middot-joined facts; a pill inside it fights the
            // line's baseline, cannot truncate, and at 320px was the thing
            // bleeding out from behind the crushed name. The pill is a TABLE
            // affordance — it earns its shape by sitting in a column of peers.
            card: (r) => ROLE_LABEL[roleOf(r)],
          },
          {
            id: "group",
            width: 160,
            header: "Group",
            sortKey: "group",
            slot: "secondary",
            className: "text-[var(--text-secondary)]",
            cell: (r) => r.group,
          },
          {
            id: "load",
            width: 120,
            header: "Mentees",
            sortKey: "load",
            slot: "secondary",
            className: "text-[var(--text-primary)] tabular-nums",
            cell: (r) => loadOf(r),
            // THE CARD NEEDS THE NOUN THE COLUMN HEADER USED TO SUPPLY — but
            // only for a mentor. `loadOf` already returns "4 mentors" for a lead
            // and "8 supervised" for a supervisor; appending a blanket "mentees"
            // produced "8 supervised mentees", which is a different and wrong
            // fact. Only the mentor form ("3 of 5") is nounless.
            card: (r) =>
              roleOf(r) === "mentor" ? `${loadOf(r)} mentees` : loadOf(r),
          },
          {
            id: "status",
            width: 150,
            header: "Status",
            sortKey: "status",
            slot: "trailing",
            cell: (r) => (
              <MentorStatusMenu
                status={statusOf(r)}
                name={r.name}
                onChange={(st) => setMentorStatus(r.id, st)}
              />
            ),
          },
          {
            id: "availability",
            width: 160,
            header: "Availability",
            sortKey: "availability",
            slot: "detail",
            cell: (r) =>
              roleOf(r) === "mentor" ? (
                <AvailabilityMenu
                  value={availabilityOf(r)}
                  accepting={acceptingOf(r)}
                  atCap={menteeCountOf(r) >= capOf(r)}
                  name={r.name}
                  onChange={(a) => setMentorAccepting(r.id, a)}
                />
              ) : (
                <span className="text-[var(--text-muted)]">—</span>
              ),
          },
          {
            id: "chat",
            width: 100,
            header: "Chat",
            slot: "trailing",
            cell: (r) => (
              <ChatAction
                personId={r.id}
                name={r.name}
                subjectRole={roleOf(r)}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

/** Role as a quiet outline pill — three staff roles, one neutral treatment.
 *  Status and availability are the coloured axes on this row; a coloured role
 *  would compete with them for the same glance. */
