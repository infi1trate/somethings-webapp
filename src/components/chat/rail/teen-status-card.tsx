"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE TEEN STATUS CARD (pack v4.0, Supersession 4) — the Care hero, steady
//
// ═══ SUPERSEDES TierCard + the care brief as two stacked blocks, ON THIS
// HOST ═══ One card, labelled cells:
//   CLINICAL DIAGNOSIS   supervisor and lead mentor ONLY (pack v5.0,
//                        Supersession 5) — gated here, by role, never by CSS:
//                        a mentor's DOM does not carry it
//   RISK TIER            (pack v5.0, Supersession 6 — the copy diet)
//                        the lozenge is the headline; the dwell is a slim
//                        progress line ("Day 7 of 14"); the description and
//                        the dwell rule live behind a quiet ⓘ; ONE outline
//                        action in a fixed place; a pending request is ONE
//                        status line
// ═══ NO WHOLE-CARD WASH, AT ANY TIER ═══ The tier's colour lives in its
// lozenge and nowhere else on the card. The record's TierCard is unchanged
// (answered: chat only).
//
// The card is the lightest surface on the panel (raised white over the
// panel's surface-s1), on the soft Bloom elevation.

import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { TierActionButton } from "@/components/tiering/tier-card";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dayInTier, type TierState } from "@/lib/tiering/events";
import { TIER_DESCRIPTION, TIER_DWELL_DAYS, TIER_MINIMUM_DAYS, T1_MAX_DAYS, type Tier } from "@/lib/tiering/tiers";
import type { CareBrief } from "@/components/chat/rail/care";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
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

/** The dwell, as numbers: the day, and the period it counts against. */
function dwell(state: TierState, now: number): { day: number; of: number | null; rule: string | null } | null {
  const t = state.tier;
  const day = dayInTier(state, now);
  if (t === null || t === 4 || day === null) return null;
  /* TODO-COPY — the rules, which moved behind the ⓘ. */
  if (t === 1) return { day, of: T1_MAX_DAYS, rule: `Tier 1 is held ${T1_MAX_DAYS} day at a time.` };
  const min = TIER_MINIMUM_DAYS[t];
  if (min) return { day, of: min, rule: `Tier ${t} has a ${min}-day minimum.` };
  const d = TIER_DWELL_DAYS[t];
  if (d) return { day, of: d, rule: `Steps down after ${d} days unless renewed.` };
  return { day, of: null, rule: null };
}

export function TeenStatusCard({
  state,
  now,
  name,
  role,
  showDiagnosis,
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
  /** Supervisor or lead mentor: the Clinical diagnosis cell renders. */
  showDiagnosis: boolean;
  brief: CareBrief;
  /** The tier cell's one-beat arrival after a close (make it magical 3). */
  highlight?: boolean;
  onEscalate?: () => void;
  onRequestStepDown?: () => void;
  onUpdateTier?: () => void;
}) {
  const t = state.tier;
  const pending = state.pending;
  const d = dwell(state, now);
  const canAskDown = role === "mentor" && (t === 2 || t === 3) && !pending && !!onRequestStepDown;
  return (
    <section
      data-care-hero="steady"
      data-teen-status
      aria-label={`${name}'s status`}
      className="divide-y divide-[color:var(--border-subtle)] rounded-[16px] bg-[var(--surface-raised)] shadow-[var(--el-soft)]"
    >
      {/* ── CLINICAL DIAGNOSIS — supervisor and lead only ── */}
      {showDiagnosis && (
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
      )}

      {/* ── RISK TIER ── the tier's colour is confined to the lozenge */}
      <div data-tier-card data-tier={t ?? "none"} data-tier-cell className={cn("space-y-2 px-4 py-3.5", highlight && "tier-cell-arrive")}>
        {/* TODO-COPY */}
        <Overline>Risk tier</Overline>
        <div className="flex items-center gap-1.5">
          {t ? (
            <TierLozenge tier={t} long />
          ) : (
            <span className="text-[var(--text-secondary)]" style={BODY}>
              {/* TODO-COPY */}
              No tier on file for {name} yet.
            </span>
          )}
          {t && <TierInfo tier={t} rule={d?.rule ?? null} onRequestStepDown={canAskDown ? onRequestStepDown : undefined} />}
        </div>
        {pending ? (
          /* ═══ ONE STATUS LINE (Supersession 6) ═══ It replaces the chip AND
             "Waiting for a supervisor to confirm" — one fact, one line. */
          <p data-tier-pending className="text-[var(--text-secondary)]" style={LABEL}>
            {/* TODO-COPY */}
            Requested: Tier {pending.tier} · awaiting confirmation
          </p>
        ) : (
          d && <DwellLine day={d.day} of={d.of} since={t === 1 ? state.since : null} />
        )}
        <div className="pt-0.5">
          {role === "mentor" && onEscalate && (
            <TierActionButton slot="escalate" onClick={onEscalate}>
              {/* TODO-COPY */}
              Escalate
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

/** ═══ THE DWELL, AS A LINE (Supersession 6) ═══ A 2px track and "Day 7 of
 *  14" — the sentence ("steps down unless renewed") is the ⓘ's. Tier 1 has
 *  no period to fill; it says when it began. */
function DwellLine({ day, of, since }: { day: number; of: number | null; since: number | null }) {
  if (since !== null)
    return (
      <p data-tier-time className="tabular-nums text-[var(--text-secondary)]" style={LABEL}>
        {/* TODO-COPY */}
        Since {TIME.format(since)}
      </p>
    );
  return (
    <div data-tier-time className="space-y-1">
      {of !== null && (
        <div aria-hidden data-dwell-track className="h-0.5 overflow-hidden rounded-full bg-[var(--border-subtle)]">
          <div className="h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${Math.min(100, (day / of) * 100)}%` }} />
        </div>
      )}
      <p className="tabular-nums text-[var(--text-secondary)]" style={LABEL}>
        {/* TODO-COPY */}
        {of !== null ? `Day ${day} of ${of}` : `Day ${day}`}
      </p>
    </div>
  );
}

/** ═══ THE QUIET ⓘ ═══ The tier's description and its dwell rule, on
 *  demand; and, for a mentor at Tier 2–3, the step-down request — kept, but
 *  off the card's one-action line. */
function TierInfo({ tier, rule, onRequestStepDown }: { tier: Tier; rule: string | null; onRequestStepDown?: () => void }) {
  return (
    <Popover>
      <PopoverTrigger
        data-tier-info
        aria-label={`About Tier ${tier}`}
        className={cn("relative inline-flex size-6 items-center justify-center rounded-full text-[var(--icon-secondary)] hover:bg-[var(--tint-hover)] before:absolute before:-inset-2.5 before:content-['']", RING)}
      >
        <Info aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2">
        <p data-tier-description className="text-[var(--text-primary)]" style={BODY}>
          {TIER_DESCRIPTION[tier]}
        </p>
        {rule && (
          <p data-tier-rule className="text-[var(--text-secondary)]" style={LABEL}>
            {rule}
          </p>
        )}
        {onRequestStepDown && (
          <button
            type="button"
            data-tier-action="request-step-down"
            onClick={onRequestStepDown}
            className={cn("inline-flex min-h-8 items-center rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
            style={LABEL}
          >
            {/* TODO-COPY */}
            Request step-down
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
