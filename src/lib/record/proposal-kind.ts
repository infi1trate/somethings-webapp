// ═══ WHICH OF THE THREE PROPOSALS A REVIEW IS MAKING ═══
//
// ═══ THREE STATES, NOT TWO, AND THE HISTORY IS WHY THIS IS A FUNCTION ═══
//
// It was once a boolean — `currentCode !== recommended.code` — and a record with
// NOTHING on record satisfies it: `null !== "F43.22"` is true, so a first-ever
// review wore "Change proposed → F43.22" beside a header already reading F43.22,
// a change from nothing to something with the same code on both sides of the
// arrow. The codebase already modelled three outcomes elsewhere (`outcomeFor` in
// `care-tab.tsx` returns `presentation_assigned` on exactly this null branch);
// the chip was the one place that collapsed them to two.
//
// ═══ WHY IT IS SHARED, AS OF arch-E ═══
//
// The derivation lived INLINE inside `ReviewBody` and was reachable nowhere
// else. arch-E's Tasks row needs it too — the row previews the weight of the
// decision before a supervisor opens it, because a renewal is a twenty-second
// confirm and a proposed change needs thought — and a second comparison written
// at the row would be a second place for "which case is this" to be answered.
// A row labelled differently from the pane it opens is the specific failure this
// prevents.
//
// It has been shared before and lost: `proposalKindFor` was exported from
// `presentation-diff.tsx`, which was deleted when the Tasks pane adopted
// `ReviewBody`. This is the same function, in a home that is not a component.
//
// ═══ KEYED ON THE CODE ALONE, DELIBERATELY ═══
//
// A re-worded statement under the same code is a RENEWAL of that code — the
// billable fact has not changed — and calling it a change would put the
// attention chip on a copy edit.
//
// ═══ THE MODEL'S PROPOSAL, NEVER THE SUPERVISOR'S DRAFT ═══
//
// Callers pass the RECOMMENDED code, not whatever is currently picked. The chip
// and the row both describe what is being PROPOSED; once a supervisor has chosen
// something else the pane hands the slot over to a revert link entirely, because
// "Renewal proposed" is false the moment they have proposed something different.

export type ProposalKind = "assign" | "change" | "renewal";

export function proposalKindFor(
  currentCode: string | null | undefined,
  recommendedCode: string
): ProposalKind {
  if (currentCode == null) return "assign";
  return currentCode === recommendedCode ? "renewal" : "change";
}

/** TODO-COPY, all three — and Nicole gets ONE set to approve rather than two.
 *
 *  ═══ arch-E ASKED FOR "First assignment" AND THIS SAYS "Presentation proposed" ═══
 *
 *  Deliberate, and the reason is the phase's own scope: the detail pane is out of
 *  bounds, so its chip keeps saying "Presentation proposed". A row reading "First
 *  assignment" beside a pane reading "Presentation proposed" would be two
 *  vocabularies for one judgement on one screen — the exact defect arch-B spent a
 *  commit removing when the tiers had four names between them.
 *
 *  So the row reads from this table and the pane's own words win. If "First
 *  assignment" is the better phrase, it is a one-line change HERE that moves both
 *  surfaces at once, which is the point of the table existing.
 *
 *  "PROPOSED", NOT "ASSIGNED", on the first case: nothing has been assigned yet —
 *  the review IS the proposal, and the parallel with the other two says so. */
export const PROPOSAL_LABEL: Record<ProposalKind, string> = {
  assign: "Presentation proposed",
  change: "Change proposed",
  renewal: "Renewal proposed",
};

/** The full preview line for a list row: the label, plus the code a change is
 *  changing TO. Only `change` has a second code to point at — a renewal's codes
 *  are the same value and a first assignment has nothing on the other side, so an
 *  arrow on either would be a diagram of nothing. */
export function proposalPreview(
  currentCode: string | null | undefined,
  recommendedCode: string
): string {
  const kind = proposalKindFor(currentCode, recommendedCode);
  return kind === "change"
    ? `${PROPOSAL_LABEL.change} → ${recommendedCode}`
    : PROPOSAL_LABEL[kind];
}
