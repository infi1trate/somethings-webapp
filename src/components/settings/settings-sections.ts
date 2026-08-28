// Universal Settings section registry — data-driven, same philosophy as
// tabs-config.ts: order + visibility + status live here, never hardcoded in the
// page. PREFS ONLY (the IA restructure): Account (identity) and Availability
// (schedule) moved to the user record (/app/profile); the settings page
// redirects their old deep links. What's left is how the app behaves for me.
//
// status "live" = real content; "coming-soon" = roadmap slot (inert).

import {
  Accessibility,
  Bell,
  Globe,
  Palette,
  Shield,
  Video,
  Wrench,
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
  // Account moved to the user record (/app/profile?tab=account) — settings is
  // prefs only now.
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
  // Availability moved to the user record (/app/profile?tab=schedule).
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
  /** ═══ CONDITIONAL, AND THE ONLY ONE ═══
   *
   *  Present ONLY while the dev bar is hidden. It exists to undo that, so a
   *  permanent "Dev" section would be a settings row that does nothing on the
   *  99% of visits where the bar is already on screen — and a second, quieter
   *  way to reach a control that is already one click away.
   *
   *  Filtered by `settingsSectionsForRole`, not by the page: the registry is the
   *  single place order and visibility live (see the module note), and a page
   *  that special-cased one section would be the beginning of the end of that. */
  {
    id: "dev",
    label: "Dev", // TODO-COPY
    description:
      // TODO-COPY
      "The prototype harness — role switching, scenarios, and starting over.",
    icon: Wrench,
    status: "live",
    roles: ALL,
  },
];

/** Sections visible to a role, and in the state the app is in.
 *
 *  `devBarHidden` is the only non-role condition, and it is passed in rather
 *  than read from the store here so this module stays a pure registry — it is
 *  imported by things that must not subscribe to state. */
export function settingsSectionsForRole(
  role: SettingsRole,
  opts?: { devBarHidden?: boolean }
): SettingsSectionDef[] {
  return SETTINGS_SECTIONS.filter((s) => {
    if (!s.roles.includes(role)) return false;
    if (s.id === "dev") return opts?.devBarHidden === true;
    return true;
  });
}
