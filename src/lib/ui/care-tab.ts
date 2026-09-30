// ═══════════════════════════════════════════════════════════════════════════
// THE OPEN / SUBMITTED AXIS (Care Reviews rework §5.1)
//
// Two states, and the copy for each empty state is the load-bearing part.
//
// ═══ THE TWO EMPTIES READ DIFFERENTLY, AND §5.1 SAYS WHY ═══
//
// "No open reviews is an achievement; no closed reviews is a blank
// history." One list being empty is the resting state of finished work; the
// other is a reader who has not done anything yet, or has switched scenario.
// A single shared "Nothing here" would flatten those into the same sentence
// and teach a supervisor that an empty safety queue is unremarkable.
//
// THIS IS THE SAME RULE THE FILTERED-EMPTY STATE FOLLOWED before §4 removed
// filters: "a supervisor must never be able to mistake 'filtered to nothing'
// for 'nothing to review'." Different causes of emptiness must say different
// things.

export type CareTab = "open" | "closed";

export const CARE_TABS: readonly CareTab[] = ["open", "closed"];

/** NEEDS-COPY-NICOLE, both. The control's own labels. */
export const CARE_TAB_LABEL: Record<CareTab, string> = {
  open: "Open",
  closed: "Closed",
};

/** The accessible name for each segment, which states what it selects rather
 *  than only naming it — "Open" alone, read out of context, is an adjective. */
export const CARE_TAB_NAME: Record<CareTab, string> = {
  /* NEEDS-COPY-NICOLE, both. */
  open: "Show open reviews",
  closed: "Show closed reviews",
};

export interface CareTabEmpty {
  /** NEEDS-COPY-NICOLE. */
  line: string;
  /** NEEDS-COPY-NICOLE. The second line, where one earns its place. */
  detail?: string;
}

/** ═══ THE TWO EMPTY STATES ═══
 *  NEEDS-COPY-NICOLE throughout.
 *
 *  `open` DOES NOT CELEBRATE. An empty review queue is the resting state of
 *  this work rather than an achievement — the same rule Today's all-clear
 *  subtitle follows, and the reason neither says "nice work". §5.1 calls it an
 *  achievement to distinguish it from the other empty, not to license
 *  congratulation.
 *
 *  `submitted` SAYS WHY IT IS BLANK. A history with nothing in it is
 *  ambiguous between "you have submitted nothing this session" and "something
 *  is broken", and the second reading is the one that costs a supervisor time.
 */
export const CARE_TAB_EMPTY: Record<CareTab, CareTabEmpty> = {
  open: {
    line: "No reviews are waiting",
    detail: "Reviews you have closed stay in the Closed tab.",
  },
  closed: {
    /* NEEDS-COPY-NICOLE, both. STILL "submit" AS THE VERB, because that is the
       act the supervisor performs — see the axis note at the top on why the
       state renamed and the verb did not. */
    line: "Nothing closed yet",
    detail: "Reviews you submit appear here.",
  },
};
