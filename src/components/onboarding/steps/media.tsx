"use client";

import { useForm } from "react-hook-form";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { MediaIntroField } from "@/components/onboarding/media-intro-field";
import { GuidanceCard } from "@/components/onboarding/guidance-card";
import { IntroExamplesModal } from "@/components/onboarding/intro-examples-modal";
import { INTRO_FRAMEWORK } from "@/lib/onboarding/guidance";
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
      subtitle="Hearing a real voice lands differently than text. This is optional, but teens love it."
      canGoBack={canGoBack}
      onBack={goBack}
      optional={optional}
      onSkip={() => goNext()}
    >
      <MediaIntroField value={media} onChange={(m) => update({ media: m })} />
      {/* Script guide — the most useful element here, so it stays. Now on the
          shared guidance surface; the numerals moved brand/70 → foreground/70
          for WCAG AA (brand orange on muted was ~2.8:1). */}
      <GuidanceCard label={INTRO_FRAMEWORK.eyebrow}>
        <ol className="space-y-1">
          {INTRO_FRAMEWORK.beats.map((beat, i) => (
            <li
              key={beat}
              className="flex gap-2.5 text-[13px] leading-snug text-foreground/80"
            >
              <span className="mt-px text-xs font-semibold tabular-nums text-foreground/70">
                {i + 1}
              </span>
              <span>{beat}</span>
            </li>
          ))}
        </ol>
        <p className="mt-1.5 text-xs text-foreground/70">{INTRO_FRAMEWORK.note}</p>
      </GuidanceCard>
      {/* Opt-in progressive disclosure — kept off the main screen so it never
          competes with Record as the primary action. -mt pulls it up to hug the
          script guide (the scaffold's space-y-5 would otherwise detach it). */}
      <div className="-mt-3.5">
        <IntroExamplesModal />
      </div>
    </StepScaffold>
  );
}
