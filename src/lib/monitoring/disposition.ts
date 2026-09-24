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
//
// ═══ AND ESCALATING IS AN ACTION, NOT A DISPOSITION (addendum §2.8) ═══
//
// `Escalate now` was a fourth value in this array with `effect: "escalate"`.
// It does not belong: a disposition is a STATEMENT ABOUT THE TEEN that a
// supervisor is recorded as having made, and "escalate" is a thing they DO.
// Putting it in the radiogroup meant the required question could be answered
// with a verb, and it meant escalating cost two interactions — pick the radio,
// then press the primary — on the path where under-escalation is the expensive
// error.
//
// It is a secondary button now, always enabled, never gated on the radiogroup.
// `DispositionEffect` loses its `escalate` arm with it.

import type { RiskFlagPayload } from "@/lib/tasks/types";

/** What a disposition DOES, which is the part the page has to branch on. */
export type DispositionEffect = "resolve" | "watch";

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

/** NEEDS-COPY-NICOLE. The inline guidance when somebody presses `Mark reviewed`
 *  with no disposition. Inline AT THE CONTROL — not a toast, which would be gone
 *  before a reader looked back at the thing it was about, and not a disabled
 *  button, which announces nothing and gives no reason. §2.8 is explicit that
 *  the primary is not disabled. */
export const DISPOSITION_REQUIRED_HINT = "Record a clinical disposition first.";

/** ═══ WHERE AXIS 2 DOES NOT BELONG (addendum §2.8) ═══
 *
 *  A user-reported flag had no classifier in it. Asking whether the classifier
 *  was right about a flag a PERSON raised is the same category error Phase 5
 *  removed from practice events: a question about a producer that did not
 *  produce this.
 *
 *  KEYED ON THE PAYLOAD'S OWN `reportedBy`, not on the absence of a rationale —
 *  a classifier flag with an empty rationale is a pipeline defect, and
 *  treating it as user-reported would hide that behind a missing control.
 *
 *  ═══ IT TAKES THE FIELD'S TYPE, AND THAT IS THE BUG THIS CAUGHT ═══
 *  The first version took a `string | null` and compared against
 *  `"user-report"` — a value `RiskFlagPayload.reportedBy` cannot hold, so the
 *  gate never fired and the axis rendered on the user-reported flag anyway.
 *  MEASURED by the probe, not by the compiler, because a wider parameter type
 *  is exactly what stops the compiler seeing it. Narrowed, so a future typo
 *  is a type error. */
export function asksAboutClassifier(
  reportedBy: RiskFlagPayload["reportedBy"] | null
): boolean {
  return reportedBy !== "user";
}

/** Does this disposition close the event? The single place the question is
 *  asked, so "recording classifier accuracy alone resolves nothing" is a
 *  property of the model rather than a rule each caller remembers. */
export function resolves(d: DispositionValue | null): boolean {
  return d?.effect === "resolve";
}

