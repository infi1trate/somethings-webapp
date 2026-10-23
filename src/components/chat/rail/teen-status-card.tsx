"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TEEN STATUS CARD (pack v4.0, Supersession 4) — the Care hero, steady
//
// ═══ SUPERSEDES TierCard + the care brief as two stacked blocks, ON THIS
// HOST ═══ One card, two labelled cells:
//   CLINICAL DIAGNOSIS   the presentation, its ICD code, when it was updated,
//                        and View full care record →
//   RISK TIER            the lozenge, the plain description, the dwell line,
//                        and the role's action (Escalate / Request step-down
//                        for a mentor, Update tier for a supervisor)
// ═══ NO WHOLE-CARD WASH, AT ANY TIER ═══ The tier's colour lives in its
// lozenge and nowhere else on the card — TierCard tinted its whole surface for
// Tiers 1–2. The record's TierCard is unchanged (answered: chat only).
//
// The card is the lightest surface on the panel (raised white over the
// panel's surface-s1), on the soft Bloom elevation.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RequestedChip } from "@/components/tiering/requested-chip";
import { TierActionButton, timeInTier } from "@/components/tiering/tier-card";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import type { TierState } from "@/lib/tiering/events";
import { TIER_DESCRIPTION } from "@/lib/tiering/tiers";
import type { CareBrief } from "@/components/chat/rail/care";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const LABEL = { font: "var(--type-field-label)" } as const;
const BODY = { font: "var(--type-body)" } as const;

/** An overline: 11/16, tracked, uppercase — the cell's label. */
function Overline({ children }: { children: React.ReactNode }) {
  return (
    <p data-overline className="text-[11px] leading-[16px] font-medium tracking-[0.06em] text-[var(--text-muted)] uppercase">
      {children}
    </p>
  );
}

export function TeenStatusCard({
  state,
  now,
  name,
  role,
  brief,
  highlight = false,
  onEscalate,
  onRequestStepDown,
  onUpdateTier,
}: {
  state: TierState;
  now: number;
  name: string;
  role: "mentor" | "supervisor";
  brief: CareBrief;
  /** The tier cell's one-beat arrival after a close (make it magical 3). */
  highlight?: boolean;
  onEscalate?: () => void;
  onRequestStepDown?: () => void;
  onUpdateTier?: () => void;
}) {
  const t = state.tier;
  const pending = state.pending;
  const line = timeInTier(state, now);
  const canAskDown = role === "mentor" && (t === 2 || t === 3) && !pending && !!onRequestStepDown;
  return (
    <section
      data-care-hero="steady"
      data-teen-status
      aria-label={`${name}'s status`}
      className="divide-y divide-[color:var(--border-subtle)] rounded-[16px] bg-[var(--surface-raised)] shadow-[var(--el-soft)]"
    >
      {/* ── CLINICAL DIAGNOSIS ── */}
      <div data-care-brief className="space-y-1 px-4 py-3.5">
        {/* TODO-COPY */}
        <Overline>Clinical diagnosis</Overline>
        {brief.presentation ? (
          <p className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
            {brief.presentation}
            {brief.code && <span data-icd className="ml-1.5 font-mono text-[12px] font-normal text-[var(--text-secondary)]">{brief.code}</span>}
          </p>
        ) : (
          <p className="text-[var(--text-secondary)]" style={BODY}>
            {/* TODO-COPY */}
            No presentation assigned yet.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {brief.freshAt !== null && (
            <span className="tabular-nums text-[var(--text-secondary)]" style={LABEL}>
              {/* TODO-COPY */}
              Updated {DATE.format(brief.freshAt)}
            </span>
          )}
          <Link
            href={brief.href}
            data-care-record
            className={cn("inline-flex min-h-8 items-center gap-1 rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
            style={LABEL}
          >
            {/* TODO-COPY */}
            View full care record <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* ── RISK TIER ── the tier's colour is confined to the lozenge */}
      <div data-tier-card data-tier={t ?? "none"} data-tier-cell className={cn("space-y-1.5 px-4 py-3.5", highlight && "tier-cell-arrive")}>
        {/* TODO-COPY */}
        <Overline>Risk tier</Overline>
        <div className="flex flex-wrap items-center gap-2">
          {t ? <TierLozenge tier={t} long /> : null}
          {pending && <RequestedChip tier={pending.tier} />}
        </div>
        <p className="text-[var(--text-primary)]" style={BODY}>
          {/* TODO-COPY */}
          {t ? TIER_DESCRIPTION[t] : `No tier on file for ${name} yet.`}
        </p>
        {line && (
          <p data-tier-time className="tabular-nums text-[var(--text-secondary)]" style={LABEL}>
            {line}
          </p>
        )}
        {pending && (
          <p data-tier-pending className="text-[var(--text-secondary)]" style={LABEL}>
            {/* TODO-COPY */}
            Waiting for a supervisor to confirm
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1.5">
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
      </div>
    </section>
  );
}
