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
  spotifyUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /open\.spotify\.com\//.test(v),
      "Paste a Spotify link (open.spotify.com/…)."
    ),
});

type Values = z.infer<typeof schema>;

export function SpotifyStep() {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, optional, goNext, goBack } = useOnboardingNav();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { spotifyUrl: draft.spotifyUrl },
  });

  useDraftSync(form.control, (v) => ({ spotifyUrl: v.spotifyUrl }));

  const save = (v: Values) => {
    update(v);
    goNext();
  };

  return (
    <StepScaffold
      form={form}
      onSubmit={save}
      title="Share what you're listening to"
      subtitle="A playlist or favorite artist gives teens an easy way in. Totally optional."
      canGoBack={canGoBack}
      onBack={goBack}
      optional={optional}
      onSkip={() => save({ spotifyUrl: draft.spotifyUrl })}
    >
      <FormField
        control={form.control}
        name="spotifyUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Spotify link</FormLabel>
            <FormControl>
              <Input
                inputMode="url"
                placeholder="https://open.spotify.com/playlist/…"
                {...field}
              />
            </FormControl>
            <FormDescription>A playlist, artist, or song — a current favorite is perfect.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </StepScaffold>
  );
}
