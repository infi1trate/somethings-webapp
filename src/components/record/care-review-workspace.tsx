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

import {
  AUTHORED,
  onEdit,
  onInsert,
  type FieldProvenance,
  type FieldProvenanceState,
} from "@/lib/record/field-provenance";
import { useEffect, useMemo, useRef, useState } from "react";
import { PillButton } from "@/components/settings/pill-button";
import {
  CareUpdateFields,
  type DiagnosticPrefill,
} from "@/components/record/care-update-compose";
import {
  emptyCareUpdateBody,
  type CareUpdateBody,
  type PresentationReview,
} from "@/lib/record/care-demo";
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
  /** ═══ THE PENDING CHANGE, OWNED BY `care-tab` ═══
   *  `null` means unchanged, which is the outcome an untouched review commits.
   *  This form reads it for the CTA label and the commit, and writes it into the
   *  draft; the control that CHANGES it is in the card's title block. */
  decision: ReviewDecision | null;
  /** ═══ THE ONE WRITE THIS FORM STILL MAKES TO THE DECISION ═══
   *  Discarding the draft clears the pending change with it — the two are one
   *  act, and leaving a change behind after "Discard it?" would be the stale
   *  draft defect inverted. Every OTHER write comes from the title block. */
  onDecisionChange: (next: ReviewDecision | null) => void;
  teenId: string;
  /* `prefill` IS NO LONGER TAKEN. This surface seeded the diagnostic field from
     it and nothing else read it — the commit builds its provenance in
     `care-tab`. The reveal-and-insert disclosure that will need the draft is not
     built yet, and a prop nothing reads is a prop that rots. */
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
    at: number,
    /** C4. Per-field, and required rather than optional: a commit that could
     *  omit it would be a commit that silently records `authored`. */
    provenance: { clinical: FieldProvenance; diagnostic: FieldProvenance }
  ) => void;
}

