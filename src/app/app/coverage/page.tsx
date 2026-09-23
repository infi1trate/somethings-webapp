"use client";

// /app/coverage — Coverage.
//
// ═══ PHASE 2 MOVES THE CONTENTS IN, AND IT IS A MOUNT NOT A REWRITE ═══
//
// The coverage view moves here as `MonitoringPage` under
// `scope="coverage"`, which pins the view and hides the segmented control — the
// second tab became this route, so the control is a one-tab row offering no
// choice, which is dead chrome by the same rule that removed the worklist's.
//
// IT IS THE FLOOR, NOT A QUEUE. A surface that can only show what a model
// noticed cannot answer "have I looked at my teens", which is why coverage is a
// destination and not a panel. Phase 7 finishes it; the credit rule is with
// Meg.
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

export default function CoverageRoute({
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
    <AdminShell active="coverage">
      <MonitoringPage scope="coverage" />
    </AdminShell>
  ) : (
    /* THE NON-SUPERVISOR BRANCH KEEPS THE PLACEHOLDER. Its sentence is still the
       true one for them: this destination is not offered to their persona, so
       "unbuilt" is what it is from where they stand. */
    <MentorShell active="home">
      <DestinationPlaceholder title="Coverage" status="Every supervised conversation as progress against the shift. A supervisor surface." />
    </MentorShell>
  );
}
