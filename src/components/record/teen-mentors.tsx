"use client";

// TEEN MENTORS — the Mentorship tab on a TEEN's record.
//
// Same relationship as a mentor's mentee table, seen from the other side: who
// has mentored this teen. Current match first, then past ones with their date
// ranges, so the tab answers "who has this teen worked with" rather than just
// "who are they with now".
//
// TODO-DATA: past matches are invented fixtures (people-demo `pastMentors`) —
// the real relationship table will carry true start/end timestamps.

import { PersonRow } from "@/components/record/person-row";
import { MentorStatusBadge } from "@/components/admin/mentor-status-badge";
import { mentorsForTeen, DEMO_TEENS } from "@/lib/record/people-demo";
import { recordHrefFor } from "@/lib/record/subject";
import { recordOrigin } from "@/lib/record/origins";
import { useOnboardingStore } from "@/lib/onboarding/store";

const H =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)]";

export function TeenMentors({ teenId }: { teenId: string }) {
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const draft = useOnboardingStore((s) => s.draft);
  const matches = mentorsForTeen(teenId);
  const teen = DEMO_TEENS.find((t) => t.id === teenId);

  const current = matches.filter((m) => m.current);
  const past = matches.filter((m) => !m.current);

  // A teen matched to the store-backed mentor has no fixture row for them.
  const liveName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "Jordan Rivera";
  const isLiveMatch = teen?.mentorId === "live";

  return (
    <div className="space-y-7">
      <section aria-label="Current mentor" data-record-section="current-mentor">
        <h2 className={H}>Current mentor</h2>
        <div className={`mt-3 ${CARD}`}>
          {isLiveMatch ? (
            <PersonRow
              name={liveName}
              secondary="Mentor"
              href={recordHrefFor("live", recordOrigin(teenId))}
            />
          ) : current.length > 0 ? (
            current.map(({ mentor }) => (
              <PersonRow
                key={mentor.id}
                name={mentor.name}
                secondary={mentor.group}
                trailing={
                  <MentorStatusBadge
                    status={mentorStatuses[mentor.id] ?? mentor.status}
                  />
                }
                href={recordHrefFor(mentor.id, recordOrigin(teenId))}
              />
            ))
          ) : (
            <p className="py-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Not matched with a mentor right now.
            </p>
          )}
        </div>
      </section>

      {past.length > 0 && (
        <section aria-label="Previous mentors" data-record-section="past-mentors">
          <h2 className={H}>Previous mentors</h2>
          <div className={`mt-3 ${CARD}`}>
            {past.map(({ mentor, range }) => (
              <PersonRow
                key={mentor.id}
                name={mentor.name}
                secondary={range}
                href={recordHrefFor(mentor.id, recordOrigin(teenId))}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
