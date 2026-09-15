"use client";

// ═══ THE BILLING REVIEW — A CODE IS NOT COMMITTED WITHOUT DOCUMENTATION ═══
//
// ═══ THE GAP THIS CLOSES (A0) ═══
//
// The Care page has required three documentation fields before a presentation
// can be committed since the review workspace was built. This pane assigned the
// same ICD code, onto the same minor's record, in ONE CLICK with nothing
// written down — `onResolve(item, {outcome, code, changed})` and the queue moved
// on. Same clinical decision, two standards of rigour, and THIS is the
// higher-volume path: fifteen open billing items on a typical shift against one
// record at a time on the Care tab. The undocumented path was the dominant one.
//
// That is a correctness gap and not a styling one, which is why the requirement
// is not configurable and there is no lighter-weight route to a commit. The
// footer's Submit runs the same three-field gate the Care page runs.
//
// ═══ THE VALIDATION IS THE CARE PAGE'S, DELIBERATELY UNCHANGED ═══
//
// Recon'd off `care-review-workspace.tsx` and mirrored rather than reinvented:
//
//   · non-empty after trim on Clinical summary and Diagnostic support statement,
//     and a chosen Assessment of symptoms. NO LENGTH MINIMUM — the Care page has
//     none, and inventing one here would make the two surfaces disagree about
//     what counts as documented.
//   · NO DISABLED COMMIT. The button is always live and validation happens on
//     the attempt, in plain language, at the field that is missing. A disabled
//     primary tells a reader the screen is broken and not what to do about it.
//   · errors per field, a live-region sentence saying how many and that focus
//     moved, and focus placed on the first gap.
//
// ═══ ONE THING IS FIXED RATHER THAN COPIED ═══
//
// The Care page detects gaps in the order `clinical → diagnostic → assessment`
// while rendering them `assessment → clinical → diagnostic`. So on an empty form
// its "focus moved to the first" lands on Clinical summary while the unanswered
// Assessment select sits ABOVE it, unmarked by focus. `FIELD_ORDER` below is the
// single source for both the render order and the gap order here, so the two
// cannot drift apart. Reported for the Care page rather than fixed there — that
// surface is the reference standard for this one, not a thing to edit while
// raising this one to it.
//
// ═══ WHAT IS NOT HERE, AND WHY ═══
//
// NOTES-AS-DRAFT IS ABSENT. The brief's speed mechanism pre-fills the two prose
// fields with generated notes marked as draft, clearing the marker on the first
// edit. `aiNotesFor` returns null without a `CareSummaryDoc`, and this pane has
// no record to build one from: every teen id in the Tasks fixtures is synthetic
// (`tk-jordan`, …) and none exists in `DEMO_TEENS`. So `notes` is null, the
// fields' own notes disclosure hides itself, and the form starts empty.
// THE AUDIT HALF OF THAT FEATURE IS ALREADY BUILT AND IS WIRED HERE: per-field
// `FieldProvenance` travels with the body to the ledger, so the moment there is
// something to insert, "accepted as drafted" (`ai_inserted`) versus "edited
// after inserting" (`ai_assisted`) is already the recorded difference.
// The remaining blocker is data, reported on the previous commit.
//
// THE CONTEXT RAIL (A2/A4) IS ABSENT for the same reason: its three sections all
// read the record by teen id. The spine is therefore the whole pane body for
// now, which is why there is no two-column grid in here to un-pick later.

// ═══ WHERE THIS DELIBERATELY DIFFERS FROM THE CARE PAGE (A6) ═══
//
// Four differences, each a decision rather than a drift:
//
//  1. `⌘/Ctrl+Enter` SUBMITS HERE AND NOWHERE ELSE. The Care page has no
//     keyboard submit at all — recon found none, so this is new behaviour and
//     not parity. It belongs here: this is the surface a supervisor works
//     through fifty times a shift with their hands on the keyboard, and the
//     Care page is one record at a time. NO BARE-ENTER EQUIVALENT on either
//     surface; Enter on a list row now moves focus into the pane, where it used
//     to commit a code outright.
//
//  2. THE FOCUS ORDER ON A FAILED GATE IS RIGHT HERE AND WRONG THERE. One
//     `FIELD_ORDER` feeds both the render and the validation; the Care page
//     keeps two lists that disagree. See the note on the constant.
//
//  3. NO "ABOUT THIS RECORD" MODULE. Clinical-advisor attribution is a
//     record-level statement — "Dr. Nissan is the final decision-maker on all
//     clinical notes and determinations on this page" — and a queue item is not
//     a page about a person. Repeating it per item would also put it on screen
//     fifty times a shift, which is how a standing disclosure becomes furniture.
//     The AI-usage half of that module lives in the Notes block's provenance
//     badge instead, which is where a reader already looks for it.
//
//  4. ONE `Was this helpful?` ON THE NOTES BLOCK, not one per field — WHEN THERE
//     ARE NOTES. There are none yet (see below), so the control is absent rather
//     than offered against nothing. Recorded now because the decision is about
//     placement and placement is what a second implementation gets wrong: the
//     judgement is about the generated set, and a per-field control would ask
//     the same question twice about one generation.
//
import { useEffect, useMemo, useRef, useState } from "react";
import { CareUpdateFields } from "@/components/record/care-update-compose";
import {
  emptyCareUpdateBody,
  type CareUpdateBody,
} from "@/lib/record/care-demo";
import {
  AUTHORED,
  onEdit,
  type FieldProvenanceState,
} from "@/lib/record/field-provenance";
import {
  clearReviewDraft,
  readReviewDraft,
  writeReviewDraft,
} from "@/lib/record/review-draft";
import type { BillingPayload, TaskItem } from "@/lib/tasks/types";

