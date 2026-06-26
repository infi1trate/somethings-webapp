"use client";

import type { AddressedState } from "@/lib/types";
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

/** Consistent state pill — used by the per-step "from the review team" note card.
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
