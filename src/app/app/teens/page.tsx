"use client";

// Lead Mentor's "Teens" view — every teen inside the lead's umbrella (their
// mentors' teens), rendered in the mentor app shell. Filter by tenure, see each
// teen's Mentor, and sort/group by Mentor. A real route, so it takes precedence
// over the /app/[section] catch-all (like /app/mentors).

import { MentorShell } from "@/components/mentor/mentor-shell";
import { Roster } from "@/components/admin/roster";

export default function TeensPage() {
  return (
    <MentorShell active="teens">
      <Roster role="lead" segment="teens" showQueues={false} />
    </MentorShell>
  );
}
