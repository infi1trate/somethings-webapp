"use client";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

/**
 * Intro screen 1 — "Welcome, glad you're here".
 * Matches the Figma artboard (Mentor-Setup-S1): a centered horizontal card
 * (white, blush hairline border, soft shadow) sitting on a cream→white wash
 * with a blush spray-paint texture bleeding out behind it; warm photo on the
 * right, wordmark + headline + subtext + black pill on the left. Stacks to a
 * single column (photo on top) on small screens.
 */
export function WelcomeIntro({
  onStart,
  firstName,
}: {
  onStart: () => void;
  /** The invited mentor's first name (from the invite); greets them by name. */
  firstName?: string;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-b from-[#ffede6] to-white px-4 py-10 sm:px-6">
      <SprayBackdrop />

      <div className="relative z-10 w-full max-w-[1008px] animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 ease-out">
        <div className="flex flex-col overflow-hidden rounded-[2rem] border border-[#ffa8b2] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.1)] lg:flex-row lg:items-stretch">
          {/* Left — copy + CTA */}
          <div className="flex flex-1 flex-col gap-7 px-7 py-9 sm:px-10 sm:py-12 lg:justify-center lg:py-16 lg:pl-12 lg:pr-10">
            <Wordmark className="h-[19px] self-start" />

            <div className="space-y-4">
              <h1 className="text-[40px] font-bold leading-[0.98] tracking-[-0.03em] text-foreground text-balance sm:text-5xl lg:text-[64px] lg:leading-[0.95] lg:tracking-[-0.045em]">
                Welcome{firstName ? `, ${firstName}` : ""}, glad you&apos;re
                here
              </h1>
              <p className="max-w-[340px] text-[15px] leading-relaxed text-muted-foreground text-pretty">
                Somethings connects teens with trained young-adult mentors.
                Setting up your profile takes about 10 minutes, and you can stop
                and come back anytime.
              </p>
            </div>

            <Button
              size="lg"
              onClick={onStart}
              className="h-[52px] w-full rounded-full text-base"
            >
              Get Started!
            </Button>
          </div>

          {/* Right — warm hero photo (top on mobile) */}
          <div className="relative order-first h-60 w-full shrink-0 sm:h-80 lg:order-none lg:h-auto lg:w-[46%] lg:max-w-[505px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/welcome-photo.jpg"
              alt="Three young people laughing together in the sun"
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

/** Blush spray-paint texture bleeding out behind the card (Figma: a #ffa8b2
 *  fill masked by a spray PNG). Sits center-right so it frames the photo edge. */
function SprayBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 h-[150%] w-[135%] max-w-none -translate-x-1/2 -translate-y-1/2 bg-[#ffa8b2] sm:w-[115%] lg:h-[160%] lg:w-[88%] lg:translate-x-[-38%]"
        style={{
          WebkitMaskImage: "url(/spray-blush.png)",
          maskImage: "url(/spray-blush.png)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
    </div>
  );
}
