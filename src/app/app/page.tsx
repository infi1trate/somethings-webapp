"use client";

// The mentor's Home — the post-approval landing ("Go to Somethings" targets
// /app). Uses the shared MentorShell so its chrome matches every other /app
// page (previously this was the one page with a bespoke text-nav header —
// the inconsistency an approved mentor saw first).

import { useRouter } from "next/navigation";
import { AlertCircle, Clock } from "lucide-react";
import { Moodie } from "@/components/doodles";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import { Button } from "@/components/ui/button";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

export default function AppHomePage() {
  const mounted = useMounted();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const publishedSnapshot = useOnboardingStore((s) => s.publishedSnapshot);
  const reset = useOnboardingStore((s) => s.reset);
  const everPublished = publishedSnapshot !== null;

  if (!mounted) return null;

  // Pre-publish mentors can't manage a profile here yet — same in-shell
  // dead-end treatment /app/profile uses.
  if (!everPublished) {
    return (
      <MentorShell active="home">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold">Not published yet</h1>
          <p className="text-sm text-muted-foreground">
            Your profile needs to be approved before you can manage it here.
          </p>
          <Button variant="outline" onClick={() => router.push("/hub")}>
            Back to home
          </Button>
        </div>
      </MentorShell>
    );
  }

  const restart = () => {
    reset();
    router.push("/");
  };

  return (
    <MentorShell active="home">
      <div className="mx-auto max-w-xl px-6 py-6 lg:px-10">
        {status === "in_review" ? (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
            <Clock className="size-5 shrink-0" aria-hidden />
            <span>
              Your latest changes are in review. We&apos;ll email you when
              they&apos;re approved.
            </span>
          </div>
        ) : status === "rejected" ? (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3.5 text-sm text-orange-900">
            <AlertCircle className="size-5 shrink-0" aria-hidden />
            <span>
              The team requested a few changes — open your profile to address
              them.
            </span>
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900">
            <Moodie name="face-excited" className="size-8 shrink-0" />
            <span>
              Your profile is live. Teens can find and message you now.
            </span>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Your profile</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/app/profile")}
          >
            Edit profile
          </Button>
        </div>

        <PhoneFrame>
          <MentorProfilePreview draft={draft} />
        </PhoneFrame>

        <p className="mt-4 text-sm text-muted-foreground">
          Edit your profile anytime — changes go to the team for a quick review
          before they go live.
        </p>

        <div className="mt-10 border-t pt-6">
          <Button variant="ghost" size="sm" onClick={restart}>
            Restart demo
          </Button>
        </div>
      </div>
    </MentorShell>
  );
}
