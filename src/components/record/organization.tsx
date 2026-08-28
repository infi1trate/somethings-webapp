"use client";

// Organization card — the UNIVERSAL tab on every staff record (the tab split
// separated org MEMBERSHIP from mentoring PRACTICE). These are org-owned facts
// true of every staff type: Role, Groups, Join date, and org-membership
// Status. Practice fields (mentees, caseload, availability) moved to the
// subject-conditional Mentorship tab. Staff surface only; post role-migration
// the Lead Mentor manages it (the Supervisor retains edit oversight). Store
// writes here are org actions — never mentor-facing paths.
//
// LIVES ON THE ACCOUNT TAB. The Organization tab is gone: Team moved to
// Mentorship (it's the care network, not paperwork) and these four rows moved
// here, which left the tab with nothing in it. Role/groups/join date/status are
// account facts — the same drawer as name, phone and email — so a tab of their
// own was a tab for four rows.
//
// Phase 2: attributes of a person are typography, not boxes — open RecordRow
// rows with hairline dividers. No card heading: the "Organization" tab name
// already says it (tab-echo rule). Phase 3 affordances: org-assigned facts
// (Role, Groups, Join date) carry the lock badge with a why; Status is derived
// state (bound to the header overflow round trips) and shows no affordance.

import { useRef, useState } from "react";
import { RecordRow } from "@/components/record/row";
import {
  MentorStatusBadge,
  MentorStatusMenu,
} from "@/components/admin/mentor-status-badge";
import { liveLifecycle } from "@/lib/record/mentor-status";
import { DeactivateAction } from "@/components/record/deactivate-action";
import { ConfirmDialog } from "@/components/record/confirm-dialog";
import type { MentorLifecycleStatus } from "@/lib/types";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { staffActorFor } from "@/lib/record/permission-map";
import { Plus, X } from "lucide-react";
import { touchTarget } from "@/lib/touch-target";
import { cn } from "@/lib/utils";
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

// The live mentor's chain of support. TODO-DATA: fixed for the one store-backed
// mentor (fixture people carry real leadId/supervisorId edges instead).
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
            // SC 2.5.8 — `p-0.5` around a 14px icon gave an 18x18 target. `p-1.5`
            // makes it 26px. PADDING, not `touchTarget()`: this cluster is
            // `flex flex-wrap` with `gap-1.5`, so a vertical `::after` bleed would
            // overlap the chip row above or below (gap row 290).
            className="rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-press)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus-ring)]"
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
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--border-contour)] py-1 pl-2 pr-2.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-faint)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus-ring)]"
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

