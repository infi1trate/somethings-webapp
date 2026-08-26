// THE ACTIVITY LEDGER SINK — a STUBBED APPEND-ONLY STORE (§6).
//
// TODO-DATA: THERE IS NO ACTIVITY EVENT BUS IN THIS REPO. The Activity ledger
// built in the A-series reads FIXTURES (lib/activity/seed.ts) and has no writer —
// audited. So this is the append-only store §6 permits, and the gap is logged
// (design-system-gaps.md row 217).
//
// WHAT MATTERS IS THAT THE TIMING RULE SHIPS NOW, in resolve.ts, so it cannot be
// wired wrong later. This module is only the destination.
//
// APPEND-ONLY, AND THAT IS THE WHOLE POINT. There is no remove, no update, no
// clear. §6: "An event, once written, is never retracted by this surface." A store
// with a delete would make that a convention rather than a property.

import {
  SYSTEM_ACTOR_ID,
  type ActivityEvent,
  type ActivityEventType,
} from "@/lib/activity/events";
import { ACTIVITY_DOMAIN_OF, type TaskItem } from "@/lib/tasks/types";

/** TODO-DATA. The acting supervisor. There is no auth in this prototype, so the
 *  actor is a constant — but it is a NAMED constant rather than a literal at the
 *  call site, because the day there is a session this is the one line to change
 *  and every event already carries the right shape. */
export const TASKS_ACTOR_ID = "sup-lydia";

/** The event a resolved task writes. Escalations are absent DELIBERATELY: they
 *  never resolve on this surface (locked decision 3), so there is no event type
 *  here that could be emitted for one. */
const EVENT_FOR_DOMAIN: Partial<Record<TaskItem["domain"], ActivityEventType>> = {
  riskFlag: "RISK_FLAG_CLOSED",
  // Monitoring IS a risk-flag event in the ledger — the tier differs, not the
  // domain. Same reasoning as ACTIVITY_DOMAIN_OF's monitoring → risk mapping.
  monitoring: "RISK_FLAG_CLOSED",
  billing: "BILLING_REVIEW_COMPLETE",
};

export function eventTypeFor(item: TaskItem): ActivityEventType | null {
  return EVENT_FOR_DOMAIN[item.domain] ?? null;
}

let seq = 0;

/** Build the event a resolve will write. Built at RESOLVE time and held, not
 *  built when the window closes — so the recorded `occurredAt` is when the
 *  supervisor actually decided, not when a timer happened to fire six seconds
 *  later. The TIMING of the write is what §6 governs; the timestamp is the
 *  decision's own. */
export function buildResolveEvent(
  item: TaskItem,
  decidedAt: number,
  detail: Record<string, unknown> = {}
): ActivityEvent | null {
  const eventType = eventTypeFor(item);
  if (!eventType) return null;
  seq += 1;
  return {
    id: `tk-ev-${seq}`,
    eventType,
    actorId: TASKS_ACTOR_ID,
    actorType: "staff",
    objectType: item.domain === "billing" ? "teen" : "conversation",
    objectId: item.objectId,
    occurredAt: new Date(decidedAt).toISOString(),
    payload: {
      teenId: item.teenId,
      taskId: item.id,
      taskType: item.taskType,
      // The Activity domain, mapped — never the Tasks domain string, which
      // Activity would silently fail to match (row 208).
      domain: ACTIVITY_DOMAIN_OF[item.domain],
      ...detail,
    },
  };
}

// ── The store ───────────────────────────────────────────────────────────────

const written: ActivityEvent[] = [];

/** APPEND. The only mutation this module has. */
export function appendActivityEvent(event: ActivityEvent): void {
  written.push(event);
}

/** Read the ledger. A copy, so a caller cannot splice the real array and defeat
 *  append-only from the outside. */
export function activityLedger(): ActivityEvent[] {
  return [...written];
}

/** TEST SEAM ONLY, and named so it reads as one at every call site. Not a
 *  product path: nothing in `src/components` may import this, and the timing tests
 *  are the only callers. Without it each test would inherit the previous test's
 *  ledger, which is the kind of shared state that makes a suite pass in one order
 *  and fail in another. */
export function __resetLedgerForTests(): void {
  written.length = 0;
  seq = 0;
}

void SYSTEM_ACTOR_ID;
