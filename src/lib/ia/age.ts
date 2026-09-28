// ═══════════════════════════════════════════════════════════════════════════
// ONE AGE EXPRESSION (Today rebuild, Phase K.2)
//
// ═══ WHAT THIS CLOSES ═══
//
// K.2 reported the same item carrying two ages on two surfaces: Today said
// "oldest 3d ago" and Care Reviews said "2d oldest". Phase A unified COUNTS
// across nav and Today and never covered AGES, so the rationale, the
// destination card, the preview row and the destination's own header each
// derived one.
//
// The rendered divergence is already closed — `ageOf` rounded where
// `elapsedLabel` floors, and `ageOf` now floors. THAT IS NOT ENOUGH, and the
// reason is the one `open-counts.ts` states about counts: two expressions that
// agree by accident are worse than two that disagree, because nothing fails
// while the accident holds. Both had their own arithmetic and produced the same
// string; the next edit to either would have reopened it silently.
//
// So there is one function and everything reads it.
//
// ═══ THE ROUNDING RULE, STATED ONCE ═══
//
// FLOOR, at every step. A 2.6-day item is "2d", never "3d".
//
// Rounding OVERSTATES an age — measured, `Math.round` called a 36-hour item
// "2d" and a 60-hour item "3d" — and on a queue a supervisor reads as a backlog,
// claiming work is older than it is is the worse of the two errors. Floor also
// means the number only ever grows, so an item never appears to get younger as
// a boundary is approached from the other side.
//
// ═══ WHY THE SET IS A PARAMETER AND NOT A DESTINATION ═══
//
// `oldestAgeLabel` takes the items rather than a `DestinationId`, because the
// two surfaces deliberately measure different sets and that is not a defect:
// Care Reviews' header is FILTER-AWARE and says so ("open · filtered"), so its
// oldest is over the filtered list, while Today's card is the unfiltered
// destination total. One label expression, two sets, each stated at its call
// site — rather than one expression that has to know about the other surface's
// filter state.

/** ═══ THE ITEM-AGE FORMATTER ═══
 *  Elapsed time as a bare figure — "9m", "6h", "3d". No "ago": the callers that
 *  want it append it, because a row's age column reads as a column and a
 *  sentence needs the preposition.
 *
 *  THIS IS THE FUNCTION `elapsedLabel` WAS. It moved out of `strips.tsx` — a
 *  component file that `lib/` could not import from without inverting the
 *  dependency — so that Today's library code and the row components can share
 *  it rather than each restating the arithmetic. `strips.tsx` re-exports it, so
 *  every existing import still resolves. */
export function elapsedLabel(openedAt: number, now: number): string {
  const ms = Math.max(0, now - openedAt);
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** The same figure with the preposition, for prose: "3d ago". */
export function elapsedAgo(openedAt: number, now: number): string {
  return `${elapsedLabel(openedAt, now)} ago`;
}

/** The oldest instant in a set, or null for an empty one.
 *
 *  NULL IS NOT ZERO. An empty list has no oldest item, which the header renders
 *  as an em dash rather than "0d" — there being no oldest review is a different
 *  fact from one that is zero days old. */
export function oldestAt(items: readonly { at: number }[]): number | null {
  if (items.length === 0) return null;
  let min = items[0].at;
  for (const i of items) if (i.at < min) min = i.at;
  return min;
}

/** The oldest item's age in a set, as a bare figure. Null for an empty set. */
export function oldestAgeLabel(
  items: readonly { at: number }[],
  now: number
): string | null {
  const at = oldestAt(items);
  return at == null ? null : elapsedLabel(at, now);
}

/** The oldest item's age with the preposition, for prose. Null for an empty set. */
export function oldestAgeAgo(
  items: readonly { at: number }[],
  now: number
): string | null {
  const at = oldestAt(items);
  return at == null ? null : elapsedAgo(at, now);
}
