"use client";

// /app/coverage — Coverage.
//
// PHASE 1 CREATES THE ROUTE, not the surface. The body is a placeholder that
// says what arrives and when; see `DestinationPlaceholder` for why the generic
// `/app/[section]` view is not reused (wrong chrome, and "nothing here yet"
// would be false for four of the six).
//
// THE SHELL FOLLOWS THE PERSONA. A supervisor gets the console; anyone else gets
// the mentor chrome and the same honest sentence, because these destinations are
// supervisor surfaces and pretending otherwise would put a rail they do not have
// around a page they cannot use.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, every store read behind useMounted.

import { use } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { DestinationPlaceholder } from "@/components/ia/destination-placeholder";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function CoverageRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  void use(searchParams);
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  // Gated behind `mounted`: persona is persisted, and branching on it before
  // hydration swaps the shell for one frame with no error to show for it.
  const supervisor = mounted && isSupervisorTier(persona);

  const body = (
    <DestinationPlaceholder
      title="Coverage"
      status="Every supervised conversation as progress against a period — the answer to “have I looked at my mentees” that a queue of what a model noticed cannot give. Phase 7, and its credit rule is still with Meg."
    />
  );

  return supervisor ? (
    <AdminShell active="coverage">{body}</AdminShell>
  ) : (
    <MentorShell active="home">{body}</MentorShell>
  );
}
