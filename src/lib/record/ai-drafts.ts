// THE AI NOTES — DERIVED FROM THE RECORD, not authored per scenario.
//
// ═══ NOTES, NOT A DRAFT ═══
//
// This panel used to offer a paragraph called an "AI draft": prose shaped to be
// taken whole into a clinical field. It offers 3–5 BULLETS called "AI notes"
// now, and the two are different products of the same data. A draft invites
// acceptance — it is already the shape of the thing you were about to write, so
// the cheapest action is to take it. Notes invite use: a reader takes the
// observation they agree with, leaves the rest, and writes the sentence
// themselves. Each bullet is separately copyable because the unit a supervisor
// reasons about is the observation.
//
// ═══ WHY THESE ARE DERIVED NOW, AND WERE HAND-WRITTEN BEFORE ═══
//
// The first version authored a bullet set per scenario, for four records:
// t17, t23, t19, t18. Everything else got nothing, and "nothing" correctly
// renders NO CONTROL — so a supervisor opening the Day 30 review (t9), or any
// of the other twenty-two records, saw no AI notes at all and had no way to
// tell an absent feature from a broken one. Reported as missing, and it was:
// the coverage was the fixture list, and the fixture list was four.
//
// SO THE NOTES COME FROM THE CARE SUMMARY DOCUMENT — the same
// `careSummaryFor()` the rail renders. Two consequences, both better than the
// fixtures were:
//
//   · EVERY record with a summary has notes, so the control appears wherever
//     the form does;
//   · the notes CANNOT CONTRADICT THE RAIL, because they are the rail's own
//     numbers restated as observations. The hand-written sets could drift from
//     the record the moment an assessment moved, which is exactly the defect
//     the rail's own summaries were written to avoid.
//
// WHAT IS STILL MOCKED IS THE SOURCE, NOT THE DERIVATION. `themes` and
// `conversationSummary` on that document are fixture data — there is no theme
// extraction in this codebase, stated at `care-summary-doc.ts`. These notes
// inherit that, and the ⓘ says so. What they no longer do is invent a SECOND
// set of facts alongside it.
//
// ═══ "IMPROVE MY DRAFT" IS GONE ═══
//
// It took a supervisor's own sentences and returned a model's version of them.
// Removed at the product owner's call. `improve()`, its word-count threshold and
// the `onRevise` provenance transition all went with it — see the note in
// `field-provenance.ts`.

import type { CareAssessment } from "@/lib/record/care-demo";
import type { CareSummaryDoc } from "@/lib/record/care-summary-doc";
import { tagLabel } from "@/lib/record/content-tags";

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

/** ═══ THE NOTES FOR ONE RECORD, DERIVED ═══
 *
 *  Null when there is no summary document — a record with no care history at
 *  all — and the disclosure is then HIDDEN rather than disabled: a control that
 *  cannot act is a question a reader has to answer before moving on, where an
 *  absent one asks nothing.
 *
 *  THE TWO FIELDS GET DIFFERENT NOTES, because they answer different questions.
 *  `clinical` is asked for the presentation and the period — engagement, themes,
 *  safety events. `diagnostic` is asked for the evidence behind the code —
 *  instrument, weighted score, band, which items carry it. Handing both fields
 *  the same bullets would be handing a supervisor one observation to paste
 *  twice, which is how two fields end up saying the same thing.
 *
 *  NOTHING HERE IS DIAGNOSTIC. No bullet names a code as a recommendation or
 *  concludes anything — the same rule the rail's `conversationSummary` carries,
 *  and for the same reason: the review flow diagnoses, this observes. A bullet
 *  that proposed a presentation would be a second opinion competing with the
 *  card above it. */
