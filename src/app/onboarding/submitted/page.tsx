"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DoodleScatter, Moodie } from "@/components/doodles";
import { StatusBadge } from "@/components/onboarding/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

export default function SubmittedPage() {
  const mounted = useMounted();
  const router = useRouter();
  const status = useOnboardingStore((s) => s.status);
  const draft = useOnboardingStore((s) => s.draft);

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

        {/* ── Dev-only: jump to the reviewer's console ──────────────────────
            The clinical-recruitment review now happens in the admin console
            (also reachable anytime via the DEV role toggle, bottom-left). */}
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-left">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FlaskConical className="size-3.5" />
            Demo only · reviewer view
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            See what the recruitment team sees — open the review console to approve
            this profile or send back changes.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/users">Open admin review console</Link>
          </Button>
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
