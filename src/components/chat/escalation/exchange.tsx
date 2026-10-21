"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE ESCALATION EXCHANGE — a staged baton panel (pack v2.0)
//
// ═══ TURN-BASED, AND IT LOOKS IT ═══ At any moment one role holds the baton
// and has exactly ONE primary move. The panel renders that move large and
// everything else quiet:
//   (a) the baton strip — whose move it is, and who is here
//   (b) the current stage, expanded
//   (c) completed stages, collapsed into a spine with their times
//   (d) a pinned row: Emergency information (red only for Tier 1–2)
// Future stages are not rendered at all.
//
// ONE RECORD, TWO LENSES. The mentor (M2 assess · M3 stay with them · M4 wrap)
// and the supervisor (S1 confirm · S2 guide & document · S3 outcome & debrief
// · S4 close) read the same `EscalationState` through `lib/tiering/escalation`
// and write it through `useTiering` — there is no second state to disagree.
//
// SUPERSEDES the flat active-state panel of pack v1 (care.tsx), whose
// checklist, placeholder safety check and mentor Resolve are deleted.

import { useId, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
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
  activeSection,
  activeStep,
  answeredCount,
  askedSteps,
  assessmentOf,
  autoOutcome,
  crisisSections,
  draftDebrief,
  escalationTarget,
  mentorStage,
  needsAssessment,
  riskLevel,
  sectionDone,
  supervisorStage,
  workingTier,
  type CrisisNote,
  type CrisisSectionId,
  type RiskLevel,
} from "@/lib/tiering/escalation";
import type { Tiering } from "@/lib/tiering/use-tiering";
import { PLATFORM, isAlertTier, type Tier } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const BODY = { font: "var(--type-body)" } as const;
const LABEL = { font: "var(--type-field-label)" } as const;

// ── PRIMITIVES ──────────────────────────────────────────────────────────────

function Primary({ children, onClick, slot, red = false }: { children: React.ReactNode; onClick: () => void; slot: string; red?: boolean }) {
  return (
    <button
      type="button"
      data-exchange-primary={slot}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[var(--text-inverse)] transition-opacity hover:opacity-90",
        red ? "bg-[var(--alert-critical-accent)]" : "bg-[var(--text-primary)]",
        RING
      )}
      style={{ font: "var(--type-button)" }}
    >
      {children}
    </button>
  );
}

