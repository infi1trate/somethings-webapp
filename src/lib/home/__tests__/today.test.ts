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
  todayRationale,
  todayCards,
  todayDigestLine,
  type TodayInput,
} from "@/lib/home/today";
import { DESTINATION_ORDER } from "@/lib/ia/destinations";
import { ESCALATION_ACK_SLA } from "@/lib/monitoring/constants";
import type { EscalationRecord } from "@/lib/monitoring/escalation";
import type { MonitoringEvent } from "@/lib/monitoring/event";
import { shiftFactsFor, type ShiftFacts } from "@/lib/tasks/shift";
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
    linkedFlagIds: [],
    flaggedBy: "M",
    emergencyContact: "Guardian on file",
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
    ...over,
  };
}

/* `practiceEvent` IS GONE (addendum §2.1). It built a `noteOverdue` event with
   `subject: "mentorPractice"` and a null flag, to assert that the Mentor
   Practice card counted its own events and the Risk Flags card did not. Both
   cards are gone with the subject, and `MonitoringEvent` no longer has a shape
   that could express one. */

/** ═══ N OPEN CARE REVIEWS, AS TASK ITEMS (Phase A) ═══
 *
 *  Several tests below drove the Care Reviews open count by overriding
 *  `facts.billing.open` while leaving `items` empty. Phase A made the card read
 *  the task items — the rail's own primitive, and the only way the two surfaces
 *  can share one expression — so those overrides stopped reaching the card.
 *
 *  THE FIXTURE WAS THE THING THAT WAS WRONG, not the claims. `facts` is
 *  `shiftFactsFor(items, now)` in production, so `billing.open: 9` beside an
 *  EMPTY item list was a state the product cannot reach: the tests were
 *  asserting real claims against an impossible input, and only the setup has
 *  changed. Every claim is asserted unchanged below.
 *
 *  `overdue` STILL COMES FROM `facts`, because the card still reads it there —
 *  it answers a different question that `openCounts` does not answer. So a test
 *  needing overdue sets both, and the two now agree with each other. */
function careReviews(n: number): TaskItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `care-${i}`,
    taskType: "intakeBillingReview",
    domain: "billing",
    status: "open",
    openedAt: NOW - (i + 1) * 60 * MIN,
    slaDeadline: null,
  } as unknown as TaskItem));
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
    /* Escalations and Risk Flags folded into Monitoring (proto/monitoring-merge):
       their routes are hops now, so their cards link to the page they hop to.
       The card ids stay — the events keep their semantics. */
    const FOLDED = new Set(["escalations", "risk-flags"]);
    for (const c of todayCards(input())) {
      expect(c.href, c.id).toBe(FOLDED.has(c.id) ? "/app/monitoring" : `/app/${c.id}`);
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

  /* THE MENTOR PRACTICE CARD'S "never breaches either" TEST IS GONE with the
     destination (addendum §2.1). The invariant it shared with Risk Flags — a
     card whose destination publishes no deadline never takes a breach tone — is
     still covered by the Risk Flags case above, which is the one that survives
     and the one where a hand-written `slaDeadline` is still reachable. */

  /* ═══ THE COVERAGE CARD'S TEST IS GONE WITH THE CARD (addendum §2.2) ═══
     It pinned three things: that partial coverage never took a warning tone
     (2 of 40 is a bad shift and still not a breach), that the card's state
     came from `coverageLine` verbatim so Today and the destination could not
     phrase one fraction two ways, and that it never stated a REMAINDER —
     "38 unreviewed" being the reading that surface refused.
     THE THIRD IDEA OUTLIVES THE CARD and moves to §2.11's progress track,
     whose own rule is that completion is never expressed as a count of what is
     left. That is asserted where the track is built, not here. */

  /* ═══ INVERTED — CARE REVIEWS HAS NO PUBLISHED CLOCK (Phase B) ═══
     This asserted `tone: "breach"` and `"9 open · 2 overdue"`, on the premise
     its title states: that the Care Reviews SLA is published. It is not, and
     has not been since `CARE_REVIEW_SLA` was retired —
     `TASK_SLA_MS.intakeBillingReview` and `.monthlyReReview` are both null, so
     `deadlineFor` returns null, `slaDeadline` is null, and `isBreached` is
     false for every billing item that can exist. MEASURED: `billing.overdue`
     is 0 on all five task scenarios.
     The old test only passed by hand-setting `overdue: 2` on `facts` — an
     input the product cannot produce, the same impossibility Phase A found in
     three other fixtures here.
     SO THE ASSERTION IS NOW THE ABSENCE, and it is asserted through the
     PRODUCTION PATH rather than a hand-built `facts`: real items, real
     `shiftFactsFor`. It fails the day a billing clock is published, which is
     the day this card is allowed to breach again — and that decision belongs
     to `sla.ts` and a review, not to a branch left behind in case. */
  it("cannot breach Care Reviews, because no clock is published for it", () => {
    const items = careReviews(9);
    const facts = shiftFactsFor(items, NOW);
    expect(
      facts.billing.overdue,
      "a billing SLA has been published — Care Reviews may breach again"
    ).toBe(0);
    const card = byId(todayCards(input({ items, facts })))["care-reviews"];
    expect(card.tone).toBe("attention");
    expect(card.state).toMatch(/^9 open · oldest /);
  });
});

