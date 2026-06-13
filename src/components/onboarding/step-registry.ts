import type { ComponentType } from "react";
import { RegisterStep } from "@/components/onboarding/steps/register";
import { ConfirmStep } from "@/components/onboarding/steps/confirm";
import { ProfilePhotoStep } from "@/components/onboarding/steps/profile-photo";
import { NicknameStep } from "@/components/onboarding/steps/nickname";
import { BioStep } from "@/components/onboarding/steps/bio";
import { SpotifyStep } from "@/components/onboarding/steps/spotify";
import { MediaStep } from "@/components/onboarding/steps/media";
import { PhotosStep } from "@/components/onboarding/steps/photos";
import { MessagesStep } from "@/components/onboarding/steps/messages";
import { ScheduleStep } from "@/components/onboarding/steps/schedule";
import {
  PronounsStep,
  LanguagesStep,
  LifeExperienceStep,
  InterestsStep,
} from "@/components/onboarding/steps/chip-steps";

export const STEP_COMPONENTS: Record<string, ComponentType> = {
  register: RegisterStep,
  confirm: ConfirmStep,
  "profile-photo": ProfilePhotoStep,
  nickname: NicknameStep,
  pronouns: PronounsStep,
  languages: LanguagesStep,
  bio: BioStep,
  spotify: SpotifyStep,
  media: MediaStep,
  "life-experience": LifeExperienceStep,
  interests: InterestsStep,
  photos: PhotosStep,
  messages: MessagesStep,
  schedule: ScheduleStep,
};
