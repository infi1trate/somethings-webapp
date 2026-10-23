"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE ESCALATION EXCHANGE — one timeline, two lenses (pack v3.0)
//
// ═══ SUPERSEDES THE BATON PANEL OF PACK v2.0, IN PLACE ═══ v2 stacked a
// "Your move" strip, a spine of done stages, a tier line and the current stage
// card. Whose move it is is self-evident now: the current step is a PULSING
// NODE with its action card expanded inside the timeline (Supersession 1).
//   header     title + tier · opened · notified · confirmation · Support link
//              — nothing below it restates these
//   upcoming   ghosted, locked: the next step and the exit, with conditions
//   current    exactly one, pulsing, its card open
//   completed  checks, newest first, each one line and expandable
// The order is one constant (`TIMELINE_ORDER`, lib/tiering/timeline.ts).
//
// ONE RECORD, TWO LENSES. The mentor and the supervisor read the same
// `EscalationState`; the nodes are DERIVED from it (`timelineNodes`), never
// stored, and every write goes through `useTiering`.
//
// ═══ RETIRED HERE (pack v3.0) ═══ the baton strip, the spine, the tier line,
// the supervisor's guidance composer and the mentor's guidance quote
// (coaching is the Support thread — Supersession 2), and the pinned
// Emergency information button (Supersession 5).

import { useEffect, useId, useState } from "react";
import { Check, ChevronDown, Lock, MessageSquare } from "lucide-react";
import { announceClose } from "@/components/chat/escalation/close-toast";
import { Quote } from "@/components/chat/escalation/quote";
import { WaitingModule, type SupervisorEcho } from "@/components/chat/escalation/waiting-module";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import type { EscalationState, MessageOrigin } from "@/lib/chat/types";
import {
  CLOSE_OUT_TIER,
  CLOSE_OUT_TIER_COPY,
  FOLLOW_UP_IN,
  OUTCOMES,
  assessmentOf,
  escalationTarget,
  mentorStage,
  riskLevel,
  supervisorStage,
  workingTier,
} from "@/lib/tiering/escalation";
import { noteProgressOf, noteTierOf, orderNodes, timelineNodes, type Lens, type TimelineNode } from "@/lib/tiering/timeline";
import type { Tiering } from "@/lib/tiering/use-tiering";
import { PLATFORM, TIER_NAME, isAlertTier, type Tier } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";
import { AssessmentDeck } from "@/components/chat/escalation/assessment-deck";
import { BODY, Field, LABEL, Primary, RING, RiskChip, TITLE, onRadioKeys, rovingTab } from "@/components/chat/escalation/controls";
import { CrisisNoteAccordion } from "@/components/chat/escalation/crisis-note-accordion";

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
export { RiskChip };


// ── THE HERO — state only ───────────────────────────────────────────────────

/** ═══ ESCALATION HERO v2 (pack v5.0, Workstream A1) ═══ Above the Care tabs,
 *  persistent across them, both lenses. It owns STATE and nothing else:
 *    overline   ESCALATION
 *    headline   the request ("Tier 1 requested") — or, once confirmed, the
 *               tier itself as its lozenge (red arrives with the confirmation)
 *    meta       ONE interpuncted line: opened · the state · who is here
 *    Support    a ghost button, always the hero's last line while it is open
 *  ═══ SUPERSEDES v4's holder line (Supersession 1) ═══ "— Brandy has this"
 *  left the hero: the waiting node is its single home. And the underlined
 *  Support link is a ghost button in a fixed position (Supersession 2) — the
 *  one Support door in every state, so the waiting module no longer has its
 *  own. It does NOT say when the supervisor was notified: the banner is that
 *  fact's single home. */
