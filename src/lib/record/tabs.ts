// Mentor Record tab registry (record Phase 1) — drives the record's tab bar
// the same way SETTINGS_TABS drives settings. Labels MUST match the
// mentor-facing settings tabs exactly where they overlap (Profile, First
// moments, Schedule, Account).

import type { SettingsRole } from "@/components/settings/tabs-config";

/** The role of the PERSON whose record this is (the subject) — distinct from
 *  the VIEWER persona/role. Drives which practice tabs EXIST on the record. */
export type SubjectRole = "mentor" | "lead-mentor" | "supervisor" | "admin";

export interface RecordTabDef {
  id: string;
  label: string;
  /** Registered but unbuilt tabs are excluded from the bar entirely — no
   *  dead tab chrome (Phase 1 content mapping: "create the registry entries
   *  but render nothing"). */
  built: boolean;
  /** VIEWER permission-gate — omit for tabs every viewer who can see the
   *  record gets. When set, the tab renders only for these VIEWER roles. This
   *  is "hidden from some viewers, but the tab still exists" (e.g. the old
   *  Insights). Currently dormant (no built tab sets it), kept for when a
   *  viewer-gated tab returns. */
  roles?: SettingsRole[];
  /** SUBJECT existence-gate — omit for universal tabs. When set, the tab
   *  EXISTS only when the record's SUBJECT is one of these roles. A supervisor
   *  record has NO Mentorship tab at all — a different mechanism from `roles`
   *  (existence, not permission). The two never collapse into one check. */
  subjectRoles?: SubjectRole[];
}

// ORDER INVARIANT: the slot after Overview is always the subject's PRACTICE
// tab when one exists (Mentorship for mentor/lead-mentor, Supervision for
// supervisor — mutually exclusive by subject, so they share the slot). The
// mentor-app mirror is preserved as a SUBSEQUENCE: Profile, First moments,
// Schedule, Account keep their relative order. Organization closes the bar.
// A permission-gated tab (e.g. a returning Insights via `roles`) goes LAST.
export const RECORD_TABS: RecordTabDef[] = [
  { id: "overview", label: "Overview", built: true },
  // Practice tabs — subject-conditional (existence, not permission).
  {
    id: "mentorship",
    label: "Mentorship",
    built: true,
    subjectRoles: ["mentor", "lead-mentor"],
  },
  {
    // TODO-COPY: "Supervision" may be renamed "Team" later — the label is
    // registry-configurable so a rename is a one-line change here.
    id: "supervision",
    label: "Supervision",
    built: true,
    subjectRoles: ["supervisor"],
  },
  { id: "profile", label: "Profile", built: true },
  { id: "first-moments", label: "First moments", built: true },
  { id: "schedule", label: "Schedule", built: true },
  { id: "account", label: "Account", built: true },
  // Organization is UNIVERSAL — org membership (role, groups, join date,
  // status) is true of every staff type, so no gate.
  { id: "organization", label: "Organization", built: true },
  // Insights removed — the IMP-6 charts (engagement, retention, bonus, match
  // rate) now live on the Overview tab (see RecordOverview). The tab is gone,
  // not deferred; if it returns it is `roles`-gated and slots last (invariant).
  // Registry entries only — do not build, do not render.
  { id: "care-journey", label: "Care journey", built: false },
  { id: "billing", label: "Billing", built: false },
  { id: "documents", label: "Documents", built: false },
];

export const BUILT_RECORD_TABS = RECORD_TABS.filter((t) => t.built);

/** Tabs for a specific record view. TWO independent gates, kept separate on
 *  purpose (see RecordTabDef):
 *  • `roles`        → VIEWER permission-gate (may this viewer see the tab).
 *  • `subjectRoles` → SUBJECT existence-gate (does the tab exist for this
 *    record's subject at all). */
export function recordTabsFor({
  viewerRole,
  subjectRole,
}: {
  viewerRole: SettingsRole;
  subjectRole: SubjectRole;
}): RecordTabDef[] {
  return BUILT_RECORD_TABS.filter(
    (t) =>
      (!t.roles || t.roles.includes(viewerRole)) &&
      (!t.subjectRoles || t.subjectRoles.includes(subjectRole))
  );
}

const SUBJECT_ROLES: SubjectRole[] = [
  "mentor",
  "lead-mentor",
  "supervisor",
  "admin",
];

/** Dev-only subject-role resolver (from `?subjectRole=`). Defaults to "mentor"
 *  — the only real record in this prototype. No visible control: the toggle is
 *  the VIEWER; this param lets us preview/verify the subject-conditional tab
 *  set for non-mentor subjects (Supervision, admin no-practice) until real
 *  supervisor/admin records exist. */
export function subjectRoleFromParam(
  value: string | string[] | null | undefined
): SubjectRole {
  return typeof value === "string" && SUBJECT_ROLES.includes(value as SubjectRole)
    ? (value as SubjectRole)
    : "mentor";
}

/** True when the subject is a role that actually mentors teens — the only
 *  subjects with a mentee list, caseload, and availability. */
export function subjectHasPractice(role: SubjectRole): boolean {
  return role === "mentor" || role === "lead-mentor";
}

/** ?focus= deep links (roster Review CTA, shell avatars) → record tabs. */
export const FOCUS_TO_TAB: Record<string, string> = {
  review: "overview",
  account: "account",
};

/** The right rail's contextual default segment per tab (always
 *  user-switchable): Preview beside the teen-facing tabs, Notes elsewhere. */
export function railDefaultFor(tabId: string): "preview" | "notes" {
  return tabId === "profile" || tabId === "first-moments"
    ? "preview"
    : "notes";
}
