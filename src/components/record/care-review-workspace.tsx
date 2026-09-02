"use client";

// THE REVIEW WORKSPACE — the Action required card, opened.
//
// ═══ IT IS NOT A SURFACE OF ITS OWN ═══
//
// This was a drawer, then a floating panel pinned to the viewport. Both put the
// decision somewhere other than where the card that raised it lives, and both
// then had to answer "where did the evidence go" — the drawer by collapsing the
// rail, the panel by growing a copy of it. Neither question exists here: the
// card grows, its header band stays, and the proposal, rationale and survey
// strip that were already on it are still above the form. Nothing moves out of
// the page, nothing is duplicated, and the care summary rail is never touched.
//
// So this file is a BODY, not a container. It renders no card chrome, no header
// and no close control — those belong to the card, which owns them in both
// states. What it keeps is everything a decision needs: the two peer outcomes,
// the inline code search, the three documentation fields, the validation, and
// the draft that survives all of it.

import { useEffect, useMemo, useRef, useState } from "react";
import { PillButton } from "@/components/settings/pill-button";
import { ArrowRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Dsm5SearchList } from "@/components/record/dsm5-search";
import {
  CareUpdateFields,
  type DiagnosticPrefill,
} from "@/components/record/care-update-compose";
import {
  emptyCareUpdateBody,
  type CareUpdateBody,
  type PresentationReview,
} from "@/lib/record/care-demo";
import type { Dsm5Entry } from "@/lib/record/dsm5";
import {
  clearSupersededDrafts,
  draftAge,
  readReviewDraft,
  writeReviewDraft,
  type ReviewDecision,
} from "@/lib/record/review-draft";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

type FieldId = "clinical" | "diagnostic" | "assessment";


export interface CareReviewWorkspaceProps {
  review: PresentationReview;
  /** The code on record — what "confirm" confirms, and the "before" of a change. */
  currentCode: string | null;
  /** The statement for `currentCode`, so the change delta can name what is being
   *  replaced rather than only its code. */
  currentStatement?: string | null;
  teenId: string;
  prefill?: DiagnosticPrefill | null;
  now: number;
  /** ═══ A TICK THAT MEANS "TAKE FOCUS" ═══
   *  The card owns expansion, so a mount effect is not what should move focus —
   *  the workspace is mounted and unmounted by the card's own open state, and on
   *  a restore from a draft it must not steal the caret from a field somebody is
   *  already typing in. The card increments this when it expands, and only then.
   *  Focus lands on the DECISION ROW's first control, which is the first thing
   *  this flow asks anyone to do. */
  focusSignal: number;
  /** Persists the draft and collapses the card. Distinct from committing. */
  onSaveAndClose: () => void;
  onCommit: (
    decision: ReviewDecision,
    body: CareUpdateBody,
    at: number
  ) => void;
}

