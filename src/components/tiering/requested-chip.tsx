// ═══════════════════════════════════════════════════════════════════════════
// "REQUESTED: TIER N" — the flagged-but-unconfirmed state (pack v1.0)
//
// Beside the current tier, never instead of it: a mentor or the system has
// asked, a supervisor has not confirmed. Dashed, because a dashed outline is
// the house's "not yet" (the suggested-wording button uses it too), and in
// words, so pending is never colour alone. No alert colour of its own — the
// lozenge it sits beside already carries the tier's.
//
// One component for the chat's TierCard, the user record and Monitoring's
// lane, so the three say it the same way.

import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/tiering/tiers";

export function RequestedChip({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      data-requested-tier={tier}
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full border border-dashed border-current px-2 text-[12px] leading-[16px] text-[var(--text-secondary)]",
        className
      )}
    >
      {/* TODO-COPY */}
      Requested: Tier {tier}
    </span>
  );
}
