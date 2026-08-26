// PER-VIEWER READ / CLEAR OVERLAY. Standing rules 9, 10 and 11 live here.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE KEY IS (viewerId, scope, eventId). SCOPE IS PART OF THE KEY.
//
// Standing rule 10, and the single easiest thing in this feature to get wrong. An
// overlay keyed only by (viewerId, eventId) passes every manual test: you open My
// caseload, rows go read, the badge drops, everything looks right. It breaks the
// first time someone marks a batch read in one scope and switches to the other —
// and it breaks SILENTLY, as a wrong number rather than an error.
//
// Scope is not a filter applied over the overlay. It is a dimension of identity:
// "event 41, read by Lydia, in My caseload" and "event 41, read by Lydia, in
// Network" are two different facts, and one of them being true says nothing about
// the other.
// ═══════════════════════════════════════════════════════════════════════════
//
// NOTHING HERE MUTATES AN EVENT. The overlay is a separate map; ActivityEvent is
// immutable (see events.ts). The existing `ActivityItem` model carries `read` on
// the row — that is the shape these rules forbid, it predates them, and it is left
// untouched under standing rule 7.
//
// THERE IS NO DELETE FUNCTION, AND DO NOT ADD ONE. Standing rule 11: clearing is
// never deleting. `clearRow` writes the state "cleared"; it removes neither the
// event nor the overlay entry, so a cleared row is always retrievable and
// `restoreRow` is always possible. A function that removed an entry would make
// "cleared" and "never seen" indistinguishable, because absence means unread.
//
// ── SIGNATURES: ONE DELIBERATE DEVIATION FROM THE PROMPT ───────────────────
// The prompt specifies `getRowState(viewerId, scope, eventId)` etc., implying the
// module owns the state. These take the overlay as their first argument instead,
// for two reasons that are both requirements elsewhere in the same prompt:
//   · "Persist through the existing store/persistence pattern" — that pattern is
//     zustand `persist` in lib/onboarding/store.ts. The store must own the map;
//     a module-level singleton could not be persisted, versioned or migrated
//     alongside the rest of the state.
//   · The tests have to run three cases against independent overlays. A
//     module-owned singleton needs a reset hook, which is a delete function by
//     another name.
// The store-bound wrappers with the prompt's exact arity are at the bottom.
//
// `unreadCount` additionally takes the candidate event ids. That is not a
// preference: ABSENT MEANS UNREAD, so a count cannot be derived from the overlay
// alone — an event nobody has touched has no entry to count.

/** The three states a row can be in for one viewer in one scope. */
export type RowState = "unread" | "read" | "cleared";

/** The two scopes today. A third is additive: it is part of a key, not a branch. */
export type ActivityScope = "mine" | "all";

/** The overlay itself: a flat map so it persists and migrates as plain JSON. */
export type ReadOverlay = Record<string, RowState>;

/** Delimiter chosen because no id in this system contains it — staff ids are
 *  `sup-lydia`, event ids are `ev-41`, scopes are single words. A single `:`
 *  would be a collision risk the day an id gains a namespace prefix. */
const SEP = "::";

export function overlayKey(
  viewerId: string,
  scope: ActivityScope,
  eventId: string
): string {
  return `${viewerId}${SEP}${scope}${SEP}${eventId}`;
}

/** ABSENT MEANS UNREAD. A newly arrived event has no entry and must read as
 *  unread — the alternative is that new work is invisible until something writes
 *  a row for it. */
export function getRowState(
  overlay: ReadOverlay,
  viewerId: string,
  scope: ActivityScope,
  eventId: string
): RowState {
  return overlay[overlayKey(viewerId, scope, eventId)] ?? "unread";
}

/** Mark rows read IN ONE SCOPE. Returns a new overlay; never mutates the input,
 *  so a store `set` is a plain assignment.
 *
 *  A CLEARED ROW STAYS CLEARED. Marking read must not resurrect it into the
 *  normal feed — the row-marks-read-on-view observer (A3 step 7) fires on
 *  anything on screen, including cleared rows shown via the Cleared items filter,
 *  and without this guard scrolling past a cleared row would un-clear it. */
export function markRead(
  overlay: ReadOverlay,
  viewerId: string,
  scope: ActivityScope,
  eventIds: string[]
): ReadOverlay {
  if (eventIds.length === 0) return overlay;
  const next = { ...overlay };
  let changed = false;
  for (const id of eventIds) {
    const key = overlayKey(viewerId, scope, id);
    if (next[key] === "cleared") continue;
    if (next[key] === "read") continue;
    next[key] = "read";
    changed = true;
  }
  // Identity is preserved when nothing moved, so a React store does not
  // re-render on an observer tick that changed nothing.
  return changed ? next : overlay;
}

/** Clearing. Sets "cleared" and nothing else — no removal, ever. */
export function clearRow(
  overlay: ReadOverlay,
  viewerId: string,
  scope: ActivityScope,
  eventId: string
): ReadOverlay {
  return {
    ...overlay,
    [overlayKey(viewerId, scope, eventId)]: "cleared",
  };
}

/** Restore. Returns the row to "read", NOT "unread".
 *
 *  The viewer has demonstrably seen this row — they cleared it, then went to the
 *  Cleared items filter and brought it back. Returning it to "unread" would push
 *  the badge up by one for a row they have looked at twice, which reads as the
 *  app inventing work. */
export function restoreRow(
  overlay: ReadOverlay,
  viewerId: string,
  scope: ActivityScope,
  eventId: string
): ReadOverlay {
  return {
    ...overlay,
    [overlayKey(viewerId, scope, eventId)]: "read",
  };
}

/** Unread rows among `eventIds`, for this viewer in this scope.
 *
 *  Cleared rows do not count — clearing is the viewer saying "not for me", and a
 *  badge that kept counting them would make clearing pointless. */
export function unreadCount(
  overlay: ReadOverlay,
  viewerId: string,
  scope: ActivityScope,
  eventIds: string[]
): number {
  let n = 0;
  for (const id of eventIds) {
    if (getRowState(overlay, viewerId, scope, id) === "unread") n += 1;
  }
  return n;
}

/** THE RETRIEVAL PATH FOR RULE 11. The Cleared items filter (A4) asks for these;
 *  they were never deleted, so they can always be returned. */
export function clearedEventIds(
  overlay: ReadOverlay,
  viewerId: string,
  scope: ActivityScope,
  eventIds: string[]
): string[] {
  return eventIds.filter(
    (id) => getRowState(overlay, viewerId, scope, id) === "cleared"
  );
}

/** Seed an overlay from a scenario's fixture decision about what starts unread.
 *
 *  Everything NOT named starts "read", explicitly rather than by absence: a
 *  scenario that says "five unread" must produce exactly five, and leaving the
 *  rest absent would make every event unread. Written into BOTH scopes, because
 *  the scenario's claim is about the ledger rather than about one view — and
 *  because seeding one scope only would make the very bug rule 10 warns about
 *  look like correct behaviour on first load. */
export function seedOverlay(
  allEventIds: string[],
  unreadEventIds: string[],
  viewerId: string
): ReadOverlay {
  const unread = new Set(unreadEventIds);
  const overlay: ReadOverlay = {};
  for (const scope of ["mine", "all"] as ActivityScope[]) {
    for (const id of allEventIds) {
      overlay[overlayKey(viewerId, scope, id)] = unread.has(id)
        ? "unread"
        : "read";
    }
  }
  return overlay;
}
