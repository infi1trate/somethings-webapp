"use client";

// Lead Mentor's "Mentors" view — their management home (role migration): the
// umbrella roster PLUS the review queues (Needs review / Profile updates),
// since the Lead Mentor owns mentor reviews now. Rendered inside the mentor
// app shell. A real route, so it takes precedence over the /app/[section]
// catch-all.

import { MentorShell } from "@/components/mentor/mentor-shell";
import { Roster } from "@/components/admin/roster";

export default function MentorsPage() {
  return (
    <MentorShell active="mentors">
      <Roster role="lead" segment="mentors" showQueues />
    </MentorShell>
  );
}
