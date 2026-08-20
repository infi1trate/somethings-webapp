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

const ROLE_LABEL: Record<string, string> = {
  mentor: "Mentor",
  "lead-mentor": "Lead mentor",
  supervisor: "Supervisor",
  admin: "Admin",
  teen: "Teen",
};

export function PersonMentorship({ subject }: { subject: FixtureSubject }) {
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
      />
    </div>
  );
}
