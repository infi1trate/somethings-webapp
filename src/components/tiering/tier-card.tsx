"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TierCard — where a teen sits, built once (Tiering & Escalation pack, Phase 1)
//
// Consumed by the chat's Care tab and the user record's Overview, from the
// same `TierState`, so the two cannot show different tiers for one teen.
//
// Anatomy: the long lozenge ("T2 · High risk") with the pending chip beside
// it, a plain-language line, time in tier for Tiers 1–3, and ONE quiet
// action. The surface follows the canon's signifiers — T1 the red lane, T2
// the amber inset, T3 elevation, T4 a hairline — and is never the only
// signal: the name is always in text (WCAG 1.4.1).
//
// ═══ ROLE DECIDES THE ACTION, NOT THE CARD ═══
//   mentor      → "Escalate" (ghost, never red while dormant) and, on Tier 2
//                 or 3, "Request step-down". Never a direct step down.
//   supervisor  → "Update tier", which opens TierUpdateModule.
//   read-only   → nothing.
// An absent action is absent, not disabled — the house's read-wide,
// act-narrow rule (care-tab.tsx).

import { TierLozenge } from "@/components/ui/tier-lozenge";
import { RequestedChip } from "@/components/tiering/requested-chip";
import { dayInTier, type TierState } from "@/lib/tiering/events";
import {
  T1_MAX_DAYS,
  TIER_DESCRIPTION,
  TIER_DWELL_DAYS,
  TIER_MINIMUM_DAYS,
  type Tier,
} from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The canon's surfaces. Text on the T1/T2 tints is secondary or primary —
 *  tertiary measures 4.39:1 on t1-soft. */
const SURFACE: Record<Tier, string> = {
  1: "border border-[color:var(--t1)] bg-[var(--t1-soft)]",
  2: "border border-transparent bg-[var(--t2-soft)]",
  3: "border border-transparent bg-[var(--surface-raised)] shadow-[var(--elevation-1)]",
  4: "border border-[color:var(--border-default)] bg-transparent",
};

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** "Day 3 of the 7-day minimum" — TODO-COPY. */
export function timeInTier(state: TierState, now: number): string | null {
  const t = state.tier;
  const day = dayInTier(state, now);
  if (t === null || t === 4 || day === null || state.since === null) return null;
  if (t === 1) return `In Tier 1 since ${TIME.format(state.since)} · ${T1_MAX_DAYS} day at a time`;
  const min = TIER_MINIMUM_DAYS[t];
  if (min) return `Day ${day} of the ${min}-day minimum`;
  const dwell = TIER_DWELL_DAYS[t];
  if (dwell) return `Day ${day} of ${dwell} · steps down unless renewed`;
  return `Day ${day} in this tier`;
}

export function TierActionButton({
  children,
  onClick,
  slot,
}: {
  children: React.ReactNode;
  onClick: () => void;
  slot: string;
}) {
  return (
    <button
      type="button"
      data-tier-action={slot}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--border-contour)] px-3.5 text-[var(--text-primary)]",
        "transition-colors hover:bg-[var(--tint-hover)]",
        RING
      )}
      style={{ font: "var(--type-body)" }}
    >
      {children}
    </button>
  );
}

export function TierCard({
  state,
  now,
  name,
  role,
  onEscalate,
  onRequestStepDown,
  onUpdateTier,
  className,
}: {
  state: TierState;
  now: number;
  /** The teen's first name. */
  name: string;
  role: "mentor" | "supervisor" | "read-only";
  /** Omitted while an escalation is already open — one at a time. */
  onEscalate?: () => void;
  onRequestStepDown?: () => void;
  onUpdateTier?: () => void;
  className?: string;
}) {
  const t = state.tier;
  const pending = state.pending;
  const line = timeInTier(state, now);
  /* A mentor may ask to step down from Tier 2 or 3 outside a crisis; Tier 1's
     only exit is the crisis note, and a request already pending is enough. */
  const canAskDown = role === "mentor" && (t === 2 || t === 3) && !pending && !!onRequestStepDown;

  return (
    <section
      data-tier-card
      data-tier={t ?? "none"}
      aria-label={`${name}'s tier`}
      className={cn("rounded-[var(--radius-inset)] px-4 py-3.5", t ? SURFACE[t] : "border border-dashed border-[color:var(--border-default)]", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        {t ? <TierLozenge tier={t} long /> : null}
        {pending && <RequestedChip tier={pending.tier} />}
      </div>
      <p className="mt-2 text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
        {/* TODO-COPY */}
        {t ? TIER_DESCRIPTION[t] : `No tier on file for ${name} yet.`}
      </p>
      {line && (
        <p data-tier-time className="mt-0.5 tabular-nums text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
          {line}
        </p>
      )}
      {pending && (
        <p data-tier-pending className="mt-0.5 text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          Waiting for a supervisor to confirm
        </p>
      )}

      {role !== "read-only" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {role === "mentor" && onEscalate && (
            <TierActionButton slot="escalate" onClick={onEscalate}>
              {/* TODO-COPY */}
              Escalate
            </TierActionButton>
          )}
          {canAskDown && (
            <TierActionButton slot="request-step-down" onClick={onRequestStepDown!}>
              {/* TODO-COPY */}
              Request step-down
            </TierActionButton>
          )}
          {role === "supervisor" && onUpdateTier && (
            <TierActionButton slot="update-tier" onClick={onUpdateTier}>
              {/* TODO-COPY */}
              Update tier
            </TierActionButton>
          )}
        </div>
      )}
    </section>
  );
}
