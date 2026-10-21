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
// card whose summary line tells the whole arc; expanding it reveals every
// audit entry that makes it up, each with its lozenge. Standalone placements
// (intake, a supervisor's update) stay single rows.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ASSESSMENT } from "@/lib/chat/assessment";
import type { EscalationState } from "@/lib/chat/types";
import { RESOLUTION_OUTCOMES } from "@/components/chat/escalation/resolve-dialog";
import { describeEvent, type TierActor, type TierEvent, type TierEventKind } from "@/lib/tiering/events";
import { escalationTarget, safetyOf } from "@/lib/tiering/escalation";
import { RAISE_LABEL } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The audit lozenge per event — the kind, in words. TODO-COPY. */
export const AUDIT_LABEL: Record<TierEventKind, string> = {
  placed: "Placed",
  requested: "Requested",
  confirmed: "Confirmed",
  declined: "Declined",
  "step-down-requested": "Step-down requested",
  "stepped-down": "Stepped down",
};

function AuditLozenge({ children }: { children: React.ReactNode }) {
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

function EntryRow({ e }: { e: Entry }) {
  return (
    <li data-history-entry className="flex gap-3 py-2">
      <span className="w-24 shrink-0 pt-0.5 text-right tabular-nums text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
        {WHEN.format(e.at)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <AuditLozenge>{e.label}</AuditLozenge>
        </span>
        <span className="mt-1 block text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
          {e.sentence}
        </span>
        {e.reason && (
          <span className="mt-0.5 block text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
            {e.reason}
          </span>
        )}
      </span>
    </li>
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
  const covered = Object.values(escalation.assessment).filter((s) => s.checked).length;
  const safety = safetyOf(escalation);
  const outcome = RESOLUTION_OUTCOMES.find((o) => o.id === escalation.outcomeId)?.label;
  const target = escalationTarget(escalation);
  const stepDown = events.find((e) => e.kind === "stepped-down");
  /* THE ARC, IN ONE LINE. TODO-COPY. */
  const arc = [
    `Opened ${WHEN.format(escalation.openedAt)}`,
    `${covered} of ${ASSESSMENT.length} covered${safety.submittedAt ? " · safety check sent" : ""}`,
    escalation.resolvedAt !== null ? `resolved${outcome ? `: ${outcome.toLowerCase()}` : ""}` : "still open",
    ...(stepDown ? [`stepped down to Tier ${stepDown.tier}`] : []),
  ].join(" → ");
  const entries: Entry[] = [
    { key: `${escalation.id}-open`, at: escalation.openedAt, label: "Opened", sentence: `${mentorName} raised ${RAISE_LABEL[target]}`, reason: escalation.contextNote || undefined },
    ...events.map((e) => tierEntry(e, nameOf)),
    ...(safety.submittedAt ? [{ key: `${escalation.id}-safety`, at: safety.submittedAt, label: "Safety check", sentence: "Safety check sent to supervisor" }] : []),
    ...(escalation.resolvedAt !== null
      ? [{ key: `${escalation.id}-resolved`, at: escalation.resolvedAt, label: "Resolved", sentence: outcome ? `Resolved · ${outcome}` : "Resolved" }]
      : []),
  ].sort((a, b) => a.at - b.at);
  return (
    <li data-escalation-story={escalation.id} className="rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-start gap-3 px-3 py-2.5 text-left", RING)}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <AuditLozenge>Escalation</AuditLozenge>
            <span className="text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
              {RAISE_LABEL[target]}
            </span>
          </span>
          <span className="mt-1 block text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
            {arc}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn("mt-1 size-4 shrink-0 text-[var(--icon-secondary)] transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        <span className="sr-only">{open ? "Hide the audit entries" : "Show the audit entries"}</span>
      </button>
      {open && (
        <ol data-story-entries className="border-t border-[color:var(--border-subtle)] px-3">
          {entries.map((e) => (
            <EntryRow key={e.key} e={e} />
          ))}
        </ol>
      )}
    </li>
  );
}

export function TierHistory({
  events,
  escalations,
  nameOf,
  mentorName,
  emptyName,
}: {
  events: TierEvent[];
  escalations: EscalationState[];
  nameOf: (a: TierActor) => string;
  /** How the mentor who raised an escalation is named here. */
  mentorName: string;
  /** The teen's first name, for the empty state. */
  emptyName: string;
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
    ...loose.map((e) => ({ at: e.at, node: <EntryRow key={e.id} e={tierEntry(e, nameOf)} /> })),
  ].sort((a, b) => b.at - a.at);

  if (items.length === 0) {
    return (
      <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
        {/* TODO-COPY */}
        Nothing on file for {emptyName} yet.
      </p>
    );
  }
  return (
    <ol data-tier-history aria-label="Tier and escalation history" className="space-y-2">
      {items.map((i) => i.node)}
    </ol>
  );
}
