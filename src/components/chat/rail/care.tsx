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
// (2026-10-28: `EscalationHero` is deleted — the Escalation review tab opens
// on the timeline, with nothing above it.)
//
// ═══ SUPERSEDED BY PACK v8.0 (Supersessions 3–4) ═══ Overview is REMOVED —
// its Recent preview retires (History is the record), its raise flow and its
// escalation takeover move to a TEMPORARY tab. The set is now:
//   [Escalation review] · Emergency info (the default) · Safety plan ·
//   Resources · History
// Escalation review is created leftmost while an escalation is raised, open,
// or closed-and-not-yet-dismissed; it is auto-selected once per open event
// (`chat-page.tsx`) and carries the dot while this lens's attention is
// needed. Closed, it is the closed summary with one Dismiss; dismissed (or
// left after viewing) it is removed and leaves toward History. The anchor
// cells (`care-hero.tsx`) persist above the tab bar in every state.
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
import { EscalationExchange } from "@/components/chat/escalation/exchange";
import { CareHero, TierCell } from "@/components/chat/rail/care-hero";
import { mentorshipVitals, teenIdentity } from "@/lib/record/mentorship-vitals";
import { heroMetrics } from "@/lib/record/hero-metrics";
import { EmergencyInfoPanel } from "@/components/chat/escalation/crisis-view";
import { RaiseFlow } from "@/components/tiering/raise-flow";
import { TierHistory } from "@/components/tiering/tier-history";
import { CareHistorySections, useCareHistoryEvents } from "@/components/record/care-history";
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

export type CareTab = "escalation" | "emergency" | "safety-plan" | "resources" | "history";
/* TODO-COPY. Sentence case. Instrument order; "escalation" renders only while
   the temporary tab exists. */
export const CARE_TABS: { id: CareTab; label: string }[] = [
  { id: "escalation", label: "Escalation review" },
  { id: "emergency", label: "Emergency info" },
  { id: "safety-plan", label: "Safety plan" },
  { id: "resources", label: "Resources" },
  { id: "history", label: "History" },
];
/** The steady default (pack v8.0, a blocked constant). */
export const DEFAULT_CARE_TAB: CareTab = "emergency";

/** TODO-COPY / TODO-CLINICAL: the list needs the same review as the rest. */
const RESOURCES: { name: string; how: string }[] = [
  { name: "988 Suicide & Crisis Lifeline", how: "Call or text 988, any time" },
  { name: "Crisis Text Line", how: "Text HOME to 741741" },
  { name: "The Trevor Project", how: "Call 1-866-488-7386, or text START to 678-678" },
];

/* `Yield` (pack v9.0) is deleted: the hero holds its ground in every state
   (pack v11.0, Supersession 1). */

