"use client";

// MentorshipPractice — the Mentorship tab for the STORE-BACKED mentor ("live").
//
// THE FULL CARE NETWORK AROUND THIS MENTOR — who holds him up, who he holds up.
//
// Composition: the care-network band (Team beside Practice) over the mentee list.
// Team came back from the Organization tab and Practice replaced the strip of
// controls that used to live in the Mentees card header — the network reads as one
// thing now instead of an orphaned card above a data table.
//
// Only MENTORS reach this tab. Lead mentors and supervisors supervise staff, so
// they get Supervision; a teen sees the same relationship from the other side
// (teen-mentors.tsx). A fixture mentor's record renders the SAME two components
// from person-mentorship.tsx — one Mentorship tab, two data adapters.
//
// Vocabulary law: "mentees" for the people, "caseload" for the capacity concept.

import { CareNetwork, type NetworkPerson } from "@/components/record/care-network";
import { MenteeList } from "@/components/record/mentee-list";
import { useCaseload } from "@/components/record/caseload-controls";
import { availabilityFor, liveLifecycle } from "@/lib/record/mentor-status";
import { DEMO_PEOPLE, LEAD_PERSONA_ID, roleOf } from "@/lib/record/people-demo";
import { useOnboardingStore } from "@/lib/onboarding/store";

const ROLE_LABEL: Record<string, string> = {
  mentor: "Mentor",
  "lead-mentor": "Lead mentor",
  supervisor: "Supervisor",
  admin: "Admin",
  teen: "Teen",
};

export function MentorshipPractice({
  mode,
  menteeCount,
}: {
  mode: "edit" | "read";
  /** Active mentees right now — the caseload floor + availability derivation. */
  menteeCount: number;
}) {
  const status = useOnboardingStore((s) => s.status);
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const profileHidden = useOnboardingStore((s) => s.profileHidden);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const mentorAccepting = useOnboardingStore((s) => s.mentorAccepting);
  const setMentorAccepting = useOnboardingStore((s) => s.setMentorAccepting);
  const setCaseload = useOnboardingStore((s) => s.setCaseload);
  const slots = useOnboardingStore((s) => s.slots);
  const draft = useOnboardingStore((s) => s.draft);

  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "this mentor";

  const lifecycle =
    mentorStatuses["live"] ?? liveLifecycle(status, accountStatus, profileHidden);
  const caseload = useCaseload("live", slots.total);
  const accepting = mentorAccepting["live"] ?? true;
  const availability = availabilityFor(
    lifecycle,
    menteeCount,
    caseload.total,
    accepting
  );

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
      <CareNetwork
        team={team}
        menteeCount={menteeCount}
        caseload={caseload}
        onCaseloadMode={(m) => setCaseload("live", { ...caseload, mode: m })}
        availability={availability}
        accepting={accepting}
        atCap={menteeCount >= caseload.total}
        mentorName={mentorName}
        onAcceptingChange={(a) => setMentorAccepting("live", a)}
        editable={mode === "edit"}
      />
      <MenteeList
        mentorId="live"
        mentorName={mentorName}
        capacityTotal={caseload.total}
      />
    </div>
  );
}