/** ═══ THE ORDER, ONCE ═══
 *
 *  Both the render order and the gap order read this. The Care page keeps two
 *  lists — one in its JSX, one in its validator — and they disagree; see the
 *  note above. The mock's order is assessment first, then the two statements.
 *
 *  DECLARED LOCALLY RATHER THAN IMPORTED. `CareUpdateFields` types its `errors`
 *  and `clearError` against a `FieldId` union it does not export, and widening
 *  that export means editing a Care-page file for a type. TypeScript is
 *  structural, so this satisfies it without touching that surface — and a test
 *  asserts the two stay the same three members. */
const FIELD_ORDER = ["assessment", "clinical", "diagnostic"] as const;
type FieldId = (typeof FIELD_ORDER)[number];

const NO_ERRORS: Record<FieldId, boolean> = {
  assessment: false,
  clinical: false,
  diagnostic: false,
};

/** What the commit writes into the ledger event's payload, on top of the code.
 *
 *  THE DOCUMENTATION IS THE AUDIT ARTEFACT, so it goes where the audit trail is:
 *  `detail` spreads straight into `buildResolveEvent`'s payload. A commit that
 *  wrote the code to the ledger and the prose somewhere else would be two
 *  records of one decision, and only one of them subpoena-able. */
export interface BillingCommitDetail extends Record<string, unknown> {
  outcome: "confirmed" | "unchanged";
  code: string | null;
  changed: boolean;
  documentation: CareUpdateBody;
  /** Per-field, and the reason it is per-field rather than one flag: one claim
   *  on a record can be authored while the next one down is not. */
  provenance: { clinical: FieldProvenanceState; diagnostic: FieldProvenanceState };
}

export interface BillingSubmitHandle {
  /** Runs the gate. Commits when it passes; marks, announces and moves focus
   *  when it does not. Held in a ref so the pane's footer and the keyboard layer
   *  press the same one. */
  submit: () => void;
  saveAndClose: () => void;
}

