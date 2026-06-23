"use client";

import { Check } from "lucide-react";
import type { AddressedState, ChangeRequest, MentorDraft } from "@/lib/types";
import { addressedStateOf } from "@/lib/onboarding/change-requests";
import { cn } from "@/lib/utils";

// Progress badge — shown only once an item is ADDRESSED. In a list that's all
// change requests, tagging every unaddressed row "needs a change" is just noise;
// the badge instead marks the positive transition to Updated / Confirmed.
const STATE_BADGE: Partial<Record<AddressedState, { label: string; cls: string }>> =
  {
    edited: { label: "Updated", cls: "bg-emerald-100 text-emerald-800" },
    "confirmed-unchanged": {
      label: "Confirmed",
      cls: "bg-emerald-100 text-emerald-800",
    },
  };

/** Consistent state pill — used by the row, the modal, and the per-step card.
 *  Renders nothing for the default (unaddressed) state. */
export function ChangeStateBadge({ state }: { state: AddressedState }) {
  const badge = STATE_BADGE[state];
  if (!badge) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        badge.cls
      )}
    >
      {badge.label}
    </span>
  );
}

/** Static leading indicator (the modal's read-only list). */
export function StateIcon({ state }: { state: AddressedState }) {
  const done = state !== "none";
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2",
        done
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-foreground/30"
      )}
    >
      {done && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}

/** One change-request row. The BODY (name + state + clamped note + jump link)
 *  renders identically in the welcome modal and the dock — the leading control
 *  and optional footer differ per context (single source of truth for the data). */
export function ChangeRow({
  req,
  draft,
  onJump,
  leading,
  footer,
}: {
  req: ChangeRequest;
  draft: MentorDraft;
  onJump: () => void;
  leading?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const state = addressedStateOf(req, draft);
  return (
    <li className="flex items-start gap-3 px-1 py-3">
      {leading ?? <StateIcon state={state} />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-display text-sm font-bold tracking-tight">
            {req.sectionLabel}
          </p>
          <ChangeStateBadge state={state} />
        </div>
        {/* Free text — clamp to ~2 lines and break long unbroken strings. The
            FULL note lives on the affected step's inline card, not here. */}
        <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
          {req.note}
        </p>
        <button
          type="button"
          onClick={onJump}
          className="mt-1.5 inline-flex min-h-9 items-center rounded-md text-sm font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Go to {req.sectionLabel} →
        </button>
        {footer}
      </div>
    </li>
  );
}
