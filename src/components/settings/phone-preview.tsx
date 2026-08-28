// FIXED IDENTITY — DO NOT THEME. This renders the TEEN-facing mobile app, not
// staff chrome. Its palette must stay put in dark mode: the preview shows what
// teens actually see, and teens do not share a staff member's appearance
// setting. Hard-coded whites/purples here are deliberate; on a dark staff page
// it reads as a real device screen. (Dark-mode pass, gaps.md.)
import { cn } from "@/lib/utils";

interface PhonePreviewShellProps {
  children?: React.ReactNode;
  /** Accessible name for the whole preview (§6 sweep) — e.g.
   *  "Live preview — what teens see". The bezel/notch stay decorative. */
  label?: string;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE DEVICE GEOMETRY — one set of numbers, shared with `onboarding/phone-frame.tsx`
// ═══════════════════════════════════════════════════════════════════════════
//
// Exported because there are TWO phone frames in this codebase with two skins
// (design-system-gaps row 262). They must at least agree on the device's proportions, so
// the numbers live here and the other imports them.
//
//   360 outer  =  342 screen  +  2×6 bezel pad  +  2×3 inner pad
//
/** The screen's width at the design size. */
export const PHONE_SCREEN_W = 342;
/** The screen's height at the design size. */
export const PHONE_SCREEN_H = 736;
/** The frame's outer width at the design size — the old hard-coded `w-[360px]`. */
export const PHONE_FRAME_W = PHONE_SCREEN_W + 2 * 6 + 2 * 3;

/** THE SCREEN'S ASPECT RATIO, AS A LITERAL CLASS.
 *
 *  Tailwind scans source text for class strings, so this has to be written out
 *  rather than interpolated from `PHONE_SCREEN_W`/`_H` — a template literal
 *  produces a class that is never generated. Kept beside the constants so a
 *  change to one is visibly a change to the other. */
export const PHONE_SCREEN_ASPECT = "aspect-[342/736]";

// Phone-preview SHELL only (Phase 0) — build-spec §2 anatomy: 360px device,
// dark gradient bezel radius 48 → screen radius 40, notch pill. Strictly a
// frame: no content binding here (Phase 1 binds the live teen-facing preview).
// The preview is passive output — never an editing surface.
//
// ═══ FLUID SINCE PHASE 4 (RC-2) ═══
//
// This was `w-[360px] shrink-0` with an `h-[736px]` screen, and because it could
// not shrink, SIX surfaces wrapped it in `hidden lg:…` and deleted the preview
// below 1024px — including `/admin/review`, where the deleted thing is the
// artifact under review. Now `w-full` up to the design size, with the screen
// holding its ratio via `aspect-ratio`.
//
// WHY NOT `transform: scale()` — it scales paint but not the layout box, so the
// accessibility tree and hit-testing keep the untransformed geometry: every
// target inside would report a size and position that is not where it is drawn.
//
// WHY NOT `zoom` — it multiplies the user's own text size, so a reader at 200%
// gets 148% and SC 1.4.4 is no longer satisfiable from inside the page. It was
// used at `admin/mentor/page.tsx` and this replaces it.
//
// WHAT FLUIDITY MEANS HERE, STATED: the frame is a real box that gets narrower,
// so the content inside REFLOWS as ordinary CSS rather than being photographed
// and shrunk. A 280px frame therefore reads as a narrower phone, which is
// honest, and fixed-px details inside it (a 22px battery glyph) stay 22px —
// correct, because a narrower phone still has a 22px battery glyph.
export function PhonePreviewShell({
  children,
  label,
  className,
}: PhonePreviewShellProps) {
  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      className={cn(
        // `w-full` + `max-w` rather than a fixed width: at the design size the
        // rendered box is byte-for-byte what it was, and below it the frame
        // shrinks instead of forcing its container to scroll or hide it.
        // `shrink-0` is GONE deliberately — it was the property that made this
        // unable to participate in a narrow layout.
        "w-full rounded-[var(--radius-preview-frame)] bg-gradient-to-b from-[#404040] to-[#171717] p-[6px] shadow-[0_18px_50px_rgba(31,30,29,0.4)]",
        "max-w-[360px]",
        className
      )}
    >
      <div className="rounded-[43px] bg-[#0a0a0a] p-[3px]">
        {/* `aspect-[342/736]` REPLACES `h-[736px]`. The height now follows the
            width, which is the whole of the fix — a fixed height on a fluid
            width is what turns a phone into a slab. */}
        <div
          className={cn(
            "relative overflow-hidden rounded-[var(--radius-preview-screen)] bg-white",
            PHONE_SCREEN_ASPECT
          )}
        >
          <div
            aria-hidden
            className="absolute left-1/2 top-[10px] z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black"
          />
          {children ?? (
            <div className="flex h-full items-center justify-center px-8 text-center text-[14px] leading-[20px] text-[var(--text-muted)]">
              No content bound — preview binding lands in Phase 1.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
