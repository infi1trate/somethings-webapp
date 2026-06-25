"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import {
  MentorProfilePreview,
  type PreviewFocus,
} from "@/components/onboarding/mentor-profile-preview";
import { ExamplesIntro } from "@/components/onboarding/intro/examples-intro";
import { STEP_COMPONENTS } from "@/components/onboarding/step-registry";
import { STEP_ORDER, stepIndex, getStep } from "@/lib/onboarding/steps";
import { useOnboardingNav, stepHref } from "@/lib/onboarding/useOnboardingNav";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

// Which region of the live profile each step is filling in. Drives the
// preview's zoom-to-focus; the account steps aren't on the profile, so they
// zoom out to the whole card.
const REGION_BY_STEP: Record<string, string> = {
  confirm: "identity",
  "profile-photo": "identity",
  nickname: "identity",
  bio: "bio",
  interests: "interests",
  spotify: "spotify",
  media: "media",
  vibe: "vibe",
  languages: "languages",
};

// The "Step X of Y" stepper covers ONLY the profile-building steps and starts at
// the first one ("Add a profile photo") — Account + Quick check come before it
// with no counter.
const PROFILE_STEPS = STEP_ORDER.filter(
  (s) => s.section === "Your profile" && !s.interstitial
);

// Start zoomed in, then ease out over the flow to reveal the whole profile.
function focusFor(slug: string, index: number): PreviewFocus {
  const region = REGION_BY_STEP[slug] ?? "all";
  // Gentle zoom — blur/dim now carries the focus, so pans stay short & smooth.
  const zoom = Math.max(1.03, 1.12 - index * 0.01);
  return { region, zoom };
}

// Cross-fade between steps using the View Transitions API. We render a lagging
// `rendered` slug and only advance it to the live step inside a view
// transition's flushSync callback — that gives the browser a clean before/after
// snapshot to dissolve between. Falls back to an instant swap when the API is
// missing or the user prefers reduced motion.
function useStepCrossfade(current: string) {
  const [rendered, setRendered] = useState(current);

  useEffect(() => {
    if (current === rendered) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const startViewTransition = (
      document as unknown as {
        startViewTransition?: (cb: () => void) => unknown;
      }
    ).startViewTransition?.bind(document);

    if (startViewTransition && !prefersReduced) {
      const transition = startViewTransition(() => {
        flushSync(() => setRendered(current));
      }) as
        | { ready?: Promise<unknown>; finished?: Promise<unknown> }
        | undefined;
      // A newer step change aborts an in-flight transition; swallow the
      // resulting promise rejections so they don't surface as unhandled.
      transition?.ready?.catch?.(() => {});
      transition?.finished?.catch?.(() => {});
    } else {
      // No View Transitions API (or reduced motion): catch up immediately.
      // This sync is intentional and one-shot — the `current === rendered`
      // guard above keeps it from re-running — so the set-state-in-effect rule
      // is a false positive here. (The animated path advances the same state
      // inside the transition's flushSync callback.)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(current);
    }
  }, [current, rendered]);

  return rendered;
}

export function OnboardingWizard() {
  const mounted = useMounted();
  const nav = useOnboardingNav();
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const current = useStepCrossfade(nav.current);
  const router = useRouter();

  // Returning mentors (already have an account — submitted at least once) move
  // through the flow via the dock, not linearly: they skip the new-signup 2FA
  // step and get no stepper.
  const isReturning =
    status === "in_review" || status === "rejected" || status === "published";

  // 2FA is new-signups-only — bounce returning mentors off `verify` to login.
  useEffect(() => {
    if (mounted && current === "verify" && isReturning) {
      router.replace(stepHref("register"));
    }
  }, [mounted, current, isReturning, router]);

  // Gate on mount so the localStorage-backed draft doesn't cause a hydration
  // mismatch, and key the step so each one remounts with fresh form defaults.
  if (!mounted) {
    return (
      <OnboardingLayout>
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-brand" />
        </div>
      </OnboardingLayout>
    );
  }

  // The example-profiles intro is a full-bleed interstitial — it kicks off the
  // profile-building phase right after Quick check, so it renders on its own
  // rather than inside the step panel.
  if (current === "examples") {
    return <ExamplesIntro onBack={nav.goBack} onContinue={nav.goNext} />;
  }

  // Returning mentors don't see 2FA — the effect above redirects them to login;
  // render the loader for the frame it takes to replace the route.
  if (current === "verify" && isReturning) {
    return (
      <OnboardingLayout>
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-brand" />
        </div>
      </OnboardingLayout>
    );
  }

  const index = stepIndex(current);
  const section = getStep(current)!.section;
  const StepComponent = STEP_COMPONENTS[current];

  // Account setup and the "Quick check" (DB basics) screen are the warm "intro"
  // phase (Welcome-style background); everything from the profile build onward
  // uses the spray-corner "step" background.
  const phase =
    current === "verify" || current === "register" || current === "confirm"
      ? "intro"
      : "step";

  // The account step has nothing to preview; everything else builds the profile,
  // so it gets the live phone preview alongside the inputs.
  // The phone reveals once the mentor starts building their public profile —
  // hidden through account setup AND the "Quick check" (DB basics) step.
  const showPreview = section !== "Account" && current !== "confirm";
  const preview = showPreview ? (
    <PhoneFrame>
      <MentorProfilePreview draft={draft} focus={focusFor(current, index)} />
    </PhoneFrame>
  ) : undefined;

  // Stepper: only on the profile-building steps, numbered from the first one
  // ("Add a profile photo"); hidden on Account + Quick check, and for returning
  // mentors entirely.
  const profileIdx = PROFILE_STEPS.findIndex((s) => s.slug === current);
  const progress =
    !isReturning && profileIdx >= 0
      ? { index: profileIdx, total: PROFILE_STEPS.length, section }
      : undefined;

  return (
    <OnboardingLayout
      progress={progress}
      preview={preview}
      phase={phase}
      hideDock={current === "register"}
      hideStatus={current === "register" && isReturning}
    >
      <StepComponent key={current} />
    </OnboardingLayout>
  );
}