export function EscalationHero({
  e,
  tiering,
  teenId,
  lens,
  supervisorName,
  mentorName,
  presence,
  onSupport,
}: {
  e: EscalationState;
  tiering: Tiering;
  teenId: string;
  lens: Lens;
  supervisorName: string;
  mentorName: string;
  /** The other party's first name, when they are in Support with you. */
  presence?: string;
  onSupport?: () => void;
}) {
  const target = escalationTarget(e);
  const confirmed = e.confirmedTier !== undefined;
  const closed = e.resolvedAt !== null;
  const nowTier = tiering.stateFor(teenId).tier;
  const who = (() => {
    const ev = [...tiering.eventsFor(teenId)].reverse().find((x) => x.escalationId === e.id && (x.kind === "confirmed" || x.kind === "placed" || x.kind === "stepped-down"));
    return ev ? tiering.nameOf(ev.actor) : null;
  })();
  /* TODO-COPY, every fragment. The headline already names the tier, so the
     meta line never repeats it — except as the close's movement. */
  const state = closed
    ? /* The movement, not a stale confirmation (measured in v2). */
      /* No arrow chain (pack v5.0, D1): the headline lozenge is where it
         began; the line says where it went. */
      `Closed ${TIME.format(e.resolvedAt!)}${confirmed && nowTier !== null && nowTier !== e.confirmedTier ? ` · moved to Tier ${nowTier} ${TIER_NAME[nowTier]}` : ""}`
    : target === PLATFORM
      ? "In review"
      : confirmed
        ? `Confirmed${who ? ` by ${who}` : ""}${e.confirmedAt ? ` · ${TIME.format(e.confirmedAt)}` : ""}`
        : "Awaiting confirmation";
  const other = lens === "supervisor" ? mentorName : supervisorName;
  return (
    <header data-care-hero="escalation" data-timeline-header className="space-y-1">
      <p data-hero-overline className="text-[11px] leading-[16px] font-medium tracking-[0.06em] text-[var(--text-muted)] uppercase">
        {/* TODO-COPY */}
        Escalation
      </p>
      <p data-tier-line className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {target === PLATFORM ? (
          <span data-hero-headline className="text-[var(--text-primary)]" style={TITLE}>
            Platform concern
          </span>
        ) : confirmed ? (
          /* The request settles into the lozenge in place (v2's magic, kept). */
          <span key={`c-${e.confirmedTier}`} data-hero-headline className="tier-settle inline-flex">
            <TierLozenge tier={e.confirmedTier!} long />
          </span>
        ) : (
          /* Neutral until confirmed (blocked constant): words, not colour. */
          <span data-hero-headline className="text-[var(--text-primary)]" style={TITLE}>
            Tier {target} requested
          </span>
        )}
      </p>
      <p data-timeline-meta className="flex flex-wrap items-center gap-x-1.5 tabular-nums text-[var(--text-secondary)]" style={LABEL}>
        <span>Opened {TIME.format(e.openedAt)}</span>
        <span aria-hidden>·</span>
        {/* A Platform concern has no tier line: it is a category, not a tier. */}
        <span data-tier-line-text={target === PLATFORM ? undefined : ""}>{state}</span>
        {presence && (
          /* ═══ PRESENCE ═══ A dot and a name — a fact about now, so it rides
             the state line rather than earning a line of its own. */
          <>
            <span aria-hidden>·</span>
            <span data-hero-presence className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--status-online)]" />
              {presence} is here
            </span>
          </>
        )}
      </p>
      {onSupport && !closed && (
        <button
          type="button"
          data-timeline-support={lens}
          onClick={onSupport}
          className={cn("-ml-2.5 inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
          style={BODY}
        >
          <MessageSquare aria-hidden className="size-4 text-[var(--icon-secondary)]" />
          {/* TODO-COPY */}
          Message {other} in Support
        </button>
      )}
    </header>
  );
}

// ── UP NEXT — the future as one collapsed path ─────────────────────────────

/** ═══ ONE ROW, COLLAPSED BY DEFAULT (pack v4.0, Supersession 1) ═══
 *  "Up next: Confirm tier, then Close & follow-up", with the lock. Expanding lists each step
 *  with its condition. The steps stay in the DOM while collapsed (`hidden`),
 *  so the record of what comes next is still there for assistive tech on
 *  expand and for the probes that read it. */
