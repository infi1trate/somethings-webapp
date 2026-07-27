"use client";

// Lead Mentor's "Mentors" view — the same mentors roster the Supervisor sees,
// but rendered inside the mentor app shell so a Lead Mentor never leaves the
// mentor UI. No review queues here (those are supervisor actions); this is a
// browse-and-open-record list. A real route, so it takes precedence over the
// /app/[section] catch-all.

import { MentorShell } from "@/components/mentor/mentor-shell";
import { Roster } from "@/components/admin/roster";

export default function MentorsPage() {
  return (
    <MentorShell active="mentors">
      <Roster role="lead" segment="mentors" showQueues={false} />
    </MentorShell>
  );
}
