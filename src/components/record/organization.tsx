"use client";

// Organization block of the Mentor Record's Mentorship tab (record-04b,
// re-homed in record Phase 1) — the org-owned fields that used to sit in
// settings (P11 Membership) and the Roles & permissions tab. Staff surface
// only; post role-migration the Lead Mentor manages it (the Supervisor
// retains edit oversight). Store writes here are org actions — never
// mentor-facing paths.
//
// Phase 2: attributes of a person are typography, not boxes — open RecordRow
// rows with hairline dividers, bare 16px heading. Phase 3 affordances:
// org-assigned facts (Role, Groups, Join date) carry the lock badge with a
// why; Status/Assignment are derived state (bound to the header overflow
// round trips) and show no affordance.
//
// Caseload prompt: the old "Total slots" + "Daily new teens" rows merged into
// ONE Caseload row — the same CaseloadControls the lead's mentee modal uses,
// writing the same store key ("live"), so the two surfaces stay coherent.
// dailyNew is retired from the UI (the store field remains for compat).

import { RecordRow } from "@/components/record/row";
import {
  CaseloadControls,
  useCaseload,
} from "@/components/record/caseload-controls";
import { useOnboardingStore } from "@/lib/onboarding/store";

// Org-assigned placeholders — the single source now that settings shows only
// the passive membership line (record-04b).
export const MEMBERSHIP_GROUPS = ["North Carolina", "New Jersey"];
export const JOIN_DATE = "March 25, 2026";

// Interim lock explainer (gaps.md #83) — copy minted here, not in any spec.
const ORG_LOCK = {
  label: "Org-managed",
  reason: "Set by the organization — not editable on this profile.",
};

// The merged Caseload row (caseload prompt) — replaces the old "Total slots" +
// "Daily new teens" SlotRows. Same three-zone row metrics as RecordRow's read
// state; when the viewer can edit, the shared CaseloadControls render inline
// beneath the value (immediate writes, matching the lead's mentee modal).
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

export function OrganizationCard({
  mode,
  menteeCount,
}: {
  mode: "edit" | "read";
  /** Active mentees right now (the record page's count) — the caseload floor. */
  menteeCount: number;
}) {
  const status = useOnboardingStore((s) => s.status);
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const deactivatedOn = useOnboardingStore((s) => s.deactivatedOn);

  const deactivated = accountStatus === "deactivated";
  const assigned = status === "published" && accountStatus === "active";

  return (
    <div>
      <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        Organization
      </h2>
      {/* Soft surface card: containment at the group level, 7 rows → inset
          separators (top borders after the first row, square ends, lightest
          token — Prompt 2's one rule). Contour is definition, not division. */}
      {/* Top borders after the first row (never bottom — Tailwind v4's
          divide-y compiles to bottom borders, so the variant is explicit). */}
      <div className="mt-3 rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]">
        {/* TODO(product): "Lead mentor" as a Role value — confirm it is a
            real, distinct role and how promotion is assigned (gaps.md #64).
            The record's subject is the store-backed mentor. */}
        <RecordRow
          label="Role"
          value="Mentor"
          state="read"
          lock={ORG_LOCK}
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        {/* FUTURE FLOW: group assignment is supervisor-managed and arrives
            with the groups console — read-only until then (gaps.md #64).
            Plain text, not chips: pills are for status, not categories
            (Phase 2 restraint rules). */}
        <RecordRow
          label="Groups"
          value={MEMBERSHIP_GROUPS.join(", ")}
          state="read"
          lock={ORG_LOCK}
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        <RecordRow
          label="Join date"
          value={JOIN_DATE}
          state="read"
          lock={ORG_LOCK}
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        {/* Status + Assignment bind to the same state the header/overflow
            deactivate flow controls — never stored separately, no affordance
            here (derived state, not an editable field). Dots are decorative;
            text carries meaning (gaps.md #65 interim green). */}
        <RecordRow
          label="Status"
          value={
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: deactivated
                    ? "var(--state-error)"
                    : "#3a7d44",
                }}
              />
              <span>
                {deactivated
                  ? `Deactivated · ${deactivatedOn ?? "—"}`
                  : "Active"}
              </span>
            </span>
          }
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        <RecordRow
          label="Assignment status"
          value={
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: assigned ? "#3a7d44" : "var(--state-error)",
                }}
              />
              <span>{assigned ? "Assigned" : "Unassigned"}</span>
            </span>
          }
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        <CaseloadRow menteeCount={menteeCount} mode={mode} />
      </div>
    </div>
  );
}
