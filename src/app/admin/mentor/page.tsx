"use client";

// Mentor Record (record-01 foundation) — the staff-facing record for THE one
// store-backed mentor (singleton prototype; roster fixtures have no record).
// Section content lands in the next passes; visibility comes from
// lib/record/permission-map.ts, never derived ad hoc. Mentor-facing personas
// are redirected to their own settings — this surface is staff-only.
//
// Next 16 notes (project invariants #5): searchParams via the use(prop)
// pattern (no useSearchParams, no page-root <Suspense> — both silently break
// hydration here) and store reads mounted-gated.

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

export default function MentorRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mounted = useMounted();
  const router = useRouter();
  const query = use(searchParams);
  // ?focus=<section> — reserved: later passes auto-scroll to that record
  // section (the roster's Review entry appends focus=review today).
  const focus = typeof query.focus === "string" ? query.focus : null;

  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const mentorish = persona === "mentor" || persona === "new-mentor";

  // Staff-only surface: mentor personas land on their own settings instead.
  useEffect(() => {
    if (mounted && mentorish) router.replace("/app/profile");
  }, [mounted, mentorish, router]);

  if (!mounted || mentorish) {
    return (
      <AdminShell active="users">
        <div className="min-h-dvh" />
      </AdminShell>
    );
  }

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    "Jordan Rivera";

  return (
    <AdminShell active="users">
      <div className="px-6 py-6 lg:px-10" data-focus-target={focus ?? undefined}>
        <Link
          href="/admin/users"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Users
        </Link>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Mentor record
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          {mentorName}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-[var(--text-secondary)]">
          Mentor record — sections land in the next passes.
        </p>
      </div>
    </AdminShell>
  );
}
