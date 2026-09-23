// ═══════════════════════════════════════════════════════════════════════════
// THE THREE RETIRED ROUTES, AND WHERE EACH LINK LANDS
//
// `/app/home`, `/app/tasks` and `/app/monitoring` stop being destinations. Every
// link to them that exists today — in the shift digest, in Activity's evidence
// pane, in a bookmark, in somebody's Slack message — has to land on a real
// surface rather than a 404, and landing on the RIGHT one matters because the
// wrong queue with the right chrome is indistinguishable from an empty queue.
//
// ═══ WHY A MAP RATHER THAN A `redirect()` PER ROUTE ═══
//
// Three route files would each need the same param handling, and the params are
// the part that goes wrong: `?band=<taskType>` is a task type, and the whole
// point of this restructure is that task types no longer map one-to-one onto
// surfaces. One function, one test, three thin callers.
//
// ═══ AND IT IS A PURE FUNCTION, WHICH IS WHAT MAKES IT TESTABLE ═══
//
// The previous restructure shipped a mapping whose unit test PASSED while the
// destination was reachable from nowhere: `?escalation=` mapped to a URL the
// page accepted and ignored. A URL assertion cannot tell a live destination from
// a dead one. So this is tested here for the mapping AND opened in a browser by
// the phase's probe — the two catch different failures and neither is optional.

import { destinationOf } from "@/lib/ia/destinations";
import { asTaskType } from "@/lib/tasks/types";

export type RetiredSurface = "home" | "tasks" | "monitoring";

export const TODAY_PATH = "/app/today";

export interface RetiredParams {
  /** A task type, from the old shift digest's per-band links. */
  band?: string | null;
  /** `escalations` — the old Home region anchor. */
  region?: string | null;
  /** An escalation id. Lands on the record's own route, which is NOT one of the
   *  destinations and is unchanged by this pass. */
  escalation?: string | null;
  /** One of the retired four-queue ids. Kept because a bookmark may carry one. */
  queue?: string | null;
}

/** THE OLD FOUR QUEUES → THE THREE DESTINATIONS. Three of the four were one
 *  destination wearing the severity taxonomy as three hats, which is the
 *  collapse this pass performs — so three of these five rows point at the same
 *  place, and that is the answer rather than a loss. */
const QUEUE_TO_DESTINATION: Record<string, string> = {
  imminent: "/app/risk-flags",
  clinical: "/app/risk-flags",
  routine: "/app/risk-flags",
  billing: "/app/care-reviews",
  all: "/app/risk-flags",
};

export function retiredRouteTarget(
  from: RetiredSurface,
  params: RetiredParams = {}
): string {
  /* THE RECORD'S OWN URL WINS OVER EVERYTHING. An escalation id is a request for
     one object, not for a queue, and `/app/escalation/{id}` is where that object
     lives — a route this pass does not touch. */
  if (params.escalation) {
    return `/app/escalation/${encodeURIComponent(params.escalation)}`;
  }
  if (params.region === "escalations") return "/app/escalations";

  const type = asTaskType(params.band ?? null);
  if (type) {
    const dest = destinationOf(type);
    if (dest) return `/app/${dest}`;
  }
  if (params.queue && QUEUE_TO_DESTINATION[params.queue]) {
    return QUEUE_TO_DESTINATION[params.queue];
  }

  /* ═══ THE BARE DEFAULTS, AND THE ONE THAT LOSES SOMETHING ═══
     `/app/home` was orientation and becomes `Today`, which is exactly what it
     was for — no loss. `/app/tasks` was billing plus the escalation obligations,
     and Care Reviews is the larger half. `/app/monitoring` held every flag tier
     AND coverage AND the escalation region at once, and there is no destination
     that means all of that: Risk Flags is the volume, so it is the honest guess
     and the loss is stated rather than hidden. */
  if (from === "home") return TODAY_PATH;
  if (from === "tasks") return "/app/care-reviews";
  return "/app/risk-flags";
}
