"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TierSelect — every tier decision, one component (micro-pack v10.0;
// amendment v10.1; pack v11.0 §5)
//
// ═══ SUPERSEDES (pack v10.0, Supersession 1) ═══ Three per-role controls:
// the raise flow's radio list (mentor), the confirm-tier step's 2×2 grid
// (`exchange.tsx` ConfirmCard) and the Update tier dialog's grid of long
// lozenges (`TierUpdateModule`). The same decision is the same control now;
// the MODE changes the register, not the skeleton:
//
//   raise    Tiers 1–3, plain-language lines (`RAISE_DESCRIPTION` — mentors
//            never read the clinical criteria, answered 2026-10-28), empty
//            on load, every card choosable and untagged, a required note,
//            and a footer sticky to the panel's bottom: Confirm escalation +
//            Cancel. (v11.0 removed the "Current" tag and the platform-
//            concern link from raise; that routing is an open product
//            question, and `PlatformReport` is deleted, not orphaned.)
//   review   Tiers 1–4, the clinical criteria (`TIER_CRITERIA`), the request
//            arriving checked and tagged, a reason seeded from the mentor's
//            note, and a CTA that spells out the consequence ("Confirm
//            Tier 2 · High risk") — relabelled live, announced.
//
// ═══ ROW ANATOMY (amendment v10.1 — the lozenge is the selector) ═══ A card:
// lozenge · name · description, and no leading control glyph. Radiogroup
// SEMANTICS stay whole: a native radio per card, visually hidden, the card
// its label — so arrows move the selection, Tab is one stop, and a disabled
// tier is skipped, all by the platform. (v10.0's row led with a radio mark;
// it is gone.)
//
//   unselected  the tier's identity wash · outline lozenge · a hairline IN
//               THE TIER'S OWN HUE (`--tier-legend-{n}-border`, FCP-3)
//   hover       the hairline steps halfway to the tier's edge colour
//   focus       the Bloom focus ring on the card
//   selected    a 2px edge in the tier's strong step (`-edge`: blush/700,
//               apricot/600, sunshine/700, ecru/600) on the soft elevation ·
//               the DEEPENED wash · outline → FILLED
//               lozenge. No check glyph and no radio glyph (pack v11.0
//               §5.3): ring presence and the lozenge's outline-to-fill are
//               shape and weight changes, readable without colour, and the
//               radiogroup carries the state programmatically
//   requested   selected + "Requested by {mentor} · {time}" (review)
//   current     a quiet "Current" tag (review and update only)
//
// ═══ SUPERSEDES (FCP-3 6081:23553, 2026-10-28) ═══ v10.1's 2px INK ring and
// "a ring, not a shadow". The design carries the tier's colour into the edge
// and lifts the chosen card. It is not raised AND ringed in v4.0's sense —
// the soft elevation has no spread ring, and the current timeline node keeps
// that single emphasis. The padding gives back the extra pixel, so selecting
// a card moves nothing. Selection is never colour alone: the 2px weight, the
// lift and the lozenge's outline-to-fill all carry it.
//
// ═══ THE SCOPED WASH EXCEPTION (v10.1 — overrides v10 Supersession 2 HERE
// ONLY) ═══ Tier-identity washes are sanctioned inside TierSelect alone,
// because the picker is a LEGEND: every tier shows its identity at the moment
// it is chosen. It reopens washes nowhere else — status cards, list rows,
// History and every ambient surface keep the no-wash rule and alert colour on
// Tiers 1–2 only. The washes read `--tier-legend-{n}-*`, tokens scoped by
// name to this component; `tier-select.mjs` greps that no other surface
// reads them. The platform-concern escape is not a tier, so it has no wash.
//
// ═══ THE CTA IS NEVER RED ═══ v1 turned Confirm escalation alert-red on a
// Tier 1–2 pick; the v10 blocked constant puts alert colour on the Tier 1–2
// lozenges only. The two red "Raise an escalation" menu entries are the
// named exception, and they live outside this component.
//
// ═══ CONFIRM IS ALWAYS ENABLED ═══ (v1's rule, kept): a disabled button in a
// crisis says "no" without saying why. Pressing it with a gap names the gap
// inline and moves focus to it.

