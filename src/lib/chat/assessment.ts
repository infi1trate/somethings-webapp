// THE GUIDED ASSESSMENT — what to ask, in what order.
//
// ═══ WHY IT IS SCRIPTED AND NOT A FREE-TEXT BOX ═══
//
// A mentor who has just read "i don't know how much longer i can keep doing this"
// is not in a state to compose an assessment. They are frightened, they are
// twenty-three, and the thing they need is not a blank field — it is somebody
// telling them what to ask next.
//
// So the steps are written down, in order, and the mentor's job is to work through
// them rather than to remember them. That is the difference between a form and a
// protocol.
//
// ═══ THE ORDER IS THE PRODUCT ═══
//
// Safety first, then means, then support, then plan. Not because it makes a tidy
// list — because asking "do you have a plan" before "are you safe right now" is
// the wrong order to ask a frightened teenager in, and a mentor reading top to
// bottom should not have to know that.
//
// ═══ WHAT THIS IS NOT ═══
//
// NOT A RISK SCORE. There is no total, no threshold and no colour that changes as
// boxes are ticked, deliberately: a number would invite a mentor to decide whether
// this is "bad enough", and that is not a judgement this surface asks them to make.
// Every escalation has already notified a supervisor by the time the assessment
// opens. The checklist records what was covered; it does not adjudicate.
//
// NOT A DIAGNOSIS, and none of the wording invites one. "Are they safe right now"
// is an observation a mentor can make. "Are they suicidal" is not, and it is not
// their question to answer.
//
// TODO-COPY on every string, and this file needs clinical review before it is
// anything other than a prototype's placeholder — noted at the export.

export interface AssessmentStep {
  id: string;
  /** What the mentor asks, or checks. Phrased as the mentor's own question so it
   *  can be read aloud without translation. */
  prompt: string;
  /** Why this step is here, one line. Present because a mentor who understands the
   *  reason asks the question better than one following a list. */
  why: string;
  /** Optional wording help — the actual sentence, for a mentor who cannot find
   *  their words. This is the field that matters most at 2am. */
  say?: string;
}

/** ═══ TODO-CLINICAL ═══
 *
 *  This script is a PLACEHOLDER written to demonstrate the interaction, not a
 *  validated protocol. It needs review by someone qualified before it is put in
 *  front of a real mentor — the ordering, the wording, and above all the decision
 *  about what a mentor should NOT be asked to assess. Logged as
 *  design-system-gaps.md row 357. */
export const ASSESSMENT: AssessmentStep[] = [
  {
    id: "safe-now",
    prompt: "Are they safe right now?",
    why: "Everything else waits on this one.",
    say: "I want to make sure you're okay right now. Are you somewhere safe?",
  },
  {
    id: "alone",
    prompt: "Is anyone with them?",
    why: "Being alone changes what happens next, and it is quick to ask.",
    say: "Is there anyone else at home with you right now?",
  },
  {
    id: "means",
    prompt: "Have they said anything about how?",
    why: "If they have, a supervisor needs to know before they do anything else.",
    say: "Have you thought about how you'd do it?",
  },
  {
    id: "adult",
    prompt: "Is there an adult they trust who knows?",
    why: "Names the person who can be there in a way you cannot.",
    say: "Is there a grown-up you trust who knows how you've been feeling?",
  },
  {
    id: "staying",
    prompt: "Have you told them you're staying with them?",
    why: "The one thing a mentor can offer immediately, and the easiest to forget.",
    say: "I'm not going anywhere. I'm here.",
  },
];

/** How many steps have been checked. Used for the banner's progress line — a
 *  count, never a score. See the module note on why there is no total. */
export function checkedCount(
  assessment: Record<string, { checked: boolean; at: number }>
): number {
  return ASSESSMENT.filter((s) => assessment[s.id]?.checked).length;
}

/** TODO-COPY. "2 of 5 covered". Not "40% complete" and not "3 remaining" — the
 *  first is a score and the second is a demand. */
export function assessmentProgress(
  assessment: Record<string, { checked: boolean; at: number }>
): string {
  return `${checkedCount(assessment)} of ${ASSESSMENT.length} covered`;
}
