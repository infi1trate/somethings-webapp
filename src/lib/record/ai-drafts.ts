// THE AI DRAFTS AND THE SUGGESTED REVISIONS — fixtures, and deliberately so.
//
// ═══ THE PIPELINE CONSTRAINT, STATED VERBATIM ═══
//
// "The real improvement model must preserve clinical facts and must not
// introduce claims absent from the user's text — revision, not generation."
//
// That is a constraint on the SERVICE, not on this file, and it is written here
// because this file is what a reader finds when they go looking for how the
// improvement works. The mock below cannot violate it — it only rewraps what it
// is given — and the moment a real model sits behind `improve()` the constraint
// becomes the acceptance test for it.
//
// ═══ WHY THE DRAFTS ARE AUTHORED PER SCENARIO ═══
//
// There is no summarization pipeline. A generic draft would be a lorem-ipsum
// with clinical vocabulary, and every screenshot of this feature would show a
// paragraph that does not match the record it sits on — which is exactly the
// defect the rail's summaries were written to avoid. So each one agrees with
// its scenario's assessments, tags and flags.

import type { CareAssessment } from "@/lib/record/care-demo";

export interface AiDrafts {
  clinical?: string;
  diagnostic?: string;
}

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
const DRAFTS: Record<string, AiDrafts> = {
  // RICH LONGITUDINAL — an open escalation and a household story.
  t17: {
    clinical:
      "Contact has held through the window, with the teen keeping most scheduled calls and rescheduling the two they moved. Sleep disturbance and low mood recur across the period, and school avoidance appears in about half the conversations. An escalation raised earlier this month remains open with a supervisor.",
    diagnostic:
      "Across the last three PHQ-9 results the recency-weighted score is 10, in the moderate band. The mood and sleep items carry the movement; the somatic items have not shifted. The presentation on record continues to fit the item pattern.",
  },
  // 90-DAY REVIEW DUE — the GAD-7 track.
  t23: {
    clinical:
      "Contact has been steady since the last review, with short exchanges between scheduled calls. Worry about school is the theme that recurs and has stayed level rather than building. No flags were raised in the window.",
    diagnostic:
      "Across the last two GAD-7 results the recency-weighted score is 10, in the moderate band. The worry and restlessness items account for most of the total. Generalized anxiety disorder still fits the item pattern on file.",
  },
  // REVIEW OVERDUE — thinner contact, one recurring theme.
  t19: {
    clinical:
      "Contact has been lighter than the previous window, with two calls moved and both kept. Low mood recurs, and the teen has twice described pulling back from friends rather than from the mentorship. No flags were raised in the period.",
    diagnostic:
      "Across the last three PHQ-9 results the recency-weighted score is 10, in the moderate band. The mood items carry the score and the appetite items appear in a smaller number of conversations.",
  },
  t18: {
    clinical:
      "The mentorship has been consistent across the window, with calls kept at their scheduled times. Worry about school recurs at a steady level. Nothing in the period was raised as a flag or an escalation.",
    diagnostic:
      "Across the last two GAD-7 results the recency-weighted score sits in the mild band. The worry items carry most of the total and the somatic items are minimal.",
  },
};

/** ═══ NO DRAFT IS A REAL ANSWER ═══
 *
 *  Returns null for a record with nothing to draft from, and the disclosure is
 *  then HIDDEN rather than disabled — a control that cannot do anything is a
 *  question a reader has to answer before moving on, where an absent one asks
 *  nothing. B4. */
export function aiDraftsFor(teenId: string): AiDrafts | null {
  const d = DRAFTS[teenId];
  if (!d) return null;
  return d.clinical || d.diagnostic ? d : null;
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

/** ═══ THE IMPROVE MOCK — DETERMINISTIC, AND A REWRAP RATHER THAN A REWRITE ═══
 *
 *  A canned per-scenario revision would not be a revision OF the user's text —
 *  it would be a second draft, and taking it would replace what they wrote with
 *  something that never referred to it. That is the failure the pipeline
 *  constraint above forbids, and a mock that models the forbidden behaviour
 *  teaches the wrong thing about the feature.
 *
 *  So this transforms the INPUT: it normalises whitespace, splits into
 *  sentences, trims filler openers, and joins them tightly. Every clinical noun
 *  the user wrote survives, because nothing is added and nothing is dropped
 *  except padding. Same input, same output, every time — which is also what
 *  makes it testable. */
const FILLER = /^(?:i think|i feel like|it seems like|basically|just|so)\s+/i;

/** ═══ WHEN THE IMPROVE CONTROL IS OFFERED — WORDS, NOT CHARACTERS ═══
 *
 *  THE CONTROL'S VISIBILITY MUST NOT DEPEND ON WHETHER THERE IS ANYTHING TO
 *  IMPROVE, and that is the whole point of this constant existing.
 *
 *  It used to: `canImprove` called `improve()` and hid the button whenever the
 *  result came back null. `improve()` returns null when its output equals its
 *  input — which becomes true the moment you finish a sentence with a full stop
 *  and false again as soon as you start the next word. Replayed keystroke by
 *  keystroke over one ordinary two-sentence draft, the button appeared and
 *  vanished FOUR times, and it was absent for the whole of the space after each
 *  full stop. A control that blinks while you type is a control you learn not
 *  to reach for.
 *
 *  So visibility is now a property of the TEXT — three words or more — and never
 *  of the suggestion. Above the threshold the control is always there; below it,
 *  never. Nothing else moves it. */
export const IMPROVE_MIN_WORDS = 3;

/** Whitespace-separated runs. Trailing and repeated spaces contribute nothing,
 *  which is what makes the count stable while a person is mid-word. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Whether the Improve control should be on screen for this text. The ONLY
 *  input is the word count — see `IMPROVE_MIN_WORDS`. */
export function canImproveText(text: string): boolean {
  return wordCount(text) >= IMPROVE_MIN_WORDS;
}

export function improve(text: string): string | null {
  const clean = text.replace(/\s+/g, " ").trim();
  /* THE SAME THRESHOLD THE BUTTON USES, so the two cannot disagree about what
     is long enough to work on. It was a 12-character floor, which is a
     different question from the one the control asks and answered it
     differently for short words. */
  if (!canImproveText(clean)) return null;
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(FILLER, "").trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`));
  const out = sentences.join(" ");
  /* ═══ COMPARED AGAINST THE TRIMMED INPUT, NOT THE NORMALISED ONE ═══
     `clean` has already had its internal whitespace collapsed, so comparing
     against it made a doubled space between two words invisible — the function
     said "nothing to change" about text it would have changed. Trimming only
     keeps leading and trailing whitespace out of it, which is not something to
     offer a person a suggestion about while they are still typing. */
  return out === text.trim() ? null : out;
}
