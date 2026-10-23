"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TierHistory — the append-only tier and escalation trail (pack, Phases 1/4)
//
// One component, two hosts: the chat Care tab's History sub-section and the
// user record's Care tab. Same events, same order, same words — one store,
// two views.
//
// ═══ READ-ONLY, FOR EVERY ROLE ═══ Nothing here edits or removes an entry. A
// correction is a new event, and it renders as one.
//
// ═══ AN ESCALATION IS ONE STORY, NOT FOUR ROWS (make it magical, 3) ═══
// Opened → assessed → resolved → stepped down renders as a single collapsed
// card; expanding it reveals every audit entry that makes it up, each with
// its lozenge. Standalone placements (intake, a supervisor's update) stay
// single rows.
//
// ═══ THE REDESIGN (pack v4.0, Workstream E) — both hosts ═══
//   date groups    Today · Yesterday · Oct 7 headers; a row's gutter holds
//                  its time only, because the header holds the day
//   one anatomy    gutter (time) | body — the same grid for a placement and
//                  an escalation, so the column of times is one column
//   the card       compressed: a title row (the tier lozenge, "Escalation",
//                  the state) and ONE interpuncted stage line. The arrow
//                  chain ("Raised … → assessed → …") is retired.
//   long reasons   clamp to two lines with "Show more" — the whole text is
//                  one tap away, never lost

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import type { EscalationState } from "@/lib/chat/types";
import { describeEvent, type TierActor, type TierEvent, type TierEventKind } from "@/lib/tiering/events";
import { FOLLOW_UP_STATUS, OUTCOMES, RISK_LABEL, assessmentOf, escalationTarget, riskLevel } from "@/lib/tiering/escalation";
import { PLATFORM, RAISE_LABEL } from "@/lib/tiering/tiers";
import { stageLine } from "@/lib/tiering/notifications";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const DAY_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const LABEL = { font: "var(--type-field-label)" } as const;
const BODY = { font: "var(--type-body)" } as const;

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** The date group's header. TODO-COPY. `now` is the host's render clock. */
export function historyDay(at: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(at).getFullYear() === new Date(now).getFullYear() ? DAY.format(at) : DAY_YEAR.format(at);
}

/** Past this, a reason clamps to two lines with "Show more". */
const CLAMP_CHARS = 90;

/** The audit lozenge per event — the kind, in words. TODO-COPY. */
export const AUDIT_LABEL: Record<TierEventKind, string> = {
  placed: "Placed",
  requested: "Requested",
  confirmed: "Confirmed",
  declined: "Declined",
  "step-down-requested": "Step-down requested",
  "stepped-down": "Stepped down",
};

export function AuditLozenge({ children }: { children: React.ReactNode }) {
  return (
    <span
      data-audit-lozenge
      className="inline-flex h-5 shrink-0 items-center rounded-full border border-[color:var(--border-default)] px-2 font-mono text-[11px] leading-none text-[var(--text-secondary)]"
    >
      {children}
    </span>
  );
}

interface Entry {
  key: string;
  at: number;
  label: string;
  sentence: string;
  reason?: string;
}

/** ═══ ONE ROW ANATOMY ═══ gutter (the time) | body. Every history row and
 *  every audit entry inside an escalation card uses this grid. */
