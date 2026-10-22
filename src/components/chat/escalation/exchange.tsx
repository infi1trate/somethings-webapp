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

import { useId, useState } from "react";
import { ArrowRight, Check, ChevronDown, Lock, Sparkles } from "lucide-react";
import { RequestedChip } from "@/components/tiering/requested-chip";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import type { EscalationState } from "@/lib/chat/types";
import { REFERRAL_TYPE } from "@/lib/record/people-demo";
import {
  ASSESSMENT_QUESTIONS,
  CLINICAL_SUBTYPES,
  CLOSE_OUT_TIER_COPY,
  CRISIS_SECTION_LABEL,
  CRISIS_TAGS,
  EMERGENCY_SERVICES,
  FOLLOW_UP_IN,
  OUTCOMES,
  RISK_LABEL,
  SAFETY_PLAN_STATUS,
  activeStep,
  answeredCount,
  askedSteps,
  assessmentOf,
  autoOutcome,
  draftDebrief,
  escalationTarget,
  mentorStage,
  riskLevel,
  sectionDone,
  supervisorStage,
  workingTier,
  type CrisisNote,
  type CrisisSectionId,
  type RiskLevel,
} from "@/lib/tiering/escalation";
import { assessmentProgress, orderNodes, timelineNodes, type Lens, type TimelineNode } from "@/lib/tiering/timeline";
import type { Tiering } from "@/lib/tiering/use-tiering";
import { PLATFORM, TIER_NAME, type Tier } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const BODY = { font: "var(--type-body)" } as const;
const LABEL = { font: "var(--type-field-label)" } as const;
const TITLE = { font: "var(--type-card-title)" } as const;

// ── PRIMITIVES ──────────────────────────────────────────────────────────────

/** ═══ THE ONE PRIMARY, NEVER RED (pack v3.0) ═══ v2 turned it alert-red on a
 *  Tier 1–2 confirm; the requested tier stays neutral until confirmed. */
function Primary({ children, onClick, slot }: { children: React.ReactNode; onClick: () => void; slot: string }) {
  return (
    <button
      type="button"
      data-exchange-primary={slot}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[var(--text-inverse)] transition-opacity hover:opacity-90",
        "bg-[var(--text-primary)]",
        RING
      )}
      style={{ font: "var(--type-button)" }}
    >
      {children}
    </button>
  );
}

/** ═══ RADIOGROUPS MOVE BY ARROW KEY (WAI-ARIA radio pattern) ═══ One tab
 *  stop per group — the checked radio, or the first when none is — and the
 *  arrows move focus AND selection, as a native radio set does. */
function onRadioKeys(ev: React.KeyboardEvent<HTMLElement>) {
  const step = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  const radios = [...ev.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])')];
  const i = radios.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  ev.preventDefault();
  const next = radios[(i + step + radios.length) % radios.length];
  next.focus();
  next.click();
}
const rovingTab = (on: boolean, first: boolean, anyOn: boolean) => (on || (!anyOn && first) ? 0 : -1);

function Field({ label, value, onChange, rows = 2, slot, invalid = false, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; slot: string; invalid?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[var(--text-muted)]" style={LABEL}>
        {label}
      </label>
      <textarea
        id={id}
        data-exchange-field={slot}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={cn(
          "block w-full resize-none rounded-[var(--radius-control)] border bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
          invalid ? "border-[color:var(--state-error)]" : "border-[color:var(--border-subtle)]",
          RING
        )}
        style={BODY}
      />
    </div>
  );
}

