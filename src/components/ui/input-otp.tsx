"use client";

// Accessible segmented code input. Built on `input-otp`: a single real <input>
// sits behind the visual slots, so screen readers and autofill treat it as one
// "one-time-code" field (not six disconnected digit boxes), while sighted users
// get the boxed look. Slots here are styled as SEPARATE rounded boxes (with
// gaps) rather than the connected shadcn default.

import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { cn } from "@/lib/utils";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-2 sm:gap-2.5", className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & { index: number }) {
  const context = React.useContext(OTPInputContext);
  const slot = context?.slots[index];
  return (
    <div
      data-slot="input-otp-slot"
      data-active={slot?.isActive}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-xl border bg-card text-lg font-semibold text-foreground outline-none transition-all sm:size-12",
        slot?.isActive
          ? "z-10 border-foreground ring-2 ring-ring/40"
          : "border-border",
        className
      )}
      {...props}
    >
      {slot?.char}
      {slot?.hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px bg-foreground motion-safe:animate-pulse" />
        </div>
      )}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
