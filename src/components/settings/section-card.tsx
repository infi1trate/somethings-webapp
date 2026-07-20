"use client";

import { useId, useState } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export type SectionCardState = "default" | "dirty" | "error";

interface SectionCardProps {
  title: string;
  /** Current-value status line under the title. Strings truncate; pass a node
   *  (e.g. ✓ + text, per Figma's "Photo added") for icon summaries. */
  status?: React.ReactNode;
  state?: SectionCardState;
  /** Reviewer requested a change here (change-request flow). Not in Figma /
   *  §2 — treatment ported from the prototype; design-system-gaps.md #18. */
  flagged?: boolean;
  /** Locked (e.g. profile in review): dimmed + non-interactive.
   *  Not in Figma / §2 — gaps.md #19. */
  disabled?: boolean;
  /** Status chip beside the title (e.g. “In review” — update-review flow). */
  chip?: React.ReactNode;
  /** Always-visible block under the header (e.g. review-team note callout). */
  notice?: React.ReactNode;
  errorMessage?: string;
  onRetry?: () => void;
  /** Controlled expansion; omit and use defaultExpanded for uncontrolled. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (open: boolean) => void;
  children?: React.ReactNode;
  className?: string;
}

// Accordion section card — build-spec §2: radius 21.6, 1px border-subtle,
// padding 17; title Avantt Bold 16/24 + muted 14/20 status line; 44px chevron
// target (WCAG 2.5.8). Header is a real <button> (Enter/Space operable, §6).
// Dirty/error visuals are interims — Figma specs neither (gaps.md #7/#8).
export function SectionCard({
  title,
  status,
  state = "default",
  flagged = false,
  disabled = false,
  chip,
  notice,
  errorMessage = "That didn't save. Try again.",
  onRetry,
  expanded,
  defaultExpanded = false,
  onToggle,
  children,
  className,
}: SectionCardProps) {
  const [internal, setInternal] = useState(defaultExpanded);
  const open = expanded ?? internal;
  const regionId = useId();

  const toggle = () => {
    const next = !open;
    if (expanded === undefined) setInternal(next);
    onToggle?.(next);
  };

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border bg-[var(--surface-s0)] transition-colors",
        state === "error"
          ? "border-[var(--state-error)]/40"
          : flagged
            ? "border-orange-300 ring-1 ring-orange-200"
            : "border-[var(--border-subtle)]",
        disabled && "opacity-75",
        className
      )}
    >
      <button
        type="button"
        onClick={disabled ? undefined : toggle}
        aria-expanded={open}
        aria-controls={regionId}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-4 rounded-[inherit] p-[var(--card-pad)] text-left disabled:cursor-default",
          RING
        )}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
              {title}
            </span>
            {/* A custom chip supersedes the built-in one (update-review flow
                passes its own "Changes requested" chip + flagged border). */}
            {flagged && !chip && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                <AlertCircle className="size-3" aria-hidden />
                Needs changes
              </span>
            )}
            {chip}
          </span>
          {(status || state === "dirty") && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[14px] leading-[20px] text-[var(--text-muted)]">
              {state === "dirty" && (
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full bg-[var(--state-dirty)]"
                />
              )}
              {typeof status === "string" ? (
                <span className="truncate">{status}</span>
              ) : (
                status
              )}
              {state === "dirty" && (
                <span className="shrink-0 font-medium text-[var(--state-dirty)]">
                  {status ? "· " : ""}Unsaved changes
                </span>
              )}
            </span>
          )}
        </span>
        {!disabled && (
          <span className="flex size-[var(--target-min)] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04]">
            <ChevronDown
              aria-hidden
              className={cn(
                "size-5 text-[var(--text-secondary)] transition-transform",
                open && "rotate-180"
              )}
            />
          </span>
        )}
      </button>

      {notice && <div className="px-[var(--card-pad)] pb-3">{notice}</div>}

      {state === "error" && (
        <div className="flex items-center gap-3 px-[var(--card-pad)] pb-3 text-[14px] leading-[20px] text-[var(--state-error)]">
          <span>{errorMessage}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "inline-flex min-h-11 items-center rounded-sm font-medium underline underline-offset-2",
                RING
              )}
            >
              Try again
            </button>
          )}
        </div>
      )}

      <div
        id={regionId}
        role="region"
        aria-label={title}
        hidden={!open || disabled}
        className="px-[var(--card-pad)] pb-[var(--card-pad)]"
      >
        {children ?? (
          <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
            Editing UI mounts here in later phases.
          </p>
        )}
      </div>
    </div>
  );
}
