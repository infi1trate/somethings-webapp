// ═══ HOW A FLAG REVIEW ENDS ═══
//
// ═══ THERE ARE TWO OUTCOMES TODAY AND A THIRD IS AN OPEN CLINICAL QUESTION ═══
//
// The pane asks "Was this flagged correctly?" and either answer resolves the
// item. The question is model feedback; it is not a gate, and "No" does not mean
// "leave it open".
//
// ARCHITECTURE PREAMBLE, OPEN QUESTION 1 — blocked on Dr. Nissan and Meg:
//
//   "Disposition taxonomy. Whether a third disposition ('seen, not resolved,
//    still watching') exists clinically, whether it documents, whether it
//    carries a re-review cadence. Do not build a third disposition. Build the
//    existing two-outcome resolve and leave a documented extension point."
//
// THIS FILE IS THAT EXTENSION POINT, and it is deliberately a type with two
// members rather than three with one commented out. A speculative third value
// would have to be handled at every switch — in the ledger payload, the row
// chip, the band count, the resolve path — and every one of those handlers would
// be a guess at a clinical decision nobody has made. An exhaustive union of two
// makes the compiler name every site the day a third arrives, which is the whole
// value of writing it down now.
//
// WHAT ADDING THE THIRD WILL ACTUALLY TOUCH, so the estimate is not a surprise:
//
//   · this union, and `DISPOSITION_RESOLVES` below
//   · `resolve.ts` — a disposition that does NOT resolve must not start an undo
//     window or write a closure event, so `resolveWithUndo` grows a branch
//   · `ledger.ts` — "still watching" is not `RISK_FLAG_CLOSED`; it needs its own
//     event type or it will read as a closure in the Activity record, which is
//     the one place this must not lie
//   · the pane footer — a third button, and the two-button layout has room
//   · `monitoringEntriesFor` — a watched flag stays in the list, so the surface
//     needs to say it has been seen, which is a row state that does not exist
//   · a re-review cadence, if it carries one, which is an SLA and belongs in
//     `sla.ts` rather than being invented at the call site
//
// None of that is built. All of it is named.

/** WHAT A SUPERVISOR DECIDED. The values are the ANSWER, not the button label:
 *  "Yes"/"No" are copy and will change; whether the model was right will not. */
export type FlagDisposition = "flaggedCorrectly" | "flaggedIncorrectly";

/** Does this disposition take the flag off the surface?
 *
 *  BOTH DO, TODAY, and that is the fact the third disposition would change —
 *  which is why this exists as a lookup rather than as `return true`. A caller
 *  that asks the question is a caller that keeps working; one that assumes the
 *  answer is a caller that silently closes a flag somebody meant to keep
 *  watching. */
export const DISPOSITION_RESOLVES: Record<FlagDisposition, boolean> = {
  flaggedCorrectly: true,
  flaggedIncorrectly: true,
};

export function dispositionFor(correct: boolean): FlagDisposition {
  return correct ? "flaggedCorrectly" : "flaggedIncorrectly";
}

/** The payload the ledger event carries. `flaggedCorrectly` stays a BOOLEAN on
 *  the wire because that is the shape already written into
 *  `RiskFlagPayload.flaggedCorrectly` and into every fixture; the enum is the
 *  vocabulary the UI and the resolve path reason in. Changing the wire shape
 *  would be a migration in service of a decision that has not been made yet. */
export function dispositionDetail(
  disposition: FlagDisposition
): { flaggedCorrectly: boolean } {
  return { flaggedCorrectly: disposition === "flaggedCorrectly" };
}
