"use client";

// MentorshipPractice — the Mentorship tab for the STORE-BACKED mentor ("live").
//
// THE FULL CARE NETWORK AROUND THIS MENTOR — who holds him up, who he holds up.
//
// Team band over the mentee table. Caseload, availability and mode are NOT on
// this page (product decision): configuring capacity is a different errand from
// reading a caseload, and their controls were crowding the people. Capacity still
// shows as a fact — "N active · M slots open" under the table, and in the record
// header's meta line.
//
// Only MENTORS reach this tab. Lead mentors and supervisors supervise staff, so
// they get Supervision; a teen sees the same relationship from the other side
// (teen-mentors.tsx). A fixture mentor's record renders the SAME two components
// from person-mentorship.tsx — one Mentorship tab, two data adapters.

import { CareNetwork, type NetworkPerson } from "@/components/record/care-network";
import { MenteeTable } from "@/components/record/mentee-table";
import { DEMO_PEOPLE, LEAD_PERSONA_ID, roleOf } from "@/lib/record/people-demo";
import { useOnboardingStore } from "@/lib/onboarding/store";
// Role wording comes from the ONE shared map (Bloom Role Label) — six local
// copies of this had drifted into "Lead mentor" vs "Lead Mentor" and all six
// still said "Teen".
import { ROLE_LABEL } from "@/components/record/role-label";

export function MentorshipPractice() {
  const draft = useOnboardingStore((s) => s.draft);
  const caseloads = useOnboardingStore((s) => s.caseloads);
  const slots = useOnboardingStore((s) => s.slots);

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "this mentor";

  // The live mentor reports to Brandy, who reports to Stephen — the same edges
  // people-demo encodes, so Team says the same thing here as in the directory.
  const lead = DEMO_PEOPLE.find((p) => p.id === LEAD_PERSONA_ID);
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
        mentorId="live"
        mentorName={mentorName}
        capacity={caseloads["live"]?.total ?? slots.total}
      />
    </div>
  );
}
