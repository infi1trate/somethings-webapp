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
import { useRouter } from "next/navigation";
import { monitoringEntryHref } from "@/lib/monitoring/entry-href";
import { RequestedChip } from "@/components/tiering/requested-chip";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import { answerAlert, responseClock as clock, useResponseSecondsLeft } from "@/lib/monitoring/alert-clock";
import { TierAvatar, TierGroupHeader, TierTag } from "@/components/monitoring/overview/tier-bits";
import { cn } from "@/lib/utils";

const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/* The response clock is the alert's one clock (`alert-clock.ts`), shared
   with the strip so the two always agree. */
export function PresenceChip({ text }: { text: string }) {
  return (
    /* Monitoring v2: sans, and no dot of its own — the avatar's presence dot
       is the one ring; the chip says who. */
    <span data-presence-chip className="inline-flex h-5 shrink-0 items-center rounded-full bg-[var(--surface-sunken)] px-2 text-[12px] leading-[16px] text-[var(--text-secondary)]">
      {text}
    </span>
  );
}

function LiveRow({ teen }: { teen: MonitoringTeen }) {
  const left = useResponseSecondsLeft();
  const router = useRouter();
  const link = monitoringEntryHref(teen);
  return (
    <div
      data-t1-live={teen.id}
      /* THE ONE KEYLINE (Monitoring v2): the live Tier 1 lane keeps its t1
         line; every other surface is tint and elevation. */
      className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] border border-[color:var(--t1)] bg-[var(--t1-soft)] px-4 py-3"
    >
      <TierAvatar name={teen.teen} live={!!teen.presence} />
      <span className="truncate font-display text-[15px] leading-[20px] font-bold text-[var(--text-primary)]">{teen.teen}</span>
      <TierTag tier={1} />
      {/* Secondary, not tertiary: tertiary is 4.39:1 on t1-soft. */}
      <span className="truncate text-[13px] text-[var(--text-secondary)]">{teen.mentor}</span>
      {/* The live stage (pack v5.0, C4), one quiet fragment. */}
      {teen.stage && <span data-teen-stage className="truncate text-[13px] text-[var(--text-secondary)]">· {teen.stage}</span>}
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
          /* pack v3.0: and goes into the conversation — the supervisor's
             only door into a chat now that Chats left their nav. */
          if (link) router.push(link.href);
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
        /* ═══ THE SAME EMPTY LANE IN BOTH VIEWS (Monitoring v3, §3) ═══ A 1px
           dashed contour, 20px radius, centred, NO FILL — the canvas fill was
           invisible on the cards view's canvas (canvas on canvas). */
        <div
          data-t1-empty
          className="flex min-h-16 items-center justify-center rounded-[20px] border border-dashed border-[color:var(--border-default)] px-4 text-[15px] leading-[20px] text-[var(--text-secondary)]"
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
