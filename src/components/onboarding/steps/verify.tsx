"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { sendVerificationCode, verifyCode } from "@/lib/mock-api";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});
type Values = z.infer<typeof schema>;

// Show only the last 4 digits of the phone the code was texted to.
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "your phone";
}

// 2FA — new invitees verify a code texted to their phone before setting a
// password (the next step). Returning mentors skip this (handled in the wizard).
export function VerifyStep() {
  const phone = useOnboardingStore((s) => s.draft.phone);
  const { goNext, goBack } = useOnboardingNav();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  const resend = async () => {
    await sendVerificationCode(phone);
    toast.success("New code sent");
  };

  return (
    <StepScaffold
      form={form}
      onSubmit={async (v) => {
        const res = await verifyCode(v.code);
        if (!res.ok) {
          form.setError("code", {
            message: "That code didn't match. Try again.",
          });
          return;
        }
        goNext();
      }}
      title="Enter your code"
      subtitle={`We texted a 6-digit code to ${maskPhone(
        phone
      )}. Enter it to keep going.`}
      continueLabel="Verify"
      canGoBack={false}
      onBack={goBack}
    >
      <FormField
        control={form.control}
        name="code"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Verification code</FormLabel>
            <FormControl>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                className="text-center text-lg tracking-[0.4em]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <button
        type="button"
        onClick={resend}
        className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        Resend code
      </button>
    </StepScaffold>
  );
}
