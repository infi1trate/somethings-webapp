// ═══════════════════════════════════════════════════════════════════════════
// THE RETIRED ROUTES, AND WHERE EACH LINK LANDS
//
// ═══ SUPERSEDED IN PART (proto/monitoring-merge, answered 2026-10-19) ═══
// `/app/monitoring` is a DESTINATION again — the tiered Monitoring page — so
// it left this list, and `/app/escalations` and `/app/risk-flags` joined it:
// their dashboards folded into Monitoring. Every landing that used to be
// Escalations or Risk Flags is Monitoring now, in one hop. What follows is
// the original account; where it says Risk Flags or the escalation record's
// route, read Monitoring.
//
// `/app/home`, `/app/tasks` and `/app/monitoring` stopped being destinations in
// the restructure. `/app/coverage` and `/app/mentor-practice` joined them in the
// addendum — the first because Coverage IS Chat and routes to the conversation
// surface that already exists, the second because Mentor Practice is not a real
// concept in this product and has no successor.
//
// A REMOVED DESTINATION STILL NEEDS A LANDING. Both shipped, both were in the
// rail, and a bookmark or a Slack link to either is now in somebody's history.
// Mentor Practice is the harder case precisely because nothing replaced it: it
// lands on Risk Flags, which is the other review queue, and the hop is honest
// rather than silent — `RetiredRoute` names the destination it is sending the
// reader to. Every
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

export type RetiredSurface =
  | "home"
  | "tasks"
  | "coverage"
  | "mentor-practice"
  /* Folded into Monitoring (proto/monitoring-merge). */
  | "escalations"
  | "risk-flags";

/** Where Escalations, Risk Flags and their old landings all go now. */
export const MONITORING_PATH = "/app/monitoring";

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
  /** A risk flag id — Today's deep link into one flag. Carried to Monitoring. */
  flag?: string | null;
}

/** Monitoring, with a record id carried as a param so it is not lost.
 *  TODO(monitoring): the page does not open the record yet. */
const toMonitoring = (key?: "escalation" | "flag", id?: string | null) =>
  id && key ? `${MONITORING_PATH}?${key}=${encodeURIComponent(id)}` : MONITORING_PATH;

/** THE OLD FOUR QUEUES → THE THREE DESTINATIONS. Three of the four were one
 *  destination wearing the severity taxonomy as three hats, which is the
 *  collapse this pass performs — so three of these five rows point at the same
 *  place, and that is the answer rather than a loss. */
const QUEUE_TO_DESTINATION: Record<string, string> = {
  imminent: MONITORING_PATH,
  clinical: MONITORING_PATH,
  routine: MONITORING_PATH,
  billing: "/app/care-reviews",
  all: MONITORING_PATH,
};

/** ═══ `/app/monitoring` IS A PAGE AGAIN, AND ITS OLD LINKS STILL POINT ═══
 *  (proto/monitoring-merge). While it was a hop, the shift digest's per-band
 *  links and the four-queue bookmarks carried billing work through it to Care
 *  Reviews. Those links still exist, and now that the route renders Monitoring
 *  they would strand a reader on the tiers with no billing review in sight.
 *  So: a billing band or the billing queue still hops to Care Reviews; every
 *  other param (flags, escalations, a bare visit) is Monitoring's own, and
 *  returns null — stay on the page. */
export function monitoringLegacyTarget(params: RetiredParams = {}): string | null {
  const type = asTaskType(params.band ?? null);
  if (type) {
    const dest = destinationOf(type);
    if (dest && dest !== "escalations" && dest !== "risk-flags") return `/app/${dest}`;
  }
  if (params.queue === "billing") return QUEUE_TO_DESTINATION.billing;
  return null;
}

export function retiredRouteTarget(
  from: RetiredSurface,
  params: RetiredParams = {}
): string {
  /* THE RECORD'S OWN URL WINS OVER EVERYTHING. An escalation id is a request for
     one object, not for a queue, and `/app/escalation/{id}` is where that object
     lives — a route this pass does not touch. */
  /* Monitoring now (proto/monitoring-merge), in ONE hop. Sending an id to
     `/app/escalation/{id}` would come back through `escalationRecordHref`,
     and from `/app/escalations` that was a loop waiting to happen. */
  if (params.escalation) return toMonitoring("escalation", params.escalation);
  if (from === "risk-flags") return toMonitoring("flag", params.flag);
  if (from === "escalations") return MONITORING_PATH;
  if (params.region === "escalations") return MONITORING_PATH;

  const type = asTaskType(params.band ?? null);
  if (type) {
    const dest = destinationOf(type);
    /* The task model still names escalations and risk-flags as owners; their
       page is Monitoring now. */
    if (dest === "escalations" || dest === "risk-flags") return MONITORING_PATH;
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
  /* ═══ COVERAGE → CHAT, AND IT IS A RENAME RATHER THAN A GUESS ═══
     The destination's own unit was a supervised conversation, and a conversation
     opens in the chat view. That is why §2.2 calls this a rename: the surface a
     reader wanted is the one they now get, under the name it already had. */
  if (from === "coverage") return "/app/chat";
  /* ═══ MENTOR PRACTICE → RISK FLAGS, AND THIS ONE LOSES SOMETHING ═══
     Nothing replaced it. Risk Flags is the other review queue and the nearest
     live surface, so it is the honest landing — and the loss is stated here
     rather than hidden behind a redirect that looks deliberate. */
  return MONITORING_PATH;
}
