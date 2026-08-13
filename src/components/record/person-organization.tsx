"use client";

// PERSON ORGANIZATION — the universal Organization tab for a FIXTURE person
// (staff, fixture mentors, teens). The store-backed mentor has its own
// OrganizationCard wired to live store state; this is the same anatomy for
// people whose facts come from the fixtures.
//
// Org membership is true of everyone: role, groups, who they report to, and
// standing. Deactivation sits here too — surfaced as an explicit action rather
// than hidden behind the header's overflow.

import { useState } from "react";
import { RecordRow } from "@/components/record/row";
import { PersonRow } from "@/components/record/person-row";
import { MentorStatusBadge } from "@/components/admin/mentor-status-badge";
import { DeactivateAction } from "@/components/record/deactivate-action";
import { DEMO_PEOPLE, roleOf } from "@/lib/record/people-demo";
import { recordHrefFor, type FixtureSubject } from "@/lib/record/subject";
import { resolveMode } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";

const ROLE_LABEL: Record<string, string> = {
  mentor: "Mentor",
  "lead-mentor": "Lead mentor",
  supervisor: "Supervisor",
  admin: "Admin",
  teen: "Teen",
};

export function PersonOrganization({ subject }: { subject: FixtureSubject }) {
  const persona = useOnboardingStore((s) => s.persona);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const setMentorStatus = useOnboardingStore((s) => s.setMentorStatus);
  const menteeActive = useOnboardingStore((s) => s.menteeActive);
  const setMenteeActive = useOnboardingStore((s) => s.setMenteeActive);
  const [, force] = useState(0);

  const canEdit = resolveMode("accountOrg", persona) === "edit";
  const isTeen = subject.role === "teen";

  // Who they report to — a mentor's lead, a lead's supervisor.
  const reportsToId = subject.person?.leadId ?? subject.person?.supervisorId;
  const reportsTo = reportsToId
    ? DEMO_PEOPLE.find((p) => p.id === reportsToId)
    : undefined;

  const status = subject.person
    ? (mentorStatuses[subject.id] ?? subject.person.status)
    : null;
  const teenActive = isTeen
    ? (menteeActive[subject.id] ?? subject.teen?.active ?? true)
    : true;

  return (
    <div className="space-y-6">
      <section aria-label="Organization" data-record-section="organization">
        <div className="rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]">
          <RecordRow
            label="Role"
            value={ROLE_LABEL[roleOf(subject.person ?? subject.teen!)] ?? "—"}
            state="read"
            locked
            onEditStart={() => {}}
            onCancel={() => {}}
          />
          <RecordRow
            label={isTeen ? "Region" : "Groups"}
            value={subject.group}
            state="read"
            locked
            onEditStart={() => {}}
            onCancel={() => {}}
          />
          {subject.teen && (
            <RecordRow
              label="Joined"
              value={`${subject.teen.joinedDaysAgo} days ago`}
              state="read"
              locked
              onEditStart={() => {}}
              onCancel={() => {}}
            />
          )}
          <RecordRow
            label="Status"
            value={
              status ? (
                <MentorStatusBadge status={status} />
              ) : (
                <span
                  className="inline-flex min-h-6 items-center rounded-full px-2.5 text-[12px] font-medium leading-4"
                  style={
                    teenActive
                      ? {
                          backgroundColor: "var(--text-primary)",
                          color: "var(--text-inverse)",
                        }
                      : {
                          backgroundColor: "var(--status-neutral-bg)",
                          color: "var(--status-neutral-fg)",
                        }
                  }
                >
                  {teenActive ? "Active" : "Inactive"}
                </span>
              )
            }
            state="read"
            locked
            onEditStart={() => {}}
            onCancel={() => {}}
          />
        </div>

        {/* Deactivation lives WITH status — the same concept, one place. */}
        {canEdit && (
          <DeactivateAction
            name={subject.goesBy ?? subject.name}
            deactivated={status ? status === "deactivated" : !teenActive}
            noun={isTeen ? "teen" : "account"}
            onConfirm={(next) => {
              if (status) {
                setMentorStatus(subject.id, next ? "active" : "deactivated");
              } else {
                setMenteeActive(subject.id, next);
              }
              force((n) => n + 1);
            }}
          />
        )}
      </section>

      {reportsTo && (
        <section aria-label="Reports to" data-record-section="reports-to">
          <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
            Reports to
          </h2>
          <div className="mt-3 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)]">
            <PersonRow
              name={reportsTo.name}
              secondary={ROLE_LABEL[roleOf(reportsTo)]}
              href={recordHrefFor(reportsTo.id)}
            />
          </div>
        </section>
      )}
    </div>
  );
}
