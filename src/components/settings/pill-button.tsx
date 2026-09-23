"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Focus style: the system defines none (design-system-gaps.md #4) — interim
// 2px #716a60 ring, 2px offset (--focus-ring), ≥3:1 on both surfaces.
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

// Primary pill button — build-spec §2: full pill radius, height 53, px-24,
// Avantt Bold 16/1.1 −0.16px; disabled = #b8b2a9 fill + white text (AA-exempt,
// gaps.md #16). Loading keeps the primary fill + label and adds a spinner
// (treatment unspecified in Figma — gaps.md #6). Hover = 90% fill (gaps.md #5).
export function PillButton({
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: PillButtonProps) {
  const inert = Boolean(disabled) || loading;
  return (
    <button
      type={type}
      disabled={inert}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-[var(--button-h)] items-center justify-center gap-2 rounded-full px-[var(--button-px)]",
        "font-display text-[16px] font-bold leading-[1.1] tracking-[-0.16px] text-[var(--text-inverse)]",
        "transition-[background-color,transform,box-shadow] duration-150 ease-out disabled:cursor-not-allowed",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
        disabled && !loading
          ? "bg-[var(--state-inactive)]"
          : /* ═══ 0.97 OVER 150ms, WITH THE SHADOW STEPPING DOWN (arch-H, H12) ═══
               It was `active:scale-[0.99]` with the default transition — a
               press you could not feel. The press now matches `RecordButton`'s
               exactly, because a product where the primary and the secondary
               depress by different amounts reads as two component libraries.
               MOTION-REDUCE IS NOT OPTIONAL: this is the button a supervisor
               presses fifty times a shift. */
            "bg-[var(--text-primary)] hover:bg-[var(--text-primary)]/90 hover:-translate-y-px hover:shadow-[var(--shadow-tile)] active:translate-y-0 active:scale-[0.97] active:shadow-none",
        loading && "pointer-events-none",
        RING,
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
