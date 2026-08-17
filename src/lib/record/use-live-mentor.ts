"use client";

// THE STORE-BACKED MENTOR AS A DIRECTORY ROW.
//
// The one real mentor ("live") has no fixture row in people-demo — their name,
// status, capacity and groups all come from the store. Every directory that
// lists mentors therefore has to synthesise a row for them.
//
// This used to be built INLINE inside roster.tsx, which is exactly why the Team
// directory didn't show them at all: Team reads DEMO_MENTORS / DEMO_STAFF, and
// the live mentor is in neither. One shared hook now, so a surface can't list
// "all mentors" and silently omit the only real one.

import { useMemo } from "react";
import { liveLifecycle } from "@/lib/record/mentor-status";
import { LEAD_PERSONA_ID, type DemoMentorRow } from "@/lib/record/people-demo";
import { recordHrefFor, LIVE_ID } from "@/lib/record/subject";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

export type StaffRow = DemoMentorRow & {
  recordHref?: string;
  /** Draw attention to the row — the live mentor waiting on review. */
  highlight?: boolean;
};

/** The live mentor as a directory row, or null before mount / when no mentor
 *  has been created yet (the store has no first name). */
export function useLiveMentorRow(): StaffRow | null {
  const mounted = useMounted();
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const slots = useOnboardingStore((s) => s.slots);
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const profileHidden = useOnboardingStore((s) => s.profileHidden);
  // Groups are staff-editable on the record's Organization card; the roster
  // used to hardcode "California" here, which disagreed with the record for
  // the same person.
  const mentorGroups = useOnboardingStore((s) => s.mentorGroups);

  const firstName = draft.firstName;
  const lastName = draft.lastName;
  const displayName = draft.displayName;
  const phone = draft.phone;
  const email = draft.email;
  const groups = mentorGroups.join(", ");

  return useMemo(() => {
    if (!mounted || !firstName) return null;
    const name = [firstName, lastName].filter(Boolean).join(" ") || "Jordan Rivera";
    return {
      id: LIVE_ID,
      name,
      goesBy:
        displayName.trim() && displayName.trim() !== firstName.trim()
          ? displayName.trim()
          : undefined,
      phone: phone || "+1 (415) 555-0188",
      email: email || undefined,
      group: groups || "—",
      // Derived from the store's existing axes; no `accepting` flag exists on
      // the store yet, so the live mentor defaults to accepting.
      status: liveLifecycle(status, accountStatus, profileHidden),
      accepting: true,
      capacity: slots.total,
      role: "mentor",
      // Matches the Team card the record shows: the live mentor reports to
      // Brandy, so a lead viewing "mentors you lead" sees them.
      leadId: LEAD_PERSONA_ID,
      recordHref: recordHrefFor(LIVE_ID),
      highlight: status === "in_review",
    };
  }, [
    mounted,
    firstName,
    lastName,
    displayName,
    phone,
    email,
    groups,
    status,
    accountStatus,
    profileHidden,
    slots.total,
  ]);
}