import { useId, useRef, useState } from "react";
import { TierLozenge } from "@/components/ui/tier-lozenge";
import type { Placement } from "@/lib/tiering/events";
import { tierCta as ctaFor, type TierCtaContext } from "@/lib/tiering/tier-cta";
import { RAISE_TIERS, TIER_CRITERIA, TIER_NAME, TIERS, raiseDescription, type Tier } from "@/lib/tiering/tiers";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const BODY = { font: "var(--type-body)" } as const;
const LABEL = { font: "var(--type-field-label)" } as const;

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** The raise note's ceiling. Short on purpose: the supervisor reads it
 *  first, and the conversation itself is right there. */
export const CONTEXT_NOTE_MAX = 280;

/** The mentor, as the request tag and the reason seed say them. A store with
 *  no signed-in name hands back the role ("The mentor"), and a first-name
 *  split of that read "Requested by The" (measured) — so the role stays
 *  whole, lower-cased mid-sentence. TODO-COPY. */
export function mentorFirstName(named: string | null | undefined): { first: string; full: string; possessive: string; known: boolean } {
  const n = (named ?? "").trim();
  if (!n || /^the /i.test(n) || n === "You") return { first: "the mentor", full: "The mentor", possessive: "the mentor’s", known: false };
  const first = n.split(/\s+/)[0];
  return { first, full: n, possessive: `${first}’s`, known: true };
}

type RaiseTier = Exclude<Tier, 4>;

interface Common {
  /** The teen's first name. */
  name: string;
  /** The teen's tier now — the row that carries the quiet "Current" tag. */
  current: Tier | null;
}

export interface RaiseProps extends Common {
  mode: "raise";
  onConfirm: (input: { tier: RaiseTier; note: string }) => void;
  onCancel: () => void;
}

export interface ReviewProps extends Common {
  mode: "review";
  /** `confirm`: the supervisor's confirm-tier step on an escalation.
   *  `update`: the steady-state Update tier flow. */
  kind: "confirm" | "update";
  /** The tier a mentor asked for: it arrives checked and tagged. */
  request: { tier: Tier; by: string; at: number } | null;
  /** The header row — confirm-tier only. */
  submittedBy?: { name: string; at: number; known: boolean } | null;
  /** The movement rules (`placementsFrom`); rows they refuse stay visible,
   *  disabled, with the reason. Omitted: all four are allowed. */
  placements?: Placement[];
  /** The reason's starting text — neutral, so it stays true on an override. */
  seed: string;
  /** A step down records the tier's exit document; the label says which. */
  reasonLabel?: (tier: Tier | null) => string;
  /** One quiet line under the group about what the checked tier will do. */
  consequence?: (tier: Tier | null) => string | null;
  onSubmit: (input: { tier: Tier; reason: string }) => void;
  /** A secondary (ghost) action that also needs the reason — "Keep in Tier N". */
  secondary?: { label: string; slot: string; run: (reason: string) => void };
}

export type TierSelectProps = RaiseProps | ReviewProps;

