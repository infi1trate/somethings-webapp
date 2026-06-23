// Single source of truth for the onboarding HUB's state. The hub shows five
// steps; the Profile step's status is DERIVED from the app-wide ProfileStatus
// (so an in_review profile can never be edited, regardless of navigation), and
// the other four track explicit completion in the store. Keeping the rules here
// means the hub, the step cards, and the submit screen all read the same logic.

import type {
  HubStepKey,
  HubStepStatus,
  ProfileStatus,
  ProfileStepStatus,
} from "@/lib/types";

export type HubKey = "profile" | HubStepKey;

export interface HubStepDef {
  key: HubKey;
  label: string;
  /** One line of context shown under the step title. */
  blurb: string;
  /** Where the step's CTA goes. Profile → the review/preview screen; the others
   *  → their placeholder module under /hub. */
  href: string;
}

/** The four non-profile steps, in display order after Profile. */
export const HUB_STEP_KEYS: HubStepKey[] = [
  "story",
  "training",
  "scheduling",
  "away",
];

/** The five hub steps, in display order. Profile leads. */
export const HUB_STEPS: HubStepDef[] = [
  {
    key: "profile",
    label: "Profile",
    blurb: "The profile teens see — photo, bio, vibe, and interests.",
    href: "/onboarding/preview",
  },
  {
    key: "story",
    label: "Story",
    blurb: "Your intro slideshow — the first thing a matched teen sees.",
    href: "/hub/story",
  },
  {
    key: "training",
    label: "Training",
    blurb: "Short modules and practice simulations before you start.",
    href: "/hub/training",
  },
  {
    key: "scheduling",
    label: "Scheduling",
    blurb: "Block out time off and vacations against your set schedule.",
    href: "/hub/scheduling",
  },
  {
    key: "away",
    label: "Away messages",
    blurb: "Set your intro and off-hours auto-replies to teens.",
    href: "/hub/away",
  },
];

/** Fresh hub-step map — all four not started. Used by the store's initial state,
 *  reset, and the v7 migration backfill. */
export function emptyHubSteps(): Record<HubStepKey, HubStepStatus> {
  return {
    story: "not_started",
    training: "not_started",
    scheduling: "not_started",
    away: "not_started",
  };
}

/** Map the app-wide ProfileStatus onto the hub's Profile sub-state vocabulary.
 *  This is the ONLY place that translation happens. */
export function deriveProfileStepStatus(
  status: ProfileStatus,
  completed: string[]
): ProfileStepStatus {
  switch (status) {
    case "published":
      return "approved";
    case "in_review":
      return "in_review";
    case "rejected":
      return "returned";
    default:
      // invited | pending — "draft" once the mentor has started building.
      return status === "pending" || completed.length > 0
        ? "draft"
        : "not_started";
  }
}

export function isProfileStepDone(s: ProfileStepStatus): boolean {
  return s === "approved";
}

export function isHubStepDone(s: HubStepStatus): boolean {
  return s === "done";
}

export interface HubActivation {
  done: number;
  total: number;
  allDone: boolean;
  /** All five steps done AND the profile approved — the "you're live" gate. */
  activated: boolean;
}

/** Count completed steps and decide whether mentoring is unlocked. The Profile
 *  step only counts as done when approved, so `activated` === `allDone`. */
export function hubActivation(
  profileState: ProfileStepStatus,
  hubSteps: Record<HubStepKey, HubStepStatus>
): HubActivation {
  const total = HUB_STEP_KEYS.length + 1; // four steps + profile
  const stepsDone = HUB_STEP_KEYS.filter((k) => hubSteps[k] === "done").length;
  const profileDone = isProfileStepDone(profileState);
  const done = stepsDone + (profileDone ? 1 : 0);
  const allDone = done === total;
  return { done, total, allDone, activated: allDone && profileDone };
}
