"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CARE HERO — the card at the top of the Care panel
//
// ═══ THE FCP-3 HERO CARD (Figma 6058:9828, 2026-10-28) ═══ SUPERSEDES pack
// v11.0 §4's five sections (identity · the mentorship · risk tier · six
// metrics · the diagnosis). Three sections, split by hairlines:
//
//   HEADER   avatar · name · "15 yo · She/her · North Carolina" · View record
//   FACTS    two columns, label over value:
//              Mentor (a supervisor's view) / Supervisor (a mentor's — they
//              are the mentor) · Days with mentor · Days on platform ·
//              Engaged days (last 14d) · Escalations (30d) · Risk Flags (30d)
//   TIER     "Risk Tier": the tier's name and its lozenge, the ⓘ, and the
//            lens's one action on the right (Update tier · Escalate)
//
// What the design asks for that the data cannot honestly give, each stated
// at its own line rather than faked:
//   · ENGAGED DAYS IS BLOCKED (Meg): no definition and no per-day log, so the
//     value is "—" ("Not available yet") and the 14-day bars do not render —
//     a sparkline of invented days would be a chart of nothing.
//   · NO PRESENCE DOT on the avatar: nothing records whether a teen is online.
//   · THE DIAGNOSIS LEFT THE HERO, as in the design: View record is one tap
//     to it for a supervisor or lead. A mentor's View record opens the
//     Profile tab — their DOM still holds no diagnosis, code or record link.
//   · The dwell ("Day 7 of 14") moved behind the ⓘ with the tier's rule and
//     the mentor's step-down request: the design's tier row is one line.
//
// The card is the lightest surface on the panel (raised white over the
// panel's surface-s1), on the soft Bloom elevation. Weight is not a channel
// (only Lausanne 400 ships), so emphasis is Avantt.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Flag, Info, ShieldAlert } from "lucide-react";
import { TierActionButton } from "@/components/tiering/tier-card";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dayInTier, type TierState } from "@/lib/tiering/events";
import { TIER_DESCRIPTION, TIER_DWELL_DAYS, TIER_MINIMUM_DAYS, TIER_NAME, T1_MAX_DAYS, type Tier } from "@/lib/tiering/tiers";
import type { TeenIdentity } from "@/lib/record/mentorship-vitals";
import type { HeroMetrics } from "@/lib/record/hero-metrics";
import { RecordAvatar } from "@/components/record/record-avatar";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const LABEL = { font: "var(--type-field-label)" } as const;
const BODY = { font: "var(--type-body)" } as const;
/** The name and every value: Avantt 16/24. */
const HEADLINE = { font: "var(--type-card-title)" } as const;

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


/** Who the facts' first cell names: the pair's other adult. */
export interface HeroPerson {
  role: "Mentor" | "Supervisor";
  name: string;
}

export function CareHero({
  name,
  identity,
  person,
  metrics,
  record,
  tierCell,
}: {
  /** The teen's first name — for the region's label. */
  name: string;
  identity: TeenIdentity | null;
  /** A supervisor's view names the mentor; a mentor's, their supervisor. */
  person: HeroPerson | null;
  metrics: HeroMetrics;
  /** View record: the care record (supervisor, lead) or the Profile tab. */
  record: { href: string; label: string } | null;
  tierCell: React.ReactNode;
}) {
  return (
    <section
      data-care-hero="steady"
      data-care-header
      data-teen-status
      aria-label={`${name}'s care`}
      className="divide-y divide-[color:var(--border-subtle)] rounded-[16px] bg-[var(--surface-raised)] shadow-[var(--el-soft)]"
    >
      <HeaderSection identity={identity} record={record} />
      <FactsSection person={person} identity={identity} metrics={metrics} />
      {tierCell}
    </section>
  );
}

/** ═══ HEADER ═══ Avatar, name, one meta line of facts on file, and View
 *  record — a tonal pill, so the tier row's action stays the card's one
 *  outlined decision and nothing here is a filled primary. */
