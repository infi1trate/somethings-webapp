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
import { AppChrome } from "@/components/app-shell/app-chrome";
import { PageHeader } from "@/components/ia/page-header";
import { useRouter } from "next/navigation";
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
      <AppChrome active="mentees">
        <Roster role="supervisor" segment="mentees" showQueues={false} />
      </AppChrome>
    );
  }

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "you";

  return (
    <AppChrome active="mentees">
      <div className="px-6 py-6 lg:px-10">
        {/* ═══ THE SHARED HEADER (addendum §2.10) ═══
            NO METRIC HERE, and the reason is where the number lives: §2.10 asks
            for "the total count for the active filter", and the filter and the
            rows are both inside `MenteeTable`. Lifting the filtered count out
            of that component is a change to a surface this addendum does not
            otherwise touch, so it is reported rather than faked with a total
            that ignores the filter — which would be worse than no metric, since
            a figure that does not move when a reader filters teaches them not
            to trust it. Team's metric IS wired, because its filtered set is
            already in the page. */}
        <PageHeader
          title="Mentees"
          /* TODO-COPY */
          purpose="The mentees you’re matched with."
        />
        <div className="mt-7 max-w-[900px]">
          <MenteeTable
            mentorId="live"
            mentorName={mentorName}
            capacity={slots.total}
          />
        </div>
      </div>
    </AppChrome>
  );
}
