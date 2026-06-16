"use client";

import { useForm } from "react-hook-form";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { VibeBoardField } from "@/components/onboarding/vibe-board-field";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { useDraftSync } from "@/lib/onboarding/use-live-sync";
import type { VibePhoto } from "@/lib/types";

type Values = { vibe: VibePhoto[] };

export function VibeStep() {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, optional, goNext, goBack } = useOnboardingNav();

  // No validation — vibe photos are invited, never required (keeps the fast
  // one-tap-ish on-ramp). "Done" (Continue) is always reachable.
  const form = useForm<Values>({ defaultValues: { vibe: draft.vibe ?? [] } });

  useDraftSync(form.control, (v) => ({ vibe: v.vibe }));

  return (
    <StepScaffold
      form={form}
      onSubmit={(v) => {
        update({ vibe: v.vibe });
        goNext();
      }}
      title="What's your vibe?"
      subtitle="The feeling of being around you — pulled from your camera roll. Answer a few in any order; screenshots and saves count. No pressure to fill every frame."
      canGoBack={canGoBack}
      onBack={goBack}
      optional={optional}
      onSkip={() => goNext()}
    >
      <FormField
        control={form.control}
        name="vibe"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <VibeBoardField value={field.value} onChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </StepScaffold>
  );
}
