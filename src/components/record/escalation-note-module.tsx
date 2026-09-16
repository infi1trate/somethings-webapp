"use client";

// ═══ THE ESCALATION NOTE MODULE — ONE IMPLEMENTATION, TWO HOSTS ═══
//
// The architectural principle this phase is built on: every task type owns a
// mitigation module, extracted once and hosted by both its record surface and
// the Tasks pane. Billing established it with `ReviewBody` (Care page + Tasks
// pane). This is the escalation's: the Monitoring record and the Tasks
// documentation pane render THIS, and Tasks does not implement mitigation.
//
// ═══ IT WAS BUILT, NOT EXTRACTED, AND THE RECON SAYS WHY ═══
//
// There is no escalation note form in this codebase. The field set exists as a
// read-only audit display on the Care record's History expansion; two of the
// option sets exist for the flag review dialog. See `lib/record/escalation-note.ts`
// for the contract and for the one place this deviates from it.
//
// ═══ NO REQUIRED FIELDS, SO NO GATE ═══
//
// Every field on the record is optional by an explicit decision — absences are
// information on an audit surface. So the action row states what is EMPTY and
// marking complete records the gaps. `noteCompleteness` carries the reasoning.
//
// ═══ THE ACTION ROW IS THE HOST'S TO PLACE ═══
//
// Rendered into `actionSlot` when the host provides one — the Tasks pane portals
// it into the sticky action bar — and inline otherwise, which is what the
// Monitoring record wants. Same arrangement `BillingReview` uses for its footer,
// for the same reason: the module owns the decision, the host owns the layout.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PillButton } from "@/components/settings/pill-button";
import { CRISIS_TYPE, REFERRAL_TYPE } from "@/lib/record/people-demo";
import {
  CRISIS_TYPE_REVEALS_ON,
  EMPTY_NOTE,
  ESCALATION_TYPE,
  noteCompleteness,
  type EscalationNoteBody,
} from "@/lib/record/escalation-note";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** ═══ NO ASTERISKS, AND NOTHING TO PUT ONE ON ═══
 *  The legacy UI marked required fields with `*`. Nothing here is required, and
 *  the design system's own convention is the word rather than the glyph — an
 *  asterisk is unreadable to a screen reader without a legend nobody writes. */
const LABEL = "text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]";

const FIELD =
  "mt-1.5 w-full rounded-[var(--radius-control)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-3 py-2 text-[13.5px] leading-[19px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]";

