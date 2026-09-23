// ═══ TWO AXES, NOT ONE QUESTION ═══
//
// The control this replaces asked "Was this flagged correctly?" with No / Yes,
// and styled Yes as primary. That conflated two unrelated judgments — whether
// the classifier was right, and what should happen to the teen — and on a
// self-harm-language flag it produced a one-tap path to closure that recorded no
// clinical judgment at all. Agreeing with a model is not a disposition.
//
// So: a required clinical disposition, and an optional, de-emphasised note about
// whether the classifier was right. The second never resolves anything.

/** What a disposition DOES, which is the part the page has to branch on. */
export type DispositionEffect = "resolve" | "watch" | "escalate";

export interface DispositionValue {
  id: string;
  /** NEEDS-COPY-NICOLE — every label here is invented and every one of them is
   *  a clinical statement a supervisor is recorded as having made. */
  label: string;
  /** The one-line consequence, shown at the control so the reader knows what the
   *  button does before pressing it rather than from a toast afterwards. */
  consequence: string;
  effect: DispositionEffect;
  /** True for the value whose clinical existence is the open question. */
  unresolvedQuestion?: boolean;
}

/** ═══ BLOCKED · Dr. Nissan ═══
 *
 *  The clinical values themselves, including the unresolved question of whether a
 *  third "seen, not resolved, still watching" state exists clinically — it is
 *  included here, flagged, because building the surface without it and adding it
 *  later is a different control; if it does not exist, deleting one entry from
 *  this array is the whole change.
 *
 *  EVERY CONSUMER READS THIS ARRAY. Nothing on the surface hardcodes a label, a
 *  count or an order, so answering this question is one edit in one file. */
export const DISPOSITION_VALUES: readonly DispositionValue[] = [
  {
    id: "no-concern",
    label: "No clinical concern",
    consequence: "Closes the event with your judgment on the record.",
    effect: "resolve",
  },
  {
    id: "support-in-place",
    label: "Support already in place",
    consequence: "Closes the event and records that care is ongoing.",
    effect: "resolve",
  },
  {
    /* THE OPEN QUESTION. A state that neither closes nor escalates is either the
       most useful value here or a way to leave work in limbo, and that is a
       clinical call. */
    id: "watching",
    label: "Watching — not resolved",
    consequence: "Keeps the event open and records that you have seen it.",
    effect: "watch",
    unresolvedQuestion: true,
  },
  {
    /* ═══ THE PATH THE OLD CONTROL DID NOT HAVE ═══
       A flag that turns out to be a crisis must become an escalation RECORD, not
       a closed flag with a note. It does not resolve: resolving would file the
       event as handled at the moment it stopped being handled. */
    id: "escalate",
    label: "Escalate now",
    consequence: "Opens an escalation record. Does not close this event.",
    effect: "escalate",
  },
];

export function dispositionById(id: string | null): DispositionValue | null {
  if (id == null) return null;
  return DISPOSITION_VALUES.find((d) => d.id === id) ?? null;
}

/** ═══ AXIS 2 · CLASSIFIER ACCURACY ═══
 *  Optional, never pre-selected, never primary-styled, never a gate. It is
 *  model feedback, and the open product question (§8.3) about where that
 *  feedback goes — pipeline, audit log, or both — is unchanged by this phase. */
export interface AccuracyValue {
  id: string;
  /** NEEDS-COPY-NICOLE. Deliberately about the CLASSIFIER, not about agreement:
   *  "Yes" invited a reader to agree with a model rather than judge its output. */
  label: string;
}

export const ACCURACY_VALUES: readonly AccuracyValue[] = [
  { id: "accurate", label: "Classifier was right" },
  { id: "inaccurate", label: "Classifier was wrong" },
];

/** NEEDS-COPY-NICOLE. The inline guidance when somebody tries to resolve with no
 *  disposition. Inline AT THE CONTROL — not a toast, which would be gone before
 *  a reader looked back at the thing it was about, and not a disabled button,
 *  which announces nothing and gives no reason. */
export const DISPOSITION_REQUIRED_HINT = "Record a clinical disposition first.";

/** Does this disposition close the event? The single place the question is
 *  asked, so "recording classifier accuracy alone resolves nothing" is a
 *  property of the model rather than a rule each caller remembers. */
export function resolves(d: DispositionValue | null): boolean {
  return d?.effect === "resolve";
}

