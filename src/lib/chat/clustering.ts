// ═══════════════════════════════════════════════════════════════════════════
// WHEN A MESSAGE NEEDS ITS OWN NAME AND TIME — one rule, two surfaces
//
// ═══ THE RULE ═══
//
// A message gets its own name-and-time header when the SPEAKER changed, or when
// enough time passed that the gap is itself information. Five minutes: short
// enough that a real pause in a conversation shows, long enough that a burst of
// consecutive messages stays one block.
//
// The cost of getting it wrong is specific and was learned on the supervisor
// excerpt first: a transcript that heads every bubble reads as twice as many
// events as it contains, and a hesitant sentence sent in two parts looks like
// two separate disclosures.
//
// ═══ WHY THIS FILE EXISTS (Phase 6) ═══
//
// The rule was implemented twice — `needsMeta` in `chat/thread/message-bubble.tsx`
// for the mentor's thread, and `needsHeader` in `tasks/conversation-excerpt.tsx`
// for the supervisor's excerpt — each with its own `const CLUSTER_MS = 5 * 60_000`.
// The mentor copy's own comment pointed at the other one ("the same rule and the
// same constant as the Tasks pane's conversation excerpt"), which is a fork
// documenting itself rather than a fork nobody noticed.
//
// TWO CONSTANTS FOR ONE CLINICAL THRESHOLD is the part that matters. Five minutes
// is a judgment about how a teen's messages should be grouped when somebody is
// reading them for risk; if it is ever revised, it must be revised once. A repo
// where the supervisor's transcript clusters at five minutes and the mentor's at
// six would have two different accounts of the same conversation, and nothing
// would fail.
//
// ═══ WHAT IS NOT SHARED, AND WHY THAT IS NOT A FORK ═══
//
// The excerpt ALSO breaks a cluster at the flagged message. That is not a
// different clustering rule — it is an additional reason this surface needs a
// header, because the anchor is the line the whole pane is about and it must be
// attributable on sight even if it happens to be the third message of a burst.
// So the shared predicate answers "does the cluster break here", and the excerpt
// layers its own reason on top of the answer rather than reimplementing it.
//
// ═══ THE MENTOR'S RENDERED OUTPUT DOES NOT CHANGE ═══
//
// A hard constraint on this de-fork, and `startsCluster` is written to make it
// trivially true: the predicate is `needsMeta`'s three branches in the same
// order, so the mentor thread's DOM is byte-identical across the change. It was
// captured before and after and compared, not reasoned about.

/** The clustering threshold. ONE definition — see the module note. */
export const CLUSTER_MS = 5 * 60_000;

/** The minimum a message has to be for the rule to apply to it. Deliberately
 *  structural rather than either surface's message type: both have a sender and
 *  an instant, and nothing about clustering needs anything else. Taking the
 *  narrowest shape is also what stops this file growing a dependency on either
 *  surface's model. */
export interface Clusterable {
  sender: string;
  at: number;
}

/**
 * Does a new cluster start at `m`?
 *
 * `prev === undefined` is the first message, which always starts one — there is
 * nothing above it to attribute it to.
 */
export function startsCluster(
  m: Clusterable,
  prev: Clusterable | undefined
): boolean {
  if (!prev) return true;
  if (m.sender !== prev.sender) return true;
  return m.at - prev.at > CLUSTER_MS;
}
