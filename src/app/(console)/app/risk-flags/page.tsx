"use client";

// /app/risk-flags — Risk Flags.
//
// ═══ PHASE 2 MOVES THE CONTENTS IN, AND IT IS A MOUNT NOT A REWRITE ═══
//
// The flag queue moves here from Monitoring as `MonitoringPage` under
// `scope="risk-flags"`, which pins the review subject to teen safety and hides
// the subject chips — the chip row became this route boundary, which is §3's
// distribution expressed in the URL instead of in a filter.
//
// NO TIERS ALREADY. The queue this inherits has one comparator and no tier
// bands; Phase 4 proves the per-flag tier gone by grep, against this destination
// rather than against a half-built one.
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
import { MonitoringPage } from "@/components/monitoring/monitoring-page";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function RiskFlagsRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  /* READ AND USED NOW — `?flag={id}` is Today's deep link into an individual
     flag (Phase I.5.2). Next 16's prop pattern: `searchParams` is a promise and
     must be awaited even when nothing is read from it, or a param on the URL
     leaves the page suspended. This destination takes no params — the two it
     used to take, `?band=` and `?region=`, are what the route itself now says. */
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
    <AppChrome active={supervisor ? "risk-flags" : "home"}>
      {supervisor ? (
        <MonitoringPage
          scope="risk-flags"
          /* `?flag={id}` — the same deep link one destination along (I.5.2). */
          focusFlag={str(query.flag)}
        />
      ) : (
        /* THE NON-SUPERVISOR BRANCH KEEPS THE PLACEHOLDER. Its sentence is still the
         true one for them: this destination is not offered to their persona, so
         "unbuilt" is what it is from where they stand. */
        <DestinationPlaceholder title="Risk Flags" status="One queue of risk flags for a supervisor's judgment. A supervisor surface." />
      )}
    </AppChrome>
  );
}
