"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CARE TAB — persistent, for every teen (Tiering & Escalation pack)
//
// ═══ SUPERSEDES THE "NOW" TAB, IN PLACE ═══ Now was an escalation-only tab
// that appeared with an escalation and vanished on resolve. Care exists for
// every teen at all times, at a fixed position after Context (tabs never
// reorder), and enters a distinct ESCALATION STATE while one is open — a
// red dot on the tab, and the tab selected once (`chat-page.tsx`).
//
// Three states:
//   steady    TierCard · Care brief · History / Safety plan / Emergency info /
//             Resources
//   raising   the raise flow, as a rail takeover (RaiseFlow)
//   active    status header · latest supervisor guidance · checklist ·
//             safety check (Tier 1–2) · Emergency information · Resolve ·
//             what happens next
//
// ═══ ONE STORE, TWO VIEWS ═══ A supervisor watching the conversation reads
// the same records — checklist, safety answers, guidance — without the
// controls, and gets "Update tier" where a mentor gets "Escalate".
//
// ═══ RED ONLY IN TIER 1–2 CONTEXTS ═══ The Emergency information button is
// the one filled red action here, and only while the escalation is Tier 1 or
// 2; a Tier 3 or Platform safety escalation gets it outlined.

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { PanelSection } from "@/components/chat/rail/rail-panel";
import { AssessmentPanel } from "@/components/chat/escalation/assessment-panel";
import { SafetyCheck } from "@/components/chat/escalation/safety-check";
import { EmergencyInfoList } from "@/components/chat/escalation/crisis-view";
import { RaiseFlow } from "@/components/tiering/raise-flow";
import { RequestedChip } from "@/components/tiering/requested-chip";
import { TierCard } from "@/components/tiering/tier-card";
import { TierHistory } from "@/components/tiering/tier-history";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import type { EmergencyInfo, EscalationState } from "@/lib/chat/types";
import { escalationTarget, needsSafetyCheck, safetyOf } from "@/lib/tiering/escalation";
import type { Tiering } from "@/lib/tiering/use-tiering";
import { PLATFORM, isAlertTier, type RaiseTarget } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export interface CareBrief {
  presentation: string | null;
  code: string | null;
  summary: string | null;
  freshAt: number | null;
  href: string;
}

export interface Guidance {
  text: string;
  from: string;
  at: number;
}

/** What happens next, by what was raised. TODO-COPY, all four — clinical
 *  review owed with the rest of the escalation copy (gap row 357). */
function nextSteps(t: RaiseTarget, name: string): string {
  switch (t) {
    case 1:
      return `Your supervisor is responding now. Stay with ${name}. Tier 1 ends only with a crisis note — that is Resolve, below — and then ${name} steps down to Tier 2 for at least 7 days.`;
    case 2:
      return `Your supervisor coaches you live and checks in with you every day for at least 7 days, then decides on stepping ${name} down.`;
    case 3:
      return `Your supervisor reads this today. While ${name} is in Tier 3 you write a weekly check-in note, and they step down after 14 days unless it is renewed.`;
    case PLATFORM:
      return `A supervisor reviews the account activity. ${name}'s tier does not change because of this.`;
  }
}

// ── STEADY: the sub-sections ───────────────────────────────────────────────

type SubId = "history" | "safety-plan" | "emergency" | "resources";
/* TODO-COPY. Sentence case, the FCP-2 chip pattern. */
const SUB: { id: SubId; label: string }[] = [
  { id: "history", label: "History" },
  { id: "safety-plan", label: "Safety plan" },
  { id: "emergency", label: "Emergency info" },
  { id: "resources", label: "Resources" },
];

/** TODO-COPY / TODO-CLINICAL: the list needs the same review as the rest. */
const RESOURCES: { name: string; how: string }[] = [
  { name: "988 Suicide & Crisis Lifeline", how: "Call or text 988, any time" },
  { name: "Crisis Text Line", how: "Text HOME to 741741" },
  { name: "The Trevor Project", how: "Call 1-866-488-7386, or text START to 678-678" },
];

