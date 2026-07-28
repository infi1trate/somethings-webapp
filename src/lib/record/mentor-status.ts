// Single source of truth for the mentor LIFECYCLE STATUS (5-value) and the
// separate AVAILABILITY axis — labels, ordering, badge config, and derivation.
// Consumed by the roster table, the record page, and the /dev showcase so the
// three surfaces stay in lockstep.
//
// WCAG 1.4.1: every badge pairs a tint with a Lucide icon AND a text label —
// the label is always the source of truth, color is never the sole signal.
// Contrast: the -100/-800 Tailwind tint pairs (and text-secondary on muted) all
// exceed 4.5:1. (Raw tints reused from StepStatusBadge's established idiom;
// tokenizing them into a semantic status-chip set is tracked in gaps.md.)

import {
  Ban,
  CircleCheck,
  Compass,
  GraduationCap,
  PauseCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  MentorAvailability,
  MentorLifecycleStatus,
  ProfileStatus,
} from "@/lib/types";

// ── Lifecycle status ────────────────────────────────────────────────────────

/** Progression order — drives Status-column sorting (NOT alphabetical). */
export const STATUS_ORDER: MentorLifecycleStatus[] = [
  "in-training",
  "guided",
  "active",
  "paused",
  "deactivated",
];

export const STATUS_BADGE: Record<
  MentorLifecycleStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  // in-progress tones (sky → indigo read as "advancing")
  "in-training": {
    label: "In Training",
    icon: GraduationCap,
    className: "bg-sky-100 text-sky-800",
  },
  guided: {
    label: "Guided",
    icon: Compass,
    className: "bg-indigo-100 text-indigo-800",
  },
  // positive
  active: {
    label: "Active",
    icon: CircleCheck,
    className: "bg-emerald-100 text-emerald-800",
  },
  // muted/warning
  paused: {
    label: "Paused",
    icon: PauseCircle,
    className: "bg-amber-100 text-amber-800",
  },
  // neutral-off
  deactivated: {
    label: "Deactivated",
    icon: Ban,
    className: "bg-muted text-[var(--text-secondary)]",
  },
};

export const STATUS_LABELS: Record<MentorLifecycleStatus, string> =
  Object.fromEntries(
    STATUS_ORDER.map((s) => [s, STATUS_BADGE[s].label])
  ) as Record<MentorLifecycleStatus, string>;

/** Sort rank for a lifecycle status (lifecycle order). */
export const statusRank = (s: MentorLifecycleStatus): number =>
  STATUS_ORDER.indexOf(s);

/** Only these statuses can take mentees → the only ones with an availability. */
export const canMentor = (s: MentorLifecycleStatus): boolean =>
  s === "guided" || s === "active";

// ── Availability axis ─────────────────────────────────────────────────────────

export const AVAILABILITY_ORDER: MentorAvailability[] = [
  "accepting",
  "full",
  "not-accepting",
];

export const AVAILABILITY_LABELS: Record<MentorAvailability, string> = {
  accepting: "Accepting",
  full: "Full",
  "not-accepting": "Not accepting",
};

/**
 * Resolve a mentor's availability from their lifecycle status + caseload.
 * Returns null when availability is not applicable (in-training/paused/
 * deactivated) — the cell renders a muted "—".
 *
 * `count`/`cap` MUST come from the same source as the Caseload cell
 * (menteeCountFor / caseloadTotalFor in roster.tsx) so the two columns agree.
 */
export function availabilityFor(
  status: MentorLifecycleStatus,
  count: number,
  cap: number,
  accepting: boolean
): MentorAvailability | null {
  if (!canMentor(status)) return null;
  // "Full" is DERIVED from the caseload and wins over the stored intent: a record
  // marked "Accepting" that is already at cap surfaces as Full, keeping the
  // Availability cell consistent with the Caseload cell (count/cap). This is the
  // one intentional inconsistency between stored intent and displayed state.
  if (count >= cap) return "full";
  return accepting ? "accepting" : "not-accepting";
}

/** Sort rank for availability — n/a (null) sorts last. */
export const availabilityRank = (a: MentorAvailability | null): number =>
  a === null ? AVAILABILITY_ORDER.length : AVAILABILITY_ORDER.indexOf(a);

// ── Live (store-backed) mentor ────────────────────────────────────────────────

/**
 * Derive the lifecycle status for the one store-backed "live" mentor from the
 * existing store axes (onboarding `status` + `accountStatus` + `profileHidden`),
 * so the roster and the record page agree without a new persisted field.
 *
 * Note: "guided" has no store source — it is demo/showcase-only for now.
 */
export function liveLifecycle(
  status: ProfileStatus,
  accountStatus: "active" | "deactivated",
  profileHidden: boolean
): MentorLifecycleStatus {
  if (accountStatus === "deactivated") return "deactivated";
  if (status !== "published") return "in-training"; // invited/pending/in_review/rejected
  if (profileHidden) return "paused"; // published but hidden from teens
  return "active";
}
