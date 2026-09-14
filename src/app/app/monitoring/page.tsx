"use client";

// /app/monitoring — static route, wins over /app/[section]. Same arrangement
// /app/tasks and /app/activity use.
//
// SUPERVISOR TIER ONLY (arch-B). Adding a static route shadows the dynamic one
// for EVERYBODY, so the non-supervisor branch has to render what
// `/app/[section]` would have rendered — otherwise a mentor who follows a stale
// link gets a blank shell instead of the honest unbuilt-section placeholder, and
// that is a regression for them dressed up as a feature for someone else.
//
// The nav item is supervisor-only too (`railItems`), so no mentor is offered
// this route. This branch is for the link that arrives from somewhere else.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, and every store read behind useMounted.
// These three fail with ZERO console output, so they are followed by
// pattern-match against the existing pages rather than by reasoning.

import { use } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { MonitoringPage } from "@/components/monitoring/monitoring-page";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function MonitoringRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  void use(searchParams);
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);

  // GATED BEHIND `mounted`: persona lives in persisted state, so branching on it
  // before hydration renders the placeholder for one frame and then swaps — a
  // mismatch that produces no error at all.
  const supervisor = mounted && isSupervisorTier(persona);

  if (supervisor) {
    return (
      <AdminShell active="monitoring">
        <MonitoringPage />
      </AdminShell>
    );
  }

  // THE EXISTING EXPERIENCE, UNCHANGED. Copy and structure lifted from
  // /app/[section]/page.tsx's placeholder so the two are indistinguishable.
  return (
    <MentorShell active="monitoring">
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          Monitoring
        </h1>
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          Nothing here yet. When there&apos;s something new, it&apos;ll show up
          here.
        </p>
      </div>
    </MentorShell>
  );
}
