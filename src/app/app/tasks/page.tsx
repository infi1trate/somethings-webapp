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
  /** ═══ `?band=<taskType>` — arch-C's stage link ═══
   *
   *  Home's shift sequence gives each stage exactly one way in, and "Tasks" with
   *  no further aim would drop a supervisor at the top of a fifteen-row list they
   *  then have to find their place in. The param names a BAND rather than an
   *  item: a stage is a kind of work, not a particular review, and a link to one
   *  specific item would go stale the moment somebody else resolved it.
   *
   *  Read through the prop pattern, never `useSearchParams` (standing rule 3).
   *  Validated inside the page against the real band list, so a stale bookmark
   *  lands on the default view rather than on nothing. */
  const query = use(searchParams);
  const band = typeof query.band === "string" ? query.band : null;
  const mounted = useMounted();
  const persona = useOnboardingStore((s) => s.persona);

  // GATED BEHIND `mounted`: persona lives in persisted state, so branching on it
  // before hydration renders the placeholder for one frame and then swaps — a
  // mismatch that produces no error at all.
  const supervisor = mounted && isSupervisorTier(persona);

  if (supervisor) {
    return (
      <AdminShell active="tasks">
        <TasksPage focusBand={band} />
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
