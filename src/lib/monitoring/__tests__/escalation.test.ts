// THE TWO CLOCKS AND THE CLOSE-OUT SET. Both clocks are real durations, and one
// of them has a contested start point — so the test pins the BEHAVIOUR of the
// choice the code documents rather than asserting a number, and it will fail
// loudly if someone flips the start without reading the comment.

import { describe, expect, it } from "vitest";
import {
  ESCALATION_ACK_SLA,
  ESCALATION_NOTE_CLOCK_START_UNRESOLVED,
  ESCALATION_NOTE_SLA,
  ESCALATION_SAFETY_PLAN_SLA,
} from "@/lib/monitoring/constants";
import {
  ackStateFor,
  closeOutOf,
  closeOutOpen,
  compareEscalations,
  isAlarming,
  isDocumented,
  isSettled,
  noteDeadline,
  recordLifecycleOf,
  type EscalationRecord,
} from "@/lib/monitoring/escalation";

const NOW = 1_760_000_000_000;
const MINUTE = 60_000;
const HOUR = 3_600_000;

function rec(o: Partial<EscalationRecord> = {}): EscalationRecord {
  return {
    id: "e1",
    teenId: "t1",
    teenName: "Ava M.",
    mentorId: "m1",
    mentorName: "Brandon Forant",
    conversationId: "c1",
    triggeredAt: NOW - 2 * MINUTE,
    acknowledgedAt: null,
    resolvedAt: null,
    is911: false,
    caregiverInvolved: null,
    closeOutDone: [],
    ...o,
  };
}

describe("the acknowledgement clock", () => {
  it("is pending inside the window and breached past it", () => {
    expect(ackStateFor(rec({ triggeredAt: NOW - ESCALATION_ACK_SLA + MINUTE }), NOW)).toBe("pending");
    expect(ackStateFor(rec({ triggeredAt: NOW - ESCALATION_ACK_SLA - MINUTE }), NOW)).toBe("breached");
  });

  it("stops asking once somebody has acknowledged, however late they were", () => {
    expect(
      ackStateFor(rec({ triggeredAt: NOW - 6 * HOUR, acknowledgedAt: NOW - 5 * HOUR }), NOW)
    ).toBe("acknowledged");
  });

  it("earns the page's one saturated treatment while active or unacknowledged", () => {
    expect(isAlarming(rec(), NOW)).toBe(true);
    // Resolved and acknowledged: a compliance question, not an emergency.
    expect(
      isAlarming(rec({ triggeredAt: NOW - 8 * HOUR, acknowledgedAt: NOW - 8 * HOUR, resolvedAt: NOW - HOUR }), NOW)
    ).toBe(false);
  });
});

describe("the escalation note clock", () => {
  it("does not start until the escalation is resolved, under the provisional reading", () => {
    /* THE CONTESTED HALF. One source document counts from the escalation
       occurring, the other from full resolution. While the constant says
       "resolved", an unresolved escalation has NO note deadline — expressed as
       null rather than as a date in the past, which would show an overdue note
       for a crisis still running. */
    expect(ESCALATION_NOTE_CLOCK_START_UNRESOLVED).toBe("resolved");
    expect(noteDeadline(rec())).toBeNull();
    const resolvedAt = NOW - 2 * HOUR;
    expect(noteDeadline(rec({ resolvedAt }))).toBe(resolvedAt + ESCALATION_NOTE_SLA);
  });
});

describe("the close-out set", () => {
  it("is always four items, done or not", () => {
    const items = closeOutOf(rec({ resolvedAt: NOW - HOUR }), NOW);
    expect(items.map((i) => i.id)).toEqual(["note", "debrief", "teenFollowUp", "safetyPlan"]);
  });

  it("keeps a completed item on screen rather than hiding it", () => {
    const items = closeOutOf(rec({ resolvedAt: NOW - HOUR, closeOutDone: ["note"] }), NOW);
    expect(items.find((i) => i.id === "note")?.done).toBe(true);
    expect(items).toHaveLength(4);
  });

  it("asks for the teen follow-up when caregiver involvement is unknown", () => {
    /* THE BLOCKER'S BEHAVIOUR. The field does not exist upstream, so `null` must
       leave the obligation standing: skipping a needed follow-up costs more than
       asking for one that was not needed. */
    const item = closeOutOf(rec({ resolvedAt: NOW - HOUR, caregiverInvolved: null }), NOW).find(
      (i) => i.id === "teenFollowUp"
    );
    expect(item?.condition?.applies).toBe(true);
    expect(closeOutOpen(rec({ resolvedAt: NOW - HOUR }), NOW).map((i) => i.id)).toContain("teenFollowUp");
  });

  it("drops it only when a caregiver is recorded as involved", () => {
    const involved = rec({ resolvedAt: NOW - HOUR, caregiverInvolved: true });
    expect(closeOutOpen(involved, NOW).map((i) => i.id)).not.toContain("teenFollowUp");
    const not = rec({ resolvedAt: NOW - HOUR, caregiverInvolved: false });
    expect(closeOutOpen(not, NOW).map((i) => i.id)).toContain("teenFollowUp");
  });

  it("gives the safety plan no deadline, because none is published", () => {
    expect(ESCALATION_SAFETY_PLAN_SLA).toBeNull();
    const plan = closeOutOf(rec({ resolvedAt: NOW - 100 * HOUR }), NOW).find((i) => i.id === "safetyPlan");
    expect(plan?.dueAt).toBeNull();
    // AND IT IS NEVER OVERDUE, because a clock that does not exist cannot run out.
    expect(plan?.overdue).toBe(false);
  });

  it("marks an overdue note overdue", () => {
    const late = rec({ resolvedAt: NOW - (ESCALATION_NOTE_SLA + HOUR) });
    expect(closeOutOf(late, NOW).find((i) => i.id === "note")?.overdue).toBe(true);
  });
});

