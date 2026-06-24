"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A warm, friendly accordion panel for the admin profile editor — softer than
 *  the review screen's flag-oriented cards. Collapsed it shows the section title
 *  + a live summary; expanded it reveals the editor on a gentle tinted surface
 *  and a one-line "where this shows" helper. Opening a panel is what drives the
 *  live preview's focus (handled by the parent). */
export function EditSectionPanel({
  title,
  helper,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  /** One line describing where this section appears on the teen-facing profile. */
  helper: string;
  /** Compact current-value summary, shown when collapsed. */
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-colors",
        open
          ? "border-foreground/15 shadow-[0_6px_24px_-14px_rgba(31,30,29,0.25)]"
          : "border-border hover:border-foreground/20"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-bold tracking-tight">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {open ? helper : summary || helper}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-5 shrink-0 text-muted-foreground motion-safe:transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
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
