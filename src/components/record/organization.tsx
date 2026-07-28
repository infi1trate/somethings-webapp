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
import {
  AvailabilityCell,
  AvailabilityMenu,
  MentorStatusBadge,
  MentorStatusMenu,
} from "@/components/admin/mentor-status-badge";
import { availabilityFor, liveLifecycle } from "@/lib/record/mentor-status";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Org-assigned placeholders — the single source now that settings shows only
// the passive membership line (record-04b). Groups + Role are now staff-
// editable (stored on the onboarding store); Join date stays read-only.
export const MEMBERSHIP_GROUPS = ["North Carolina", "New Jersey"];
export const JOIN_DATE = "March 25, 2026";

// Staff-editable org fields (lead + supervisor can set these on the record).
const ROLE_OPTIONS = ["Mentor", "Lead mentor", "Supervisor"];
const GROUP_OPTIONS = [
  "California",
  "Illinois",
  "New Jersey",
  "North Carolina",
];

// Group memberships as removable chips + an "Add group" menu of the remaining
// options. Staff-only (rendered when the Organization card is in edit mode).
function GroupsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (groups: string[]) => void;
}) {
  const available = GROUP_OPTIONS.filter((g) => !value.includes(g));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((g) => (
        <span
          key={g}
          className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-s1)] py-1 pl-2.5 pr-1 text-[13px] font-medium text-[var(--text-primary)]"
        >
          {g}
          <button
            type="button"
            aria-label={`Remove ${g}`}
            onClick={() => onChange(value.filter((x) => x !== g))}
            className="rounded-full p-0.5 text-[var(--text-muted)] transition-colors hover:bg-black/[0.06] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus-ring)]"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {value.length === 0 && (
        <span className="text-[13px] text-[var(--text-muted)]">Not recorded</span>
      )}
      {available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Add group"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--border-contour)] py-1 pl-2 pr-2.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.03] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus-ring)]"
            >
              <Plus className="size-3.5" aria-hidden />
              Add
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {available.map((g) => (
              <DropdownMenuItem key={g} onSelect={() => onChange([...value, g])}>
                {g}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

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
  const profileHidden = useOnboardingStore((s) => s.profileHidden);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const setMentorStatus = useOnboardingStore((s) => s.setMentorStatus);
  const mentorAccepting = useOnboardingStore((s) => s.mentorAccepting);
  const setMentorAccepting = useOnboardingStore((s) => s.setMentorAccepting);
  const slots = useOnboardingStore((s) => s.slots);
  const caseloads = useOnboardingStore((s) => s.caseloads);
  const mentorRole = useOnboardingStore((s) => s.mentorRole);
  const setMentorRole = useOnboardingStore((s) => s.setMentorRole);
  const mentorGroups = useOnboardingStore((s) => s.mentorGroups);
  const setMentorGroups = useOnboardingStore((s) => s.setMentorGroups);
  const draft = useOnboardingStore((s) => s.draft);
  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "this mentor";

  const deactivated = accountStatus === "deactivated";
  // Shared lifecycle vocabulary with the Mentors roster + header pill. A manual
  // staff override (set from here or the roster) wins over the derived standing.
  const lifecycle =
    mentorStatuses["live"] ?? liveLifecycle(status, accountStatus, profileHidden);
  // Availability — same derivation as the roster (menteeCount vs the live
  // caseload cap + the accepting intent), kept consistent with the Caseload row.
  const cap = caseloads["live"]?.total ?? slots.total;
  const accepting = mentorAccepting["live"] ?? true;
  const availability = availabilityFor(lifecycle, menteeCount, cap, accepting);
  const atCap = menteeCount >= cap;

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
        {/* Role — staff-toggleable (lead + supervisor). Read viewers see the
            value; editors get a select. */}
        <RecordRow
          label="Role"
          value={
            mode === "edit" ? (
              <Select value={mentorRole} onValueChange={setMentorRole}>
                <SelectTrigger className="h-9 w-[200px]" aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              mentorRole
            )
          }
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        {/* Groups — staff can add/remove memberships. */}
        <RecordRow
          label="Groups"
          value={
            mode === "edit" ? (
              <GroupsEditor value={mentorGroups} onChange={setMentorGroups} />
            ) : mentorGroups.length ? (
              mentorGroups.join(", ")
            ) : (
              "Not recorded"
            )
          }
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        {/* Join date — never editable (set once when the mentor joined). */}
        <RecordRow
          label="Join date"
          value={JOIN_DATE}
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        {/* Status + Assignment bind to the same state the header/overflow
            deactivate flow controls — never stored separately, no affordance
            here (derived state, not an editable field). Dots are decorative;
            text carries meaning (gaps.md #65 interim green). */}
        {/* Lifecycle badge — same vocabulary + component as the Mentors roster
            Status column, so table and record read identically. Staff (edit
            mode = lead + supervisor) can change it inline via the same menu the
            roster uses; read-only viewers see the badge. Deactivated keeps its
            off-boarding date alongside. */}
        <RecordRow
          label="Status"
          value={
            <span className="flex items-center gap-2">
              {mode === "edit" ? (
                <MentorStatusMenu
                  status={lifecycle}
                  name={mentorName}
                  onChange={(s) => setMentorStatus("live", s)}
                />
              ) : (
                <MentorStatusBadge status={lifecycle} />
              )}
              {deactivated && deactivatedOn && (
                <span className="text-[var(--text-secondary)]">
                  · {deactivatedOn}
                </span>
              )}
            </span>
          }
          state="read"
          locked
          onEditStart={() => {}}
          onCancel={() => {}}
        />
        {/* Availability — staff (edit) can toggle the accepting intent inline
            (same menu the roster uses); read-only viewers see the derived value.
            "Full" is derived from the caseload. (Assignment status was removed —
            it's implied by caseload + availability.) */}
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
        <CaseloadRow menteeCount={menteeCount} mode={mode} />
      </div>
    </div>
  );
}
