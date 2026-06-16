"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { useDraftSync } from "@/lib/onboarding/use-live-sync";
import { CyclingExamples } from "@/components/onboarding/cycling-examples";
import { BIO_EXAMPLES } from "@/lib/onboarding/guidance";

const schema = z.object({
  bio: z
    .string()
    .trim()
    .min(1, "Add a short bio so teens can get to know you."),
});

type Values = z.infer<typeof schema>;

export function BioStep() {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, goNext, goBack } = useOnboardingNav();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { bio: draft.bio },
  });

  useDraftSync(form.control, (v) => ({ bio: v.bio }));

  return (
    <StepScaffold
      form={form}
      onSubmit={(v) => {
        update(v);
        goNext();
      }}
      title="Tell teens a bit about you"
      subtitle="Keep it real and easygoing — like how you'd introduce yourself to someone new."
      canGoBack={canGoBack}
      onBack={goBack}
    >
      <FormField
        control={form.control}
        name="bio"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Short bio</FormLabel>
            <FormControl>
              <Textarea
                rows={6}
                placeholder="What you're about, what you like talking about, why you wanted to mentor…"
                {...field}
              />
            </FormControl>
            <FormDescription>
              Around two sentences is the sweet spot — no pressure to be
              polished.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <CyclingExamples label="Need a starting point?" items={BIO_EXAMPLES} />
    </StepScaffold>
  );
}
