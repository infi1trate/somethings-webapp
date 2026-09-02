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

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        /* ═══ 640px, AND EXACTLY ONE SCROLL CONTEXT ═══
         *
         *  WIDTH. `sm:max-w-lg` was 512px, which put the diagnostic statement at
         *  roughly 46 characters per line — under the 45–75 measure convention and
         *  the reason the fields read as cramped. 40rem is 640px; measured, the
         *  text column lands at 68ch, inside the range.
         *  NO BLOCK-WIDTH TOKEN EXISTS to reach for — Bloom ships surface, radius,
         *  spacing and type tokens but nothing for container widths, so this is a
         *  literal. Flagged rather than minted.
         *
         *  SCROLL. Three regions could scroll before: each textarea (fixed
         *  `rows`), a bespoke `max-h-[52vh] overflow-y-auto` body, and
         *  DialogContent itself (`max-h-[90dvh] overflow-y-auto`). Nested
         *  scrollers are why content clipped and why a wheel gesture landed in
         *  whichever box the pointer happened to be over.
         *
         *  So: `overflow-hidden` here takes DialogContent OUT of the scrolling
         *  business — `cn` is tailwind-merge, so it genuinely replaces the base
         *  `overflow-y-auto` rather than losing to it — and the rows template
         *  makes the middle child the only flexible one, which pins the header
         *  and the footer without either needing a sticky position. The one
         *  remaining scroller is `<DialogBody>`. */
        className="grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-[40rem]"
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

  // BOTH FIELDS FIT THEMSELVES. Keyed on the value rather than on an onInput
  // handler so a PREFILLED amendment opens at the height of the text it was
  // given — an amendment starts pre-filled with the original, which is exactly
  // the case a resize-on-type handler would miss until the first keystroke.
  // `useAutoGrow` moved into `CareUpdateFields` with the textareas it sizes.

  return (
    <>
      {/* ═══ TITLE → EXPLANATION → FIRST FIELD, ON THE SCALE (A3) ═══
          8px under the title, 24px under the explanation. The copy teaches the
          append-only model — "this appends a new update that references the
          Aug 17 one; the original stays on the record" — and it only teaches it
          if it is not crushed against the first label. */}
      <DialogHeader className="gap-2 pb-6">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {/* ═══ THE ONE SCROLLER, AND THE FIELD RHYTHM (A1, A4) ═══
          `DialogBody` is `min-h-0 flex-1 overflow-y-auto` — the primitive that
          already existed for exactly this and that this modal was not using. It
          replaces a `max-h-[52vh]` guess: a viewport fraction is not the height
          available, because it ignores the header and footer sharing the box.

          `space-y-6` is a FULL step between field groups, up from `space-y-5`.
          Each group is label / helper / input, so the gap between groups has to
          beat the gap inside one or the helper text reads as belonging to the
          field below it. */}
      <DialogBody className="px-0.5">
        <CareUpdateFields
          idPrefix="cu"
          body={body}
          onChange={setBody}
          errors={errors}
          clearError={clearError}
          prefill={prefill}
          clinicalRef={clinicalRef}
          diagnosticRef={diagnosticRef}
          assessmentRef={assessmentRef}
          firstRef={firstRef}
        />
      </DialogBody>

      <DialogFooter>
        {/* THE LIVE REGION IS ALWAYS MOUNTED and starts empty. A region added to
            the DOM at the moment it gains text is unreliably announced. */}
        <p
          aria-live="polite"
          className="sr-only"
        >
          {announce}
        </p>
        {/* `min-w-0` so THIS is what gives way when the footer is tight. Without
            it both flex items shrink proportionally and the button loses the
            argument to a sentence. */}
        <p className="mr-auto min-w-0 text-[13px] leading-[18px] text-[var(--text-muted)]">
          {/* TODO-COPY — permanence stated while there is still time to act on it. */}
          All three fields are required. This cannot be edited once saved;
          corrections append.
        </p>
        {/* ═══ ONE LINE, AT ANY ZOOM (A5) ═══
            "Append amendment" wrapped to two lines, and the cause was not the
            label's length. `PillButton` sets no `shrink-0` and no
            `whitespace-nowrap`, and a flex item defaults to `flex-shrink: 1` — so
            in this footer's row the button was compressed below its own text
            width and the label broke. Both classes are needed: `shrink-0` keeps
            the box at its content width, `whitespace-nowrap` means that content
            width is one line. At 200% text zoom the note beside it wraps instead,
            which is the correct thing to sacrifice. */}
        <PillButton
          className="shrink-0 whitespace-nowrap"
          onClick={() => attemptSave(Date.now())}
        >
          {commitLabel}
        </PillButton>
      </DialogFooter>
    </>
  );
}

