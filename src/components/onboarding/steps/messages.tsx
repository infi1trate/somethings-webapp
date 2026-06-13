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

const schema = z.object({
  online: z.string().trim().min(1, "Add a quick hello.").max(240),
  offline: z.string().trim().min(1, "Add an away message.").max(240),
});

type Values = z.infer<typeof schema>;

export function MessagesStep() {
  const draft = useOnboardingStore((s) => s.draft);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, goNext, goBack } = useOnboardingNav();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      online: draft.messages.online,
      offline: draft.messages.offline,
    },
  });

  useDraftSync(form.control, (v) => ({
    messages: { online: v.online, offline: v.offline },
  }));

  return (
    <StepScaffold
      form={form}
      onSubmit={(v) => {
        update({ messages: { online: v.online, offline: v.offline } });
        goNext();
      }}
      title="Set your auto-messages"
      subtitle="These send for you — a warm hello when you're around, and a heads-up when you're not."
      canGoBack={canGoBack}
      onBack={goBack}
    >
      <FormField
        control={form.control}
        name="online"
        render={({ field }) => (
          <FormItem>
            <FormLabel>When you&apos;re online</FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                maxLength={240}
                placeholder="Hey! Glad you're here. What's on your mind today?"
                {...field}
              />
            </FormControl>
            <FormDescription>Sent when a teen first messages you.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="offline"
        render={({ field }) => (
          <FormItem>
            <FormLabel>When you&apos;re away</FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                maxLength={240}
                placeholder="I'm offline right now but I'll get back to you soon — promise."
                {...field}
              />
            </FormControl>
            <FormDescription>Sets expectations so no one&apos;s left waiting.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </StepScaffold>
  );
}