describe("the acknowledgement clock, on both sides of five minutes", () => {
  it("calls an escalation inside its window urgent but not breached", () => {
    const records = [esc({ triggeredAt: NOW - MIN })];
    const card = byId(todayCards(input({ escalations: records })))["escalations"];
    expect(card.tone).toBe("attention");
    expect(card.count).toBe(1);
    /* ═══ RETARGETED — THE ACK CLAUSE LEFT THE ROW (Phase B.2) ═══
       This read "1 active · 1 awaiting acknowledgement". Phase B gives every
       row two clauses — count plus age of oldest — and the acknowledgement
       clause was the third. WHAT THE TEST IS ABOUT SURVIVES UNCHANGED: an
       escalation INSIDE its five minutes is urgent and not breached, which is
       the `tone` assertion above and is the half that was always load-bearing. */
    expect(card.state).toMatch(/^1 active · oldest /);
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
    /* ═══ THE INVARIANT OUTLIVED THE CLAUSE THAT SHOWED IT (Phase B.2) ═══
       Three active, two of them unacknowledged — not five of anything. The row
       no longer PRINTS the acknowledgement subset, so the double-count can no
       longer appear in the sentence; it can still appear in the FIGURE, which
       is the number the rail also renders. So the assertion moves to `count`
       and the rendered check becomes "the sentence states three and nothing
       else numeric". */
    expect(card.count).toBe(3);
    /* THE ACTIVE COUNT LEADS, and the second clause is whichever fact has
       precedence — here the passed ack clock, because record `b` is past its
       five minutes. The old line stated the OUTSTANDING subset (2); the new one
       states the BREACHED subset (1), which is a different and more actionable
       quantity and is why the wording changed with it. */
    expect(card.state).toMatch(/^3 active · /);
    expect(card.state).toBe("3 active · 1 acknowledgement overdue");
    /* NOT FIVE OF ANYTHING — the invariant this test is named for. Exactly two
       quantities appear, and the first is the active count. */
    expect(
      card.state.match(/\d+/g),
      `"${card.state}" states more than two quantities`
    ).toHaveLength(2);
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

describe("the banner gives a reason, or it gives nothing (Phase C)", () => {
  const rationaleFor = (over: Partial<TodayInput> = {}) => {
    const i = input(over);
    return todayRationale(todayCards(i), i);
  };

  it("returns null with nothing owed, so the banner does not render", () => {
    expect(rationaleFor()).toBeNull();
  });

  it("returns null when the pipeline is down, because that is not work", () => {
    // `directiveCardId` already refuses an unavailable destination; this pins
    // that the rationale inherits the refusal rather than re-deciding it.
    expect(rationaleFor({ classifierDegraded: true })).toBeNull();
  });

  it("cites the 24-hour note before the five-minute clock", () => {
    /* BOTH CLOCKS PASSED. The note outranks the acknowledgement because the
       five minutes is an alarm a supervisor may still be inside of, while a
       late note is simply late — so the stronger claim is the one that ships. */
    const r = rationaleFor({
      escalations: [
        esc({
          id: "a",
          triggeredAt: NOW - 3 * 24 * 60 * MIN,
          resolvedAt: NOW - 2 * 24 * 60 * MIN,
        }),
        esc({ id: "b", triggeredAt: NOW - ESCALATION_ACK_SLA - MIN }),
      ],
    });
    expect(r?.basis).toBe("clock");
    expect(r?.reason).toMatch(/24-hour/);
  });

  it("cites the passed acknowledgement when no note is late", () => {
    const r = rationaleFor({
      escalations: [esc({ triggeredAt: NOW - ESCALATION_ACK_SLA - MIN })],
    });
    expect(r?.id).toBe("escalations");
    expect(r?.basis).toBe("clock");
    expect(r?.reason).toBe(
      "1 escalation has passed the five-minute acknowledgement."
    );
  });

  it("cites a RUNNING clock in the future tense, with the time left", () => {
    // Two minutes in, so three remain. The only future-tense reason on the
    // surface, and it is derived from the oldest unacknowledged escalation —
    // the one whose clock runs out first.
    const r = rationaleFor({
      escalations: [esc({ triggeredAt: NOW - 2 * MIN })],
    });
    expect(r?.basis).toBe("clock");
    expect(r?.reason).toBe("An acknowledgement is due in 3m.");
  });

  it("falls to the oldest when the destination has no clock", () => {
    const items = careReviews(4);
    const r = rationaleFor({ items, facts: shiftFactsFor(items, NOW) });
    expect(r?.id).toBe("care-reviews");
    expect(r?.basis).toBe("oldest");
    expect(r?.reason).toMatch(/^Care Reviews holds the oldest work waiting — /);
    /* AND IT DOES NOT SAY "ago" — see the reason's own note. "waiting — 6h ago"
       states the relation twice; the row keeps the suffix, the sentence does
       not, and both read the same instant through `ageOf`. */
    expect(r?.reason).not.toMatch(/ago/);
    expect(r?.reason).toMatch(/— \d+[mhd]\.$/);
  });

  it("refuses to claim `oldest` when something else is older", () => {
    /* ═══ THE WHOLE POINT OF RATIONALE-OR-NOTHING ═══
       `directiveCardId` picks by TONE, not by age. So the recommended
       destination is not always the oldest — and "it holds the oldest work
       waiting" would then be false. A banner that lies about its reason is
       worse than no banner, and C.3 already provides for its absence.
       HERE: Risk Flags and Care Reviews are both `attention`, the flag is 30
       days old and the reviews are hours old. Whichever the ladder picks, the
       claim can only be made about one of them — and if it picks the younger,
       nothing is returned. */
    const items = careReviews(4);
    const r = rationaleFor({
      items,
      facts: shiftFactsFor(items, NOW),
      events: [flagEvent()],
    });
    if (r != null) {
      // If a rationale WAS derived, it must be about the genuinely oldest.
      expect(r.basis).toBe("oldest");
      expect(r.id).toBe("risk-flags");
    }
    // And either way it never claims "oldest" about the care reviews.
    expect(r?.id).not.toBe("care-reviews");
  });

  it("never names more than one destination — it is a reason, not a list", () => {
    /* C.2: not a restatement of the list below it. The digest sentence names
       every destination that needs attention; this must name at most the one it
       recommends, which is the difference the phase exists to make.
       ═══ RETARGETED FROM "NAMES NONE" TO "NAMES AT MOST ONE" ═══
       The original asserted zero, which was stricter than the claim and
       produced a real defect: the oldest-basis reason read "It holds the
       oldest work waiting", and the pronoun had no antecedent because the
       reason is read BEFORE the CTA that names the destination. One name is
       not a list; three is. */
    const items = careReviews(4);
    const labels = ["Escalations", "Risk Flags", "Care Reviews"];
    for (const over of [
      { escalations: [esc({ triggeredAt: NOW - ESCALATION_ACK_SLA - MIN })] },
      { items, facts: shiftFactsFor(items, NOW) },
      { items, facts: shiftFactsFor(items, NOW), events: [flagEvent()] },
    ]) {
      const r = rationaleFor(over);
      if (r == null) continue;
      const named = labels.filter((l) => r.reason.includes(l));
      expect(
        named.length,
        `"${r.reason}" names ${named.length} destinations`
      ).toBeLessThanOrEqual(1);
    }
  });

  it("carries no digit it cannot derive, and no invented statistic", () => {
    // Every number in a reason must come from a count or a clock. The reasons
    // are enumerated, so this is checkable: each one either has no digits or
    // has digits that appear in the obligations it was built from.
    const r = rationaleFor({
      escalations: [esc({ triggeredAt: NOW - ESCALATION_ACK_SLA - MIN })],
    });
    /* EXACTLY ONE DIGIT, AND IT IS THE COUNT. The SLA is spelled out —
       "five-minute", not "5-minute" — which is why it does not appear here;
       a numeral in a reason should be a quantity the reader can act on, and
       the SLA is a constant. */
    expect(r?.reason.match(/\d+/g)).toEqual(["1"]);
    expect(r?.reason).toContain("five-minute");
  });
});

describe("colour is never the sole carrier of a breach", () => {
  /* ═══ THE REGRESSION THIS CATCHES, MEASURED ═══
     Phase B cut the Escalations line from three clauses to two. On the
     ack-breach path that left "2 active · oldest 12m ago" at `tone: "breach"` —
     the passed clock carried by the tone and by an `aria-hidden` glyph, which
     means carried by NOTHING for a screen-reader user, because the row's
     accessible name is built from `label` and `state` alone.
     SO THE INVARIANT IS ON `state`, WHERE THE ACCESSIBLE NAME COMES FROM. A
     glyph satisfies the standing constraint for a sighted reader and this
     covers the other one; both are required, and only one of them is checkable
     here. */
  const BREACH_WORDS = /overdue|breach|past/i;

  it("states the breach in the text of every breaching card", () => {
    const fixtures = [
      {
        name: "acknowledgement clock passed",
        input: input({
          escalations: [esc({ triggeredAt: NOW - ESCALATION_ACK_SLA - MIN })],
        }),
      },
      {
        name: "acknowledgement passed with a second escalation live",
        input: input({
          escalations: [
            esc({ id: "a", triggeredAt: NOW - ESCALATION_ACK_SLA - MIN }),
            esc({ id: "b", triggeredAt: NOW - MIN }),
          ],
        }),
      },
    ];
    let breaching = 0;
    for (const f of fixtures) {
      for (const card of todayCards(f.input)) {
        if (card.tone !== "breach") continue;
        breaching += 1;
        expect(
          card.state,
          `${f.name}: "${card.state}" is breach-toned but says no breach`
        ).toMatch(BREACH_WORDS);
      }
    }
    /* THE INPUT IS ASSERTED: a run that produced no breaching card would
       satisfy the loop and check nothing. */
    expect(breaching).toBeGreaterThan(1);
  });

  it("does not cry breach on a card inside its clock", () => {
    // The other half of the pair: an escalation with four minutes left is
    // urgent and must NOT be toned or worded as breached.
    const card = byId(
      todayCards(input({ escalations: [esc({ triggeredAt: NOW - MIN })] }))
    )["escalations"];
    expect(card.tone).toBe("attention");
    expect(card.state).not.toMatch(BREACH_WORDS);
  });
});

describe("the fixture helper produces what production would", () => {
  it("makes `facts.billing.open` and the item list agree", () => {
    /* ═══ THE FIXTURE CHECKS ITSELF ═══
       The tests above pass BOTH `items: careReviews(n)` and
       `facts.billing.open: n`, because the card reads the first for its open
       count and the second for `overdue`. That is two hand-set numbers that
       must agree, which is exactly the shape of the defect Phase A closed one
       level up — so it is asserted rather than trusted: if `careReviews` ever
       stops producing items `shiftFactsFor` counts as open billing, every test
       that pairs them is silently testing an impossible input again. */
    for (const n of [1, 4, 9, 40]) {
      expect(shiftFactsFor(careReviews(n), NOW).billing.open, `n=${n}`).toBe(n);
    }
  });
});

describe("the shift-start line names destinations and counts nothing", () => {
  /* ═══ THE RE-ORDERING IS REAL AND CURRENTLY UNREACHABLE (Phase B) ═══
     This proved `todayDigestLine` sorts breach ahead of attention, using Care
     Reviews as the breaching half — it sits BELOW Risk Flags in
     `DESTINATION_ORDER`, so a breach-first line demonstrated the re-sort.
     THAT FIXTURE IS NOW IMPOSSIBLE. Care Reviews cannot breach (no published
     clock) and neither can Risk Flags (`FLAG_REVIEW_SLA` is null, blocked on
     Meg). The ONLY destination that can breach is Escalations — and it is
     already first in rail order, so no input can produce a line whose breach
     half had to move.
     SO THE CODE IS CORRECT AND THE BEHAVIOUR IS A NO-OP, which is worth
     asserting rather than deleting — the same posture `teen-namespaces.test.ts`
     takes: "a test that asserts the BROKEN state is what makes the breakage
     visible and its repair noticed". These two assert the current shape and
     FAIL the day a second destination can breach, with the instruction on what
     to restore. */
  it("sorts breach ahead of attention — checked directly, because no fixture can", () => {
    // The pure function, fed the two tones it exists to order. Feeding it cards
    // rather than building an impossible input is what keeps this checkable.
    const line = todayDigestLine([
      { id: "risk-flags", label: "Risk Flags", state: "", tone: "attention", href: "", count: 1 },
      { id: "care-reviews", label: "Care Reviews", state: "", tone: "breach", href: "", count: 1 },
    ] as ReturnType<typeof todayCards>);
    expect(line).toBe("Care Reviews and Risk Flags need attention.");
  });

  it("and only Escalations can reach `breach` at all today", () => {
    /* THE REASON THE TEST ABOVE CANNOT USE A FIXTURE. If this fails, a second
       destination has become breach-capable: restore the fixture-driven
       ordering test above, because the re-sort is then reachable and worth
       checking end to end. */
    const breachable: string[] = [];
    const probes = [
      {
        id: "escalations",
        input: input({
          escalations: [esc({ triggeredAt: NOW - ESCALATION_ACK_SLA - MIN })],
        }),
      },
      { id: "risk-flags", input: input({ events: [flagEvent()] }) },
      {
        id: "care-reviews",
        input: (() => {
          const items = careReviews(9);
          return input({ items, facts: shiftFactsFor(items, NOW) });
        })(),
      },
    ];
    for (const p of probes) {
      const card = byId(todayCards(p.input))[p.id];
      if (card.tone === "breach") breachable.push(p.id);
    }
    expect(breachable).toEqual(["escalations"]);
  });

  it("carries no digit at all — the numbers live on the cards", () => {
    const cards = todayCards(
      input({ items: careReviews(9), facts: { ...FACTS, billing: { open: 9, overdue: 2 } } })
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
      input({ items: careReviews(1), facts: { ...FACTS, billing: { open: 1, overdue: 0 } } })
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
      input({ items: careReviews(4), facts: { ...FACTS, billing: { open: 4, overdue: 0 } } })
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
        items: careReviews(40),
        facts: { ...FACTS, billing: { open: 40, overdue: 0 } },
      })
    );
    expect(directiveCardId(cards)).toBe("escalations");
  });

  it.skip("but puts a missed review deadline above an escalation still in its window", () => {
    /* ═══ SKIPPED, NOT DELETED — THE INPUT IS UNBUILDABLE (Phase B) ═══
       "Breach outranks the protocol order" is a real rule in the ladder and it
       is currently unreachable: the only destination that can breach is
       Escalations, which the protocol order already puts first, so there is no
       pair where a breach has to overtake anything. A missed REVIEW deadline
       needs a published billing clock, which `sla.ts` does not have — the 48h
       vs 72h constant is owned by Meg and named as an open item in the Today
       pack itself.
       IT STAYS AS A SKIP because the assertion is the one to run the day that
       constant lands: unskip it, and it checks the rule it was written for.
       `it.skip` rather than a comment so the runner keeps counting it. */
    // BREACH OUTRANKS THE PROTOCOL ORDER: the first has passed a published
    // deadline, the second has not missed anything yet.
    const cards = todayCards(
      input({
        escalations: [esc({ triggeredAt: NOW - MIN })],
        items: careReviews(40),
        facts: { ...FACTS, billing: { open: 40, overdue: 1 } },
      })
    );
    expect(directiveCardId(cards)).toBe("care-reviews");
  });

  it("and an escalation past its acknowledgement window wins again", () => {
    const cards = todayCards(
      input({
        escalations: [esc({ triggeredAt: NOW - ESCALATION_ACK_SLA - MIN })],
        items: careReviews(40),
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
