"use client";

// Team — the staff directory, for every persona. Scope varies by who's looking
// (see TeamDirectory); the surface is the same one everywhere, which is the
// point: "the people I work with" was previously split across a Mentors roster
// and nothing at all, depending on role.
//
// A real route, so it takes precedence over the /app/[section] catch-all.

import { MentorShell } from "@/components/mentor/mentor-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  TeamDirectory,
  type TeamScope,
} from "@/components/admin/team-directory";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function TeamPage() {
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);

  const scope: TeamScope = !mounted
    ? "mentor"
    : isSupervisorTier(persona)
      ? "supervisor"
      : persona === "lead-mentor"
        ? "lead"
        : "mentor";

  // Supervisors keep the admin console chrome; mentors and leads stay in the
  // mentor app shell (the role migration's "two rails, one route" rule).
  if (mounted && isSupervisorTier(persona)) {
    return (
      <AdminShell active="team">
        <TeamDirectory scope={scope} />
      </AdminShell>
    );
  }

  return (
    <MentorShell active="team">
      <TeamDirectory scope={scope} />
    </MentorShell>
  );
}