export function BillingReview({
  item,
  payload,
  /** Override-aware: the code the supervisor picked, or the model's proposal.
   *  What the diff and the commit both read, so they cannot disagree. */
  recommended,
  onCommit,
  handleRef,
  recordContext,
  children,
}: {
  item: TaskItem;
  payload: BillingPayload;
  recommended: { code: string; statement: string };
  onCommit: (detail: BillingCommitDetail) => void;
  handleRef: React.MutableRefObject<BillingSubmitHandle | null>;
  /** ═══ THE RECORD CONTEXT, AND IT MOVED BELOW THE REVIEW (arch-F) ═══
   *  This was a two-cell strip ABOVE the review holding the code on record and
   *  the mentorship figures. The code went where the parity spec always wanted
   *  it — a subordinate line under the recommendation title, inside the module —
   *  and the figures went into a collapsed accordion, which is what this slot
   *  now carries. Below the review, because it is context a supervisor consults
   *  rather than reads: above it, it was the first thing on the pane and the
   *  recommendation was the second. */
  recordContext: React.ReactNode;
  /** THE SHARED REVIEW MODULE. Passed in rather than rendered here so this
   *  component owns exactly one thing — the documentation gate and its commit —
   *  and the review stays the caller's to compose. */
  children: React.ReactNode;
}) {
  /** ═══ THE DRAFT IS KEYED ON THE ITEM, NOT THE TEEN ═══
   *  A supervisor with two billing items open across a shift has two reviews,
   *  and a teen-keyed draft would pour one into the other. `item.id` is the
   *  review here, which is what `reviewId` means on the Care page. */
  const draftKey = useMemo(
    () => ({ teenId: item.teenId, reviewId: item.id }),
    [item.teenId, item.id]
  );

  const restored = useMemo(
    () => readReviewDraft(draftKey.teenId, draftKey.reviewId),
    [draftKey]
  );

  const [body, setBody] = useState<CareUpdateBody>(
    () => restored?.body ?? emptyCareUpdateBody()
  );
  /** Seeded from the restored draft so a reload cannot launder provenance — the
   *  same reason the Care page seeds it. Both fields start `authored`, which is
   *  what a fresh form is: nothing has been inserted into it. */
  const [prov, setProv] = useState<{
    clinical: FieldProvenanceState;
    diagnostic: FieldProvenanceState;
  }>(() => restored?.provenance ?? { clinical: AUTHORED, diagnostic: AUTHORED });
  const [errors, setErrors] = useState<Record<FieldId, boolean>>(NO_ERRORS);
  const [announce, setAnnounce] = useState("");

  const clinicalRef = useRef<HTMLTextAreaElement | null>(null);
  const diagnosticRef = useRef<HTMLTextAreaElement | null>(null);
  const assessmentRef = useRef<HTMLButtonElement | null>(null);

  /* ═══ THE FORM RESETS WHEN THE QUEUE ADVANCES ═══
     The pane does not unmount between reviews — resolving auto-advances to the
     next item in the same component — so without this, prose written about
     Jordan would still be in the fields when Riley's review arrived, and the
     gate would pass on it. That is the same defect class the `override` state
     had, and it is worse here: it would commit one teen's clinical reasoning
     onto another's record.
     KEYED ON THE ITEM ID rather than reset in an effect on every render, and it
     restores that item's own draft rather than blanking — a supervisor who
     started writing, jumped away and came back finds their words. */
  const seenItem = useRef(item.id);
  useEffect(() => {
    if (seenItem.current === item.id) return;
    seenItem.current = item.id;
    const next = readReviewDraft(item.teenId, item.id);
    setBody(next?.body ?? emptyCareUpdateBody());
    setProv(next?.provenance ?? { clinical: AUTHORED, diagnostic: AUTHORED });
    setErrors(NO_ERRORS);
    setAnnounce("");
  }, [item.id, item.teenId]);

  /* WRITTEN ON EVERY KEYSTROKE, like the Care page's. There is no "save" that
     does anything else — `Save draft` closes the review, and the draft is
     already on disk by then. */
  useEffect(() => {
    writeReviewDraft(draftKey.teenId, draftKey.reviewId, {
      /* NO DECISION IN THE DRAFT. On the Care page this holds a pending code
         change, which is card state that survives a reload; here the picked code
         is the PANE's `override`, which is deliberately scoped to one item and
         re-derived rather than stored (see the note on it). Writing it twice
         would give a restored draft a say in which code is on screen. */
      decision: null,
      body,
      provenance: prov,
      savedAt: Date.now(),
    });
  }, [draftKey, body, prov]);

  const clearError = (id: FieldId) =>
    setErrors((e) => (e[id] ? { ...e, [id]: false } : e));

  /** THE KEYSTROKE PATH MOVES TEXT AND PROVENANCE TOGETHER, in one handler, for
   *  the reason the Care page's does: a commit that raced them would persist the
   *  new text against the old state. `onEdit` is a no-op on `authored`, so this
   *  only ever weakens an inserted state — never the reverse. */
  const changeBody = (update: (b: CareUpdateBody) => CareUpdateBody) => {
    setBody((b) => {
      const next = update(b);
      setProv((p) => ({
        clinical:
          next.clinical === b.clinical ? p.clinical : onEdit(p.clinical, next.clinical),
        diagnostic:
          next.diagnostic === b.diagnostic
            ? p.diagnostic
            : onEdit(p.diagnostic, next.diagnostic),
      }));
      return next;
    });
  };

  const refFor = (id: FieldId) =>
    id === "clinical"
      ? clinicalRef.current
      : id === "diagnostic"
        ? diagnosticRef.current
        : assessmentRef.current;

  const attemptCommit = () => {
    /* GAPS IN RENDER ORDER — see `FIELD_ORDER`. This is the one place this pane
       knowingly differs from the Care page's implementation, and it differs by
       being right: focus lands on the first field a reader would reach, which on
       an empty form is the assessment select at the top. */
    const gaps = FIELD_ORDER.filter((id) =>
      id === "assessment" ? !body.assessment : !body[id].trim()
    );

    if (gaps.length) {
      setErrors({
        assessment: gaps.includes("assessment"),
        clinical: gaps.includes("clinical"),
        diagnostic: gaps.includes("diagnostic"),
      });
      /* TODO-COPY — the Care page's wording, verbatim. It says how many and
         where focus went, for a reader who cannot see which blocks turned red. */
      setAnnounce(
        gaps.length === 1
          ? "One thing still needs an answer. Focus moved to it."
          : `${gaps.length} things still need an answer. Focus moved to the first.`
      );
      refFor(gaps[0])?.focus();
      return;
    }

    setAnnounce("");
    const changed = recommended.code !== (payload.current?.code ?? null);
    clearReviewDraft(draftKey.teenId, draftKey.reviewId);
    onCommit({
      /* `unchanged` IS A RENEWAL — the code on record, confirmed. The two
         outcomes were two footer buttons before this; there is one Submit now
         and the outcome is derived from what the diff is showing, which is the
         only way the button and the region above it cannot disagree. */
      outcome: changed ? "confirmed" : "unchanged",
      code: recommended.code,
      changed,
      documentation: body,
      provenance: { clinical: prov.clinical, diagnostic: prov.diagnostic },
    });
  };

  /* PUBLISHED, NOT LIFTED. The pane's footer and the keyboard layer both need to
     press this, and the state it validates lives here — so the action goes up
     rather than the state coming down. Same trade the `override` fix made. */
  useEffect(() => {
    handleRef.current = {
      submit: attemptCommit,
      saveAndClose: () => {
        /* NOTHING TO PERSIST: the draft is written on every keystroke. This
           exists so the label can be honest about what it does — and on this
           surface "close" means hand the keyboard back to the list. */
        setAnnounce("");
      },
    };
    return () => {
      handleRef.current = null;
    };
  });

  return (
    <div data-slot="billing-review" className="space-y-4">
      {/* ═══ THE SPINE'S ORDER ═══
          Review → context → documentation (arch-F reordered the first two). The
          review carries its own order — recommendation → rationale → evidence,
          settled on the Care page — and the code on record is now a subordinate
          line inside it rather than a strip above it. What is left of the old
          context strip is the mentorship figures, which are a thing to consult
          rather than to read, so they sit after the claim in a collapsed
          accordion and before the documentation the supervisor has to write. The thing they
          have to produce is last, where a decision belongs.
          THE ORDER USED TO BE "rationale → diff → documentation" and the middle
          term is gone with `PresentationDiff`: the shared module states the
          recommendation and the proposal kind itself, and the code on record
          moved up into the context strip where the rest of the context is. */}
      {children}

      {/* CONTEXT AFTER THE CLAIM, BEFORE THE DOCUMENTATION. A supervisor reads
          the recommendation, consults the mentorship figures if they want them,
          then writes. */}
      {recordContext}

      {/* ═══ ALWAYS VISIBLE, NEVER BEHIND A DISCLOSURE (A5) ═══
          A form the supervisor has to open is a form that reads as optional, and
          the whole point of this commit is that it is not. It is also the
          longest thing on the pane, which is the honest shape: writing the
          documentation IS the work, and the code is one field of it.

          `idPrefix` — the standalone compose modal can be mounted at the same
          time from elsewhere in the app, and two `id="cu-clinical"` in one
          document would point every `htmlFor` and `aria-describedby` at
          whichever rendered first. */}
      {/* ═══ KEYED ON THE ITEM, AND THAT IS A BUG WORKAROUND ═══
          MEASURED: advancing the queue resets `body` correctly — the gate counts
          three gaps and marks the assessment invalid — but the assessment
          CONTROL went on reading "Escalated" from the review before it. So a
          supervisor saw an answer, pressed Submit, and was told the answer was
          missing.
          THE CAUSE IS IN THE SHARED FIELDS: the select is
          `value={body.assessment ?? undefined}`, and an `undefined` value prop
          makes a Radix Select UNCONTROLLED — it keeps its own internal
          selection rather than clearing. Null is a real state here ("not
          answered yet") and the component cannot express it.
          THE PROPER FIX IS IN `care-update-compose.tsx` and is NOT made here:
          that file is the Care page's, and the Care page is the reference
          standard for this surface rather than something to edit while raising
          this one to it. The same defect is reachable there — Discard on a
          restored draft clears both textareas and leaves the select showing its
          old value — and it is reported rather than fixed.
          A key remounts the subtree, so the select re-initialises from the new
          body. It costs one remount per queue advance, on a pane that already
          replaces its entire contents in that frame. */}
      <CareUpdateFields
        key={item.id}
        idPrefix="tk-billing"
        body={body}
        onChange={changeBody}
        errors={errors}
        clearError={clearError}
        clinicalRef={clinicalRef}
        diagnosticRef={diagnosticRef}
        assessmentRef={assessmentRef}
        order={FIELD_ORDER}
        provenance={{ clinical: prov.clinical.state, diagnostic: prov.diagnostic.state }}
        /* NULL, AND THE FIELDS HANDLE IT. See the module note on notes-as-draft:
           there is no record behind a queue item to derive notes from, so the
           per-field disclosure hides itself rather than offering to insert
           nothing. */
        notes={null}
      />

      {/* THE LIVE REGION FOR THE GATE. `sr-only`, polite, and it carries the
          same sentence the Care page announces — a reader who cannot see which
          blocks turned red is told how many and that focus moved. */}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
