"use client";

import { useForm } from "react-hook-form";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { MediaIntroField } from "@/components/onboarding/media-intro-field";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";

export function MediaStep() {
  const media = useOnboardingStore((s) => s.draft.media);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, optional, goNext, goBack } = useOnboardingNav();

  // No validated fields — the upload writes straight to the draft.
  const form = useForm();

  return (
    <StepScaffold
      form={form}
      onSubmit={() => goNext()}
      title="Add a quick intro"
      subtitle="Hearing or seeing a real person lands differently than text. This is optional, but teens love it."
      canGoBack={canGoBack}
      onBack={goBack}
      optional={optional}
      onSkip={() => goNext()}
    >
      <MediaIntroField value={media} onChange={(m) => update({ media: m })} />
    </StepScaffold>
  );
}
