"use client";

// MentorshipPractice — the subject-conditional PRACTICE surface of the record.
// Exists only when the record's SUBJECT is a mentor.
//
// ONE CARD now. Caseload used to be its own panel paired with Team; Team moved
// to Organization (it's org context, not practice), and capacity folded into
// the Mentees card header — "4 of 5 mentees" reads as a property OF the list it
// governs, with the Automatic/Custom control and Availability on the row
// beneath it, directly above the table they constrain.
//
// Only MENTORS reach this tab. Lead mentors and supervisors supervise staff,
// not teens, so they get Supervision; a teen sees the same relationship from
// the other side (teen-mentors.tsx).
//
// Vocabulary law: "mentees" for the people, "caseload" for how many they can
// take; escalations name the observable cause, never a prediction.

import {
  CaseloadControls,
  useCaseload,
} from "@/components/record/caseload-controls";
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
  const caseloads = useOnboardingStore((s) => s.caseloads);
  const draft = useOnboardingStore((s) => s.draft);
  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "this mentor";

  const lifecycle =
    mentorStatuses["live"] ?? liveLifecycle(status, accountStatus, profileHidden);
  const cap = caseloads["live"]?.total ?? slots.total;
  const accepting = mentorAccepting["live"] ?? true;
  const availability = availabilityFor(lifecycle, menteeCount, cap, accepting);
  const atCap = menteeCount >= cap;
  const caseload = useCaseload("live", slots.total);

  return (
    <MenteeTable
      mentorId="live"
      mentorName={mentorName}
      capacityLabel={`${menteeCount} of ${caseload.total} mentees${
        mode === "read"
          ? ` · ${caseload.mode === "automatic" ? "Automatic" : "Custom"}`
          : ""
      }`}
      caseloadSlot={
        <>
          {mode === "edit" && (
            <CaseloadControls
              mentorId="live"
              currentCount={menteeCount}
              defaultTotal={slots.total}
            />
          )}
          <span className="flex items-center gap-2">
            <span
              className="text-[var(--text-muted)]"
              style={{
                font: "var(--type-field-label)",
                letterSpacing: "var(--type-field-label-tracking)",
              }}
            >
              Availability
            </span>
            {mode === "edit" ? (
              <AvailabilityMenu
                value={availability}
                accepting={accepting}
                atCap={atCap}
                name={mentorName}
                onChange={(a) => setMentorAccepting("live", a)}
              />
            ) : (
              <AvailabilityCell value={availability} />
            )}
          </span>
        </>
      }
    />
  );
}
