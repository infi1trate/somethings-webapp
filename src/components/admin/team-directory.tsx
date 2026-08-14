"use client";

// TEAM — the staff directory. One surface, scoped to who the viewer works with,
// grouped by role.
//
// This ABSORBED the old "Mentors" roster: a lead's mentors and a lead's peers
// were two nav destinations describing the same thing (the people around them),
// so they are one tab now.
//
//   Mentor      → Lead mentors + Supervisors        (the people above them)
//   Lead mentor → their Mentors + Leads + Supervisors
//   Supervisor  → all Mentors + Leads + Supervisors
//
// Teens are deliberately absent: this is the STAFF directory. Mentors reach
// their mentees through Teens; leads and supervisors reach a teen through the
// mentor who holds the match.

import { PersonRow } from "@/components/record/person-row";
import { MentorStatusBadge } from "@/components/admin/mentor-status-badge";
import { ReviewQueues } from "@/components/admin/review-queues";
import {
  DEMO_MENTORS,
  DEMO_STAFF,
  leadUmbrellaMentors,
  superviseesOf,
  teensForMentor,
  type DemoMentorRow,
} from "@/lib/record/people-demo";
import { recordHrefFor } from "@/lib/record/subject";
import { useOnboardingStore } from "@/lib/onboarding/store";

const H =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)]";

export type TeamScope = "mentor" | "lead" | "supervisor";

export function TeamDirectory({ scope }: { scope: TeamScope }) {
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);

  const supervisors = DEMO_STAFF.filter((s) => s.role === "supervisor");
  const leads = DEMO_STAFF.filter((s) => s.role === "lead-mentor");
  // A mentor sees only the people above them; a lead sees the mentors they
  // actually lead; a supervisor sees every mentor.
  const mentors: DemoMentorRow[] =
    scope === "mentor"
      ? []
      : scope === "lead"
        ? leadUmbrellaMentors()
        : DEMO_MENTORS;

  return (
    <div className="px-6 py-6 lg:px-10">
      <header className="max-w-prose">
        <h1
          className="text-[var(--text-primary)]"
          style={{
            font: "var(--type-title-lg)",
          }}
        >
          Team
        </h1>
        <p className="mt-1 text-[14px] leading-[20px] text-[var(--text-secondary)]">
          {scope === "mentor"
            ? "The leads and supervisors supporting your mentoring."
            : scope === "lead"
              ? "The mentors you lead, and the leads and supervisors alongside you."
              : "Everyone on the mentoring side of the platform."}
        </p>
      </header>

      <div className="mt-7 max-w-[900px] space-y-7">
        {/* Review inbox — follows the mentors. It used to live on the Mentors
            roster this tab absorbed, and the review console still returns to
            it, so it moves here rather than disappearing. */}
        {scope !== "mentor" && <ReviewQueues />}
        {mentors.length > 0 && (
          <Group
            label={scope === "lead" ? "Mentors you lead" : "Mentors"}
            people={mentors}
            mentorStatuses={mentorStatuses}
            loadOf={(p) =>
              `${teensForMentor(p.id).length} of ${p.capacity} mentees`
            }
          />
        )}
        <Group
          label="Lead mentors"
          people={leads}
          mentorStatuses={mentorStatuses}
          loadOf={(p) => `${superviseesOf(p.id).length} mentors`}
        />
        <Group
          label="Supervisors"
          people={supervisors}
          mentorStatuses={mentorStatuses}
          loadOf={(p) => `${superviseesOf(p.id).length} supervised`}
        />
      </div>
    </div>
  );
}

function Group({
  label,
  people,
  mentorStatuses,
  loadOf,
}: {
  label: string;
  people: DemoMentorRow[];
  mentorStatuses: Record<string, string>;
  loadOf: (p: DemoMentorRow) => string;
}) {
  if (people.length === 0) return null;
  return (
    <section aria-label={label}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className={H}>{label}</h2>
        <p
          className="text-[var(--text-secondary)] tabular-nums"
          style={{ font: "var(--type-row-label)" }}
        >
          {people.length}
        </p>
      </div>
      <div className={`mt-3 ${CARD}`}>
        {people.map((p) => (
          <PersonRow
            key={p.id}
            name={p.name}
            secondary={`${p.group} · ${loadOf(p)}`}
            trailing={
              <MentorStatusBadge
                status={
                  (mentorStatuses[p.id] as DemoMentorRow["status"]) ?? p.status
                }
              />
            }
            href={recordHrefFor(p.id)}
          />
        ))}
      </div>
    </section>
  );
}
