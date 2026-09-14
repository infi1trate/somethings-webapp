"use client";

// /app/home — a static route, so it wins over /app/[section].
//
// SUPERVISOR TIER ONLY. Every other persona gets what `/app/[section]` would
// have rendered, reproduced here: a static route shadows the dynamic one for
// EVERYBODY, and a mentor following a stale link to a blank shell would be a
// regression for them dressed up as a feature for someone else.
//
// ═══ THE SHELL IS THE FIX arch-C INHERITED ═══
//
// `/app/[section]` hardcodes `MentorShell`, so before this route a supervisor's
// Home sat inside a nav landmark announced as "Mentor navigation" — measured on
// all four personas. The comment at that placeholder says `/app/home` exists
// precisely so staff are not handed "a mentor's home in a mentor's chrome"; the
// URL moved and the chrome did not. `AdminShell` is what closes that.
//
// STANDING NEXT-16 RULES: no page-root <Suspense>, the use(searchParams) prop
// pattern rather than useSearchParams, and every store read behind useMounted.
// These three fail with ZERO console output, so they are followed by
// pattern-match against the existing pages rather than by reasoning.

import { use } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { HomePage } from "@/components/home/home-page";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function HomeRoute({
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
      <AdminShell active="home">
        <HomePage />
      </AdminShell>
    );
  }

  // THE EXISTING EXPERIENCE, UNCHANGED. Copy and structure lifted from
  // /app/[section]/page.tsx's placeholder so the two are indistinguishable.
  return (
    <MentorShell active="home">
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <h1 className="font-display text-[24px] font-bold leading-[32px] text-[var(--text-primary)]">
          Home
        </h1>
        <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
          Nothing here yet. When there&apos;s something new, it&apos;ll show up
          here.
        </p>
      </div>
    </MentorShell>
  );
}
