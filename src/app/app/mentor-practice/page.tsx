"use client";

// /app/mentor-practice — Mentor Practice.
//
// ═══ PHASE 2 MOVES THE CONTENTS IN, AND IT IS A MOUNT NOT A REWRITE ═══
//
// The practice queue moves here as `MonitoringPage` under
// `scope="mentor-practice"` — the other half of the subject filter, now its own
// route. The five deterministic rules in `lib/monitoring/practice.ts` already
// feed it.
//
// WHAT PHASE 8 STILL OWES IT: a practice event closes with NO LEDGER WRITE,
// because `buildResolveEvent` maps a task domain to an event type and mentor
// practice is not a domain. The gap is stated in `monitoring-page.tsx` at the
// resolve handler rather than papered over with a flag-shaped event that would
// file a teen-safety record for a mentor's late note.
//
// THE SHELL FOLLOWS THE PERSONA. A supervisor gets the console; anyone else gets
// the mentor chrome and the honest unbuilt sentence, because these destinations
// are supervisor surfaces and pretending otherwise would put a rail they do not
// have around a page they cannot use.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, every store read behind useMounted.

import { use } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { DestinationPlaceholder } from "@/components/ia/destination-placeholder";
import { MonitoringPage } from "@/components/monitoring/monitoring-page";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function MentorPracticeRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  /* READ AND DISCARDED. Next 16's prop pattern: `searchParams` is a promise and
     must be awaited even when nothing is read from it, or a param on the URL
     leaves the page suspended. This destination takes no params — the two it
     used to take, `?band=` and `?region=`, are what the route itself now says. */
  void use(searchParams);
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  // Gated behind `mounted`: persona is persisted, and branching on it before
  // hydration swaps the shell for one frame with no error to show for it.
  const supervisor = mounted && isSupervisorTier(persona);

  return supervisor ? (
    <AdminShell active="mentor-practice">
      <MonitoringPage scope="mentor-practice" />
    </AdminShell>
  ) : (
    /* THE NON-SUPERVISOR BRANCH KEEPS THE PLACEHOLDER. Its sentence is still the
       true one for them: this destination is not offered to their persona, so
       "unbuilt" is what it is from where they stand. */
    <MentorShell active="home">
      <DestinationPlaceholder title="Mentor Practice" status="Mentor practice breaches for a supervisor's review. A supervisor surface." />
    </MentorShell>
  );
}
