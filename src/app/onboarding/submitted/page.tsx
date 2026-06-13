"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FlaskConical } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DoodleScatter, Moodie } from "@/components/doodles";
import { StatusBadge } from "@/components/onboarding/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { simulateReview } from "@/lib/mock-api";
import { REJECTION_RETURN_STEP } from "@/lib/onboarding/steps";
import { stepHref } from "@/lib/onboarding/useOnboardingNav";

const REJECTION_NOTE =
  "Thanks for this! Could you expand your bio a little and swap the first photo for one where your face is clearly visible? Re-submit when you're ready.";

export default function SubmittedPage() {
  const mounted = useMounted();
  const router = useRouter();
  const status = useOnboardingStore((s) => s.status);
  const draft = useOnboardingStore((s) => s.draft);
  const setStatus = useOnboardingStore((s) => s.setStatus);
  const setRejection = useOnboardingStore((s) => s.setRejection);
  const [working, setWorking] = useState(false);

  const approve = async () => {
    setWorking(true);
    await simulateReview({ decision: "approved" });
    setRejection(null);
    setStatus("published");
    router.push("/app");
  };

  const reject = async () => {
    setWorking(true);
    await simulateReview({ decision: "rejected", note: REJECTION_NOTE });
    setStatus("rejected");
    setRejection(REJECTION_NOTE);
    router.push(stepHref(REJECTION_RETURN_STEP));
  };

  const firstName = mounted ? draft.firstName : "";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1]">
      <header className="relative z-10 border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-5">
          <Wordmark />
          <StatusBadge status={status} />
        </div>
      </header>

      <DoodleScatter className="opacity-70" />

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-12 text-center">
        <div className="mx-auto flex size-24 items-center justify-center rounded-3xl bg-muted/60">
          <Moodie name="face-excited" className="doodle-float size-16" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-balance">
            You&apos;re all set{firstName ? `, ${firstName}` : ""} — thanks for that
          </h1>
          <p className="text-muted-foreground text-pretty">
            Your profile is in. Someone on our team reads every one before it goes
            live, usually within a couple of days. We&apos;ll email you the moment
            it&apos;s approved — nothing else to do for now.
          </p>
        </div>

        {/* ── Dev-only reviewer simulator ──────────────────────────────────
            Stands in for the clinical-recruitment review step in the workflow.
            Remove once a real review queue exists. */}
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-left">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FlaskConical className="size-3.5" />
            Demo only · reviewer actions
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Simulate what the clinical recruitment team would do next:
          </p>
          <div className="flex gap-3">
            <Button size="sm" onClick={approve} disabled={working} className="gap-1.5">
              <CheckCircle2 className="size-4" />
              Approve & publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={reject}
              disabled={working}
            >
              Send back for changes
            </Button>
          </div>
        </div>

        <Separator />
        <Button
          variant="ghost"
          size="sm"
          className="mx-auto"
          onClick={() => router.push("/onboarding/preview")}
        >
          View what you submitted
        </Button>
      </main>
    </div>
  );
}
