// FIXED IDENTITY — DO NOT THEME. This renders the TEEN-facing mobile app, not
// staff chrome. Its palette must stay put in dark mode: the preview shows what
// teens actually see, and teens do not share a staff member's appearance
// setting. Hard-coded whites/purples here are deliberate; on a dark staff page
// it reads as a real device screen. (Dark-mode pass, gaps.md.)
import { cn } from "@/lib/utils";

/**
 * The two onboarding background "phases", mapped from the Figma artboards.
 *
 * • intro — Welcome, account setup, and the Quick-check screen (Mentor-Setup-S1).
 *   A warm peach wash with a soft central blush spray.
 * • step  — from "Here's what you're building" onward (Mentor-Setup-S3): a
 *   lime → peach → white wash with a tangelo spray bleeding off the top-left and
 *   a sky spray off the bottom-right.
 *
 * Each backdrop renders only the spray overlays (absolutely positioned); pair it
 * with the matching gradient class on the container.
 */

export const INTRO_GRADIENT = "bg-gradient-to-b from-[#ffede6] to-white";
export const STEP_GRADIENT = "bg-gradient-to-b from-[#f3f9dc] via-[#ffdccc] to-white";

/** A spray-paint PNG used as an alpha mask over a flat brand-color fill. */
function sprayMask(url: string): React.CSSProperties {
  return {
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };
}

/** Soft central blush spray on the peach wash (Mentor-Setup-S1). */
export function IntroBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <div
        className="absolute left-1/2 top-1/2 size-[760px] max-w-none -translate-x-1/2 -translate-y-1/2 bg-[#ffa8b2] opacity-40 sm:size-[900px]"
        style={sprayMask("/spray-blush.png")}
      />
    </div>
  );
}

/** Tangelo (top-left) + sky (bottom-right) corner sprays (Mentor-Setup-S3). */
export function StepBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      {/* Tangelo, bleeding off the top-left (Figma 156:508) */}
      <div
        className="absolute -left-40 -top-28 size-[460px] bg-[#ff5001] sm:size-[580px]"
        style={sprayMask("/spray-tangelo.png")}
      />
      {/* Sky, bleeding off the bottom-right (Figma 156:509) */}
      <div
        className="absolute -right-48 bottom-0 size-[620px] translate-y-1/4 bg-[#71e0ff] sm:size-[860px]"
        style={sprayMask("/spray-sky.png")}
      />
    </div>
  );
}