export function OrganizationCard({
  mode,
}: {
  mode: "edit" | "read";
}) {
  const status = useOnboardingStore((s) => s.status);
  const accountStatus = useOnboardingStore((s) => s.accountStatus);
  const deactivatedOn = useOnboardingStore((s) => s.deactivatedOn);
  const profileHidden = useOnboardingStore((s) => s.profileHidden);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const setMentorStatus = useOnboardingStore((s) => s.setMentorStatus);
  const clearMentorStatus = useOnboardingStore((s) => s.clearMentorStatus);
  const setAccountStatus = useOnboardingStore((s) => s.setAccountStatus);
  const setProfileHidden = useOnboardingStore((s) => s.setProfileHidden);
  const persona = useOnboardingStore((s) => s.persona);
  const staffActor = staffActorFor(persona);
  const accountLocks = useOnboardingStore((s) => s.accountLocks);
  const setAccountLock = useOnboardingStore((s) => s.setAccountLock);
  const mentorRole = useOnboardingStore((s) => s.mentorRole);
  const setMentorRole = useOnboardingStore((s) => s.setMentorRole);
  const mentorGroups = useOnboardingStore((s) => s.mentorGroups);
  const setMentorGroups = useOnboardingStore((s) => s.setMentorGroups);
  const draft = useOnboardingStore((s) => s.draft);
  const mentorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "this mentor";

  const deactivated = accountStatus === "deactivated";
  const [pendingDeactivate, setPendingDeactivate] = useState(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  // Shared lifecycle vocabulary with the Mentors roster + header pill. A manual
  // staff override (set from here or the roster) wins over the derived standing.
  const lifecycle =
    mentorStatuses["live"] ?? liveLifecycle(status, accountStatus, profileHidden);

  /** Write a lifecycle choice to the REAL axis where one exists, and release
   *  the override so the derived value governs again. Deactivated/Paused/Active
   *  all map to store state; In Training and Guided don't (no source), so they
   *  remain overrides. This is what keeps the menu, the header, the overflow
   *  and the roster in agreement. */
  const applyLifecycle = (next: MentorLifecycleStatus) => {
    if (next === "deactivated") {
      setAccountStatus(
        "deactivated",
        new Date().toLocaleDateString(undefined, { dateStyle: "long" })
      );
      clearMentorStatus("live");
    } else if (next === "paused") {
      if (accountStatus === "deactivated") setAccountStatus("active");
      setProfileHidden(true, staffActor);
      clearMentorStatus("live");
    } else if (next === "active") {
      if (accountStatus === "deactivated") setAccountStatus("active");
      if (profileHidden) setProfileHidden(false, staffActor);
      clearMentorStatus("live");
    } else {
      // in-training / guided — no store axis carries these.
      setMentorStatus("live", next);
    }
  };

  return (
    <div>
    {/* No card heading — the "Organization" tab name already says it (tab-echo
        rule). Soft surface card with inset top-border dividers after the first
        row (never bottom — Tailwind v4's divide-y compiles to bottom borders). */}
    <div className="rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 [&>*+*]:border-t [&>*+*]:border-[var(--border-subtle)]">
        {/* Role — staff-toggleable (lead + supervisor). Read viewers see the
            value; editors get a select. */}
        <RecordRow
          label="Role"
          value={
            mode === "edit" ? (
              <Select value={mentorRole} onValueChange={setMentorRole}>
                {/* 36px visual, 44px target — compact height deliberate
                    (see active-hours.tsx); asked and confirmed. */}
                <SelectTrigger
                  className={cn(touchTarget(36), "h-9 w-[200px] max-w-full")}
                  aria-label="Role"
                >
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
        {/* Status — org membership state. The lifecycle AXES are authoritative:
            Deactivated is accountStatus, Paused is profileHidden, Active clears
            both. Picking one of those from the menu writes the real axis AND
            releases any manual override, so this row, the header pill, the
            overflow menu and the roster can never disagree again. (They used
            to: the menu wrote only mentorStatuses[id], and because lifecycle
            reads `override ?? derived` with nothing ever deleting the key, one
            click permanently masked the real state.) In Training / Guided have
            no axis, so they stay override-only. */}
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
                  onChange={(next) => {
                    // Same confirm as the band's button — the menu used to
                    // commit the one destructive transition silently.
                    if (next === "deactivated") setPendingDeactivate(true);
                    else applyLifecycle(next);
                  }}
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
        {/* Availability + Caseload live on the Mentorship tab now — they are
            mentoring PRACTICE, not org membership (the tab split). */}
      </div>

      {/* Deactivation belongs WITH status — it IS a status change. It used to
          live only behind the header's overflow, two clicks and a menu away
          from the control it duplicates. Both paths now write the same axis. */}
      {mode === "edit" && (
        <DeactivateAction
          name={mentorName}
          deactivated={deactivated}
          onConfirm={(reactivate) =>
            applyLifecycle(reactivate ? "active" : "deactivated")
          }
          lock={accountLocks["live"] ?? null}
          onLockChange={(lock) => setAccountLock("live", lock)}
          blocked={{ email: draft.email, phone: draft.phone }}
          actor={mentorName}
          actorRole={staffActor}
        />
      )}

      <ConfirmDialog
        open={pendingDeactivate}
        onOpenChange={setPendingDeactivate}
        returnFocusTo={returnFocusTo}
        title={`Deactivate ${mentorName}?`}
        description="They'll be removed from matching right away, and teens won't see their profile. Active mentorships are paused, not ended. You can reactivate them later — nothing is deleted."
        confirmLabel="Deactivate"
        tone="destructive"
        onConfirm={() => applyLifecycle("deactivated")}
      />

    </div>
  );
}
