// WHY THIS FLAG WAS SURFACED — the presentation model.
//
// ═══ BROUGHT FORWARD FROM arch-H, H7, AND RE-AIMED (Phase 5) ═══
//
// It shipped as `lib/tasks/surfacing.ts`, feeding the TASKS pane, because arch-H
// had merged every queue onto one surface. The supervisor IA restructure reverted
// that merge and Phase 2 narrowed Care Reviews to billing, so a flag never
// reaches `task-pane.tsx` again — the block's consumer is `event-pane.tsx` on
// `/app/risk-flags`. The file moved with it.
//
// WHAT ELSE CHANGED IN THE MOVE. Phase 4 adopted the playbook's category IDS, so
// `categories` are `RISK_CATEGORIES[].id` and the render site resolves them
// through `riskCategoryLabel`. That makes "Playbook match" a stronger claim than
// it was when the categories were free text: the chips now name published
// categories rather than phrases the seed invented. The `tier` field this file's
// original notes mentioned is gone (Phase 4); nothing here read it.
//
// ═══ THE BLOCK WAS CALLED "AI RATIONALE". IT IS A PLAYBOOK MATCH ═══
//
// Two changes, and the second is the one that matters.
//
// THE FRAMING. "AI rationale" names the machinery; "Playbook match" names the
// standard. The classifier implements a clinical playbook — `RiskFlagPayload`'s
// own comment has said so since the seed was written ("PLAIN-LANGUAGE playbook
// categories", "Raw enum values never reach here") — so attributing the flag to
// that playbook is both more accurate and better provenance than attributing it
// to a model. A supervisor arguing with "the AI" has nothing to argue with; a
// supervisor arguing with a playbook category can be right.
//
// THE CATEGORY AND THE RATIONALE ARE ONE ARTIFACT, and the pane had them in two
// blocks with a ninety-message transcript between them. They are the same
// statement in two registers: the categories are WHAT matched and the paragraph
// is WHY. Read together they are a claim a supervisor can test; read apart, the
// chips are a label with no argument and the paragraph is an argument whose
// subject scrolled off the top.
//
// ═══ TWO ATTRIBUTIONS, DELIBERATELY, AND THEY ARE NOT THE SAME ONE TWICE ═══
//
// The section eyebrow says `Playbook match` and the badge on the paragraph says
// `Classifier rationale`. That distinction is the honest one: the categories are
// a published clinical taxonomy, and the prose is machine-written. Collapsing
// them either way loses something — "Playbook match" over the paragraph would
// dress generated text as clinical authorship, and "AI rationale" over the chips
// would hand the taxonomy to the model.
//
// ═══ THE CLAIM COMES BEFORE THE EVIDENCE ═══
//
// H5 put the conversation ABOVE the timeline on the escalation response pane, on
// the rule that a pane hosting a judgment leads with the evidence. This block
// sits above the conversation, which is not a reversal of that rule but the same
// one applied to a different artifact: the timeline is a second body of
// comparable length answering its own question, while this is two chips and a
// paragraph stating the claim the transcript is being read AGAINST. A supervisor
// who scrolls ninety messages before learning what was matched is reading
// without a question.
//
// ═══ WHAT THIS MODEL PUBLISHES THAT NOTHING RENDERS, AND WHY IT IS HERE ═══
//
// `confidence` and `features` are declared absences. H7 asked for a confidence
// indicator and for evidence chips from the classifier's structured features;
// neither exists in the payload, at any tier, in any scenario. They are carried
// as a null and an empty list — rather than left out of the type — so that the
// two constants in `lib/monitoring/constants.ts` have a named consumer and so
// the day either arrives the compiler names this file and the one site that
// reads it. Nothing synthesises them from the prose, which is what the pack
// forbids and would in any case be a claim about what the model weighed.

import type { RiskFlagPayload } from "@/lib/tasks/types";

/** One structured feature the classifier weighed — `indicator: intent`,
 *  `context: 2 prior mentions`. NO PRODUCER EXISTS; see the constant. */
export interface PlaybookFeature {
  /** The feature's dimension: "indicator", "context", "tone". */
  dimension: string;
  /** Its value, in plain language. Never a raw enum, per the payload's rule. */
  value: string;
}

export interface PlaybookMatch {
  /** The playbook's own categories — structured classifier output, and the only
   *  structured output there is. */
  categories: readonly string[];
  /** ═══ ONLY WHEN IT SAYS SOMETHING ═══
   *  `sourceType` is "Message" on every flag in the system, so it is null here
   *  until it is not. The pane's own note records why the labelled row it used
   *  to have was furniture: a fact that has never once been different, costing
   *  the first two lines above the excerpt. As a chip beside the categories it
   *  appears the day a flag arrives from a video note or a journal entry, where
   *  a reader is already looking for what makes this flag different. */
  sourceType: string | null;
  /** The machine-written paragraph. Attributed as such at the render site. */
  rationale: string;
  /** Null while `FLAG_CONFIDENCE_PUBLISHED` is false — which is always. */
  confidence: number | null;
  /** Empty while `FLAG_EVIDENCE_FEATURES_PUBLISHED` is false — which is always. */
  features: readonly PlaybookFeature[];
}

export function playbookMatchFor(payload: RiskFlagPayload): PlaybookMatch {
  return {
    categories: payload.categories,
    sourceType: payload.sourceType === "Message" ? null : payload.sourceType,
    rationale: payload.aiRationale,
    /* ═══ NOT A BRANCH ON THE CONSTANTS, BECAUSE THERE IS NOTHING TO BRANCH TO ═══
       An `X_PUBLISHED ? read(payload) : null` here would be a conditional whose
       true arm cannot be written — the payload has no field on either side of
       it. So the absence is stated flatly and the constants carry the question,
       asserted in `surfacing.test.ts` so that flipping one fails a test that
       names what has to be built. Which is the same arrangement `FLAG_REVIEW_SLA`
       already has: a named unknown with an owner, deliberately read by nothing. */
    confidence: null,
    features: [],
  };
}
