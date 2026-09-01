// ONE LOAD STATE IN, FOUR SURFACE STATES OUT.
//
// ═══ WHY THIS IS A MODULE AND NOT FOUR TERNARIES IN THE PAGE ═══
//
// The dev bar sets ONE value. Four surfaces have to react to it, in an order,
// and two of them react differently depending on which domain is selected. Spread
// across the page that becomes four conditionals that drift — and the drift is
// invisible, because "partial failure" only looks wrong if you happen to have the
// Billing tab selected when you check.
//
// Deriving it in one pure function makes the mapping a thing that can be read and
// tested, rather than a behaviour that has to be reproduced by clicking.
//
// ═══ THE HIERARCHY IS AN ORDER, NOT A DELAY ═══
//
// The brief asks that the four resolve independently and in order: tab-cards,
// then list rows, then pane, then excerpt. That is modelled as a STAGE COUNT
// rather than as timers — the page advances the stage and each surface asks
// whether its own turn has come. Timers would make the sequence unobservable in a
// test and unpredictable on a slow machine.

import type { TaskDomain } from "@/lib/tasks/types";
import type { LoadState } from "@/lib/dev/load-state";

/** The three surfaces below the cards each carry the same tri-state. */
export type SurfaceState = "ready" | "loading" | "error";

export interface LoadPlan {
  cards: SurfaceState;
  list: SurfaceState;
  pane: SurfaceState;
  excerpt: SurfaceState;
}

/** ═══ PARTIAL FAILURE: WHICH DOMAINS BREAK ═══
 *
 *  Risk-flag domains fail; Billing stays healthy. That is the existing behaviour
 *  the brief preserves, and it is the realistic one — the flag pipeline and the
 *  billing ledger are different systems, so a partial outage that took both would
 *  not be partial.
 *
 *  `monitoring` is a risk-flag domain for this purpose: it is fed by the same
 *  flag pipeline, so an outage that spares it would be telling a lie about how
 *  the data arrives. */
export const PARTIAL_FAILURE_DOMAINS: TaskDomain[] = [
  "riskFlag",
  "escalation",
  "monitoring",
];

export function domainFailsUnderPartial(domain: TaskDomain): boolean {
  return PARTIAL_FAILURE_DOMAINS.includes(domain);
}

/** How many stages the loading sequence has. Exported so the page's advance loop
 *  and any test agree on when it is finished. */
export const LOAD_STAGES = 4;

/** Derive every surface's state.
 *
 *  `stage` counts how many surfaces have resolved (0 = none). It is ignored
 *  unless the load state is `loading`, because it only describes a sequence that
 *  only `loading` has.
 *
 *  `selectedDomain` decides the pane and excerpt under partial failure: the pane
 *  shows its inline error ONLY if the selected item's domain failed. A pane that
 *  errored while showing a healthy Billing item would be claiming an outage that
 *  did not touch it. */
export function loadPlanFor(
  load: LoadState,
  stage: number,
  selectedDomain: TaskDomain | null
): LoadPlan {
  if (load === "ready") {
    return { cards: "ready", list: "ready", pane: "ready", excerpt: "ready" };
  }

  if (load === "error") {
    // A total outage takes everything. The cards still RENDER — they are chrome
    // with counts in them, and a page with no tab row is a broken page rather
    // than a failed fetch — but the list, pane and excerpt all say so.
    return { cards: "ready", list: "error", pane: "error", excerpt: "error" };
  }

  if (load === "partial") {
    const failed = selectedDomain ? domainFailsUnderPartial(selectedDomain) : false;
    return {
      cards: "ready",
      // THE LIST FAILS PER DOMAIN, so the reader can switch to Billing and see a
      // healthy list beside a broken one — which is the whole demonstration.
      list: failed ? "error" : "ready",
      pane: failed ? "error" : "ready",
      /** ═══ THE EXCERPT FAILS EVEN WHEN THE PANE DOES NOT ═══
       *  The brief asks for this state to be reachable independently, and partial
       *  failure is where it belongs: the conversation service is not the task
       *  service, so a supervisor can be looking at a perfectly good Billing item
       *  whose transcript will not load. It is also the only way to demonstrate
       *  that an excerpt failure never blocks the resolve actions. */
      excerpt: "error",
    };
  }

  // ── loading: the staged hierarchy.
  return {
    cards: stage >= 1 ? "ready" : "loading",
    list: stage >= 2 ? "ready" : "loading",
    pane: stage >= 3 ? "ready" : "loading",
    excerpt: stage >= 4 ? "ready" : "loading",
  };
}
