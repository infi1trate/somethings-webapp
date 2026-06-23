"use client";

// Placeholder module for the four non-profile hub steps (Story, Training,
// Scheduling, Away messages). The real flows arrive later; for now each is
// completable so every hub state — mid-progress and fully-activated — is real.

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { StepStatusBadge } from "@/components/onboarding/hub/step-status-badge";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { HUB_STEPS, HUB_STEP_KEYS } from "@/lib/onboarding/hub";
import type { HubStepKey } from "@/lib/types";

export default function HubStepPage() {
  const mounted = useMounted();
  const router = useRouter();
  const params = useParams<{ step: string }>();
  const stepParam = params?.step;
  const isValid =
    !!stepParam && (HUB_STEP_KEYS as string[]).includes(stepParam);
  const key = stepParam as HubStepKey;

  const hubSteps = useOnboardingStore((s) => s.hubSteps);
  const setHubStep = useOnboardingStore((s) => s.setHubStep);
  const state = isValid ? hubSteps[key] : "not_started";

  // Unknown slug → back to the hub.
  useEffect(() => {
    if (mounted && !isValid) router.replace("/hub");
  }, [mounted, isValid, router]);

  // Visiting a fresh step marks it in progress — never downgrades a done step.
  useEffect(() => {
    if (mounted && isValid && hubSteps[key] === "not_started") {
      setHubStep(key, "in_progress");
    }
  }, [mounted, isValid, key, hubSteps, setHubStep]);

  if (!mounted || !isValid) return <div className="min-h-dvh bg-background" />;

  const def = HUB_STEPS.find((s) => s.key === key)!;
  const isDone = state === "done";

  const complete = () => {
    setHubStep(key, "done");
    toast.success(`${def.label} complete`);
    router.push("/hub");
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-5">
          <Wordmark />
          <Button asChild variant="ghost" size="sm">
            <Link href="/hub">
              <ArrowLeft className="size-4" />
              Hub
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[27px] font-bold leading-tight tracking-tight">
            {def.label}
          </h1>
          <StepStatusBadge state={state} />
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground text-pretty">
          {def.blurb}
        </p>

        <div className="mt-6 rounded-2xl border border-dashed bg-card p-6 text-sm leading-relaxed text-muted-foreground">
          This module arrives in a later milestone. For now, you can mark it
          complete to keep moving through your setup.
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          {isDone ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800">
              <Check className="size-4" aria-hidden />
              Completed
            </span>
          ) : (
            <Button size="lg" onClick={complete}>
              <Check className="size-4" />
              Mark as complete
            </Button>
          )}
          <Button asChild variant="ghost" size="lg">
            <Link href="/hub">Back to hub</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
