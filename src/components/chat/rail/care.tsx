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
//   steady    recent History (pack v4.0; was TierCard · Care brief)
//   raising   the raise flow, as an Overview takeover (RaiseFlow)
//   active    the escalation exchange (`escalation/exchange.tsx`)
// An escalation takes over OVERVIEW ONLY: the other four tabs stay reachable,
// and the Overview tab carries the escalation dot. The tab is held by the page
// (`chat-page.tsx`), because the banner's "Emergency info" opens this panel on
// the Emergency info tab.
//
// ═══ THE HERO, THEN THE TABS (pack v4.0) ═══ Overview's steady state was
// TierCard + Care brief; both moved UP into the Teen Status card, which sits
// above the tab bar on every tab. Steady Overview is now the two newest
// History rows and "View history →" (F3). While an escalation is open the
// hero is the escalation's (`EscalationHero`) and Overview is its timeline.
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

import { useEffect, useRef, useState } from "react";
import { EscalationExchange, EscalationHero } from "@/components/chat/escalation/exchange";
import type { SupervisorEcho } from "@/components/chat/escalation/waiting-module";
import { TeenStatusCard } from "@/components/chat/rail/teen-status-card";
import { EmergencyInfoPanel } from "@/components/chat/escalation/crisis-view";
import { RaiseFlow } from "@/components/tiering/raise-flow";
import { TierHistory } from "@/components/tiering/tier-history";
import type { EmergencyInfo, EscalationState, MessageOrigin } from "@/lib/chat/types";
import type { Tiering } from "@/lib/tiering/use-tiering";
import type { RaiseTarget } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

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
    const el = refs.current[to];
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  /* ═══ FADES ONLY WHERE THERE IS MORE (pack v5.0, bug 2) ═══ v4's fade was
     always on: scrolled to the end, History sat under it, and the left edge
     cut Overview with no fade at all (measured: 405px of tabs in a 327px row).
     Each side fades only while there is more to scroll to that side. */
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = () => {
    const r = rowRef.current;
    if (!r) return;
    const left = r.scrollLeft > 1;
    const right = r.scrollLeft + r.clientWidth < r.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  useEffect(() => {
    const r = rowRef.current;
    if (!r) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(r);
    return () => ro.disconnect();
  }, []);
  return (
    /* ═══ ONE ROW, UNDERLINED (pack v4.0, Supersession 5) ═══ It replaces the
       wrapping pill chips. On overflow the row scrolls sideways; the arrow
       keys bring the focused tab into view.
       ═══ STICKY (pack v5.0, A2) ═══ It pins to the top of the rail's
       scroller on the panel's own surface, so the hero scrolls away beneath
       it and nothing is half-cropped behind a transparent bar.
       ═══ NEVER HALF A LABEL (bug 2) ═══ The tabs snap: at rest a tab is
       either whole or past the fade, never cut through its word. */
    <div data-care-tabs-bar className="sticky -top-4 z-[3] -mx-4 bg-[var(--surface-s1)] px-4 pt-1">
      <div className="relative border-b border-[color:var(--border-subtle)]">
        <div
          ref={rowRef}
          role="tablist"
          aria-label="Care"
          data-care-tabs
          onScroll={measure}
          className="-mb-px flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto [scrollbar-width:none]"
        >
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
                  "relative inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 border-b-2 whitespace-nowrap",
                  on
                    ? "border-[color:var(--text-primary)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
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
        {/* The edge fades: the panel's own surface. Decorative; never
            intercept a tap; present only while that side has more. */}
        {edges.left && (
          <span aria-hidden data-care-tabs-fade="left" className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--surface-s1)] to-transparent" />
        )}
        {edges.right && (
          <span aria-hidden data-care-tabs-fade="right" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--surface-s1)] to-transparent" />
        )}
      </div>
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
  highlightTier = false,
  echo,
  showDiagnosis = false,
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
  onUseWording: (text: string, origin?: MessageOrigin) => void;
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
  /** The tier cell's one-beat arrival after a close (pack v4.0, F1). */
  highlightTier?: boolean;
  /** The supervisor's latest Support message (pack v4.0, D2). */
  echo?: SupervisorEcho;
  /** Supervisor or lead mentor (pack v5.0, Supersession 5). */
  showDiagnosis?: boolean;
}) {
  const state = tiering.stateFor(teenId);
  const lens = observer ? "supervisor" : "mentor";
  const mentorName = tiering.liveMentorName || "the mentor";
  const panelState = raising && !observer && !escalation ? "raising" : escalation ? "active" : "steady";
  const history = (limit?: number) => (
    <TierHistory
      events={tiering.eventsFor(teenId)}
      escalations={tiering.escalationsFor(teenId)}
      nameOf={tiering.nameOf}
      mentorName={observer ? tiering.liveMentorName || "The mentor" : "You"}
      emptyName={name}
      limit={limit}
      now={now}
    />
  );

  const overview =
    // ── RAISING ──────────────────────────────────────────────────────────────
    panelState === "raising" ? (
      <RaiseFlow name={name} current={state.tier} onCancel={onCancelRaise} onConfirm={onConfirmRaise} />
    ) : escalation ? (
      // ── THE EXCHANGE (pack v2.0), on Overview only (pack v3.0) ─────────────
      <EscalationExchange
        e={escalation}
        teenId={teenId}
        name={name}
        lens={lens}
        tiering={tiering}
        supervisorName={supervisorName}
        mentorName={mentorName}
        onUseWording={onUseWording}
        teenLines={teenLines}
        mentorLines={mentorLines}
        onSettled={onSettled}
        echo={echo}
      />
    ) : (
      // ── STEADY: the two most recent History rows (pack v4.0, F3) ──────────
      /* The day headers are the section's labels — a "Recent" overline over
         "Today" stacked two (measured), so the rows lead and the way to the
         rest follows them. */
      <section data-care-recent aria-label="Recent history" className="space-y-1">
        {history(2)}
        <button
          type="button"
          data-care-view-history
          onClick={() => onTab("history")}
          className={cn("inline-flex min-h-8 items-center rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
          style={{ font: "var(--type-field-label)" }}
        >
          {/* TODO-COPY */}
          View history →
        </button>
      </section>
    );

  return (
    /* ═══ THE HERO SITS ABOVE THE TABS (pack v4.0, Workstream B) ═══ It is
       the panel's one status, so it holds across every tab: the Teen Status
       card while steady, the escalation hero while one is open. */
    <div
      data-care-panel
      data-care-state={panelState}
      data-care-target={escalation ? String(escalation.requested ?? 1) : undefined}
      className="space-y-4"
    >
      {escalation ? (
        <EscalationHero
          e={escalation}
          tiering={tiering}
          teenId={teenId}
          lens={lens}
          supervisorName={supervisorName}
          mentorName={mentorName}
          presence={presence}
          onSupport={onReplyInSupport}
        />
      ) : (
        <TeenStatusCard
          state={state}
          now={now}
          name={name}
          role={lens}
          showDiagnosis={showDiagnosis}
          brief={brief}
          highlight={highlightTier}
          onEscalate={onStartRaise}
          onRequestStepDown={onRequestStepDown}
          onUpdateTier={onUpdateTier}
        />
      )}
      <CareTabs tab={tab} onTab={onTab} dot={dot} />
      <div id="care-tabpanel" role="tabpanel" aria-labelledby={`care-tab-${tab}`} data-care-tabpanel={tab}>
        {tab === "overview" ? (
          overview
        ) : tab === "history" ? (
          history()
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
              <li key={r.name} className="rounded-[var(--radius-inset)] bg-[var(--surface-raised)] px-3 py-2.5 shadow-[var(--el-soft)]">
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
