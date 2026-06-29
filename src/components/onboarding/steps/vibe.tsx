"use client";

import { useForm } from "react-hook-form";
import { Sparkles } from "lucide-react";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { VibeBoardField } from "@/components/onboarding/vibe-board-field";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { useDraftSync } from "@/lib/onboarding/use-live-sync";
import { VIBE_CONTEXT } from "@/lib/onboarding/guidance";
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
      subtitle="The feeling of being around you — pulled straight from your camera roll. A few is plenty; screenshots and saves count."
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
      {/* Light, honest social proof — directional only (no invented numbers; see
          VIBE_CONTEXT). A quiet icon-led line below the board, NOT a boxed block:
          the step's framing now lives in the subtitle, so this isn't a second
          stacked text panel competing up top. */}
      <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-foreground/70">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
        {VIBE_CONTEXT.social}
      </p>
    </StepScaffold>
  );
}
