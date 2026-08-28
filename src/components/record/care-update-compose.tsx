"use client";

// CARE UPDATE FORM — supervisor tier only.
//
// ═══ ONE ARTIFACT FOR EVERY PRESENTATION EVENT ═══
//
// This form is the SINGLE documentation artifact on the care page. It replaced
// three Figma prose prompts (design-system-gaps.md row 298) and also replaced the
// presentation review's separate provider note — there is no second note object.
// A cadence review, an ad-hoc presentation
// change and a standalone update all commit through this same surface, which is
// why the header and the commit button are the only things that vary.
//
// ═══ THREE REQUIRED FIELDS, AND A SAVE BUTTON THAT IS NEVER DISABLED ═══
//
// The previous version disabled Save until one section had text. That is reversed
// here, and `decision-footer.tsx` already carried the argument for the reversal:
// a disabled primary gives no feedback when pressed, its helper text sits far
// from the field that needs filling, and disabled controls are unreliably
// reachable for assistive technology — so the person most likely to need the
// explanation is the least likely to receive it.
//
// Now pressing Save with anything empty marks every empty field, moves focus to
// the first of them, and announces the count from a polite live region. Error
// recovery over error prevention, matching the grammar a supervisor already
// learned on the flag review.
//
// ═══ THE PRE-FILL IS THE HIGHEST-CONSEQUENCE THING HERE ═══
//
// When the diagnostic statement arrives pre-filled — today only from a cadence
// review's rationale, because an ad-hoc change has no rationale object to draw
// from — the form records WHETHER THE SUPERVISOR CHANGED IT. That fact cannot be
// recovered after saving, and an AI-drafted diagnostic justification carrying a
// clinician's signature is the artifact on this page where the difference matters
// most. So the original is held and compared at save time, not inferred later.
//
// Radix Dialog carries the focus trap and Escape.

import { useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PillButton } from "@/components/settings/pill-button";
import { InfoCallout } from "@/components/record/info-callout";
import { clinicalDate } from "@/components/record/care-presentation";
import {
  CARE_UPDATE_ASSESSMENT_LABEL,
  CARE_UPDATE_ASSESSMENTS,
  CARE_UPDATE_SECTIONS,
  emptyCareUpdateBody,
  type CareUpdateAssessment,
  type CareUpdateBody,
  type CareUpdatePrefill,
  type CareUpdateRecord,
} from "@/lib/record/care-demo";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** What the commit is documenting, when it is not a standalone update. Built by
 *  the OWNER, because only the owner knows the presentation being changed — this
 *  form never reaches into presentation state. */
export interface DocumentingContext {
  /** TODO-COPY at the call site — e.g. "presentation change to F33.0". */
  what: string;
  /** True when committing APPLIES a presentation change, which the commit label
   *  then has to say out loud. */
  applies: boolean;
}

/** A pre-filled diagnostic statement and where it came from. `source` mirrors
 *  `PresentationReview.rationale.source`, so the label a reader sees here is
 *  derived from the same value that labelled the rationale. */
export interface DiagnosticPrefill {
  source: CareUpdatePrefill["source"];
  text: string;
}

/** TODO-COPY — provenance, stated on the field rather than inferred from tone. */
const PREFILL_LABEL: Record<CareUpdatePrefill["source"], string> = {
  ai: "AI-generated draft",
  templated: "Pre-filled from survey evidence",
  supervisor: "Pre-filled from the recorded rationale",
};

type FieldId = "clinical" | "diagnostic" | "assessment";

