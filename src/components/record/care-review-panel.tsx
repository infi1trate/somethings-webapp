"use client";

// THE REVIEW PANEL — where a presentation decision is made and committed.
//
// ═══ NON-MODAL, AND THAT IS THE POINT ═══
//
// No scrim, no focus trap. A supervisor deciding a billing code needs to look at
// History, at the flags, at the conversation behind them — and a modal answers
// "can I check that first?" with "no". Initial focus moves in, because the reader
// asked for this surface; everything after that is theirs.
//
// The cost is stated: a non-modal panel can be forgotten behind other work. That
// is what the minimize pill and the draft are for.
//
// ═══ CONFIRM AND CHANGE ARE PEERS ═══
//
// One decision with two outcomes, not a primary action with an escape hatch. They
// render as two controls of equal weight, neither preselected. The card that
// opens this deliberately carries no approval affordance at all, so this is the
// only place in the record where a presentation decision can be taken.
//
// ═══ ONE FILLED BUTTON IN THE WHOLE PANEL ═══
//
// The commit. Everything else is outlined, ghost or text — if the decision
// controls were filled they would compete with the thing that actually writes to
// the record, and a reader scanning for "what does this screen do" would find
// three answers.

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { Dsm5SearchList } from "@/components/record/dsm5-search";
import {
  CareUpdateFields,
  type DiagnosticPrefill,
} from "@/components/record/care-update-compose";
import {
  emptyCareUpdateBody,
  REVIEW_NOUN,
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

/** TODO-COPY. Title-cased from `REVIEW_NOUN` rather than `STAGE_LABEL` + " review"
 *  — that concatenation produced "90-day review review", which is the bug the two
 *  maps in care-demo exist to keep apart. */
function reviewTitle(review: PresentationReview) {
  const noun = REVIEW_NOUN[review.stage];
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

export interface CareReviewPanelProps {
  review: PresentationReview;
  /** The code on record — what "confirm" confirms, and the "before" of a change. */
  currentCode: string | null;
  teenId: string;
  prefill?: DiagnosticPrefill | null;
  now: number;
  /** ═══ A TICK THAT MEANS "TAKE FOCUS" ═══
   *  The panel stays mounted while the see-saw is tipped away from it, so a
   *  mount effect can no longer be what moves focus in. The owner increments
   *  this when the reader tips BACK, and only then — a value rather than a
   *  callback, so a re-render for any other reason cannot pull focus out of a
   *  field somebody is typing in. */
  focusSignal: number;
  /** ═══ THE PANEL IS STILL MOUNTED WHILE IT LEAVES ═══
   *  Set for the length of the exit animation and then dropped by the owner. An
   *  unmount on click would give the exit nothing to animate, and the commit
   *  choreography (panel out, then the card resolves) depends on the panel
   *  actually taking that time rather than vanishing on the frame. */
  closing?: boolean;
  onClose: () => void;
  onCommit: (
    decision: ReviewDecision,
    body: CareUpdateBody,
    at: number
  ) => void;
}

export function CareReviewPanel({
  review,
  currentCode,
  teenId,
  prefill,
  now,
  focusSignal,
  closing,
  onClose,
  onCommit,
}: CareReviewPanelProps) {
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
  const [body, setBody] = useState<CareUpdateBody>(
    restored?.body ??
      (prefill
        ? { ...emptyCareUpdateBody(), diagnostic: prefill.text }
        : emptyCareUpdateBody())
  );
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
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const decisionRef = useRef<HTMLDivElement | null>(null);

  /** INITIAL FOCUS MOVES IN, AND NO FURTHER. The heading takes it (tabIndex -1)
   *  rather than the first field: landing in a textarea skips the append-only
   *  warning and the evidence, which is the reading order this panel exists to
   *  impose. Nothing traps focus afterwards — see the module note. */
  useEffect(() => {
    headingRef.current?.focus();
  }, [focusSignal]);

  /** ═══ EVERY KEYSTROKE AND EVERY DECISION IS PERSISTED ═══
   *  Not on close, not on a timer — on change. Close, minimise, a breakpoint
   *  flip and a tab-away are all just unmounts as far as this panel knows, and a
   *  save-on-unmount would have to be right about all four. */
  useEffect(() => {
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

  const commitLabel =
    decision === null
      ? /* TODO-COPY. The two decided labels are specified; this third one is
           not, and defaulting to either of them would put the answer in the
           button before the supervisor had chosen — the exact thing removing
           Approve from the card was for. */
        "Save review"
      : decision.kind === "confirm"
        ? `Approve · no change` // TODO-COPY
        : `Save change to ${decision.code}`; // TODO-COPY

  return (
    <div
      data-record-section="care-review-panel"
      /* ═══ A REGION, NOT A DIALOG ═══
         No scrim, no focus trap, no `role="dialog"`. The page behind stays
         readable and scrollable, which is the whole reason the evidence could
         come OUT of this panel: a supervisor checks the rationale and the survey
         grid in the main column rather than in a copy of them in here. */
      role="region"
      aria-label={reviewTitle(review)}
      className={cn(
        "flex min-h-0 flex-col bg-[var(--surface-card)]",
        /* ═══ A FLOATING CARD, NOT AN EDGE-ATTACHED DRAWER ═══
           Card radius and elevation, inset from the column's edges, sticky
           inside the tab's own scroll container — which is NOT the viewport
           (measured: an inner `overflow-y-auto` div, 16px from the top of the
           window and 56px from the bottom). So the height is bounded against
           that container rather than against `100dvh`, and the panel reads as a
           document lying on the workspace instead of chrome bolted to the
           window. */
        /* `--shadow-card`, not `shadow-lg`. The build shipped Tailwind's own
           default shadow, which is not a Bloom token at all — and of the tokens
           that exist, `--shadow-panel` is a flat all-round glow used by app
           chrome, which is the reading this panel is supposed to avoid.
           `--shadow-card` is the directional lift every other elevated surface
           on this record uses, and "a card placed on the workspace" is exactly
           what it is for. */
        "min-h-0 flex-1 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] shadow-[var(--shadow-card)]",
        /* See `review-panel-settle` in globals.css. */
        closing ? "review-panel-exit" : "review-panel-enter"
      )}
    >
      {/* ═══ HEADER ═══ */}
      <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-4 py-3">
        <div className="flex items-start gap-2">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 flex-1 font-display text-[16px] font-bold leading-[22px] text-[var(--text-primary)] outline-none"
          >
            {reviewTitle(review)} ·{" "}
            <span className="font-normal">{proposed.statement}</span>{" "}
            <span className="font-normal tabular-nums text-[var(--text-secondary)]">
              ({proposed.code})
            </span>
          </h2>
          {/* NO MINIMIZE CONTROL. Condensing is the see-saw's job now — closing
              tips the slot to the care summary and leaves a draft bar behind, so a
              second way to shrink this would be two controls for one idea. */}
          <button
            type="button"
            onClick={onClose}
            /* TODO-COPY — says what closing does NOT do, because the whole
               reason a reader hesitates over an × on a half-written clinical
               note is not knowing. */
            aria-label="Close review. Your draft is kept."
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {/* TODO-COPY — stated once, at the top, before anything is typed. */}
        <p className="mt-1 text-[13px] leading-[18px] text-[var(--text-muted)]">
          This appends to the record and cannot be edited afterwards.
        </p>
      </div>

      {/* ═══ ONE SCROLL CONTEXT — the body. Header and footer are pinned. ═══ */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
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
          />
        </section>
      </div>

      {/* ═══ FOOTER — pinned, requirement left, the one filled button right ═══ */}
      <div className="shrink-0 border-t border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3">
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[12px] leading-[16px] text-[var(--text-muted)]">
            {/* TODO-COPY */}
            All three fields are required.
          </p>
          {/* SINGLE LINE AT 100% AND 200%: `whitespace-nowrap` plus a label that
              is short in both decided states. The outcome code is 5 characters,
              so "Save change to F33.1" is the longest this ever gets. */}
          <PillButton
            onClick={attemptCommit}
            className="h-10 shrink-0 whitespace-nowrap px-5 text-[14px]"
          >
            {commitLabel}
          </PillButton>
        </div>
      </div>
      {/* `outcomeCode` is read by the owner through the committed decision; it is
          computed here only to keep the label and the commit reading one value. */}
      <span className="sr-only" data-outcome-code={outcomeCode} />
    </div>
  );
}