function UpNext({ steps, stepName }: { steps: TimelineNode[]; stepName: (n: TimelineNode) => string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  /* Steps arrive exit-first (live-first order); the path reads forwards. */
  const path = [...steps].reverse();
  return (
    <li data-up-next className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 pb-4">
      <span aria-hidden className="absolute top-6 bottom-0 left-[11.5px] w-px border-l border-dashed border-[color:var(--border-subtle)]" />
      <div className="pt-0.5">
        <NodeGlyph state="upcoming" />
      </div>
      <div className="min-w-0">
        <button
          type="button"
          data-up-next-toggle
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={cn("flex min-h-7 max-w-full items-center gap-1.5 rounded-sm text-left text-[var(--text-muted)] hover:text-[var(--text-secondary)]", RING)}
          style={LABEL}
        >
          {/* TODO-COPY */}
          <span data-up-next-path className="min-w-0 break-words">
            {/* "A, then B" — arrow chains are retired (pack v5.0, D1). */}
            Up next: {path.map(stepName).join(", then ")}
          </span>
          <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
        <ol id={panelId} hidden={!open} data-up-next-steps className="mt-1.5 space-y-1">
          {path.map((n) => (
            <li key={n.id} data-node={n.id} data-node-kind={n.kind} data-node-state="upcoming">
              <p data-node-condition className="text-[var(--text-muted)]" style={LABEL}>
                {n.condition ? `${stepName(n)} · ${n.condition}` : stepName(n)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </li>
  );
}

// ── THE NODE ────────────────────────────────────────────────────────────────

/** ═══ WHEN THIS PAGE OPENED ═══ Module scope, not render: a node completed
 *  after this moment was completed HERE, and is the one that settles. Nodes
 *  already done when the page opened stay still, so a load never animates
 *  the whole spine at once. */
const OPENED_AT = Date.now();

/* ═══ THE NODE GRAMMAR (pack v4.0, Workstream C) ═══ One size, three marks:
   completed   a filled check on surface-s2 — the quietest mark
   current     the ink ring: PULSING for an action that is yours, BREATHING
               (a 6s opacity cycle) for a step that is someone else's
   upcoming    a dashed lock, on the collapsed "Up next" path row only */
const GLYPH = "relative z-[1] flex size-6 items-center justify-center rounded-full";

function NodeGlyph({ state, fresh = false, variant = "action" }: { state: TimelineNode["state"]; fresh?: boolean; variant?: NodeVariant }) {
  if (state === "completed")
    return (
      /* ═══ THE HANDOFF (make it magical 1) ═══ The node that just completed
         checks and settles — one beat — while the next node takes the pulse.
         `tier-settle` is off under reduced motion. */
      <span aria-hidden data-node-fresh={fresh || undefined} className={cn(GLYPH, "bg-[var(--surface-s2)] text-[var(--text-secondary)]", fresh && "tier-settle")}>
        <Check className="size-3.5" />
      </span>
    );
  if (state === "current")
    /* The pulse is the Bloom ink, never alert red — red is spent on the
       banner, the escalation dot and Tier 1–2 lozenges (Workstream F3).
       Reduced motion: a static emphasised ring (`.node-pulse`). */
    return (
      variant === "waiting" ? (
        /* ═══ THE BREATH (make it magical 1) ═══ Waiting is not "act now":
           no outward pulse, the dot breathes instead. Off under reduced
           motion, where the ring alone says "live". */
        <span aria-hidden data-node-breath className={cn(GLYPH, "border-2 border-[color:var(--text-primary)] bg-[var(--surface-card)]")}>
          <span className="node-breath size-2 rounded-full bg-[var(--text-primary)]" />
        </span>
      ) : (
        <span aria-hidden data-node-pulse className={cn(GLYPH, "node-pulse border-2 border-[color:var(--text-primary)] bg-[var(--surface-card)]")}>
          <span className="size-2 rounded-full bg-[var(--text-primary)]" />
        </span>
      )
    );
  return (
    <span aria-hidden className={cn(GLYPH, "border border-dashed border-[color:var(--border-default)] bg-[var(--surface-card)] text-[var(--text-muted)]")}>
      <Lock className="size-3" />
    </span>
  );
}

type NodeVariant = "action" | "waiting";

function Node({
  trace = false,
  accent = "neutral",
  variant = "action",
  sub,
  node,
  title,
  detail,
  children,
  expand,
  last,
  fresh,
}: {
  node: TimelineNode;
  /** The one node completed most recently, in this session. */
  fresh?: boolean;
  title: string;
  /** A short trailing element on a completed line (e.g. the risk chip). */
  detail?: React.ReactNode;
  /** Current: the action card. */
  children?: React.ReactNode;
  /** Completed: what expanding reveals. */
  expand?: React.ReactNode;
  last: boolean;
  /** Current: the card's accent ring — the alert family for Tiers 1–2 only. */
  accent?: "alert" | "neutral";
  /** Current: an action that is this lens's, or a step that is someone else's. */
  variant?: NodeVariant;
  /** Completed: a second, muted line — wraps, never truncates. */
  sub?: string;
  /** ═══ THE TRACE (pack v5.0, make it magical 3) ═══ Arriving from a
   *  notification, the current card draws its accent ring once. */
  trace?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li data-node={node.id} data-node-kind={node.kind} data-node-state={node.state} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3">
      {/* THE SPINE: a hairline from this node to the next. */}
      {!last && <span aria-hidden className="absolute top-6 bottom-0 left-[11.5px] w-px bg-[var(--border-subtle)]" />}
      <div className="pt-0.5">
        <NodeGlyph state={node.state} fresh={fresh} variant={variant} />
      </div>
      <div className={cn("min-w-0", last ? "pb-0" : "pb-4")}>
        {/* Upcoming nodes render in the "Up next" row (UpNext), not here. */}
        {node.state === "current" ? (
          /* ═══ THE ONE EMPHASIS (pack v4.0, Workstream A) ═══ The current
             step is the panel's single strongest element: the raised surface
             over the panel's s1, the soft elevation, and an accent ring —
             alert-family for Tiers 1–2, neutral otherwise. Nothing else on the
             panel is raised AND ringed. */
          <div
            data-node-card
            data-node-accent={accent}
            data-node-variant={variant}
            data-node-trace={trace || undefined}
            className={cn(
              "space-y-3 rounded-[16px] bg-[var(--surface-raised)] p-4 shadow-[var(--el-soft)] ring-1",
              trace && "ring-trace",
              accent === "alert" ? "ring-[color:var(--alert-critical-border)]" : "ring-[color:var(--border-default)]"
            )}
          >
            <p data-node-title className="pt-0.5 text-[var(--text-primary)]" style={TITLE}>
              {title}
            </p>
            {children}
          </div>
        ) : (
          <>
            {/* A line that WRAPS rather than truncates when it carries a detail:
                measured, "Assessment received" + its chip + the time cut the
                title to "Assessment rec…" at the 360 rail. */}
            <div className={cn("flex min-h-7 items-center gap-x-2 gap-y-1", detail && "flex-wrap")}>
              {expand ? (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpen((o) => !o)}
                  className={cn("flex min-w-0 items-center gap-1.5 rounded-sm text-left text-[var(--text-secondary)] hover:text-[var(--text-primary)]", detail ? "max-w-full" : "flex-1", RING)}
                  style={BODY}
                >
                  {/* ═══ NEVER TRUNCATED MID-SENTENCE (Workstream C) ═══ A
                      completed line is a short label that wraps; the long
                      text is what expanding reveals. */}
                  <span data-node-label className="min-w-0 break-words">{title}</span>
                  <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 text-[var(--icon-secondary)] transition-transform motion-reduce:transition-none", open && "rotate-180")} />
                </button>
              ) : (
                <span data-node-label className="min-w-0 flex-1 break-words text-[var(--text-secondary)]" style={BODY}>
                  {title}
                </span>
              )}
              {detail}
              {node.at !== null && (
                <span data-node-time className="ml-auto shrink-0 tabular-nums text-[var(--text-muted)]" style={LABEL}>
                  {TIME.format(node.at)}
                </span>
              )}
            </div>
            {sub && (
              <p data-node-sub className="break-words text-[var(--text-muted)]" style={LABEL}>
                {sub}
              </p>
            )}
            {expand && open && (
              <div id={panelId} data-node-expanded className="mt-2">
                {expand}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

// ── CONFIRM THE TIER (supervisor's current node) ───────────────────────────

function ConfirmCard({ e, name, tiering, teenId, onSettled }: { e: EscalationState; name: string; tiering: Tiering; teenId: string; onSettled?: () => void }) {
  const target = escalationTarget(e);
  const [tier, setTier] = useState<Tier | null>(target === PLATFORM ? null : target);
  /* TODO-COPY. Prefilled because confirming the request IS the reason; the
     field stays required and editable, because every tier event has one. */
  const [reason, setReason] = useState("Confirmed on the mentor's note and assessment.");
  const [tried, setTried] = useState(false);
  return (
    <div data-s1 className="space-y-3">
      {/* ═══ NEUTRAL UNTIL CONFIRMED (blocked constant) ═══ The four matrix
          tiers, the request pre-selected — in neutral styling. Alarm colour
          arrives only with the confirmation, in the header's lozenge. */}
      <div role="radiogroup" aria-label={`Tier for ${name}`} onKeyDown={onRadioKeys} className="grid grid-cols-2 gap-2">
        {([1, 2, 3, 4] as Tier[]).map((t, i) => {
          const on = t === tier;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={rovingTab(on, i === 0, tier !== null)}
              data-s1-tier={t}
              onClick={() => setTier(t)}
              className={cn(
                "flex min-h-11 flex-col items-start justify-center rounded-[var(--radius-inset)] border px-3 py-1.5 text-left",
                on ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)]" : "border-[color:var(--border-subtle)] bg-[var(--surface-s1)] hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              <span className="font-mono text-[12px] leading-4 text-[var(--text-secondary)]">Tier {t}</span>
              <span className="text-[var(--text-primary)]" style={BODY}>
                {TIER_NAME[t]}
              </span>
              {t === target && (
                <span className="text-[var(--text-muted)]" style={LABEL}>
                  {/* TODO-COPY */}
                  Requested
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tier !== null && tier >= 3 && (
        <p data-s1-exit className="text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY */}
          Tier {tier} is a standard tier update: confirming it closes this escalation, with no crisis note.
        </p>
      )}
      <Field slot="confirm-reason" label="Reason — posted to the record" value={reason} onChange={setReason} invalid={tried && !reason.trim()} />
      <Primary
        slot="confirm-tier"
        onClick={() => {
          setTried(true);
          if (tier === null || !reason.trim()) return;
          if (tiering.confirm(teenId, tier, reason) && tier >= 3) {
            announceClose(e.id, name, tier);
            onSettled?.();
          }
        }}
      >
        {/* TODO-COPY */}
        {tier === target ? `Confirm Tier ${tier}` : tier !== null ? `Adjust to Tier ${tier}` : "Choose a tier"}
      </Primary>
    </div>
  );
}

function ReviewCard({ e, name, tiering, teenId, onSettled }: { e: EscalationState; name: string; tiering: Tiering; teenId: string; onSettled?: () => void }) {
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  return (
    <div data-s1 className="space-y-3">
      <Field slot="review-reason" label="What you found" value={reason} onChange={setReason} invalid={tried && !reason.trim()} />
      <Primary
        slot="mark-reviewed"
        onClick={() => {
          setTried(true);
          if (!reason.trim()) return;
          tiering.closeReviewed(teenId, reason);
          announceClose(e.id, name, null);
          onSettled?.();
        }}
      >
        {/* TODO-COPY */}
        Mark reviewed
      </Primary>
    </div>
  );
}

// ── CLOSE & FOLLOW-UP (supervisor's last node) ─────────────────────────────

function CloseCard({ e, name, tiering, teenId, onSettled }: { e: EscalationState; name: string; tiering: Tiering; teenId: string; onSettled?: () => void }) {
  const [days, setDays] = useState<number>(FOLLOW_UP_IN[0].days);
  const outcome = OUTCOMES.find((o) => o.id === e.outcome?.id)?.label ?? "";
  return (
    <div data-s4 className="space-y-4">
      <dl className="space-y-2">
        <div>
          <dt className="text-[var(--text-muted)]" style={LABEL}>Outcome</dt>
          <dd className="text-[var(--text-primary)]" style={BODY}>{outcome}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]" style={LABEL}>Step-down</dt>
          <dd data-close-destination className="text-[var(--text-primary)]" style={BODY}>
            {/* TODO-COPY. `CLOSE_OUT_TIER_COPY` — the blocked constant; see it. */}
            Closing moves {name} to {CLOSE_OUT_TIER_COPY} and files this escalation.
          </dd>
        </div>
      </dl>
      <div>
        <p className="mb-1.5 text-[var(--text-muted)]" style={LABEL}>
          {/* TODO-COPY */}
          Follow-up
        </p>
        <div role="radiogroup" aria-label="Follow-up" onKeyDown={onRadioKeys} className="flex flex-wrap gap-1.5">
          {FOLLOW_UP_IN.map((f) => {
            const on = f.days === days;
            return (
              <button
                key={f.days}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                data-follow-up={f.days}
                onClick={() => setDays(f.days)}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-3",
                  on ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)] text-[var(--text-primary)]" : "border-[color:var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                  RING
                )}
                style={BODY}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
      <Primary
        slot="close-escalation"
        onClick={() => {
          if (tiering.close(teenId, { followUpDays: days, reason: `Crisis note filed. ${outcome}`.trim() })) {
            announceClose(e.id, name, CLOSE_OUT_TIER);
            onSettled?.();
          }
        }}
      >
        {/* TODO-COPY */}
        Close escalation
      </Primary>
    </div>
  );
}

/** Label over value — the closed summary's one row shape. */
function WrapRow({ label, children, slot }: { label: string; children: React.ReactNode; slot: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[var(--text-muted)]" style={LABEL}>{label}</dt>
      <dd data-wrap-row={slot} className="text-[var(--text-primary)]" style={BODY}>{children}</dd>
    </div>
  );
}

// ── THE EXCHANGE ────────────────────────────────────────────────────────────

export function EscalationExchange({
  e,
  teenId,
  name,
  lens,
  tiering,
  supervisorName,
  mentorName,
  onUseWording,
  teenLines,
  mentorLines,
  onSettled,
  onDismiss,
  echo,
  arrived = false,
}: {
  e: EscalationState;
  teenId: string;
  name: string;
  lens: Lens;
  tiering: Tiering;
  supervisorName: string;
  /** How the supervisor lens names the mentor, for the Support link. */
  mentorName: string;
  onUseWording: (text: string, origin?: MessageOrigin) => void;
  teenLines: string[];
  mentorLines: string[];
  /** ═══ THE HOST KEEPS CARE IN FRONT ═══ Called when this panel ends its
   *  own escalation (a close, an S1 exit, Mark reviewed) or the mentor
   *  leaves the wrap. */
  onSettled?: () => void;
  /** ═══ DISMISS THE CLOSED SUMMARY (pack v8.0) ═══ The one action on the
   *  closed summary, both lenses: the page records it and removes the tab. */
  onDismiss?: () => void;
  /** Arrived from a notification: the current card traces its ring once. */
  arrived?: boolean;
  /** The supervisor's latest Support message, for the mentor's waiting node. */
  echo?: SupervisorEcho;
}) {
  const state = tiering.stateFor(teenId);
  const tier = workingTier(e, state);
  const a = assessmentOf(e);
  const risk = riskLevel(a.answers);
  const stage = lens === "mentor" ? mentorStage(e, state) : supervisorStage(e);
  const nodes = orderNodes(timelineNodes(e, state, lens));
  const open = e.resolvedAt === null;
  /* ═══ THE MENTOR'S CLOSE TOAST (Workstream F1) ═══ The same toast the
     supervisor saw, once, the first time this lens shows the closed summary.
     An effect because "shown" is the event; it writes no React state. */
  const closedTier = lens === "mentor" && stage === "M4" ? state.tier : undefined;
  useEffect(() => {
    if (closedTier !== undefined) announceClose(e.id, name, closedTier);
  }, [closedTier, e.id, name]);
  const target = escalationTarget(e);
  const noteTier = noteTierOf(e);
  const progress = noteProgressOf(e);

  /* ── TITLES — TODO-COPY, every line ── */
  const titleOf = (n: TimelineNode): string => {
    switch (n.kind) {
      case "raised":
        return target === PLATFORM ? "Raised · Platform concern" : `Raised · Tier ${target} requested`;
      case "moment": {
        const m = e.moments?.find((x) => x.id === n.momentId);
        /* The quote is what expanding reveals — never cut mid-sentence here. */
        return m ? `Added from the chat · ${m.quote.senderName}` : "Added from the chat";
      }
      case "assessment":
        if (n.state === "current") return lens === "mentor" ? `Go through the assessment with ${name}` : `${mentorName === "the mentor" ? "The mentor is" : `${mentorName} is`} going through the assessment`;
        return lens === "mentor" ? "Assessment sent" : "Assessment received";
      case "waiting":
        /* TODO-COPY. ═══ THE HOLDER'S SINGLE HOME (pack v5.0, Supersession 1) ═══
           The hero states state; who has it lives here. */
        return n.state === "current" ? `${supervisorName} has this. Stay with ${name}.` : `${supervisorName} took it from here`;
      case "review":
        return "Review the report";
      case "confirm":
        return n.state === "current" ? `Confirm ${name}'s tier` : `Tier ${e.confirmedTier} confirmed`;
      case "note":
        /* ═══ ONE NOTE NODE (pack v6.1) ═══ Its title carries the live
           progress; complete, it says so and expands to the summaries. */
        return n.state === "completed" ? "Crisis note complete" : progress ? `Crisis note · ${progress.done} of ${progress.total}` : "Crisis note";
      case "close":
        /* Done, it says what happened — a Tier 3 exit scheduled nothing
           (pack v8.0: the supervisor's closed record is drawn now). */
        return n.state === "completed" ? (e.followUp ? "Closed · follow-up scheduled" : "Closed") : "Close and schedule the follow-up";
      case "closed":
        return "Escalation closed";
    }
  };

  const cardOf = (n: TimelineNode): React.ReactNode => {
    switch (n.kind) {
      case "assessment":
        /* ═══ ONE DECK, BOTH LENSES (pack v8.0, Supersession 1) ═══ The
           holder answers on it; the observing supervisor reads its rail
           filling in live. It replaces v6.1's accordion. */
        return lens === "mentor" ? (
          <AssessmentDeck
            e={e}
            name={name}
            mode="holder"
            onAnswer={(id, v) => tiering.answer(teenId, id, v)}
            onUseWording={onUseWording}
            onSubmit={(summary) => tiering.submitAssessment(teenId, summary)}
          />
        ) : (
          <AssessmentDeck e={e} name={name} mode="observer" />
        );
      case "waiting":
        /* ═══ THE WAITING MODULE (pack v4.0, Workstream D) ═══ */
        return (
          <WaitingModule
            name={name}
            supervisorName={supervisorName}
            echo={echo}
            teenLines={teenLines}
            onUseWording={onUseWording}
          />
        );
      case "review":
        return <ReviewCard e={e} name={name} tiering={tiering} teenId={teenId} onSettled={onSettled} />;
      case "confirm":
        return <ConfirmCard e={e} name={name} tiering={tiering} teenId={teenId} onSettled={onSettled} />;
      case "note":
        return noteTier ? <CrisisNoteAccordion e={e} tier={noteTier} name={name} tiering={tiering} teenId={teenId} teenLines={teenLines} mentorLines={mentorLines} /> : null;
      case "close":
        return <CloseCard e={e} name={name} tiering={tiering} teenId={teenId} onSettled={onSettled} />;
      case "closed": {
        /* ═══ THE CLOSED STATE IS A DESIGNED SUMMARY (Workstream E4) ═══
           Label over value, one type step each; the tier MOVEMENT as two
           lozenges; the follow-up as a date. It settles in once (make it
           magical 2: the system exhales). */
        const from = e.confirmedTier;
        const to = state.tier;
        const outcomeLabel = e.outcome ? (OUTCOMES.find((o) => o.id === e.outcome!.id)?.label ?? (e.outcome.id === "tier_update" ? "Standard tier update" : "Reviewed")) : null;
        return (
          <div data-wrap className="tier-settle space-y-4 rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] p-4">
            <dl className="space-y-3">
              {outcomeLabel && (
                <WrapRow label="Outcome" slot="outcome">
                  <span data-wrap-outcome>{outcomeLabel}</span>
                </WrapRow>
              )}
              {to !== null && (
                <WrapRow label="Tier" slot="tier">
                  <span data-wrap-tier className="inline-flex flex-wrap items-center gap-1.5">
                    {from !== undefined && from !== to ? (
                      <>
                        <TierLozenge tier={from} long />
                        {/* A word, not an arrow (pack v5.0, D1). */}
                        <span className="text-[var(--text-muted)]">to</span>
                        <TierLozenge tier={to} long />
                      </>
                    ) : (
                      <TierLozenge tier={to} long />
                    )}
                  </span>
                </WrapRow>
              )}
              <WrapRow label="What happens next" slot="next">
                <span data-wrap-next className="text-[var(--text-secondary)]">
                  {/* TODO-COPY */}
                  {lens === "supervisor"
                    ? e.followUp
                      ? `You check in with ${name} again on the follow-up date. The full record is in History.`
                      : `Nothing more is needed on this one. The full record is in History.`
                    : e.followUp
                      ? `${supervisorName} checks in with ${name} again. Keep talking with ${name} as you normally would.`
                      : `Nothing more is needed from you on this one. Keep talking with ${name} as you normally would.`}
                </span>
              </WrapRow>
              {e.followUp && (
                <WrapRow label="Follow-up" slot="follow-up">
                  <span data-wrap-follow-up className="tabular-nums">
                    {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(e.followUp.dueAt)}
                  </span>
                </WrapRow>
              )}
            </dl>
            {/* ═══ ONE DISMISS (pack v8.0) ═══ Both lenses; it removes the tab,
                which leaves toward History, where the record now lives. */}
            <Primary slot="dismiss-summary" onClick={() => onDismiss?.()}>
              {/* TODO-COPY */}
              Dismiss
            </Primary>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const detailOf = (n: TimelineNode): React.ReactNode =>
    n.kind === "assessment" && n.state === "completed" ? <RiskChip level={risk} compact /> : null;

  const expandOf = (n: TimelineNode): React.ReactNode => {
    switch (n.kind) {
      case "raised":
        return e.contextNote ? <Quote slot="mentor-note" text={e.contextNote} who={lens === "mentor" ? "You" : mentorName} at={e.openedAt} /> : null;
      case "moment": {
        const m = e.moments?.find((x) => x.id === n.momentId);
        return m ? <Quote slot="moment" text={m.quote.text} who={m.quote.senderName} at={m.quote.at} note={m.note || undefined} /> : null;
      }
      case "assessment":
        return n.state === "completed" ? <AssessmentDeck e={e} name={name} mode="readonly" summaryBy={lens === "mentor" ? "You" : "Mentor's summary"} /> : null;
      case "confirm": {
        const ev = [...tiering.eventsFor(teenId)].reverse().find((x) => x.escalationId === e.id && (x.kind === "confirmed" || x.kind === "placed" || x.kind === "stepped-down"));
        return ev?.reason ? <p className="text-[var(--text-secondary)]" style={LABEL}>{ev.reason}</p> : null;
      }
      case "note":
        /* Complete but not yet closed, a saved row still amends; closed, the
           note is read-only. */
        return noteTier && lens === "supervisor" ? <CrisisNoteAccordion e={e} tier={noteTier} name={name} tiering={tiering} teenId={teenId} teenLines={teenLines} mentorLines={mentorLines} readOnly={!open} /> : null;
      default:
        return null;
    }
  };

  const current = nodes.find((n) => n.state === "current");
  /* ═══ THE FUTURE IS ONE ROW (pack v4.0, Supersession 1) ═══ The upcoming
     nodes fold into the collapsed "Up next" path at the top; the rest of the
     spine is the current node and what is done. */
  const upcoming = nodes.filter((n) => n.state === "upcoming");
  const rest = nodes.filter((n) => n.state !== "upcoming");
  /* ═══ ACTION OR WAITING (Workstream C) ═══ Waiting is a current step that
     belongs to the other lens: the mentor while the supervisor has it, the
     supervisor while the mentor assesses (S0). */
  const variantOf = (n: TimelineNode): NodeVariant =>
    n.state === "current" && (n.kind === "waiting" || (n.kind === "assessment" && lens === "supervisor")) ? "waiting" : "action";
  const subOf = (n: TimelineNode): string | undefined =>
    n.kind === "note" && n.state === "completed" && e.outcome?.id ? (OUTCOMES.find((o) => o.id === e.outcome!.id)?.label ?? undefined) : undefined;
  /* ═══ ONE LABEL SET FOR THE FUTURE (pack v5.0, A3) ═══ The path row and
     its locked rows read these and only these. TODO-COPY. */
  const stepName = (n: TimelineNode): string => {
    switch (n.kind) {
      case "waiting":
        return `${supervisorName} takes it from here`;
      case "confirm":
        return "Confirm tier";
      case "note":
        return "Crisis note";
      case "close":
      case "closed":
        return "Close & follow-up";
      default:
        return titleOf(n);
    }
  };
  /* At most ONE settling node: the latest completion, if it happened here. */
  const freshId = nodes.filter((n) => n.state === "completed" && n.at !== null && n.at >= OPENED_AT).sort((x, y) => (y.at ?? 0) - (x.at ?? 0))[0]?.id;
  const live = current ? `Now: ${titleOf(current)}` : "";

  return (
    <section data-exchange data-lens={lens} data-stage={stage} data-tier={String(tier)} aria-label="Escalation" className="space-y-4">
      {/* The hero above the Care tabs carries the tier, the holder and the
          Support link (pack v4.0); the timeline keeps the announcement. */}
      <p data-timeline-live role="status" aria-live="polite" className="sr-only">
        {live}
      </p>
      <ol data-timeline aria-label="Escalation timeline">
        {upcoming.length > 0 && <UpNext steps={upcoming} stepName={stepName} />}
        {rest.map((n, i) => (
          <Node
            key={n.id}
            accent={isAlertTier(tier) ? "alert" : "neutral"}
            variant={variantOf(n)}
            trace={arrived && n.state === "current"}
            node={n}
            fresh={n.id === freshId}
            title={titleOf(n)}
            sub={subOf(n)}
            detail={detailOf(n)}
            expand={n.state === "completed" ? expandOf(n) : undefined}
            last={i === rest.length - 1}
          >
            {n.state === "current" ? cardOf(n) : undefined}
          </Node>
        ))}
      </ol>
    </section>
  );
}
