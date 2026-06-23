"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { toast } from "sonner";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
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
      title="First, enter your code"
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
            {/* The title + subtitle already name the field; keep an accessible
                label for screen readers without repeating it visually. */}
            <FormLabel className="sr-only">Verification code</FormLabel>
            <FormControl>
              <InputOTP
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern={REGEXP_ONLY_DIGITS}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Resend sits with the Verify CTA (the scaffold's footer) on the right. */}
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={resend}>
          Resend code
        </Button>
      </div>
    </StepScaffold>
  );
}
