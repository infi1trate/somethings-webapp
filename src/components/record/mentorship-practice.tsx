"use client";

// MentorshipPractice — the subject-conditional PRACTICE surface of the record
// for the STORE-BACKED mentor ("live"). Exists only when the subject is a
// mentor.
//
// ONE CARD, ONE HEADER LINE. Caseload used to be its own panel paired with Team;
// Team moved to Organization (org context, not practice) and capacity folded
// into the Mentees header. It has now folded further: the readout IS the
// affordance, and the Automatic/Custom control plus stepper live inside its
// popover instead of occupying a permanent second row.
//
// Only MENTORS reach this tab. Lead mentors and supervisors supervise staff,
// not teens, so they get Supervision; a teen sees the same relationship from
// the other side (teen-mentors.tsx). A fixture mentor's record renders the same
// MenteeTable from /admin/person/[id] — same props, same controls.
//
// Vocabulary law: "mentees" for the people, "caseload" for how many they can
// take; escalations name the observable cause, never a prediction.

import { CaseloadPopover, useCaseload } from "@/components/record/caseload-controls";
import { MenteeTable } from "@/components/record/mentee-table";
import {
  AvailabilityCell,
  AvailabilityMenu,
} from "@/components/admin/mentor-status-badge";
import { availabilityFor, liveLifecycle } from "@/lib/record/mentor-status";
import { useOnboardingStore } from "@/lib/onboarding/store";

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
  const slots = useOnboardingStore((s) => s.slots);
  const draft = useOnboardingStore((s) => s.draft);
  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "this mentor";
  const firstName = draft.firstName?.trim() || "this mentor";

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
  const atCap = menteeCount >= caseload.total;

  return (
    <MenteeTable
      mentorId="live"
      mentorName={mentorName}
      capacitySlot={
        <CaseloadPopover
          mentorId="live"
          mentorName={firstName}
          currentCount={menteeCount}
          defaultTotal={slots.total}
          editable={mode === "edit"}
        />
      }
      availabilitySlot={
        mode === "edit" ? (
          <AvailabilityMenu
            value={availability}
            accepting={accepting}
            atCap={atCap}
            name={mentorName}
            onChange={(a) => setMentorAccepting("live", a)}
          />
        ) : (
          <AvailabilityCell value={availability} />
        )
      }
    />
  );
}
