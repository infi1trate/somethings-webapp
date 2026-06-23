import type { ComponentType } from "react";
import { VerifyStep } from "@/components/onboarding/steps/verify";
import { RegisterStep } from "@/components/onboarding/steps/register";
import { ConfirmStep } from "@/components/onboarding/steps/confirm";
import { ProfilePhotoStep } from "@/components/onboarding/steps/profile-photo";
import { NicknameStep } from "@/components/onboarding/steps/nickname";
import { BioStep } from "@/components/onboarding/steps/bio";
import { SpotifyStep } from "@/components/onboarding/steps/spotify";
import { MediaStep } from "@/components/onboarding/steps/media";
import { LanguagesStep } from "@/components/onboarding/steps/chip-steps";
import { VibeStep } from "@/components/onboarding/steps/vibe";
import { InterestsStep } from "@/components/onboarding/steps/interests";

export const STEP_COMPONENTS: Record<string, ComponentType> = {
  verify: VerifyStep,
  register: RegisterStep,
  confirm: ConfirmStep,
  "profile-photo": ProfilePhotoStep,
  nickname: NicknameStep,
  languages: LanguagesStep,
  bio: BioStep,
  spotify: SpotifyStep,
  media: MediaStep,
  vibe: VibeStep,
  interests: InterestsStep,
};
