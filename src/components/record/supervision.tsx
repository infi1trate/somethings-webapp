"use client";

// Supervision — the PRACTICE surface for a lead mentor or supervisor.
//
// The hierarchy this renders: mentors supervise mentees; LEAD MENTORS supervise
// mentors; SUPERVISORS supervise lead mentors primarily, and those leads'
// mentors as a branch of that. Leads and supervisors may step into a mentor's
// teen to guide an escalation, but teens are never directly theirs — which is
// why this tab replaces Mentorship for them rather than sitting beside it.
//
// A supervisor's list is therefore two-tier: the leads who report to them, then
// the mentors under those leads. A lead's list is one tier.

import { Users } from "lucide-react";
import { PersonRow } from "@/components/record/person-row";
import { MentorStatusBadge } from "@/components/admin/mentor-status-badge";
import {
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

export function Supervision({ subjectId }: { subjectId: string }) {
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const people = superviseesOf(subjectId);
  const leads = people.filter((p) => p.role === "lead-mentor");
  const mentors = people.filter((p) => p.role !== "lead-mentor");

  if (people.length === 0) {
    return (
      <section aria-label="Supervision" data-record-section="supervision">
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-[var(--surface-s1)] text-[var(--text-muted)]"
          >
            <Users className="size-5" />
          </span>
          <p className="text-[15px] font-semibold leading-[20px] text-[var(--text-primary)]">
            No one reports here yet
          </p>
          <p className="max-w-xs text-[13px] leading-[18px] text-[var(--text-secondary)]">
            Mentors and leads appear here once they&rsquo;re assigned to this person.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-7">
      {leads.length > 0 && (
        <Group
          label="Lead mentors"
          people={leads}
          mentorStatuses={mentorStatuses}
        />
      )}
      {mentors.length > 0 && (
        <Group
          label={leads.length > 0 ? "Their mentors" : "Mentors"}
          people={mentors}
          mentorStatuses={mentorStatuses}
        />
      )}
    </div>
  );
}

function Group({
  label,
  people,
  mentorStatuses,
}: {
  label: string;
  people: DemoMentorRow[];
  mentorStatuses: Record<string, string>;
}) {
  return (
    <section
      aria-label={label}
      data-record-section={`supervision-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
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
        {people.map((p) => {
          // A lead's own load is their mentors, not teens; a mentor's is teens.
          const load =
            p.role === "lead-mentor"
              ? `${superviseesOf(p.id).length} mentors`
              : `${teensForMentor(p.id).length} of ${p.capacity} mentees`;
          const status =
            (mentorStatuses[p.id] as DemoMentorRow["status"]) ?? p.status;
          return (
            <PersonRow
              key={p.id}
              name={p.name}
              secondary={`${p.group} · ${load}`}
              trailing={<MentorStatusBadge status={status} />}
              href={recordHrefFor(p.id)}
            />
          );
        })}
      </div>
    </section>
  );
}
