"use client";

import { type FieldValues, type UseFormReturn } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SectionDoodle } from "@/components/doodles";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";

interface StepScaffoldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  onSubmit: (values: T) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  continueLabel?: string;
  canGoBack: boolean;
  onBack: () => void;
  optional?: boolean;
  onSkip?: () => void;
}

export function StepScaffold<T extends FieldValues>({
  form,
  onSubmit,
  title,
  subtitle,
  children,
  continueLabel = "Continue",
  canGoBack,
  onBack,
  optional,
  onSkip,
}: StepScaffoldProps<T>) {
  const { section, index } = useOnboardingNav();

  return (
    <div
      key={index}
      className="flex flex-1 flex-col animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="mb-7 space-y-4">
        <SectionDoodle section={section} seed={index} />
        <div className="space-y-2">
          <h1 className="text-[27px] font-semibold leading-[1.12] tracking-tight text-balance">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[15px] leading-relaxed text-muted-foreground text-pretty">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col"
        >
          <div className="flex-1 space-y-5">{children}</div>

          <div className="mt-10 flex items-center gap-3">
            {canGoBack && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onBack}
                aria-label="Go back"
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <div className="flex-1" />
            {optional && onSkip && (
              <Button type="button" variant="ghost" onClick={onSkip}>
                Skip for now
              </Button>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {continueLabel}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
