"use client";

// MentorshipPractice — the subject-conditional PRACTICE surface of the record
// (the tab split moved practice OUT of the universal Organization tab). Exists
// only when the record's SUBJECT is a mentor.
//
// Composition: Caseload + Team as paired half-width cards on top —
// configuration and people-context, glanceable — with the Mentees TABLE
// (mentee-table.tsx, from Figma) full-width below.
//
// Only MENTORS reach this tab now. Lead mentors and supervisors supervise
// staff, not teens, so they get Supervision instead; a teen sees the same
// relationship from the other side (teen-mentors.tsx).
//
// Vocabulary law: "mentees" for the people, "caseload" for how many they can
// take; escalations name the observable cause, never a prediction.

import { PersonRow } from "@/components/record/person-row";
import { MenteeTable } from "@/components/record/mentee-table";
import {
  CaseloadControls,
  useCaseload,
} from "@/components/record/caseload-controls";
import {
  AvailabilityCell,
  AvailabilityMenu,
} from "@/components/admin/mentor-status-badge";
import { availabilityFor, liveLifecycle } from "@/lib/record/mentor-status";
import { getDemoOverview } from "@/lib/record/mentees-demo";
import { useOnboardingStore } from "@/lib/onboarding/store";

const H =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
// Matches the record's elevated card idiom (gaps.md #108).
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)]";

export function MentorshipPractice({
  mode,
  menteeCount,
  now,
  published,
}: {
  mode: "edit" | "read";
  /** Active mentees right now — the caseload floor + availability derivation. */
  menteeCount: number;
  now: number;
  /** Team appears once the mentor is published and matched. */
  published: boolean;
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

  const overview = getDemoOverview(now); // Team card only


  return (
    <div className="space-y-7">
      {/* ── Caseload + Team — paired half-width cards ─────────────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-label="Caseload" data-record-section="caseload">
          <h2 className={H}>Caseload</h2>
          <div className={`mt-3 ${CARD} [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]`}>
            {/* Value row — the card title names it, so no label column. */}
            <div className="py-3.5">
              <p
                className="text-[var(--text-primary)]"
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
              </p>
              <p
                className="mt-0.5 text-[var(--text-muted)]"
                style={{ font: "var(--type-helper)" }}
              >
                How many teens can be matched at once
              </p>
              {mode === "edit" && (
                <CaseloadControls
                  mentorId="live"
                  currentCount={menteeCount}
                  defaultTotal={slots.total}
                  className="mt-2.5"
                />
              )}
            </div>
            {/* Availability — practice configuration, lives with caseload. */}
            <div className="flex min-h-13 items-center justify-between gap-4 py-3.5">
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
            </div>
          </div>
        </section>

        {/* Team — this mentor's supervisor + lead mentor. Their records don't
            exist in this prototype, so the rows are non-pressable (no dead
            chevrons — deviation from "pressable" noted in the report). */}
        <section aria-label="Team" data-record-section="team">
          <h2 className={H}>Team</h2>
          <div className={`mt-3 ${CARD}`}>
            {published ? (
              overview.team.map((t) => (
                <PersonRow key={t.id} name={t.name} secondary={t.roleLabel} />
              ))
            ) : (
              <p className="py-3 text-[14px] leading-[20px] text-[var(--text-secondary)]">
                Team appears once this mentor is published and matched.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ── Mentees — the Figma table (mentee-table.tsx). Replaces the old
          PersonRow list: sortable columns, a real Active/Inactive toggle, and
          per-row Contact. The "Mentors they lead" block that used to close this
          component is gone — leads get the Supervision tab now, because they
          supervise mentors, not teens. */}
      <MenteeTable mentorId="live" mentorName={mentorName} />
    </div>
  );
}