function Prose({
  id,
  label,
  hint,
  value,
  onChange,
  rows = 3,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={cn(LABEL, "block")}>
        {label}
      </label>
      {hint && (
        <p className="mt-0.5 text-[12px] leading-[17px] text-[var(--text-secondary)]">{hint}</p>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(FIELD, "resize-y", RING)}
      />
    </div>
  );
}

function Choice({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { id: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={cn(LABEL, "block")}>
        {label}
      </label>
      {/* ═══ A NATIVE SELECT, DELIBERATELY ═══
          The Radix select this codebase uses elsewhere is the control whose
          `undefined` value silently goes uncontrolled (recorded in
          `billing-review.tsx`) and whose focus ring is the one indicator on the
          Tasks pane that is not an outline (gap row 382). On a clinical-legal
          form, a control that can lose its own value is the wrong trade for a
          styled chevron. */}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(FIELD, RING)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface EscalationNoteHandle {
  /** Runs the host's primary. Nothing to gate — see the module note. */
  markComplete: () => void;
}

export function EscalationNoteModule({
  value,
  onChange,
  onMarkComplete,
  /** Where the action row goes. Null → inline, which is the record's layout. */
  actionSlot = null,
  /** Read-only rendering for a note already submitted. */
  readOnly = false,
  handleRef,
  idPrefix = "esc-note",
}: {
  value?: EscalationNoteBody;
  onChange?: (next: EscalationNoteBody) => void;
  onMarkComplete?: (body: EscalationNoteBody) => void;
  actionSlot?: HTMLElement | null;
  readOnly?: boolean;
  handleRef?: React.MutableRefObject<EscalationNoteHandle | null>;
  idPrefix?: string;
}) {
  /** UNCONTROLLED FALLBACK so the module can be dropped onto a surface that has
   *  no store yet — the Monitoring record's first render — without the host
   *  having to own a draft it does not persist. */
  const [own, setOwn] = useState<EscalationNoteBody>(EMPTY_NOTE);
  const body = value ?? own;
  const set = (patch: Partial<EscalationNoteBody>) => {
    const next = { ...body, ...patch };
    if (onChange) onChange(next);
    else setOwn(next);
  };

  const completeness = useMemo(() => noteCompleteness(body), [body]);
  const id = (f: string) => `${idPrefix}-${f}`;

  const markComplete = () => onMarkComplete?.(body);
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = { markComplete };
    return () => {
      handleRef.current = null;
    };
  });

  /** ═══ THE CONDITIONAL REVEALS WITHOUT A LAYOUT JUMP ═══
   *  The two conditional fields sit in a reserved row that is always in the flow
   *  — `min-h` rather than mounting and unmounting a block above the fields
   *  below them, which would move everything a supervisor was reading. */
  const showCrisis = body.type === CRISIS_TYPE_REVEALS_ON;
  const showReferralType = body.wasReferral === true;

  const actionRow = (
    /* `data-note-action-row` IS HOW THE PORTAL IS VERIFIED. Whether this row is
       inside the host's sticky bar or in its own inline fallback is invisible in
       a screenshot and load-order dependent, so the probe asks the DOM. */
    <div
      data-note-action-row
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      {/* ═══ COMPLETENESS, NOT VALIDATION ═══
          "{n} fields empty", never "{n} fields needed": nothing here is
          required, and the billing sentence would claim a gate that does not
          exist. A live region for the same reason billing's is — a supervisor
          learns where they are without reading the whole form back. */}
      <p
        role="status"
        aria-live="polite"
        data-slot="note-completeness"
        className="min-w-0 text-[12.5px] leading-[17px] text-[var(--text-secondary)]"
      >
        {/* NEEDS-COPY-NICOLE */}
        {completeness.empty.length === 0
          ? "All fields recorded"
          : `${completeness.recorded} of ${completeness.asked} fields recorded`}
      </p>
      {!readOnly && (
        <PillButton onClick={markComplete} className="h-9 px-5 text-[14px]">
          {/* NEEDS-COPY-NICOLE. NOT full-width, and not disabled — the two
              things the legacy primary was. */}
          Mark complete
        </PillButton>
      )}
    </div>
  );

  return (
    <div data-slot="escalation-note" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice
          id={id("type")}
          /* NEEDS-COPY-NICOLE on every label in this module. */
          label="Escalation type"
          value={body.type}
          onChange={(v) => set({ type: v, ...(v === CRISIS_TYPE_REVEALS_ON ? {} : { crisisType: "" }) })}
          options={ESCALATION_TYPE}
          placeholder="Not recorded"
        />
        {/* RESERVED, NOT CONDITIONALLY MOUNTED — see the note above. */}
        <div className={cn("min-w-0", !showCrisis && "invisible")} aria-hidden={!showCrisis}>
          <Choice
            id={id("crisisType")}
            label="Crisis type"
            value={body.crisisType}
            onChange={(v) => set({ crisisType: v })}
            options={CRISIS_TYPE}
            placeholder="Not recorded"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <p className={LABEL}>{/* NEEDS-COPY-NICOLE */}Was this a referral?</p>
          {/* A TRI-STATE, AND THE THIRD STATE IS THE POINT: the record models a
              referral as the PRESENCE of one, which cannot express "asked, and
              no". `aria-pressed` on two toggles rather than a checkbox, so
              "unanswered" is a real state rather than an unchecked box that
              looks answered. */}
          <div role="group" aria-label="Was this a referral?" className="mt-1.5 flex gap-1.5">
            {[
              { v: true, label: "Yes" },
              { v: false, label: "No" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={body.wasReferral === o.v}
                data-referral={o.label.toLowerCase()}
                onClick={() =>
                  set({
                    wasReferral: body.wasReferral === o.v ? null : o.v,
                    ...(o.v ? {} : { referralType: "" }),
                  })
                }
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold",
                  body.wasReferral === o.v
                    ? "bg-[var(--text-primary)] text-[var(--surface-card)]"
                    : "border border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                {/* NEEDS-COPY-NICOLE */}
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className={cn("min-w-0", !showReferralType && "invisible")} aria-hidden={!showReferralType}>
          <Choice
            id={id("referralType")}
            label="Referral type"
            value={body.referralType}
            onChange={(v) => set({ referralType: v })}
            options={REFERRAL_TYPE}
            placeholder="Not recorded"
          />
        </div>
      </div>

      <Prose
        id={id("suicideRisk")}
        label="Suicide assessment risk"
        /* THE FIELD IS PROSE, NOT A LEVEL, and the hint says why: what gets
           recorded is an assessment — what was asked, what was answered, what
           was concluded. The record deliberately widened this from a
           three-value union; see `people-demo.ts`. */
        hint="What was asked, what was answered, what you concluded."
        value={body.suicideRisk}
        onChange={(v) => set({ suicideRisk: v })}
      />
      <Prose
        id={id("reasonDetail")}
        label="Reason for escalation"
        value={body.reasonDetail}
        onChange={(v) => set({ reasonDetail: v })}
      />
      <Prose
        id={id("mentorInformation")}
        label="Information provided by mentor"
        value={body.mentorInformation}
        onChange={(v) => set({ mentorInformation: v })}
      />
      <Prose
        id={id("contactConversations")}
        label="Conversations with emergency contact or first responders"
        value={body.contactConversations}
        onChange={(v) => set({ contactConversations: v })}
      />
      <div className="min-w-0">
        <label htmlFor={id("emergencyContact")} className={cn(LABEL, "block")}>
          {/* NEEDS-COPY-NICOLE */}
          Emergency contact
        </label>
        <input
          id={id("emergencyContact")}
          value={body.emergencyContact}
          onChange={(e) => set({ emergencyContact: e.target.value })}
          className={cn(FIELD, RING)}
        />
      </div>
      <Prose
        id={id("nextSteps")}
        label="Next steps"
        value={body.nextSteps}
        onChange={(v) => set({ nextSteps: v })}
      />
      <Prose
        id={id("safetyPlan")}
        label="Safety plan"
        value={body.safetyPlan}
        onChange={(v) => set({ safetyPlan: v })}
      />

      {actionSlot ? createPortal(actionRow, actionSlot) : actionRow}
    </div>
  );
}
