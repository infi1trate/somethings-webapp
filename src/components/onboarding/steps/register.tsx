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
import { firstUnaddressed } from "@/lib/onboarding/change-requests";

// New invitee — create a password to finish setting up the account.
const setupSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "These don't match yet.",
  });
type SetupValues = z.infer<typeof setupSchema>;

// Returning mentor — log back in with email + password.
const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});
type LoginValues = z.infer<typeof loginSchema>;

export function RegisterStep() {
  // A returning mentor already has an account (they've submitted at least once —
  // in review, sent back for changes, or published), so they log in. A brand-new
  // invitee sets a password to create their account.
  const status = useOnboardingStore((s) => s.status);
  const returning =
    status === "in_review" || status === "rejected" || status === "published";
  return returning ? <LoginView /> : <SetupView />;
}

function SetupView() {
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, goNext, goBack } = useOnboardingNav();

  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
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

function LoginView() {
  const draft = useOnboardingStore((s) => s.draft);
  const changeRequests = useOnboardingStore((s) => s.changeRequests);
  const markComplete = useOnboardingStore((s) => s.markComplete);
  const { goNext, goBack, goTo } = useOnboardingNav();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: draft.email || "", password: "" },
  });

  return (
    <StepScaffold
      form={form}
      onSubmit={() => {
        markComplete("register");
        // Land where they're needed: the first UNADDRESSED change if the team
        // sent any back, otherwise just continue into the flow.
        const target =
          firstUnaddressed(changeRequests, draft) ?? changeRequests[0];
        if (target) goTo(target.stepId);
        else goNext();
      }}
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      continueLabel="Log in"
      canGoBack={false}
      onBack={goBack}
    >
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type="email" autoComplete="email" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input
                type="password"
                autoComplete="current-password"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </StepScaffold>
  );
}
