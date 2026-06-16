"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { InterestsDeckField } from "@/components/onboarding/interests-deck-field";
import { StepTips } from "@/components/onboarding/step-tips";
import { GALLERY_TIPS } from "@/lib/onboarding/guidance";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { useDraftSync } from "@/lib/onboarding/use-live-sync";

const MIN_INTERESTS = 3;
const MIN_PHOTOS = 3;

const schema = z.object({
  interests: z
    .array(z.object({ name: z.string(), photo: z.string().nullable() }))
    .min(MIN_INTERESTS, `Pick at least ${MIN_INTERESTS} interests.`)
    .refine((arr) => arr.filter((e) => e.photo).length >= MIN_PHOTOS, {
      message: `Add a photo to at least ${MIN_PHOTOS} of them — it's what teens connect with.`,
    }),
});
type Values = z.infer<typeof schema>;

export function InterestsStep() {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, goNext, goBack } = useOnboardingNav();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { interests: draft.interests },
  });

  useDraftSync(form.control, (v) => ({ interests: v.interests }));

  return (
    <StepScaffold
      form={form}
      onSubmit={(v) => {
        update({ interests: v.interests });
        goNext();
      }}
      title="What are you into?"
      subtitle="Pick a few, then add a photo of you actually doing each — it's what makes teens go “same!” and reach out."
      canGoBack={canGoBack}
      onBack={goBack}
    >
      <FormField
        control={form.control}
        name="interests"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <InterestsDeckField
                value={field.value}
                onChange={field.onChange}
                photosNeeded={MIN_PHOTOS}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <StepTips dos={GALLERY_TIPS.dos} donts={GALLERY_TIPS.donts} />
    </StepScaffold>
  );
}
