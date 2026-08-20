"use client";

// CareNetwork — the top band of the Mentorship tab: the full care network around
// this mentor. Who holds him up (Team) beside what he holds (Practice).
//
// Paired half-width cards, because the two halves answer one question together.
// Team used to sit alone on the Organization tab and Practice was a strip of
// controls in the Mentees card header — the network was never legible as a whole.
//
// Team rows route to the person's record through the shared PersonRow, so the
// chevron is honest. Practice is three quiet rows, not a toolbar: the numbers are
// read far more often than they are changed.
//
// Vocabulary law (unchanged, and re-confirmed for this pass): "mentees" for the
// PEOPLE, "caseload" for the CAPACITY concept only — never for the people.

import { PersonRow } from "@/components/record/person-row";
import { SegmentedControl } from "@/components/record/segmented-control";
import { AvailabilityCell, AvailabilityMenu } from "@/components/admin/mentor-status-badge";
import { recordHrefFor } from "@/lib/record/subject";
import type { MentorAvailability } from "@/lib/types";
import type { Caseload } from "@/lib/onboarding/store";

const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] shadow-[var(--shadow-card)]";
const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const LABEL = "text-[var(--text-muted)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

export interface NetworkPerson {
  id: string;
  name: string;
  roleLabel: string;
  /** Fixture staff have records; the store-backed mentor's supervisor may not. */
  hasRecord?: boolean;
}

/** One Practice row: quiet label, value on the right. */
function PracticeRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
      <span className={LABEL} style={LABEL_STYLE}>
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-2">{children}</span>
    </div>
  );
}

export function CareNetwork({
  team,
  menteeCount,
  caseload,
  onCaseloadMode,
  availability,
  accepting,
  atCap,
  mentorName,
  onAcceptingChange,
  editable,
}: {
  /** Supervisor + lead mentor — the people who hold this mentor up. */
  team: NetworkPerson[];
  menteeCount: number;
  caseload: Caseload;
  onCaseloadMode: (mode: Caseload["mode"]) => void;
  availability: MentorAvailability | null;
  accepting: boolean;
  atCap: boolean;
  mentorName: string;
  onAcceptingChange: (next: boolean) => void;
  editable: boolean;
}) {
  return (
    <div className="grid items-start gap-[var(--card-gap)] lg:grid-cols-2">
      {/* ── Who holds him up ─────────────────────────────────────────────── */}
      <section aria-label="Team" data-record-section="team">
        <h2 className={H2}>Team</h2>
        <div className={`mt-3 py-1.5 ${CARD}`}>
          {team.length === 0 ? (
            // TODO-COPY
            <p
              className="py-2 text-[var(--text-secondary)]"
              style={{ font: "var(--type-row-label)" }}
            >
              No one assigned yet.
            </p>
          ) : (
            team.map((p) => (
              <PersonRow
                key={p.id}
                name={p.name}
                secondary={p.roleLabel}
                // Non-pressable when the record doesn't exist — a chevron that
                // goes nowhere is worse than no chevron.
                href={p.hasRecord === false ? undefined : recordHrefFor(p.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* ── What he holds ────────────────────────────────────────────────── */}
      <section aria-label="Practice" data-record-section="practice">
        <h2 className={H2}>Practice</h2>
        <div
          className={`mt-3 py-1.5 ${CARD} [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]`}
        >
          <PracticeRow label="Caseload">
            <span
              className="text-[var(--text-primary)] tabular-nums"
              style={{ font: "var(--type-row-value)" }}
            >
              {menteeCount} of {caseload.total} mentees
            </span>
          </PracticeRow>
          <PracticeRow label="Availability">
            {editable ? (
              <AvailabilityMenu
                value={availability}
                accepting={accepting}
                atCap={atCap}
                name={mentorName}
                onChange={onAcceptingChange}
              />
            ) : (
              <AvailabilityCell value={availability} />
            )}
          </PracticeRow>
          <PracticeRow label="Mode">
            {editable ? (
              <SegmentedControl
                size="sm"
                ariaLabel="Caseload mode"
                options={[
                  { value: "automatic" as const, label: "Automatic" },
                  { value: "custom" as const, label: "Custom" },
                ]}
                value={caseload.mode}
                onChange={onCaseloadMode}
              />
            ) : (
              <span
                className="text-[var(--text-primary)]"
                style={{ font: "var(--type-row-value)" }}
              >
                {caseload.mode === "automatic" ? "Automatic" : "Custom"}
              </span>
            )}
          </PracticeRow>
          {/* The helper line, as built — sits under the rows so it explains the
              mode without competing with the numbers. */}
          <p
            className={`${LABEL} pb-1 pt-2`}
            style={{ font: "var(--type-helper)" }}
          >
            {caseload.mode === "automatic"
              ? "Caseload adjusts automatically with matching activity."
              : "Caseload is set by hand and won't move on its own."}
          </p>
        </div>
      </section>
    </div>
  );
}
