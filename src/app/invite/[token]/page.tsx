"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Clock3, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DoodleScatter } from "@/components/doodles";
import { Button } from "@/components/ui/button";
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
        ) : !info.valid ? (
          <div className="mt-10 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              This invite link isn&apos;t working
            </h1>
            <p className="text-muted-foreground">
              It may have expired. Reach out to whoever invited you and they can send
              a fresh one.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-7 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                <Sparkles className="size-4" />
                You&apos;re invited
              </span>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-balance">
                Let&apos;s set up your mentor profile
              </h1>
              <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
                Somethings connects teens with trained young-adult mentors. This takes
                about 10 minutes, and you can stop and pick back up anytime.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button size="lg" onClick={start} className="w-full sm:w-auto">
                Get started
              </Button>
              <div className="flex items-start gap-2.5 rounded-2xl border bg-card/70 p-3.5 text-sm text-muted-foreground">
                <Smartphone className="mt-0.5 size-4 shrink-0" />
                <span>
                  Prefer your phone? The Somethings app works too — your progress
                  saves either way.
                </span>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                About 10 minutes · no rush
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
