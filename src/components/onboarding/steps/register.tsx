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

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "These don't match yet.",
  });

type Values = z.infer<typeof schema>;

export function RegisterStep() {
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, goNext, goBack } = useOnboardingNav();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  return (
    <StepScaffold
      form={form}
      onSubmit={(v) => {
        update({ password: v.password });
        goNext();
      }}
      title="Set up your account"
      subtitle="Create a password so you can sign back in and pick up where you left off."
      continueLabel="Create account"
      canGoBack={canGoBack}
      onBack={goBack}
    >
      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input type="password" autoComplete="new-password" {...field} />
            </FormControl>
            <FormDescription>At least 8 characters.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="confirm"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm password</FormLabel>
            <FormControl>
              <Input type="password" autoComplete="new-password" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </StepScaffold>
  );
}
