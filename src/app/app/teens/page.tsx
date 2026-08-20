"use client";

// Teens — scoped to who's looking:
//   Mentor     → THEIR OWN mentees (the same set their record's table shows).
//                A mentor must not see every teen on the platform.
//   Supervisor → the full roster (they oversee the whole side).
//   Lead       → no Teens destination at all; leads supervise mentors, and
//                reach a teen through the mentor who holds the match. The nav
//                omits the item, and landing here anyway sends them to Team.
//
// A real route, so it takes precedence over the /app/[section] catch-all.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { Roster } from "@/components/admin/roster";
import { MenteeList } from "@/components/record/mentee-list";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

export default function TeensPage() {
  const mounted = useMounted();
  const router = useRouter();
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const slots = useOnboardingStore((s) => s.slots);
  const isLead = mounted && persona === "lead-mentor";

  useEffect(() => {
    if (isLead) router.replace("/app/team");
  }, [isLead, router]);

  if (isLead) return null;

  // Supervisors get the platform roster; everyone else sees their own mentees.
  if (mounted && persona === "supervisor") {
    return (
      <MentorShell active="teens">
        <Roster role="supervisor" segment="teens" showQueues={false} />
      </MentorShell>
    );
  }

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "you";

  return (
    <MentorShell active="teens">
      <div className="px-6 py-6 lg:px-10">
        <header className="max-w-prose">
          <h1
            className="text-[var(--text-primary)]"
            style={{ font: "var(--type-title-lg)" }}
          >
            Teens
          </h1>
          <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
            The teens you&rsquo;re matched with.
          </p>
        </header>
        <div className="mt-7 max-w-[900px]">
          <MenteeList mentorId="live" mentorName={mentorName} capacityTotal={slots.total} />
        </div>
      </div>
    </MentorShell>
  );
}
