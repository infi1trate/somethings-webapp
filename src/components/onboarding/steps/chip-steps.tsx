"use client";

import { ChipsStep } from "@/components/onboarding/steps/chips-step";
import {
  PRONOUN_OPTIONS,
  LANGUAGE_OPTIONS,
  LIFE_EXPERIENCE_OPTIONS,
  INTEREST_OPTIONS,
} from "@/lib/options";

export function PronounsStep() {
  return (
    <ChipsStep
      fieldKey="pronouns"
      title="Which pronouns are yours?"
      subtitle="These show on your profile. Pick all that fit."
      options={PRONOUN_OPTIONS}
      min={1}
      minMessage="Pick at least one."
    />
  );
}

export function LanguagesStep() {
  return (
    <ChipsStep
      fieldKey="languages"
      title="What languages can you mentor in?"
      subtitle="We'll match you with teens you can talk to comfortably."
      options={LANGUAGE_OPTIONS}
      min={1}
      minMessage="Pick at least one."
    />
  );
}

export function LifeExperienceStep() {
  return (
    <ChipsStep
      fieldKey="lifeExperiences"
      title="What have you been through that you could help with?"
      subtitle="Teens often look for someone who gets it. Choose what you're comfortable speaking to — no need to share details here."
      options={LIFE_EXPERIENCE_OPTIONS}
      min={1}
      minMessage="Pick at least one you'd feel okay supporting."
    />
  );
}

export function InterestsStep() {
  return (
    <ChipsStep
      fieldKey="interests"
      title="What are you into?"
      subtitle="Shared interests make the first conversation way easier. Pick a few."
      options={INTEREST_OPTIONS}
      min={3}
      max={8}
      minMessage="Pick at least 3."
      hint="Choose 3–8."
    />
  );
}
