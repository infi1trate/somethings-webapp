"use client";

import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import {
  MentorProfilePreview,
  type PreviewFocus,
} from "@/components/onboarding/mentor-profile-preview";
import { STEP_COMPONENTS } from "@/components/onboarding/step-registry";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

// Which region of the live profile each step is filling in. Drives the
// preview's zoom-to-focus; the account steps aren't on the profile, so they
// zoom out to the whole card.
const REGION_BY_STEP: Record<string, string> = {
  confirm: "identity",
  "profile-photo": "identity",
  nickname: "identity",
  pronouns: "identity",
  bio: "bio",
  interests: "interests",
  spotify: "spotify",
  media: "media",
  languages: "languages",
};

// Start zoomed in, then ease out over the flow to reveal the whole profile.
function focusFor(slug: string, index: number): PreviewFocus {
  const region = REGION_BY_STEP[slug] ?? "all";
  // Gentle zoom — blur/dim now carries the focus, so pans stay short & smooth.
  const zoom = Math.max(1.03, 1.12 - index * 0.01);
  return { region, zoom };
}

export function OnboardingWizard() {
  const mounted = useMounted();
  const { current, index, total, section } = useOnboardingNav();
  const draft = useOnboardingStore((s) => s.draft);

  // Gate on mount so the localStorage-backed draft doesn't cause a hydration
  // mismatch, and key the step so each one remounts with fresh form defaults.
  if (!mounted) {
    return (
      <OnboardingLayout>
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-brand" />
        </div>
      </OnboardingLayout>
    );
  }

  const StepComponent = STEP_COMPONENTS[current];

  // The account step has nothing to preview; everything else builds the profile,
  // so it gets the live phone preview alongside the inputs.
  // The phone reveals once the mentor starts building their public profile —
  // hidden through account setup AND the "Quick check" (DB basics) step.
  const showPreview = section !== "Account" && current !== "confirm";
  const preview = showPreview ? (
    <PhoneFrame>
      <MentorProfilePreview draft={draft} focus={focusFor(current, index)} />
    </PhoneFrame>
  ) : undefined;

  return (
    <OnboardingLayout progress={{ index, total, section }} preview={preview}>
      <StepComponent key={current} />
    </OnboardingLayout>
  );
}
