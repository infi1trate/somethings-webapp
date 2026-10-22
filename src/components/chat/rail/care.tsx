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
// ═══ FIVE TABS, FIRST-CLASS, AT THE TOP (pack v3.0, Workstream B) ═══
// Overview · Safety plan · Emergency info · Resources · History. They replace
// the mid-panel sub-chips. Overview has three states:
//   steady    TierCard · Care brief
//   raising   the raise flow, as an Overview takeover (RaiseFlow)
//   active    the escalation exchange (`escalation/exchange.tsx`)
// An escalation takes over OVERVIEW ONLY: the other four tabs stay reachable,
// and the Overview tab carries the escalation dot. The tab is held by the page
// (`chat-page.tsx`), because the banner's "Emergency info" opens this panel on
// the Emergency info tab.
//
// ═══ ONE STORE, TWO VIEWS ═══ A supervisor watching the conversation reads
// the same record — the assessment, the tier, the note, added chat moments —
// on its own lens of the timeline, and gets "Update tier" where a mentor gets
// "Escalate".
//
// ═══ RED ONLY IN TIER 1–2 CONTEXTS ═══ The in-panel Emergency information
// button is gone (pack v3.0, Supersession 5): the banner chip is the one entry,
// and it lands on the Emergency info tab, whose Call 911 is the canon's other
// red.

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PanelSection } from "@/components/chat/rail/rail-panel";
import { EscalationExchange } from "@/components/chat/escalation/exchange";
import { EmergencyInfoPanel } from "@/components/chat/escalation/crisis-view";
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


// ── THE TABS ────────────────────────────────────────────────────────────────

export type CareTab = "overview" | "safety-plan" | "emergency" | "resources" | "history";
/* TODO-COPY. Sentence case. */
export const CARE_TABS: { id: CareTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "safety-plan", label: "Safety plan" },
  { id: "emergency", label: "Emergency info" },
  { id: "resources", label: "Resources" },
  { id: "history", label: "History" },
];

/** TODO-COPY / TODO-CLINICAL: the list needs the same review as the rest. */
const RESOURCES: { name: string; how: string }[] = [
  { name: "988 Suicide & Crisis Lifeline", how: "Call or text 988, any time" },
  { name: "Crisis Text Line", how: "Text HOME to 741741" },
  { name: "The Trevor Project", how: "Call 1-866-488-7386, or text START to 678-678" },
];

function CareTabs({ tab, onTab, dot }: { tab: CareTab; onTab: (t: CareTab) => void; dot: "alert" | "neutral" | null }) {
  const refs = useRef<Partial<Record<CareTab, HTMLButtonElement | null>>>({});
  const onKey = (e: React.KeyboardEvent, id: CareTab) => {
    const i = CARE_TABS.findIndex((s) => s.id === id);
    const to =
      e.key === "ArrowRight" ? CARE_TABS[(i + 1) % CARE_TABS.length].id
      : e.key === "ArrowLeft" ? CARE_TABS[(i - 1 + CARE_TABS.length) % CARE_TABS.length].id
      : e.key === "Home" ? CARE_TABS[0].id
      : e.key === "End" ? CARE_TABS[CARE_TABS.length - 1].id
      : null;
    if (!to) return;
    e.preventDefault();
    onTab(to);
    refs.current[to]?.focus();
  };
  return (
    /* A wrapping row rather than a scroller: five labels fit the 360 rail in
       two lines at worst, and nothing is ever hidden behind an overflow. */
    <div role="tablist" aria-label="Care" data-care-tabs className="flex flex-wrap gap-1.5">
      {CARE_TABS.map((s) => {
        const on = s.id === tab;
        const withDot = s.id === "overview" && dot;
        return (
          <button
            key={s.id}
            ref={(el) => {
              refs.current[s.id] = el;
            }}
            type="button"
            role="tab"
            id={`care-tab-${s.id}`}
            data-care-tab={s.id}
            aria-selected={on}
            aria-controls="care-tabpanel"
            tabIndex={on ? 0 : -1}
            onClick={() => onTab(s.id)}
            onKeyDown={(e) => onKey(e, s.id)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3",
              on
                ? "border-transparent bg-[var(--surface-sunken-strong)] text-[var(--text-primary)]"
                : "border-[color:var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
              RING
            )}
            style={{ font: "var(--type-body)" }}
          >
            {s.label}
            {withDot && (
              <>
                <span
                  aria-hidden
                  data-overview-dot={dot}
                  className={cn("size-1.5 rounded-full", dot === "alert" ? "bg-[var(--alert-critical-accent)]" : "bg-[var(--text-primary)]")}
                />
                <span className="sr-only">, escalation open</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── THE PANEL ───────────────────────────────────────────────────────────────

export function CarePanel({
  teenId,
  name,
  now,
  tiering,
  escalation,
  observer,
  raising,
  tab,
  onTab,
  dot,
  onStartRaise,
  onCancelRaise,
  onConfirmRaise,
  onUseWording,
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
  /** Which tab is up. Held by the page — see the module note. */
  tab: CareTab;
  onTab: (t: CareTab) => void;
  /** The escalation dot on the Overview tab: alert for Tier 1–2. */
  dot: "alert" | "neutral" | null;
  onStartRaise: () => void;
  onCancelRaise: () => void;
  onConfirmRaise: (input: { target: RaiseTarget; note: string }) => void;
  onUseWording: (text: string) => void;
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

  const overview = (() => {
    // ── RAISING ────────────────────────────────────────────────────────────
    if (raising && !observer && !escalation) {
      return (
        <div data-care-state="raising">
          <RaiseFlow name={name} current={state.tier} onCancel={onCancelRaise} onConfirm={onConfirmRaise} />
        </div>
      );
    }
    // ── THE EXCHANGE (pack v2.0), on Overview only (pack v3.0) ─────────────
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
            mentorName={tiering.liveMentorName || "the mentor"}
            presence={presence}
            onUseWording={onUseWording}
            onReplyInSupport={onReplyInSupport}
            teenLines={teenLines}
            mentorLines={mentorLines}
            onSettled={onSettled}
          />
        </div>
      );
    }
    // ── STEADY: the tier card and the care brief ───────────────────────────
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
      </div>
    );
  })();

  return (
    <div data-care-panel className="space-y-4">
      <CareTabs tab={tab} onTab={onTab} dot={dot} />
      <div id="care-tabpanel" role="tabpanel" aria-labelledby={`care-tab-${tab}`} data-care-tabpanel={tab}>
        {tab === "overview" ? (
          overview
        ) : tab === "history" ? (
          <TierHistory
            events={tiering.eventsFor(teenId)}
            escalations={tiering.escalationsFor(teenId)}
            nameOf={tiering.nameOf}
            mentorName={observer ? tiering.liveMentorName || "The mentor" : "You"}
            emptyName={name}
          />
        ) : tab === "safety-plan" ? (
          <p data-care-safety-plan className="text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
            {/* TODO-COPY. A designed empty state, not a dash. */}
            No safety plan on file for {name}. A supervisor writes one with them after a Tier 1 or 2 escalation, and it shows here.
          </p>
        ) : tab === "emergency" ? (
          <EmergencyInfoPanel info={emergency} theirName={name} />
        ) : (
          <ul data-care-resources className="space-y-2">
            {RESOURCES.map((r) => (
              <li key={r.name} className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
                <p className="text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>{r.name}</p>
                <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>{r.how}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
