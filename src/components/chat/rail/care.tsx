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
//   active    the escalation exchange — a staged baton panel, mentor and
//             supervisor lenses on one record (`escalation/exchange.tsx`,
//             pack v2.0, which superseded the flat v1 active state)
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
import { ArrowRight } from "lucide-react";
import { PanelSection } from "@/components/chat/rail/rail-panel";
import { EscalationExchange } from "@/components/chat/escalation/exchange";
import { EmergencyInfoList } from "@/components/chat/escalation/crisis-view";
import { RaiseFlow } from "@/components/tiering/raise-flow";
import { TierCard } from "@/components/tiering/tier-card";
import { TierHistory } from "@/components/tiering/tier-history";
import type { EmergencyInfo, EscalationState } from "@/lib/chat/types";
import type { Tiering } from "@/lib/tiering/use-tiering";
import type { RaiseTarget } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export interface CareBrief {
  presentation: string | null;
  code: string | null;
  summary: string | null;
  freshAt: number | null;
  href: string;
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
  onUseWording,
  onOpenCrisis,
  onUpdateTier,
  onRequestStepDown,
  supervisorName,
  onReplyInSupport,
  presence,
  emergency,
  brief,
  teenLines,
  mentorLines,
  onSettled,
}: {
  teenId: string;
  name: string;
  now: number;
  tiering: Tiering;
  /** The open escalation — or a closed one whose wrap-up the mentor has not
   *  read yet (M4). */
  escalation?: EscalationState;
  observer: boolean;
  raising: boolean;
  onStartRaise: () => void;
  onCancelRaise: () => void;
  onConfirmRaise: (input: { target: RaiseTarget; note: string }) => void;
  onUseWording: (text: string) => void;
  onOpenCrisis: () => void;
  onUpdateTier: () => void;
  onRequestStepDown: () => void;
  supervisorName: string;
  onReplyInSupport?: () => void;
  presence?: string;
  emergency: EmergencyInfo;
  brief: CareBrief;
  /** The conversation's own lines, for the debrief draft (fake AI). */
  teenLines: string[];
  mentorLines: string[];
  /** The escalation just closed, or its wrap was read — see the exchange. */
  onSettled?: () => void;
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

  // ── THE EXCHANGE (pack v2.0) ─────────────────────────────────────────────
  /* SUPERSEDED: the flat active state (status header · guidance · checklist
     · safety check · Emergency/Resolve · what happens next) is the staged
     baton panel now — `EscalationExchange`, one record, two lenses. */
  if (escalation) {
    return (
      <div data-care-state="active" data-care-target={String(escalation.requested ?? 1)}>
        <EscalationExchange
          e={escalation}
          teenId={teenId}
          name={name}
          lens={observer ? "supervisor" : "mentor"}
          tiering={tiering}
          supervisorName={supervisorName}
          presence={presence}
          onUseWording={onUseWording}
          onOpenCrisis={onOpenCrisis}
          onReplyInSupport={onReplyInSupport}
          teenLines={teenLines}
          mentorLines={mentorLines}
          onSettled={onSettled}
        />
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
