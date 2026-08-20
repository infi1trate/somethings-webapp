"use client";

// PersonMentorship — the Mentorship tab for a FIXTURE mentor. The counterpart to
// MentorshipPractice (which serves the one store-backed mentor).
//
// THE FULL CARE NETWORK AROUND THIS MENTOR — who holds him up, who he holds up.
//
// Same two components as the live record (CareNetwork + MenteeList) with the same
// props, so the two Mentorship tabs cannot drift. Only the data source differs:
// fixture row + per-person store overrides here, store axes there. The gate is
// the same too — `accountOrg`, which is "edit" for a lead mentor AND a supervisor.

import { CareNetwork, type NetworkPerson } from "@/components/record/care-network";
import { MenteeList } from "@/components/record/mentee-list";
import { useCaseload } from "@/components/record/caseload-controls";
import { availabilityFor } from "@/lib/record/mentor-status";
import { DEMO_PEOPLE, roleOf, teensForMentor } from "@/lib/record/people-demo";
import { resolveMode } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { FixtureSubject } from "@/lib/record/subject";

const ROLE_LABEL: Record<string, string> = {
  mentor: "Mentor",
  "lead-mentor": "Lead mentor",
  supervisor: "Supervisor",
  admin: "Admin",
  teen: "Teen",
};

export function PersonMentorship({ subject }: { subject: FixtureSubject }) {
  const persona = useOnboardingStore((s) => s.persona);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const mentorAccepting = useOnboardingStore((s) => s.mentorAccepting);
  const setMentorAccepting = useOnboardingStore((s) => s.setMentorAccepting);
  const setCaseload = useOnboardingStore((s) => s.setCaseload);

  const person = subject.person;
  const editable = resolveMode("accountOrg", persona) === "edit";

  // Count from the SAME source the Team directory counts from, so "3 of 4
  // mentees" says the same thing on both screens.
  const menteeCount = teensForMentor(subject.id).length;
  const caseload = useCaseload(subject.id, person?.capacity ?? 0);

  const status = person
    ? (mentorStatuses[subject.id] ?? person.status)
    : undefined;
  const accepting = mentorAccepting[subject.id] ?? person?.accepting ?? true;
  const availability = status
    ? availabilityFor(status, menteeCount, caseload.total, accepting)
    : null;

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
      <CareNetwork
        team={team}
        menteeCount={menteeCount}
        caseload={caseload}
        onCaseloadMode={(m) => setCaseload(subject.id, { ...caseload, mode: m })}
        availability={availability}
        accepting={accepting}
        atCap={menteeCount >= caseload.total}
        mentorName={subject.name}
        onAcceptingChange={(a) => setMentorAccepting(subject.id, a)}
        editable={editable}
      />
      <MenteeList
        mentorId={subject.id}
        mentorName={subject.name}
        capacityTotal={caseload.total}
      />
    </div>
  );
}
