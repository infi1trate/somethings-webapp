"use client";

import { useForm } from "react-hook-form";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { ImageGalleryUpload } from "@/components/onboarding/image-gallery-upload";
import { StepTips } from "@/components/onboarding/step-tips";
import { GALLERY_TIPS } from "@/lib/onboarding/guidance";
import { iconFor } from "@/lib/interest-icons";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";

export function PhotosStep() {
  const images = useOnboardingStore((s) => s.draft.additionalImages);
  const interests = useOnboardingStore((s) => s.draft.interests);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, optional, goNext, goBack } = useOnboardingNav();

  const form = useForm();

  return (
    <StepScaffold
      form={form}
      onSubmit={() => goNext()}
      title="Show what you're into"
      subtitle="Add photos of you actually doing the things you love — we'll suggest an interest tag for each, so teens can picture hanging out with you."
      canGoBack={canGoBack}
      onBack={goBack}
      optional={optional}
      onSkip={() => goNext()}
    >
      {interests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your interests
          </p>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((interest) => {
              const Icon = iconFor(interest);
              return (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <Icon className="size-3.5" />
                  {interest}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <ImageGalleryUpload
        value={images}
        onChange={(imgs) => update({ additionalImages: imgs })}
        selected={interests}
        max={6}
      />
      <p className="text-xs text-muted-foreground">
        Up to 6 photos · swipe through · tap a tag to change it.
      </p>
      <StepTips dos={GALLERY_TIPS.dos} donts={GALLERY_TIPS.donts} />
    </StepScaffold>
  );
}
