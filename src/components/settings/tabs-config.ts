// Settings tab registry — build-spec §3 (Phase 9 IA revision, decision #10).
// The teen-facing editing surface is THE "Profile" tab (formerly "Matching
// profile" — everything a teen can see, match card + chat); account plumbing
// (identity + credentials) moves to "Account", last. Labels are sentence case,
// singular "Schedule". The tab set derives from the content audit ONLY: the
// Figma frames' AI Settings / Reactivation / Groups tabs are superseded — do
// NOT add them here or carry them over when matching Figma visuals. Nav must
// be driven from this config, never hardcoded.

// Phase 10 (decisions #11 rev/#12): "admin" is renamed SUPERVISOR everywhere;
// "lead" (Lead Mentor) sees Account only. Personas (the dev toggle's four
// states) map onto these roles via roleForPersona.
export type SettingsRole = "mentor" | "lead" | "supervisor";
export type SettingsTabStatus = "build" | "extend" | "restyle";

export interface SettingsTabDef {
  id: string;
  label: string;
  roles: SettingsRole[];
  status: SettingsTabStatus;
}

export const SETTINGS_TABS: SettingsTabDef[] = [
  // ex-"matching" — hosts the Match card + Chat groups (§4 rev).
  { id: "profile", label: "Profile", roles: ["mentor", "supervisor"], status: "extend" },
  // §3 rev (decision #9): first-chat content gets its own tab.
  { id: "first-moments", label: "First moments", roles: ["mentor", "supervisor"], status: "build" },
  { id: "schedule", label: "Schedule", roles: ["mentor", "supervisor"], status: "restyle" },
  // ex-"profile" — locked personal details + phone/email change flows.
  // Lead Mentors see ONLY this tab (§ Phase 10).
  { id: "account", label: "Account", roles: ["mentor", "lead", "supervisor"], status: "build" },
  // REMOVED — Mentorships tab (spec §3 rev, decision #8).
  { id: "permissions", label: "Roles & permissions", roles: ["supervisor"], status: "build" },
];

/** Legacy deep-link ids (?tab=) → current registry ids. "matching" renamed to
 *  "profile" in the Phase 9 IA revision; old "profile" links can't be
 *  disambiguated from new ones and resolve to the new Profile tab. */
export const LEGACY_TAB_ALIASES: Record<string, string> = {
  matching: "profile",
};

export function tabsForRole(role: SettingsRole): SettingsTabDef[] {
  return SETTINGS_TABS.filter((t) => t.roles.includes(role));
}

/** The dev toggle's four personas → settings role (§ Phase 10). */
export function roleForPersona(
  persona: "new-mentor" | "mentor" | "lead-mentor" | "supervisor"
): SettingsRole {
  if (persona === "supervisor") return "supervisor";
  if (persona === "lead-mentor") return "lead";
  return "mentor";
}
