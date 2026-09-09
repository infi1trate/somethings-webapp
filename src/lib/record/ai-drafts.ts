// THE AI NOTES — fixtures, and deliberately so.
//
// ═══ NOTES, NOT A DRAFT, AND THE WORD CHANGED FOR A REASON ═══
//
// This panel used to offer a paragraph called an "AI draft": prose shaped to be
// taken whole into a clinical field. It offers 3–5 BULLETS called "AI notes"
// now, and the two are different products of the same data.
//
// A draft invites acceptance — it is already the shape of the thing you were
// about to write, so the cheapest action is to take it and the expensive one is
// to disagree with it. Notes invite use: a reader takes the observation they
// agree with, leaves the rest, and writes the sentence themselves. On a surface
// whose output is a clinical determination that is the better default, and it is
// why each bullet is separately copyable rather than the body being copyable as
// a block. The unit a supervisor reasons about is the observation, so that is
// the unit the interface hands them.
//
// ═══ "IMPROVE MY DRAFT" IS GONE ═══
//
// It took a supervisor's own sentences and returned a model's version of them.
// Removed at the product owner's call, and the removal is consistent with the
// rename: a surface that offers reference notes should not also offer to rewrite
// the reader's clinical prose. `improve()`, its word-count threshold and the
// `onRevise` provenance transition all went with it — see the note in
// `field-provenance.ts` for what that leaves behind.
//
// ═══ WHY THE NOTES ARE AUTHORED PER SCENARIO ═══
//
// There is no summarization pipeline. Generic bullets would be lorem-ipsum with
// clinical vocabulary, and every screenshot of this feature would show notes
// that do not match the record they sit on — which is exactly the defect the
// rail's summaries were written to avoid. So each set agrees with its scenario's
// assessments, tags and flags.

import type { CareAssessment } from "@/lib/record/care-demo";

/** ═══ 3–5 BULLETS PER FIELD ═══
 *  A `readonly string[]` rather than one string with newlines in it: the bullets
 *  are the unit that is rendered, hovered and copied, so they are the unit the
 *  data carries. Splitting a paragraph on newlines at render time would put the
 *  count out of the fixture's control and make "3 to 5" unenforceable. */
export interface AiNotes {
  clinical?: readonly string[];
  diagnostic?: readonly string[];
}

/** How many bullets a set may hold. Asserted, because "a few notes" degrades
 *  into a paragraph in list clothing one bullet at a time. */
export const NOTES_MIN = 3;
export const NOTES_MAX = 5;

/** TODO-COPY, all of it. Synthetic; no real names; events at event level and
 *  never a teen's own words.
 *
 *  t18 IS CURRENTLY UNREACHABLE and kept deliberately. It is the "steady"
 *  scenario, which has no review due, so no review form mounts and no
 *  disclosure renders — measured across the roster: t23/t17/t19 show two
 *  disclosures each, t13/t24 mount the form and show none (no draft), t18/t9/t6
 *  mount no form at all. The entry stays because the day t18 comes due is the
 *  day this file would otherwise need a draft written from scratch to match a
 *  record whose assessments have moved on. */
const NOTES: Record<string, AiNotes> = {
  // RICH LONGITUDINAL — an open escalation and a household story.
  t17: {
    clinical: [
      "Kept most scheduled calls; rescheduled two and attended both.",
      "Sleep disturbance recurs across the window — 7 of 9 engaged days.",
      "Low mood recurs; school avoidance in about half the conversations.",
      "Escalation raised earlier this month is still open with a supervisor.",
      "Household illness and a separation are referred to throughout.",
    ],
    diagnostic: [
      "Recency-weighted PHQ-9 across the last three results is 10 — moderate band.",
      "Mood and sleep items carry the movement.",
      "Somatic items have not shifted across the period.",
      "Item pattern continues to fit the presentation on record.",
    ],
  },
  // 90-DAY REVIEW DUE — the GAD-7 track.
  t23: {
    clinical: [
      "Contact steady since the last review, including short exchanges between calls.",
      "Worry about school is the recurring theme.",
      "Theme has stayed level rather than building.",
      "No flags were raised in this window.",
    ],
    diagnostic: [
      "Recency-weighted GAD-7 across the last two results is 10 — moderate band.",
      "Worry and restlessness items account for most of the total.",
      "Generalized anxiety disorder still fits the item pattern on file.",
    ],
  },
  // REVIEW OVERDUE — thinner contact, one recurring theme.
  t19: {
    clinical: [
      "Contact lighter than the previous window; two calls moved and both kept.",
      "Low mood recurs across the period.",
      "Teen has twice described pulling back from friends, not from the mentorship.",
      "No flags were raised in the period.",
    ],
    diagnostic: [
      "Recency-weighted PHQ-9 across the last three results is 10 — moderate band.",
      "Mood items carry the score.",
      "Appetite items appear in a smaller number of conversations.",
    ],
  },
  t18: {
    clinical: [
      "Mentorship consistent across the window; calls kept at their scheduled times.",
      "Worry about school recurs at a steady level.",
      "Nothing in the period was raised as a flag or an escalation.",
    ],
    diagnostic: [
      "Recency-weighted GAD-7 across the last two results sits in the mild band.",
      "Worry items carry most of the total.",
      "Somatic items are minimal.",
    ],
  },
};

/** ═══ NO DRAFT IS A REAL ANSWER ═══
 *
 *  Returns null for a record with nothing to draft from, and the disclosure is
 *  then HIDDEN rather than disabled — a control that cannot do anything is a
 *  question a reader has to answer before moving on, where an absent one asks
 *  nothing. B4. */
export function aiNotesFor(teenId: string): AiNotes | null {
  const n = NOTES[teenId];
  if (!n) return null;
  return n.clinical?.length || n.diagnostic?.length ? n : null;
}

/** ═══ WHAT THE ⓘ ON THE REFERENCE CONTAINER SAYS ═══
 *
 *  It names the inputs rather than gesturing at them, because "generated from
 *  the record" is not a basis a supervisor can weigh.
 *
 *  IT TAKES THE REVIEW'S OWN ASSESSMENTS, not the care timeline. The two would
 *  answer the same question differently: the timeline holds every event on the
 *  record, and the drafting window is the window the review weighs. Naming a
 *  count the review does not use would put a second, larger number against a
 *  judgment made on a smaller one — and the review already carries exactly the
 *  readings it scored, so this needs no plumbing to be right.
 *
 *  NO FLAG COUNT. It would have to come from the timeline, and a basis line is
 *  the wrong place to make a claim this component cannot check. TODO-COPY. */
export function draftBasis(assessments: readonly CareAssessment[]): string {
  const tail =
    " and the conversation themes extracted for the period. It is context for " +
    "a coding decision — not itself a clinical determination.";
  const instrument = assessments[0]?.instrument;
  if (!assessments.length || !instrument)
    return `Drafted from the conversation themes extracted for this analysis window. It is context for a coding decision — not itself a clinical determination.`;
  return (
    `Drafted from ${assessments.length} ${instrument} reading` +
    `${assessments.length === 1 ? "" : "s"} in this analysis window` +
    tail
  );
}
