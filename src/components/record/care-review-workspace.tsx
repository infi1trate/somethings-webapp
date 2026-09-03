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
import { ArrowRight, Pencil, X } from "lucide-react";
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
  clearReviewDraft,
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
  const [query, setQuery] = useState("");
  /** The code picker's own open state — a dialog now, not an inline list. */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [announce, setAnnounce] = useState("");

  const clinicalRef = useRef<HTMLTextAreaElement | null>(null);
  const diagnosticRef = useRef<HTMLTextAreaElement | null>(null);
  const assessmentRef = useRef<HTMLButtonElement | null>(null);
  /** The control the picker returns focus to, captured so Radix does not drop a
   *  keyboard reader on <body> — the same failure the DSM-5 dialog had to fix. */
  const changeRef = useRef<HTMLButtonElement | null>(null);
  const pickerInputRef = useRef<HTMLInputElement | null>(null);
  const decisionRef = useRef<HTMLDivElement | null>(null);

  /** ═══ FOCUS LANDS ON "CHANGE CODE", NOT ON A FIELD ═══
   *  It used to land on the first of the Confirm/Change pair, and that pair is
   *  gone. The equivalent is the one control that can still alter the outcome:
   *  a supervisor arriving here either changes the code or fills the fields, and
   *  the change is the decision the rest of the form is written against.
   *
   *  `changeRef` IS ALSO THE PICKER'S RETURN TARGET, which makes this one ref for
   *  one control rather than two refs racing for the same button. Nothing is
   *  trapped: the card is in the page, and Tab leaves it as it leaves anything. */
  useEffect(() => {
    if (focusSignal > 0) changeRef.current?.focus();
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
  /** ═══ R7: RETURNING TO PRISTINE CLEARS THE DRAFT, IT DOES NOT SKIP ═══
   *
   *  The guard above only ever declined to WRITE, which was right while the only
   *  way back to pristine was never having left it. Remove creates the other
   *  case, and it was measured as a real defect: change the code, press Remove,
   *  and the CTA correctly reverted to "unchanged" while the STORED DRAFT still
   *  held `{kind: "change", code: "F33.0"}`. Reload and the change would come
   *  back — the collapsed card would advertise a draft for a change the
   *  supervisor had explicitly removed.
   *
   *  So pristine now clears. Both intents survive: a review merely scrolled past
   *  still writes nothing, and a draft can no longer outlive the state it
   *  describes. `touched` tracks whether there is anything to clear, so a
   *  scrolled-past review does not issue a pointless removal on every render. */
  const touched = useRef(restored != null);
  useEffect(() => {
    if (JSON.stringify({ decision, body }) === pristine.current) {
      if (touched.current) {
        clearReviewDraft(teenId, review.id);
        touched.current = false;
      }
      return;
    }
    writeReviewDraft(teenId, review.id, { decision, body, savedAt: Date.now() });
    touched.current = true;
  }, [teenId, review.id, decision, body]);

  const proposed = review.recommended;

  /** The code this commit would write: the chosen one on a change, the code on
   *  record on a confirm. */
  const outcomeCode =
    decision?.kind === "change" ? decision.code : (currentCode ?? proposed.code);


  const clearError = (id: FieldId) =>
    setErrors((e) => (e[id] ? { ...e, [id]: false } : e));

  /** ═══ NO DISABLED COMMIT ═══
   *  The button is always live and validation happens on the attempt, in plain
   *  language under the field that is missing. A disabled primary tells a reader
   *  the screen is broken and not what to do about it.
   *
   *  ═══ R7/B: THE GATE IS THREE FIELDS. THE DECISION IS NO LONGER ONE ═══
   *  `noDecision` and every state it drove are gone — no `decisionError`, no
   *  "Choose an option above before submitting", no focus branch to a section
   *  that no longer asks anything. Not submitting a change IS the decision, and
   *  it is recorded as reviewed-unchanged. */
  const attemptCommit = () => {
    const gaps: FieldId[] = [];
    if (!body.clinical.trim()) gaps.push("clinical");
    if (!body.diagnostic.trim()) gaps.push("diagnostic");
    if (!body.assessment) gaps.push("assessment");

    if (gaps.length) {
      setErrors({
        clinical: gaps.includes("clinical"),
        diagnostic: gaps.includes("diagnostic"),
        assessment: gaps.includes("assessment"),
      });
      // TODO-COPY — says how many and where focus went, for a reader who cannot
      // see which blocks turned red.
      setAnnounce(
        gaps.length === 1
          ? "One thing still needs an answer. Focus moved to it."
          : `${gaps.length} things still need an answer. Focus moved to the first.`
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
    /* ═══ `null` NORMALISES TO CONFIRM AT THE BOUNDARY ═══
       Inside this form `null` means "no change pending"; to the owner's commit it
       has always meant "confirm the code on record". Normalising HERE rather than
       widening the commit's contract keeps renewal semantics — "{code} —
       unchanged" — exactly as they were.
       The moment is stamped here, at click time: a timestamp read in render scope
       moves on re-render. */
    onCommit(decision ?? { kind: "confirm" }, body, Date.now());
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

        {/* ═══ R7/B: IMPLICIT CONFIRM ═══
            The prompt, the Confirm/Change pair and the decision-required
            validation are GONE. Submitting without a change now records the code
            on record as reviewed-unchanged — that is the intended model, not a
            validation gap, and the CTA says which of the two it is about to do.

            WHAT THAT REMOVES: a supervisor whose answer was "nothing has
            changed" had to say so twice, once by not changing the code and once
            by pressing a button that said the same thing. The commit already
            knows.

            `decision === null` NOW MEANS UNCHANGED rather than unanswered. It is
            normalised to `{ kind: "confirm" }` at commit, so the owner's commit
            semantics are untouched — a renewal still records "{code} —
            unchanged" and a change still carries its amendment linkage. */}
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
            {/* TODO-COPY — PLACEHOLDER. */}
            Care update
          </p>

          {/* ═══ THE CODE ON RECORD, AND ONE WAY TO CHANGE IT ═══
              Replaces the decision pair. It states what is on record rather than
              asking a question whose answer is already implied, and the single
              outlined control is the only thing a supervisor has to press if the
              answer is not "unchanged". Opens the SAME dialog the pair opened. */}
          {!(decision?.kind === "change" && decision.code) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] px-3 py-2.5">
              <span className="min-w-0 flex-1 text-[14px] leading-[20px] text-[var(--text-primary)]">
                {currentStatement ?? proposed.statement}{" "}
                <span className="tabular-nums text-[var(--text-secondary)]">
                  ({currentCode ?? proposed.code})
                </span>
              </span>
              <button
                type="button"
                ref={changeRef}
                onClick={() => {
                  setDecision({ kind: "change", code: "", statement: "" });
                  setPickerOpen(true);
                }}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] px-3 py-1.5",
                  "text-[13px] font-semibold leading-[18px] text-[var(--text-primary)] transition-colors hover:bg-[var(--tint-hover)]",
                  RING
                )}
              >
                <Pencil className="size-3.5 shrink-0" aria-hidden />
                {/* TODO-COPY — PLACEHOLDER. */}
                Change code
              </button>
            </div>
          )}

          {/* ═══ THE DELTA, ON ONE LINE — AND IT REPLACES THE ROW ABOVE ═══
              What is on record, struck through AND dimmed — either alone is a
              single channel, and a strikethrough at full strength reads as
              emphasis rather than removal — then the arrow, then what it becomes
              at full weight. Name and code for both, because a code alone is not
              readable by everyone who reads this record.

              IT REPLACES the code-on-record row rather than sitting under it:
              two rows both claiming to state the code would make a reader work
              out which one is current.

              ═══ REMOVE IS NOT OPTIONAL AND IS NOT IN A MENU ═══
              With Confirm gone, this is the ONLY path back to no-change. A
              supervisor who opened the picker to look, or picked the wrong row,
              would otherwise have no way to say "actually, nothing changes"
              short of discarding the whole draft. */}
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
              <span className="ml-auto flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className={cn(
                    "rounded-sm text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-2",
                    RING
                  )}
                >
                  {/* TODO-COPY */}
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    /* BACK TO NO CHANGE. `null` is the unchanged state now, so
                       clearing the decision restores the code-on-record row, and
                       the draft effect below writes the cleared value — the CTA
                       reverts with it because it reads the same field. */
                    setDecision(null);
                    // Focus returns to the control that will be there after this
                    // render, not to the button that just unmounted.
                    requestAnimationFrame(() => changeRef.current?.focus());
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm text-[13px] text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)]",
                    RING
                  )}
                >
                  <X className="size-3.5 shrink-0" aria-hidden />
                  {/* TODO-COPY — PLACEHOLDER. */}
                  Remove
                </button>
              </span>
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
                  /* ═══ PICKING THE CODE ON RECORD IS NOT A CHANGE ═══
                     The list marks one row "On record", and picking it used to
                     produce `{kind:"change", code: <the same code>}` — a delta
                     bar reading "F41.1 → F41.1" and a CTA offering to save a
                     change to the code that is already there.
                     It never mattered while Confirm existed, because that was
                     the control for this answer. With implicit confirm it is
                     reachable in one click, so it resolves to the unchanged
                     state — which is what the reader just asked for. */
                  if (currentCode && e.code === currentCode) {
                    setDecision(null);
                  } else {
                    setDecision({
                      kind: "change",
                      code: e.code,
                      statement: e.statement,
                    });
                  }
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
          {/* ═══ R7/B: THE LABEL STATES WHICH OF THE TWO IT WILL DO ═══
              With Confirm gone, the button is the only place the unchanged
              outcome is named before it happens — so it names it. "Save and
              submit" alone would leave a supervisor pressing a neutral button
              and finding out afterwards what it recorded.

              THE UNCHANGED LABEL IS THE SHORT FORM, and that is a measured
              choice rather than a preference. The brief allows shortening rather
              than wrapping if the long form does not fit: "Save and submit ·
              F41.1 unchanged" is 34 characters and overruns the footer beside
              "Save & close" at panel width — so the shipped string is
              "Submit · {code} unchanged" (25). One line at 100% and 200%.
              `whitespace-nowrap` holds it; "Save change to F43.22" is the longest
              the change form gets. TODO-COPY — both PLACEHOLDERS. */}
          <PillButton
            onClick={attemptCommit}
            className="h-10 shrink-0 whitespace-nowrap px-5 text-[14px]"
          >
            {decision?.kind === "change" && decision.code
              ? `Save change to ${decision.code}`
              : `Submit · ${currentCode ?? proposed.code} unchanged`}
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
