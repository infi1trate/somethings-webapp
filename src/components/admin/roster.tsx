"use client";

// Shared roster — the people list that used to live inline in
// /admin/users. Now a segment-filtered, shell-agnostic component so it can
// render in BOTH the Supervisor console (AdminShell, with the review queues)
// and the Lead Mentor app (MentorShell, list only). Styling is unchanged from
// the original page; only the row set + queue visibility vary by props.
//
//   segment "teens"   → the mentee rows (fixtures role "Mentee")
//   segment "mentors" → the mentor rows (fixtures role "Mentor") PLUS the one
//                       store-backed live mentor
//   showQueues        → the Needs-review + Profile-updates queues (supervisor
//                       review actions); off for the Lead Mentor list view

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { changesetSummary, relTime } from "@/lib/onboarding/profile-update";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

export type RosterSegment = "teens" | "mentors";

// "Admin" → Supervisor (Phase 10, decision #12). "Super Admins" is a
// distinct production role, untouched — see gaps.md #59.
const FILTERS = ["All", "Supervisors", "Super Admins", "Teens", "Mentors"];
const DROPDOWNS = ["Any Status", "All Profiles"];

// Static demo roster. `goesBy` = teen-facing display name when it differs from
// the legal name (§9.3 — escalations about a display name must match a real
// account).
const ROSTER: {
  name: string;
  role: "Mentee" | "Mentor";
  phone: string;
  group: string;
  active: boolean;
  profile?: "Incomplete";
  goesBy?: string;
}[] = [
  { name: "Nick Casparro", role: "Mentee", phone: "+17078892558", group: "North Carolina", active: true },
  { name: "Patricia Johnson", role: "Mentee", phone: "+19089101254", group: "New Jersey", active: true },
  { name: "John Smith", role: "Mentor", phone: "+19089101133", group: "Illinois, North Carolina", active: true, profile: "Incomplete" },
  { name: "Amy Hashing", role: "Mentee", phone: "+19089101035", group: "North Carolina", active: true },
  { name: "Brandy Forrestor", role: "Mentor", phone: "+17079923456", group: "New Jersey", active: true, profile: "Incomplete", goesBy: "Bee" },
  { name: "John Kneeland", role: "Mentee", phone: "+12158805908", group: "Illinois", active: false },
];

