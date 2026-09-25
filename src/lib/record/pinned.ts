// ═══════════════════════════════════════════════════════════════════════════
// A SUPERVISOR'S PRIVATE WORKING SET (Today Phase E)
//
// ═══ WHAT PINNING IS, AND WHAT IT IS EMPHATICALLY NOT ═══
//
// It is one supervisor's shortlist of mentees they are keeping an eye on this
// week. A working set, not a roster. E.7: "not a clinical designation, is not visible to mentors or mentees,
// and does not appear on the mentee record for anyone else."
//
// THAT IS A CONSTRAINT ON WHERE THE STATE MAY BE READ, not just on how it is
// worded — which is why it lives in the supervisor's own persisted store rather
// than on the mentee. A field on `DEMO_TEENS` would be a property OF THE TEEN,
// and the next surface to render a teen would have to remember not to show it.
// Here there is nothing to remember: the data is not attached to the person.
//
// ═══ "PIN", AND NEVER "FOLLOW" ═══
//
// E.10 requires one word used everywhere. It is `pin`. Both were in play —
// "follow" carries a social-feed connotation this product should not borrow,
// and "pin" is what the phase itself is titled. Every identifier, every string
// and every comment in this feature says pin; a test greps for the other one.
// NEEDS-COPY-NICOLE on the reader-facing strings regardless: nobody has ruled.
//
// ═══ WHY AN ARRAY OF {id, at} AND NOT A SET ═══
//
// Phase F orders the Today section by PIN TIME ascending and has to report
// "rendered order vs pin timestamps". An array preserves insertion order, so
// the order is the data rather than a sort — and the timestamp makes the claim
// checkable instead of merely visible. Re-pinning appends, which is correct:
// the new pin is newer.

/** ═══ FIVE (E.8) ═══
 *  Small enough to stay a shortlist. The cap is what keeps it one — and at the cap
 *  the control EXPLAINS rather than disabling, per the standing constraint that
 *  a control which cannot act says why. */
export const PIN_CAP = 5;

export interface PinnedMentee {
  id: string;
  /** When it was pinned. Phase F's ordering key. */
  at: number;
}

export function isPinned(pinned: PinnedMentee[], id: string): boolean {
  return pinned.some((p) => p.id === id);
}

/** At the cap AND this one is not already in the set — the only state in which
 *  the toggle cannot add. An already-pinned mentee can always be unpinned. */
export function atPinCap(pinned: PinnedMentee[], id: string): boolean {
  return pinned.length >= PIN_CAP && !isPinned(pinned, id);
}
