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
        "font-display text-[16px] font-bold leading-[1.1] tracking-[-0.16px] text-white",
        "transition disabled:cursor-not-allowed",
        disabled && !loading
          ? "bg-[var(--state-inactive)]"
          : "bg-[var(--text-primary)] hover:bg-[var(--text-primary)]/90 active:scale-[0.99]",
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
