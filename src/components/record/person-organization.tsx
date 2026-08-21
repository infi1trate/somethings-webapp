"use client";

// PERSON ORGANIZATION — the org facts for a FIXTURE person, rendered inside the
// ACCOUNT tab (Figma 2162:5663). The Organization tab no longer exists: Team
// went to Mentorship and these rows are account facts, so the tab held nothing.
//
// (was: the universal Organization tab for a FIXTURE person)
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
import {
  DEMO_PEOPLE,
  defaultMenteeStatus,
  roleOf,
} from "@/lib/record/people-demo";
import { recordHrefFor, type FixtureSubject } from "@/lib/record/subject";
import { resolveMode } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
// Role wording comes from the ONE shared map (Bloom Role Label) — six local
// copies of this had drifted into "Lead mentor" vs "Lead Mentor" and all six
// still said "Teen".
import { ROLE_LABEL } from "@/components/record/role-label";

export function PersonOrganization({ subject }: { subject: FixtureSubject }) {
  const persona = useOnboardingStore((s) => s.persona);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const setMentorStatus = useOnboardingStore((s) => s.setMentorStatus);
  const menteeStatus = useOnboardingStore((s) => s.menteeStatus);
  const setMenteeStatus = useOnboardingStore((s) => s.setMenteeStatus);
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
    ? (menteeStatus[subject.id] ??
        (subject.teen ? defaultMenteeStatus(subject.teen) : "active")) !==
      "deactivated"
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
                setMenteeStatus(subject.id, next ? "active" : "deactivated");
              }
              force((n) => n + 1);
            }}
          />
        )}
      </section>

      {/* REPORTS TO stays here. It is team-shaped, and Team moved to the
          Mentorship tab — but a lead/supervisor subject has Supervision instead
          of Mentorship, and a teen has neither, so routing it there would drop
          the edge for exactly the people it describes. It rides along with the
          org rows into Account. */}
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