function SubSections({
  children,
}: {
  children: (active: SubId) => React.ReactNode;
}) {
  const [active, setActive] = useState<SubId>("history");
  const refs = useRef<Partial<Record<SubId, HTMLButtonElement | null>>>({});
  const onKey = (e: React.KeyboardEvent, id: SubId) => {
    const i = SUB.findIndex((s) => s.id === id);
    const to =
      e.key === "ArrowRight" ? SUB[(i + 1) % SUB.length].id
      : e.key === "ArrowLeft" ? SUB[(i - 1 + SUB.length) % SUB.length].id
      : e.key === "Home" ? SUB[0].id
      : e.key === "End" ? SUB[SUB.length - 1].id
      : null;
    if (!to) return;
    e.preventDefault();
    setActive(to);
    refs.current[to]?.focus();
  };
  return (
    <div>
      <div role="tablist" aria-label="Care details" className="flex flex-wrap gap-1.5">
        {SUB.map((s) => {
          const on = s.id === active;
          return (
            <button
              key={s.id}
              ref={(el) => {
                refs.current[s.id] = el;
              }}
              type="button"
              role="tab"
              data-care-sub={s.id}
              aria-selected={on}
              aria-controls={on ? `care-sub-${s.id}` : undefined}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(s.id)}
              onKeyDown={(e) => onKey(e, s.id)}
              className={cn(
                "inline-flex min-h-8 items-center rounded-full border px-3",
                on
                  ? "border-transparent bg-[var(--surface-sunken-strong)] text-[var(--text-primary)]"
                  : "border-[color:var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                RING
              )}
              style={{ font: "var(--type-body)" }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <div id={`care-sub-${active}`} role="tabpanel" className="mt-3">
        {children(active)}
      </div>
    </div>
  );
}

// ── ACTIVE: the status header ──────────────────────────────────────────────

function StatusHeader({
  escalation,
  tiering,
  teenId,
  supervisorName,
  presence,
}: {
  escalation: EscalationState;
  tiering: Tiering;
  teenId: string;
  supervisorName: string;
  presence?: string;
}) {
  const target = escalationTarget(escalation);
  const events = tiering.eventsFor(teenId).filter((e) => e.escalationId === escalation.id);
  const confirmed = [...events].reverse().find((e) => e.kind === "confirmed" || e.kind === "placed");
  const declined = [...events].reverse().find((e) => e.kind === "declined");
  const state = tiering.stateFor(teenId);
  const waiting = state.pending?.escalationId === escalation.id;
  /* TODO-COPY, every line. Persistent and timestamped — never toast-only. */
  const confirmation =
    target === PLATFORM
      ? "With a supervisor for review"
      : confirmed
        ? `Tier ${confirmed.tier} confirmed by ${tiering.nameOf(confirmed.actor)} · ${TIME.format(confirmed.at)}`
        : declined && !waiting
          ? `Kept in Tier ${state.tier} by ${tiering.nameOf(declined.actor)} · ${TIME.format(declined.at)}`
          : "Awaiting confirmation on tiering";
  return (
    <div
      data-care-status
      className={cn(
        "rounded-[var(--radius-inset)] px-3 py-3",
        /* The canon's signifiers: T1 the red lane, T2 the amber inset, the
           rest neutral — no alert colour below Tier 2. */
        target === 1
          ? "border border-[color:var(--t1)] bg-[var(--t1-soft)]"
          : target === 2
            ? "border border-transparent bg-[var(--t2-soft)]"
            : "border border-[color:var(--border-default)] bg-[var(--surface-card)]"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {target === PLATFORM ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-full border border-[color:var(--border-default)] px-2 font-mono text-[11px] leading-none text-[var(--text-secondary)]">
            <ShieldAlert aria-hidden className="size-3" />
            Platform safety
          </span>
        ) : confirmed ? (
          /* ═══ THE CONFIRMATION MOMENT (make it magical, 1) ═══ The chip
             resolves into the confirmed lozenge with one settle, keyed on
             the confirmation, so it plays once. */
          <span key={confirmed.id} className="tier-settle inline-flex">
            <TierLozenge tier={confirmed.tier} long />
          </span>
        ) : (
          <RequestedChip tier={target} />
        )}
        <span className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
          {/* TODO-COPY */}
          Escalation open
        </span>
      </div>
      <p className="mt-1 tabular-nums text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
        {/* TODO-COPY */}
        Opened {TIME.format(escalation.openedAt)} · {supervisorName} notified {TIME.format(escalation.supervisorNotifiedAt)}
      </p>
      <p data-care-confirmation aria-live="polite" className="mt-0.5 text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
        {confirmation}
      </p>
      {presence && (
        <p data-care-presence className="mt-1 flex items-center gap-2 text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--status-online)]" />
          {presence}
        </p>
      )}
    </div>
  );
}

export function CarePanel({
  teenId,
  name,
  now,
  tiering,
  escalation,
  observer,
  raising,
  onStartRaise,
  onCancelRaise,
  onConfirmRaise,
  onCheckStep,
  onUseWording,
  onAnswerSafety,
  onSubmitSafety,
  onOpenCrisis,
  onResolve,
  onUpdateTier,
  onRequestStepDown,
  guidance,
  supervisorName,
  onReplyInSupport,
  presence,
  emergency,
  brief,
}: {
  teenId: string;
  name: string;
  now: number;
  tiering: Tiering;
  escalation?: EscalationState;
  observer: boolean;
  raising: boolean;
  onStartRaise: () => void;
  onCancelRaise: () => void;
  onConfirmRaise: (input: { target: RaiseTarget; note: string }) => void;
  onCheckStep: (stepId: string) => void;
  onUseWording: (text: string) => void;
  onAnswerSafety: (questionId: string, value: "yes" | "no") => void;
  onSubmitSafety: () => void;
  onOpenCrisis: () => void;
  onResolve: () => void;
  onUpdateTier: () => void;
  onRequestStepDown: () => void;
  guidance: Guidance | null;
  supervisorName: string;
  onReplyInSupport?: () => void;
  presence?: string;
  emergency: EmergencyInfo;
  brief: CareBrief;
}) {
  const state = tiering.stateFor(teenId);

  // ── RAISING ──────────────────────────────────────────────────────────────
  if (raising && !observer && !escalation) {
    return (
      <div data-care-state="raising">
        <RaiseFlow name={name} current={state.tier} onCancel={onCancelRaise} onConfirm={onConfirmRaise} />
      </div>
    );
  }

  // ── ACTIVE ───────────────────────────────────────────────────────────────
  if (escalation) {
    const target = escalationTarget(escalation);
    const red = isAlertTier(target);
    return (
      <div data-care-state="active" data-care-target={String(target)} className="space-y-5">
        <StatusHeader escalation={escalation} tiering={tiering} teenId={teenId} supervisorName={supervisorName} presence={presence} />

        <PanelSection label="Latest from your supervisor">
          {guidance ? (
            <figure data-care-guidance className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
              <blockquote className="text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
                &ldquo;{guidance.text}&rdquo;
              </blockquote>
              <figcaption className="mt-1 tabular-nums text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
                {guidance.from} · {TIME.format(guidance.at)}
              </figcaption>
            </figure>
          ) : (
            <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
              {/* TODO-COPY */}
              {supervisorName} has been notified. Their guidance shows here.
            </p>
          )}
          {onReplyInSupport && (
            <button
              type="button"
              data-care-reply
              onClick={onReplyInSupport}
              className={cn("mt-2 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
              style={{ font: "var(--type-body)" }}
            >
              {/* TODO-COPY */}
              Reply in Support <ArrowRight aria-hidden className="size-4" />
            </button>
          )}
        </PanelSection>

        {target !== PLATFORM && (
          <PanelSection label="Checklist" divided>
            <AssessmentPanel
              escalation={escalation}
              theirName={name}
              onCheck={observer ? undefined : onCheckStep}
              onUseWording={observer ? undefined : onUseWording}
            />
          </PanelSection>
        )}

        {needsSafetyCheck(escalation) && (
          <PanelSection label="Safety check" divided>
            <SafetyCheck
              check={safetyOf(escalation)}
              onAnswer={observer ? undefined : onAnswerSafety}
              onUseWording={observer ? undefined : onUseWording}
              onSubmit={observer ? undefined : onSubmitSafety}
            />
          </PanelSection>
        )}

        <PanelSection divided>
          <div className="space-y-2">
            <button
              type="button"
              data-care-emergency
              onClick={onOpenCrisis}
              className={cn(
                "flex min-h-10 w-full items-center justify-center gap-2 rounded-full transition-opacity hover:opacity-90",
                red
                  ? "bg-[var(--alert-critical-accent)] text-[var(--text-inverse)]"
                  : "border border-[color:var(--border-contour)] text-[var(--text-primary)]",
                RING
              )}
              style={{ font: "var(--type-button)" }}
            >
              {/* TODO-COPY */}
              Emergency information
            </button>
            {!observer && (
              <button
                type="button"
                data-care-resolve
                onClick={onResolve}
                className={cn(
                  "flex min-h-9 w-full items-center justify-center rounded-full border border-[color:var(--border-contour)] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                  RING
                )}
                style={{ font: "var(--type-body)" }}
              >
                {/* NOT GATED ON THE CHECKLIST — see the resolve dialog. TODO-COPY. */}
                Resolve this escalation
              </button>
            )}
            {observer && (
              <button
                type="button"
                data-care-update-tier
                onClick={onUpdateTier}
                className={cn("flex min-h-9 w-full items-center justify-center rounded-full border border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
                style={{ font: "var(--type-body)" }}
              >
                {/* TODO-COPY */}
                Update tier
              </button>
            )}
          </div>
        </PanelSection>

        <PanelSection label="What happens next" divided>
          <p data-care-next className="text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
            {nextSteps(target, name)}
          </p>
        </PanelSection>
      </div>
    );
  }

  // ── STEADY ───────────────────────────────────────────────────────────────
  return (
    <div data-care-state="steady" className="space-y-5">
      <TierCard
        state={state}
        now={now}
        name={name}
        role={observer ? "supervisor" : "mentor"}
        onEscalate={onStartRaise}
        onRequestStepDown={onRequestStepDown}
        onUpdateTier={onUpdateTier}
      />

      <PanelSection label="Care brief" divided>
        <div data-care-brief>
          {brief.presentation ? (
            <p className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
              {brief.presentation}
              {brief.code && <span className="ml-1.5 font-mono text-[12px] font-normal text-[var(--text-secondary)]">{brief.code}</span>}
            </p>
          ) : (
            <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
              {/* TODO-COPY */}
              No presentation assigned yet.
            </p>
          )}
          {brief.summary && (
            <p className="mt-1 line-clamp-3 text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
              {brief.summary}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            {brief.freshAt !== null && (
              <span className="tabular-nums text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
                {/* TODO-COPY */}
                Updated {DATE.format(brief.freshAt)}
              </span>
            )}
            <Link
              href={brief.href}
              data-care-record
              className={cn("inline-flex min-h-8 items-center gap-1 rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
              style={{ font: "var(--type-body)" }}
            >
              {/* TODO-COPY */}
              View full care record <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </PanelSection>

      <PanelSection divided>
        <SubSections>
          {(active) =>
            active === "history" ? (
              <TierHistory
                events={tiering.eventsFor(teenId)}
                escalations={tiering.escalationsFor(teenId)}
                nameOf={tiering.nameOf}
                mentorName={observer ? tiering.liveMentorName || "The mentor" : "You"}
                emptyName={name}
              />
            ) : active === "safety-plan" ? (
              <p data-care-safety-plan className="text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
                {/* TODO-COPY. A designed empty state, not a dash. */}
                No safety plan on file for {name}. A supervisor writes one with them after a Tier 1 or 2 escalation, and it shows here.
              </p>
            ) : active === "emergency" ? (
              <EmergencyInfoList info={emergency} theirName={name} />
            ) : (
              <ul data-care-resources className="space-y-2">
                {RESOURCES.map((r) => (
                  <li key={r.name} className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
                    <p className="text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>{r.name}</p>
                    <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>{r.how}</p>
                  </li>
                ))}
              </ul>
            )
          }
        </SubSections>
      </PanelSection>
    </div>
  );
}
