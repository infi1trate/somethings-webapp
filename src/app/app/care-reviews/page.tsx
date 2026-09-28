"use client";

// /app/care-reviews — Care Reviews.
//
// ═══ PHASE 2 MOVES THE CONTENTS IN, AND IT IS A MOUNT NOT A REWRITE ═══
//
// The presentation-review module moves here from `/app/tasks` UNCHANGED —
// the cleanest row in §3's distribution, because Tasks has been billing-only
// since arch-A and billing is exactly what Care Reviews means. One import, one
// mount, no props but the band link.
//
// IT IS THE ONE DESTINATION WITH A REAL PUBLISHED DEADLINE, which is why it
// keeps its clock-shaped rail badge while the flag queues carry bare counts.
//
// THE DETAIL IS FROZEN: the review body is verified byte-identical by
// `review-body-parity`, so this move must not touch it — and does not, because
// it is a mount.
//
// THE SHELL FOLLOWS THE PERSONA. A supervisor gets the console; anyone else gets
// the mentor chrome and the honest unbuilt sentence, because these destinations
// are supervisor surfaces and pretending otherwise would put a rail they do not
// have around a page they cannot use.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, every store read behind useMounted.

import { use } from "react";
import { AppChrome } from "@/components/app-shell/app-chrome";
import { DestinationPlaceholder } from "@/components/ia/destination-placeholder";
import { TasksPage } from "@/components/tasks/tasks-page";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function CareReviewsRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = use(searchParams);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  // Gated behind `mounted`: persona is persisted, and branching on it before
  // hydration swaps the shell for one frame with no error to show for it.
  const supervisor = mounted && isSupervisorTier(persona);

  return (
    /* ═══ ONE SHELL, ONE INSTANCE (addendum §2.3) ═══
       It was two `AppChrome` elements in a ternary, which renders one shell but
       reads as a choice of chrome. The choice is the CONTENT and the active
       item; the chrome is the same component either way. */
    <AppChrome active={supervisor ? "care-reviews" : "home"}>
      {supervisor ? (
        <TasksPage
          scope="care-reviews"
          focusBand={str(query.band)}
          /* `?review={id}` — Today's start-here preview deep-links to the
             individual review (Phase I.5.2). It seeds the list's existing
             selection; the detail pane renders exactly what it renders when a
             supervisor clicks the row, so the frozen surface is untouched. */
          focusReview={str(query.review)}
        />
      ) : (
        /* THE NON-SUPERVISOR BRANCH KEEPS THE PLACEHOLDER. Its sentence is still the
         true one for them: this destination is not offered to their persona, so
         "unbuilt" is what it is from where they stand. */
        <DestinationPlaceholder title="Care Reviews" status="Intake and monthly billing reviews. A supervisor surface." />
      )}
    </AppChrome>
  );
}