export function CareUpdateCompose({
  open,
  onOpenChange,
  amending,
  documenting,
  prefill,
  onSave,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set when amending — the update being corrected. */
  amending?: CareUpdateRecord | null;
  /** Set when this commit also documents a presentation event. */
  documenting?: DocumentingContext | null;
  /** Set when the diagnostic statement arrives pre-filled. */
  prefill?: DiagnosticPrefill | null;
  /** `at` is the moment of commit, stamped by the CALLER at click time — a
   *  timestamp computed in render scope is impure, and a re-render would move
   *  the moment a decision claims to have happened. Same rule the presentation
   *  review already followed. */
  onSave: (
    body: CareUpdateBody,
    meta: {
      at: number;
      amends?: string;
      diagnosticPrefill?: CareUpdatePrefill;
    }
  ) => void;
  /** The control that opened this, captured by the owner at click time. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  // The ref lives OUT here so it survives the form's remounts.
  const firstRef = useRef<HTMLTextAreaElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent is rendered UNCONDITIONALLY so Radix's Presence owns the
          mount lifecycle — and therefore returns focus to the trigger on close.
          The stateful form sits INSIDE, so each open still initialises from the
          right place: an amendment pre-filled with the original, a documented
          commit pre-filled from its rationale, a standalone update empty, with no
          reset-in-an-effect and no stale text leaking from a cancelled compose. */}
      <DialogContent
        className="sm:max-w-lg"
        // FOCUS RESTORE, EXPLICIT AND CAPTURED AT CLICK TIME. Radix's default
        // close-autofocus did not return focus to the trigger in this app
        // (measured: focus landed on <body> with the trigger still mounted), and
        // capturing activeElement in onOpenAutoFocus is too late — focus has
        // already moved by then. The owner captures the trigger in its click
        // handler and hands it down. Without this, a keyboard user is dropped at
        // the top of a long clinical page every time they escape this dialog.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusTo?.current?.focus();
        }}
      >
        <ComposeForm
          amending={amending}
          documenting={documenting}
          prefill={prefill}
          onSave={onSave}
          onOpenChange={onOpenChange}
          firstRef={firstRef}
        />
      </DialogContent>
    </Dialog>
  );
}