describe("when a record may leave the surface", () => {
  it("does not leave when it is resolved but still owes work", () => {
    expect(isSettled(rec({ resolvedAt: NOW - HOUR }), NOW)).toBe(false);
  });

  it("leaves only when every owed item is done", () => {
    const all = rec({
      resolvedAt: NOW - HOUR,
      closeOutDone: ["note", "debrief", "teenFollowUp", "safetyPlan"],
    });
    expect(isSettled(all, NOW)).toBe(true);
  });

  it("counts a non-applicable conditional item as not owed", () => {
    const withCaregiver = rec({
      resolvedAt: NOW - HOUR,
      caregiverInvolved: true,
      closeOutDone: ["note", "debrief", "safetyPlan"],
    });
    // The teen follow-up is not required, so the set is complete without it.
    expect(isSettled(withCaregiver, NOW)).toBe(true);
  });

  it("never settles while it is still active", () => {
    const active = rec({ closeOutDone: ["note", "debrief", "teenFollowUp", "safetyPlan"] });
    expect(isSettled(active, NOW)).toBe(false);
  });
});

describe("the region's order", () => {
  it("puts active above resolved, then unacknowledged, then oldest", () => {
    const resolved = rec({ id: "resolved", resolvedAt: NOW - HOUR, acknowledgedAt: NOW - 2 * HOUR, triggeredAt: NOW - 3 * HOUR });
    const acked = rec({ id: "acked", acknowledgedAt: NOW - MINUTE, triggeredAt: NOW - 20 * MINUTE });
    const unacked = rec({ id: "unacked", triggeredAt: NOW - 10 * MINUTE });
    const sorted = [resolved, acked, unacked].sort((a, b) => compareEscalations(a, b, NOW));
    expect(sorted.map((r) => r.id)).toEqual(["unacked", "acked", "resolved"]);
  });
});

/** ═══ THE RECORD'S LIFECYCLE, INCLUDING THE STATE NOTHING COULD REACH ═══
 *  Written as an independent transcription of what the three labels PROMISE, so
 *  it fails if the derivation is rewritten to agree with itself. The interesting
 *  case is the fourth one: nothing owed, note missing. */
describe("the record's lifecycle", () => {
  it("is active until the escalation is resolved, whatever the paperwork says", () => {
    const active = rec({ closeOutDone: ["note", "debrief", "teenFollowUp", "safetyPlan"] });
    expect(recordLifecycleOf(active, NOW)).toBe("active");
  });

  it("is closed-outstanding while anything owed is open", () => {
    const closed = rec({ resolvedAt: NOW - HOUR, closeOutDone: ["note"] });
    expect(isDocumented(closed)).toBe(true);
    expect(closeOutOpen(closed, NOW).length).toBeGreaterThan(0);
    expect(recordLifecycleOf(closed, NOW)).toBe("closedOutstanding");
  });

  it("reaches the terminal state when the note is recorded and nothing is owed", () => {
    const done = rec({
      resolvedAt: NOW - HOUR,
      caregiverInvolved: true,
      closeOutDone: ["note", "debrief", "safetyPlan"],
    });
    expect(recordLifecycleOf(done, NOW)).toBe("closedDocumented");
  });

  it("is NOT terminal when nothing is owed but the note was never recorded", () => {
    /* ═══ THE CASE THAT MAKES `isDocumented` NECESSARY ═══
       `closeOutOpen` waives a conditional item and counts a DONE item as not
       owed — so "nothing owed" is reachable without the note if the note is
       marked done... which is why this asks the opposite question: a record
       whose other three items are done and whose NOTE is not is still settled
       by the checklist's own arithmetic only if the note is done. Here it is
       not, so the record must not claim to be documented. */
    const noNote = rec({
      resolvedAt: NOW - HOUR,
      caregiverInvolved: true,
      closeOutDone: ["debrief", "safetyPlan"],
    });
    expect(isDocumented(noNote)).toBe(false);
    expect(recordLifecycleOf(noNote, NOW)).toBe("closedOutstanding");
  });
});