export function CareReviewWorkspace({
  review,
  currentCode,
  currentStatement,
  teenId,
  prefill,
  now,
  focusSignal,
  onSaveAndClose,
  onCommit,
}: CareReviewWorkspaceProps) {
  /** ═══ STATE IS SEEDED FROM THE DRAFT, ONCE ═══
   *  In a lazy initialiser rather than an effect: an effect would render the
   *  empty form first and then replace it, which is a visible flash of a blank
   *  clinical field and, worse, a moment where the supervisor's restored text is
   *  not on screen. */
  const restored = useMemo(() => {
    clearSupersededDrafts(teenId, review.id);
    return readReviewDraft(teenId, review.id);
  }, [teenId, review.id]);

  const [decision, setDecision] = useState<ReviewDecision | null>(
    restored?.decision ?? null
  );
  /** What this opened with — the restored draft, or the AI prefill, or empty. */
  const [initialBody] = useState<CareUpdateBody>(() =>
    restored?.body ??
    (prefill
      ? { ...emptyCareUpdateBody(), diagnostic: prefill.text }
      : emptyCareUpdateBody())
  );
  const [body, setBody] = useState<CareUpdateBody>(initialBody);
  const [errors, setErrors] = useState<Record<FieldId, boolean>>({
    clinical: false,
    diagnostic: false,
    assessment: false,
  });
  const [decisionError, setDecisionError] = useState(false);
  const [query, setQuery] = useState("");
  /** The code picker's own open state — a dialog now, not an inline list. */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [announce, setAnnounce] = useState("");

  const clinicalRef = useRef<HTMLTextAreaElement | null>(null);
  const diagnosticRef = useRef<HTMLTextAreaElement | null>(null);
  const assessmentRef = useRef<HTMLButtonElement | null>(null);
  const firstDecisionRef = useRef<HTMLButtonElement | null>(null);
  /** The control the picker returns focus to, captured so Radix does not drop a
   *  keyboard reader on <body> — the same failure the DSM-5 dialog had to fix. */
  const changeRef = useRef<HTMLButtonElement | null>(null);
  const pickerInputRef = useRef<HTMLInputElement | null>(null);
  const decisionRef = useRef<HTMLDivElement | null>(null);

  /** ═══ FOCUS LANDS ON THE DECISION, NOT ON A FIELD ═══
   *  The first thing this flow asks is "confirm or change", and the fields below
   *  only make sense after that is answered — so focus goes to the first of the
   *  two peer controls rather than into a textarea. Nothing is trapped: the card
   *  is in the page, and Tab leaves it the way it leaves anything else. */
  useEffect(() => {
    if (focusSignal > 0) firstDecisionRef.current?.focus();
  }, [focusSignal]);

  /** ═══ EVERY KEYSTROKE AND EVERY DECISION IS PERSISTED ═══
   *  Not on close, not on a timer — on change. Close, minimise, a breakpoint
   *  flip and a tab-away are all just unmounts as far as this panel knows, and a
   *  save-on-unmount would have to be right about all four. */
  /** ═══ AN UNTOUCHED REVIEW IS NOT A DRAFT ═══
   *  The workspace is mounted by the card even while the card is collapsed, so
   *  an unconditional write put a draft in storage — seeded with the AI prefill
   *  and nothing else — for every review a supervisor merely scrolled past, and
   *  the collapsed card then advertised a "Draft" chip for work nobody had
   *  started. Measured, not theorised: opening and immediately closing a review
   *  left a stored body with an empty clinical field.
   *  So the write is gated on the content DIFFERING from what this opened with.
   *  Editing back to the seeded state stops updating the timestamp, which is the
   *  right behaviour for a draft that no longer contains anything of its own. */
  const pristine = useRef(
    JSON.stringify({ decision: restored?.decision ?? null, body: initialBody })
  );
  useEffect(() => {
    if (JSON.stringify({ decision, body }) === pristine.current) return;
    writeReviewDraft(teenId, review.id, { decision, body, savedAt: Date.now() });
  }, [teenId, review.id, decision, body]);

  const proposed = review.recommended;
  const proposesChange = currentCode !== proposed.code;

  /** The code this commit would write: the chosen one on a change, the code on
   *  record on a confirm. */
  const outcomeCode =
    decision?.kind === "change" ? decision.code : (currentCode ?? proposed.code);


  const clearError = (id: FieldId) =>
    setErrors((e) => (e[id] ? { ...e, [id]: false } : e));

  /** ═══ NO DISABLED COMMIT ═══
   *  The button is always live and validation happens on the attempt, in plain
   *  language under the field that is missing. A disabled primary tells a reader
   *  the screen is broken and not what to do about it — and on a form where the
   *  gate is three fields and a decision, "why can't I click this" is a question
   *  the button itself should answer. */
  const attemptCommit = () => {
    const gaps: FieldId[] = [];
    if (!body.clinical.trim()) gaps.push("clinical");
    if (!body.diagnostic.trim()) gaps.push("diagnostic");
    if (!body.assessment) gaps.push("assessment");
    const noDecision = decision === null;

    if (noDecision || gaps.length) {
      setDecisionError(noDecision);
      setErrors({
        clinical: gaps.includes("clinical"),
        diagnostic: gaps.includes("diagnostic"),
        assessment: gaps.includes("assessment"),
      });
      const count = gaps.length + (noDecision ? 1 : 0);
      // TODO-COPY — says how many and where focus went, for a reader who cannot
      // see which blocks turned red.
      setAnnounce(
        count === 1
          ? "One thing still needs an answer. Focus moved to it."
          : `${count} things still need an answer. Focus moved to the first.`
      );
      if (noDecision) {
        decisionRef.current?.focus();
      } else {
        const first = gaps[0];
        (first === "clinical"
          ? clinicalRef.current
          : first === "diagnostic"
            ? diagnosticRef.current
            : assessmentRef.current
        )?.focus();
      }
      return;
    }
    setAnnounce("");
    // The moment is stamped HERE, at click time — same rule the care update
    // form follows, because a timestamp read in render scope moves on re-render.
    onCommit(decision, body, Date.now());
  };

  // `commitLabel` is gone: the footer's two buttons are fixed labels now
  // ("Save & close" / "Save and submit"), and the decision is stated in the
  // decision row rather than inside the button that commits it.

  return (
    <div data-record-section="care-review-workspace" className="min-w-0">
      {/* ═══ NO SCROLL CONTEXT IN HERE, AND THAT IS THE POINT ═══
          The panel had a pinned header, a pinned footer and a scrolling middle,
          because it was a fixed-height box. A card in the document flow has no
          height to fight: it grows, the page scrolls, and the standing "one
          scroll context" rule is satisfied by there being exactly one — the
          page's own. */}
      <div>
        {/* DRAFT RESTORED — quiet, one line, and it offers the way out. */}
        {restored && !noticeDismissed && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2">
            <p className="min-w-0 flex-1 text-[13px] leading-[18px] text-[var(--text-secondary)]">
              {/* TODO-COPY */}
              Draft restored from {draftAge(restored.savedAt, now)}
            </p>
            {confirmDiscard ? (
              <span className="flex items-center gap-2">
                {/* DESTRUCTIVE, SO IT ASKS. Discarding is the one control here
                    that loses written clinical text, and it cannot be undone
                    from anywhere on this surface. */}
                <span className="text-[13px] text-[var(--text-secondary)]">
                  {/* TODO-COPY */}
                  Discard it?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDecision(null);
                    setBody(emptyCareUpdateBody());
                    setErrors({
                      clinical: false,
                      diagnostic: false,
                      assessment: false,
                    });
                    setConfirmDiscard(false);
                    setNoticeDismissed(true);
                  }}
                  className={cn(
                    "rounded-sm text-[13px] font-semibold text-[var(--state-error)] underline underline-offset-2",
                    RING
                  )}
                >
                  {/* TODO-COPY */}
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className={cn(
                    "rounded-sm text-[13px] text-[var(--text-secondary)] underline underline-offset-2",
                    RING
                  )}
                >
                  {/* TODO-COPY */}
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className={cn(
                  "shrink-0 rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2",
                  RING
                )}
              >
                {/* TODO-COPY */}
                Discard draft
              </button>
            )}
          </div>
        )}

        {/* ═══ NO EVIDENCE IN HERE, DELIBERATELY ═══
            R2 put a collapsible copy of the care summary at the top of this
            panel, because the panel had displaced the rail and the evidence had
            nowhere else to be. The see-saw removes that premise: the summary is
            still on screen — condensed to the digest directly above this card,
            one tap from full — so a second rendering of it would be the same
            document in two places, competing for the same column.
            What is left is a form. Reference lives in the main column (the
            rationale, and the survey grid behind the card's disclosure) and in
            the digest; this is where the decision gets written. */}

        {/* ═══ DECISION ═══ */}
        <section
          ref={decisionRef}
          tabIndex={-1}
          className="mt-6 outline-none"
          aria-labelledby="rv-decision-label"
        >
          <p
            id="rv-decision-label"
            className="text-[var(--text-muted)]"
            style={LABEL_STYLE}
          >
            {/* TODO-COPY */}
            Decision
          </p>

          {/* ═══ A PROMPT, NOT A LABEL ═══
              "Decision" over a statement told a reader what the section was
              called and left them to infer that it wanted something from them.
              The section now asks, in a sentence, and says what happens if they
              skip it — which is the thing the validation error would otherwise
              have to teach them after the fact. TODO-COPY. */}
          <p className="mt-1.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
            Confirm the code on record, or change it — one is required to submit.
          </p>

          {/* THE PROPOSAL, under the prompt. It describes what the model
              suggested and never changes with the draft. TODO-COPY. */}
          <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-muted)]">
            {proposesChange
              ? `Change to ${proposed.code} proposed`
              : "No change proposed"}
          </p>

          {/* ═══ A SINGLE-SELECT PAIR, AND THE CHECK IS NOT DECORATION ═══
              Selection was carried by a border and a fill alone. A tick beside
              the chosen label states it in a second channel (SC 1.4.1), and
              `aria-pressed` states it in a third for anyone not looking at
              either. Both render unselected until a supervisor chooses. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                {
                  key: "confirm",
                  label: `Confirm ${currentCode ?? proposed.code}`,
                  on: decision?.kind === "confirm",
                  pick: () => {
                    /* CHOOSING CONFIRM CLEARS ANY PENDING CHANGE — the code and
                       statement go with it, so the draft cannot carry a change
                       nobody is proposing any more. */
                    setDecision({ kind: "confirm" });
                    setDecisionError(false);
                  },
                },
                {
                  key: "change",
                  /* TODO-COPY — the chosen code rides in the label once there is
                     one, so the control says what it will do rather than what
                     kind of thing it does. */
                  label:
                    decision?.kind === "change" && decision.code
                      ? `Change code · ${decision.code}`
                      : "Change code",
                  on: decision?.kind === "change",
                  pick: () => {
                    setDecision({ kind: "change", code: "", statement: "" });
                    setDecisionError(false);
                    setPickerOpen(true);
                  },
                },
              ] as const
            ).map((o) => (
              <button
                key={o.key}
                type="button"
                /* The focus target on expand — see the effect above. */
                ref={o.key === "confirm" ? firstDecisionRef : changeRef}
                aria-pressed={o.on}
                onClick={o.pick}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-[14px] font-semibold leading-[20px] transition-colors",
                  o.on
                    ? "border-[color:var(--text-primary)] bg-[var(--surface-s1)] text-[var(--text-primary)]"
                    : "border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
                  decisionError && "border-[color:var(--state-error)]",
                  RING
                )}
              >
                {o.on && <Check className="size-4 shrink-0" aria-hidden />}
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>

          {decisionError && (
            <p className="mt-1.5 text-[12.5px] leading-[17px] text-[var(--state-error)]">
              {/* TODO-COPY — plain language, under the thing it is about. */}
              Choose an option above before submitting.
            </p>
          )}

          {/* ═══ THE DELTA, ON ONE LINE ═══
              What is on record, struck through AND dimmed — either alone is a
              single channel, and a strikethrough at full strength reads as
              emphasis rather than removal — then the arrow, then what it becomes
              at full weight. Name and code for both, because a code alone is not
              readable by everyone who reads this record. */}
          {decision?.kind === "change" && decision.code && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2">
              {currentCode && (
                <>
                  <span className="text-[13px] leading-[18px] text-[var(--text-muted)] line-through decoration-1">
                    {currentStatement ?? proposed.statement} ({currentCode})
                  </span>
                  <ArrowRight
                    className="size-3.5 shrink-0 text-[var(--text-muted)]"
                    aria-hidden
                  />
                </>
              )}
              <span className="text-[13px] font-semibold leading-[18px] text-[var(--text-primary)]">
                {decision.statement}{" "}
                <span className="tabular-nums">({decision.code})</span>
              </span>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={cn(
                  "ml-auto shrink-0 rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2",
                  RING
                )}
              >
                {/* TODO-COPY */}
                Edit
              </button>
            </div>
          )}

          {/* ═══ THE PICKER IS A DIALOG NOW ═══
              Built from `Dsm5SearchList` inside a plain Bloom dialog rather than
              reusing `Dsm5SearchDialog`: that component carries a two-step
              confirm this flow does not want, and it is SHARED with the Tasks
              billing picker, so changing its steps would have changed a surface
              outside this brief. The list is the shared part; the chrome is not.
              Radix gives the focus trap and Escape; picking a row closes it. */}
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogContent
              className="sm:max-w-lg"
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                pickerInputRef.current?.focus();
              }}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                // Focus returns to the control that opened it, not to <body>.
                changeRef.current?.focus();
              }}
            >
              <DialogHeader>
                {/* TODO-COPY */}
                <DialogTitle>Find a presentation</DialogTitle>
                <DialogDescription>
                  Search by code or by wording. Nothing is saved until you submit
                  the review.
                </DialogDescription>
              </DialogHeader>
              <Dsm5SearchList
                current={
                  currentCode
                    ? { code: currentCode, statement: currentStatement ?? proposed.statement }
                    : null
                }
                query={query}
                onQueryChange={setQuery}
                inputRef={pickerInputRef}
                onPick={(e: Dsm5Entry) => {
                  setDecision({
                    kind: "change",
                    code: e.code,
                    statement: e.statement,
                  });
                  // NO CONFIRM STEP. The review's own commit is that step, and a
                  // second one here would teach people to click through steps.
                  setPickerOpen(false);
                }}
                listClassName="max-h-72"
              />
            </DialogContent>
          </Dialog>
        </section>

        {/* ═══ DOCUMENTATION ═══
            The same three fields the standalone care update uses, from the same
            component — see `CareUpdateFields`. */}
        <section className="mt-6 border-t border-[color:var(--border-subtle)] pt-5">
          <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
            {/* TODO-COPY */}
            Documentation
          </p>
          {/* NO CALLOUT HERE. `CareUpdateFields` already renders the
              review-carefully callout directly above the diagnostic statement,
              which is where R1 put it and why — it asks a supervisor to read
              before signing, so it has to arrive immediately before the text it
              is about. A second copy at the top of the section put the same
              sentence on screen twice, twelve lines apart. Measured in the
              browser, not reasoned about. */}
          <CareUpdateFields
            className="mt-3"
            idPrefix="rv"
            body={body}
            onChange={setBody}
            errors={errors}
            clearError={clearError}
            prefill={prefill}
            clinicalRef={clinicalRef}
            diagnosticRef={diagnosticRef}
            assessmentRef={assessmentRef}
            /* THE MOCK'S ORDER — assessment first, then the two statements. The
               modal keeps its own; see `order` on `CareUpdateFields`. */
            order={["assessment", "clinical", "diagnostic"]}
          />
        </section>
      </div>

      {/* ═══ FOOTER — in flow, right-aligned, one filled button ═══ */}
      <div className="mt-6 border-t border-[color:var(--border-subtle)] pt-4">
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* OUTLINED, so the card still has exactly one filled button. It
              persists nothing extra — the draft is already written on every
              keystroke — it simply closes the card, and the name says that
              rather than implying a second kind of save. TODO-COPY. */}
          <button
            type="button"
            onClick={onSaveAndClose}
            className={cn(
              "h-10 shrink-0 whitespace-nowrap rounded-full border border-[color:var(--border-contour)] px-5 text-[14px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            Save &amp; close
          </button>
          {/* THE ONE FILLED BUTTON IN THE CARD, in either state — the collapsed
              card's Review is a filled pill and this replaces it while open.
              `whitespace-nowrap` and a short label keep it on one line at 200%:
              the longest it gets is "Save and submit". TODO-COPY. */}
          {/* ═══ THE LABEL FOLLOWS THE DECISION ═══
              A change is the outcome worth naming in the button that commits it,
              so once a code is chosen the CTA says which. Everything else —
              undecided, or confirming the code on record — keeps the neutral
              label rather than asserting an outcome nobody has picked yet.
              `whitespace-nowrap` and a 5-6 character code keep it on one line at
              200%; "Save change to F43.22" is the longest this gets. TODO-COPY. */}
          <PillButton
            onClick={attemptCommit}
            className="h-10 shrink-0 whitespace-nowrap px-5 text-[14px]"
          >
            {decision?.kind === "change" && decision.code
              ? `Save change to ${decision.code}`
              : "Save and submit"}
          </PillButton>
        </div>
        {/* The requirement note sits UNDER the buttons now rather than opposite
            them: right-aligned actions and a left-aligned sentence on one row
            read as two unrelated things at card width. */}
        <p className="mt-2 text-right text-[12px] leading-[16px] text-[var(--text-muted)]">
          {/* TODO-COPY */}
          All three fields are required.
        </p>
      </div>
      {/* `outcomeCode` is read by the owner through the committed decision; it is
          computed here only to keep the label and the commit reading one value. */}
      <span className="sr-only" data-outcome-code={outcomeCode} />
    </div>
  );
}
