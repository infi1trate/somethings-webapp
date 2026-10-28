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
import type { MentorshipVitals, TeenIdentity } from "@/lib/record/mentorship-vitals";
import type { HeroMetrics } from "@/lib/record/hero-metrics";
import { Metric } from "@/components/record/metric";
import { RecordAvatar } from "@/components/record/record-avatar";
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

/** ═══ THE TYPE LOCKUP ═══ (pack v11.0 §4)
 *    overline        11/16 medium, tracked, uppercase, text-muted
 *    headline        --type-card-title (Avantt 16/24), text-primary — the
 *                    identity name and the tenure; WEIGHT IS NOT A CHANNEL
 *                    (only Lausanne 400 ships), so emphasis is the face
 *    meta / caption  --type-field-label (12/16), text-secondary
 *    metric value    `Metric`: 20/26 tabular — the hero's largest text, a
 *                    step above the 16/24 headlines, so the row reads as data
 *  Sections are 12 top and bottom, 16 in from the edge, split by hairlines. */
const HEADLINE = { font: "var(--type-card-title)" } as const;

/* ═══ THE HERO HOLDS ITS GROUND (pack v11.0, Supersession 1) ═══ v9 yielded
   it while an escalation was open — the mentor's hid, the supervisor's
   compressed to a one-line diagnosis strip. Reversed: the full hero persists
   in every state, in both lenses, and carries MORE than before. The
   vertical cost is paid back by the focus view's wider panel and by the hero
   scrolling away under the sticky tab bar. `DiagnosisStrip` and `Yield`
   are deleted, not orphaned. */
export function CareHero({
  name,
  identity,
  lens,
  showDiagnosis,
  brief,
  vitals,
  metrics,
  tierCell,
}: {
  /** The teen's first name — for the region's label. */
  name: string;
  identity: TeenIdentity | null;
  lens: "mentor" | "supervisor";
  /** Supervisor or lead mentor: the diagnosis closes the hero. */
  showDiagnosis: boolean;
  brief: CareBrief;
  vitals: MentorshipVitals | null;
  metrics: HeroMetrics;
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
      <IdentitySection identity={identity} />
      <MentorshipCell who={name} vitals={vitals} lens={lens} />
      {tierCell}
      <MetricsSection metrics={metrics} />
      {showDiagnosis && <DiagnosisCell brief={brief} />}
    </section>
  );
}

/** ═══ 4.1 · IDENTITY (pack v11.0, Supersession 2) ═══ Not v7's strip: it is
 *  inside the hero card, below nothing — the focus view and the supervisor's
 *  Monitoring entry both need the panel to stand on its own. No actions. */
function IdentitySection({ identity }: { identity: TeenIdentity | null }) {
  if (!identity) return null;
  const meta = [identity.age !== null ? `${identity.age} y/o` : null, identity.pronouns].filter(Boolean).join(" · ");
  return (
    <div data-care-identity className="flex items-center gap-3 px-4 py-3">
      <RecordAvatar name={identity.name} size={32} />
      <div className="min-w-0">
        <p data-identity-name className="m-0 truncate text-[var(--text-primary)]" style={HEADLINE}>
          {identity.name}
        </p>
        {meta && (
          <p data-identity-meta className="m-0 text-[var(--text-secondary)]" style={LABEL}>
            {/* TODO-COPY */}
            {meta}
          </p>
        )}
      </div>
    </div>
  );
}

/** ═══ 4.4 · METRICS ═══ The Care Record stat, reused (`Metric`): three
 *  columns, two rows, label over value, values sharing a baseline. Zero is
 *  `0`. Absent is not zero: "Engaged days" has no source yet (BLOCKED, Meg)
 *  and says so — never a number. No trend line: a sparkline earns its place
 *  in a scannable list row, not in a panel competing with live escalation
 *  content (the trend's home would be History). */
function MetricsSection({ metrics }: { metrics: HeroMetrics }) {
  /* ═══ THE STAT THAT KNOWS WHAT JUST HAPPENED (make it magical 2) ═══ When
     the escalation count rises in session, its value ticks once — a DOM
     class on change, never on first paint; stilled under reduced motion. */
  const prev = useRef(metrics.escalations);
  const tick = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = metrics.escalations;
    if (was === null || metrics.escalations === null || metrics.escalations <= was) return;
    const v = tick.current?.querySelector("[data-metric='escalations'] p:nth-child(2)");
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
    /* ═══ VALUES SHARE A BASELINE (§4.4) ═══ At 420 a label like "Engaged
       days (30d)" wraps to two lines, which pushed its value below its
       neighbours' (measured). Each cell is a column whose value sits at the
       bottom, so a row's values align however its labels wrap. */
    <div ref={tick} data-care-metrics className="grid grid-cols-3 gap-x-4 gap-y-4 px-4 py-3 [&>[data-metric]]:flex [&>[data-metric]]:flex-col [&>[data-metric]]:justify-between">
      <Metric slot="days" label="Days in mentorship">{value(metrics.daysInMentorship)}</Metric>
      {/* BLOCKED (Meg): "engaged days" is undefined and no per-day log
          exists. The slot renders; a number never does. */}
      <Metric slot="engaged" label="Engaged days (30d)">{value(metrics.engagedDays)}</Metric>
      <Metric slot="messages" label="Messages sent (30d)">{value(metrics.messagesSent)}</Metric>
      <Metric slot="flags" label="Flags (30d)">{value(metrics.flags)}</Metric>
      <Metric slot="escalations" label="Escalations (30d)">{value(metrics.escalations)}</Metric>
      <Metric slot="notes" label="Notes">{value(metrics.notes)}</Metric>
    </div>
  );
}

