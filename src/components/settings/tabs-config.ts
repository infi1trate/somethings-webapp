// Settings tab registry — build-spec §3. The tab set is derived from the
// sticky-note content audit ONLY: the Figma frames' AI Settings / Reactivation /
// Groups tabs are superseded — do NOT add them here or carry them over when
// matching Figma visuals. Nav must be driven from this config, never hardcoded.

export type SettingsRole = "mentor" | "admin";
export type SettingsTabStatus = "build" | "extend" | "restyle";

export interface SettingsTabDef {
  id: string;
  label: string;
  roles: SettingsRole[];
  status: SettingsTabStatus;
}

export const SETTINGS_TABS: SettingsTabDef[] = [
  { id: "profile", label: "Profile", roles: ["mentor", "admin"], status: "build" },
  { id: "matching", label: "Matching profile", roles: ["mentor", "admin"], status: "extend" },
  // §3 rev (decision #9): first-chat content gets its own tab.
  { id: "first-moments", label: "First moments", roles: ["mentor", "admin"], status: "build" },
  { id: "schedule", label: "Schedule", roles: ["mentor", "admin"], status: "restyle" },
  // REMOVED — Mentorships tab (spec §3 rev, decision #8).
  { id: "permissions", label: "Roles & permissions", roles: ["admin"], status: "build" },
];

export function tabsForRole(role: SettingsRole): SettingsTabDef[] {
  return SETTINGS_TABS.filter((t) => t.roles.includes(role));
}
