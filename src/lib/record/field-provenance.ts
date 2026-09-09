// PER-FIELD AI PROVENANCE — the model behind "AI-assisted" on a committed
// care update.
//
// ═══ WHY THIS IS A MODULE AND NOT THREE `useState`s IN A FORM ═══
//
// The value it produces is written onto a committed clinical record and is
// IMMUTABLE once there. A form that got the transitions slightly wrong would
// stamp "written with AI assistance" onto a supervisor's own prose, or — worse
// in the other direction — record a verbatim model draft as authored. Neither
// is recoverable after commit, and neither is visible in review: both look like
// a correctly rendered chip.
//
// So the transitions live here, pure, and are asserted directly. The form calls
// them; it does not reimplement them.
//
// ═══ THE KNOWN LIMITATION, STATED VERBATIM ═══
//
// "Provenance is derived from in-form actions and content matching. Text pasted
// from the copy button or partial manual copying may register as `authored`.
// This is best-effort disclosure, not surveillance — the record documents AI
// facilitation the form performed, and the limitation must be stated wherever
// the contract is documented."
//
// That is not a caveat to be softened later. A reader of a record marked
// `authored` must understand it means "the form inserted nothing here", not
// "no model was involved". The two are different claims and only the first is
// one this product can make.

/** The three states, in increasing order of AI involvement. */
export type FieldProvenance = "authored" | "ai_inserted" | "ai_assisted";

/** ═══ THE STATE PLUS WHAT IT IS MEASURED AGAINST ═══
 *
 *  `insertedText` is the exact string the form last put into the field. It is
 *  what makes `ai_inserted` a claim about the CURRENT content rather than about
 *  a past event — without it, "unedited" is unverifiable. */
export interface FieldProvenanceState {
  readonly state: FieldProvenance;
  /** Null in `authored`, and retained after `ai_assisted` so the record can
   *  still say what was inserted if that is ever wanted. */
  readonly insertedText: string | null;
}

export const AUTHORED: FieldProvenanceState = {
  state: "authored",
  insertedText: null,
};

/** An Insert or a Replace. Either one makes the content the model's, exactly,
 *  which is `ai_inserted` regardless of what the field held before — a Replace
 *  over a supervisor's own paragraph is MORE AI involvement than an Insert into
 *  an empty field, not less. */
export function onInsert(text: string): FieldProvenanceState {
  return { state: "ai_inserted", insertedText: text };
}

/** ═══ THE EDIT TRANSITION IS ONE-WAY ═══
 *
 *  `ai_inserted` -> `ai_assisted` on the first edit that actually changes the
 *  text, and never back. A supervisor who types a word and deletes it has
 *  touched model prose and formed a view about it; restoring the exact
 *  characters does not restore the state, because the state is about what
 *  happened and not only about what the field currently holds.
 *
 *  `authored` IS ALSO TERMINAL under editing. A field that never received an
 *  insertion stays authored however much it is edited, and viewing or copying a
 *  draft does not move it — the pack is explicit, and it is the honest reading:
 *  the form did not put anything there.
 *
 *  A NO-OP CHANGE IS NOT AN EDIT. React fires change events that do not change
 *  the string (a paste of identical text, some IME commits), and treating those
 *  as edits would flip a verbatim insertion to "assisted" without a keystroke. */
export function onEdit(
  prev: FieldProvenanceState,
  nextText: string
): FieldProvenanceState {
  if (prev.state !== "ai_inserted") return prev;
  if (nextText === prev.insertedText) return prev;
  return { state: "ai_assisted", insertedText: prev.insertedText };
}

/* ═══ `onRevise` IS GONE, WITH "IMPROVE MY DRAFT" ═══
   It was the third transition: taking a model's revision of your OWN sentences
   recorded `ai_assisted` rather than `ai_inserted`, because the content was the
   author's and calling it an unedited model draft would have been a false
   statement on a clinical record. That distinction mattered only while a control
   existed to produce a revision, and it does not any more.
   WHAT REMAINS REACHABLE: `authored` → `ai_inserted` (notes taken into the
   field) → `ai_assisted` (the author edits them). `ai_assisted` therefore now
   means exactly one thing — model text a person revised — where it used to mean
   that OR the author's text a model revised. The read surfaces say "written with
   AI assistance", which is true of both, so no copy changed. */

/** Whether the record should disclose anything at all. `authored` discloses
 *  NOTHING — there is no "human-written" badge, because absence is the default
 *  state and a badge on it would imply the others are exceptions. */
/** A TYPE PREDICATE, not a bare boolean — so a caller that has checked this can
 *  then index a record keyed only on the two disclosing states without a cast.
 *  The `PROVENANCE_DETAIL` map in `field-provenance-note.tsx` is exactly that
 *  caller, and a cast there would have been a cast that silently survives a
 *  fourth state being added. */
export function discloses(
  state: FieldProvenance
): state is Exclude<FieldProvenance, "authored"> {
  return state !== "authored";
}

/** TODO-COPY, all three. The `authored` entry is deliberately empty: nothing
 *  renders for it, and a string here would invite one to. */
export const PROVENANCE_PHRASE: Record<FieldProvenance, string> = {
  authored: "",
  ai_inserted: "AI notes inserted, unedited",
  ai_assisted: "written with AI assistance",
};
