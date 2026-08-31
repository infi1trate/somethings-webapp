// THE LOAD-STATE AXIS, as a shared dev control.
//
// ═══ WHY THIS MOVED OUT OF THE ACTIVITY PAGE ═══
//
// It lived as `useState` inside `activity-ledger.tsx`, in the same collapsible
// panel as that page's scenario list. Two problems with that, and only the second
// is about tidiness:
//
//  1. It was page-local, so it reset on every navigation — you could not set
//     "error", walk to another screen and come back to it.
//  2. It was in the wrong place. A load state is a property of the HARNESS, like
//     the persona and the scenario, not a property of the Activity feed. Putting
//     it beside the feed's own scenario list implied it only ever applied there,
//     which then became true by default because nothing else could reach it.
//
// ═══ ONE CONSUMER TODAY, AND THAT IS REPORTED, NOT HIDDEN ═══
//
// Activity is the only screen that implements load states — it is the only place
// `LoadState` was ever referenced. So this control is global and complete for
// every screen that HAS these states, which is currently one. It is not
// disabled elsewhere and it does not silently do nothing: the dev bar says which
// screen the axis applies to, so "loading" on the Tasks page reads as
// unimplemented rather than as broken. design-system-gaps row 317.

/** The four states. `partial` is "some data arrived and some failed", which is
 *  the one a real feed hits most often and the one a prototype usually skips. */
export const LOAD_STATES = ["ready", "loading", "error", "partial"] as const;

export type LoadState = (typeof LOAD_STATES)[number];

export const DEFAULT_LOAD_STATE: LoadState = "ready";

/** TODO-COPY. Sentence case for the control; the ids stay lowercase. */
export const LOAD_STATE_LABEL: Record<LoadState, string> = {
  ready: "Ready",
  loading: "Loading",
  error: "Error",
  partial: "Partial",
};

/** Which screens actually render these. Used by the dev bar to name the scope of
 *  the axis rather than implying it is universal — see the note above. */
export const LOAD_STATE_SCREENS = ["Activity"] as const;
