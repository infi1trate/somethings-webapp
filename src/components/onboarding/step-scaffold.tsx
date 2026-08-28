"use client";

import { type FieldValues, type UseFormReturn } from "react-hook-form";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SectionDoodle } from "@/components/doodles";
import { ChangeNoteCard } from "@/components/onboarding/change-note-card";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { requestsForStep } from "@/lib/onboarding/change-requests";

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
  const { section, index, current } = useOnboardingNav();
  const status = useOnboardingStore((s) => s.status);
  const changeRequests = useOnboardingStore((s) => s.changeRequests);
  const draft = useOnboardingStore((s) => s.draft);
  // The reviewer's note(s) for THIS step live in the left panel — affected steps
  // only. Steps with no request render nothing (silence is correct).
  const stepRequests =
    status === "rejected" ? requestsForStep(changeRequests, current) : [];

  return (
    // No per-step enter animation here — the wizard cross-fades between steps
    // via the View Transitions API, so the content must be fully opaque when the
    // transition snapshots it.
    <div className="flex flex-1 flex-col">
      {/* Reviewer note(s) for THIS step — a full-width banner at the top of the
          step (affected steps only; silence is correct otherwise). */}
      {stepRequests.length > 0 && (
        <div className="mb-6 space-y-3">
          {stepRequests.map((req) => (
            <ChangeNoteCard key={req.id} req={req} draft={draft} />
          ))}
        </div>
      )}

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

          {/* ═══ THE CTA NO LONGER SITS UNDER THE PREVIEW PILL ═══
              
              RC-5's reference case. `onboarding-layout.tsx` pins a preview pill
              at the bottom below `lg`, and this row ended the form with a bare
              `mt-10` and no bottom reservation — so the primary CTA of every
              wizard step was partly or wholly under it. SC 2.4.11 (Focus Not
              Obscured) fails the moment a keyboard user tabs to Continue.
              
              The reservation is the pill's own height (a 44px control in `p-4`,
              so ~76px) plus the safe-area inset, and it applies only below `lg`
              because that is exactly where the pill renders. `scroll-margin-bottom`
              is the other half: it makes the browser's own scroll-into-view keep
              that space clear when focus lands here, which padding alone does
              not do. */}
          <div
            className={cn(
              "mt-10 flex items-center gap-3",
              "[margin-bottom:calc(76px+env(safe-area-inset-bottom,0px))]",
              "[scroll-margin-bottom:calc(92px+env(safe-area-inset-bottom,0px))]",
              "lg:[margin-bottom:0] lg:[scroll-margin-bottom:0]"
            )}
          >
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
