"use client";

// Post-submit success screen — the reward moment before the hub. Bright and
// celebratory; a single CTA lets the mentor opt into their hub rather than being
// dropped there. Only shown right after a submit (status in_review); any other
// entry forwards to the hub so it's never a stray dead-end.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { DoodleScatter, Moodie } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { HUB_PATH } from "@/lib/onboarding/steps";

export default function SubmittedPage() {
  const mounted = useMounted();
  const router = useRouter();
  const status = useOnboardingStore((s) => s.status);
  const draft = useOnboardingStore((s) => s.draft);
  const firstName = draft.firstName?.trim();

  // This is the just-submitted moment. If we're not in review (direct hit, or
  // back button after approval), forward to the hub instead of dead-ending here.
  useEffect(() => {
    if (mounted && status !== "in_review") router.replace(HUB_PATH);
  }, [mounted, status, router]);

  if (!mounted || status !== "in_review") {
    return <div className="min-h-dvh bg-background" />;
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1]">
      <header className="relative z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-5">
          <Wordmark />
        </div>
      </header>

      <DoodleScatter className="opacity-70" />

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-7 px-5 py-12 text-center">
        <span className="flex size-24 items-center justify-center rounded-[2rem] bg-emerald-100 shadow-[0_12px_44px_-14px_rgba(5,150,105,0.55)]">
          <Moodie name="face-excited" className="doodle-float size-16" />
        </span>
        <div className="space-y-2.5">
          <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-tight text-balance">
            {firstName
              ? `That's your profile in, ${firstName}!`
              : "That's your profile in!"}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground text-pretty">
            Nice work. Our team reads every profile before it goes live — usually
            a couple of days, and we&apos;ll email you the moment it&apos;s
            approved. There&apos;s a little more to set up in the meantime.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="h-[52px] w-full max-w-xs rounded-full text-base"
        >
          <Link href={HUB_PATH}>Go to your hub</Link>
        </Button>
      </main>
    </div>
  );
}
