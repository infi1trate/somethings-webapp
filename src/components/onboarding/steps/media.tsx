"use client";

import { useForm } from "react-hook-form";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { Sparkles } from "lucide-react";
import { MediaIntroField } from "@/components/onboarding/media-intro-field";
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
      <div className="space-y-1.5 rounded-xl border bg-muted/40 px-3.5 py-2.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-brand" />
          {INTRO_FRAMEWORK.eyebrow}
        </p>
        <ol className="space-y-1">
          {INTRO_FRAMEWORK.beats.map((beat, i) => (
            <li
              key={beat}
              className="flex gap-2.5 text-[13px] leading-snug text-foreground/80"
            >
              <span className="mt-px text-xs font-semibold tabular-nums text-brand/70">
                {i + 1}
              </span>
              <span>{beat}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground/80">{INTRO_FRAMEWORK.note}</p>
      </div>
    </StepScaffold>
  );
}
