// Universal Settings section registry (settings-01) — data-driven, same
// philosophy as tabs-config.ts: order + visibility + status live here, never
// hardcoded in the page. The page maps id → section component; a section
// whose content isn't built yet renders the shared placeholder/coming-soon
// treatment by status.
//
// roles defaults to all personas (nothing is role-hidden yet in S1). status
// "live" = real content (arriving across S1–S3); "coming-soon" = roadmap slot
// (inert, transparent). Only appearance is fully built in S1.

import {
  Accessibility,
  Bell,
  CalendarClock,
  Globe,
  Palette,
  Shield,
  User,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { SettingsRole } from "@/components/settings/tabs-config";

export type SettingsSectionStatus = "live" | "coming-soon";

export interface SettingsSectionDef {
  id: string;
  label: string;
  /** One-line description — used by the coming-soon/placeholder treatment. */
  description: string;
  icon: LucideIcon;
  status: SettingsSectionStatus;
  /** Personas that see the section. Default: all three settings roles. */
  roles: SettingsRole[];
}

const ALL: SettingsRole[] = ["mentor", "lead", "supervisor"];

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    id: "account",
    label: "Account",
    description: "Your name, contact details, and profile photo.",
    icon: User,
    status: "live", // content lands in settings-02
    roles: ALL,
  },
  {
    id: "security",
    label: "Security",
    description: "Sign out, password, and two-step verification.",
    icon: Shield,
    status: "live", // shell in settings-02
    roles: ALL,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Choose what you're notified about.",
    icon: Bell,
    status: "live", // content lands in settings-03
    roles: ALL,
  },
  {
    id: "availability",
    label: "Availability",
    description: "The hours you're around for teens.",
    icon: CalendarClock,
    status: "live", // placeholder until the schedule editor (settings-03)
    roles: ALL,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Light, dark, or match your device.",
    icon: Palette,
    status: "live", // built in settings-01
    roles: ALL,
  },
  {
    id: "language",
    label: "Language",
    description: "Choose the language you read Somethings in.",
    icon: Globe,
    status: "coming-soon",
    roles: ALL,
  },
  {
    id: "accessibility",
    label: "Accessibility",
    description: "Zoom, screen reader, and motion preferences.",
    icon: Accessibility,
    status: "coming-soon",
    roles: ALL,
  },
  {
    id: "audio-video",
    label: "Audio & video",
    description: "Camera and microphone for video calls.",
    icon: Video,
    status: "coming-soon",
    roles: ALL,
  },
];

/** Sections visible to a role (all, in S1 — no section is role-hidden yet). */
export function settingsSectionsForRole(
  role: SettingsRole
): SettingsSectionDef[] {
  return SETTINGS_SECTIONS.filter((s) => s.roles.includes(role));
}