function Ghost({ children, onClick, slot }: { children: React.ReactNode; onClick: () => void; slot: string }) {
  return (
    <button
      type="button"
      data-exchange-ghost={slot}
      onClick={onClick}
      className={cn("inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-[var(--text-primary)] underline underline-offset-2 hover:no-underline", RING)}
      style={BODY}
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

/** ═══ ADVISORY, NEVER A TIER ═══ Computed live from the answers. Keyed on
 *  the level, so each change settles once (make it magical, 2). Alert colour
 *  is allowed here because the assessment exists only for Tier 1–2; the
 *  level is ALSO in words, so it is never colour alone. */
/** `compact` drops the "Assessment suggests:" lead-in, for the spine row,
 *  whose label already says what the chip is about. */
export function RiskChip({ level, compact = false }: { level: RiskLevel | null; compact?: boolean }) {
  if (!level) return null;
  return (
    <span
      key={level}
      data-risk-chip={level}
      className={cn(
        "tier-settle inline-flex h-6 shrink-0 items-center rounded-full border px-2.5",
        /* INK ON ITS OWN SOFT FILL. On the card surface `--t1-ink` measured
           4.36:1 in dark (fails AA); on `--t1-soft` it clears in both themes. */
        level === "high"
          ? "border-[color:var(--t1)] bg-[var(--t1-soft)] text-[var(--t1-ink)]"
          : level === "moderate"
            ? "border-[color:var(--t2)] bg-[var(--t2-soft)] text-[var(--t2-ink)]"
            : "border-[color:var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]"
      )}
      style={LABEL}
    >
      {/* TODO-COPY */}
      {compact ? RISK_LABEL[level] : `Assessment suggests: ${RISK_LABEL[level]}`}
    </span>
  );
}

// ── (a) THE BATON STRIP, (c) THE SPINE ──────────────────────────────────────

function BatonStrip({ yours, text, presence }: { yours: boolean; text: string; presence?: string }) {
  return (
    <div data-baton={yours ? "yours" : "theirs"} className="flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-3 py-2.5">
      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", yours ? "bg-[var(--text-primary)]" : "bg-[var(--status-online)]")} />
      <div className="min-w-0">
        {/* THE STAGE CHANGE IS ANNOUNCED: a polite live region, so a screen
            reader hears the baton move without being interrupted. */}
        <p data-baton-text role="status" aria-live="polite" className="text-[var(--text-primary)]" style={BODY}>
          {text}
        </p>
        {presence && (
          <p data-baton-presence className="text-[var(--text-secondary)]" style={LABEL}>
            {presence}
          </p>
        )}
      </div>
    </div>
  );
}

interface SpineRow {
  id: string;
  label: string;
  at: number | null;
  detail?: React.ReactNode;
}

function Spine({ rows }: { rows: SpineRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ol data-spine aria-label="Done so far" className="space-y-1">
      {rows.map((r) => (
        <li key={r.id} data-spine-row={r.id} className="flex items-center gap-2 rounded-[var(--radius-inset)] px-3 py-1.5 text-[var(--text-secondary)]" style={LABEL}>
          <Check aria-hidden className="size-3.5 shrink-0 text-[var(--text-primary)]" />
          {/* A row with a detail keeps its label whole and lets the detail sit
              beside it (measured: the full chip cut "Assessment sent" to "As…"). */}
          <span className={cn("text-[var(--text-primary)]", r.detail ? "shrink-0" : "min-w-0 flex-1 truncate")}>{r.label}</span>
          {r.detail && <span className="flex min-w-0 flex-1">{r.detail}</span>}
          {r.at !== null && <span className="shrink-0 tabular-nums">{TIME.format(r.at)}</span>}
        </li>
      ))}
    </ol>
  );
}

/** The tier line both lenses show: the request, then the confirmation
 *  settling into the lozenge in place (make it magical, 1). */
function TierLine({ e, tiering, teenId }: { e: EscalationState; tiering: Tiering; teenId: string }) {
  const target = escalationTarget(e);
  if (target === PLATFORM) return null;
  const confirmed = e.confirmedTier !== undefined;
  const who = (() => {
    const ev = [...tiering.eventsFor(teenId)].reverse().find((x) => x.escalationId === e.id && (x.kind === "confirmed" || x.kind === "placed" || x.kind === "stepped-down"));
    return ev ? tiering.nameOf(ev.actor) : null;
  })();
  return (
    <div data-tier-line className="flex flex-wrap items-center gap-2">
      {confirmed ? (
        <span key={`c-${e.confirmedTier}`} className="tier-settle inline-flex">
          <TierLozenge tier={e.confirmedTier!} long />
        </span>
      ) : (
        <RequestedChip tier={target} />
      )}
      <span data-tier-line-text className="text-[var(--text-secondary)]" style={LABEL}>
        {/* TODO-COPY */}
        {confirmed ? `Tier ${e.confirmedTier} confirmed${who ? ` by ${who}` : ""}${e.confirmedAt ? ` · ${TIME.format(e.confirmedAt)}` : ""}` : "Awaiting confirmation on tiering"}
      </span>
    </div>
  );
}

// ── THE MENTOR'S ASSESSMENT (M2) ────────────────────────────────────────────

function Assessment({
  e,
  name,
  onAnswer,
  onUseWording,
}: {
  e: EscalationState;
  name: string;
  onAnswer?: (id: string, v: "yes" | "no") => void;
  onUseWording?: (t: string) => void;
}) {
  const answers = assessmentOf(e).answers;
  const steps = askedSteps(answers);
  const active = activeStep(answers);
  const answered = steps.filter((s) => answers[s.id]);
  return (
    <div data-assessment className="space-y-2.5">
      <p data-assessment-progress className="tabular-nums text-[var(--text-muted)]" style={LABEL}>
        {/* TODO-COPY — the pack's line. */}
        {answeredCount(answers)} of {ASSESSMENT_QUESTIONS.length} answered · your supervisor sees each answer as you give it
      </p>
      {/* ANSWERED QUESTIONS COLLAPSE — one line each, read-only on screen.
          (`answer` replaces a value before Submit; no control offers it yet.) */}
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
      {/* THE ONE ACTIVE QUESTION — answering reveals the next. */}
      {active && (
        <div data-assessment-active={active.id} className="rounded-[var(--radius-inset)] border border-[color:var(--border-default)] bg-[var(--surface-card)] px-3 py-3">
          {/* ═══ THE NEXT QUESTION IS ANNOUNCED ═══ Answering keeps focus on
              the same Yes/No (React reuses the buttons), so nothing else would
              tell a screen reader the question changed. Polite and atomic: the
              whole question is read once, without interrupting. */}
          <div data-question-live aria-live="polite" aria-atomic="true">
            <p className="text-[var(--text-muted)]" style={LABEL}>
              {active.followUpOf ? "Follow-up" : `Question ${ASSESSMENT_QUESTIONS.findIndex((q) => q.id === active.id) + 1}`}
            </p>
            <p className="mt-1 text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
              &ldquo;{active.text}&rdquo;
            </p>
            {active.example && (
              <p className="mt-1 text-[var(--text-secondary)]" style={LABEL}>
                {active.example}
              </p>
            )}
          </div>
          {onAnswer && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {onUseWording && (
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
              )}
              {/* ═══ ANSWERS ARE ACTIONS, NOT A SELECTION ═══ Pressing one
                  records it and reveals the next question, so these are two
                  buttons in a labelled group — as radios, an arrow key would
                  answer a clinical question by accident. */}
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
          )}
        </div>
      )}
    </div>
  );
}

// ── THE CRISIS NOTE (S2) ────────────────────────────────────────────────────

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

function CrisisNoteEditor({ note, tier, onSave }: { note: CrisisNote | undefined; tier: Tier; onSave: (patch: Partial<CrisisNote>) => void }) {
  const [editing, setEditing] = useState<CrisisSectionId | null>(null);
  const open = editing ?? activeSection(note, tier);
  const [draft, setDraft] = useState<CrisisNote>(note ?? {});
  const d = { ...note, ...draft };
  const set = (patch: Partial<CrisisNote>) => setDraft((x) => ({ ...x, ...patch }));
  const [tried, setTried] = useState(false);
  const commit = (id: CrisisSectionId) => {
    setTried(true);
    if (!sectionDone(d, id)) return;
    onSave(d);
    setEditing(null);
    setTried(false);
  };
  return (
    <div data-crisis-note className="space-y-2">
      {crisisSections(tier).map((id, i) => {
        const done = sectionDone(note, id);
        if (id !== open) {
          return done ? (
            <div key={id} data-crisis-section={id} data-done className="flex items-center gap-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-1.5" style={LABEL}>
              <Check aria-hidden className="size-3.5 shrink-0 text-[var(--text-primary)]" />
              <span className="shrink-0 text-[var(--text-primary)]">{CRISIS_SECTION_LABEL[id]}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{noteSummary(note!, id)}</span>
              <button type="button" onClick={() => setEditing(id)} className={cn("shrink-0 rounded-sm px-1 text-[var(--text-primary)] underline underline-offset-2", RING)} aria-label={`Edit ${CRISIS_SECTION_LABEL[id]}`}>
                Edit
              </button>
            </div>
          ) : null; // future sections are not rendered
        }
        return (
          <fieldset key={id} data-crisis-section={id} data-open className="space-y-3 rounded-[var(--radius-inset)] border border-[color:var(--border-default)] bg-[var(--surface-card)] px-3 py-3">
            <legend className="px-1 text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
              {i + 1}. {CRISIS_SECTION_LABEL[id]}
            </legend>
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
              onClick={() => commit(id)}
              className={cn("inline-flex min-h-10 items-center rounded-full bg-[var(--text-primary)] px-4 text-[var(--text-inverse)] hover:opacity-90", RING)}
              style={{ font: "var(--type-button)" }}
            >
              {/* TODO-COPY */}
              {editing ? "Save" : "Continue"}
            </button>
          </fieldset>
        );
      })}
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
  lens: "mentor" | "supervisor";
  tiering: Tiering;
  supervisorName: string;
  presence?: string;
  onUseWording: (text: string) => void;
  onReplyInSupport?: () => void;
  teenLines: string[];
  mentorLines: string[];
  /** ═══ THE HOST KEEPS CARE IN FRONT ═══ Called when this panel ends its
   *  own escalation (a close, an S1 exit, Mark reviewed) or the mentor
   *  leaves the wrap — the moments the rail's "follow the escalation"
   *  default would otherwise turn away from the person who just acted. */
  onSettled?: () => void;
}) {
  const state = tiering.stateFor(teenId);
  const tier = workingTier(e, state);
  const a = assessmentOf(e);
  const risk = riskLevel(a.answers);
  const mStage = mentorStage(e, state);
  const sStage = supervisorStage(e);
  const stage = lens === "mentor" ? mStage : sStage;
  const latestGuidance = (e.guidance ?? []).at(-1);

  /* ── (c) THE SPINE, per lens ── */
  const rows: SpineRow[] = [
    { id: "raised", label: tier === PLATFORM ? "Raised · Platform safety" : `Raised · Tier ${escalationTarget(e)} requested`, at: e.openedAt },
    ...(a.submittedAt !== null ? [{ id: "assessed", label: "Assessment sent", at: a.submittedAt, detail: <RiskChip level={risk} compact /> }] : []),
    ...(e.confirmedTier !== undefined && lens === "supervisor" ? [{ id: "confirmed", label: `Tier ${e.confirmedTier} confirmed`, at: e.confirmedAt ?? null }] : []),
    ...(lens === "supervisor" && (sStage === "S3" || sStage === "S4") ? [{ id: "note", label: "Crisis note", at: e.crisisNote?.updatedAt ?? null }] : []),
    ...(lens === "supervisor" && sStage === "S4" ? [{ id: "outcome", label: `Outcome · ${OUTCOMES.find((o) => o.id === e.outcome?.id)?.label ?? ""}`, at: e.outcome?.savedAt ?? null }] : []),
  ];

  /* ── (a) THE BATON ── TODO-COPY, every line. */
  const yours = lens === "mentor" ? mStage === "M2" : sStage !== "closed";
  const baton =
    lens === "mentor"
      ? mStage === "M2"
        ? `Your move · go through the assessment with ${name}`
        : mStage === "M3"
          ? `${supervisorName} has this · stay with ${name}`
          : `${supervisorName} closed this escalation`
      : sStage === "S1"
        ? tier === PLATFORM
          ? "Your move · review this report"
          : `Your move · confirm ${name}'s tier`
        : sStage === "S2"
          ? `Your move · guide the mentor and write the crisis note`
          : sStage === "S3"
            ? "Your move · record the outcome and debrief"
            : "Your move · close out and schedule the follow-up";

  return (
    <section data-exchange data-lens={lens} data-stage={stage} data-tier={String(tier)} aria-label="Escalation" className="space-y-4">
      <BatonStrip yours={yours} text={baton} presence={presence} />
      <Spine rows={rows} />
      {/* Not at M4: the wrap states the tier NOW, and a Tier 1 lozenge beside
          "moves to Tier 3" read as a contradiction. */}
      {stage !== "M4" && <TierLine e={e} tiering={tiering} teenId={teenId} />}

      {/* ── (b) THE CURRENT STAGE ─────────────────────────────────────── */}
      <div data-stage-current={stage} className="space-y-4">
        {lens === "mentor" && mStage === "M2" && <MentorAssess e={e} name={name} tiering={tiering} teenId={teenId} risk={risk} onUseWording={onUseWording} />}

        {lens === "mentor" && mStage === "M3" && (
          <div data-stay className="space-y-3">
            <p className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
              {/* TODO-COPY — the pack's line. */}
              {supervisorName} has this. Stay with {name}.
            </p>
            {/* THE ONLY LIVE REGION in this stage: the supervisor's latest word. */}
            <div aria-live="polite">
              {latestGuidance ? (
                <figure data-guidance className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
                  <blockquote className="text-[var(--text-primary)]" style={BODY}>
                    &ldquo;{latestGuidance.text}&rdquo;
                  </blockquote>
                  <figcaption className="mt-1 tabular-nums text-[var(--text-muted)]" style={LABEL}>
                    {latestGuidance.author} · {TIME.format(latestGuidance.at)}
                  </figcaption>
                </figure>
              ) : (
                <p className="text-[var(--text-secondary)]" style={BODY}>
                  {/* TODO-COPY */}
                  Their guidance shows here as soon as they send it.
                </p>
              )}
            </div>
            {onReplyInSupport && (
              <Ghost slot="reply-in-support" onClick={onReplyInSupport}>
                Reply in Support <ArrowRight aria-hidden className="size-4" />
              </Ghost>
            )}
          </div>
        )}

        {lens === "mentor" && mStage === "M4" && (
          <div data-wrap className="space-y-3">
            <p className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
              {/* TODO-COPY */}
              Escalation closed
            </p>
            <dl className="space-y-1.5" style={BODY}>
              {e.outcome && (
                <div>
                  <dt className="text-[var(--text-muted)]" style={LABEL}>Outcome</dt>
                  <dd data-wrap-outcome className="text-[var(--text-primary)]">{OUTCOMES.find((o) => o.id === e.outcome!.id)?.label ?? (e.outcome.id === "tier_update" ? `Tier ${e.confirmedTier} confirmed` : "Reviewed")}</dd>
                </div>
              )}
              {state.tier !== null && (
                <div>
                  <dt className="text-[var(--text-muted)]" style={LABEL}>Tier now</dt>
                  <dd data-wrap-tier className="text-[var(--text-primary)]">
                    {/* The close-out copy — `CLOSE_OUT_TIER_COPY`, see its note. */}
                    {e.followUp ? `${name} moves to ${CLOSE_OUT_TIER_COPY}` : `Tier ${state.tier}`}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[var(--text-muted)]" style={LABEL}>What happens next</dt>
                <dd data-wrap-next className="text-[var(--text-secondary)]">
                  {/* TODO-COPY */}
                  {e.followUp
                    ? `${supervisorName} checks in on ${name} again ${new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(e.followUp.dueAt)}. Keep talking with ${name} as you normally would.`
                    : `Nothing more is needed from you on this one. Keep talking with ${name} as you normally would.`}
                </dd>
              </div>
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
        )}

        {lens === "supervisor" && sStage === "S1" && <SupervisorConfirm e={e} name={name} tiering={tiering} teenId={teenId} risk={risk} onSettled={onSettled} />}
        {lens === "supervisor" && sStage === "S2" && <SupervisorGuide e={e} tiering={tiering} teenId={teenId} />}
        {lens === "supervisor" && sStage === "S3" && <SupervisorOutcome e={e} name={name} tiering={tiering} teenId={teenId} teenLines={teenLines} mentorLines={mentorLines} />}
        {lens === "supervisor" && sStage === "S4" && <SupervisorClose e={e} name={name} tiering={tiering} teenId={teenId} onSettled={onSettled} />}
      </div>

      {/* ── (d) THE PINNED ROW IS GONE (pack v3.0, Supersession 5) ─────────
          Its red "Emergency information" doubled the banner's chip. The chip
          is the one entry and opens Care on the Emergency info tab. */}
    </section>
  );
}

// ── THE STAGES, ONE COMPONENT EACH ─────────────────────────────────────────

function MentorAssess({ e, name, tiering, teenId, risk, onUseWording }: { e: EscalationState; name: string; tiering: Tiering; teenId: string; risk: RiskLevel | null; onUseWording: (t: string) => void }) {
  const [summary, setSummary] = useState(e.mentorSummary ?? "");
  const [tried, setTried] = useState(false);
  const allAnswered = activeStep(assessmentOf(e).answers) === null;
  return (
    <div data-m2 className="space-y-3">
      <RiskChip level={risk} />
      <Assessment e={e} name={name} onAnswer={(id, v) => tiering.answer(teenId, id, v)} onUseWording={onUseWording} />
      {allAnswered && (
        <div className="space-y-3">
          <Field
            slot="mentor-summary"
            label={`In a sentence or two, what's going on with ${name}`}
            value={summary}
            onChange={setSummary}
            invalid={tried && !summary.trim()}
          />
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

function SupervisorConfirm({ e, name, tiering, teenId, risk, onSettled }: { e: EscalationState; name: string; tiering: Tiering; teenId: string; risk: RiskLevel | null; onSettled?: () => void }) {
  const target = escalationTarget(e);
  const a = assessmentOf(e);
  const [tier, setTier] = useState<Tier | null>(target === PLATFORM ? null : target);
  /* TODO-COPY. Prefilled because confirming the request IS the reason; the
     field stays required and editable, because every tier event has one. */
  const [reason, setReason] = useState(target === PLATFORM ? "" : "Confirmed on the mentor's note and assessment.");
  const [tried, setTried] = useState(false);
  const steps = askedSteps(a.answers).filter((s) => a.answers[s.id]);
  return (
    <div data-s1 className="space-y-3">
      {e.contextNote && (
        <figure className="rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
          <figcaption className="text-[var(--text-muted)]" style={LABEL}>
            {/* TODO-COPY */}
            The mentor&rsquo;s note
          </figcaption>
          <blockquote className="mt-0.5 text-[var(--text-primary)]" style={BODY}>
            &ldquo;{e.contextNote}&rdquo;
          </blockquote>
        </figure>
      )}
      {needsAssessment(target === PLATFORM ? PLATFORM : target) && (
        <div data-s1-answers className="space-y-1.5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="tabular-nums text-[var(--text-muted)]" style={LABEL}>
              {/* TODO-COPY */}
              {a.submittedAt !== null ? "Assessment sent" : `Mentor is assessing · ${answeredCount(a.answers)} of ${ASSESSMENT_QUESTIONS.length}`}
            </span>
            <RiskChip level={risk} />
          </div>
          {steps.map((s) => (
            <div key={s.id} data-s1-answer={s.id} className="flex items-center gap-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-1.5" style={LABEL}>
              <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{s.followUpOf ? "↳ Within the past 3 months" : s.assesses}</span>
              <span className="text-[var(--text-primary)]">{a.answers[s.id].value === "yes" ? "Yes" : "No"}</span>
            </div>
          ))}
          {e.mentorSummary && (
            <p className="text-[var(--text-primary)]" style={BODY}>
              {e.mentorSummary}
            </p>
          )}
        </div>
      )}
      {target === PLATFORM ? (
        <>
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
        </>
      ) : (
        <>
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
                    "flex min-h-11 items-center gap-2 rounded-[var(--radius-inset)] border px-3 py-2 text-left",
                    on ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)]" : "border-[color:var(--border-subtle)] bg-[var(--surface-s1)] hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  <TierLozenge tier={t} long />
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
            red={tier !== null && isAlertTier(tier)}
            onClick={() => {
              setTried(true);
              if (tier === null || !reason.trim()) return;
              if (tiering.confirm(teenId, tier, reason) && tier >= 3) onSettled?.();
            }}
          >
            {/* TODO-COPY */}
            {tier === target ? `Confirm Tier ${tier}` : tier !== null ? `Adjust to Tier ${tier}` : "Choose a tier"}
          </Primary>
        </>
      )}
    </div>
  );
}

function SupervisorGuide({ e, tiering, teenId }: { e: EscalationState; tiering: Tiering; teenId: string }) {
  const [text, setText] = useState("");
  const tier = e.confirmedTier as Tier;
  return (
    <div data-s2 className="space-y-5">
      <div data-guidance-composer className="space-y-2">
        <Field slot="guidance" label="Guidance for the mentor — they see it as soon as you send it" value={text} onChange={setText} />
        <button
          type="button"
          data-send-guidance
          onClick={() => {
            if (!text.trim()) return;
            tiering.postGuidance(teenId, text);
            setText("");
          }}
          className={cn("inline-flex min-h-10 items-center rounded-full border border-[color:var(--border-contour)] px-4 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
          style={BODY}
        >
          {/* TODO-COPY */}
          Send guidance
        </button>
        {(e.guidance ?? []).length > 0 && (
          <ol data-guidance-sent className="space-y-1">
            {(e.guidance ?? []).map((g) => (
              <li key={g.id} className="flex gap-2 text-[var(--text-secondary)]" style={LABEL}>
                <span className="shrink-0 tabular-nums">{TIME.format(g.at)}</span>
                <span className="min-w-0">{g.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
          {/* TODO-COPY */}
          Crisis note
        </h3>
        <CrisisNoteEditor note={e.crisisNote} tier={tier} onSave={(patch) => tiering.saveCrisisNote(teenId, patch)} />
      </div>
    </div>
  );
}

function SupervisorOutcome({ e, name, tiering, teenId, teenLines, mentorLines }: { e: EscalationState; name: string; tiering: Tiering; teenId: string; teenLines: string[]; mentorLines: string[] }) {
  const auto = autoOutcome(e.crisisNote);
  const [id, setId] = useState<string | null>(e.outcome?.id ?? auto);
  const draft = draftDebrief({ name, escalation: e, teenLines, mentorLines });
  const [debrief, setDebrief] = useState(e.outcome?.debrief ?? draft);
  const [plan, setPlan] = useState(e.outcome?.plan ?? "");
  const [additional, setAdditional] = useState(e.outcome?.additional ?? "");
  const [tried, setTried] = useState(false);
  const isDraft = debrief === draft;
  return (
    <div data-s3 className="space-y-4">
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[var(--text-muted)]" style={LABEL}>
            {/* TODO-COPY */}
            Outcome
          </span>
          {auto && id === auto && (
            <span data-auto-tagged className="rounded-full bg-[var(--surface-s2)] px-2 py-0.5 text-[var(--text-secondary)]" style={LABEL}>
              {/* TODO-COPY */}
              Suggested from the crisis note
            </span>
          )}
        </div>
        <Choice label="Outcome" slot="outcome" options={OUTCOMES} value={id as never} onChange={(v) => setId(v)} />
      </div>
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {isDraft && (
            /* ═══ CLEARLY A DRAFT ═══ Fake AI (answered 2026-10-21) — see
               `draftDebrief`. It drafts the narrative only. */
            <span data-ai-draft className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--border-default)] px-2 py-0.5 text-[var(--text-secondary)]" style={LABEL}>
              <Sparkles aria-hidden className="size-3" />
              {/* TODO-COPY */}
              AI draft · edit before saving
            </span>
          )}
        </div>
        <Field slot="debrief" label="Debrief" value={debrief} onChange={setDebrief} rows={5} invalid={tried && !debrief.trim()} />
      </div>
      <Field slot="plan" label="Plan for continued support" value={plan} onChange={setPlan} invalid={tried && !plan.trim()} />
      <Field slot="additional" label="Additional information (optional)" value={additional} onChange={setAdditional} />
      {tried && (!id || !debrief.trim() || !plan.trim()) && (
        <p role="alert" className="text-[var(--state-error)]" style={LABEL}>
          {/* TODO-COPY */}
          Choose an outcome and fill in the debrief and the plan.
        </p>
      )}
      <Primary
        slot="save-outcome"
        onClick={() => {
          setTried(true);
          if (!id || !debrief.trim() || !plan.trim()) return;
          tiering.saveOutcome(teenId, { id, autoTagged: id === auto, debrief: debrief.trim(), debriefIsDraft: isDraft, plan: plan.trim(), additional: additional.trim(), savedAt: null });
        }}
      >
        {/* TODO-COPY */}
        Save outcome
      </Primary>
    </div>
  );
}

function SupervisorClose({ e, name, tiering, teenId, onSettled }: { e: EscalationState; name: string; tiering: Tiering; teenId: string; onSettled?: () => void }) {
  const [days, setDays] = useState<number>(FOLLOW_UP_IN[0].days);
  const outcome = OUTCOMES.find((o) => o.id === e.outcome?.id)?.label ?? "";
  return (
    <div data-s4 className="space-y-4">
      <p data-close-destination className="text-[var(--text-primary)]" style={BODY}>
        {/* TODO-COPY. `CLOSE_OUT_TIER_COPY` — the blocked constant; see it. */}
        Closing moves {name} to {CLOSE_OUT_TIER_COPY} and files this escalation.
      </p>
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
