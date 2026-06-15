"use client";

import { useForm } from "react-hook-form";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { ImageGalleryUpload } from "@/components/onboarding/image-gallery-upload";
import { StepTips } from "@/components/onboarding/step-tips";
import { GALLERY_TIPS } from "@/lib/onboarding/guidance";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";

export function PhotosStep() {
  const images = useOnboardingStore((s) => s.draft.additionalImages);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, optional, goNext, goBack } = useOnboardingNav();

  const form = useForm();

  return (
    <StepScaffold
      form={form}
      onSubmit={() => goNext()}
      title="Add a few photos"
      subtitle="Everyday shots work best — hobbies, pets, where you hang out. They show up as a little gallery on your profile."
      canGoBack={canGoBack}
      onBack={goBack}
      optional={optional}
      onSkip={() => goNext()}
    >
      <ImageGalleryUpload
        value={images}
        onChange={(imgs) => update({ additionalImages: imgs })}
        max={6}
      />
      <p className="text-xs text-muted-foreground">Up to 6 photos.</p>
      <StepTips dos={GALLERY_TIPS.dos} donts={GALLERY_TIPS.donts} />
    </StepScaffold>
  );
}
