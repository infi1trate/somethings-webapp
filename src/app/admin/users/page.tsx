"use client";

// Supervisor roster — split into Teens / Mentors segments (nav restructure).
// Thin wrapper: read the segment from the URL and render the shared Roster in
// the console shell. The review queues belong to the Mentors segment (the
// supervisor's review actions). Next 16 note (invariant 5): the
// use(searchParams) prop pattern — no useSearchParams, no page-root Suspense.

import { use } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Roster, type RosterSegment } from "@/components/admin/roster";

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = use(searchParams);
  // Default to mentors — the review-centric view, and where the record/review
  // "back to users" links land.
  const segment: RosterSegment = query.segment === "teens" ? "teens" : "mentors";

  return (
    <AdminShell active={segment}>
      <Roster segment={segment} showQueues={segment === "mentors"} />
    </AdminShell>
  );
}
