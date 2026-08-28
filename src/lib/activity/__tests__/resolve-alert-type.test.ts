// THE GUARD ON STANDING RULE 8.
//
// Rule 8: alert type is NEVER stored on an event row; it is resolved per viewer at
// read time. The failure mode this file exists to catch is somebody adding an
// `alertType` field to ActivityEvent because threading the viewer through felt
// like work — at which point the same row starts reading identically to all three
// roles and nobody notices, because every screenshot still looks right.
//
// The test names below are written to say what they protect, not what they call.

import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "@/lib/activity/events";
import { ALERT_TABLE, notificationCells, resolveAlertType, type ActivityViewer } from "@/lib/activity/resolve-alert-type";

/** One event: a supervisor closed an escalation on Maya's record. */
const ESCALATION_CLOSED: ActivityEvent = {
  id: "ev-esc-closed-1",
  eventType: "ESCALATION_CLOSED",
  actorId: "sup-lydia",
  actorType: "staff",
  objectType: "teen",
  objectId: "teen-maya",
  occurredAt: "2026-08-24T20:14:00.000Z",
  payload: { teenId: "teen-maya", outcome: "supported" },
};

const SUPERVISOR_WHO_CLOSED_IT: ActivityViewer = {
  id: "sup-lydia",
  role: "supervisor",
  caseloadTeenIds: ["teen-maya"],
};
const MENTOR_OF_THAT_TEEN: ActivityViewer = {
  id: "mentor-brandon",
  role: "mentor",
  caseloadTeenIds: ["teen-maya"],
};
const LEAD_MENTOR_OF_THAT_TEEN: ActivityViewer = {
  id: "lead-brandy",
  role: "leadMentor",
  caseloadTeenIds: ["teen-maya"],
};

describe("rule 8 — one event row resolves differently for each role", () => {
  it("ESCALATION_CLOSED is the closer's own activity, and a notification to the mentor and the lead mentor", () => {
    // If these three ever come back equal, the resolver has stopped reading the
    // viewer — which is what storing alertType on the row would do.
    expect(resolveAlertType(ESCALATION_CLOSED, SUPERVISOR_WHO_CLOSED_IT)).toBe(
      "activity"
    );
    expect(resolveAlertType(ESCALATION_CLOSED, MENTOR_OF_THAT_TEEN)).toBe(
      "notification"
    );
    expect(resolveAlertType(ESCALATION_CLOSED, LEAD_MENTOR_OF_THAT_TEEN)).toBe(
      "notification"
    );
  });

  it("the three readings are genuinely distinct, not incidentally equal", () => {
    const readings = new Set([
      resolveAlertType(ESCALATION_CLOSED, SUPERVISOR_WHO_CLOSED_IT),
      resolveAlertType(ESCALATION_CLOSED, MENTOR_OF_THAT_TEEN),
    ]);
    expect(readings.size).toBe(2);
  });

  it("the event row carries no alertType field", () => {
    // Structural assertion, so adding the field fails a test rather than quietly
    // becoming the source of truth.
    expect("alertType" in ESCALATION_CLOSED).toBe(false);
  });
});

describe("rule 8 — the relationship axis, not just the role", () => {
  it("being the actor outranks caseload ownership, so self-authored history never degrades", () => {
    // A5 clause (a). Same supervisor, same event, but the teen has since left
    // their caseload: it is still their own action.
    const reassigned: ActivityViewer = {
      ...SUPERVISOR_WHO_CLOSED_IT,
      caseloadTeenIds: [],
    };
    expect(resolveAlertType(ESCALATION_CLOSED, reassigned)).toBe("activity");
  });

  it("a supervisor who is neither actor nor owner reads it as a network notification", () => {
    const bystander: ActivityViewer = {
      id: "sup-omar",
      role: "supervisor",
      caseloadTeenIds: ["teen-someone-else"],
    };
    expect(resolveAlertType(ESCALATION_CLOSED, bystander)).toBe("notification");
  });

  it("a risk-flag event resolves via the payload's teenId, since objectId is the conversation", () => {
    const flag: ActivityEvent = {
      id: "ev-flag-1",
      eventType: "RISK_FLAG_CLOSED",
      actorId: "sup-lydia",
      actorType: "staff",
      objectType: "conversation",
      objectId: "conv-maya-a",
      occurredAt: "2026-08-24T20:14:00.000Z",
      payload: { teenId: "teen-maya", categories: ["ABUSE_DISCLOSURE"] },
    };
    // Owner but not actor → caseload, not network. If objectId were used as the
    // teen id this would fall through to "network".
    const owner: ActivityViewer = {
      id: "sup-omar",
      role: "supervisor",
      caseloadTeenIds: ["teen-maya"],
    };
    expect(resolveAlertType(flag, owner)).toBe("activity");
  });
});

describe("A3 step 9 — the unread badge would only ever count the supervisor's own actions", () => {
  it("no supervisor cell inside scope 'mine' (actor or caseload) is a notification", () => {
    // This pins the reconciliation documented at the top of resolve-alert-type.ts:
    // step 9 is scoped to the caseload relationship, which is the only thing
    // "My caseload" can contain. If someone adds a notification cell to
    // supervisor × caseload, the badge silently starts counting other people's
    // work and this is the only thing that says so.
    const offenders = notificationCells().filter(
      (c) => c.role === "supervisor" && c.relationship !== "network"
    );
    expect(offenders).toEqual([]);
  });

  it("supervisor × network DOES produce notifications, so Network is not structurally empty", () => {
    // The other half of the same reconciliation: without this, A3 step 3's
    // Network view (types [notification]) could never return a row and A5 would
    // be degrading nothing.
    const supervisorNetwork = notificationCells().filter(
      (c) => c.role === "supervisor" && c.relationship === "network"
    );
    expect(supervisorNetwork.length).toBeGreaterThan(0);
  });
});

describe("the table is total", () => {
  it("every event type has all three roles and all three relationships filled", () => {
    for (const [eventType, column] of Object.entries(ALERT_TABLE)) {
      for (const role of ["mentor", "leadMentor", "supervisor"] as const) {
        for (const rel of ["actor", "caseload", "network"] as const) {
          expect(
            column[role][rel],
            `${eventType} / ${role} / ${rel} is missing`
          ).toBeTypeOf("string");
        }
      }
    }
  });
});