export function TierSelect(props: TierSelectProps) {
  const { mode, name, current } = props;
  const review = mode === "review" ? props : null;
  const ctx: TierCtaContext = review
    ? { mode: "review", kind: review.kind, current, requested: review.request?.tier ?? null }
    : { mode: "raise" };
  const tierCta = (t: Tier | null) => ctaFor(ctx, t);

  const tiers: readonly Tier[] = mode === "raise" ? RAISE_TIERS : TIERS;
  /** Per row: can it be checked, and if not, why. In raise mode every card
   *  is a choice — raising at the teen's current tier is a real event (a
   *  Tier 2 teen with a new crisis; answered 2026-10-28). In review the
   *  movement rules decide, and the current tier stays checkable — it is
   *  where update mode starts. */
  const rule = (t: Tier): { ok: boolean; why?: string } => {
    if (mode === "raise") return { ok: true };
    if (t === current) return { ok: true };
    const p = review?.placements?.find((x) => x.tier === t);
    return p && !p.allowed ? { ok: false, why: p.why } : { ok: true };
  };

  const initial: Tier | null =
    review === null
      ? null
      : review.request && rule(review.request.tier).ok
        ? review.request.tier
        : review.kind === "update"
          ? current
          : null;
  const [tier, setTier] = useState<Tier | null>(initial);
  const [text, setText] = useState(review?.seed ?? "");
  const [tried, setTried] = useState(false);
  /** ═══ NEVER ON A PRISTINE FIELD (pack v11.0 §5.4) ═══ Validation renders
   *  on a submit attempt, or on blur AFTER input — typing then clearing the
   *  note and leaving it says so; tabbing past an untouched one does not. */
  const [dirty, setDirty] = useState(false);
  const [blurred, setBlurred] = useState(false);
  /** The live region's line — written by the handler that relabels the CTA,
   *  never on mount, so the page does not announce its own first paint. */
  const [live, setLive] = useState("");
  const [gap, setGap] = useState<string | null>(null);

  const uid = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const enabled = tiers.filter((t) => rule(t).ok);
  const choose = (t: Tier) => {
    if (!rule(t).ok) return;
    setTier(t);
    setGap(null);
    if (review && tierCta(t) !== tierCta(tier)) setLive(`Button now reads ${tierCta(t)}`);
  };

  /* The tab stop is explicit, so it is measurable: the checked card, else
     the first enabled one. The arrows are the platform's — native radios
     sharing a name move AND select, and skip a disabled tier. */
  const tabStop = tier !== null && rule(tier).ok ? tier : enabled[0];
  const focusGroup = () => groupRef.current?.querySelector<HTMLElement>(`[data-tier-input="${tabStop}"]`)?.focus();

  const missingText = text.trim().length === 0;
  const submit = () => {
    setTried(true);
    if (tier === null) {
      setGap(mode === "raise" ? "Choose how serious it is." : "Choose a tier.");
      focusGroup();
      return;
    }
    if (review?.kind === "update" && tier === current && review.request?.tier !== tier) {
      setGap(`Tier ${tier} is current — choose another tier.`);
      focusGroup();
      return;
    }
    if (missingText) {
      fieldRef.current?.focus();
      return;
    }
    if (props.mode === "raise") props.onConfirm({ tier: tier as RaiseTier, note: text.trim() });
    else props.onSubmit({ tier, reason: text.trim() });
  };

  const cta = tierCta(tier);
  const groupLabel =
    mode === "raise"
      ? "How serious is it?"
      : review!.kind === "confirm"
        ? `Tier for ${name}`
        : current
          ? `${name} is in Tier ${current} · ${TIER_NAME[current]}. Move to`
          : `Place ${name} in`;
  /* TODO-COPY. FCP-3: confirm asks for "Add details". */
  const fieldLabel = mode === "raise" ? "What’s happening?" : (review!.reasonLabel?.(tier) ?? (review!.kind === "confirm" ? "Add details" : "Reason — posted to the record"));
  const showFieldError = missingText && (tried || (dirty && blurred));
  const consequence = review?.consequence?.(tier) ?? null;

  return (
    <div data-tier-select={mode} data-tier-kind={review?.kind} className="space-y-4">
      {/* ── THE HEADER LINE (confirm-tier only, FCP-3 6081:23553) ─────────
          WAS v10's "Submitted by {mentor} · Mentor · {time}" row. The design
          says what the step IS; who asked stays on the requested card's own
          tag ("Requested by {mentor} · {time}"), so attribution is kept. */}
      {review?.kind === "confirm" && (
        <p data-tier-submitted className="-mt-2 text-[var(--text-secondary)]" style={LABEL}>
          {/* TODO-COPY */}A tier has already been submitted. Review the choice, then confirm or change it.
        </p>
      )}

      {/* ── THE RADIOGROUP ───────────────────────────────────────────── */}
      <div>
        {/* The group's accessible name. Visible in raise and update; in
            confirm the header line says it, so it is for assistive tech only. */}
        <p id={`${uid}-group`} className={cn("mb-2 text-[var(--text-muted)]", review?.kind === "confirm" && "sr-only")} style={LABEL}>
          {/* TODO-COPY */}
          {groupLabel}
        </p>
        <div
          ref={groupRef}
          role="radiogroup"
          aria-labelledby={`${uid}-group`}
          aria-required
          aria-describedby={gap ? `${uid}-gap` : undefined}
          className="space-y-2"
        >
          {tiers.map((t) => {
            const r = rule(t);
            const checked = t === tier;
            const requested = review?.request?.tier === t;
            const isCurrent = t === current;
            const tag = requested
              ? `Requested by ${review!.request!.by} · ${TIME.format(review!.request!.at)}`
              : isCurrent && mode === "review"
                ? "Current"
                : null;
            const description = mode === "raise" ? raiseDescription(t as RaiseTier, name) : TIER_CRITERIA[t];
            return (
              <label
                key={t}
                data-tier-row={t}
                data-tier-checked={checked}
                data-tier-disabled={!r.ok || undefined}
                data-tier-requested={requested || undefined}
                className={cn(
                  "group/tier relative flex w-full items-start gap-3 rounded-[var(--radius-inset)] text-left transition-colors duration-150 motion-reduce:transition-none",
                  checked
                    ? "border-2 border-[color:var(--edge)] bg-[var(--wash-deep)] px-[11px] py-[9px] shadow-[var(--el-soft)]"
                    : "border border-[color:var(--edge-soft)] bg-[var(--wash)] px-3 py-2.5",
                  !r.ok ? "cursor-not-allowed border-dashed" : cn("cursor-pointer", !checked && "hover:border-[color:color-mix(in_srgb,var(--edge)_55%,var(--wash))]"),
                  /* Focus lands on the hidden input; the ring is drawn on its card. */
                  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[color:var(--focus-ring)]",
                  /* ═══ THE REQUEST ARRIVES HELD (Magic 1) ═══ The ring draws
                     in on the requested card in one beat with its tag. */
                  requested && checked && "motion-safe:animate-[tier-hold_280ms_cubic-bezier(0.2,0.8,0.2,1)]"
                )}
                style={{ "--wash": `var(--tier-legend-${t}-wash)`, "--wash-deep": `var(--tier-legend-${t}-wash-deep)`, "--edge": `var(--tier-legend-${t}-edge)`, "--edge-soft": `var(--tier-legend-${t}-border)` } as React.CSSProperties}
              >
                <input
                  type="radio"
                  name={`${uid}-tier`}
                  value={t}
                  data-tier-input={t}
                  className="sr-only"
                  checked={checked}
                  disabled={!r.ok}
                  tabIndex={t === tabStop ? 0 : -1}
                  onChange={() => choose(t)}
                  /* ═══ NAME, THEN STATE, THEN DESCRIPTION ═══ "Tier 1, Active
                     crisis" — "radio button, checked" from the platform — then
                     the request (or Current), the description and any reason
                     it is unavailable. */
                  aria-label={`Tier ${t}, ${TIER_NAME[t]}`}
                  aria-describedby={[tag ? `${uid}-t${t}` : null, `${uid}-d${t}`, r.why ? `${uid}-w${t}` : null].filter(Boolean).join(" ")}
                />
                <span className={cn("min-w-0 flex-1", !r.ok && "opacity-70")}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {/* The tier itself becomes the choice: outline → filled. */}
                    <TierLozenge tier={t} legend={checked ? "filled" : "outline"} />
                    <span className="text-[var(--text-primary)]" style={BODY}>
                      {TIER_NAME[t]}
                    </span>
                    {tag && (
                      <span
                        data-tier-row-tag={requested ? "requested" : "current"}
                        aria-hidden
                        className={cn(
                          "rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[var(--text-secondary)]",
                          requested && "tier-settle"
                        )}
                        style={LABEL}
                      >
                        {/* TODO-COPY */}
                        {tag}
                      </span>
                    )}
                    {/* The spoken tag: "at", where the eye reads "·". */}
                    {tag && (
                      <span id={`${uid}-t${t}`} className="sr-only">
                        {requested ? `Requested by ${review!.request!.by} at ${TIME.format(review!.request!.at)}.` : "Current tier."}
                      </span>
                    )}
                  </span>
                  <span id={`${uid}-d${t}`} data-tier-row-description className="mt-0.5 block text-[var(--text-secondary)]" style={LABEL}>
                    {description}
                  </span>
                  {r.why && (
                    <span id={`${uid}-w${t}`} data-tier-why className="mt-0.5 block text-[var(--text-secondary)]" style={LABEL}>
                      {r.why}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        {tried && gap && (
          <p id={`${uid}-gap`} role="alert" data-tier-error="tier" className="mt-1.5 text-[var(--state-error)]" style={LABEL}>
            {/* TODO-COPY */}
            {gap}
          </p>
        )}
        {consequence && (
          <p data-tier-consequence className="mt-2 text-[var(--text-secondary)]" style={LABEL}>
            {consequence}
          </p>
        )}
      </div>

      {/* ── THE NOTE / THE REASON ────────────────────────────────────── */}
      <div>
        <label htmlFor={`${uid}-field`} className="mb-1.5 block text-[var(--text-muted)]" style={LABEL}>
          {/* TODO-COPY */}
          {fieldLabel}
          {/* The required marker: an asterisk the eye reads, "required" the
              ear does (the textarea is `aria-required` too). */}
          <span aria-hidden className="ml-0.5 text-[var(--state-error)]">
            *
          </span>
        </label>
        <textarea
          id={`${uid}-field`}
          ref={fieldRef}
          data-tier-field={mode === "raise" ? "note" : "reason"}
          rows={3}
          maxLength={mode === "raise" ? CONTEXT_NOTE_MAX : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          onBlur={() => setBlurred(true)}
          aria-required
          aria-invalid={showFieldError ? true : undefined}
          aria-describedby={mode === "raise" ? `${uid}-count` : undefined}
          className={cn(
            "block w-full resize-none rounded-[var(--radius-control)] border bg-[var(--surface-card)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            showFieldError ? "border-[color:var(--state-error)]" : "border-[color:var(--border-subtle)]",
            RING
          )}
          style={BODY}
          /* TODO-COPY */
          placeholder={mode === "raise" ? `What did ${name} say or do?` : "What you saw and decided"}
        />
        <div className="mt-1 flex items-start justify-between gap-3">
          {showFieldError ? (
            <p role="alert" data-tier-error="field" className="text-[var(--state-error)]" style={LABEL}>
              {/* TODO-COPY */}
              {mode === "raise" ? "Add a line about what’s going on." : "A reason is required — it is the record."}
            </p>
          ) : (
            <span />
          )}
          {mode === "raise" && (
            <span id={`${uid}-count`} className="shrink-0 tabular-nums text-[var(--text-muted)]" style={LABEL}>
              {text.length}/{CONTEXT_NOTE_MAX}
            </span>
          )}
        </div>
      </div>

      {/* ── THE CTA — one filled button ──────────────────────────────── */}
      {/* Raise: the footer is sticky to the panel's bottom (pack v11.0
          §5.4) on the panel's own surface with a hairline, so the decision
          stays in reach however long the cards run. */}
      <div
        data-tier-footer
        className={cn(
          "flex flex-wrap items-center gap-2",
          /* `-bottom-4` and the extra 16 of bottom padding: the panel's
             scroller pads 16, and a footer stuck at its padding edge let
             the cards show through the strip beneath it (measured) — the
             tab bar's `-top-4`, mirrored. */
          mode === "raise" && "sticky -bottom-4 z-[2] -mx-4 border-t border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-4 pt-3 pb-7"
        )}
      >
        <button
          type="button"
          data-tier-cta={review?.kind ?? "raise"}
          onClick={submit}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--text-primary)] px-5 text-[var(--text-inverse)] transition-opacity hover:opacity-90",
            review?.kind === "confirm" && "w-full",
            RING
          )}
          style={{ font: "var(--type-button)" }}
        >
          {/* ═══ THE CTA KEEPS UP ═══ It relabels with the selection and the
              live region says so. v10.1 moved the motion to the card — the
              lozenge fills and the check lands — so the words simply change. */}
          {cta}
        </button>
        {props.mode === "raise" ? (
          <button
            type="button"
            data-tier-cancel
            onClick={props.onCancel}
            /* FCP-3: an outlined pill at the CTA's size — the secondary of
               the pair, never a second filled button. */
            className={cn("inline-flex min-h-11 items-center rounded-full border border-[color:var(--border-contour)] px-6 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
            style={{ font: "var(--type-button)" }}
          >
            Cancel
          </button>
        ) : (
          review?.secondary && (
            <button
              type="button"
              data-tier-secondary={review.secondary.slot}
              onClick={() => {
                setTried(true);
                if (missingText) {
                  fieldRef.current?.focus();
                  return;
                }
                review.secondary!.run(text.trim());
              }}
              className={cn("inline-flex min-h-11 items-center rounded-full border border-[color:var(--border-contour)] px-4 text-[var(--text-primary)] hover:bg-[var(--tint-hover)]", RING)}
              style={BODY}
            >
              {review.secondary.label}
            </button>
          )
        )}
      </div>
      {/* The relabel, said once per change. */}
      <p data-tier-live aria-live="polite" className="sr-only">
        {live}
      </p>
    </div>
  );
}