/** ═══ 4.5 · CLINICAL DIAGNOSIS (supervisor, lead) — the hero's LAST
 *  section ═══ The diagnosis at Body/Large-Regular (16/24) with its ICD code
 *  as a quiet mono lozenge, inline after the last word; the record link
 *  under it. A mentor's hero has no such section — not hidden: absent. */
function DiagnosisCell({ brief }: { brief: CareBrief }) {
  return (
    <div data-care-brief data-anchor="diagnosis" className="space-y-1 px-4 py-3">
      {/* TODO-COPY */}
      <Overline>Clinical diagnosis</Overline>
      {brief.presentation ? (
        /* The code rides INLINE after the last word (a flex row orphaned it
           onto a line of its own, measured on F33.0); nowrap keeps the chip
           whole and its 4px lead with it. */
        <p data-anchor-headline className="m-0 text-[var(--text-primary)]" style={{ font: "var(--type-message)" }}>
          {brief.presentation}
          {brief.code && (
            <>
              {" "}
              <span data-icd className="ml-1 inline-flex h-5 items-center rounded-[5px] border border-[color:var(--border-default)] px-1.5 align-[2px] font-mono text-[11px] leading-none whitespace-nowrap text-[var(--text-secondary)]">
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

/** ═══ 4.2 · THE MENTORSHIP — both lenses (pack v11.0) ═══ Tenure as the
 *  headline ("6 weeks together"); one caption of FACTS — when they last
 *  spoke, the check-ins in the window. "Supervised by" links to the
 *  supervisor's record, mentor lens only: a supervisor need not be told who
 *  supervises. No clinical datum, no characterisation (a blocked constant). */
function MentorshipCell({ who, vitals, lens }: { who: string; vitals: MentorshipVitals | null; lens: "mentor" | "supervisor" }) {
  return (
    <div data-care-mentorship data-anchor="mentorship" className="space-y-1 px-4 py-3">
      {/* TODO-COPY */}
      <Overline>The mentorship</Overline>
      {vitals ? (
        <>
          <TenureHeadline who={who} tenure={vitals.tenure} ticked={vitals.tickedToday} />
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
          {lens === "mentor" && vitals.supervisor && (
            <p data-vital="supervisor" className="m-0 text-[var(--text-secondary)]" style={LABEL}>
              Supervised by{" "}
              <Link
                href={`/admin/person/${vitals.supervisor.id}`}
                data-mentorship-supervisor={vitals.supervisor.id}
                className={cn("rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
              >
                {vitals.supervisor.name}
              </Link>
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
      <div ref={beat} data-tier-card data-tier={t ?? "none"} data-tier-cell className={cn("space-y-1 px-4 py-3", highlight && "tier-cell-arrive")}>
        {/* TODO-COPY */}
        <Overline>Risk tier</Overline>
        {/* ═══ 4.3 · VALUE LEFT, ACTION RIGHT ═══ Mentor → Escalate,
            supervisor → Update tier, both opening TierSelect. While an
            escalation is open the action is suppressed in both lenses: the
            live decision is the Escalation review tab's, and two doors to
            one decision in one panel is the duplication the tab exists to
            prevent (a design decision for Brandon to confirm). */}
        <div className="flex min-h-10 items-center gap-1.5">
          {t ? (
            <span data-tier-beat className="inline-flex">
              <TierLozenge tier={t} long />
            </span>
          ) : (
            <span className="text-[var(--text-secondary)]" style={BODY}>
              {/* TODO-COPY */}
              No tier on file for {name} yet.
            </span>
          )}
          {t && <TierInfo tier={t} rule={d?.rule ?? null} onRequestStepDown={canAskDown ? onRequestStepDown : undefined} />}
          {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
        {pending ? (
          /* ═══ ONE STATUS LINE (Supersession 6) ═══ It replaces the chip AND
             "Waiting for a supervisor to confirm" — one fact, one line. */
          <p data-tier-pending className="text-[var(--text-secondary)]" style={LABEL}>
            {/* TODO-COPY */}
            Requested: Tier {pending.tier} · awaiting confirmation
          </p>
        ) : (
          d && (
            <div data-tier-beat>
              <DwellLine day={d.day} of={d.of} since={t === 1 ? state.since : null} />
            </div>
          )
        )}
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