export function aiNotesFor(
  doc: CareSummaryDoc | null,
  /** The review's evidence, when there is a review. `count > 1` is a weighted
   *  period; `count === 1` is a single reading and is phrased as one, because
   *  "recency-weighted across 1 result" is a weighting of nothing. */
  evidence?: { score: number; severity: string; count: number; instrument?: string } | null
): AiNotes | null {
  if (!doc) return null;

  const clinical: string[] = [];
  const diagnostic: string[] = [];

  /* ═══ AN ABSENCE IS A FINDING, AND IS STATED ═══
     The first derivation only emitted bullets for data that existed, so a thin
     record produced one or two and was dropped below the floor — 18 of the
     roster's records got no notes at all, which is the same coverage hole the
     hand-written fixtures had. The rail does not hide these states; it prints
     "No conversation content is available for this window". So do these. */

  /* ── CONTACT AND CONTENT ─────────────────────────────────────────────
     ONE BULLET WHEN BOTH ARE ABSENT, not two. The first version emitted "No
     engaged days recorded in this window." and "No conversation content is
     available for this window." as separate bullets, and on a data-thin record
     that is two thirds of the set saying one thing. Seen in the rendered panel
     on t9, not in the diff. */
  const themes = doc.themes;
  const hasThemes = !!themes?.themes.length;
  if (doc.contactDays > 0)
    clinical.push(
      `${doc.contactDays} engaged ${doc.contactDays === 1 ? "day" : "days"} in this window.`
    );
  if (hasThemes) {
    /* HIGHEST FIRST, AT MOST TWO. A bullet per theme is the rail's frequency
       block copied into a textarea, and the rail renders that better. */
    for (const t of [...themes!.themes].sort((a, b) => b.days - a.days).slice(0, 2))
      clinical.push(
        `${tagLabel(t.tagId)} recurs on ${t.days} of ${themes!.conversationDays} engaged days.`
      );
  } else if (doc.contactDays > 0) {
    clinical.push("No conversation content is available for this window.");
  } else {
    clinical.push(
      "No engaged days or conversation content recorded in this window."
    );
  }

  /* ── THE PERIOD ITSELF ───────────────────────────────────────────────
     MOVED HERE FROM THE DIAGNOSTIC SET. The window is a fact about the period,
     which is what the clinical summary is asked for — and it is the third
     always-available observation that lets this field clear the floor on a
     thin record without two bullets restating one absence. */
  clinical.push(
    "This window covers the period since the last presentation update."
  );

  /* ── SAFETY ──────────────────────────────────────────────────────────── */
  const open = doc.flags.filter((f) => !f.resolved).length;
  clinical.push(
    !doc.flags.length
      ? "No risk flags were raised in this window."
      : `${doc.flags.length} risk ${doc.flags.length === 1 ? "flag" : "flags"} in this window` +
          (open ? `, ${open} still open.` : ", all resolved.")
  );

  /* ── TRAJECTORY, VERBATIM FROM THE DOCUMENT ──────────────────────────
     Not re-worded. The rail prints this exact sentence, and two phrasings of
     one trajectory is how a reader ends up comparing them for a difference
     that is not there. The fallback is the rail's own wording for the same
     state, for the same reason. */
  diagnostic.push(
    doc.trajectory ??
      "Not enough comparable readings in this window to state a direction."
  );

  /* ── THE EVIDENCE BEHIND THE CODE ────────────────────────────────────── */
  if (!evidence)
    diagnostic.push("No assessment results are on file for this window.");
  else if (evidence.count > 1)
    diagnostic.push(
      `Recency-weighted score across the last ${evidence.count} results is ` +
        `${evidence.score} — ${evidence.severity} band.`
    );
  else
    diagnostic.push(
      `A single ${evidence.instrument ?? "assessment"} result on file, ` +
        `scored ${evidence.score} — ${evidence.severity} band.`
    );

  /* ── THE CODE ON RECORD, AS A FACT AND NOT A PROPOSAL ────────────────
     "is the presentation on record", never "still fits" or "should change" —
     the second is the judgment the supervisor is being asked to make, and a
     note that made it for them would be the second opinion this file forbids.
     A test asserts no bullet reads as a proposal. */
  /* AND ITS ABSENCE IS ALSO A FACT. A record before its first presentation has
     no code to name, and saying so is both true and the thing that keeps this
     field above the floor there — t9, t12 and t3 lost their diagnostic
     disclosure entirely when this branch only fired for records that had one,
     which is the same "no notes, no control" hole this rewrite set out to
     close. Measured in the browser, after the change that caused it. */
  diagnostic.push(
    doc.currentCode
      ? `${doc.currentCode} is the presentation on record.`
      : "No presentation is on record for this window yet."
  );



  /* ═══ THE COUNT IS ENFORCED HERE, NOT HOPED FOR ═══
     `NOTES_MAX` trims; a set under `NOTES_MIN` is dropped rather than shown,
     because two bullets is not notes. Both sets now clear the floor for every
     record with a document — asserted, because that is the whole point of
     deriving them. */
  const trim = (xs: string[]) =>
    xs.length >= NOTES_MIN ? xs.slice(0, NOTES_MAX) : undefined;
  const out: AiNotes = {
    clinical: trim(clinical),
    diagnostic: trim(diagnostic),
  };
  return out.clinical || out.diagnostic ? out : null;
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
