"use client";

// PersonMentorship — the Mentorship tab for a FIXTURE mentor. The counterpart to
// MentorshipPractice (which serves the one store-backed mentor).
//
// THE FULL CARE NETWORK AROUND THIS MENTOR — who holds him up, who he holds up.
//
// Same two components as the live record (CareNetwork + MenteeTable) with the
// same props, so the two Mentorship tabs cannot drift. Only the data source
// differs: fixture row + per-person store overrides here, store axes there.

import { CareNetwork, type NetworkPerson } from "@/components/record/care-network";
import { MenteeTable } from "@/components/record/mentee-table";
import { DEMO_PEOPLE, roleOf } from "@/lib/record/people-demo";
import type { FixtureSubject } from "@/lib/record/subject";
import { useOnboardingStore } from "@/lib/onboarding/store";
// Role wording comes from the ONE shared map (Bloom Role Label) — six local
// copies of this had drifted into "Lead mentor" vs "Lead Mentor" and all six
// still said "Teen".
import { ROLE_LABEL } from "@/components/record/role-label";

export function PersonMentorship({ subject }: { subject: FixtureSubject }) {
  const caseloads = useOnboardingStore((s) => s.caseloads);
  const person = subject.person;

  // Who holds this mentor up: their lead, and the supervisor above that lead.
  const lead = person?.leadId
    ? DEMO_PEOPLE.find((p) => p.id === person.leadId)
    : undefined;
  const supervisor = lead?.supervisorId
    ? DEMO_PEOPLE.find((p) => p.id === lead.supervisorId)
    : undefined;
  const team: NetworkPerson[] = [supervisor, lead]
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, name: p.name, roleLabel: ROLE_LABEL[roleOf(p)] }));

  return (
    <div className="space-y-7">
      <CareNetwork team={team} />
      <MenteeTable
        mentorId={subject.id}
        mentorName={subject.name}
        capacity={caseloads[subject.id]?.total ?? subject.person?.capacity}
      />
    </div>
  );
}
