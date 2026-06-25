"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { toast } from "sonner";
import { SectionDoodle } from "@/components/doodles";
import {
  Form,
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
// A compact, self-contained layout (NOT StepScaffold) so the card hugs its
// content and Resend + Verify sit together on one row, per the mockup.
export function VerifyStep() {
  const phone = useOnboardingStore((s) => s.draft.phone);
  const { section, index, goNext } = useOnboardingNav();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  const resend = async () => {
    await sendVerificationCode(phone);
    toast.success("New code sent");
  };

  const onSubmit = async (v: Values) => {
    const res = await verifyCode(v.code);
    if (!res.ok) {
      form.setError("code", { message: "That code didn't match. Try again." });
      return;
    }
    goNext();
  };

  return (
    <div>
      <SectionDoodle section={section} seed={index} />
      <h1 className="mt-4 text-[27px] font-semibold leading-[1.12] tracking-tight text-balance">
        First, enter your code
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground text-pretty">
        We texted a 6-digit code to {maskPhone(phone)}. Enter it to keep going.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-7">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                {/* Title + subtitle already name the field; keep an accessible
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

          {/* Resend + Verify together, bottom-right (per the mockup). */}
          <div className="mt-8 flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={resend}>
              Resend code
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Verifying…" : "Verify"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