/** A Yes / No pair as a radiogroup. */
function YesNo({ value, onChange, label, slot }: { value: boolean | null | undefined; onChange: (v: boolean) => void; label: string; slot: string }) {
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onRadioKeys} className="flex gap-1.5">
      {[true, false].map((v, i) => {
        const on = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={rovingTab(on, i === 0, value === true || value === false)}
            data-yes-no={`${slot}:${v ? "yes" : "no"}`}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex min-h-9 min-w-14 items-center justify-center gap-1 rounded-full border px-3",
              on ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)] text-[var(--text-primary)]" : "border-[color:var(--border-subtle)] text-[var(--text-secondary)]",
              !on && "hover:bg-[var(--tint-hover)]",
              RING
            )}
            style={BODY}
          >
            {on && <Check aria-hidden className="size-3.5" />}
            {v ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

/** Checkbox chips — a multi-select whose state is in words and a mark. */
function Chips<T extends string>({ options, value, onChange, label }: { options: readonly { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            data-chip={o.id}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
            className={cn(
              "inline-flex min-h-8 items-center gap-1 rounded-full border px-3",
              on ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)] text-[var(--text-primary)]" : "border-[color:var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
              RING
            )}
            style={BODY}
          >
            {on && <Check aria-hidden className="size-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Single choice as radio rows. */
function Choice<T extends string>({ options, value, onChange, label, slot }: { options: readonly { id: T; label: string }[]; value: T | null | undefined; onChange: (v: T) => void; label: string; slot: string }) {
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onRadioKeys} className="space-y-1.5">
      {options.map((o, i) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={rovingTab(on, i === 0, options.some((x) => x.id === value))}
            data-choice={`${slot}:${o.id}`}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[var(--radius-inset)] border px-3 py-2 text-left",
              on ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)]" : "border-[color:var(--border-subtle)] bg-[var(--surface-s1)] hover:bg-[var(--tint-hover)]",
              RING
            )}
            style={BODY}
          >
            <span aria-hidden className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-[color:var(--text-primary)]" : "border-[color:var(--border-default)]")}>
              {on && <span className="size-2 rounded-full bg-[var(--text-primary)]" />}
            </span>
            <span className="text-[var(--text-primary)]">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── THE RISK CHIP ───────────────────────────────────────────────────────────

/** ═══ ADVISORY, NEVER A TIER ═══ Computed from the answers, keyed on the
 *  level so each change settles once. NEUTRAL (pack v3.0, F3): the level is
 *  in words. `compact` drops the "Assessment suggests:" lead-in, for a
 *  timeline line whose title already says what the chip is about. */
export function RiskChip({ level, compact = false }: { level: RiskLevel | null; compact?: boolean }) {
  if (!level) return null;
  return (
    <span
      key={level}
      data-risk-chip={level}
      className={cn(
        /* ═══ NEUTRAL, IN EVERY LEVEL (pack v3.0, Workstream F3) ═══ Red in the
           mentor's escalation view is the banner's, the escalation dot's and
           the Tier 1–2 lozenges' alone. The chip was alert-tinted for
           Moderate and High; it is words in a neutral chip now, and the level
           is never colour alone anyway. */
        "tier-settle inline-flex h-6 shrink-0 items-center rounded-full border border-[color:var(--border-default)] bg-[var(--surface-card)] px-2.5 text-[var(--text-primary)]"
      )}
      style={LABEL}
    >
      {/* TODO-COPY */}
      {compact ? RISK_LABEL[level] : `Assessment suggests: ${RISK_LABEL[level]}`}
    </span>
  );
}

// ── THE CRISIS NOTE'S ONE-LINE SUMMARIES ─────────────────────────────────────

function noteSummary(note: CrisisNote, id: CrisisSectionId): string {
  const label = <T extends { id: string; label: string }>(list: readonly T[], v?: string) => list.find((x) => x.id === v)?.label ?? v ?? "";
  switch (id) {
    case "subtype":
      return [label(CLINICAL_SUBTYPES, note.subtype), ...(note.tags ?? []).map((t) => label(CRISIS_TAGS, t))].filter(Boolean).join(" · ");
    case "safety-plan":
      return label(SAFETY_PLAN_STATUS, note.safetyPlan?.status);
    case "resources":
      return note.resources?.shared ? note.resources.list : "None shared";
    case "referral":
      return note.referral?.made ? note.referral.list.map((r) => label(REFERRAL_TYPE, r)).join(", ") : "No referral";
    case "emergency":
      return [note.contact?.engaged ? "Contact engaged" : "Contact not engaged", note.services?.contacted ? note.services.which.map((s) => label(EMERGENCY_SERVICES, s)).join(", ") : "No services"].join(" · ");
  }
}


// ── QUOTE FRAME ─────────────────────────────────────────────────────────────

/** ═══ A NOTE OR A MESSAGE IS ALWAYS QUOTE-FRAMED (Workstream E3) ═══ With
 *  attribution and time, so raw text can never read as a UI header. */
function Quote({ text, who, at, note, slot }: { text: string; who: string; at: number; note?: string; slot: string }) {
  return (
    <figure data-quote={slot} className="rounded-[var(--radius-inset)] border-l-2 border-[color:var(--border-default)] bg-[var(--surface-s1)] py-2 pr-3 pl-3">
      <blockquote className="text-[var(--text-primary)]" style={BODY}>
        &ldquo;{text}&rdquo;
      </blockquote>
      <figcaption className="mt-1 tabular-nums text-[var(--text-muted)]" style={LABEL}>
        {who}, {TIME.format(at)}
      </figcaption>
      {note && (
        <p className="mt-1.5 text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY */}
          Note: {note}
        </p>
      )}
    </figure>
  );
}

// ── THE HEADER — absorbs every status fragment; nothing below restates it ──

function TimelineHeader({
  e,
  tiering,
  teenId,
  lens,
  supervisorName,
  mentorName,
  presence,
  onSupport,
  live,
}: {
  e: EscalationState;
  tiering: Tiering;
  teenId: string;
  lens: Lens;
  supervisorName: string;
  mentorName: string;
  presence?: string;
  onSupport?: () => void;
  live: string;
}) {
  const target = escalationTarget(e);
  const confirmed = e.confirmedTier !== undefined;
  const nowTier = tiering.stateFor(teenId).tier;
  const who = (() => {
    const ev = [...tiering.eventsFor(teenId)].reverse().find((x) => x.escalationId === e.id && (x.kind === "confirmed" || x.kind === "placed" || x.kind === "stepped-down"));
    return ev ? tiering.nameOf(ev.actor) : null;
  })();
  return (
    <header data-timeline-header className="space-y-1.5">
      <div data-tier-line className="flex flex-wrap items-center gap-2">
        <h3 className="text-[var(--text-primary)]" style={TITLE}>
          {/* TODO-COPY */}
          Escalation
        </h3>
        {target === PLATFORM ? (
          <span className="inline-flex h-6 items-center rounded-full border border-[color:var(--border-default)] px-2.5 text-[var(--text-secondary)]" style={LABEL}>
            Platform concern
          </span>
        ) : confirmed ? (
          /* The chip settles into the lozenge in place (v2's magic, kept). */
          <span key={`c-${e.confirmedTier}`} className="tier-settle inline-flex">
            <TierLozenge tier={e.confirmedTier!} long />
          </span>
        ) : (
          <RequestedChip tier={target} />
        )}
      </div>
      <p data-timeline-meta className="tabular-nums text-[var(--text-secondary)]" style={LABEL}>
        {/* TODO-COPY */}
        Opened {TIME.format(e.openedAt)} · {supervisorName} notified
        {presence ? ` · ${presence}` : ""}
      </p>
      {target !== PLATFORM && (
        <p data-tier-line-text className="tabular-nums text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY */}
          {e.resolvedAt !== null
            ? /* CLOSED: the movement, not the confirmation — a Tier 1 line beside
                 "moves to Tier 3" read as a contradiction (measured in v2). */
              `Closed ${TIME.format(e.resolvedAt)}${confirmed && nowTier !== null && nowTier !== e.confirmedTier ? ` · Tier ${e.confirmedTier} → Tier ${nowTier} ${TIER_NAME[nowTier]}` : ""}`
            : confirmed
              ? `Tier ${e.confirmedTier} confirmed${who ? ` by ${who}` : ""}${e.confirmedAt ? ` · ${TIME.format(e.confirmedAt)}` : ""}`
              : "Awaiting confirmation on tiering"}
        </p>
      )}
      {onSupport && e.resolvedAt === null && (
        /* ═══ THE ONE REMNANT OF GUIDANCE (Supersession 2) ═══ Coaching
           happens in the Support thread; this is the quiet way there. */
        <button
          type="button"
          data-timeline-support={lens}
          onClick={onSupport}
          className={cn("inline-flex min-h-8 items-center gap-1 rounded-sm text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
          style={LABEL}
        >
          {/* TODO-COPY */}
          {lens === "supervisor" ? `Message ${mentorName} in Support` : "Reply in Support"} <ArrowRight aria-hidden className="size-3.5" />
        </button>
      )}
      {/* ═══ THE CURRENT NODE, ANNOUNCED ═══ A polite region that names the
          step whenever it changes — the timeline's equivalent of the retired
          baton's live line, without the banner. */}
      <p data-timeline-live role="status" aria-live="polite" className="sr-only">
        {live}
      </p>
    </header>
  );
}

// ── THE NODE ────────────────────────────────────────────────────────────────

/** ═══ WHEN THIS PAGE OPENED ═══ Module scope, not render: a node completed
 *  after this moment was completed HERE, and is the one that settles. Nodes
 *  already done when the page opened stay still, so a load never animates
 *  the whole spine at once. */
const OPENED_AT = Date.now();

function NodeGlyph({ state, fresh = false }: { state: TimelineNode["state"]; fresh?: boolean }) {
  if (state === "completed")
    return (
      /* ═══ THE HANDOFF (make it magical 1) ═══ The node that just completed
         checks and settles — one beat — while the next node takes the pulse.
         `tier-settle` is off under reduced motion. */
      <span aria-hidden data-node-fresh={fresh || undefined} className={cn("relative z-[1] flex size-6 items-center justify-center rounded-full bg-[var(--surface-s2)] text-[var(--text-primary)]", fresh && "tier-settle")}>
        <Check className="size-3.5" />
      </span>
    );
  if (state === "current")
    /* The pulse is the Bloom ink, never alert red — red is spent on the
       banner, the escalation dot and Tier 1–2 lozenges (Workstream F3).
       Reduced motion: a static emphasised ring (`.node-pulse`). */
    return (
      <span aria-hidden data-node-pulse className="node-pulse relative z-[1] flex size-6 items-center justify-center rounded-full border-2 border-[color:var(--text-primary)] bg-[var(--surface-card)]">
        <span className="size-2 rounded-full bg-[var(--text-primary)]" />
      </span>
    );
  return (
    <span aria-hidden className="relative z-[1] flex size-6 items-center justify-center rounded-full border border-dashed border-[color:var(--border-default)] bg-[var(--surface-card)] text-[var(--text-muted)]">
      <Lock className="size-3" />
    </span>
  );
}

function Node({
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
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li data-node={node.id} data-node-kind={node.kind} data-node-state={node.state} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3">
      {/* THE SPINE: a hairline from this node to the next. */}
      {!last && <span aria-hidden className="absolute top-6 bottom-0 left-[11.5px] w-px bg-[var(--border-subtle)]" />}
      <div className="pt-0.5">
        <NodeGlyph state={node.state} fresh={fresh} />
      </div>
      <div className={cn("min-w-0", last ? "pb-0" : "pb-4")}>
        {node.state === "upcoming" ? (
          <p data-node-condition className="pt-1 text-[var(--text-muted)]" style={LABEL}>
            {node.condition ?? title}
          </p>
        ) : node.state === "current" ? (
          <div data-node-card className="space-y-3">
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
                  className={cn("flex min-w-0 items-center gap-1.5 rounded-sm text-left text-[var(--text-primary)]", detail ? "shrink-0" : "flex-1", RING)}
                  style={BODY}
                >
                  <span className="min-w-0 truncate">{title}</span>
                  <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 text-[var(--icon-secondary)] transition-transform motion-reduce:transition-none", open && "rotate-180")} />
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]" style={BODY}>
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

// ── THE ASSESSMENT (mentor's current node) ─────────────────────────────────

function AssessmentCard({ e, name, onAnswer, onUseWording, tiering, teenId }: { e: EscalationState; name: string; onAnswer: (id: string, v: "yes" | "no") => void; onUseWording: (t: string) => void; tiering: Tiering; teenId: string }) {
  const answers = assessmentOf(e).answers;
  const steps = askedSteps(answers);
  const active = activeStep(answers);
  const answered = steps.filter((s) => answers[s.id]);
  const [summary, setSummary] = useState(e.mentorSummary ?? "");
  const [tried, setTried] = useState(false);
  return (
    <div data-m2 className="space-y-3">
      <div data-assessment className="space-y-2.5">
        {answered.length > 0 && (
          <ol data-assessment-answered className="space-y-1">
            {answered.map((s) => (
              <li key={s.id} data-answered={s.id} className="flex items-center gap-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-1.5" style={LABEL}>
                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{s.followUpOf ? `↳ ${s.text}` : s.text}</span>
                <span className="shrink-0 text-[var(--text-primary)]">{answers[s.id].value === "yes" ? "Yes" : "No"}</span>
              </li>
            ))}
          </ol>
        )}
        {active && (
          <div data-assessment-active={active.id} className="rounded-[var(--radius-inset)] border border-[color:var(--border-default)] bg-[var(--surface-card)] px-3 py-3">
            {/* ═══ THE NEXT QUESTION IS ANNOUNCED ═══ Answering keeps focus on
                the same Yes/No (React reuses the buttons); this polite, atomic
                region reads the new question once. */}
            <div data-question-live aria-live="polite" aria-atomic="true">
              <p className="text-[var(--text-muted)]" style={LABEL}>
                {active.followUpOf ? "Follow-up" : `Question ${ASSESSMENT_QUESTIONS.findIndex((q) => q.id === active.id) + 1}`}
              </p>
              <p className="mt-1 text-[var(--text-primary)]" style={TITLE}>
                &ldquo;{active.text}&rdquo;
              </p>
              {active.example && (
                <p className="mt-1 text-[var(--text-secondary)]" style={LABEL}>
                  {active.example}
                </p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                data-assessment-wording={active.id}
                onClick={() => onUseWording(active.text)}
                className={cn("inline-flex min-h-9 items-center rounded-full border border-dashed border-[color:var(--border-contour)] px-3 text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]", RING)}
                style={LABEL}
              >
                {/* TODO-COPY */}
                Put in message box
              </button>
              {/* ═══ ANSWERS ARE ACTIONS, NOT A SELECTION ═══ Two buttons in a
                  labelled group: as radios, an arrow key would answer a
                  clinical question by accident. */}
              <div role="group" aria-label={`${name}'s answer`} className="flex gap-1.5">
                {(["yes", "no"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    data-yes-no={`${active.id}:${v}`}
                    onClick={() => onAnswer(active.id, v)}
                    className={cn("inline-flex min-h-9 min-w-14 items-center justify-center rounded-full border border-[color:var(--border-default)] px-3 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
                    style={BODY}
                  >
                    {v === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
            {/* ═══ THE PROGRESS LINE, FOLDED INTO THE CARD (Workstream D) ═══ */}
            <p data-assessment-progress className="mt-3 border-t border-[color:var(--border-subtle)] pt-2 tabular-nums text-[var(--text-muted)]" style={LABEL}>
              {/* TODO-COPY — the pack's line. */}
              {answeredCount(answers)} of {ASSESSMENT_QUESTIONS.length} answered · your supervisor sees each answer as you give it
            </p>
          </div>
        )}
      </div>
      {!active && (
        <div className="space-y-3">
          <Field slot="mentor-summary" label={`In a sentence or two, what's going on with ${name}`} value={summary} onChange={setSummary} invalid={tried && !summary.trim()} />
          {tried && !summary.trim() && (
            <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
              {/* TODO-COPY */}
              Add a sentence for your supervisor.
            </p>
          )}
          <Primary
            slot="submit-assessment"
            onClick={() => {
              setTried(true);
              if (!summary.trim()) return;
              tiering.submitAssessment(teenId, summary);
            }}
          >
            {/* TODO-COPY */}
            Submit to supervisor
          </Primary>
        </div>
      )}
    </div>
  );
}

function AnswersList({ e }: { e: EscalationState }) {
  const a = assessmentOf(e);
  const steps = askedSteps(a.answers).filter((s) => a.answers[s.id]);
  return (
    <div className="space-y-1.5">
      {steps.map((s) => (
        <div key={s.id} data-s1-answer={s.id} className="flex items-center gap-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-1.5" style={LABEL}>
          <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{s.followUpOf ? "↳ Within the past 3 months" : s.assesses}</span>
          <span className="text-[var(--text-primary)]">{a.answers[s.id].value === "yes" ? "Yes" : "No"}</span>
        </div>
      ))}
      {e.mentorSummary && <Quote slot="mentor-summary" text={e.mentorSummary} who="Mentor's summary" at={a.submittedAt ?? e.openedAt} />}
    </div>
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
          if (tiering.confirm(teenId, tier, reason) && tier >= 3) onSettled?.();
        }}
      >
        {/* TODO-COPY */}
        {tier === target ? `Confirm Tier ${tier}` : tier !== null ? `Adjust to Tier ${tier}` : "Choose a tier"}
      </Primary>
    </div>
  );
}

function ReviewCard({ tiering, teenId, onSettled }: { tiering: Tiering; teenId: string; onSettled?: () => void }) {
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
          onSettled?.();
        }}
      >
        {/* TODO-COPY */}
        Mark reviewed
      </Primary>
    </div>
  );
}

// ── THE CRISIS NOTE, ONE SECTION PER NODE ──────────────────────────────────

function SectionCard({ id, note, onSave, editing = false }: { id: CrisisSectionId; note: CrisisNote | undefined; onSave: (patch: Partial<CrisisNote>) => void; editing?: boolean }) {
  const [draft, setDraft] = useState<CrisisNote>(note ?? {});
  const d = { ...note, ...draft };
  const set = (patch: Partial<CrisisNote>) => setDraft((x) => ({ ...x, ...patch }));
  const [tried, setTried] = useState(false);
  return (
    <div data-crisis-section={id} data-open className="space-y-3">
      {id === "subtype" && (
        <>
          <Choice label="Clinical subtype" slot="subtype" options={CLINICAL_SUBTYPES} value={d.subtype as never} onChange={(v) => set({ subtype: v })} />
          <div>
            <p className="mb-1.5 text-[var(--text-muted)]" style={LABEL}>Additional tags (optional)</p>
            <Chips label="Additional tags" options={CRISIS_TAGS} value={(d.tags ?? []) as never[]} onChange={(v) => set({ tags: v })} />
          </div>
        </>
      )}
      {id === "safety-plan" && (
        <>
          <Choice label="Safety plan" slot="safety-plan" options={SAFETY_PLAN_STATUS} value={d.safetyPlan?.status as never} onChange={(v) => set({ safetyPlan: { status: v, usage: d.safetyPlan?.usage ?? "" } })} />
          <Field slot="safety-usage" label="How they'll use it" value={d.safetyPlan?.usage ?? ""} onChange={(v) => set({ safetyPlan: { status: d.safetyPlan?.status ?? "", usage: v } })} />
        </>
      )}
      {id === "resources" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-primary)]" style={BODY}>Resources shared?</span>
            <YesNo label="Resources shared" slot="resources" value={d.resources?.shared} onChange={(v) => set({ resources: { shared: v, list: d.resources?.list ?? "" } })} />
          </div>
          {d.resources?.shared && <Field slot="resources-list" label="Which resources" value={d.resources.list} onChange={(v) => set({ resources: { shared: true, list: v } })} invalid={tried && !d.resources.list.trim()} />}
        </>
      )}
      {id === "referral" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-primary)]" style={BODY}>Referral made?</span>
            <YesNo label="Referral made" slot="referral" value={d.referral?.made} onChange={(v) => set({ referral: { made: v, list: d.referral?.list ?? [] } })} />
          </div>
          {d.referral?.made && <Chips label="Referred to" options={REFERRAL_TYPE} value={d.referral.list as never[]} onChange={(v) => set({ referral: { made: true, list: v } })} />}
        </>
      )}
      {id === "emergency" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-primary)]" style={BODY}>Emergency contact engaged?</span>
            <YesNo label="Emergency contact engaged" slot="contact" value={d.contact?.engaged} onChange={(v) => set({ contact: { engaged: v, details: d.contact?.details ?? "" } })} />
          </div>
          {d.contact?.engaged && <Field slot="contact-details" label="Who, and how" value={d.contact.details} onChange={(v) => set({ contact: { engaged: true, details: v } })} invalid={tried && !d.contact.details.trim()} />}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-primary)]" style={BODY}>Emergency services contacted?</span>
            <YesNo label="Emergency services contacted" slot="services" value={d.services?.contacted} onChange={(v) => set({ services: { contacted: v, which: d.services?.which ?? [] } })} />
          </div>
          {d.services?.contacted && <Chips label="Which services" options={EMERGENCY_SERVICES} value={d.services.which as never[]} onChange={(v) => set({ services: { contacted: true, which: v } })} />}
        </>
      )}
      {tried && !sectionDone(d, id) && (
        <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
          {/* TODO-COPY */}
          Answer this section to continue.
        </p>
      )}
      <button
        type="button"
        data-crisis-continue={id}
        onClick={() => {
          setTried(true);
          if (!sectionDone(d, id)) return;
          onSave(d);
        }}
        className={cn("inline-flex min-h-10 items-center rounded-full bg-[var(--text-primary)] px-4 text-[var(--text-inverse)] hover:opacity-90", RING)}
        style={{ font: "var(--type-button)" }}
      >
        {/* TODO-COPY */}
        {editing ? "Save" : "Continue"}
      </button>
    </div>
  );
}

