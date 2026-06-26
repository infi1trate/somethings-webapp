"use client";

import { Eye } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { StatusBadge } from "@/components/onboarding/status-badge";
import { ChangeRequestsDock } from "@/components/onboarding/change-requests-dock";
import { WelcomeBackModal } from "@/components/onboarding/welcome-back-modal";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  INTRO_GRADIENT,
  STEP_GRADIENT,
  IntroBackdrop,
  StepBackdrop,
} from "@/components/onboarding/backdrops";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  progress?: { index: number; total: number; section: string };
  /** When provided, renders a 2-column "build with live preview" layout. */
  preview?: React.ReactNode;
  /**
   * Which background phase to paint: "intro" (Welcome-style peach + blush, used
   * for account setup and Quick check) or "step" (S3 spray corners, used from
   * the profile build onward). Defaults to "step".
   */
  phase?: "intro" | "step";
  /** Suppress the revision dock (e.g. on the pre-login account/login screen). */
  hideDock?: boolean;
  /** Suppress the profile status badge (e.g. on the returning-user login page). */
  hideStatus?: boolean;
  /** During "needs changes", whether the CURRENT step has an unaddressed request.
   *  Gates the header's "Needs changes" badge so it shows per-step (only on
   *  flagged steps), not globally on every slide. */
  stepFlagged?: boolean;
}

export function OnboardingLayout({
  children,
  progress,
  preview,
  phase = "step",
  hideDock = false,
  hideStatus = false,
  stepFlagged = false,
}: Props) {
  const gradient = phase === "intro" ? INTRO_GRADIENT : STEP_GRADIENT;
  const Backdrop = phase === "intro" ? IntroBackdrop : StepBackdrop;
  const status = useOnboardingStore((s) => s.status);

  const pct = progress
    ? Math.round(((progress.index + 1) / progress.total) * 100)
    : 0;

  const panel = (
    <div className="relative z-10 flex w-full flex-col overflow-hidden bg-card shadow-[0_2px_28px_rgba(31,30,29,0.07)] sm:rounded-3xl sm:border">
      <header>
        <div className="flex h-14 items-center justify-between px-5 sm:px-8">
          <Wordmark />
          {/* "Needs changes" is per-step during revision — shown only on a
              flagged step, not on every slide. Other statuses (Draft / In review
              / Published) stay global. */}
          {!hideStatus && (status !== "rejected" || stepFlagged) && (
            <StatusBadge status={status} />
          )}
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

      <main className="flex flex-1 flex-col px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );

  // ── Single-column (e.g. account setup) ──────────────────────────────────
  if (!preview) {
    return (
      <div
        className={cn(
          "relative flex min-h-dvh justify-center overflow-hidden sm:px-6 sm:py-10",
          gradient
        )}
      >
        <Backdrop />
        <div className="relative z-10 w-full max-w-2xl">{panel}</div>
        {!hideDock && <WelcomeBackModal />}
        {/* Revision tracker — floats fixed to the viewport (self-gates). */}
        {!hideDock && <ChangeRequestsDock />}
      </div>
    );
  }

  // ── 2-column: build on the left, live phone preview on the right ────────
  return (
    // overflow-CLIP (not hidden) clips the doodles without creating a scroll
    // container — so the sticky preview below can pin to the viewport.
    <div
      className={cn(
        "relative min-h-dvh overflow-clip sm:px-6 sm:py-10",
        gradient
      )}
    >
      <Backdrop />
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

      {/* Mobile: a tap-to-open preview. Lifted above the revision dock when the
          profile is in changes-requested state so the two don't overlap. */}
      <div
        className={cn(
          "fixed inset-x-0 z-20 flex justify-center p-4 lg:hidden",
          // Lifted clear of the floating revision dock (collapsed ≈ 4.25rem tall)
          // when in changes-requested state.
          status === "rejected" ? "bottom-24" : "bottom-0"
        )}
      >
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

      {!hideDock && <WelcomeBackModal />}
      {/* Revision tracker — floats fixed to the viewport (self-gates). */}
      {!hideDock && <ChangeRequestsDock />}
    </div>
  );
}
