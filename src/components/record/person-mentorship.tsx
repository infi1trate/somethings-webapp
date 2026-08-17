"use client";

// PERSON MENTORSHIP — the Mentorship tab for a FIXTURE mentor, the counterpart
// to MentorshipPractice (which serves the one store-backed mentor).
//
// WHY: /admin/person/[id] rendered a bare MenteeTable with no caseload at all,
// so a lead or supervisor could read one of their mentors' mentee lists but not
// see — let alone change — how many that mentor can hold. Capacity was visible
// on exactly one record out of seven.
//
// Same components as the live record (CaseloadPopover, AvailabilityMenu,
// MenteeTable) with the same props, so the two Mentorship tabs cannot drift.
// The gate is the same one too: `accountOrg`, which is "edit" for a lead mentor
// AND a supervisor.

import { CaseloadPopover, useCaseload } from "@/components/record/caseload-controls";
import { MenteeTable } from "@/components/record/mentee-table";
import {
  AvailabilityCell,
  AvailabilityMenu,
} from "@/components/admin/mentor-status-badge";
import { availabilityFor } from "@/lib/record/mentor-status";
import { teensForMentor } from "@/lib/record/people-demo";
import { resolveMode } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { FixtureSubject } from "@/lib/record/subject";

export function PersonMentorship({ subject }: { subject: FixtureSubject }) {
  const persona = useOnboardingStore((s) => s.persona);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const mentorAccepting = useOnboardingStore((s) => s.mentorAccepting);
  const setMentorAccepting = useOnboardingStore((s) => s.setMentorAccepting);

  const person = subject.person;
  const editable = resolveMode("accountOrg", persona) === "edit";

  // Count from the SAME source the Team directory counts from, so "3 of 4
  // mentees" says the same thing on both screens.
  const menteeCount = teensForMentor(subject.id).length;
  const defaultTotal = person?.capacity ?? 0;
  const caseload = useCaseload(subject.id, defaultTotal);

  const status = person
    ? (mentorStatuses[subject.id] ?? person.status)
    : undefined;
  const accepting = mentorAccepting[subject.id] ?? person?.accepting ?? true;
  const availability = status
    ? availabilityFor(status, menteeCount, caseload.total, accepting)
    : null;

  const firstName = (subject.goesBy ?? subject.name).split(" ")[0];

  return (
    <MenteeTable
      mentorId={subject.id}
      mentorName={subject.name}
      capacitySlot={
        <CaseloadPopover
          mentorId={subject.id}
          mentorName={firstName}
          currentCount={menteeCount}
          defaultTotal={defaultTotal}
          editable={editable}
        />
      }
      availabilitySlot={
        editable ? (
          <AvailabilityMenu
            value={availability}
            accepting={accepting}
            atCap={menteeCount >= caseload.total}
            name={subject.name}
            onChange={(a) => setMentorAccepting(subject.id, a)}
          />
        ) : (
          <AvailabilityCell value={availability} />
        )
      }
    />
  );
}