function CareTabs({ tab, onTab, dot, review, leaving }: { tab: CareTab; onTab: (t: CareTab) => void; dot: "alert" | "neutral" | null; review: boolean; leaving: boolean }) {
  const refs = useRef<Partial<Record<CareTab, HTMLButtonElement | null>>>({});
  const TABS = CARE_TABS.filter((s) => s.id !== "escalation" || review);
  const onKey = (e: React.KeyboardEvent, id: CareTab) => {
    const i = TABS.findIndex((s) => s.id === id);
    const to =
      e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length].id
      : e.key === "ArrowLeft" ? TABS[(i - 1 + TABS.length) % TABS.length].id
      : e.key === "Home" ? TABS[0].id
      : e.key === "End" ? TABS[TABS.length - 1].id
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
          {TABS.map((s) => {
            const on = s.id === tab;
            const temp = s.id === "escalation";
            const withDot = temp && dot;
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
                  /* ═══ ARRIVAL AND DEPARTURE (make it magical 2) ═══ In with
                     the banner; out toward History on dismiss. */
                  temp && (leaving ? "care-tab-out" : "care-tab-in"),
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
                      data-review-dot={dot}
                      className={cn("size-1.5 rounded-full", dot === "alert" ? "bg-[var(--alert-critical-accent)]" : "bg-[var(--text-primary)]")}
                    />
                    <span className="sr-only">, needs your attention</span>
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

// ── THE SAFETY PLAN, EMPTY, FOR A MENTOR (pack v5.0, D2) ─────────────────────

/** TODO-COPY / TODO-CLINICAL — the pack's three questions. */
const SAFETY_PLAN_STARTERS: readonly string[] = [
  "Who could you call if tonight got hard?",
  "What helps even a little when it’s bad?",
  "Where do you feel safest?",
];

/** ═══ HELP HAVING THE CONVERSATION ═══ A quiet framing line and three
 *  questions, each with a quiet Ask in chat (it fills the message box and
 *  sends nothing). No big CTA, no card shouting. DOCUMENTING the plan stays
 *  the supervisor's — the crisis note's Safety plan section. */
function SafetyPlanStarters({ onUseWording }: { onUseWording: (text: string) => void }) {
  return (
    <div data-care-safety-plan data-safety-starters className="space-y-3">
      <p className="text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
        {/* TODO-COPY — the pack's line. */}
        No safety plan yet — these can start the conversation.
      </p>
      <ul className="space-y-1.5">
        {SAFETY_PLAN_STARTERS.map((q) => (
          <li key={q} data-safety-starter className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[var(--radius-inset)] bg-[var(--surface-raised)] px-3 py-2.5 shadow-[var(--el-soft)]">
            <span className="min-w-0 flex-1 text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
              &ldquo;{q}&rdquo;
            </span>
            <button
              type="button"
              data-safety-ask
              onClick={() => onUseWording(q)}
              className={cn("inline-flex min-h-8 shrink-0 items-center rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
              style={{ font: "var(--type-field-label)" }}
            >
              {/* TODO-COPY */}
              Ask in chat
            </button>
          </li>
        ))}
      </ul>
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
  emergency,
  brief,
  teenLines,
  mentorLines,
  onSettled,
  highlightTier = false,
  onCopySuggestion,
  showDiagnosis = false,
  arrivedForCare = false,
  review,
  onDismiss,
  metricInputs,
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
  /** The Escalation review tab's dot — while this lens's attention is
   *  needed; alert for Tier 1–2. */
  dot: "alert" | "neutral" | null;
  onStartRaise: () => void;
  onCancelRaise: () => void;
  onConfirmRaise: (input: { target: RaiseTarget; note: string }) => void;
  onUseWording: (text: string, origin?: MessageOrigin) => void;
  onUpdateTier: () => void;
  onRequestStepDown: () => void;
  supervisorName: string;
  emergency: EmergencyInfo;
  brief: CareBrief;
  /** The conversation's own lines, for the debrief draft (fake AI). */
  teenLines: string[];
  mentorLines: string[];
  /** The escalation just closed, or its wrap was read — see the exchange. */
  onSettled?: () => void;
  /** The tier cell's one-beat arrival after a close (pack v4.0, F1). */
  highlightTier?: boolean;
  /** An Ava line was copied from the post-submit card: the page remembers it
   *  so a message carrying it records its provenance. */
  onCopySuggestion: (text: string) => void;
  /** Supervisor or lead mentor (pack v5.0, Supersession 5). */
  showDiagnosis?: boolean;
  /** Arrived from a notification's deep link (make it magical 3). */
  arrivedForCare?: boolean;
  /** The temporary Escalation review tab exists (pack v8.0). */
  review: boolean;
  /** Dismiss the closed summary: the page records it and removes the tab. */
  onDismiss?: () => void;
  /** What the hero's metrics read off the conversation (pack v11.0 §4.4). */
  metricInputs: { messages: readonly { sender: string; at: number }[] | null; notes: number };
}) {
  const state = tiering.stateFor(teenId);
  const lens = observer ? "supervisor" : "mentor";
  const mentorName = tiering.liveMentorName || "the mentor";
  /* ═══ BOTH LENSES READ THE MENTORSHIP (pack v11.0 §4.2) ═══ v7 gated it
     to the mentor; the hero now carries it for both — facts about the
     pair, nothing clinical. The DIAGNOSIS stays gated at the source: the
     mentor's page never receives one to render. */
  const vitals = mentorshipVitals(teenId);
  const identity = teenIdentity(teenId);
  const metrics = heroMetrics(teenId, now, {
    messages: metricInputs.messages,
    escalationsOpenedAt: tiering.escalationsFor(teenId).map((x) => x.openedAt),
    notes: metricInputs.notes,
  });
  const panelState = raising && !observer && !escalation ? "raising" : escalation ? (escalation.resolvedAt !== null ? "closed" : "active") : "steady";
  /* While an escalation is raised or in progress, the tier cell's own
     actions step aside: the escalation is the way the tier moves now. */
  const busy = panelState === "raising" || panelState === "active";
  /* ═══ AN OPENING SCROLLS TO THE TOP, ONCE (pack v11.0 §4.6) ═══ So the
     hero is seen in its full state; then the panel behaves normally. A DOM
     write on the open escalation's id — never on a re-render. */
  const panelRef = useRef<HTMLDivElement>(null);
  const openId = panelState === "active" ? escalation?.id : undefined;
  useEffect(() => {
    if (!openId) return;
    let el: HTMLElement | null = panelRef.current?.parentElement ?? null;
    while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
    el?.scrollTo({ top: 0 });
  }, [openId]);
  const historyEvents = useCareHistoryEvents(teenId, now);
  const history = () => (
    <TierHistory
      events={tiering.eventsFor(teenId)}
      escalations={tiering.escalationsFor(teenId)}
      nameOf={tiering.nameOf}
      mentorName={observer ? tiering.liveMentorName || "The mentor" : "You"}
      emptyName={name}
      now={now}
    />
  );

  /* ═══ DISMISS, THEN LEAVE TOWARD HISTORY (make it magical 2) ═══ The tab
     plays its exit, then the page records the dismissal and removes it.
     Reduced motion: at once. */
  const [leaving, setLeaving] = useState(false);
  const dismiss = () => {
    if (!onDismiss) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
    if (reduce) return onDismiss();
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      onDismiss();
    }, 220);
  };

  /* ═══ THE TAB'S CREATION AND REMOVAL ARE ANNOUNCED ═══ A DOM write, not
     state: the announcement is an event, and nothing re-renders for it. */
  const said = useRef<HTMLParagraphElement>(null);
  const had = useRef(review);
  useEffect(() => {
    if (had.current === review) return;
    had.current = review;
    /* TODO-COPY */
    if (said.current) said.current.textContent = review ? "Escalation review tab added." : "Escalation review closed. The record is in History.";
  }, [review]);

  /* ═══ THE ESCALATION REVIEW TAB'S CONTENTS ═══ */
  const reviewBody =
    panelState === "raising" ? (
      <RaiseFlow name={name} current={state.tier} onCancel={onCancelRaise} onConfirm={onConfirmRaise} />
    ) : escalation ? (
      <div className="space-y-4">
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
          onDismiss={dismiss}
          onCopySuggestion={onCopySuggestion}
          /* The card's red button is the one emergency door: this tab. */
          onEmergency={observer ? undefined : () => onTab("emergency")}
          arrived={arrivedForCare}
        />
      </div>
    ) : null;

  return (
    /* ═══ THE HEADER SITS ABOVE THE TABS (pack v4.0; v8.0) ═══ The anchor
       cells hold across every tab and every state; the escalation hero lives
       in the Escalation review tab. */
    <div
      data-care-panel
      data-care-state={panelState}
      data-care-target={escalation ? String(escalation.requested ?? 1) : undefined}
      ref={panelRef}
      className="flex flex-col"
    >
      <p ref={said} data-care-tabs-live role="status" aria-live="polite" className="sr-only" />
      {/* ═══ THE CARE HERO, IN EVERY STATE (pack v11.0, Supersession 1) ═══
          Identity · the mentorship · risk tier · the six metrics · and, for a
          supervisor or lead, the diagnosis — above the tabs, both lenses,
          steady, raising, open and closed. It scrolls away under the sticky
          tab bar. v9's yield is reversed and deleted. */}
      <div className="pb-4">
        <CareHero
          name={name}
          identity={identity}
          /* A supervisor's view names the mentor; a mentor's names their
             supervisor — they are the mentor. */
          person={
            lens === "supervisor"
              ? { role: "Mentor", name: vitals?.mentor?.name ?? (tiering.liveMentorName || "The mentor") }
              : vitals?.supervisor
                ? { role: "Supervisor", name: vitals.supervisor.name }
                : null
          }
          metrics={metrics}
          /* ═══ VIEW RECORD, ROLE-GATED AT THE SOURCE ═══ The care record for
             a supervisor or lead; the Profile tab for a mentor, whose DOM
             never holds a care-record link. */
          record={
            showDiagnosis
              ? { href: brief.href, label: `View ${name}'s care record` }
              : { href: `/app/chat/${teenId}?rail=profile`, label: `View ${name}'s profile` }
          }
          tierCell={
            <TierCell
              state={state}
              now={now}
              name={name}
              role={lens}
              highlight={highlightTier}
              onEscalate={busy ? undefined : onStartRaise}
              onRequestStepDown={busy ? undefined : onRequestStepDown}
              onUpdateTier={busy ? undefined : onUpdateTier}
            />
          }
        />
      </div>
      <CareTabs tab={tab} onTab={onTab} dot={dot} review={review} leaving={leaving} />
      <div id="care-tabpanel" role="tabpanel" aria-labelledby={`care-tab-${tab}`} data-care-tabpanel={tab} className="mt-4">
        {tab === "escalation" && reviewBody ? (
          reviewBody
        ) : tab === "history" ? (
          /* ═══ THE RECORD'S HISTORY, EXACTLY (2026-10-26) ═══ Supervisor and
             lead mentor read the same two sections the record's Care tab
             renders — `CareHistorySections`, one module for both hosts. The
             History section is clinical, so a mentor gets the tier and
             escalation trail alone (the v5/v7 role gate). */
          showDiagnosis ? (
            <div data-care-history-host className="space-y-6">
              <CareHistorySections teenId={teenId} firstName={name} events={historyEvents} clinical />
            </div>
          ) : (
            history()
          )
        ) : tab === "safety-plan" ? (
          observer ? (
            <p data-care-safety-plan className="text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
              {/* TODO-COPY. A designed empty state, not a dash. */}
              No safety plan on file for {name}. A supervisor writes one with them after a Tier 1 or 2 escalation, and it shows here.
            </p>
          ) : (
            <SafetyPlanStarters onUseWording={onUseWording} />
          )
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
