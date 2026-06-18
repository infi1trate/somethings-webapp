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
  const meta = STEP_ORDER[index];

  // "Step X of Y" counts only real (non-interstitial) steps, so dropping an
  // intro screen into the flow doesn't leave a gap in the numbering.
  const total = STEP_ORDER.filter((s) => !s.interstitial).length;
  const displayIndex =
    STEP_ORDER.slice(0, index + 1).filter((s) => !s.interstitial).length - 1;

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
    /** Position among real steps, for the "Step X of Y" progress display. */
    displayIndex,
    total,
    section: meta.section,
    optional: !!meta.optional,
    interstitial: !!meta.interstitial,
    canGoBack: index > 0,
    isLast: index === STEP_ORDER.length - 1,
    goTo,
    goNext,
    goBack,
  };
}
