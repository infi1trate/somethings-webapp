// Account-field vocabulary + staff-edit audit helpers (record-04a).
// The staff write path logs one staff-attributed activity entry per save;
// those entries double as the "Last changed by …" audit trail — no separate
// audit storage (stub persistence per the record-04 brief).

import type { ActivityItem } from "@/lib/types";

/** Human nouns for the account fields the record can edit — used by the
 *  mentor-facing activity copy AND the record's audit lines. */
export const ACCOUNT_FIELD_LABELS: Record<string, string> = {
  staffPhoto: "photo",
  firstName: "first name",
  lastName: "last name",
  dob: "date of birth",
  sex: "sex",
  races: "race",
  phone: "phone number",
  email: "email",
};

export function accountFieldLabel(fieldId: string): string {
  return ACCOUNT_FIELD_LABELS[fieldId] ?? "account details";
}

/** Newest staff edit touching a field — the audit line's source of truth. */
export function lastStaffEdit(
  activity: ActivityItem[],
  fieldId: string
): { actor: string; date: string } | null {
  const entry = activity.find(
    (a) => a.type === "staff_account_edit" && a.fieldIds.includes(fieldId)
  );
  if (!entry) return null;
  return {
    actor: entry.actor ?? "Somethings team",
    date: new Date(entry.createdAt).toLocaleDateString(undefined, {
      dateStyle: "long",
    }),
  };
}

/** "Last changed by Supervisor · July 21, 2026" (or null when untouched). */
export function auditLineFor(
  activity: ActivityItem[],
  fieldId: string
): string | null {
  const last = lastStaffEdit(activity, fieldId);
  return last ? `Last changed by ${last.actor} · ${last.date}` : null;
}