function HeaderSection({ identity, record }: { identity: TeenIdentity | null; record: { href: string; label: string } | null }) {
  if (!identity) return null;
  /* TODO-COPY */
  const meta = [identity.age !== null ? `${identity.age} yo` : null, identity.pronouns, identity.location].filter(Boolean).join(" · ");
  return (
    <div data-care-identity className="flex items-center gap-3 px-4 py-4">
      <RecordAvatar name={identity.name} size={32} />
      <div className="min-w-0 flex-1">
        <p data-identity-name className="m-0 truncate text-[var(--text-primary)]" style={HEADLINE}>
          {identity.name}
        </p>
        {meta && (
          <p data-identity-meta className="m-0 truncate text-[var(--text-secondary)]" style={LABEL}>
            {meta}
          </p>
        )}
      </div>
      {record && (
        <Link
          href={record.href}
          data-care-record
          aria-label={record.label}
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center rounded-full border border-[color:var(--border-default)] bg-[var(--surface-sunken)] px-4 font-display text-[14px] leading-[20px] font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-sunken-strong)]",
            RING
          )}
        >
          {/* TODO-COPY */}
          View record
        </Link>
      )}
    </div>
  );
}

/** One fact: a 12/16 secondary label over an Avantt 16/24 value. */
function Fact({ slot, label, children }: { slot: string; label: string; children: React.ReactNode }) {
  return (
    <div data-metric={slot} className="min-w-0 space-y-0.5">
      <p className="m-0 text-[var(--text-secondary)]" style={LABEL}>
        {label}
      </p>
      <div data-metric-value className="flex min-h-6 min-w-0 items-center gap-1.5 tabular-nums text-[var(--text-primary)]" style={HEADLINE}>
        {children}
      </div>
    </div>
  );
}

/** ═══ FACTS ═══ Two columns, three rows. Zero is a value and renders `0`;
 *  absent is not zero — a fact with no source says so, never a number. */
function FactsSection({ person, identity, metrics }: { person: HeroPerson | null; identity: TeenIdentity | null; metrics: HeroMetrics }) {
  /* ═══ THE STAT THAT KNOWS WHAT JUST HAPPENED ═══ When the escalation count
     rises in session its value settles once — a DOM class on change, never
     on first paint; stilled under reduced motion. */
  const prev = useRef(metrics.escalations);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = metrics.escalations;
    if (was === null || metrics.escalations === null || metrics.escalations <= was) return;
    const v = box.current?.querySelector("[data-metric='escalations'] [data-metric-value]");
    if (!v) return;
    v.classList.remove("tier-settle");
    void (v as HTMLElement).offsetWidth;
    v.classList.add("tier-settle");
  }, [metrics.escalations]);
  const value = (n: number | null) =>
    n === null ? (
      <span data-metric-absent className="text-[var(--text-muted)]">
        <span aria-hidden>—</span>
        <span className="sr-only">Not available yet</span>
      </span>
    ) : (
      n
    );
  /* TODO-COPY, every label. Windows are a BLOCKED CONSTANT (Meg). */
  return (
    <div ref={box} data-care-metrics className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4">
      <Fact slot="person" label={person?.role ?? "Mentor"}>
        {person ? (
          <span data-hero-person className="flex min-w-0 items-center gap-2" style={BODY}>
            <RecordAvatar name={person.name} size={20} />
            <span className="truncate">{person.name}</span>
          </span>
        ) : (
          value(null)
        )}
      </Fact>
      <Fact slot="days" label="Days with mentor">{value(metrics.daysInMentorship)}</Fact>
      <Fact slot="platform" label="Days on platform">{value(identity?.daysOnPlatform ?? null)}</Fact>
      {/* BLOCKED (Meg): "engaged days" is undefined and no per-day log
          exists. The slot renders; a number and its bars never do. */}
      <Fact slot="engaged" label="Engaged days (last 14d)">{value(metrics.engagedDays)}</Fact>
      <Fact slot="escalations" label="Escalations (30d)">
        <ShieldAlert aria-hidden className="size-4 shrink-0 text-[var(--icon-secondary)]" strokeWidth={2} />
        {value(metrics.escalations)}
      </Fact>
      <Fact slot="flags" label="Risk Flags (30d)">
        <Flag aria-hidden className="size-4 shrink-0 text-[var(--icon-secondary)]" strokeWidth={2} />
        {value(metrics.flags)}
      </Fact>
    </div>
  );
}

/** ═══ RISK TIER — the same row in both lenses ═══ The tier's name and its
 *  lozenge, the ⓘ (description, dwell, the mentor's step-down request), and
 *  the lens's one action. The tier's colour is confined to the lozenge. */