export function CareReviewWorkspace({
  review,
  currentCode,
  decision,
  onDecisionChange,
  teenId,
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

  /* ═══ `decision` IS NOW A PROP, AND THE DRAFT STILL LIVES HERE ═══
     The control that sets it moved to the card's title block, which is this
     component's PARENT — so the state moved up to `care-tab`, which owns the
     review's lifecycle and already reads the draft to decide whether to
     advertise one.
     WHAT DID NOT MOVE is draft persistence: this form still writes
     `{ decision, body }` on every change and still clears on a return to
     pristine. The brief keeps drafts unchanged, and splitting the write across
     two components is how a draft ends up half-written. */
  /** ═══ WHAT THIS OPENED WITH: A RESTORED DRAFT, OR EMPTY ═══
   *
   *  The AI prefill is no longer one of the options. This surface seeded the
   *  diagnostic field INDEPENDENTLY of the shared `CareUpdateFields`, so
   *  removing the seeding in the modal left the in-card review still opening
   *  with model prose in the textarea — the same defect on one of two surfaces,
   *  which is worse than on both because only one of them looks fixed.
   *
   *  A RESTORED DRAFT IS STILL RESTORED, and only the user's own text: with
   *  nothing seeded there is no AI text in a draft to bring back. */
  const [initialBody] = useState<CareUpdateBody>(
    () => restored?.body ?? emptyCareUpdateBody()
  );
  const [body, setBody] = useState<CareUpdateBody>(initialBody);
  /** ═══ C1/C3: PER-FIELD PROVENANCE, LIVE ═══
   *
   *  Seeded from the restored draft so a reload cannot launder it — see the note
   *  on `ReviewDraft.provenance`. Both fields start `authored`, which is what a
   *  fresh form is: nothing has been inserted into it.
   *
   *  THE TRANSITIONS ARE NOT WRITTEN HERE. `onInsert` / `onEdit` come from
   *  `field-provenance.ts` and are asserted there, because the value ends up
   *  immutable on a committed record and a form that got it subtly wrong would
   *  be invisible in review. */
  const [prov, setProv] = useState<{
    clinical: FieldProvenanceState;
    diagnostic: FieldProvenanceState;
  }>(() => restored?.provenance ?? { clinical: AUTHORED, diagnostic: AUTHORED });
  const [errors, setErrors] = useState<Record<FieldId, boolean>>({
    clinical: false,
    diagnostic: false,
    assessment: false,
  });
  /** The code picker's own open state — a dialog now, not an inline list. */
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [announce, setAnnounce] = useState("");

  const clinicalRef = useRef<HTMLTextAreaElement | null>(null);
  const diagnosticRef = useRef<HTMLTextAreaElement | null>(null);
  const assessmentRef = useRef<HTMLButtonElement | null>(null);

  /** ═══ FOCUS LANDS ON THE FIRST FIELD NOW ═══
   *  It landed on "Change code", and that button has moved to the card's title
   *  block — above this component, and reachable by Tab from here backwards,
   *  which is the wrong direction to send someone who has just opened a form.
   *  The first thing this section asks for is the clinical summary, so that is
   *  where focus goes. Nothing is trapped: the card is in the page. */
  useEffect(() => {
    if (focusSignal > 0) clinicalRef.current?.focus();
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
  /** ═══ AND A RESTORED DRAFT IS NOT A RETURN TO PRISTINE ═══
   *
   *  `touched` started as `restored != null`, which made the FIRST run of the
   *  effect — the one on mount, before anyone has typed — clear the very draft
   *  it had just restored: a restored draft equals its own pristine snapshot by
   *  construction. Measured on t19: pick a code, reload, and the change is back
   *  on screen while session storage is empty behind it. Open the card and the
   *  re-seed reads that empty storage and drops the change.
   *
   *  So pristine only means "nothing of its own" when this OPENED with nothing.
   *  If it opened with a draft, sitting at that draft's state is a reason to
   *  keep it, not to delete it. The R7 intent survives untouched: a review
   *  merely scrolled past still writes nothing, and Remove still clears a change
   *  the supervisor took back — that state DIFFERS from a restored pristine, so
   *  it is written rather than skipped. */
  const startedWithDraft = restored != null;
  const touched = useRef(false);
  useEffect(() => {
    if (
      !startedWithDraft &&
      JSON.stringify({ decision, body }) === pristine.current
    ) {
      if (touched.current) {
        clearReviewDraft(teenId, review.id);
        touched.current = false;
      }
      return;
    }
    writeReviewDraft(teenId, review.id, {
      decision,
      body,
      provenance: prov,
      savedAt: Date.now(),
    });
    touched.current = true;
    // `prov` is deliberately NOT a dependency: it only ever changes on the same
    // `setBody` that changes the text, so the text is the trigger and reading
    // the state here cannot miss an update. Adding it would write the draft
    // twice per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teenId, review.id, decision, body, startedWithDraft]);

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
    /* PROVENANCE GOES WITH THE BODY, in the same call, so the record cannot be
       written with one and not the other. */
    onCommit(decision ?? { kind: "confirm" }, body, Date.now(), {
      clinical: prov.clinical.state,
      diagnostic: prov.diagnostic.state,
    });
  };

  // `commitLabel` is gone: the footer's two buttons are FIXED labels — "Save
  // draft" and "Submit" — and the decision is stated by the card's header, which
  // now moves to the new presentation as soon as one is picked. A button that
  // also named the outcome was restating what the header two blocks up already
  // says, in a place where it made the label grow with the code.

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
                    onDecisionChange(null);
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

        {/* ═══ THE CODE-ON-RECORD ROW AND ITS BUTTON MOVED TO THE TITLE ═══
            "Change code", the delta bar and the picker dialog now live in the
            card's title block — where the code on record already is. Keeping the
            control next to a second copy of the code, two sections down from the
            title that states it, meant a supervisor read the code twice and acted
            on it in the further-away place.

            THE SECTION LABEL WENT WITH THEM. It said "Care update", and the
            Documentation block below has always been the care update; a label
            over a row that is no longer here would be a heading for nothing. */}

        {/* ═══ DOCUMENTATION ═══
            The same three fields the standalone care update uses, from the same
            component — see `CareUpdateFields`. */}
        <section className="mt-0">
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
            /* ═══ ONE CALL CHANGES BOTH THE TEXT AND THE STATE ═══
               The provenance transition has to happen on the SAME update as the
               keystroke, or a commit racing a re-render could persist the text
               with the previous state. `onEdit` is a no-op on `authored` and on
               a change that does not change the string, so this is safe to run
               on every keystroke of both fields. */
            onChange={(update) =>
              setBody((b) => {
                const next = update(b);
                setProv((p) => ({
                  clinical: onEdit(p.clinical, next.clinical),
                  diagnostic: onEdit(p.diagnostic, next.diagnostic),
                }));
                return next;
              })
            }
            errors={errors}
            clearError={clearError}
            clinicalRef={clinicalRef}
            diagnosticRef={diagnosticRef}
            assessmentRef={assessmentRef}
            /* THE MOCK'S ORDER — assessment first, then the two statements. The
               modal keeps its own; see `order` on `CareUpdateFields`. */
            order={["assessment", "clinical", "diagnostic"]}
            /* C3's chip reads this; the fields never transition it. */
            provenance={{
              clinical: prov.clinical.state,
              diagnostic: prov.diagnostic.state,
            }}
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
            {/* TODO-COPY */}
            Save draft
          </button>
          {/* THE ONE FILLED BUTTON IN THE CARD, in either state — the collapsed
              card's Review is a filled pill and this replaces it while open.
              ONE WORD, AND IT NO LONGER NAMES THE OUTCOME. It read "Submit ·
              {code} unchanged" / "Save change to {code}", from a time when the
              header held the code on record whatever the supervisor had picked,
              so the button was the only place the outcome appeared before it
              happened. The header moves with the change now, so the label was
              the same fact a second time — and the version that grew with the
              code was the one that had to be shortened to fit the footer. */}
          <PillButton
            onClick={attemptCommit}
            className="h-10 shrink-0 whitespace-nowrap px-5 text-[14px]"
          >
            {/* TODO-COPY */}
            Submit
          </PillButton>
        </div>
        {/* NO REQUIREMENT NOTE. It stated a rule the form already enforces:
            submitting with a field empty marks it, moves focus to the first one
            and announces it on the live region, which tells a supervisor what is
            missing at the moment it matters rather than warning everyone in
            advance. */}
      </div>
      {/* `outcomeCode` is read by the owner through the committed decision; it is
          computed here only to keep the label and the commit reading one value. */}
      <span className="sr-only" data-outcome-code={outcomeCode} />
      {/* ═══ THE PROVENANCE STATE, READABLE FROM THE DOM ═══
          There is no way to observe this from outside otherwise: the value is
          form state that lands on a committed record, and the walk that has to
          be proven — insert, verify, edit, verify, commit, verify — needs a
          handle on the middle two. `sr-only` and no text, so it is inert to
          readers and to screen readers alike; it exists for the same reason
          `data-outcome-code` above it does. */}
      <span
        className="sr-only"
        data-provenance-clinical={prov.clinical.state}
        data-provenance-diagnostic={prov.diagnostic.state}
        /* ═══ THE INSERT ENTRY POINT, EXPOSED BEFORE ITS BUTTON EXISTS ═══
           Workstream B owns the "Insert into field" / "Replace field text"
           control; this is the function that control will call. It is attached
           here so the transition it drives can be walked end to end NOW —
           insert, verify, edit, verify, commit, verify — rather than shipping a
           state machine whose only proof is its unit tests.
           `ref` rather than a global: it hangs off a node inside this component,
           so it cannot outlive the form or be called against a stale closure. */
        ref={(el) => {
          if (el)
            (
              el as HTMLSpanElement & {
                __insert?: (f: "clinical" | "diagnostic", text: string) => void;
              }
            ).__insert = (field, text) => {
              setBody((b) => ({ ...b, [field]: text }));
              setProv((prev) => ({ ...prev, [field]: onInsert(text) }));
            };
        }}
      />
    </div>
  );
}
