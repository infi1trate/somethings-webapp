"use client";

// Shared people roster — now role- + segment-aware and FUNCTIONAL (search, sort,
// relevant per-view filters), replacing the earlier decorative version. Renders
// in the Supervisor console (AdminShell, with review queues) and the Lead Mentor
// app (MentorShell, list only, umbrella-scoped).
//
//   role "supervisor" → all mentors / all teens (plain directory — the review
//                       queues moved to the Lead Mentor, who owns reviews now)
//   role "lead"       → the lead's umbrella (+ the review queues on mentors);
//                       mentor rows EXPAND to their teens
//   segment "teens"   → teen rows: filter by TENURE, show each teen's Mentor
//   segment "mentors" → mentor rows: role chips (Teens + Super Admins removed)
//
// Data is a marked demo layer (lib/record/people-demo.ts, TODO-DATA).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { changesetSummary, relTime } from "@/lib/onboarding/profile-update";
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
import { cn } from "@/lib/utils";

export type RosterSegment = "teens" | "mentors";
export type RosterRole = "supervisor" | "lead";

// Mentors tab role chips — "Teens" and "Super Admins" removed (irrelevant here).
const MENTOR_ROLE_FILTERS = ["All", "Supervisors", "Mentors"] as const;
type MentorRoleFilter = (typeof MENTOR_ROLE_FILTERS)[number];
type StatusFilter = "any" | "active" | "inactive";
type SortDir = "asc" | "desc";

type MentorRow = DemoMentorRow & { recordHref?: string; highlight?: boolean };

const CHIP =
  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF =
  "border-[var(--border-subtle)] bg-white text-foreground hover:bg-black/[0.03]";
