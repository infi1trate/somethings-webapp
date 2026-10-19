"use client";

// /app/monitoring — MONITORING, a destination again (proto/monitoring-merge).
//
// ═══ SUPERSEDES "RETIRED: MONITORING IS A GROUP LABEL" ═══ This route was a
// hop (`retiredRouteTarget("monitoring")`) because Monitoring had become a
// category of destinations rather than one. Answered 2026-10-19: Monitoring
// is BOTH — the group label and, under it, the page that folds Escalations
// and Risk Flags into one tiered view of every teen. /app/escalations and
// /app/risk-flags now hop here instead (`lib/ia/retired-routes.ts`).
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams)
// prop pattern rather than useSearchParams.

import { use } from "react";
import { AppChrome } from "@/components/app-shell/app-chrome";
import { DestinationPlaceholder } from "@/components/ia/destination-placeholder";
import { RetiredRoute } from "@/components/ia/retired-route";
import { monitoringLegacyTarget } from "@/lib/ia/retired-routes";
import { MonitoringOverview } from "@/components/monitoring/overview/monitoring-overview";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function MonitoringRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  /* `?escalation=` and `?flag=` arrive from the folded routes' links.
     TODO(monitoring): open that record here; until then the page lands on
     the tiers and the id is carried, not lost. */
  const query = use(searchParams);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  /* Its old billing links still belong to Care Reviews (`monitoringLegacyTarget`). */
  const legacy = monitoringLegacyTarget({ band: str(query.band), queue: str(query.queue) });
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);
  // Gated behind `mounted`: persona is persisted, and branching on it before
  // hydration swaps the shell for one frame with no error to show for it.
  const supervisor = mounted && isSupervisorTier(persona);
  if (legacy) {
    return <RetiredRoute target={legacy} destinationLabel="Care Reviews" fallbackTitle="Monitoring" fallbackActive="home" />;
  }
  return (
    <AppChrome active={supervisor ? "monitoring" : "home"}>
      {supervisor ? (
        <MonitoringOverview />
      ) : (
        <DestinationPlaceholder title="Monitoring" status="Every teen, by stepped-care tier, for a supervisor's judgment. A supervisor surface." />
      )}
    </AppChrome>
  );
}
