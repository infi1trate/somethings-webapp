"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { Moodie } from "@/components/doodles";
import { StatusBadge } from "@/components/onboarding/status-badge";
import { StepCard } from "@/components/onboarding/hub/step-card";
import { HubWelcomeModal } from "@/components/onboarding/hub/hub-welcome-modal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import {
  HUB_STEPS,
  deriveProfileStepStatus,
  hubActivation,
} from "@/lib/onboarding/hub";

export default function HubPage() {
  const mounted = useMounted();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const completed = useOnboardingStore((s) => s.completed);
  const hubSteps = useOnboardingStore((s) => s.hubSteps);
  const everPublished = useOnboardingStore((s) => s.publishedSnapshot !== null);

  // Published mentors belong in the mentor app (Settings), not the setup hub.
  useEffect(() => {
    if (mounted && everPublished) router.replace("/app");
  }, [mounted, everPublished, router]);

  if (!mounted || everPublished) {
    return <div className="min-h-dvh bg-background" />;
  }

  const profileState = deriveProfileStepStatus(status, completed);
  const { done, total, activated } = hubActivation(profileState, hubSteps);
  const firstName = draft.firstName?.trim();
  const pct = Math.round((done / total) * 100);

  // The Profile step routes by state (build in the wizard vs. view/edit the
  // submission); the other four route to their module under /hub.
  const steps = HUB_STEPS.map((def) => {
    if (def.key === "profile") {
      const href =
        profileState === "not_started" || profileState === "draft"
          ? "/onboarding"
          : "/onboarding/preview";
      return { ...def, state: profileState, href };
    }
    return { ...def, state: hubSteps[def.key], href: def.href };
  });

  return (
    <div className="min-h-dvh bg-background">
      <HubWelcomeModal />
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-5">
          <Wordmark />
          <StatusBadge status={status} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-10">
        <h1 className="text-[27px] font-bold leading-tight tracking-tight text-balance">
          Welcome back{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground text-pretty">
          {activated
            ? "You're all set up — here's everything you completed."
            : "Five steps to go before you can start mentoring. Do them in any order."}
        </p>

        {activated ? (
          <LiveBanner />
        ) : (
          // Activation summary — kept above the fold so "why can't I start yet?"
          // is never a question.
          <section
            aria-label="Setup progress"
            className="mt-6 rounded-2xl border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-sm font-bold tracking-tight">
                Your setup
              </span>
              <span className="text-sm font-medium text-foreground">
                {done} of {total} done
              </span>
            </div>
            <Progress value={pct} className="mt-3 h-2" />
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              Mentoring unlocks once all {total} steps are done and your profile
              is approved.
            </p>
          </section>
        )}

        {activated ? (
          // The list recedes once you're live, but stays reachable for revisits.
          <details className="group mt-6 rounded-2xl border bg-card p-5">
            <summary className="flex min-h-9 cursor-pointer items-center font-display text-sm font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
              Your {total} steps — all complete
            </summary>
            <ul className="mt-4 space-y-3">
              {steps.map((s) => (
                <li key={s.key}>
                  <StepCard
                    label={s.label}
                    blurb={s.blurb}
                    state={s.state}
                    href={s.href}
                  />
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <ul className="mt-6 space-y-3">
            {steps.map((s) => (
              <li key={s.key}>
                <StepCard
                  label={s.label}
                  blurb={s.blurb}
                  state={s.state}
                  href={s.href}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function LiveBanner() {
  return (
    <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8">
      <span className="mx-auto mb-3 flex size-16 items-center justify-center rounded-3xl bg-emerald-100">
        <Moodie name="face-excited" className="size-11" />
      </span>
      <h2 className="font-display text-2xl font-bold tracking-tight text-emerald-900">
        You&apos;re live — you can start mentoring
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-800">
        All five steps are done and your profile is approved. Teens can find and
        message you now.
      </p>
      <Button asChild size="lg" className="mt-5">
        <Link href="/app">Go to your mentor home</Link>
      </Button>
    </section>
  );
}
