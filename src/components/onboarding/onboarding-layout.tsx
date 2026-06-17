"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { StatusBadge } from "@/components/onboarding/status-badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DoodleScatter, Moodie } from "@/components/doodles";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { REJECTION_RETURN_STEP } from "@/lib/onboarding/steps";
import { stepHref } from "@/lib/onboarding/useOnboardingNav";

interface Props {
  children: React.ReactNode;
  progress?: { index: number; total: number; section: string };
  /** When provided, renders a 2-column "build with live preview" layout. */
  preview?: React.ReactNode;
}

export function OnboardingLayout({ children, progress, preview }: Props) {
  const router = useRouter();
  const status = useOnboardingStore((s) => s.status);
  const rejectionNote = useOnboardingStore((s) => s.rejectionNote);

  const pct = progress
    ? Math.round(((progress.index + 1) / progress.total) * 100)
    : 0;

  const panel = (
    <div className="relative z-10 flex w-full flex-col overflow-hidden bg-card shadow-[0_2px_28px_rgba(31,30,29,0.07)] sm:rounded-3xl sm:border">
      <header>
        <div className="flex h-14 items-center justify-between px-5 sm:px-8">
          <Wordmark />
          <StatusBadge status={status} />
        </div>
        {progress && (
          <div className="border-b px-5 pb-3 sm:px-8">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{progress.section}</span>
              <span>
                Step {progress.index + 1} of {progress.total}
              </span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )}
      </header>

      {status === "rejected" && rejectionNote && (
        <div className="border-b border-orange-200 bg-orange-50">
          <div className="flex gap-3 px-5 py-3 text-sm text-orange-900 sm:px-8">
            <Moodie name="face-awkward" className="mt-0.5 size-7 shrink-0" />
            <div>
              <p className="font-medium">
                A few things to tweak before this goes live
              </p>
              <p className="text-orange-800">{rejectionNote}</p>
              <button
                type="button"
                onClick={() => router.push(stepHref(REJECTION_RETURN_STEP))}
                className="mt-1 font-medium underline underline-offset-2"
              >
                Jump back in
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );

  // ── Single-column (e.g. account setup) ──────────────────────────────────
  if (!preview) {
    return (
      <div className="relative flex min-h-dvh justify-center overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1] sm:px-6 sm:py-10">
        <DoodleScatter className="hidden opacity-50 lg:block" />
        <div className="w-full max-w-2xl">{panel}</div>
      </div>
    );
  }

  // ── 2-column: build on the left, live phone preview on the right ────────
  return (
    // overflow-CLIP (not hidden) clips the doodles without creating a scroll
    // container — so the sticky preview below can pin to the viewport.
    <div className="relative min-h-dvh overflow-clip bg-gradient-to-b from-[#fff2ea] to-[#f6f4f1] sm:px-6 sm:py-10">
      <DoodleScatter className="hidden opacity-40 lg:block" />
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">{panel}</div>

        {/* Desktop: sticky live preview — pins to the viewport while a long
            left column scrolls. Sticky sits on the GRID ITEM (its containing
            block is the full-height grid area), and it fades in once it reveals
            with the device dissolving at the bottom so the zoom never cuts hard. */}
        <div className="hidden self-start lg:sticky lg:top-10 lg:block">
          <div className="flex animate-in flex-col items-center gap-3 fade-in slide-in-from-bottom-6 duration-700">
            <p className="text-xs text-muted-foreground">
              Live preview · what teens see
            </p>
            <div className="[mask-image:linear-gradient(to_bottom,#000_0%,#000_46%,transparent_86%)] [-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_46%,transparent_86%)]">
              {preview}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: a tap-to-open preview */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center p-4 lg:hidden">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="shadow-lg">
              <Eye className="size-4" />
              Preview profile
            </Button>
          </DialogTrigger>
          <DialogContent className="w-fit max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 shadow-none [&>button]:right-2 [&>button]:top-2 [&>button]:text-white">
            <DialogTitle className="sr-only">Profile preview</DialogTitle>
            <div className="[mask-image:linear-gradient(to_bottom,#000_0%,#000_46%,transparent_86%)] [-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_46%,transparent_86%)]">
              {preview}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