/** A completed section's expansion: its summary, and Edit while open. */
function SectionDone({ id, note, open, onSave }: { id: CrisisSectionId; note: CrisisNote; open: boolean; onSave: (patch: Partial<CrisisNote>) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <SectionCard
        id={id}
        note={note}
        editing
        onSave={(p) => {
          onSave(p);
          setEditing(false);
        }}
      />
    );
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-[var(--text-secondary)]" style={LABEL}>
        {noteSummary(note, id) || "—"}
      </p>
      {open && (
        <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${CRISIS_SECTION_LABEL[id]}`} className={cn("shrink-0 rounded-sm px-1 text-[var(--text-primary)] underline underline-offset-2", RING)} style={LABEL}>
          Edit
        </button>
      )}
    </div>
  );
}

// ── OUTCOME, THEN DEBRIEF (two nodes) ───────────────────────────────────────

function OutcomeCard({ e, tiering, teenId }: { e: EscalationState; tiering: Tiering; teenId: string }) {
  const auto = autoOutcome(e.crisisNote);
  const [id, setId] = useState<string | null>(e.outcome?.id ?? auto);
  const [tried, setTried] = useState(false);
  return (
    <div data-s3 className="space-y-3">
      {auto && id === auto && (
        <span data-auto-tagged className="inline-flex rounded-full bg-[var(--surface-s2)] px-2 py-0.5 text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY */}
          Suggested from the crisis note
        </span>
      )}
      <Choice label="Outcome" slot="outcome" options={OUTCOMES} value={id as never} onChange={(v) => setId(v)} />
      {tried && !id && (
        <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
          {/* TODO-COPY */}
          Choose an outcome to continue.
        </p>
      )}
      <Primary
        slot="choose-outcome"
        onClick={() => {
          setTried(true);
          if (!id) return;
          tiering.chooseOutcome(teenId, { id, autoTagged: id === auto });
        }}
      >
        {/* TODO-COPY */}
        Continue
      </Primary>
    </div>
  );
}

function DebriefCard({ e, name, tiering, teenId, teenLines, mentorLines }: { e: EscalationState; name: string; tiering: Tiering; teenId: string; teenLines: string[]; mentorLines: string[] }) {
  const draft = draftDebrief({ name, escalation: e, teenLines, mentorLines });
  const [debrief, setDebrief] = useState(e.outcome?.debrief || draft);
  const [plan, setPlan] = useState(e.outcome?.plan ?? "");
  const [additional, setAdditional] = useState(e.outcome?.additional ?? "");
  const [tried, setTried] = useState(false);
  const isDraft = debrief === draft;
  return (
    <div data-s3 className="space-y-4">
      <div>
        {isDraft && (
          /* ═══ CLEARLY A DRAFT ═══ Fake AI (answered 2026-10-21) — see
             `draftDebrief`. It drafts the narrative only. */
          <span data-ai-draft className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--border-default)] px-2 py-0.5 text-[var(--text-secondary)]" style={LABEL}>
            <Sparkles aria-hidden className="size-3" />
            {/* TODO-COPY */}
            AI draft · edit before saving
          </span>
        )}
        <Field slot="debrief" label="Debrief" value={debrief} onChange={setDebrief} rows={5} invalid={tried && !debrief.trim()} />
      </div>
      <Field slot="plan" label="Plan for continued support" value={plan} onChange={setPlan} invalid={tried && !plan.trim()} />
      <Field slot="additional" label="Additional information (optional)" value={additional} onChange={setAdditional} />
      {tried && (!debrief.trim() || !plan.trim()) && (
        <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
          {/* TODO-COPY */}
          Fill in the debrief and the plan.
        </p>
      )}
      <Primary
        slot="save-outcome"
        onClick={() => {
          setTried(true);
          if (!debrief.trim() || !plan.trim()) return;
          tiering.saveDebrief(teenId, { debrief: debrief.trim(), debriefIsDraft: isDraft, plan: plan.trim(), additional: additional.trim() });
        }}
      >
        {/* TODO-COPY */}
        Save debrief
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
          if (tiering.close(teenId, { followUpDays: days, reason: `Crisis note filed. ${outcome}`.trim() })) onSettled?.();
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
  presence,
  onUseWording,
  onReplyInSupport,
  teenLines,
  mentorLines,
  onSettled,
}: {
  e: EscalationState;
  teenId: string;
  name: string;
  lens: Lens;
  tiering: Tiering;
  supervisorName: string;
  /** How the supervisor lens names the mentor, for the Support link. */
  mentorName: string;
  presence?: string;
  onUseWording: (text: string) => void;
  /** Opens the Support thread with the other party (Supersession 2). */
  onReplyInSupport?: () => void;
  teenLines: string[];
  mentorLines: string[];
  /** ═══ THE HOST KEEPS CARE IN FRONT ═══ Called when this panel ends its
   *  own escalation (a close, an S1 exit, Mark reviewed) or the mentor
   *  leaves the wrap. */
  onSettled?: () => void;
}) {
  const state = tiering.stateFor(teenId);
  const tier = workingTier(e, state);
  const a = assessmentOf(e);
  const risk = riskLevel(a.answers);
  const stage = lens === "mentor" ? mentorStage(e, state) : supervisorStage(e);
  const nodes = orderNodes(timelineNodes(e, state, lens));
  const open = e.resolvedAt === null;
  const target = escalationTarget(e);
  const saveNote = (patch: Partial<CrisisNote>) => tiering.saveCrisisNote(teenId, patch);

  /* ── TITLES — TODO-COPY, every line ── */
  const titleOf = (n: TimelineNode): string => {
    switch (n.kind) {
      case "raised":
        return target === PLATFORM ? "Raised · Platform concern" : `Raised · Tier ${target} requested`;
      case "moment": {
        const m = e.moments?.find((x) => x.id === n.momentId);
        return m ? `Added from the chat · “${m.quote.text}”` : "Added from the chat";
      }
      case "assessment":
        if (n.state === "current") return lens === "mentor" ? `Go through the assessment with ${name}` : "Assessment in progress";
        return lens === "mentor" ? "Assessment sent" : "Assessment received";
      case "waiting":
        /* TODO-COPY — the pack's line, as the node's title; nothing else. */
        return n.state === "current" ? `${supervisorName} has this. Stay with ${name}.` : `${supervisorName} took it from here`;
      case "review":
        return "Review the report";
      case "confirm":
        return n.state === "current" ? `Confirm ${name}'s tier` : `Tier ${e.confirmedTier} confirmed`;
      case "note":
        return n.state === "current" ? CRISIS_SECTION_LABEL[n.section!] : `${CRISIS_SECTION_LABEL[n.section!]} · ${noteSummary(e.crisisNote ?? {}, n.section!)}`;
      case "outcome":
        return n.state === "current" ? "Record the outcome" : `Outcome · ${OUTCOMES.find((o) => o.id === e.outcome?.id)?.label ?? ""}`;
      case "debrief":
        return n.state === "current" ? "Write the debrief" : "Debrief saved";
      case "close":
        return "Close and schedule the follow-up";
      case "closed":
        return "Escalation closed";
    }
  };

  const cardOf = (n: TimelineNode): React.ReactNode => {
    switch (n.kind) {
      case "assessment":
        return lens === "mentor" ? (
          <AssessmentCard e={e} name={name} tiering={tiering} teenId={teenId} onAnswer={(id, v) => tiering.answer(teenId, id, v)} onUseWording={onUseWording} />
        ) : (
          /* Progress only — never the live questions (Workstream D). */
          <p data-s0-progress className="tabular-nums text-[var(--text-secondary)]" style={BODY}>
            {assessmentProgress(e)}
          </p>
        );
      case "waiting":
        /* NOTHING ELSE (Workstream D): the title says it, and "Reply in
           Support" is the header's. */
        return null;
      case "review":
        return <ReviewCard tiering={tiering} teenId={teenId} onSettled={onSettled} />;
      case "confirm":
        return <ConfirmCard e={e} name={name} tiering={tiering} teenId={teenId} onSettled={onSettled} />;
      case "note":
        return <SectionCard key={n.section} id={n.section!} note={e.crisisNote} onSave={saveNote} />;
      case "outcome":
        return <OutcomeCard e={e} tiering={tiering} teenId={teenId} />;
      case "debrief":
        return <DebriefCard e={e} name={name} tiering={tiering} teenId={teenId} teenLines={teenLines} mentorLines={mentorLines} />;
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
                        <span aria-hidden className="text-[var(--text-muted)]">→</span>
                        <span className="sr-only">to</span>
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
                  {e.followUp
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
            <Primary
              slot="back-to-care"
              onClick={() => {
                tiering.seeWrap(teenId);
                onSettled?.();
              }}
            >
              {/* TODO-COPY */}
              Back to Care
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
        return n.state === "completed" ? <AnswersList e={e} /> : null;
      case "confirm": {
        const ev = [...tiering.eventsFor(teenId)].reverse().find((x) => x.escalationId === e.id && (x.kind === "confirmed" || x.kind === "placed" || x.kind === "stepped-down"));
        return ev?.reason ? <p className="text-[var(--text-secondary)]" style={LABEL}>{ev.reason}</p> : null;
      }
      case "note":
        return e.crisisNote ? <SectionDone id={n.section!} note={e.crisisNote} open={open && lens === "supervisor"} onSave={saveNote} /> : null;
      default:
        return null;
    }
  };

  const current = nodes.find((n) => n.state === "current");
  /* At most ONE settling node: the latest completion, if it happened here. */
  const freshId = nodes.filter((n) => n.state === "completed" && n.at !== null && n.at >= OPENED_AT).sort((x, y) => (y.at ?? 0) - (x.at ?? 0))[0]?.id;
  const live = current ? `Now: ${titleOf(current)}` : "";

  return (
    <section data-exchange data-lens={lens} data-stage={stage} data-tier={String(tier)} aria-label="Escalation" className="space-y-4">
      <TimelineHeader e={e} tiering={tiering} teenId={teenId} lens={lens} supervisorName={supervisorName} mentorName={mentorName} presence={presence} onSupport={onReplyInSupport} live={live} />
      <ol data-timeline aria-label="Escalation timeline" className="border-t border-[color:var(--border-subtle)] pt-4">
        {nodes.map((n, i) => (
          <Node key={n.id} node={n} fresh={n.id === freshId} title={titleOf(n)} detail={detailOf(n)} expand={n.state === "completed" ? expandOf(n) : undefined} last={i === nodes.length - 1}>
            {n.state === "current" ? cardOf(n) : undefined}
          </Node>
        ))}
      </ol>
    </section>
  );
}
