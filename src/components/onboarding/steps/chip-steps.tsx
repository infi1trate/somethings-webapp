"use client";

import { ChipsStep } from "@/components/onboarding/steps/chips-step";
import { LANGUAGE_OPTIONS } from "@/lib/options";

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