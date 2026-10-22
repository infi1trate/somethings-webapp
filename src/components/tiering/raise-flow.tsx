"use client";

// ═══════════════════════════════════════════════════════════════════════════
// RaiseFlow — raising an escalation (Tiering & Escalation pack, Phase 2)
//
// One flow, whatever the entry: the Care tab's Escalate, the conversation's
// "Raise an escalation", a message's "Raise an escalation about this
// message", or the user record. Hosted as a RAIL TAKEOVER in chat (the
// conversation stays visible beside it — a mentor writing "what's
// happening?" needs to read what happened) and in a dialog on the record.
//
// Three steps on one surface, in order: pick a tier, say what is going on,
// confirm. The tier picker is a radiogroup — strictly Tiers 1–3, each with a
// sentence; the teen's CURRENT tier, if it is one of them, is shown disabled
// with a "Current" tag, as information rather than a choice.
//
// ═══ A PLATFORM CONCERN HAS ITS OWN FLOW (pack v3.0, Supersession 3) ═══ It
// was the picker's fourth option. Below the tiers, a quiet text link opens a
// lighter report — what the concern is, and Send — that writes a category,
// never a tier.
//
// ═══ CONFIRM IS ALWAYS ENABLED ═══ A disabled button in a crisis says "no"
// without saying why. It is always pressable, and pressing it with a gap
// names the gap inline and moves focus to it.
//
// ═══ ON CONFIRM THE ESCALATION OPENS AT ONCE ═══ Safety first: the
// supervisor's confirmation applies to tier PLACEMENT, not to whether the
// escalation exists (see `useTiering().raise`).
//
// DEFERRED: the context note is text only. A voice note needs recording and
// storage this prototype does not have; it is in the report.