/** SSR-safe layout effect. Third declaration of this local in the codebase
 *  (`scroll-affordance.tsx`, `segmented-control.tsx`) — flagged as a shared
 *  helper worth extracting rather than copied a fourth time. */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** ═══ THE AUTO-GROWING TEXTAREA (A1) ═══
 *
 *  A fixed `rows` is the third scroll context: type past three lines and the box
 *  scrolls inside a body that also scrolls inside a dialog that also scrolls, and
 *  the clinical statement a supervisor is about to sign is read four lines at a
 *  time through a slot.
 *
 *  So the field grows with its content. `MIN_LINES` (4) is the resting height —
 *  enough that the box reads as "write a paragraph" rather than "fill in a
 *  value". `MAX_LINES` (12) is where growth stops and the textarea is allowed to
 *  scroll internally, as the degenerate case: past twelve lines a field that keeps
 *  growing pushes the footer's CTA off the bottom of a laptop screen, and a
 *  scroller the reader chose by writing an essay is better than a hidden button.
 *
 *  MEASURED IN LINES, NOT PIXELS: `lineHeight` is read off the element, so the
 *  clamp follows the type token instead of hardcoding what 20px happens to be
 *  today, and it survives a text-zoom change.
 *
 *  `height = "auto"` FIRST, EVERY TIME. `scrollHeight` on an element with an
 *  explicit height returns that height whenever the content shrank, so deleting
 *  text would leave the box at its high-water mark forever. */
const MIN_LINES = 4;
const MAX_LINES = 12;

function fitToContent(el: HTMLTextAreaElement | null) {
  if (!el) return;
  const cs = getComputedStyle(el);
  const line = parseFloat(cs.lineHeight) || 20;
  // The padding is part of the box but not of the text, so it is added to both
  // bounds rather than being absorbed into the line count.
  const chrome =
    parseFloat(cs.paddingTop) +
    parseFloat(cs.paddingBottom) +
    parseFloat(cs.borderTopWidth) +
    parseFloat(cs.borderBottomWidth);
  const min = line * MIN_LINES + chrome;
  const max = line * MAX_LINES + chrome;
  el.style.height = "auto";
  const needed = el.scrollHeight;
  el.style.height = `${Math.min(Math.max(needed, min), max)}px`;
  // The scrollbar appears ONLY at the cap. Below it the element is exactly as
  // tall as its content, so `auto` would still paint a bar on some platforms
  // during the frame the height is being set.
  el.style.overflowY = needed > max ? "auto" : "hidden";
}

/** Keeps a textarea fitted across mounts, edits and prefills. Runs on layout so
 *  the first paint is already the right height — a growing-in animation on open
 *  would read as the dialog settling. */
function useAutoGrow(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string
) {
  useIsoLayoutEffect(() => {
    fitToContent(ref.current);
  }, [ref, value]);
}

