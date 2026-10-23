"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CARE HERO (Care Hero v7.0) — three zones, two role configurations
//
// ═══ DESIGN INTENT ═══ The Care page is the teen's CONSERVATIVE profile — the
// working sibling of their curated, expressive one. Its hero reads as a
// document header anchored by a strong noun, not a status widget. The anchor
// differs by role: the supervisor's page opens with what the teen is carrying
// (the diagnosis); the mentor's with what the pair has together (the
// mentorship). Risk tier is the constant secondary in both — it reports, it
// never anchors.
//
//   ZONE 1  REMOVED (pack v8.0, Supersession 2 — a reversal of v7): the
//                            identity strip and its single-home exception are
//                            gone. Profile is the rail's person-icon tab.
//   ZONE 2  ANCHOR CELL      supervisor / lead: CLINICAL DIAGNOSIS · mentor:
//                            THE MENTORSHIP (tenure as the headline, one line
//                            of relational vitals — facts only). ROLE-GATED IN
//                            THIS COMPONENT: a mentor's DOM carries no clinical
//                            datum of any kind.
//   ZONE 3  RISK TIER        the same cell in both lenses (pack v5.0's diet)
//
// ═══ SUPERSEDES ═══ the mentor's tier-only card (v5.0, Supersession 5) and
// the supervisor's Teen Status card — retired, this file replaces it.
//
// ═══ NO SANCTIONED REPETITION (pack v8.0) ═══ v7's identity strip repeated
// the chat header's name and pronouns as the one sanctioned exception; the
// strip is gone, and the exception with it. The Profile tab's "Matched" row
// stays gone: tenure's one home is the Mentorship cell.
//
// The card is the lightest surface on the panel (raised white over the
// panel's surface-s1), on the soft Bloom elevation.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { TierActionButton } from "@/components/tiering/tier-card";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dayInTier, type TierState } from "@/lib/tiering/events";
import { TIER_DESCRIPTION, TIER_DWELL_DAYS, TIER_MINIMUM_DAYS, T1_MAX_DAYS, type Tier } from "@/lib/tiering/tiers";
import type { CareBrief } from "@/components/chat/rail/care";
import type { MentorshipVitals } from "@/lib/record/mentorship-vitals";
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

/** ═══ THE TYPE LOCKUP ═══ (report checklist 3)
 *    overline        11/16 medium, tracked, uppercase, text-muted
 *    anchor headline --type-card-title (Avantt), text-primary
 *    meta            --type-field-label (12/16), text-secondary
 *    identity strip  the name at --type-body (14/20) — ONE STEP BELOW the
 *                    anchor headline, never competing with it — age and
 *                    pronouns at the meta step
 *  Each cell keeps a strict rhythm: overline · headline · meta, 4px apart. */
const HEADLINE = { font: "var(--type-card-title)" } as const;

export function CareHero({
  name,
  showDiagnosis,
  brief,
  vitals,
  onOpenSupport,
  tierCell,
}: {
  /** The teen's display name — for the region's label and the settle key. */
  name: string;
  /** Supervisor or lead mentor: the diagnosis anchors. Else the mentorship. */
  showDiagnosis: boolean;
  brief: CareBrief;
  vitals: MentorshipVitals | null;
  /** The supervisor's Support thread, bound — absent when there is none. */
  onOpenSupport?: () => void;
  tierCell: React.ReactNode;
}) {
  /* ═══ THE PANEL HEADER, IN EVERY STATE (pack v8.0) ═══ The anchor cells
     persist above the tab bar — steady, raising, open, closed. The escalation
     hero moved INTO the Escalation review tab, and nothing renders above
     these cells (the v7 identity strip is removed). */
  return (
    <section
      data-care-hero="steady"
      data-care-header
      data-teen-status
      aria-label={`${name}'s care`}
      className="divide-y divide-[color:var(--border-subtle)] rounded-[16px] bg-[var(--surface-raised)] shadow-[var(--el-soft)]"
    >
      {showDiagnosis ? <DiagnosisCell brief={brief} /> : <MentorshipCell who={name} vitals={vitals} onOpenSupport={onOpenSupport} />}
      {tierCell}
    </section>
  );
}

/** ═══ ZONE 2 · CLINICAL DIAGNOSIS (supervisor, lead) ═══ The panel's true
 *  headline, on a strict three-line rhythm: overline · the diagnosis with its
 *  ICD code as a quiet mono chip · "Updated {date}" and the record link. */
