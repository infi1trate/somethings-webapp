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
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [announce, setAnnounce] = useState("");

  const clinicalRef = useRef<HTMLTextAreaElement | null>(null);
  const diagnosticRef = useRef<HTMLTextAreaElement | null>(null);
  const assessmentRef = useRef<HTMLButtonElement | null>(null);
  const firstDecisionRef = useRef<HTMLButtonElement | null>(null);
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
          {/* THE PROPOSAL, STATED PLAINLY — and it is a proposal, not a default.
              Neither control below is preselected. */}
          <p className="mt-1.5 text-[14px] leading-[20px] text-[var(--text-primary)]">
            {proposesChange
              ? /* TODO-COPY */ `Change to ${proposed.code} proposed`
              : /* TODO-COPY */ "No change proposed"}
          </p>

          {/* TWO PEERS. Outlined, identical weight, `aria-pressed` so the chosen
              one is announced as chosen rather than merely tinted. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                {
                  key: "confirm",
                  label: `Confirm ${currentCode ?? proposed.code}`,
                  on: decision?.kind === "confirm",
                  pick: () => {
                    setDecision({ kind: "confirm" });
                    setDecisionError(false);
                  },
                },
                {
                  key: "change",
                  /* TODO-COPY */
                  label: "Change code",
                  on: decision?.kind === "change",
                  pick: () => {
                    setDecision({
                      kind: "change",
                      code: proposesChange ? proposed.code : "",
                      statement: proposesChange ? proposed.statement : "",
                    });
                    setDecisionError(false);
                  },
                },
              ] as const
            ).map((o) => (
              <button
                key={o.key}
                type="button"
                /* The focus target on expand — see the effect above. */
                ref={o.key === "confirm" ? firstDecisionRef : undefined}
                aria-pressed={o.on}
                onClick={o.pick}
                className={cn(
                  "min-h-11 rounded-full border px-4 py-2 text-[14px] font-semibold leading-[20px] transition-colors",
                  o.on
                    ? "border-[color:var(--text-primary)] bg-[var(--surface-s1)] text-[var(--text-primary)]"
                    : "border-[color:var(--border-contour)] text-[var(--text-primary)] hover:bg-[var(--tint-hover)]",
                  decisionError && "border-[color:var(--state-error)]",
                  RING
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          {decisionError && (
            <p className="mt-1.5 text-[12.5px] leading-[17px] text-[var(--state-error)]">
              {/* TODO-COPY — plain language, under the thing it is about. */}
              Choose whether to confirm the code on record or change it.
            </p>
          )}

          {/* ═══ THE SELECTOR IS INLINE. NO SECOND SURFACE. ═══
              `Dsm5SearchList` is the same search the change-presentation dialog
              and the Tasks billing picker use — extracted from that dialog so
              this could hold it without a modal on top of a drawer. There is no
              confirm step in here: this panel's own commit is that step. */}
          {decision?.kind === "change" && (
            <div className="mt-3 space-y-2 rounded-[var(--radius-inset)] bg-[var(--surface-s1)] p-3">
              {decision.code && (
                <p className="text-[13px] leading-[18px] text-[var(--text-secondary)]">
                  {/* TODO-COPY */}
                  Changing to{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {decision.statement}
                  </span>{" "}
                  <span className="tabular-nums">({decision.code})</span>
                </p>
              )}
              <Dsm5SearchList
                current={
                  currentCode
                    ? { code: currentCode, statement: proposed.statement }
                    : null
                }
                query={query}
                onQueryChange={setQuery}
                onPick={(e: Dsm5Entry) =>
                  setDecision({
                    kind: "change",
                    code: e.code,
                    statement: e.statement,
                  })
                }
                listClassName="max-h-56"
              />
            </div>
          )}
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
          <PillButton
            onClick={attemptCommit}
            className="h-10 shrink-0 whitespace-nowrap px-5 text-[14px]"
          >
            Save and submit
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