// ═══════════════════════════════════════════════════════════════════════════
// AXIS 1, FOR A MENTOR PRACTICE EVENT — a second vocabulary (Phase 8)
//
// ═══ WHY NOT THE CLINICAL ONE ═══
//
// Gap row 421: `/app/mentor-practice` asked for a "Clinical disposition ·
// required" and offered `No clinical concern` / `Support already in place` /
// `Watching — not resolved` / `Escalate now` — on an event that is a mentor
// missing a video-note deadline. Every one of those is, in this file's own
// words, "a clinical statement a supervisor is recorded as having made" about a
// TEEN. Nobody asked a clinical question, and the axis compelled an answer to
// one before the event could close.
//
// It was not a labelling problem. `Escalate now` opens an escalation RECORD —
// a teen-safety incident with a five-minute acknowledgement clock — which is the
// wrong object entirely for "this mentor has missed three note deadlines".
//
// ═══ WHAT A SUPERVISOR CAN HONESTLY RECORD HERE ═══
//
// The event is a timing FACT: a timestamp compared to a published constant. What
// the supervisor decides is what to do about it, and there are three answers:
//
//  · THE RULE DID NOT APPLY. Every one of the five constants carries a
//    `_PROVISIONAL` flag, and the rules cannot see PTO, an unreachable teen, or
//    a shift swapped with somebody. Without this value a supervisor would have
//    to record having spoken to a mentor who did nothing wrong in order to clear
//    the row.
//  · IT WAS RAISED WITH THE MENTOR. The ordinary close.
//  · IT IS A PATTERN. Which does NOT close: noticing a pattern is not resolving
//    one, and the same reasoning that stops `escalate` resolving a flag applies.
//
// ═══ AND NO SCORE COMES OUT OF THIS ═══
//
// The standing rule is that a fabricated practice assessment feeding mentor
// coaching is worse than an absent one. These values are safe under it because
// each records what the SUPERVISOR did, against a fact that was deterministically
// computed — not a judgment of the mentor. Nothing may aggregate them: "3 raised
// this week" over a named mentor would be exactly the performance surface the
// rule forbids, assembled out of honest parts.

export type PracticeEffect = "close" | "pattern";

export interface PracticeDispositionValue {
  id: string;
  /** NEEDS-COPY-NICOLE. Every label is a statement a supervisor is recorded as
   *  having made about their own action. */
  label: string;
  /** Shown at the control, so the reader knows what the button does before
   *  pressing it rather than from a toast afterwards. */
  consequence: string;
  effect: PracticeEffect;
  /** True where the VALUE is settled but what it routes to is not. */
  unresolvedRouting?: boolean;
}

export const PRACTICE_DISPOSITION_VALUES: readonly PracticeDispositionValue[] = [
  {
    id: "rule-did-not-apply",
    label: "Rule didn't apply here",
    consequence:
      "Closes the event and records that the timing fact had a reason the rule cannot see.",
    effect: "close",
  },
  {
    id: "raised-with-mentor",
    label: "Raised with the mentor",
    consequence: "Closes the event and records that you spoke to them.",
    effect: "close",
  },
  {
    /** ═══ BLOCKED · ROUTING, NOT THE VALUE ═══
     *  A pattern belongs with the mentor's LEAD, and there is no lead-mentor
     *  object to route it to — no record, no queue, no notification. So the
     *  value keeps the event open and says so, rather than closing it into
     *  nothing or pretending a hand-off happened. The moment a lead surface
     *  exists this is one line and no new control. */
    id: "pattern-for-lead",
    label: "Pattern — for their lead",
    consequence:
      "Keeps the event open. Nothing routes to a lead mentor yet, so this records the judgment and not a hand-off.",
    effect: "pattern",
    unresolvedRouting: true,
  },
];

export function practiceDispositionById(
  id: string | null
): PracticeDispositionValue | null {
  if (id == null) return null;
  return PRACTICE_DISPOSITION_VALUES.find((d) => d.id === id) ?? null;
}

/** Does this practice disposition close the event? One place, so "noticing a
 *  pattern is not resolving one" is a property of the model. */
export function practiceCloses(d: PracticeDispositionValue | null): boolean {
  return d?.effect === "close";
}

// ═══ AXIS 2, FOR A MENTOR PRACTICE EVENT — the RULE, not a classifier ═══
//
// The flag queue's second axis asks whether the classifier was right. A practice
// event has no classifier: the five rules are deterministic comparisons, which
// is why Phase 5 removed the classifier axis from this destination entirely.
//
// ═══ BUT THERE IS A SECOND QUESTION HERE, AND IT IS A BETTER ONE ═══
//
// Every constant these rules read is PROVISIONAL —
// `MENTOR_ONLINE_HOURS_PROVISIONAL`, `MENTOR_OUTREACH_CUTOFF_PROVISIONAL`,
// `MENTOR_TEEN_RESPONSE_SLA_PROVISIONAL`,
// `MENTOR_LEADERSHIP_RESPONSE_SLA_PROVISIONAL`. A supervisor is the only person
// who sees these rules fire against real shifts, so whether the THRESHOLD is
// right is the one piece of feedback this surface can collect that nothing else
// can.
//
// IT IS NOT THE SAME QUESTION AS AXIS 1. "Rule didn't apply here" is about this
// instance — a mentor on PTO. "Rule fired wrongly" is about the constant — a
// 90-minute outreach cutoff that trips every mentor every day. Conflating them
// would lose the only signal that could un-provisional a number.
//
// OPTIONAL, NEVER PRE-SELECTED, NEVER PRIMARY, NEVER A GATE — the same posture
// as classifier accuracy, for the same reason: it resolves nothing.
export interface RuleFeedbackValue {
  id: string;
  /** NEEDS-COPY-NICOLE. About the RULE, not the mentor and not this instance. */
  label: string;
}

export const RULE_FEEDBACK_VALUES: readonly RuleFeedbackValue[] = [
  { id: "threshold-right", label: "Threshold looks right" },
  { id: "threshold-wrong", label: "Threshold looks wrong" },
];

/** NEEDS-COPY-NICOLE. The inline guidance when somebody tries to record with no
 *  disposition. Separate from the clinical one because it names a different
 *  axis, and a shared string would drift into naming neither. */
export const PRACTICE_DISPOSITION_REQUIRED_HINT =
  "Record what you did about this first.";
