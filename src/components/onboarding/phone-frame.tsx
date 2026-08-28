// FIXED IDENTITY — DO NOT THEME. This renders the TEEN-facing mobile app, not
// staff chrome. Its palette must stay put in dark mode: the preview shows what
// teens actually see, and teens do not share a staff member's appearance
// setting. Hard-coded whites/purples here are deliberate; on a dark staff page
// it reads as a real device screen. (Dark-mode pass, gaps.md.)
import {
  PHONE_SCREEN_ASPECT,
  PHONE_FRAME_W,
} from "@/components/settings/phone-preview";
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
    // ═══ FLUID SINCE PHASE 4 (RC-2) ═══
    //
    // This already carried `max-w-full`, so it LOOKED fluid — and that was the
    // more dangerous version of the bug. The width could shrink while the screen
    // below stayed pinned at `h-[736px]`, so under 360px the previewed phone
    // silently became a tall slab: narrower every step, never shorter, aspect
    // ratio drifting further from any real device. `PhonePreviewShell` at least
    // refused to shrink at all, which is why six surfaces hid it rather than
    // shipping something distorted.
    //
    // The width bound now comes from the shared geometry rather than a literal,
    // so the two frames cannot disagree about the device's size.
    <div
      className={cn("mx-auto w-full", className)}
      style={{ maxWidth: PHONE_FRAME_W }}
    >
      {/* Quiet, refined device — thin gradient bezel + hairline edge + soft
          shadow so the frame recedes and the profile is the star. */}
      <div className="rounded-[3rem] bg-gradient-to-b from-neutral-700 to-neutral-900 p-[6px] shadow-[0_18px_50px_-26px_rgba(31,30,29,0.4)] ring-1 ring-black/10">
        <div className="rounded-[2.7rem] bg-neutral-950 p-[3px]">
          {/* `aspect-[342/736]` REPLACES `h-[736px]` — see the note above. */}
          <div
            className={cn(
              "relative overflow-hidden rounded-[2.5rem] bg-white",
              PHONE_SCREEN_ASPECT
            )}
          >
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
