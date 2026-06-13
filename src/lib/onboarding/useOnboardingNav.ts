"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  STEP_ORDER,
  FIRST_STEP,
  PREVIEW_PATH,
  stepIndex,
  getStep,
} from "@/lib/onboarding/steps";
import { useOnboardingStore } from "@/lib/onboarding/store";

export function stepHref(slug: string) {
  return `/onboarding?step=${slug}`;
}

export function useOnboardingNav() {
  const router = useRouter();
  const params = useSearchParams();
  const markComplete = useOnboardingStore((s) => s.markComplete);

  const requested = params.get("step") ?? FIRST_STEP;
  const current = getStep(requested) ? requested : FIRST_STEP;
  const index = stepIndex(current);
  const total = STEP_ORDER.length;
  const meta = STEP_ORDER[index];

  const goTo = useCallback(
    (slug: string) => router.push(stepHref(slug)),
    [router]
  );

  const goNext = useCallback(() => {
    markComplete(current);
    const next = STEP_ORDER[index + 1];
    if (next) {
      router.push(stepHref(next.slug));
    } else {
      router.push(PREVIEW_PATH);
    }
  }, [router, index, current, markComplete]);

  const goBack = useCallback(() => {
    const prev = STEP_ORDER[index - 1];
    if (prev) router.push(stepHref(prev.slug));
  }, [router, index]);

  return {
    current,
    index,
    total,
    section: meta.section,
    optional: !!meta.optional,
    canGoBack: index > 0,
    isLast: index === total - 1,
    goTo,
    goNext,
    goBack,
  };
}
