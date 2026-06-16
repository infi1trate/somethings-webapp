"use client";

import { ChipsStep } from "@/components/onboarding/steps/chips-step";
import { PRONOUN_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/options";

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