function textareaClass(error: boolean) {
  return cn(
    // `resize-none`, NOT `resize-y`: the handle and the auto-grow fight each
    // other — a manual drag sets an inline height that the next keystroke
    // overwrites, so the control lies about being adjustable. Growth is
    // automatic and capped instead.
    "mt-1.5 block w-full resize-none rounded-[var(--radius-surface)] border bg-[var(--surface-card)] px-3 py-2.5",
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

/** ═══ THE THREE CARE-UPDATE FIELDS, WITH NO SURFACE AROUND THEM ═══
 *
 *  Extracted so the review drawer can document a decision in the same fields the
 *  standalone modal uses — B4's "parameterize, do not fork". A second copy of
 *  these three would be two forms that start identical and drift on the day one
 *  of them gains a required field.
 *
 *  WHAT STAYED BEHIND: the dialog chrome, the title/description, the footer and
 *  the validation. Those differ per surface — the modal commits an update, the
 *  drawer commits a decision AND an update as one act — and pretending otherwise
 *  is how a shared component grows a `variant` prop for every caller.
 *
 *  `idPrefix` EXISTS BECAUSE BOTH CAN BE MOUNTED AT ONCE. The drawer is
 *  non-modal, so a supervisor can open it and then open the standalone Write
 *  form behind it; two `id="cu-clinical"` in one document would point every
 *  `htmlFor` and `aria-describedby` at whichever rendered first. */
export function CareUpdateFields({
  idPrefix,
  body,
  onChange,
  errors,
  clearError,
  prefill,
  clinicalRef,
  diagnosticRef,
  assessmentRef,
  firstRef,
  order = ["clinical", "diagnostic", "assessment"],
  className,
}: {
  idPrefix: string;
  body: CareUpdateBody;
  onChange: (update: (b: CareUpdateBody) => CareUpdateBody) => void;
  errors: Record<FieldId, boolean>;
  clearError: (id: FieldId) => void;
  prefill?: DiagnosticPrefill | null;
  clinicalRef: React.RefObject<HTMLTextAreaElement | null>;
  diagnosticRef: React.RefObject<HTMLTextAreaElement | null>;
  assessmentRef: React.RefObject<HTMLButtonElement | null>;
  /** Set by the modal, which moves initial focus into the first field. The
   *  drawer focuses its own header instead, so it passes nothing. */
  firstRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Render order. Defaults to the order the standalone modal has always used,
   *  so that surface is untouched by this. */
  order?: readonly FieldId[];
  className?: string;
}) {
  useAutoGrow(clinicalRef, body.clinical);
  useAutoGrow(diagnosticRef, body.diagnostic);
  /** ═══ THE THREE BLOCKS, KEYED, SO A CALLER CAN ORDER THEM ═══
   *  The modal and the in-card review want different orders — the review leads
   *  with the assessment dropdown, per its own composition — and the fields are
   *  identical in both. Keyed blocks rather than a second component: two copies
   *  of three clinical fields are two forms that start the same and drift on the
   *  day one of them gains a required field.
   *  THE CALLOUT TRAVELS WITH THE DIAGNOSTIC FIELD, not with a position. It asks
   *  a supervisor to read before signing THAT statement, so it belongs to that
   *  block in either order — which also keeps it below Clinical Summary in both,
   *  since Diagnostic follows Clinical either way. */
  const BLOCKS: Record<FieldId, React.ReactNode> = {
    clinical: (
      <>
      {/* 1 · CLINICAL SUMMARY */}
      <Field
        id={`${idPrefix}-clinical`}
        label={CARE_UPDATE_SECTIONS[0].label}
        helper={CARE_UPDATE_SECTIONS[0].helper}
        error={errors.clinical}
      >
        <textarea
          id={`${idPrefix}-clinical`}
          ref={(el) => {
            clinicalRef.current = el;
            if (firstRef) firstRef.current = el;
          }}
          value={body.clinical}
          onChange={(e) => {
            onChange((b) => ({ ...b, clinical: e.target.value }));
            clearError("clinical");
          }}
          /* NO `rows` — `useAutoGrow` owns the height, floor 4 lines. A `rows`
             here would set an inline height the hook then overwrites, which is
             a flash of the wrong size on first paint. */
          aria-invalid={errors.clinical || undefined}
          aria-describedby={`${idPrefix}-clinical-help ${idPrefix}-clinical-err`}
          className={textareaClass(errors.clinical)}
        />
      </Field>

      </>
    ),
    diagnostic: (
      <>
      {/* 2 · DIAGNOSTIC SUPPORT STATEMENT.
          The callout sits ABOVE the field, per spec — it asks the supervisor to
          read before signing, so it has to arrive before the text does. */}
      <div>
        {/* `mb-3` (12px) on the scale, up from an arbitrary 10px. The callout
            keeps `InfoCallout`'s own `px-3 py-2.5` padding untouched — it is the
            standard for every callout in the record — and the 24px group gap
            above it means it no longer sits against the field it follows. */}
        <InfoCallout className="mb-3">
          {/* TODO-COPY */}
          Review this section carefully to ensure it accurately reflects your
          client&apos;s symptoms and your clinical judgement.
        </InfoCallout>
        <Field
          id={`${idPrefix}-diagnostic`}
          label={CARE_UPDATE_SECTIONS[1].label}
          helper={CARE_UPDATE_SECTIONS[1].helper}
          error={errors.diagnostic}
          // PROVENANCE ON THE FIELD, not in a tooltip: a supervisor is about to
          // sign this sentence, and whether a model wrote the first draft is
          // part of what they are agreeing to.
          badge={prefill ? PREFILL_LABEL[prefill.source] : undefined}
        >
          <textarea
            id={`${idPrefix}-diagnostic`}
            ref={diagnosticRef}
            value={body.diagnostic}
            onChange={(e) => {
              onChange((b) => ({ ...b, diagnostic: e.target.value }));
              clearError("diagnostic");
            }}
            /* NO `rows` — see the clinical field above. */
            aria-invalid={errors.diagnostic || undefined}
            aria-describedby={`${idPrefix}-diagnostic-help ${idPrefix}-diagnostic-err`}
            className={textareaClass(errors.diagnostic)}
          />
        </Field>
      </div>

      </>
    ),
    assessment: (
      <>
      {/* ═══ 3 · ASSESSMENT OF SYMPTOMS — NOW A SELECT (A6) ═══
          This was a `RadioGroup`, and the reasoning for that is worth keeping
          visible because this change overrides it: the segmented control offers
          only `semantics="tabs"` and `semantics="group"` (role=group +
          aria-pressed), neither of which announces a required single-select in a
          form, and a radiogroup does. A `Select` announces as a combobox with a
          single value, which also does — so the accessible semantics survive the
          change; what is traded is RECOGNITION for RECALL. All three options
          were visible at rest and now one click hides them.

          THE SEGMENTED CONTROL DOES EXIST in this codebase
          (`components/record/segmented-control.tsx`, three consumers) and would
          keep all three visible on one line at the same footprint. Flagged in
          the report, not implemented — the dropdown is the decided direction.

          NO DEFAULT PRESELECTION: `value` is undefined until chosen, so the
          placeholder shows and the required-field validation has something real
          to catch. A preselected "Maintained" would be a clinical assertion
          nobody made. */}
      <div>
        <label
          htmlFor={`${idPrefix}-assessment`}
          className={cn(
            "block",
            errors.assessment
              ? "text-[var(--state-error)]"
              : "text-[var(--text-muted)]"
          )}
          style={LABEL_STYLE}
        >
          {CARE_UPDATE_ASSESSMENT_LABEL}
        </label>
        <Select
          value={body.assessment ?? undefined}
          onValueChange={(v) => {
            onChange((b) => ({
              ...b,
              assessment: v as CareUpdateAssessment,
            }));
            clearError("assessment");
          }}
        >
          <SelectTrigger
            id={`${idPrefix}-assessment`}
            ref={assessmentRef}
            aria-invalid={errors.assessment || undefined}
            aria-describedby={`${idPrefix}-assessment-err`}
            className={cn(
              "mt-1.5 w-full",
              errors.assessment && "border-[color:var(--state-error)]"
            )}
          >
            {/* TODO-COPY */}
            <SelectValue placeholder="Select an assessment" />
          </SelectTrigger>
          <SelectContent>
            {CARE_UPDATE_ASSESSMENTS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id={`${idPrefix}-assessment-err`} show={errors.assessment} />
      </div>
      </>
    ),
  };

  return (
    <div className={cn("space-y-6", className)}>
      {order.map((id) => (
        <React.Fragment key={id}>{BLOCKS[id]}</React.Fragment>
      ))}
    </div>
  );
}
