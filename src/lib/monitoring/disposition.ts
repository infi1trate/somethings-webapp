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

