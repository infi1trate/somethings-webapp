"use client";

// /app/monitoring — RETIRED. Monitoring is a GROUP LABEL now — a category of destinations rather than a destination.
//
// The mapping is `retiredRouteTarget` (`lib/ia/retired-routes.ts`), unit-tested
// there and opened in a browser by this phase's probe — a URL assertion cannot
// tell a live destination from a dead one, which the previous restructure
// learned the expensive way.
//
// THE FILE IS NOT DELETED. The strangler rule this codebase follows keeps a
// retired route until every link to it is gone, and a 404 under a bookmark is
// worse than a hop.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams.

import { use } from "react";
import { RetiredRoute } from "@/components/ia/retired-route";
import { retiredRouteTarget } from "@/lib/ia/retired-routes";

export default function MonitoringRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = use(searchParams);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const target = retiredRouteTarget("monitoring", {
    band: str(query.band),
    region: str(query.region),
    escalation: str(query.escalation),
    queue: str(query.queue),
  });
  return (
    <RetiredRoute
      target={target}
      destinationLabel="Risk Flags"
      fallbackTitle="Monitoring"
      fallbackActive="monitoring"
    />
  );
}
