// Notification categories (settings-03) — data-driven, role-derived, same
// philosophy as settings-sections.ts. Each category declares which roles see
// it and its default state; the store (notificationPrefs) holds only explicit
// overrides, so "not set" falls back to `defaultOn` here.
//
// Role model: mentoring categories belong to anyone who mentors (mentor AND
// lead — a Lead Mentor still has mentees), leading categories are lead-only,
// supervising categories are supervisor-only. So a Lead sees the mentoring set
// PLUS the leading set; this "lead = mentor + extra" shape matches the nav and
// record decisions elsewhere.
//
// Copy obeys the Somethings voice: categories name EVENTS, never content, and
// never grade the mentor. One category — Escalations — is LOCKED ON: a safety
// signal a supervisor can't opt out of, with an inline reason.
//
// Channels (email / push / in-app) are NOT modeled — a per-channel matrix is
// not a trivial add, so each category is one on/off switch for now
// (design-system-gaps.md #102).

import type { SettingsRole } from "@/components/settings/tabs-config";

export interface NotificationCategory {
  id: string;
  label: string;
  description: string;
  /** Personas (by role) that see this category. */
  roles: SettingsRole[];
  /** Group heading this category sits under. */
  group: string;
  /** State when the persona hasn't set a preference. */
  defaultOn: boolean;
  /** Locked ON — always on, non-disableable, with an inline explanation. */
  locked?: boolean;
  lockReason?: string;
}

const MENTORING: SettingsRole[] = ["mentor", "lead"];

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  // Mentoring — mentor + lead
  {
    id: "change-requests",
    label: "Change requests",
    description: "When the review team responds to a profile change you sent.",
    roles: MENTORING,
    group: "Mentoring",
    defaultOn: true,
  },
  {
    id: "new-messages",
    label: "New messages",
    description: "When a teen you mentor sends you a message.",
    roles: MENTORING,
    group: "Mentoring",
    defaultOn: true,
  },
  {
    id: "schedule-reminders",
    label: "Schedule reminders",
    description: "A nudge before your set mentoring hours.",
    roles: MENTORING,
    group: "Mentoring",
    defaultOn: true,
  },
  // Leading — lead only
  {
    id: "mentors-activity",
    label: "Mentors' activity",
    description: "When a mentor on your team needs a hand.",
    roles: ["lead"],
    group: "Leading",
    defaultOn: true,
  },
  {
    id: "review-updates",
    label: "Review updates",
    description: "When a change you're reviewing moves forward.",
    roles: ["lead"],
    group: "Leading",
    defaultOn: true,
  },
  // Role migration: the review queues belong to the Lead Mentor now, so the
  // queue digest moved from Supervising → Leading.
  {
    id: "queue-digests",
    label: "Queue digests",
    description: "A daily summary of what's waiting in your queues.",
    roles: ["lead"],
    group: "Leading",
    defaultOn: true,
  },
  // Supervising — supervisor only
  {
    id: "escalations",
    label: "Escalations",
    description: "A safety escalation that needs a supervisor.",
    roles: ["supervisor"],
    group: "Supervising",
    defaultOn: true,
    locked: true,
    lockReason:
      "Escalations always reach a supervisor, so this one stays on.",
  },
  {
    id: "documentation-due",
    label: "Documentation due",
    description: "When documentation is coming due.",
    roles: ["supervisor"],
    group: "Supervising",
    defaultOn: false,
  },
];

export function notificationCategoriesForRole(
  role: SettingsRole
): NotificationCategory[] {
  return NOTIFICATION_CATEGORIES.filter((c) => c.roles.includes(role));
}

/** Distinct group headings, in first-seen order, for a role's categories. */
export function notificationGroupsForRole(role: SettingsRole): string[] {
  const seen: string[] = [];
  for (const c of notificationCategoriesForRole(role)) {
    if (!seen.includes(c.group)) seen.push(c.group);
  }
  return seen;
}