function Row({ at, withDate = false, children, slot }: { at: number; withDate?: boolean; children: React.ReactNode; slot?: Record<string, string> }) {
  return (
    <li data-history-row {...slot} className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 py-2">
      <span data-history-time className="pt-0.5 text-right tabular-nums text-[var(--text-muted)]" style={LABEL}>
        {withDate ? WHEN.format(at) : TIME.format(at)}
      </span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

function Reason({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP_CHARS;
  return (
    <span className="mt-0.5 block text-[var(--text-secondary)]" style={LABEL}>
      <span data-history-reason className={cn("block break-words", long && !open && "line-clamp-2")}>
        {text}
      </span>
      {long && (
        <button
          type="button"
          data-history-more
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn("mt-0.5 inline-flex min-h-6 items-center rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
        >
          {/* TODO-COPY */}
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </span>
  );
}

function EntryBody({ e }: { e: Entry }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <AuditLozenge>{e.label}</AuditLozenge>
      </span>
      <span className="mt-1 block break-words text-[var(--text-primary)]" style={BODY}>
        {e.sentence}
      </span>
      {e.reason && <Reason text={e.reason} />}
    </>
  );
}

const tierEntry = (e: TierEvent, nameOf: (a: TierActor) => string): Entry => ({
  key: e.id,
  at: e.at,
  label: AUDIT_LABEL[e.kind],
  sentence: describeEvent(e, nameOf(e.actor)),
  reason: e.reason,
});

function EscalationStory({
  escalation,
  events,
  nameOf,
  mentorName,
}: {
  escalation: EscalationState;
  events: TierEvent[];
  nameOf: (a: TierActor) => string;
  mentorName: string;
}) {
  const [open, setOpen] = useState(false);
  const a = assessmentOf(escalation);
  const risk = riskLevel(a.answers);
  const outcome = OUTCOMES.find((o) => o.id === escalation.outcome?.id)?.label ?? (escalation.outcome?.id === "tier_update" ? "Tier update" : escalation.outcome?.id === "reviewed" ? "Reviewed" : undefined);
  const target = escalationTarget(escalation);
  const tier = escalation.confirmedTier ?? (target === PLATFORM ? null : target);
  const closed = escalation.resolvedAt !== null;
  const stepDown = events.find((e) => e.kind === "stepped-down");
  const followUp = FOLLOW_UP_STATUS.find((f) => f.id === escalation.followUp?.status)?.label;
  /* ═══ ONE SUMMARY LINE, AT MOST THREE FRAGMENTS (pack v5.0, D1) ═══ The
     state, then (closed) what happened and where the teen went — "Closed ·
     911 responded · stepped to Tier 3"; (open) the live stage. The
     assessment's risk and the follow-up are the expansion's. No arrows.
     TODO-COPY. */
  const stages = (
    closed
      ? ["Closed", ...(outcome ? [outcome] : []), ...(stepDown ? [`stepped to Tier ${stepDown.tier}`] : [])]
      : ["Open", ...(stageLine(escalation) ? [stageLine(escalation)!] : [])]
  ).slice(0, 3);
  const entries: Entry[] = [
    { key: `${escalation.id}-open`, at: escalation.openedAt, label: "Raised", sentence: `${mentorName} raised ${RAISE_LABEL[target]}`, reason: escalation.contextNote || undefined },
    ...events.map((e) => tierEntry(e, nameOf)),
    ...(a.submittedAt !== null
      ? [{ key: `${escalation.id}-assessed`, at: a.submittedAt, label: "Assessed", sentence: `Assessment sent to supervisor${risk ? ` · suggested ${RISK_LABEL[risk].toLowerCase()}` : ""}`, reason: escalation.mentorSummary || undefined }]
      : []),
    /* Guidance left the record for Support (pack v3.0); added chat moments
       file here instead, quote-framed by sender. */
    ...(escalation.moments ?? []).map((m) => ({ key: m.id, at: m.at, label: "Moment", sentence: `${m.quote.senderName}: “${m.quote.text}”`, reason: m.note || undefined })),
    ...(escalation.crisisNote?.updatedAt && closed ? [{ key: `${escalation.id}-note`, at: escalation.crisisNote.updatedAt, label: "Crisis note", sentence: "Crisis note filed" }] : []),
    ...(escalation.outcome?.savedAt ? [{ key: `${escalation.id}-outcome`, at: escalation.outcome.savedAt, label: "Outcome", sentence: outcome ? `Outcome · ${outcome}` : "Outcome recorded", reason: escalation.outcome.plan || undefined }] : []),
    ...(closed ? [{ key: `${escalation.id}-closed`, at: escalation.resolvedAt!, label: "Closed", sentence: "Escalation closed" }] : []),
    ...(escalation.followUp ? [{ key: `${escalation.id}-follow`, at: escalation.followUp.dueAt, label: "Follow-up", sentence: followUp ? `Follow-up · ${followUp}` : "Follow-up scheduled" }] : []),
  ].sort((x, y) => x.at - y.at);
  return (
    <Row at={escalation.openedAt} slot={{ "data-escalation-story": escalation.id }}>
      <div className="rounded-[var(--radius-inset)] bg-[var(--surface-raised)] shadow-[var(--el-soft)]">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn("flex w-full items-start gap-2 px-3 py-3 text-left", RING)}
        >
          <span className="min-w-0 flex-1 space-y-1.5">
            {/* ═══ THE TITLE ROW (v3) ═══ The Escalation lozenge and the tier.
                The time is the row's gutter and the day its group's header —
                one home each, so the card carries no date of its own. */}
            <span data-story-title className="flex flex-wrap items-center gap-2">
              <AuditLozenge>Escalation</AuditLozenge>
              {tier ? (
                <TierLozenge tier={tier} />
              ) : (
                <span className="inline-flex h-5 items-center rounded-full border border-[color:var(--border-default)] px-2 text-[var(--text-secondary)]" style={LABEL}>
                  {/* TODO-COPY */}
                  Platform concern
                </span>
              )}
            </span>
            {/* Each fragment is one unbreakable phrase; the line wraps only
                BETWEEN them ("Follow-" broke from "up" — measured in v4). */}
            <span data-story-stages className="block text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
              {stages.map((st, i) => (
                <span key={st}>
                  {i > 0 && " · "}
                  <span className="whitespace-nowrap">{st}</span>
                </span>
              ))}
            </span>
          </span>
          <ChevronDown aria-hidden className={cn("mt-1 size-4 shrink-0 text-[var(--icon-secondary)] transition-transform motion-reduce:transition-none", open && "rotate-180")} />
          <span className="sr-only">{open ? "Hide the timeline" : "Show the timeline"}</span>
        </button>
        {open && (
          /* ═══ PROPER TIMELINE ROWS (v3) ═══ A spine with a mark per entry;
             the time one type step down and dated (an escalation can span
             days); looser leading; reasons clamp to two lines. */
          <ol data-story-entries className="relative mx-3 mb-3 border-t border-[color:var(--border-subtle)] pt-3">
            <span aria-hidden className="absolute top-4 bottom-2 left-[3.5px] w-px bg-[var(--border-subtle)]" />
            {entries.map((e) => (
              <li key={e.key} data-history-row data-story-entry className="relative grid grid-cols-[8px_minmax(0,1fr)] gap-x-3 pb-3 last:pb-0">
                <span aria-hidden className="relative z-[1] mt-1.5 size-2 rounded-full border border-[color:var(--border-default)] bg-[var(--surface-raised)]" />
                <div className="min-w-0 space-y-0.5">
                  <span data-history-time className="block tabular-nums text-[11px] leading-[16px] text-[var(--text-muted)]">
                    {WHEN.format(e.at)}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <AuditLozenge>{e.label}</AuditLozenge>
                    <span className="min-w-0 break-words text-[var(--text-primary)]" style={{ font: "var(--type-body)", lineHeight: "22px" }}>
                      {e.sentence}
                    </span>
                  </span>
                  {e.reason && <Reason text={e.reason} />}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Row>
  );
}

export function TierHistory({
  events,
  escalations,
  nameOf,
  mentorName,
  emptyName,
  limit,
  now,
}: {
  events: TierEvent[];
  escalations: EscalationState[];
  nameOf: (a: TierActor) => string;
  /** How the mentor who raised an escalation is named here. */
  mentorName: string;
  /** The teen's first name, for the empty state. */
  emptyName: string;
  /** Show only the newest N entries (pack v4.0, F3: Overview's recent
   *  history). Omitted, the whole record. */
  limit?: number;
  /** The host's render clock, for "Today" / "Yesterday". */
  now: number;
}) {
  const byEscalation = new Map<string, TierEvent[]>();
  const loose: TierEvent[] = [];
  const known = new Set(escalations.map((e) => e.id));
  for (const e of events) {
    if (e.escalationId && known.has(e.escalationId)) byEscalation.set(e.escalationId, [...(byEscalation.get(e.escalationId) ?? []), e]);
    else loose.push(e);
  }
  type Item = { at: number; node: React.ReactNode };
  const items: Item[] = [
    ...escalations.map((esc) => ({
      at: esc.openedAt,
      node: (
        <EscalationStory
          key={esc.id}
          escalation={esc}
          events={(byEscalation.get(esc.id) ?? []).sort((a, b) => a.at - b.at)}
          nameOf={nameOf}
          mentorName={mentorName}
        />
      ),
    })),
    ...loose.map((e) => ({
      at: e.at,
      node: (
        <Row key={e.id} at={e.at} slot={{ "data-history-entry": e.kind }}>
          <EntryBody e={tierEntry(e, nameOf)} />
        </Row>
      ),
    })),
  ].sort((a, b) => b.at - a.at);

  if (items.length === 0) {
    return (
      <p className="text-[var(--text-secondary)]" style={BODY}>
        {/* TODO-COPY */}
        Nothing on file for {emptyName} yet.
      </p>
    );
  }
  /* ═══ DATE GROUPS ═══ Consecutive items on one day share a header. */
  const shown = limit === undefined ? items : items.slice(0, limit);
  const groups: { day: string; items: Item[] }[] = [];
  for (const i of shown) {
    const day = historyDay(i.at, now);
    if (groups.at(-1)?.day === day) groups.at(-1)!.items.push(i);
    else groups.push({ day, items: [i] });
  }
  return (
    <div data-tier-history aria-label="Tier and escalation history" role="group" className="space-y-3">
      {groups.map((g) => (
        <section key={g.day} data-history-day={g.day} aria-label={g.day}>
          <h4 className="text-[11px] leading-[16px] font-medium tracking-[0.06em] text-[var(--text-muted)] uppercase">{g.day}</h4>
          <ol className="divide-y divide-[color:var(--border-subtle)]">{g.items.map((i) => i.node)}</ol>
        </section>
      ))}
    </div>
  );
}