function ComposeForm({
  amending,
  documenting,
  prefill,
  onSave,
  onOpenChange,
  firstRef,
}: {
  amending?: CareUpdateRecord | null;
  documenting?: DocumentingContext | null;
  prefill?: DiagnosticPrefill | null;
  /** `at` is the moment of commit, stamped by the CALLER at click time — a
   *  timestamp computed in render scope is impure, and a re-render would move
   *  the moment a decision claims to have happened. Same rule the presentation
   *  review already followed. */
  onSave: (
    body: CareUpdateBody,
    meta: {
      at: number;
      amends?: string;
      diagnosticPrefill?: CareUpdatePrefill;
    }
  ) => void;
  onOpenChange: (open: boolean) => void;
  firstRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  // AN AMENDMENT IS A CORRECTION, NOT A RETYPE: it starts from what was written.
  // A pre-fill only applies to a NEW update — amending an existing one must never
  // overwrite the supervisor's own words with a fresh draft.
  const initial = useMemo<CareUpdateBody>(() => {
    if (amending) return { ...amending.body };
    const base = emptyCareUpdateBody();
    return prefill ? { ...base, diagnostic: prefill.text } : base;
  }, [amending, prefill]);

  const [body, setBody] = useState<CareUpdateBody>(initial);
  const [errors, setErrors] = useState<Record<FieldId, boolean>>({
    clinical: false,
    diagnostic: false,
    assessment: false,
  });
  /** Announced from a polite live region — empty until a save is attempted, so
   *  nothing is read out on open. */
  const [announce, setAnnounce] = useState("");

  const clinicalRef = useRef<HTMLTextAreaElement | null>(null);
  const diagnosticRef = useRef<HTMLTextAreaElement | null>(null);
  const assessmentRef = useRef<HTMLButtonElement | null>(null);

  const missing = (b: CareUpdateBody): FieldId[] => {
    const out: FieldId[] = [];
    if (!b.clinical.trim()) out.push("clinical");
    if (!b.diagnostic.trim()) out.push("diagnostic");
    if (!b.assessment) out.push("assessment");
    return out;
  };

  const attemptSave = (at: number) => {
    const gaps = missing(body);
    if (gaps.length) {
      setErrors({
        clinical: gaps.includes("clinical"),
        diagnostic: gaps.includes("diagnostic"),
        assessment: gaps.includes("assessment"),
      });
      // TODO-COPY — states the count and where focus went, because a reader who
      // cannot see the red fields needs both.
      setAnnounce(
        gaps.length === 1
          ? "One field still needs an answer. Focus moved to it."
          : `${gaps.length} fields still need an answer. Focus moved to the first.`
      );
      const first = gaps[0];
      (first === "clinical"
        ? clinicalRef.current
        : first === "diagnostic"
          ? diagnosticRef.current
          : assessmentRef.current
      )?.focus();
      return;
    }
    setAnnounce("");
    onSave(body, {
      at,
      amends: amending?.id,
      // WHETHER THE DRAFT WAS ACTUALLY REVISED — compared here, at the moment it
      // is still knowable, and stored rather than recomputed later.
      diagnosticPrefill: prefill
        ? {
            source: prefill.source,
            edited: body.diagnostic.trim() !== prefill.text.trim(),
          }
        : undefined,
    });
    onOpenChange(false);
  };

  const clearError = (id: FieldId) =>
    setErrors((e) => (e[id] ? { ...e, [id]: false } : e));

  const title = amending
    ? "Amend the care update" // TODO-COPY — never "Edit update": the original survives.
    : documenting
      ? `Documenting: ${documenting.what}` // TODO-COPY
      : "Write a care update"; // TODO-COPY

  const description = amending
    ? // TODO-COPY
      `This appends a new update that references the ${clinicalDate(amending.createdAt)} one. The original stays on the record.`
    : documenting?.applies
      ? // TODO-COPY — says the consequence before the reach, not after.
        "Saving applies the presentation change and appends this update. Neither can be edited afterwards."
      : // TODO-COPY
        "This appends to the record and cannot be edited afterwards.";

  const commitLabel = amending
    ? "Append amendment" // TODO-COPY
    : documenting?.applies
      ? "Apply change and save update" // TODO-COPY — names the change explicitly.
      : "Save update"; // TODO-COPY

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="max-h-[52vh] space-y-5 overflow-y-auto">
        {/* 1 · CLINICAL SUMMARY */}
        <Field
          id="cu-clinical"
          label={CARE_UPDATE_SECTIONS[0].label}
          helper={CARE_UPDATE_SECTIONS[0].helper}
          error={errors.clinical}
        >
          <textarea
            id="cu-clinical"
            ref={(el) => {
              clinicalRef.current = el;
              firstRef.current = el;
            }}
            value={body.clinical}
            onChange={(e) => {
              setBody((b) => ({ ...b, clinical: e.target.value }));
              clearError("clinical");
            }}
            rows={3}
            aria-invalid={errors.clinical || undefined}
            aria-describedby="cu-clinical-help cu-clinical-err"
            className={textareaClass(errors.clinical)}
          />
        </Field>

        {/* 2 · DIAGNOSTIC SUPPORT STATEMENT.
            The callout sits ABOVE the field, per spec — it asks the supervisor to
            read before signing, so it has to arrive before the text does. */}
        <div>
          <InfoCallout className="mb-2.5">
            {/* TODO-COPY */}
            Review this section carefully to ensure it accurately reflects your
            client&apos;s symptoms and your clinical judgement.
          </InfoCallout>
          <Field
            id="cu-diagnostic"
            label={CARE_UPDATE_SECTIONS[1].label}
            helper={CARE_UPDATE_SECTIONS[1].helper}
            error={errors.diagnostic}
            // PROVENANCE ON THE FIELD, not in a tooltip: a supervisor is about to
            // sign this sentence, and whether a model wrote the first draft is
            // part of what they are agreeing to.
            badge={prefill ? PREFILL_LABEL[prefill.source] : undefined}
          >
            <textarea
              id="cu-diagnostic"
              ref={diagnosticRef}
              value={body.diagnostic}
              onChange={(e) => {
                setBody((b) => ({ ...b, diagnostic: e.target.value }));
                clearError("diagnostic");
              }}
              rows={4}
              aria-invalid={errors.diagnostic || undefined}
              aria-describedby="cu-diagnostic-help cu-diagnostic-err"
              className={textareaClass(errors.diagnostic)}
            />
          </Field>
        </div>

        {/* 3 · ASSESSMENT OF SYMPTOMS — a three-state single-select.
            A RADIOGROUP, not the segmented control. The segmented control offers
            `semantics="tabs"` and `semantics="group"` (role=group + aria-pressed,
            a mode toggle); neither announces a required single-select in a form.
            `ui/radio-group.tsx` had no consumers before this, so adopting it
            shifts no other screen — which the segmented control could not
            promise. */}
        <fieldset>
          <legend
            className={cn(
              "block",
              errors.assessment
                ? "text-[var(--state-error)]"
                : "text-[var(--text-muted)]"
            )}
            style={LABEL_STYLE}
          >
            {CARE_UPDATE_ASSESSMENT_LABEL}
          </legend>
          <RadioGroup
            value={body.assessment ?? ""}
            onValueChange={(v) => {
              setBody((b) => ({
                ...b,
                assessment: v as CareUpdateAssessment,
              }));
              clearError("assessment");
            }}
            aria-invalid={errors.assessment || undefined}
            aria-describedby="cu-assessment-err"
            className="mt-2 flex flex-wrap gap-x-6 gap-y-2.5"
          >
            {CARE_UPDATE_ASSESSMENTS.map((a, i) => (
              // The whole label is the target — a 16px dot alone is under the
              // 24px floor, and wrapping it means the word counts too.
              <label
                key={a.value}
                className="flex cursor-pointer items-center gap-2 py-1 text-[14px] leading-[20px] text-[var(--text-primary)]"
              >
                <RadioGroupItem
                  ref={i === 0 ? assessmentRef : undefined}
                  value={a.value}
                  className={RING}
                />
                {a.label}
              </label>
            ))}
          </RadioGroup>
          <FieldError id="cu-assessment-err" show={errors.assessment} />
        </fieldset>
      </div>

      <DialogFooter>
        {/* THE LIVE REGION IS ALWAYS MOUNTED and starts empty. A region added to
            the DOM at the moment it gains text is unreliably announced. */}
        <p
          aria-live="polite"
          className="sr-only"
        >
          {announce}
        </p>
        <p className="mr-auto text-[13px] leading-[18px] text-[var(--text-muted)]">
          {/* TODO-COPY — permanence stated while there is still time to act on it. */}
          All three fields are required. This cannot be edited once saved;
          corrections append.
        </p>
        <PillButton onClick={() => attemptSave(Date.now())}>
          {commitLabel}
        </PillButton>
      </DialogFooter>
    </>
  );
}

