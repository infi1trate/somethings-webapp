"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TIER 1 LANE (proto/monitoring-merge) — always rendered, in both views
//
// Its own group header, then one of two things. Empty: a white surface with
// a hairline and "Nothing in crisis". Live (Alert): the teen on `t1-soft`
// with a 1px `t1` keyline — red ring, name, mentor, the ★ Recommended T1
// chip (display only; confirming is out of scope), the flag signal, the
// presence chip, and a red Join with the response clock running down from
// the 60s window.
//
// JOIN answers the alert (the strip goes) and will open the session; that
// layer (mitigation) is out of scope here — see the TODO on the button.

import { Flag } from "lucide-react";
import { RequestedChip } from "@/components/tiering/requested-chip";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import { answerAlert, responseClock as clock, useResponseSecondsLeft } from "@/lib/monitoring/alert-clock";
import { TierAvatar, TierGroupHeader, TierLozenge } from "@/components/monitoring/overview/tier-bits";
import { cn } from "@/lib/utils";

const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/* The response clock is the alert's one clock (`alert-clock.ts`), shared
   with the strip so the two always agree. */
export function PresenceChip({ text }: { text: string }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border-default)] bg-[var(--surface-raised)] px-2 font-mono text-[11px] leading-none text-[var(--text-secondary)]">
      <span aria-hidden className="size-1.5 rounded-full bg-[var(--ok)]" />
      {text}
    </span>
  );
}

function LiveRow({ teen }: { teen: MonitoringTeen }) {
  const left = useResponseSecondsLeft();
  return (
    <div
      data-t1-live={teen.id}
      className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-[color:var(--t1)] bg-[var(--t1-soft)] px-4 py-2"
    >
      <TierAvatar name={teen.teen} tier={1} />
      <span className="truncate text-[14px] leading-[20px] font-semibold text-[var(--text-primary)]">{teen.teen}</span>
      <TierLozenge tier={1} />
      {/* Secondary, not tertiary: tertiary is 4.39:1 on t1-soft. */}
      <span className="truncate text-[13px] text-[var(--text-secondary)]">{teen.mentor}</span>
      {/* ═══ SUPERSEDED: "★ Recommended T1" → "Requested: Tier 1" ═══ The
          canon's flagged-but-unconfirmed chip, shared with the chat and the
          record. The teen is in this lane at once; the chip is the placement
          still waiting for a supervisor. */}
      {teen.requestedTier !== undefined && <RequestedChip tier={teen.requestedTier} />}
      <span data-t1-flags className="inline-flex shrink-0 items-center gap-1 font-mono text-[13px] tabular-nums text-[var(--t1-ink)]">
        <Flag aria-hidden className="size-3.5" strokeWidth={2} />
        {teen.riskFlags.count} · {teen.riskFlags.window}
        <span className="sr-only"> risk flags</span>
      </span>
      {teen.presence && <PresenceChip text={teen.presence} />}
      <button
        type="button"
        data-t1-join
        onClick={() => {
          /* Joining answers the alert: the strip does not come back. */
          answerAlert();
          /* TODO(monitoring): navigate into the session (the mitigation
             layer), which is out of scope for this merge. */
        }}
        /* TODO-COPY */
        aria-label={`Join session with ${teen.teen}, ${clock(left)} left to respond`}
        className={cn(
          "ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--t1-ink)] px-4 text-[13px] font-semibold text-[var(--text-inverse)] tabular-nums transition hover:brightness-110",
          RING
        )}
      >
        Join · <span className="font-mono">{clock(left)}</span>
      </button>
    </div>
  );
}

export function Tier1Lane({ teens }: { teens: MonitoringTeen[] }) {
  const live = teens.filter((t) => t.tier === 1);
  return (
    <section aria-labelledby="tier-1-heading" data-tier-group={1}>
      <TierGroupHeader tier={1} count={live.length} id="tier-1-heading" />
      {live.length === 0 ? (
        <div
          data-t1-empty
          className="flex min-h-14 items-center rounded-[10px] border border-[color:var(--border-default)] bg-[var(--surface-raised)] px-4 text-[14px] text-[var(--text-tertiary)]"
        >
          {/* TODO-COPY */}
          Nothing in crisis
        </div>
      ) : (
        <div className="space-y-1">
          {live.map((t) => (
            <LiveRow key={t.id} teen={t} />
          ))}
        </div>
      )}
    </section>
  );
}
