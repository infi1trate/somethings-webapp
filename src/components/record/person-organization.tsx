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

import { useRef, useState } from "react";
import { RecordRow } from "@/components/record/row";
import { PersonRow } from "@/components/record/person-row";
import {
  MentorStatusBadge,
  MentorStatusMenu,
} from "@/components/admin/mentor-status-badge";
import { DeactivateAction } from "@/components/record/deactivate-action";
import { ConfirmDialog } from "@/components/record/confirm-dialog";
import {
  DEMO_PEOPLE,
  defaultMenteeStatus,
  roleOf,
} from "@/lib/record/people-demo";
import {
  recordHrefFor,
  subjectDisplayName,
  type FixtureSubject,
} from "@/lib/record/subject";
import { resolveMode, staffActorFor } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { MentorLifecycleStatus } from "@/lib/types";
// Role wording comes from the ONE shared map (Bloom Role Label) — six local
// copies of this had drifted into "Lead mentor" vs "Lead Mentor" and all six
// still said "Teen".
import { ROLE_LABEL } from "@/components/record/role-label";

/** A teen holds three of the five lifecycle states — "in training" and "guided"
 *  describe a mentor's onboarding. Same menu chrome, shorter list. */
const TEEN_STATES: MentorLifecycleStatus[] = ["active", "paused", "deactivated"];

export function PersonOrganization({ subject }: { subject: FixtureSubject }) {
  const persona = useOnboardingStore((s) => s.persona);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const menteeStatus = useOnboardingStore((s) => s.menteeStatus);
  const setMenteeStatus = useOnboardingStore((s) => s.setMenteeStatus);
  const accountLocks = useOnboardingStore((s) => s.accountLocks);
  const setAccountLock = useOnboardingStore((s) => s.setAccountLock);
  const draft = useOnboardingStore((s) => s.draft);
  const setMentorStatus = useOnboardingStore((s) => s.setMentorStatus);
  const [, force] = useState(0);
  // Picking "Deactivated" from the menu routes through the SAME confirm the
  // band's button uses — otherwise the menu is a silent way around the
  // deliberate path for the one transition that ends pairings.
  const [pendingDeactivate, setPendingDeactivate] = useState(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  // Admin, supervisor and lead mentor all resolve to "edit" here — all three are
  // accountable for a person's standing.
  const canEdit = resolveMode("accountOrg", persona) === "edit";
  const actorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    staffActorFor(persona);
  const isTeen = subject.role === "teen";

  // Who they report to — a mentor's lead, a lead's supervisor.
  const reportsToId = subject.person?.leadId ?? subject.person?.supervisorId;
  const reportsTo = reportsToId
    ? DEMO_PEOPLE.find((p) => p.id === reportsToId)
    : undefined;

  const status = subject.person
    ? (mentorStatuses[subject.id] ?? subject.person.status)
    : null;
  // ONE value for the row, whichever kind of person this is: a staff lifecycle
  // or a teen's mentee state, which is a subset of the same enum.
  const standing: MentorLifecycleStatus = isTeen
    ? ((menteeStatus[subject.id] ??
        (subject.teen ? defaultMenteeStatus(subject.teen) : "active")) as MentorLifecycleStatus)
    : status ?? "active";
  const deactivated = standing === "deactivated";

  /** Write a standing choice to whichever axis this person's state lives on. */
  const applyStanding = (next: MentorLifecycleStatus) => {
    if (isTeen) setMenteeStatus(subject.id, next as "active" | "paused" | "deactivated");
    else setMentorStatus(subject.id, next);
    force((n) => n + 1);
  };

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
        {/* Status — the LAST row of the Organization card, exactly as the live
            mentor's card does it (Figma 2218:8660). The badge with a caret IS
            the control; a separate "Standing" section with a native select was
            foreign chrome and is gone. Read viewers get the badge alone. */}
        <RecordRow
          label="Status"
          value={
            canEdit ? (
              <MentorStatusMenu
                status={standing}
                name={subjectDisplayName(subject)}
                options={isTeen ? TEEN_STATES : undefined}
                onChange={(next) => {
                  // The one transition that ends pairings gets the same confirm
                  // the band's button uses.
                  if (next === "deactivated") setPendingDeactivate(true);
                  else applyStanding(next);
                }}
              />
            ) : (
              <MentorStatusBadge status={standing} />
            )
          }
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        </div>

        {/* Deactivation belongs WITH status — it IS a status change — and the
            LOCK sits beside it, because a reader deciding one is deciding
            between both. */}
        {canEdit && (
          <DeactivateAction
            name={subjectDisplayName(subject)}
            deactivated={deactivated}
            noun={isTeen ? "mentee" : "account"}
            onConfirm={(reactivate) =>
              applyStanding(reactivate ? "active" : "deactivated")
            }
            lock={accountLocks[subject.id] ?? null}
            onLockChange={(lock) => {
              setAccountLock(subject.id, lock);
              force((n) => n + 1);
            }}
            blocked={{ email: subject.email, phone: subject.phone }}
            actor={actorName}
            actorRole={staffActorFor(persona)}
          />
        )}
      </section>

      <ConfirmDialog
        open={pendingDeactivate}
        onOpenChange={setPendingDeactivate}
        returnFocusTo={returnFocusTo}
        title={`Deactivate ${subjectDisplayName(subject)}?`}
        description={
          isTeen
            ? "They stop being an active user, and their pairing moves to Past mentees. Nothing is deleted, and you can set them active again."
            : "They'll be removed from matching right away. Active mentorships are paused, not ended. You can reactivate them later — nothing is deleted."
        }
        confirmLabel="Deactivate"
        tone="destructive"
        onConfirm={() => applyStanding("deactivated")}
      />

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
