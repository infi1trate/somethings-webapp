"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE ESCALATION'S FORM PRIMITIVES — shared by the exchange and the two
// accordions (pack v6.1). Moved, unchanged, out of `exchange.tsx`: the one
// primary (never red), radiogroups that move by arrow key, the labelled
// field, Yes / No, chips, single choice, and the advisory risk chip.

import { useId } from "react";
import { Check } from "lucide-react";
import { RISK_LABEL, type RiskLevel } from "@/lib/tiering/escalation";
import { cn } from "@/lib/utils";

export const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
export const BODY = { font: "var(--type-body)" } as const;
export const LABEL = { font: "var(--type-field-label)" } as const;
export const TITLE = { font: "var(--type-card-title)" } as const;
/** An overline: 11/16, medium, tracked, uppercase — a zone or cell label. */
export const OVERLINE = "text-[11px] leading-[16px] font-medium tracking-[0.06em] uppercase";

// ── PRIMITIVES ──────────────────────────────────────────────────────────────

/** ═══ THE ONE PRIMARY, NEVER RED (pack v3.0) ═══ v2 turned it alert-red on a
 *  Tier 1–2 confirm; the requested tier stays neutral until confirmed. */
export function Primary({ children, onClick, slot }: { children: React.ReactNode; onClick: () => void; slot: string }) {
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
export function onRadioKeys(ev: React.KeyboardEvent<HTMLElement>) {
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
export const rovingTab = (on: boolean, first: boolean, anyOn: boolean) => (on || (!anyOn && first) ? 0 : -1);

export function Field({ label, value, onChange, rows = 2, slot, invalid = false, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; slot: string; invalid?: boolean; placeholder?: string }) {
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
export function YesNo({ value, onChange, label, slot }: { value: boolean | null | undefined; onChange: (v: boolean) => void; label: string; slot: string }) {
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
export function Chips<T extends string>({ options, value, onChange, label }: { options: readonly { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; label: string }) {
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
export function Choice<T extends string>({ options, value, onChange, label, slot }: { options: readonly { id: T; label: string }[]; value: T | null | undefined; onChange: (v: T) => void; label: string; slot: string }) {
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
