// Mentor STATUS badge (primary standing) + AVAILABILITY cell (secondary state)
// for the Mentors roster + record. Two deliberately different weights so the
// columns don't compete: Status is a filled tint pill with an icon; Availability
// is a light dot + label (no fill), mirroring the record's dot+text idiom.
//
// WCAG 1.4.1: color is never the sole signal — Status carries a Lucide icon +
// text label, Availability a text label (dot is aria-hidden). Contrast of every
// pairing is >= 4.5:1.

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  STATUS_BADGE,
  STATUS_ORDER,
  AVAILABILITY_LABELS,
} from "@/lib/record/mentor-status";
import type {
  MentorAvailability,
  MentorLifecycleStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Primary standing — filled tint pill + icon + label (icon decorative). */
export function MentorStatusBadge({
  status,
  className,
}: {
  status: MentorLifecycleStatus;
  className?: string;
}) {
  const { label, icon: Icon, className: tint } = STATUS_BADGE[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tint,
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Editable variant — the status badge as a menu button that lets staff (lead +
 * supervisor) change a mentor's lifecycle status inline. Built on the shared
 * DropdownMenu primitive (menu-button a11y: aria-haspopup="menu", roving arrow
 * keys, Esc-restore). Each item is name-tied for a screen reader. Used in the
 * roster Status cell and the record's Organization "Status" row.
 */
export function MentorStatusMenu({
  status,
  name,
  onChange,
}: {
  status: MentorLifecycleStatus;
  /** Person name — for the accessible action labels. */
  name: string;
  onChange: (next: MentorLifecycleStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${name} — status ${STATUS_BADGE[status].label}. Change status`}
          className="group/st inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <MentorStatusBadge status={status} />
          <ChevronDown
            className="size-3.5 text-[var(--text-muted)] transition-transform group-data-[state=open]/st:rotate-180"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuLabel>Set status</DropdownMenuLabel>
        {STATUS_ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => onChange(s)}
            aria-label={`Set ${name}'s status to ${STATUS_BADGE[s].label}`}
            aria-current={s === status || undefined}
          >
            <MentorStatusBadge status={s} />
            {s === status && (
              <Check className="ml-auto size-4 text-[var(--text-secondary)]" aria-hidden />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Dot color per availability — secondary, so a small aria-hidden dot reusing the
// record's --dot-* standing tokens; the text label carries the meaning.
const DOT: Record<MentorAvailability, string> = {
  accepting: "var(--dot-positive)",
  full: "var(--dot-warning)",
  "not-accepting": "var(--state-inactive)",
};

/** Secondary state — light dot + label, or a muted "—" when not applicable. */
export function AvailabilityCell({
  value,
}: {
  value: MentorAvailability | null;
}) {
  if (value === null) {
    return (
      <span className="text-[var(--text-muted)]" aria-hidden={false}>
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px]",
        value === "not-accepting"
          ? "text-[var(--text-muted)]"
          : "text-[var(--text-secondary)]"
      )}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: DOT[value] }}
        aria-hidden
      />
      {AVAILABILITY_LABELS[value]}
    </span>
  );
}

/**
 * Editable availability — staff toggle the ACCEPTING INTENT (Accepting ↔ Not
 * accepting). "Full" is derived from the caseload and shown read-only on the
 * trigger; when at cap the intent still toggles (it takes effect once a slot
 * frees). When availability is n/a (status can't mentor) there is no menu — a
 * muted "—". Used in the roster Availability cell and the record.
 */
export function AvailabilityMenu({
  value,
  accepting,
  atCap,
  name,
  onChange,
}: {
  /** Derived availability for the trigger (null = n/a → plain "—"). */
  value: MentorAvailability | null;
  /** Current stored intent (independent of the derived "Full"). */
  accepting: boolean;
  /** At caseload cap → the derived display is "Full". */
  atCap: boolean;
  name: string;
  onChange: (accepting: boolean) => void;
}) {
  if (value === null) return <AvailabilityCell value={null} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${name} — availability ${AVAILABILITY_LABELS[value]}. Change availability`}
          className="group/av inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <AvailabilityCell value={value} />
          <ChevronDown
            className="size-3.5 text-[var(--text-muted)] transition-transform group-data-[state=open]/av:rotate-180"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>Set availability</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => onChange(true)}
          aria-label={`Set ${name} to Accepting`}
          aria-current={accepting || undefined}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--dot-positive)" }}
            aria-hidden
          />
          Accepting
          {accepting && (
            <Check className="ml-auto size-4 text-[var(--text-secondary)]" aria-hidden />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onChange(false)}
          aria-label={`Set ${name} to Not accepting`}
          aria-current={!accepting || undefined}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--state-inactive)" }}
            aria-hidden
          />
          Not accepting
          {!accepting && (
            <Check className="ml-auto size-4 text-[var(--text-secondary)]" aria-hidden />
          )}
        </DropdownMenuItem>
        {atCap && (
          <p className="px-2.5 pt-1.5 text-[11px] leading-tight text-[var(--text-muted)]">
            Every mentee slot is taken — shows as Full until one frees.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
