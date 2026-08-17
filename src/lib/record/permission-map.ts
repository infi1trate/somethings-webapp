// Mentor Record permission map (record-01) — which mode each record section
// renders in, per viewing persona. Pure data + one resolver; the record route
// reads this, nothing else derives visibility ad hoc.

import type { Persona } from "@/lib/types";

// Modes: "hidden" = section does not render (no disabled placeholder);
// "read" = read-native layout; "edit" = read layout + staff edit affordances;
// "review" = read layout + change-request affordances (never direct edits).
// Personas map to columns: leadMentor → leadMentor; supervisor → admin
// (the codebase renamed admin→Supervisor in P10). The `supervisorTier`
// column is the FigJam read-mostly middle tier — no persona selects it in
// this prototype; it exists as documentation and for a future persona.
//
// OWNERSHIP (role migration): the LEAD MENTOR is the core role that manages
// mentors — reviews, profile change requests, account edits, internal notes,
// destructive account actions. The approve/send-back REVIEW flows stay
// exclusively the lead's: the admin column's `reviewWorkflow` reads as plain
// "read".
//
// EDIT PARITY (user-mandated): a SUPERVISOR edits teen-facing profile content
// on the same terms as a lead — `matchingProfile` and `firstMoments` are "edit"
// in the admin column too. A supervisor sits ABOVE the lead in the hierarchy, so
// the old read-only middle ground meant the more senior role could see a problem
// in a profile and not fix it. Reviewing a submission and editing a published
// profile stay separate powers: parity here does NOT hand the supervisor the
// review console.
//
// EDIT-ANYTHING (lead): a Lead Mentor may edit any field on any record,
// including the teen-facing Profile + First-moments content — so those slots
// are "edit" for leadMentor (not "review"). The inline staff editors for the
// live mentor's rich match-card fields are built; on a FIXTURE person's record
// the same two slots gate text-field editors instead, because the asset-backed
// fields (photo / audio intro / vibe board / story slides) hold real uploads
// that no demo person has.
export const permissionMap = {
  identity:           { mentor: "hidden", leadMentor: "read",   supervisorTier: "read", admin: "read" },
  reviewWorkflow:     { mentor: "hidden", leadMentor: "review", supervisorTier: "read", admin: "read" },
  matchingProfile:    { mentor: "hidden", leadMentor: "edit",   supervisorTier: "read", admin: "edit" },
  firstMoments:       { mentor: "hidden", leadMentor: "edit",   supervisorTier: "read", admin: "edit" },
  schedule:           { mentor: "hidden", leadMentor: "edit",   supervisorTier: "edit", admin: "edit" },
  accountSelfService: { mentor: "hidden", leadMentor: "edit",   supervisorTier: "read", admin: "edit" },
  accountOrg:         { mentor: "hidden", leadMentor: "edit",   supervisorTier: "read", admin: "edit" },
  internalNotes:      { mentor: "hidden", leadMentor: "edit",   supervisorTier: "read", admin: "edit" },
  relationships:      { mentor: "hidden", leadMentor: "read",   supervisorTier: "read", admin: "read" },
} as const;

export type RecordSection = keyof typeof permissionMap;
export type RecordMode = "hidden" | "read" | "edit" | "review";
type PermissionColumn = keyof (typeof permissionMap)[RecordSection];

// The dev toggle's personas → permission columns. "new-mentor" and "mentor"
// both resolve to the mentor column (everything hidden — the record route
// additionally redirects them away); no persona selects supervisorTier yet.
function columnForPersona(persona: Persona): PermissionColumn {
  switch (persona) {
    case "supervisor":
      return "admin";
    case "lead-mentor":
      return "leadMentor";
    default:
      return "mentor";
  }
}

/** The mode a record section renders in for the viewing persona. */
export function resolveMode(
  section: RecordSection,
  persona: Persona
): RecordMode {
  return permissionMap[section][columnForPersona(persona)];
}

// Record page section order (top → bottom). "account" is a RENDER GROUP that
// composes the accountSelfService + accountOrg permission rows (they gate its
// two halves independently); "identity" isn't in the flow — it renders as the
// record header, gated by its own permission row.
export const RECORD_SECTION_ORDER = [
  "reviewWorkflow",
  "matchingProfile",
  "firstMoments",
  "schedule",
  "account",
  "internalNotes",
  "relationships",
] as const;

export type RecordSectionSlot = (typeof RECORD_SECTION_ORDER)[number];
