// Mentor Record tab registry (record Phase 1) — drives the record's tab bar
// the same way SETTINGS_TABS drives settings. Labels MUST match the
// mentor-facing settings tabs exactly where they overlap (Profile, First
// moments, Schedule, Account).

import type { SettingsRole } from "@/components/settings/tabs-config";

export interface RecordTabDef {
  id: string;
  label: string;
  /** Registered but unbuilt tabs are excluded from the bar entirely — no
   *  dead tab chrome (Phase 1 content mapping: "create the registry entries
   *  but render nothing"). */
  built: boolean;
  /** Role gate — omit for tabs everyone (who can see the record) gets.
   *  When set, the tab renders only for these roles. */
  roles?: SettingsRole[];
}

export const RECORD_TABS: RecordTabDef[] = [
  { id: "overview", label: "Overview", built: true },
  { id: "profile", label: "Profile", built: true },
  { id: "first-moments", label: "First moments", built: true },
  { id: "schedule", label: "Schedule", built: true },
  { id: "account", label: "Account", built: true },
  { id: "mentorship", label: "Mentorship", built: true },
  // Insights (Prompt C) — reserved slot for the IMP-6 consolidation; empty
  // state only. Coaching/oversight surface: lead-mentor (and admin/super-
  // admin, which have no distinct persona in this prototype). Supervisor
  // tier does not see it. See gaps.md #95 for the spec ambiguity.
  { id: "insights", label: "Insights", built: true, roles: ["lead"] },
  // Phase 1: registry entries only — do not build, do not render.
  { id: "care-journey", label: "Care journey", built: false },
  { id: "billing", label: "Billing", built: false },
  { id: "documents", label: "Documents", built: false },
];

export const BUILT_RECORD_TABS = RECORD_TABS.filter((t) => t.built);

/** Tabs visible to a given role — built tabs minus role-gated ones the role
 *  isn't in. */
export function recordTabsForRole(role: SettingsRole): RecordTabDef[] {
  return BUILT_RECORD_TABS.filter((t) => !t.roles || t.roles.includes(role));
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
