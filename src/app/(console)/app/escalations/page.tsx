"use client";

// /app/escalations — FOLDED INTO MONITORING (proto/monitoring-merge).
//
// Answered 2026-10-19: Escalations's dedicated dashboard goes; the events do
// not. They keep their data model, notifications, timeline records and badge
// semantics, and surface on /app/monitoring — escalations as the Tier 1 lane
// and the escalations column, flags rolled up to the teen row. This route
// stays as a hop so existing links and the dev scenarios do not break; the
// previous page is in git (2978adb).
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams)
// prop pattern rather than useSearchParams.

import { use } from "react";
import { RetiredRoute } from "@/components/ia/retired-route";
import { retiredRouteTarget } from "@/lib/ia/retired-routes";

export default function FoldedRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = use(searchParams);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const target = retiredRouteTarget("escalations", { escalation: str(query.escalation) });
  return (
    <RetiredRoute
      target={target}
      destinationLabel="Monitoring"
      fallbackTitle="Escalations"
      fallbackActive="home"
    />
  );
}
