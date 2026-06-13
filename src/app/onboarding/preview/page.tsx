"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand";
import { Moodie } from "@/components/doodles";
import { StatusBadge } from "@/components/onboarding/status-badge";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { submitForReview } from "@/lib/mock-api";
import { SUBMITTED_PATH } from "@/lib/onboarding/steps";
import { stepHref } from "@/lib/onboarding/useOnboardingNav";

export default function PreviewPage() {
  const mounted = useMounted();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const setStatus = useOnboardingStore((s) => s.setStatus);
  const setRejection = useOnboardingStore((s) => s.setRejection);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const res = await submitForReview(draft);
    setSubmitting(false);
    if (!res.ok) {
      toast.error("That didn't go through. Try again.");
      return;
    }
    setRejection(null);
    setStatus("in_review");
    router.push(SUBMITTED_PATH);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1] sm:px-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Review & submit panel */}
        <div className="order-2 flex flex-col overflow-hidden bg-card shadow-[0_2px_28px_rgba(31,30,29,0.07)] sm:rounded-3xl sm:border lg:order-1">
          <div className="flex h-14 items-center justify-between border-b px-5 sm:px-8">
            <Wordmark />
            <StatusBadge status={status} />
          </div>

          <div className="flex flex-1 flex-col px-5 py-8 sm:px-8 sm:py-10">
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/60">
              <Moodie name="face-love" className="doodle-float size-10" />
            </span>
            <h1 className="text-[27px] font-bold leading-tight tracking-tight text-balance">
              One last look — ready to send it in?
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground text-pretty">
              This is exactly what teens will see. A member of our team gives every
              profile a quick read before it goes live — usually within a couple of
              days, and we&apos;ll email you either way.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button onClick={submit} disabled={submitting} size="lg">
                {submitting ? "Sending…" : "Submit for review"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push(stepHref("confirm"))}
              >
                <ArrowLeft className="size-4" />
                Keep editing
              </Button>
            </div>
          </div>
        </div>

        {/* Live profile */}
        <div className="order-1 flex flex-col items-center gap-3 lg:order-2 lg:sticky lg:top-10">
          {mounted ? (
            <PhoneFrame>
              <MentorProfilePreview draft={draft} />
            </PhoneFrame>
          ) : (
            <div className="h-[740px] w-[368px] max-w-full animate-pulse rounded-[46px] bg-muted/40" />
          )}
          <p className="text-xs text-muted-foreground">
            Live preview · what teens see
          </p>
        </div>
      </div>
    </div>
  );
}
