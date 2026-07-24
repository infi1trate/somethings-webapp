"use client";

// PersonRow (Prompt B) — the ONE shared avatar+name row for the record.
// Replaces ad-hoc person markup at the component level: Overview Mentees,
// Overview Team, and the Mentorship Relationships section all render through
// this, so the person treatment is consistent everywhere at once.
//
// Anatomy: 30px avatar (initial on a rotating soft tint), primary line (name,
// row-value token), secondary line (caption token — role for staff,
// relationship context for mentees), optional trailing element, optional
// chevron when the row navigates. Pressable variant: the whole row is the
// target (≥44px), inset rounded hover/focus highlight, keyboard parity —
// the same rules as the field rows (RecordRow).

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

// Soft, low-chroma tints — the avatar is identity, not status, so these never
// carry meaning; the initial rotates through them by name for variety.
const TINTS = [
  { bg: "#efe7f7", fg: "#5b41a8" },
  { bg: "#e6efe8", fg: "#3a7d44" },
  { bg: "#f2e9df", fg: "#8a5a2b" },
  { bg: "#e6edf3", fg: "#3f5c78" },
  { bg: "#f5e7ea", fg: "#9a4257" },
];

function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

function initial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

export interface PersonRowProps {
  name: string;
  /** Secondary caption: role (staff) or relationship context (mentees). */
  secondary?: React.ReactNode;
  /** Right-aligned element before the chevron (chip, count, recency). */
  trailing?: React.ReactNode;
  /** Provided → the whole row is pressable and shows a trailing chevron. */
  onPress?: () => void;
  className?: string;
}

export function PersonRow({
  name,
  secondary,
  trailing,
  onPress,
  className,
}: PersonRowProps) {
  const tint = tintFor(name);

  const body = (
    <>
      <span
        aria-hidden
        className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
        style={{ backgroundColor: tint.bg, color: tint.fg }}
      >
        {initial(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[var(--text-primary)]"
          style={{ font: "var(--type-row-value)" }}
        >
          {name}
        </span>
        {secondary != null && (
          <span
            className="block truncate text-[var(--text-secondary)]"
            style={{ font: "var(--type-row-label)" }}
          >
            {secondary}
          </span>
        )}
      </span>
      {trailing != null && (
        <span className="flex shrink-0 items-center gap-2">{trailing}</span>
      )}
      {onPress && (
        <ChevronRight
          className="size-3.5 shrink-0 text-[var(--text-muted)]"
          aria-hidden
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        aria-label={`${name} — open`}
        className={cn(
          "group relative flex min-h-11 w-full items-center gap-3 py-1.5 text-left focus-visible:outline-none",
          className
        )}
      >
        {/* Inset rounded highlight — macOS list pattern, matches the field
            rows (canvas tone, 10px radius, 8px in from the card padding). */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-x-3 inset-y-0 rounded-[10px] transition-colors",
            "group-hover:bg-[var(--surface-s1)] group-focus-visible:bg-[var(--surface-s1)]",
            "group-focus-visible:outline-2 group-focus-visible:outline-offset-0 group-focus-visible:outline-[color:var(--focus-ring)]",
            RING
          )}
        />
        {body}
      </button>
    );
  }

  return (
    <div className={cn("flex min-h-11 w-full items-center gap-3 py-1.5", className)}>
      {body}
    </div>
  );
}
