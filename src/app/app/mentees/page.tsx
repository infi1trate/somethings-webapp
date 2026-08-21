"use client";

// Mentees — scoped to who's looking:
//   Mentor     → THEIR OWN mentees (the same set their record's table shows).
//                A mentor must not see every teen on the platform.
//   Supervisor → the full roster (they oversee the whole side).
//   Lead       → no Mentees destination at all; leads supervise mentors, and
//                reach a teen through the mentor who holds the match. The nav
//                omits the item, and landing here anyway sends them to Team.
//
// A real route, so it takes precedence over the /app/[section] catch-all.
//
// The URL segment is /app/mentees, matching the wording. /app/teens redirects
// here so older links keep working — without it they'd fall through to the
// [section] catch-all and 404, because no sidebar item carries that id any more.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { Roster } from "@/components/admin/roster";
import { MenteeTable } from "@/components/record/mentee-table";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useMounted } from "@/lib/use-mounted";

export default function MenteesPage() {
  const mounted = useMounted();
  const router = useRouter();
  const persona = useOnboardingStore((s) => s.persona);
  const slots = useOnboardingStore((s) => s.slots);
  const draft = useOnboardingStore((s) => s.draft);
  const isLead = mounted && persona === "lead-mentor";

  useEffect(() => {
    if (isLead) router.replace("/app/team");
  }, [isLead, router]);

  if (isLead) return null;

  // Supervisors get the platform roster; everyone else sees their own mentees.
  if (mounted && isSupervisorTier(persona)) {
    return (
      <MentorShell active="mentees">
        <Roster role="supervisor" segment="mentees" showQueues={false} />
      </MentorShell>
    );
  }

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "you";

  return (
    <MentorShell active="mentees">
      <div className="px-6 py-6 lg:px-10">
        <header className="max-w-prose">
          <h1
            className="text-[var(--text-primary)]"
            style={{ font: "var(--type-title-lg)" }}
          >
            Mentees
          </h1>
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {/* TODO-COPY */}
            The mentees you&rsquo;re matched with.
          </p>
        </header>
        <div className="mt-7 max-w-[900px]">
          <MenteeTable
            mentorId="live"
            mentorName={mentorName}
            capacity={slots.total}
          />
        </div>
      </div>
    </MentorShell>
  );
}
