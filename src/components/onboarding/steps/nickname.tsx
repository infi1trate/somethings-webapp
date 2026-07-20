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
import { Input } from "@/components/ui/input";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { useDraftSync } from "@/lib/onboarding/use-live-sync";

const schema = z.object({
  displayName: z.string().trim().max(30, "Keep it under 30 characters."),
});

type Values = z.infer<typeof schema>;

export function NicknameStep() {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, optional, goNext, goBack } = useOnboardingNav();

  // Prefill the display name from the invite (their first name) so it isn't
  // blank — the mentor can change it. Falls back to any name already saved.
  const defaultName = draft.displayName || draft.firstName;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: defaultName },
  });

  useDraftSync(form.control, (v) => ({ displayName: v.displayName }));

  const save = (v: Values) => {
    update(v);
    goNext();
  };

  return (
    <StepScaffold
      form={form}
      onSubmit={save}
      title="What should teens call you?"
      subtitle="This is the name on your profile. Most mentors go by a first name or a nickname."
      canGoBack={canGoBack}
      onBack={goBack}
      optional={optional}
      onSkip={() => save({ displayName: defaultName })}
    >
      <FormField
        control={form.control}
        name="displayName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Display name</FormLabel>
            <FormControl>
              <Input placeholder={draft.firstName || "e.g. Jordan"} {...field} />
            </FormControl>
            <FormDescription>You can change this anytime.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </StepScaffold>
  );
}
