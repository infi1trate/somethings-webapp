"use client";

// MentorshipPractice — the subject-conditional PRACTICE surface of the record
// (the tab split moved practice OUT of the universal Organization tab). Exists
// only when the record's SUBJECT is a mentor or lead mentor. Everything here
// describes how this person mentors teens, not that they work here:
//   • Mentees   — the people (shared PersonRow; escalation + video chips).
//   • Caseload  — capacity ("4 of 5 mentees") + the Automatic/Custom control.
//   • Availability — accepting / not accepting (practice state; MOVED here from
//     the org group — it answers "can they take another teen", not "do they
//     work here").
//   • Team      — this mentor's supervisor + lead mentor.
//   • Mentors they lead (lead-mentor subject only) — the umbrella they own.
//
// Vocabulary law: "mentees" for the people, "caseload" only for the capacity
// concept; escalations name the observable cause, never a prediction.

import { RecordRow } from "@/components/record/row";
import { PersonRow } from "@/components/record/person-row";
import {
  CaseloadControls,
  useCaseload,
} from "@/components/record/caseload-controls";
import {
  AvailabilityCell,
  AvailabilityMenu,
} from "@/components/admin/mentor-status-badge";
import { availabilityFor, liveLifecycle } from "@/lib/record/mentor-status";
import {
  escalationVisible,
  getDemoOverview,
  recencyPhrase,
} from "@/lib/record/mentees-demo";
import { leadUmbrellaMentors } from "@/lib/record/people-demo";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { SubjectRole } from "@/lib/record/tabs";

const H =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
// Matches the record's elevated card idiom (gaps.md #108) — coherent with the
// rest of the record's cards. (The new spec's "zero shadows" quality bar
// conflicts with the record's established elevation; flagged in the report.)
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)]";
const CARD_DIVIDED = `${CARD} [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]`;

// The merged Caseload row — capacity as one row (the old "Total slots" + "Daily
// new teens" collapsed here in the caseload prompt). Same CaseloadControls the
// lead's mentee modal uses, writing the same store key ("live").
function CaseloadRow({
  menteeCount,
  mode,
}: {
  menteeCount: number;
  mode: "edit" | "read";
}) {
  const slots = useOnboardingStore((s) => s.slots);
  const caseload = useCaseload("live", slots.total);

  return (
    <div className="grid min-h-13 w-full grid-cols-[168px_minmax(0,1fr)_auto] gap-x-6 py-3.5">
      <span
        className="self-start pt-[3px] text-[var(--text-muted)]"
        style={{
          font: "var(--type-field-label)",
          letterSpacing: "var(--type-field-label-tracking)",
        }}
      >
        Caseload
      </span>
      <span className="min-w-0 self-start">
        <span
          className="block text-[var(--text-primary)]"
          style={{
            font: "var(--type-row-value)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {menteeCount} of {caseload.total} mentees
          {mode === "read" && (
            <span className="text-[var(--text-secondary)]">
              {" "}
              · {caseload.mode === "automatic" ? "Automatic" : "Custom"}
            </span>
          )}
        </span>
        <span
          className="mt-0.5 block text-[var(--text-muted)]"
          style={{ font: "var(--type-helper)" }}
        >
          How many teens can be matched at once
        </span>
        {mode === "edit" && (
          <CaseloadControls
            mentorId="live"
            currentCount={menteeCount}
            defaultTotal={slots.total}
            className="mt-2.5"
          />
        )}
      </span>
    </div>
  );
}

export function MentorshipPractice({
  mode,
  menteeCount,
  subjectRole,
  now,
  published,
  redactMentees = false,
}: {
  mode: "edit" | "read";
  /** Active mentees right now — the caseload floor + availability derivation. */
  menteeCount: number;
  subjectRole: SubjectRole;
  now: number;
  /** Mentees + Team appear once the mentor is published and matched. */
  published: boolean;
  /** No-names degraded variant for the read-mostly supervisor tier (dormant —
   *  no persona resolves to that tier yet). */
  redactMentees?: boolean;
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

  const overview = getDemoOverview(now);
  const leads = subjectRole === "lead-mentor" ? leadUmbrellaMentors() : [];

  return (
    <div className="space-y-7">
      {/* Mentees — the people. aria-label doubles as the escalation strip's
          "View mentee" scroll target. */}
      <section aria-label="Mentees" data-record-section="mentees">
        <h2 className={H}>Mentees</h2>
        <div className="mt-3">
          {published ? (
            <div className={CARD}>
              {overview.mentees.map((m) => (
                <PersonRow
                  key={m.id}
                  name={m.name}
                  secondary={recencyPhrase(m.lastInteractionAt, now)}
                  escalation={
                    escalationVisible(m.escalation, now)
                      ? m.escalation!.reason
                      : null
                  }
                  videoCount={m.videoCount30d}
                  redactName={redactMentees}
                />
              ))}
            </div>
          ) : (
            <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
              Nothing here yet — mentees appear once this mentor is published and
              matched.
            </p>
          )}
        </div>
      </section>

      {/* Caseload + Availability — the practice controls. A quiet, headerless
          group (Apple grouped-list footnote-less section). */}
      <section aria-label="Caseload and availability">
        <div className={`mt-0 ${CARD_DIVIDED}`}>
          <CaseloadRow menteeCount={menteeCount} mode={mode} />
          <RecordRow
            label="Availability"
            value={
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
            state="read"
            locked
            onEditStart={() => {}}
            onCancel={() => {}}
          />
        </div>
      </section>

      {/* Team — this mentor's supervisor + lead mentor. Their records don't
          exist in this prototype, so the rows are non-pressable (no dead
          chevrons). */}
      {published && (
        <section aria-label="Team" data-record-section="team">
          <h2 className={H}>Team</h2>
          <div className={`mt-3 ${CARD}`}>
            {overview.team.map((t) => (
              <PersonRow key={t.id} name={t.name} secondary={t.roleLabel} />
            ))}
          </div>
        </section>
      )}

      {/* Lead-mentor subject only — the mentors under their umbrella. Reachable
          via leadUmbrellaMentors() (a single global constant, not a per-lead
          map — flagged in the report). */}
      {subjectRole === "lead-mentor" && (
        <section
          aria-label="Mentors they lead"
          data-record-section="mentors-led"
        >
          <h2 className={H}>Mentors they lead</h2>
          <div className={`mt-3 ${CARD}`}>
            {leads.map((m) => (
              <PersonRow key={m.id} name={m.name} secondary={m.group} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
