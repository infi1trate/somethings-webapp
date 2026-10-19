"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TIER 1 ALERT STRIP (proto/monitoring-merge)
//
// At the top of the Monitoring canvas, under the console top bar: the
// `--state-error` red, a pulsing dot (still there under reduced motion, so
// the pulse is never the only signal), "Tier 1 · {mentor} flagged {teen} ·
// unconfirmed · note + C-SSRS · {time}", the response clock in a mono chip,
// Join session (white, primary) and Acknowledge. `role="alert"`. It shows
// only in an alert scenario, and persists until joined or acknowledged
// (`alert-clock.ts`); Tiers 2–4 never raise one.
//
// INK IS `--text-inverse`, NOT WHITE. In dark `--state-error` is tangelo/400,
// a LIGHT red, and white on it measured 2.78:1; the token file's own pairing
// rule ("fill --text-primary, write --text-inverse") gives white in light —
// unchanged — and warmGrey/950 in dark.
//
// NOT `StatusBanner`: that is the conversation's escalation banner — a soft
// critical tint with `role="status"`, because it is present on every render
// of a thread. This one interrupts once, on a solid red, which is why it is
// its own component.

import { Clock } from "lucide-react";
import type { MonitoringTeen } from "@/lib/monitoring/tier-roster";
import { answerAlert, responseClock, useAlertState, useResponseSecondsLeft } from "@/lib/monitoring/alert-clock";
import { cn } from "@/lib/utils";

const RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--text-inverse)]";
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function Tier1AlertStrip({ teens }: { teens: MonitoringTeen[] }) {
  const { startedAt, answered } = useAlertState();
  const left = useResponseSecondsLeft();
  const teen = teens.find((t) => t.tier === 1);
  if (answered || !teen || startedAt === null) return null;

  return (
    <div
      role="alert"
      data-alert-strip
      className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-xl bg-[var(--state-error)] px-3.5 py-2.5 text-[var(--text-inverse)] select-none"
    >
      <span aria-hidden data-alert-dot className="motion-safe:animate-pulse size-2.5 shrink-0 rounded-full bg-[var(--text-inverse)]" />
      {/* Real spaces between the parts, so the text reads as the sentence.
          The 240px floor is what wraps the clock and the two actions onto
          their own line on a phone, rather than squeezing the sentence to
          nothing (`attention-card.tsx`'s flex-wrap banner). TODO-COPY. */}
      <p data-alert-text className="m-0 flex min-w-[min(100%,240px)] flex-1 flex-wrap items-baseline gap-x-1.5 text-[14px] leading-[20px]">
        <span className="font-display font-bold">Tier 1</span>{" "}
        <span>· {teen.mentor} flagged {teen.teen}</span>{" "}
        <span className="text-[13px]">· unconfirmed · note + C-SSRS · {TIME.format(startedAt)}</span>
      </p>
      {/* Pushes the red AWAY from the text: white over a white wash measured
          ~3.6:1 for 12px text. `--text-primary` is the text's opposite in both
          themes (dark under light's white text, light under dark's), so one
          wash darkens in light and lightens in dark. */}
      <span data-alert-timer className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--text-primary)_20%,transparent)] px-2 py-1 font-mono text-[12px] tabular-nums">
        <Clock aria-hidden className="size-3" strokeWidth={2.5} />
        {responseClock(left)} left
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          data-alert-join
          onClick={() => {
            answerAlert();
            /* TODO(monitoring): navigate into the session (the mitigation
               layer), out of scope for this merge. */
          }}
          className={cn("h-8 rounded-lg bg-[var(--text-inverse)] px-3 text-[13px] font-semibold text-[var(--state-error)] transition hover:opacity-90", RING)}
        >
          {/* TODO-COPY */}
          Join session
        </button>
        <button
          type="button"
          data-alert-ack
          onClick={answerAlert}
          className={cn("h-8 rounded-lg border border-[color-mix(in_srgb,var(--text-inverse)_70%,transparent)] px-3 text-[13px] font-medium text-[var(--text-inverse)] transition hover:bg-[color-mix(in_srgb,var(--text-inverse)_15%,transparent)]", RING)}
        >
          {/* TODO-COPY */}
          Acknowledge
        </button>
      </div>
    </div>
  );
}