const CONTROL =
  "rounded-full border border-[var(--border-subtle)] bg-white px-4 py-1.5 text-sm text-[var(--text-secondary)]";

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
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);

  const isMentors = segment === "mentors";
  const isLead = role === "lead";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [roleFilter, setRoleFilter] = useState<MentorRoleFilter>("All");
  const [tenure, setTenure] = useState<TenureBucket>("all");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const liveName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Jordan Rivera";
  const needsReview = mounted && status === "in_review";
  const update = mounted ? profileUpdate : null;
  const updateFlagged = update?.status === "changes-requested";

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
    const rows: MentorRow[] = [...base];
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
        group: "California",
        active: status === "published",
        profile: needsReview ? "Incomplete" : undefined,
        recordHref: "/admin/mentor",
        highlight: needsReview,
      });
    }
    return rows;
  }, [isLead, mounted, draft.firstName, draft.displayName, draft.phone, liveName, status, needsReview]);

  const mentorView = useMemo(() => {
    let rows = mentorRows.filter(
      (r) => matchName(r.name, r.goesBy) && matchStatus(r.active)
    );
    // Role chips: only "Mentors"/"All" have subjects here (Supervisors → none).
    if (roleFilter === "Supervisors") rows = [];
    const val = (r: MentorRow): string | number => {
      switch (sortKey) {
        case "phone": return r.phone;
        case "group": return r.group;
        case "status": return r.active ? 1 : 0;
        case "profile": return r.profile ? 1 : 0;
        default: return r.name;
      }
    };
    return [...rows].sort((a, b) => cmp(val(a), val(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorRows, q, statusFilter, roleFilter, sortKey, sortDir]);

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
        case "phone": return t.phone;
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
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className={cn(CONTROL, "cursor-pointer")}
        >
          <option value="any">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

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

      {/* Review queues — supervisor mentors only. */}
      {showQueues && (
        <>
          <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--surface-s2)] px-5 py-3">
              <h2 className="text-sm font-semibold">Needs review</h2>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground">
                {needsReview ? 1 : 0}
              </span>
            </div>
            {needsReview ? (
              <div className="flex items-center gap-4 px-5 py-4">
                <span className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground">
                  {initials(liveName)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{liveName}</p>
                  <p className="text-sm text-[var(--text-secondary)]">Mentor · submitted for review</p>
                </div>
                <Button asChild className="ml-auto">
                  <Link href="/admin/review">Review</Link>
                </Button>
              </div>
            ) : (
              <p className="px-5 py-5 text-sm text-[var(--text-secondary)]">
                Nothing waiting for review right now.
              </p>
            )}
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--surface-s2)] px-5 py-3">
              <h2 className="text-sm font-semibold">Profile updates</h2>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground">
                {update && !updateFlagged ? 1 : 0}
              </span>
            </div>
            {update ? (
              <div className={cn("flex items-center gap-4 px-5 py-4", updateFlagged && "opacity-70")}>
                <span className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground">
                  {initials(liveName)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{liveName}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {changesetSummary(update)} · {relTime(update.updatedAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    "ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    updateFlagged ? "border border-orange-300 text-orange-700" : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {updateFlagged ? "Changes requested" : "Pending"}
                </span>
                <Button asChild variant={updateFlagged ? "outline" : "default"} className="ml-auto">
                  <Link href="/admin/mentor?focus=review">{updateFlagged ? "View" : "Review"}</Link>
                </Button>
              </div>
            ) : (
              <p className="px-5 py-5 text-sm text-[var(--text-secondary)]">No profile updates waiting.</p>
            )}
          </section>
        </>
      )}

      {/* Roster table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-s2)] text-left text-[var(--text-secondary)]">
              {isMentors ? (
                <>
                  <SortHead label="Name" k="name" {...sortProps} />
                  <th className="px-5 py-3 font-medium">Role</th>
                  <SortHead label="Phone" k="phone" {...sortProps} />
                  <SortHead label="Group" k="group" {...sortProps} />
                  <SortHead label="Status" k="status" {...sortProps} />
                  <SortHead label="Profile" k="profile" {...sortProps} />
                  {isLead && <th className="px-5 py-3" />}
                </>
              ) : (
                <>
                  <SortHead label="Name" k="name" {...sortProps} />
                  <SortHead label="Mentor" k="mentor" {...sortProps} />
                  <SortHead label="Phone" k="phone" {...sortProps} />
                  <SortHead label="Group" k="group" {...sortProps} />
                  <SortHead label="Status" k="status" {...sortProps} />
                  <SortHead label="Joined" k="joined" {...sortProps} />
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
                    expandable={isLead}
                    open={expanded.has(r.id)}
                    onToggle={() =>
                      setExpanded((s) => {
                        const n = new Set(s);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        return n;
                      })
                    }
                  />
                ))
              : teenView.map((t) => <TeenRowView key={t.id} teen={t} />)}
            {((isMentors && mentorView.length === 0) ||
              (!isMentors && teenView.length === 0)) && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-[var(--text-secondary)]">
                  No {isMentors ? "mentors" : "teens"} match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
  expandable,
  open,
  onToggle,
}: {
  row: MentorRow;
  expandable: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const teens = expandable ? teensForMentor(row.id) : [];
  return (
    <>
      <tr
        onClick={row.recordHref ? () => router.push(row.recordHref!) : undefined}
        className={cn(
          "border-b border-[var(--surface-s2)]",
          !open && "last:border-0",
          row.highlight && "bg-amber-50/60",
          row.recordHref && "cursor-pointer transition-colors hover:bg-black/[0.02]"
        )}
      >
        <td className="px-5 py-3">
          <NameCell name={row.name} goesBy={row.goesBy} recordHref={row.recordHref} />
        </td>
        <td className="px-5 py-3">
          <RolePill role="Mentor" />
        </td>
        <td className="px-5 py-3 tabular-nums text-[var(--text-secondary)]">{row.phone}</td>
        <td className="px-5 py-3 text-[var(--text-secondary)]">{row.group}</td>
        <td className="px-5 py-3"><StatusPill active={row.active} /></td>
        <td className="px-5 py-3"><ProfileCell profile={row.profile} /></td>
        {expandable && (
          <td className="px-5 py-3 text-right">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-expanded={open}
              aria-label={open ? `Hide ${row.name}'s teens` : `Show ${row.name}'s teens`}
              className="inline-flex size-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            >
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
            </button>
          </td>
        )}
      </tr>
      {expandable && open && (
        <tr className="border-b border-[var(--surface-s2)] bg-[var(--surface-s1)]/50">
          <td colSpan={7} className="px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.4px] text-[var(--text-muted)]">
              Mentoring {teens.length} {teens.length === 1 ? "teen" : "teens"}
            </p>
            {teens.length ? (
              <ul className="flex flex-col gap-1.5">
                {teens.map((t) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-secondary-foreground">
                      {initials(t.name)}
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">{t.name}</span>
                    <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                      · joined {relJoined(t.joinedDaysAgo)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No teens matched yet.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function TeenRowView({ teen }: { teen: DemoTeen }) {
  return (
    <tr className="border-b border-[var(--surface-s2)] last:border-0">
      <td className="px-5 py-3">
        <NameCell name={teen.name} goesBy={teen.goesBy} />
      </td>
      <td className="px-5 py-3 text-[var(--text-secondary)]">{mentorName(teen.mentorId)}</td>
      <td className="px-5 py-3 tabular-nums text-[var(--text-secondary)]">{teen.phone}</td>
      <td className="px-5 py-3 text-[var(--text-secondary)]">{teen.group}</td>
      <td className="px-5 py-3"><StatusPill active={teen.active} /></td>
      <td className="px-5 py-3 text-[var(--text-secondary)] tabular-nums">{relJoined(teen.joinedDaysAgo)}</td>
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

function ProfileCell({ profile }: { profile?: "Incomplete" }) {
  return profile ? (
    <span className="rounded-full border border-orange-300 px-2.5 py-0.5 text-xs font-medium text-orange-700">
      {profile}
    </span>
  ) : (
    <span className="text-[var(--text-secondary)]">—</span>
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
