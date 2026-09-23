// TODAY AS A MIRROR — the rules a browser probe cannot reach.
//
// `today-mirror.mjs` proves the numbers AGREE with the destinations and that
// nothing on the route mutates a record. What it cannot prove is that a
// disagreement is IMPOSSIBLE for inputs the shipped fixtures do not produce —
// and two of those inputs matter more than the rest:
//
//  · A FLAG PAST ITS `slaDeadline`. Every flag task item carries one (24h / 48h /
//    7d), so a breach is trivially computable and would be the largest
//    contributor to any breach count on this surface. It is forbidden because
//    those three numbers are this system's invention: `FLAG_REVIEW_SLA` is null
//    and blocked on Meg. A test that only ran the shipped fixtures would pass
//    while the prohibition was one line from being violated.
//  · AN ESCALATION INSIDE ITS FIVE MINUTES. It is the most urgent thing in the
//    console and it is not a breach, and the difference between those two
//    sentences is the whole of what the acknowledgement clock means.

import { describe, expect, it } from "vitest";
import {
  directiveCardId,
  todayCards,
  todayDigestLine,
  type TodayInput,
} from "@/lib/home/today";
import { DESTINATION_ORDER } from "@/lib/ia/destinations";
import { ESCALATION_ACK_SLA } from "@/lib/monitoring/constants";
import type { EscalationRecord } from "@/lib/monitoring/escalation";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import type { ShiftFacts } from "@/lib/tasks/shift";
import type { TaskItem } from "@/lib/tasks/types";

const NOW = 1_800_000_000_000;
const MIN = 60_000;

/** `ShiftFacts` LOST FIVE FIELDS IN PHASE 4 — `imminentOpen`,
 *  `imminentBreached`, `clinicalOpen`, `clinicalBreached`, `routineOpen` — which
 *  were the per-flag tier taxonomy, plus three the ladder read. What is left is
 *  what Today reads. */
const FACTS: ShiftFacts = {
  billing: { open: 0, overdue: 0 },
  closedToday: {},
};

function esc(over: Partial<EscalationRecord> = {}): EscalationRecord {
  return {
    id: "esc-1",
    teenId: "t1",
    teenName: "A.",
    mentorId: "m1",
    mentorName: "M",
    conversationId: null,
    triggeredAt: NOW - MIN,
    acknowledgedAt: null,
    resolvedAt: null,
    is911: false,
    caregiverInvolved: null,
    closeOutDone: [],
    ...over,
  };
}

/** A flag event whose ORIGINATING TASK ITEM is far past its `slaDeadline`. The
 *  deadline is deliberately populated — that is the trap being tested. */
function flagEvent(over: Partial<MonitoringEvent> = {}): MonitoringEvent {
  const item = {
    id: "task-1",
    taskType: "riskFlagReview",
    status: "open",
    openedAt: NOW - 30 * 24 * 60 * MIN,
    /* ═══ A DEADLINE THAT SHOULD NO LONGER EXIST, KEPT ON PURPOSE ═══
       Phase 4 made `TASK_SLA_MS.riskFlagReview` null, so the seed cannot produce
       this any more. It is HAND-WRITTEN here, 29 days in the past, because the
       assertion below is that no card breaches on it — and an input the
       production path can no longer build is exactly the input worth testing.
       If somebody re-introduces a flag SLA, the card must still not breach on
       it: that decision belongs to `FLAG_REVIEW_SLA` and a review, not to a
       field quietly becoming non-null again. */
    slaDeadline: NOW - 29 * 24 * 60 * MIN,
  } as unknown as TaskItem;
  return {
    id: "ev-1",
    kind: "riskFlag",
    subject: "teenSafety",
    teenId: "t1",
    teenName: "A.",
    mentorId: "m1",
    mentorName: "M",
    conversationId: "c1",
    at: NOW - 30 * 24 * 60 * MIN,
    category: "low mood",
    escalationOpen: false,
    patternCount: 1,
    mentorReplied: false,
    flag: item,
    practice: null,
    ...over,
  };
}

function practiceEvent(): MonitoringEvent {
  return {
    ...flagEvent(),
    id: "ev-p",
    kind: "noteOverdue",
    subject: "mentorPractice",
    flag: null,
    practice: { measure: "42m past cutoff", againstLabel: "cutoff" } as never,
  };
}

function input(over: Partial<TodayInput> = {}): TodayInput {
  return {
    items: [],
    facts: FACTS,
    events: [],
    escalations: [],
    conversations: [],
    classifierDegraded: false,
    now: NOW,
    ...over,
  };
}

