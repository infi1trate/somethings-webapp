"use client";

// /app/today — Today. THE SUPERVISOR'S DEFAULT LANDING ROUTE.
//
// ═══ PHASE 3 BUILDS THE MIRROR ═══
//
// §4: **Today mirrors. It never contains.** The rule's teeth are in
// `today-page.tsx` (four structural invariants) and in `lib/home/today.ts`
// (every figure computed by the destination that owns it). This file is the
// mount.
//
// IT TAKES NO PARAMS, and that is now a property rather than an omission: a
// mirror has nothing to pre-select. `searchParams` is still awaited because
// Next 16 requires it — a param on the URL leaves the page suspended otherwise.
//
// THE SHELL FOLLOWS THE PERSONA. A supervisor gets the console; anyone else gets
// the mentor chrome and the honest unbuilt sentence, because this is a
// supervisor surface and pretending otherwise would put a rail they do not have
// around a page they cannot use.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, every store read behind useMounted.

import { use } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { DestinationPlaceholder } from "@/components/ia/destination-placeholder";
import { TodayPage } from "@/components/today/today-page";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function TodayRoute({
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

  return supervisor ? (
    <AdminShell active="today">
      <TodayPage />
    </AdminShell>
  ) : (
    /* THE NON-SUPERVISOR BRANCH KEEPS THE PLACEHOLDER. Its sentence is still the
       true one for them: this destination is not offered to their persona. */
    <MentorShell active="home">
      <DestinationPlaceholder
        title="Today"
        status="Shift orientation for a supervisor — the escalation strip and one card per destination. A supervisor surface."
      />
    </MentorShell>
  );
}
