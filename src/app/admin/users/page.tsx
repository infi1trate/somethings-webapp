"use client";

import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Admins", "Super Admins", "Teens", "Mentors"];
// REMOVED — "All Groups" filter (build spec §4/§8: Groups killed, field and
// concept). The roster's `group` column is Phase 6's call when this console
// is rebuilt.
const DROPDOWNS = ["Any Status", "All Profiles"];

// Static demo roster — enough to make the queue read like the real console.
const ROSTER: {
  name: string;
  role: "Mentee" | "Mentor";
  phone: string;
  group: string;
  active: boolean;
  profile?: "Incomplete";
}[] = [
  { name: "Nick Casparro", role: "Mentee", phone: "+17078892558", group: "North Carolina", active: true },
  { name: "Patricia Johnson", role: "Mentee", phone: "+19089101254", group: "New Jersey", active: true },
  { name: "John Smith", role: "Mentor", phone: "+19089101133", group: "Illinois, North Carolina", active: true, profile: "Incomplete" },
  { name: "Amy Hashing", role: "Mentee", phone: "+19089101035", group: "North Carolina", active: true },
  { name: "Brandy Forrestor", role: "Mentor", phone: "+17079923456", group: "New Jersey", active: true, profile: "Incomplete" },
  { name: "John Kneeland", role: "Mentee", phone: "+12158805908", group: "Illinois", active: false },
];

export default function AdminUsersPage() {
  const mounted = useMounted();
  const status = useOnboardingStore((s) => s.status);
  const draft = useOnboardingStore((s) => s.draft);

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "Jordan Rivera";
  const needsReview = mounted && status === "in_review";

  return (
    <AdminShell active="users">
      <div className="px-6 py-6 lg:px-10">
        <h1 className="font-display text-2xl font-bold tracking-tight">Users</h1>

        {/* Filters (decorative in the prototype) */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {FILTERS.map((f, i) => (
            <span
              key={f}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium",
                i === 0
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground"
              )}
            >
              {f}
            </span>
          ))}
          {DROPDOWNS.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground"
            >
              {d}
              <ChevronDown className="size-4" />
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <Search className="size-4" />
            Search
          </span>
        </div>

        {/* Needs-review group — the entry point into mentor review */}
        <section className="mt-6 overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
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
                <p className="text-sm text-muted-foreground">
                  Mentor · submitted for review
                </p>
              </div>
              <Button asChild className="ml-auto">
                <Link href="/admin/review">Review</Link>
              </Button>
            </div>
          ) : (
            <p className="px-5 py-5 text-sm text-muted-foreground">
              Nothing waiting for review right now.
            </p>
          )}
        </section>

        {/* Roster */}
        <div className="mt-6 overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Group</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Profile</th>
              </tr>
            </thead>
            <tbody>
              {needsReview && (
                <Row
                  name={mentorName}
                  role="Mentor"
                  phone={draft.phone || "+1 (415) 555-0188"}
                  group="California"
                  active
                  profile="Incomplete"
                  highlight
                />
              )}
              {ROSTER.map((r) => (
                <Row key={r.name} {...r} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function Row({
  name,
  role,
  phone,
  group,
  active,
  profile,
  highlight,
}: {
  name: string;
  role: "Mentee" | "Mentor";
  phone: string;
  group: string;
  active: boolean;
  profile?: "Incomplete";
  highlight?: boolean;
}) {
  return (
    <tr className={cn("border-b last:border-0", highlight && "bg-amber-50/60")}>
      <td className="px-5 py-3">
        <span className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
            {initials(name)}
          </span>
          <span className="font-medium">{name}</span>
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
      <td className="px-5 py-3 tabular-nums text-muted-foreground">{phone}</td>
      <td className="px-5 py-3 text-muted-foreground">{group}</td>
      <td className="px-5 py-3">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
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
          <span className="text-muted-foreground">—</span>
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