const byId = (cards: ReturnType<typeof todayCards>) =>
  Object.fromEntries(cards.map((c) => [c.id, c]));

describe("the cards are the rail, always", () => {
  it("renders one card per destination, in the rail's order, even with nothing owed", () => {
    const cards = todayCards(input());
    expect(cards.map((c) => c.id)).toEqual([...DESTINATION_ORDER]);
  });

  it("links every card to its own destination and never to a retired route", () => {
    for (const c of todayCards(input())) {
      expect(c.href, c.id).toBe(`/app/${c.id}`);
    }
  });
});

describe("only a published clock may breach", () => {
  it("never breaches Risk Flags, even with every flag long past its slaDeadline", () => {
    // 120 flags, each thirty days old, each with a deadline 29 days in the past.
    const events = Array.from({ length: 120 }, (_, i) =>
      flagEvent({ id: `ev-${i}` })
    );
    const card = byId(todayCards(input({ events })))["risk-flags"];
    // THE INPUT IS ASSERTED, so this cannot pass on an empty set.
    expect(card.count).toBe(120);
    expect(card.tone).toBe("attention");
    expect(card.state).toMatch(/120 open · oldest 30d ago/);
    // AND IT SAYS NOTHING ABOUT A DEADLINE. Age only.
    expect(card.state).not.toMatch(/overdue|past|breach|due/i);
  });

  it("never breaches Mentor Practice either", () => {
    const card = byId(todayCards(input({ events: [practiceEvent()] })))[
      "mentor-practice"
    ];
    expect(card.count).toBe(1);
    expect(card.tone).toBe("attention");
    expect(card.state).not.toMatch(/overdue|past|breach|due/i);
  });

  it("never colours Coverage at all — partial coverage is not a problem state", () => {
    const conversations = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`,
      reviewedAt: i < 2 ? NOW : null,
    })) as never;
    const card = byId(todayCards(input({ conversations })))["coverage"];
    expect(card.tone).toBe("clear");
    // 2 of 40 is a bad shift and still not a breach.
    expect(card.state).toBe("2 of 40 conversations reviewed this shift");
    // AND NEVER A REMAINDER. "38 unreviewed" is the reading this view refuses.
    expect(card.state).not.toMatch(/unreviewed|remaining|left/i);
    expect(card.count).toBeNull();
  });

  it("breaches Care Reviews, because its SLA is published", () => {
    const facts = { ...FACTS, billing: { open: 9, overdue: 2 } };
    const card = byId(todayCards(input({ facts })))["care-reviews"];
    expect(card.tone).toBe("breach");
    expect(card.state).toBe("9 open · 2 overdue");
  });
});

describe("the acknowledgement clock, on both sides of five minutes", () => {
  it("calls an escalation inside its window urgent but not breached", () => {
    const records = [esc({ triggeredAt: NOW - MIN })];
    const card = byId(todayCards(input({ escalations: records })))["escalations"];
    expect(card.tone).toBe("attention");
    expect(card.count).toBe(1);
    expect(card.state).toBe("1 active · 1 awaiting acknowledgement");
  });

  it("breaches once the window has passed", () => {
    const records = [esc({ triggeredAt: NOW - ESCALATION_ACK_SLA - MIN })];
    const card = byId(todayCards(input({ escalations: records })))["escalations"];
    expect(card.tone).toBe("breach");
  });

  it("counts awaiting-acknowledgement as a subset of active, never added to it", () => {
    const records = [
      esc({ id: "a", triggeredAt: NOW - MIN }),
      esc({ id: "b", triggeredAt: NOW - ESCALATION_ACK_SLA - MIN }),
      esc({ id: "c", acknowledgedAt: NOW - MIN }),
    ];
    const card = byId(todayCards(input({ escalations: records })))["escalations"];
    // Three active, two of them unacknowledged — not five of anything.
    expect(card.count).toBe(3);
    expect(card.state).toBe("3 active · 2 awaiting acknowledgement");
  });

  it("says nothing is open rather than reporting zeroes", () => {
    const card = byId(todayCards(input()))["escalations"];
    expect(card.state).toBe("Nothing open");
    expect(card.tone).toBe("clear");
  });
});

describe("the flag pipeline's health outranks the count", () => {
  it("says the pipeline is down instead of reporting a quiet shift", () => {
    const card = byId(todayCards(input({ classifierDegraded: true })))[
      "risk-flags"
    ];
    expect(card.tone).toBe("unavailable");
    expect(card.state).toMatch(/pipeline is down/);
  });
});

describe("the shift-start line names destinations and counts nothing", () => {
  it("puts breaching destinations before merely busy ones", () => {
    const cards = todayCards(
      input({
        facts: { ...FACTS, billing: { open: 9, overdue: 2 } },
        events: [practiceEvent()],
      })
    );
    // Care Reviews breaches; Mentor Practice is attention. Rail order would put
    // Mentor Practice first, so this proves the line re-orders and the cards
    // do not.
    expect(todayDigestLine(cards)).toBe(
      "Care Reviews and Mentor Practice need attention."
    );
  });

  it("carries no digit at all — the numbers live on the cards", () => {
    const cards = todayCards(
      input({ facts: { ...FACTS, billing: { open: 9, overdue: 2 } } })
    );
    expect(todayDigestLine(cards)).not.toMatch(/\d/);
  });

  it("names no tier and asserts no flag deadline", () => {
    const events = Array.from({ length: 50 }, (_, i) => flagEvent({ id: `e${i}` }));
    const line = todayDigestLine(todayCards(input({ events }))) ?? "";
    for (const w of ["imminent", "clinical", "routine", "past 24h", "past 48h"]) {
      expect(line.toLowerCase()).not.toContain(w);
    }
  });

  it("agrees with itself in the singular", () => {
    const cards = todayCards(
      input({ facts: { ...FACTS, billing: { open: 1, overdue: 0 } } })
    );
    expect(todayDigestLine(cards)).toBe("Care Reviews needs attention.");
  });

  it("returns null with nothing owed, so no panel renders at all", () => {
    expect(todayDigestLine(todayCards(input()))).toBeNull();
  });

  it("does not count an unavailable destination as needing attention", () => {
    // The pipeline being down is a fact about the SYSTEM, not work a supervisor
    // can do — so it must not appear in a line that tells them where to go.
    const cards = todayCards(input({ classifierDegraded: true }));
    expect(todayDigestLine(cards)).toBeNull();
  });
});


describe("\"start here\" never points at an empty destination", () => {
  it("marks nothing at all when nothing is owed", () => {
    // THE DEFECT THIS REPLACED: the ladder read `ShiftFacts` and named
    // Escalations, so the dot landed on a card reading "Nothing open" while the
    // CTA offered to start with an escalation the destination did not have.
    expect(directiveCardId(todayCards(input()))).toBeNull();
  });

  it("never marks a card whose own state is clear", () => {
    const cards = todayCards(
      input({ facts: { ...FACTS, billing: { open: 4, overdue: 0 } } })
    );
    const id = directiveCardId(cards);
    expect(id).toBe("care-reviews");
    expect(cards.find((c) => c.id === id)?.tone).not.toBe("clear");
  });

  it("never marks a destination that is merely unavailable", () => {
    // A pipeline being down is a fact about the system, not work to start.
    const cards = todayCards(input({ classifierDegraded: true }));
    expect(directiveCardId(cards)).toBeNull();
  });

  it("puts a live escalation above a busy review queue", () => {
    const cards = todayCards(
      input({
        escalations: [esc({ triggeredAt: NOW - MIN })],
        facts: { ...FACTS, billing: { open: 40, overdue: 0 } },
      })
    );
    expect(directiveCardId(cards)).toBe("escalations");
  });

  it("but puts a missed review deadline above an escalation still in its window", () => {
    // BREACH OUTRANKS THE PROTOCOL ORDER: the first has passed a published
    // deadline, the second has not missed anything yet.
    const cards = todayCards(
      input({
        escalations: [esc({ triggeredAt: NOW - MIN })],
        facts: { ...FACTS, billing: { open: 40, overdue: 1 } },
      })
    );
    expect(directiveCardId(cards)).toBe("care-reviews");
  });

  it("and an escalation past its acknowledgement window wins again", () => {
    const cards = todayCards(
      input({
        escalations: [esc({ triggeredAt: NOW - ESCALATION_ACK_SLA - MIN })],
        facts: { ...FACTS, billing: { open: 40, overdue: 1 } },
      })
    );
    expect(directiveCardId(cards)).toBe("escalations");
  });

  it("falls to flag volume only when the clocks are clear", () => {
    const cards = todayCards(input({ events: [flagEvent()] }));
    expect(directiveCardId(cards)).toBe("risk-flags");
  });
});