import { useId, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import { PLATFORM, RAISE_LABEL, RAISE_TIERS, isAlertTier, raiseDescription, type RaiseTarget, type Tier } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The note's ceiling. Short on purpose: the supervisor reads it first, and
 *  the conversation itself is right there. */
export const CONTEXT_NOTE_MAX = 280;

export function RaiseFlow({
  name,
  current,
  onCancel,
  onConfirm,
  heading = true,
}: {
  /** The teen's first name. */
  name: string;
  current: Tier | null;
  onCancel: () => void;
  onConfirm: (input: { target: RaiseTarget; note: string }) => void;
  /** Off when the host (a dialog) already titles it. */
  heading?: boolean;
}) {
  const [target, setTarget] = useState<Exclude<Tier, 4> | null>(null);
  /** The platform-concern report, its own lighter flow. */
  const [platform, setPlatform] = useState(false);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const groupId = useId();
  const noteId = useId();
  const pickRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const missingTier = target === null;
  const missingNote = note.trim().length === 0;

  const confirm = () => {
    setTried(true);
    if (missingTier) {
      pickRef.current?.querySelector<HTMLButtonElement>('[role="radio"]:not([aria-disabled="true"])')?.focus();
      return;
    }
    if (missingNote) {
      noteRef.current?.focus();
      return;
    }
    onConfirm({ target, note: note.trim() });
  };

  /* Roving radiogroup, the WAI pattern: arrows move AND select. */
  const choices = RAISE_TIERS.filter((t) => t !== current);
  const onKey = (e: React.KeyboardEvent, t: Exclude<Tier, 4>) => {
    const i = choices.indexOf(t);
    const to =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? choices[(i + 1) % choices.length]
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? choices[(i - 1 + choices.length) % choices.length]
      : null;
    if (!to) return;
    e.preventDefault();
    setTarget(to);
    pickRef.current?.querySelector<HTMLButtonElement>(`[data-raise-option="${to}"]`)?.focus();
  };

  if (platform) {
    return (
      <PlatformReport
        name={name}
        onBack={() => setPlatform(false)}
        onSend={(text) => onConfirm({ target: PLATFORM, note: text })}
      />
    );
  }

  return (
    <div data-raise-flow className="space-y-5">
      {heading && (
        <div>
          <h3 className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
            {/* TODO-COPY */}
            Raise an escalation
          </h3>
          <p className="mt-0.5 text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
            {/* TODO-COPY */}
            Your supervisor is told the moment you confirm.
          </p>
        </div>
      )}

      {/* ── 1 · THE TIER ──────────────────────────────────────────────── */}
      <div>
        <p id={groupId} className="mb-2 text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          How serious is it?
        </p>
        <div ref={pickRef} role="radiogroup" aria-labelledby={groupId} aria-required className="space-y-2">
          {RAISE_TIERS.map((t) => {
            const isCurrent = t === current;
            const selected = t === target;
            const focusable = selected || (target === null && t === choices[0]);
            return (
              <button
                key={String(t)}
                type="button"
                role="radio"
                data-raise-option={String(t)}
                aria-checked={selected}
                aria-disabled={isCurrent || undefined}
                tabIndex={isCurrent ? -1 : focusable ? 0 : -1}
                onClick={() => !isCurrent && setTarget(t)}
                onKeyDown={(e) => !isCurrent && onKey(e, t)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[var(--radius-inset)] border px-3 py-2.5 text-left transition-colors",
                  isCurrent
                    ? "cursor-default border-dashed border-[color:var(--border-default)] bg-transparent"
                    : selected
                      ? "border-[color:var(--text-primary)] bg-[var(--surface-s2)]"
                      : "border-[color:var(--border-subtle)] bg-[var(--surface-s1)] hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                {/* A real radio mark, so selected is a shape and not only a fill. */}
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-[color:var(--text-primary)]" : "border-[color:var(--border-default)]"
                  )}
                >
                  {selected && <span className="size-2 rounded-full bg-[var(--text-primary)]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <TierLozenge tier={t} />
                    <span className="text-[var(--text-primary)]" style={{ font: "var(--type-body)" }}>
                      {RAISE_LABEL[t].replace(/^Tier \d · /, "")}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-[var(--surface-s2)] px-2 py-0.5 text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
                        {/* TODO-COPY */}
                        Current
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[var(--text-secondary)]" style={{ font: "var(--type-field-label)" }}>
                    {raiseDescription(t, name)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {tried && missingTier && (
          <p role="alert" data-raise-error="tier" className="mt-1.5 text-[var(--state-error)]" style={{ font: "var(--type-field-label)" }}>
            {/* TODO-COPY */}
            Choose how serious it is.
          </p>
        )}
        {/* ═══ SOMETHING ELSE ═══ Quiet on purpose: it is not a tier, so it
            does not sit among them. TODO-COPY. */}
        <button
          type="button"
          data-raise-platform
          onClick={() => setPlatform(true)}
          className={cn("mt-2 inline-flex min-h-8 items-center rounded-sm text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)]", RING)}
          style={{ font: "var(--type-field-label)" }}
        >
          Something else? Report a platform concern
        </button>
      </div>

      {/* ── 2 · WHAT'S HAPPENING ─────────────────────────────────────── */}
      <div>
        <label htmlFor={noteId} className="mb-1.5 block text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          What&rsquo;s happening? Your supervisor will read this.
        </label>
        <textarea
          id={noteId}
          ref={noteRef}
          data-raise-note
          rows={3}
          maxLength={CONTEXT_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={tried && missingNote ? true : undefined}
          aria-describedby={`${noteId}-count`}
          className={cn(
            "block w-full resize-none rounded-[var(--radius-control)] border bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            tried && missingNote ? "border-[color:var(--state-error)]" : "border-[color:var(--border-subtle)]",
            RING
          )}
          style={{ font: "var(--type-body)" }}
          /* TODO-COPY */
          placeholder={`What did ${name} say or do?`}
        />
        <div className="mt-1 flex items-start justify-between gap-3">
          {tried && missingNote ? (
            <p role="alert" data-raise-error="note" className="text-[var(--state-error)]" style={{ font: "var(--type-field-label)" }}>
              {/* TODO-COPY */}
              Add a line about what&rsquo;s going on.
            </p>
          ) : (
            <span />
          )}
          <span id={`${noteId}-count`} className="shrink-0 tabular-nums text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
            {note.length}/{CONTEXT_NOTE_MAX}
          </span>
        </div>
      </div>

      {/* ── 3 · CONFIRM ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-raise-confirm
          onClick={confirm}
          className={cn(
            "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-[var(--text-inverse)] transition-opacity hover:opacity-90",
            /* Red only where the choice is Tier 1–2 — the canon's colour rule. */
            isAlertTier(target) ? "bg-[var(--alert-critical-accent)]" : "bg-[var(--text-primary)]",
            RING
          )}
          style={{ font: "var(--type-button)" }}
        >
          {/* TODO-COPY */}
          Confirm escalation
        </button>
        <button
          type="button"
          data-raise-cancel
          onClick={onCancel}
          className={cn("inline-flex min-h-10 items-center rounded-full px-3 text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]", RING)}
          style={{ font: "var(--type-body)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** ═══ THE PLATFORM-CONCERN REPORT ═══ Lighter than a raise: no tier, no
 *  alert colour, one field and Send. It still notifies the supervisor and
 *  opens as a review on the same record, so nothing about it is lost. */
function PlatformReport({ name, onBack, onSend }: { name: string; onBack: () => void; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div data-platform-report className="space-y-4">
      <button type="button" onClick={onBack} className={cn("inline-flex min-h-8 items-center gap-1 rounded-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]", RING)} style={{ font: "var(--type-field-label)" }}>
        <ArrowLeft aria-hidden className="size-3.5" />
        {/* TODO-COPY */}
        Back to raising an escalation
      </button>
      <div>
        <h3 className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
          {/* TODO-COPY */}
          Report a platform concern
        </h3>
        <p className="mt-0.5 text-[var(--text-secondary)]" style={{ font: "var(--type-body)" }}>
          {/* TODO-COPY */}
          Impersonation or account activity that doesn&rsquo;t look right. It goes to your supervisor and won&rsquo;t change {name}&rsquo;s tier.
        </p>
      </div>
      <div>
        <label htmlFor={id} className="mb-1.5 block text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          What&rsquo;s the concern?
        </label>
        <textarea
          id={id}
          ref={ref}
          data-platform-note
          rows={3}
          maxLength={CONTEXT_NOTE_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={tried && !text.trim() ? true : undefined}
          className={cn(
            "block w-full resize-none rounded-[var(--radius-control)] border bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)]",
            tried && !text.trim() ? "border-[color:var(--state-error)]" : "border-[color:var(--border-subtle)]",
            RING
          )}
          style={{ font: "var(--type-body)" }}
        />
        {tried && !text.trim() && (
          <p role="alert" className="mt-1 text-[var(--state-error)]" style={{ font: "var(--type-field-label)" }}>
            {/* TODO-COPY */}
            Add a line about what you noticed.
          </p>
        )}
      </div>
      <button
        type="button"
        data-platform-send
        onClick={() => {
          setTried(true);
          if (!text.trim()) {
            ref.current?.focus();
            return;
          }
          onSend(text.trim());
        }}
        className={cn("inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--text-primary)] px-4 text-[var(--text-inverse)] hover:opacity-90", RING)}
        style={{ font: "var(--type-button)" }}
      >
        {/* TODO-COPY */}
        Send report
      </button>
    </div>
  );
}