export function TierCell({
  state,
  now,
  name,
  role,
  highlight = false,
  onEscalate,
  onRequestStepDown,
  onUpdateTier,
}: {
  state: TierState;
  now: number;
  name: string;
  role: "mentor" | "supervisor";
  /** The tier cell's one-beat arrival after a close (v4.0, make it magical 3). */
  highlight?: boolean;
  onEscalate?: () => void;
  onRequestStepDown?: () => void;
  onUpdateTier?: () => void;
}) {
  const t = state.tier;
  const pending = state.pending;
  const d = dwell(state, now);
  const canAskDown = role === "mentor" && (t === 2 || t === 3) && !pending && !!onRequestStepDown;
  /* ═══ THE HERO THAT HOLDS ITS GROUND (make it magical 1) ═══ The lozenge
     is the one thing that moves: when the tier changes in session it
     crossfades to its new value and the "Day 1 of N" caption resets beneath
     it, in the same beat (`tier-settle`, stilled under reduced motion). A
     DOM class on CHANGE, never on first paint. */
  const prevTier = useRef(t);
  const beat = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prevTier.current === t) return;
    prevTier.current = t;
    for (const el of beat.current?.querySelectorAll("[data-tier-beat]") ?? []) {
      el.classList.remove("tier-settle");
      void (el as HTMLElement).offsetWidth;
      el.classList.add("tier-settle");
    }
  }, [t]);
  const action =
    role === "mentor" && onEscalate ? (
      <TierActionButton slot="escalate" onClick={onEscalate}>
        {/* TODO-COPY */}
        Escalate
      </TierActionButton>
    ) : role === "supervisor" && onUpdateTier ? (
      <TierActionButton slot="update-tier" onClick={onUpdateTier}>
        {/* TODO-COPY */}
        Update tier
      </TierActionButton>
    ) : null;
  return (
    /* the tier's colour is confined to the lozenge */
      <div ref={beat} data-tier-card data-tier={t ?? "none"} data-tier-cell className={cn("space-y-0.5 px-4 py-4", highlight && "tier-cell-arrive")}>
        <p data-overline className="m-0 text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY */}
          Risk Tier
        </p>
        {/* ═══ 4.3 · VALUE LEFT, ACTION RIGHT ═══ Mentor → Escalate,
            supervisor → Update tier, both opening TierSelect. While an
            escalation is open the action is suppressed in both lenses: the
            live decision is the Escalation review tab's, and two doors to
            one decision in one panel is the duplication the tab exists to
            prevent (a design decision for Brandon to confirm). */}
        <div className="flex min-h-10 items-center gap-1.5">
          {t ? (
            <span data-tier-beat className="inline-flex min-w-0 items-center gap-2">
              <span data-tier-name className="truncate text-[var(--text-primary)]" style={HEADLINE}>
                {TIER_NAME[t]}
              </span>
              <TierLozenge tier={t} />
            </span>
          ) : (
            <span className="text-[var(--text-secondary)]" style={BODY}>
              {/* TODO-COPY */}
              No tier on file for {name} yet.
            </span>
          )}
          {t && <TierInfo tier={t} rule={d?.rule ?? null} dwell={d ? dwellText(d, t === 1 ? state.since : null) : null} onRequestStepDown={canAskDown ? onRequestStepDown : undefined} />}
          {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
        {pending && (
          /* ═══ ONE STATUS LINE ═══ The request, awaiting a supervisor. */
          <p data-tier-pending className="m-0 text-[var(--text-secondary)]" style={LABEL}>
            {/* TODO-COPY */}
            Requested: Tier {pending.tier} · awaiting confirmation
          </p>
        )}
      </div>
  );
}

/** ═══ THE DWELL, AS WORDS ═══ "Day 7 of 14" — or, for Tier 1, when it
 *  began. Behind the ⓘ now: the design's tier row is one line. TODO-COPY. */
function dwellText(d: { day: number; of: number | null }, since: number | null): string {
  if (since !== null) return `Since ${TIME.format(since)}`;
  return d.of !== null ? `Day ${d.day} of ${d.of}` : `Day ${d.day}`;
}

/** ═══ THE QUIET ⓘ ═══ The tier's description and its dwell rule, on
 *  demand; and, for a mentor at Tier 2–3, the step-down request — kept, but
 *  off the card's one-action line. */
function TierInfo({ tier, rule, dwell, onRequestStepDown }: { tier: Tier; rule: string | null; dwell: string | null; onRequestStepDown?: () => void }) {
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
        {(dwell || rule) && (
          <p data-tier-rule className="text-[var(--text-secondary)]" style={LABEL}>
            {dwell && (
              <span data-tier-time className="tabular-nums">
                {dwell}
                {rule && <span aria-hidden>{" · "}</span>}
              </span>
            )}
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
