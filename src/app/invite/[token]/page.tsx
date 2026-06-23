"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { DoodleScatter } from "@/components/doodles";
import { WelcomeIntro } from "@/components/onboarding/intro/welcome-intro";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  validateInvite,
  getInvitedProfile,
  type InviteInfo,
  type InvitedProfile,
} from "@/lib/mock-api";
import { FIRST_STEP } from "@/lib/onboarding/steps";
import { stepHref } from "@/lib/onboarding/useOnboardingNav";

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const acceptInvite = useOnboardingStore((s) => s.acceptInvite);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [profile, setProfile] = useState<InvitedProfile | null>(null);

  useEffect(() => {
    validateInvite(token).then(setInfo);
    getInvitedProfile(token).then(setProfile);
  }, [token]);

  const start = () => {
    if (profile) acceptInvite(profile);
    router.push(stepHref(FIRST_STEP));
  };

  // Checking / expired invite — quiet centered states on the brand wash.
  if (info === null || !info.valid) {
    return (
      <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] px-6 py-12">
        <DoodleScatter className="opacity-70" />
        <div className="relative mx-auto w-full max-w-md">
          <Wordmark className="h-6" />
          {info === null ? (
            <div className="mt-10 flex items-center gap-3 text-muted-foreground">
              <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-brand" />
              <span className="text-sm">Checking your invite…</span>
            </div>
          ) : (
            <div className="mt-10 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                This invite link isn&apos;t working
              </h1>
              <p className="text-muted-foreground">
                It may have expired. Reach out to whoever invited you and they
                can send a fresh one.
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Valid invite → Welcome intro, then straight into the flow. (The example
  // profiles now live in the flow itself, right after the Quick check step.)
  return <WelcomeIntro onStart={start} firstName={profile?.firstName} />;
}
