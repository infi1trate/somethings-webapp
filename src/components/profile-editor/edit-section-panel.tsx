"use client";

import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A warm, friendly accordion panel for the profile editor. Collapsed it shows
 *  the section title + a live summary; expanded it reveals the editor on a gentle
 *  tinted surface and a "where this shows" helper. Opening a panel drives the live
 *  preview's focus (handled by the parent).
 *
 *  `flagged` — the reviewer requested a change here (orange "Needs changes"
 *  treatment, matching the status pill family). `disabled` — the profile is in
 *  review, so editing is locked (non-interactive, dimmed). */
export function EditSectionPanel({
  title,
  helper,
  summary,
  open,
  onToggle,
  children,
  flagged = false,
  disabled = false,
}: {
  title: string;
  helper: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  flagged?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-colors",
        flagged
          ? "border-orange-300 ring-1 ring-orange-200"
          : open
            ? "border-foreground/15 shadow-[0_6px_24px_-14px_rgba(31,30,29,0.25)]"
            : "border-border",
        !disabled && !flagged && !open && "hover:border-foreground/20",
        disabled && "opacity-75"
      )}
    >
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        aria-expanded={open}
        disabled={disabled}
        className="flex w-full items-center gap-4 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 disabled:cursor-default"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[15px] font-bold tracking-tight">
              {title}
            </span>
            {flagged && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                <AlertCircle className="size-3" aria-hidden />
                Needs changes
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {open ? helper : summary || helper}
          </span>
        </span>
        {!disabled && (
          <ChevronDown
            aria-hidden
            className={cn(
              "size-5 shrink-0 text-muted-foreground motion-safe:transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {open && !disabled && (
        <div className="border-t border-border bg-muted/30 px-5 py-5">
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            {helper}
          </p>
          {children}
        </div>
      )}
    </div>
  );
}
