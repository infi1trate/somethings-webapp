"use client";

// /app/tasks — static route, wins over /app/[section]. Same arrangement
// /app/activity uses.
//
// SUPERVISOR PERSONA ONLY IN V1 (§1). Every other persona sees THE EXISTING
// EXPERIENCE UNTOUCHED — which on this route is the /app/[section] unbuilt-section
// placeholder, reproduced below verbatim rather than approximated. Adding a static
// route shadows the dynamic one for everybody, so the non-supervisor branch has to
// render what the dynamic route would have; anything less would be a regression for
// mentors and leads dressed up as a new feature for supervisors.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, and every store read behind useMounted.
// These three fail with ZERO console output, so they are followed by pattern-match
// against the existing pages rather than by reasoning.

import { use } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { TasksPage } from "@/components/tasks/tasks-page";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function TasksRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Read through the prop pattern so the shape is right before a later phase needs
  // a param (the digest's deep links in T5, most likely).
  void use(searchParams);
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);

  // GATED BEHIND `mounted`: persona lives in persisted state, so branching on it
  // before hydration renders the placeholder for one frame and then swaps — a
  // mismatch that produces no error at all.
  const supervisor = mounted && isSupervisorTier(persona);

  if (supervisor) {
    return (
      <AdminShell active="tasks">
        <TasksPage />
      </AdminShell>
    );
  }

  // THE EXISTING EXPERIENCE, UNCHANGED. Copy and structure lifted from
  // /app/[section]/page.tsx's placeholder so the two are indistinguishable.
  return (
    <MentorShell active="tasks">
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          Tasks
        </h1>
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          Nothing here yet. When there&apos;s something new, it&apos;ll show up
          here.
        </p>
      </div>
    </MentorShell>
  );
}
