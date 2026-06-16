// The ordered list of onboarding steps, mapped straight from the "Mentor Setup"
// workflow diagram. Pure data — the slug -> component mapping lives in
// components/onboarding/stepRegistry.ts so this stays importable anywhere.

export type StepSection = "Account" | "About you" | "Your profile";

export interface StepMeta {
  slug: string;
  section: StepSection;
  /** Whether this step can be skipped without blocking submission. */
  optional?: boolean;
}

export const STEP_ORDER: StepMeta[] = [
  { slug: "register", section: "Account" },

  // Name / DOB / email / phone / sex / race are pulled from the database and
  // confirmed (and editable) on one screen — see steps/confirm.tsx.
  { slug: "confirm", section: "About you" },

  { slug: "profile-photo", section: "Your profile", optional: true },
  { slug: "nickname", section: "Your profile", optional: true },
  { slug: "pronouns", section: "Your profile" },
  { slug: "languages", section: "Your profile" },
  { slug: "bio", section: "Your profile" },
  { slug: "spotify", section: "Your profile", optional: true },
  { slug: "media", section: "Your profile", optional: true },
  { slug: "interests", section: "Your profile" },
];

export const FIRST_STEP = STEP_ORDER[0].slug;
export const PREVIEW_PATH = "/onboarding/preview";
export const SUBMITTED_PATH = "/onboarding/submitted";

export function stepIndex(slug: string): number {
  return STEP_ORDER.findIndex((s) => s.slug === slug);
}

export function getStep(slug: string): StepMeta | undefined {
  return STEP_ORDER.find((s) => s.slug === slug);
}

/** Profile-builder steps reviewers send mentors back to on rejection. */
export const REJECTION_RETURN_STEP = "bio";
