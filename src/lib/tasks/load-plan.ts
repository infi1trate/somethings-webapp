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
 *  `routineFlag` is a risk-flag domain for this purpose: it is fed by the same
 *  flag pipeline, so an outage that spares it would be telling a lie about how
 *  the data arrives. */
export const PARTIAL_FAILURE_DOMAINS: TaskDomain[] = [
  "riskFlag",
  "escalation",
  "routineFlag",
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
/** ═══ MONITORING'S OWN HIERARCHY — FIVE SURFACES, NOT FOUR ═══
 *
 *  Tasks resolves tab-cards → list → pane → excerpt. Monitoring has no cards and
 *  two things Tasks does not: an escalation region above everything, and band
 *  headers whose counts a reader uses to decide where to start.
 *
 *  THE ORDER IS THE ORDER A SUPERVISOR NEEDS IT IN, which is not the order the
 *  data would arrive in:
 *
 *    1 escalation region   is anyone in danger right now
 *    2 group headers       how much is there, and at which tiers
 *    3 list rows           which specific ones
 *    4 pane                the evidence for the first one
 *    5 excerpt             what was actually said
 *
 *  A SEPARATE FUNCTION RATHER THAN A WIDER `LoadPlan`. Tasks' four surfaces and
 *  these five are different sets, and one plan covering both would carry two
 *  fields that are always null on one surface — which is how a renderer ends up
 *  branching on a field that cannot apply to it. `LoadState` is shared; the
 *  mapping is not. */
export interface MonitoringLoadPlan {
  escalations: SurfaceState;
  headers: SurfaceState;
  list: SurfaceState;
  pane: SurfaceState;
  excerpt: SurfaceState;
}

export const MONITORING_LOAD_STAGES = 5;

export function monitoringLoadPlanFor(
  load: LoadState,
  stage: number
): MonitoringLoadPlan {
  if (load === "ready") {
    return {
      escalations: "ready",
      headers: "ready",
      list: "ready",
      pane: "ready",
      excerpt: "ready",
    };
  }

  if (load === "error") {
    /* A TOTAL OUTAGE TAKES THE WORK, NOT THE CHROME. The page header stays — a
       page with no title is a broken build rather than a failed fetch — and
       everything that would state a fact about the caseload says it could not. */
    return {
      escalations: "error",
      headers: "error",
      list: "error",
      pane: "error",
      excerpt: "error",
    };
  }

  if (load === "partial") {
    /* ═══ PARTIAL FAILURE MEANS SOMETHING DIFFERENT HERE ═══
     *
     *  On Tasks it is per-DOMAIN: the flag pipeline fails and billing stays
     *  healthy, so a reader switches tabs and sees one broken list beside a
     *  working one. Monitoring has no tabs and its domains are all flag domains,
     *  so that demonstration has nowhere to happen — and after arch-A scoped
     *  Tasks to billing, "Partial" renders there exactly like "Ready" (gap row
     *  360). It would have been inert on both surfaces.
     *
     *  SO IT SPLITS BY SYSTEM INSTEAD, which is the realistic partition and the
     *  one this surface can actually show: the ESCALATION service and the
     *  CONVERSATION service are not the flag pipeline. The flags load; the
     *  escalation region and the transcript do not. That also demonstrates the
     *  thing the excerpt's independent state exists for — a supervisor who
     *  cannot see the transcript can still act on the flag. */
    return {
      escalations: "error",
      headers: "ready",
      list: "ready",
      pane: "ready",
      excerpt: "error",
    };
  }

  // ── loading: the staged hierarchy.
  return {
    escalations: stage >= 1 ? "ready" : "loading",
    headers: stage >= 2 ? "ready" : "loading",
    list: stage >= 3 ? "ready" : "loading",
    pane: stage >= 4 ? "ready" : "loading",
    excerpt: stage >= 5 ? "ready" : "loading",
  };
}

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
