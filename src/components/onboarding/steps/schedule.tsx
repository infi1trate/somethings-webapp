"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { StepScaffold } from "@/components/onboarding/step-scaffold";
import { ScheduleGrid } from "@/components/onboarding/schedule-grid";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingNav } from "@/lib/onboarding/useOnboardingNav";
import { WEEKDAYS } from "@/lib/types";

export function ScheduleStep() {
  const schedule = useOnboardingStore((s) => s.draft.schedule);
  const update = useOnboardingStore((s) => s.update);
  const { canGoBack, goNext, goBack } = useOnboardingNav();
  const [error, setError] = useState<string | null>(null);

  const form = useForm();

  const onContinue = () => {
    const enabled = WEEKDAYS.filter((d) => schedule[d].enabled);
    if (enabled.length === 0) {
      setError("Pick at least one window so teens know when to find you.");
      return;
    }
    if (enabled.some((d) => schedule[d].start >= schedule[d].end)) {
      setError("Check your times — a start time is after its end time.");
      return;
    }
    setError(null);
    goNext();
  };

  return (
    <StepScaffold
      form={form}
      onSubmit={onContinue}
      title="When are you usually free?"
      subtitle="Rough windows are fine — you can always update them. This just helps with matching and reminders."
      continueLabel="Review profile"
      canGoBack={canGoBack}
      onBack={goBack}
    >
      <ScheduleGrid
        value={schedule}
        onChange={(s) => {
          update({ schedule: s });
          if (error) setError(null);
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </StepScaffold>
  );
}