export function Roster({
  segment,
  showQueues,
}: {
  segment: RosterSegment;
  showQueues: boolean;
}) {
  const mounted = useMounted();
  const status = useOnboardingStore((s) => s.status);
  const draft = useOnboardingStore((s) => s.draft);
  const profileUpdate = useOnboardingStore((s) => s.profileUpdate);

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Jordan Rivera";
  const needsReview = mounted && status === "in_review";
  const update = mounted ? profileUpdate : null;
  const updateFlagged = update?.status === "changes-requested";

  const isMentors = segment === "mentors";
  const wantRole = isMentors ? "Mentor" : "Mentee";
  const rows = ROSTER.filter((r) => r.role === wantRole);
  // The store-backed live mentor belongs only to the mentors segment.
  const showLiveMentor = isMentors && mounted && !!draft.firstName;
  const heading = isMentors ? "Mentors" : "Teens";
  const activeChip = isMentors ? "Mentors" : "Teens";

  return (
    <div className="px-6 py-6 lg:px-10">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        {heading}
      </h1>

      {/* Filters (decorative in the prototype) — the chip matching the
          current segment reads as selected. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <span
            key={f}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium",
              f === activeChip
                ? "border-foreground bg-foreground text-background"
                : "border-[var(--border-subtle)] bg-white text-foreground"
            )}
          >
            {f}
          </span>
        ))}
        {DROPDOWNS.map((d) => (
          <span
            key={d}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white px-4 py-1.5 text-sm text-[var(--text-secondary)]"
          >
            {d}
            <ChevronDown className="size-4" />
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-white px-4 py-1.5 text-sm text-[var(--text-secondary)]">
          <Search className="size-4" />
          Search
        </span>
      </div>

      {/* Review queues — supervisor actions; only on the Mentors segment in
          the console (showQueues). */}
      {showQueues && (
        <>
          {/* Needs-review group — the entry point into mentor review */}
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
                  {initials(mentorName)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{mentorName}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Mentor · submitted for review
                  </p>
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

          {/* Profile updates queue (§5.1) — live mentors' post-publish changesets */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--surface-s2)] px-5 py-3">
              <h2 className="text-sm font-semibold">Profile updates</h2>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground">
                {update && !updateFlagged ? 1 : 0}
              </span>
            </div>
            {update ? (
              <div
                className={cn(
                  "flex items-center gap-4 px-5 py-4",
                  updateFlagged && "opacity-70"
                )}
              >
                <span className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground">
                  {initials(mentorName)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{mentorName}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {changesetSummary(update)} · {relTime(update.updatedAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    "ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    updateFlagged
                      ? "border border-orange-300 text-orange-700"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {updateFlagged ? "Changes requested" : "Pending"}
                </span>
                <Button
                  asChild
                  variant={updateFlagged ? "outline" : "default"}
                  className="ml-auto"
                >
                  <Link href="/admin/mentor?focus=review">
                    {updateFlagged ? "View" : "Review"}
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="px-5 py-5 text-sm text-[var(--text-secondary)]">
                No profile updates waiting.
              </p>
            )}
          </section>
        </>
      )}

      {/* Roster */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-s2)] text-left text-[var(--text-secondary)]">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Group</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Profile</th>
            </tr>
          </thead>
          <tbody>
            {/* The prototype's live mentor — always in the mentors roster once
                their account exists. Legal name primary; display name
                secondary when it differs (§9.3). */}
            {showLiveMentor && (
              <Row
                recordHref="/admin/mentor"
                name={mentorName}
                goesBy={
                  draft.displayName.trim() &&
                  draft.displayName.trim() !== draft.firstName.trim()
                    ? draft.displayName.trim()
                    : undefined
                }
                role="Mentor"
                phone={draft.phone || "+1 (415) 555-0188"}
                group="California"
                active={status === "published"}
                profile={needsReview ? "Incomplete" : undefined}
                highlight={needsReview}
              />
            )}
            {rows.map((r) => (
              <Row key={r.name} {...r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  name,
  goesBy,
  role,
  phone,
  group,
  active,
  profile,
  highlight,
  recordHref,
}: {
  name: string;
  /** Teen-facing display name, shown only when it differs from the legal name. */
  goesBy?: string;
  role: "Mentee" | "Mentor";
  phone: string;
  group: string;
  active: boolean;
  profile?: "Incomplete";
  highlight?: boolean;
  /** record-01: set on the one store-backed mentor — the row opens their
   *  Mentor Record (fixtures have none and stay inert). */
  recordHref?: string;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={recordHref ? () => router.push(recordHref) : undefined}
      className={cn(
        "border-b border-[var(--surface-s2)] last:border-0",
        highlight && "bg-amber-50/60",
        recordHref && "cursor-pointer transition-colors hover:bg-black/[0.02]"
      )}
    >
      <td className="px-5 py-3">
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
      </td>
      <td className="px-5 py-3">
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-medium",
            role === "Mentor"
              ? "border-[#7b5bd6]/40 text-[#5b41a8]"
              : "border-destructive/40 text-destructive"
          )}
        >
          {role}
        </span>
      </td>
      <td className="px-5 py-3 tabular-nums text-[var(--text-secondary)]">{phone}</td>
      <td className="px-5 py-3 text-[var(--text-secondary)]">{group}</td>
      <td className="px-5 py-3">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            active ? "bg-foreground text-background" : "bg-muted text-[var(--text-secondary)]"
          )}
        >
          {active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-5 py-3">
        {profile ? (
          <span className="rounded-full border border-orange-300 px-2.5 py-0.5 text-xs font-medium text-orange-700">
            {profile}
          </span>
        ) : (
          <span className="text-[var(--text-secondary)]">—</span>
        )}
      </td>
    </tr>
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