function textareaClass(error: boolean) {
  return cn(
    "mt-1.5 block w-full resize-y rounded-[var(--radius-surface)] border bg-[var(--surface-card)] px-3 py-2.5",
    "text-[14px] leading-[20px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
    error
      ? "border-[color:var(--state-error)]"
      : "border-[color:var(--border-subtle)]",
    RING
  );
}

function Field({
  id,
  label,
  helper,
  error,
  badge,
  children,
}: {
  id: string;
  label: string;
  helper: string;
  error: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label
          htmlFor={id}
          className={cn(
            "block",
            error ? "text-[var(--state-error)]" : "text-[var(--text-muted)]"
          )}
          style={LABEL_STYLE}
        >
          {label}
        </label>
        {badge && (
          // Neutral tone deliberately: this states provenance, it does not grade
          // it. An amber "AI-generated" badge would read as a warning about the
          // teen rather than a fact about the text.
          <span className="rounded-full bg-[var(--status-neutral-bg)] px-2 py-0.5 text-[11.5px] leading-[16px] font-medium text-[var(--status-neutral-fg)]">
            {badge}
          </span>
        )}
      </div>
      <p
        id={`${id}-help`}
        className="mt-1 text-[12.5px] leading-[17px] text-[var(--text-muted)]"
      >
        {helper}
      </p>
      {children}
      <FieldError id={`${id}-err`} show={error} />
    </div>
  );
}

/** ALWAYS MOUNTED, hidden when clear. The message sits beside the field it
 *  belongs to rather than in a summary at the top, so a screen-reader user
 *  reaches it by moving through the form and a sighted user reads it where they
 *  are already looking. */
function FieldError({ id, show }: { id: string; show: boolean }) {
  return (
    <p
      id={id}
      className={cn(
        "mt-1.5 text-[12.5px] leading-[17px] text-[var(--state-error)]",
        !show && "hidden"
      )}
    >
      {/* TODO-COPY */}
      {show ? "This field is required." : ""}
    </p>
  );
}
