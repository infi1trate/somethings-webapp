"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Intro screen 2 — "Here's what you're building".
 * A fanned deck of phone mockups showing real mentor profiles, so a new mentor
 * sees the end product before they start. The screenshots in /public are
 * full-bleed phone captures (they include their own status bar), so the frame
 * here is a clean bezel with NO Dynamic Island — otherwise the status bar
 * doubles up. Each phone falls back to an on-brand placeholder if its image is
 * missing, so the screen never looks broken.
 */

interface Example {
  src: string;
  /** Hero accent — only used for the placeholder fallback. */
  accent: string;
}

const EXAMPLES: Example[] = [
  { src: "/profile-example1.png", accent: "#ff6f9c" },
  { src: "/profile-example2.png", accent: "#7bbf57" },
  { src: "/profile-example3.png", accent: "#7b7ff0" },
  { src: "/profile-example4.png", accent: "#ffb200" },
  { src: "/profile-example5.png", accent: "#34c3d9" },
];

// Fan transforms per position. Center sits forward + slightly raised; each step
// outward tilts more, drops lower, and shrinks. The outer two only show on wide
// screens (≥lg) — phone/tablet show a tidy three.
const FAN = [
  "hidden lg:block z-10 -mr-[4.75rem] translate-y-12 rotate-[-15deg] scale-[0.85]",
  "z-20 -mr-11 translate-y-6 rotate-[-8deg] scale-[0.93]",
  "z-40 -translate-y-1",
  "z-20 -ml-11 translate-y-6 rotate-[8deg] scale-[0.93]",
  "hidden lg:block z-10 -ml-[4.75rem] translate-y-12 rotate-[15deg] scale-[0.85]",
];

export function ExamplesIntro({
  onContinue,
  onBack,
}: {
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-[#ffede6] to-white px-4 py-8 sm:px-6 sm:py-10">
      {/* faint blush spray glow behind the deck for warmth */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[58%] size-[820px] max-w-none -translate-x-1/2 -translate-y-1/2 bg-[#ffa8b2] opacity-45"
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

      <header className="relative z-10 flex shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <Wordmark className="h-[18px]" />
        <span className="w-[52px]" aria-hidden />
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6 py-2 text-center">
        <div className="max-w-xl space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-700">
          <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.03em] text-foreground text-balance sm:text-[42px]">
            Here&apos;s what you&apos;re building
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground text-pretty sm:text-base">
            A few mentors teens are matching with right now. Yours will feel just
            as real — and it comes together quicker than you&apos;d think.
          </p>
        </div>

        <div className="flex w-full items-center justify-center pt-2 animate-in fade-in zoom-in-95 duration-700">
          {EXAMPLES.map((ex, i) => (
            <ProfilePhone key={ex.src} example={ex} className={FAN[i]} />
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-sm shrink-0 flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={onContinue}
          className="group h-[52px] w-full rounded-full text-base"
        >
          Let&apos;s build yours
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
        <p className="text-xs text-muted-foreground">
          About 10 minutes · stop and come back anytime
        </p>
      </div>
    </main>
  );
}

/** A phone mockup showing a mentor profile screenshot. No Dynamic Island — the
 *  screenshots already include a status bar. Falls back to a branded
 *  placeholder while the image file isn't present. */
function ProfilePhone({
  example,
  className,
}: {
  example: Example;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn("w-[35vw] max-w-[172px] shrink-0", className)}>
      <div className="overflow-hidden rounded-[1.7rem] bg-neutral-900 p-[4px] shadow-[0_24px_45px_-24px_rgba(31,30,29,0.6)] ring-1 ring-black/10">
        <div className="relative aspect-[9/19] overflow-hidden rounded-[1.45rem] bg-white">
          {!failed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={example.src}
              alt="Example mentor profile"
              onError={() => setFailed(true)}
              className="size-full object-cover object-top"
            />
          ) : (
            <ProfilePlaceholder accent={example.accent} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Branded stand-in shown until the real screenshot is dropped in. */
function ProfilePlaceholder({ accent }: { accent: string }) {
  return (
    <div className="flex size-full flex-col" style={{ background: accent }}>
      <div className="flex flex-col items-center gap-2.5 px-4 pb-5 pt-8 text-white">
        <div className="h-2 w-14 rounded-full bg-white/40" />
        <div className="mt-1 size-14 rounded-full border-2 border-white/40 bg-white/15" />
        <div className="mt-1 flex gap-1.5">
          <span className="h-3.5 w-10 rounded-full bg-white/25" />
          <span className="h-3.5 w-8 rounded-full bg-white/25" />
        </div>
      </div>
      <div className="mt-auto space-y-2 rounded-t-2xl bg-white p-3.5">
        <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
        <div className="h-2 w-1/2 rounded-full bg-foreground/10" />
        <div className="mt-2.5 flex gap-2">
          <span className="size-9 rounded-xl bg-foreground/10" />
          <span className="size-9 rounded-xl bg-foreground/10" />
          <span className="size-9 rounded-xl bg-foreground/10" />
        </div>
      </div>
    </div>
  );
}