function DiagnosisCell({ brief }: { brief: CareBrief }) {
  return (
    <div data-care-brief data-anchor="diagnosis" className="space-y-1 px-4 py-3.5">
      {/* TODO-COPY */}
      <Overline>Clinical diagnosis</Overline>
      {brief.presentation ? (
        /* The code rides INLINE after the last word (a flex row orphaned it
           onto a line of its own, measured on F33.0); nowrap keeps the chip
           whole and its 4px lead with it. */
        <p data-anchor-headline className="m-0 text-[var(--text-primary)]" style={HEADLINE}>
          {brief.presentation}
          {brief.code && (
            <>
              {" "}
              <span data-icd className="ml-1 inline-flex h-5 items-center rounded-[5px] border border-[color:var(--border-default)] px-1.5 align-[2px] font-mono text-[11px] leading-none font-normal whitespace-nowrap text-[var(--text-secondary)]">
                {brief.code}
              </span>
            </>
          )}
        </p>
      ) : (
        <p data-anchor-headline className="m-0 text-[var(--text-secondary)]" style={BODY}>
          {/* TODO-COPY */}
          No presentation assigned yet.
        </p>
      )}
      <p data-anchor-meta className="m-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[var(--text-secondary)]" style={LABEL}>
        {brief.freshAt !== null ? (
          <span className="tabular-nums">
            {/* TODO-COPY */}
            Updated {DATE.format(brief.freshAt)}
          </span>
        ) : (
          <span />
        )}
        <Link
          href={brief.href}
          data-care-record
          className={cn("inline-flex min-h-8 items-center gap-1 rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
        >
          {/* TODO-COPY */}
          View full care record <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </p>
    </div>
  );
}

/** ═══ ZONE 2 · THE MENTORSHIP (mentor) ═══ Tenure as the headline; one meta
 *  line of FACTS — when they last spoke, the check-ins in the window, who
 *  supervises (a link into Support). No clinical datum, no characterisation.
 *  The headline settles once on the day its count ticks over (make it
 *  magical 2). */
function MentorshipCell({ who, vitals, onOpenSupport }: { who: string; vitals: MentorshipVitals | null; onOpenSupport?: () => void }) {
  return (
    <div data-care-mentorship data-anchor="mentorship" className="space-y-1 px-4 py-3.5">
      {/* TODO-COPY */}
      <Overline>The mentorship</Overline>
      {vitals ? (
        <>
          <TenureHeadline who={who} tenure={vitals.tenure} ticked={vitals.tickedToday} />
          {/* Two meta lines, on purpose: the VITALS (cadence, a fact pair) and
              the SUPERVISION (a relationship, and a link). One line overran
              the 327px cell and wrapped with its "·" dangling (measured). */}
          <p data-anchor-meta className="m-0 text-[var(--text-secondary)]" style={LABEL}>
            {/* TODO-COPY, every fragment. Each "·" travels with the fragment
                after it, so a wrap never strands one at a line end. */}
            {vitals.lastSpoke && <span data-vital="last-spoke">Last spoke {vitals.lastSpoke}</span>}
            {vitals.checkIns30d !== null && (
              <span data-vital="check-ins" className="whitespace-nowrap tabular-nums">
                {vitals.lastSpoke && <span aria-hidden>{" · "}</span>}
                {vitals.checkIns30d} check-in{vitals.checkIns30d === 1 ? "" : "s"} this window
              </span>
            )}
          </p>
          {vitals.supervisor && (
            <p data-vital="supervisor" className="m-0 text-[var(--text-secondary)]" style={LABEL}>
              Supervised by{" "}
              {onOpenSupport ? (
                <button
                  type="button"
                  data-mentorship-support={vitals.supervisor.id}
                  onClick={onOpenSupport}
                  className={cn("rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
                >
                  {vitals.supervisor.name}
                </button>
              ) : (
                vitals.supervisor.name
              )}
            </p>
          )}
        </>
      ) : (
        <p data-anchor-headline className="m-0 text-[var(--text-secondary)]" style={BODY}>
          {/* TODO-COPY */}
          No mentorship on file.
        </p>
      )}
    </div>
  );
}

/** The tenure headline. On the day its count ticks over ("7 months" → "8
 *  months") it settles ONCE — the existing `tier-settle` beat, which the
 *  reduced-motion block already stills — and never again that day, however
 *  often the panel remounts. The once-ness is a sessionStorage key and a DOM
 *  class, not state: nothing re-renders for a 280ms beat. */
function TenureHeadline({ who, tenure, ticked }: { who: string; tenure: string; ticked: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!ticked || !ref.current) return;
    const key = `care-hero:settled:${who}:${tenure}:${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    ref.current.classList.add("tier-settle");
  }, [who, tenure, ticked]);
  return (
    <p ref={ref} data-anchor-headline data-ticked={ticked || undefined} className="m-0 text-[var(--text-primary)]" style={HEADLINE}>
      {tenure}
    </p>
  );
}

/** ═══ ZONE 3 · RISK TIER — the same cell in both lenses ═══ */
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
  return (
    /* the tier's colour is confined to the lozenge */
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
