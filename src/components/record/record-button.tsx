"use client";

// RECORD BUTTON — the record's SECONDARY button, extracted so the Care page's
// two CTAs stop being bare underlined text links.
//
// WHY A NEW COMPONENT RATHER THAN ui/button.tsx: that file is shadcn's, on
// shadcn's token system (`--background`, `--foreground`, `--muted`, `--border`).
// Every record surface is on the Bloom tokens (`--surface-card`,
// `--border-contour`, `--text-primary`), and mixing the two is how a button ends
// up almost matching the card it sits on. It is also unused on this page today.
//
// THE PATTERN IS NOT INVENTED. `DeactivateAction` on the Account tab already
// hand-rolls exactly this shape — pill radius, 1px contour, 13px semibold,
// min-h-9, tint-hover — for its Deactivate/Lock pair. This is that, named. The
// deactivate band is NOT retrofitted in this pass: it is a different tab with
// its own consumers, and a shared-component change there would shift a screen
// this brief did not ask about. Converging it is a follow-up.
//
// SECONDARY, NEVER FILLED. The filled button is scarce by house rule — one per
// region — and on the Care page it is Approve inside the task region. A CTA that
// opens a modal to change a minor's diagnosis should read as deliberate, not
// inviting, so it gets a contour and not a fill.

import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function RecordButton({
  onClick,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-4",
        "border-[color:var(--border-contour)] bg-[var(--surface-card)]",
        "text-[13px] font-semibold text-[var(--text-primary)]",
        "transition-colors hover:bg-[var(--tint-hover)]",
        RING,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
