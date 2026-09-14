// ═══ A BILLING TASK, AS THE SHARED REVIEW MODULE SEES IT ═══
//
// ═══ WHY AN ADAPTER AND NOT A SECOND COMPONENT ═══
//
// The Care page and the Tasks billing queue commit THE SAME CLINICAL DECISION —
// a presentation, a code, and the supervisor's account of why. Until this, they
// drew it two ways: `ReviewBody` on Care, and a hand-built composition on Tasks
// with a "Notes" block where Care says "Rationale", a `ScoreLozenge` where Care
// has a weighted score strip with the answers behind it, and no provenance
// affordance at all. A supervisor moving between the surfaces was reading two
// presentations of one thing and could not tell which parts were the same.
//
// `review-module-01-extract` pulled `ReviewBody` out of the Care card with
// seventeen DOM parity snapshots proving Care did not move. This is the second
// half — the Tasks host — and it is an ADAPTER rather than a component because
// the difference between the two surfaces is a DATA SHAPE, not a design.
//
// ═══ WHAT THE TWO SHAPES DISAGREE ABOUT ═══
//
//   stage          Tasks has a task TYPE, not a cadence stage. Mapped below.
//   rationale      Tasks carries `aiSummary`, a bare string with no provenance
//                  field. It is generated prose, so it is attributed as such —
//                  see the note at `source`.
//   survey.items   Tasks carries a score and no answers. Derived with the Care
//                  fixtures' own `buildItems`, so the two surfaces break one
//                  score down identically.
//   survey.severity  Tasks carries none; re-derived from the instrument's own
//                  thresholds, which is the rule the record already follows.
//   aggregate      Always null. A billing task holds ONE assessment, so there is
//                  nothing to weight — and calling one reading a weighted score
//                  is the single-survey lie the Care module already refuses.
//   mentorStats    No slot, and deliberately not forced into one. See below.
//
// ═══ WHAT DOES NOT COME THROUGH, AND WHERE IT WENT ═══
//
// `mentorStats` and the code ON RECORD have no place in the shared module, and
// that is correct rather than a shortfall: both are CONTEXT, and on the Care page
// the context is the page — the summary document above the card states the
// mentorship, and the metadata strip states the code in force. Tasks has no page
// around its pane, so its HOST supplies them, in a strip above the module. That
// split is what makes a shared module possible at all: the module is the review,
// the host is the context.

import { INSTRUMENT_MAX, buildItems, severityFor } from "@/lib/record/care-demo";
import type { CareAssessment, PresentationReview } from "@/lib/record/care-demo";
import type { BillingPayload, TaskItem } from "@/lib/tasks/types";

/** Instruments this codebase has thresholds and a maximum for. Anything else
 *  renders its number with no band — honest, where a lozenge asserting a severity
 *  nobody defined would not be. Same rule the record's History follows. */
function knownInstrument(
  instrument: string
): instrument is keyof typeof INSTRUMENT_MAX {
  return instrument in INSTRUMENT_MAX;
}

/** ═══ THE ASSESSMENT ═══
 *
 *  `severity` is RE-DERIVED from the instrument's own thresholds rather than
 *  carried: if a stored band and a computed one ever disagree, the instrument
 *  wins. The billing pane already did this for its lozenge; it is the same rule,
 *  moved to where the whole module can read it.
 *
 *  `items` are DERIVED, and that is worth stating plainly rather than leaving to
 *  be discovered: no moderation service exists in this prototype, so the answers
 *  behind a score are a fixture on BOTH surfaces. Sharing `buildItems` is what
 *  makes them the same fixture — a PHQ-9 of 14 breaks down identically whether a
 *  supervisor opens it from the record or from the queue. Seeded on the TASK id
 *  so two billing items with the same score do not show the same answers. */
function assessmentFor(item: TaskItem, payload: BillingPayload): CareAssessment {
  const { instrument, score, takenAt } = payload.survey;
  return {
    instrument,
    at: takenAt,
    score,
    severity: knownInstrument(instrument) ? severityFor(instrument, score) : "",
    items: knownInstrument(instrument) ? buildItems(instrument, score, item.id) : [],
  };
}

/** ═══ THE TASK TYPE, AS A CADENCE STAGE ═══
 *
 *  `intakeBillingReview` is an intake. `monthlyReReview` maps to `day30` rather
 *  than `quarterly`, and the reason is what the stage is READ for: `quarterly` is
 *  the stage the Care module associates with a weighted aggregate over a period,
 *  and a monthly re-review of a single assessment is not that. `day30` is the
 *  single-survey re-review, which is exactly what this is.
 *
 *  Nothing in the module branches on the stage today except through `aggregate`,
 *  which is always null here — so this is a declaration of intent more than a
 *  switch, and it is written down so a later branch on stage does not silently
 *  file every billing re-review under a cadence it does not belong to. */
function stageFor(item: TaskItem): PresentationReview["stage"] {
  return item.taskType === "intakeBillingReview" ? "intake" : "day30";
}

export function billingReviewFor(
  item: TaskItem,
  payload: BillingPayload
): PresentationReview {
  return {
    /* THE REVIEW'S ID IS THE TASK'S. It is what `reviewId` means on this surface
       — the draft key already uses it, so a draft and its review cannot point at
       two different things. */
    id: item.id,
    stage: stageFor(item),
    recommended: payload.recommended,
    /** ═══ THE ATTRIBUTION IS "ai", AND IT IS A CLAIM ABOUT PROVENANCE ═══
     *
     *  `aiSummary` is generated prose — the field's own name says so, and the
     *  pane already carried a system-provenance badge over it. `RATIONALE_SOURCE_LABEL.ai`
     *  reads "AI-generated from survey history and mentorship signal", which is
     *  the same sentence the Care page shows over the same kind of text.
     *
     *  NOT "templated" and NOT "supervisor": templated would credit an intake
     *  mapping that had no part in it, and supervisor would credit a person.
     *  Provenance is mandatory on this field precisely so it cannot be
     *  MISattributed, and a wrong attribution is worse than a vague one. */
    rationale: { source: "ai", text: payload.aiSummary },
    survey: assessmentFor(item, payload),
    /* ONE ASSESSMENT, SO NOTHING TO WEIGHT. See the module note. */
    aggregate: null,
  };
}
