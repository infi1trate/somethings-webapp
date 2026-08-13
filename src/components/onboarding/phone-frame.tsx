// FIXED IDENTITY — DO NOT THEME. This renders the TEEN-facing mobile app, not
// staff chrome. Its palette must stay put in dark mode: the preview shows what
// teens actually see, and teens do not share a staff member's appearance
// setting. Hard-coded whites/purples here are deliberate; on a dark staff page
// it reads as a real device screen. (Dark-mode pass, gaps.md.)
import { cn } from "@/lib/utils";

/** A lightweight phone device mockup. The mentor profile is a mobile screen, so
 *  we frame the live preview as "the app teens actually see." */
export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-[360px] max-w-full", className)}>
      {/* Quiet, refined device — thin gradient bezel + hairline edge + soft
          shadow so the frame recedes and the profile is the star. */}
      <div className="rounded-[3rem] bg-gradient-to-b from-neutral-700 to-neutral-900 p-[6px] shadow-[0_18px_50px_-26px_rgba(31,30,29,0.4)] ring-1 ring-black/10">
        <div className="rounded-[2.7rem] bg-neutral-950 p-[3px]">
          <div className="relative h-[736px] overflow-hidden rounded-[2.5rem] bg-white">
            {/* Dynamic Island */}
            <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
            {/* The preview controls its own overflow (clips while zoomed, scrolls when full). */}
            <div className="h-full">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
